# BuildFlow My Tasks Page — Design

**Date**: 2026-05-26
**Status**: Draft
**Scope**: UI and behavior for the cross-project `/my-tasks` page: three tabs (Open Tasks / Pending Review / Completed) showing tasks where the current user is the owner or reviewer, with a DB-driven priority ranking, an in-app overdue/blocked/ready banner, and a daily Lark direct-message digest. Adds a small `priority` field to `tasks` and a `lark_digest_opted_out` field to `users`. Adds three Server Actions and one cron-style Route Handler.
**Depends on**: `2026-05-22-foundation-design.md` (data model, auth, permissions), `2026-05-26-project-page-design.md` (task drawer, status colors). All existing schema, services, and Server Actions for task lifecycle are reused — this spec consumes them.

---

## 1. Overview

The My Tasks page is the per-user landing point for daily work. It collects every task the current user owns or reviews across every project, sorts the open list by objective urgency, surfaces an at-a-glance banner with counts, and pushes a daily Lark DM so users get a nudge even when they aren't in the app.

The page is desktop-first (same as the rest of BuildFlow). All ranking is computed at page-render time from DB fields — no cron, no LLM, no client-side ranking.

### Non-goals

- LLM-based prioritization or natural-language reasoning ("here's why this matters today")
- Live updates / WebSocket push when tasks change
- Mobile-specific layouts
- A different status enum from the foundation's (`not_started`/`started`/`pending_review`/`approved`/`complete`/`wont_do`)
- A dedicated "My Reviews History" tab (out — Completed tab is owner-side only)
- Full notification center UI for in-app notifications (the banner is enough for v1)

---

## 2. Schema additions

### `tasks.priority`

A 3-level enum, default `normal`. Source-of-truth for "manual high priority" in the ranking formula.

```sql
ALTER TABLE tasks
  ADD COLUMN priority text NOT NULL DEFAULT 'normal',
  ADD CONSTRAINT tasks_priority_check CHECK (priority IN ('low','normal','high'));
```

Drizzle schema (in `db/schema/tasks.ts`):

```ts
priority: text('priority', { enum: ['low', 'normal', 'high'] }).notNull().default('normal'),
```

The CHECK constraint must be added via a hand-written migration (the foundation already established this pattern — see `0005_add_check_constraints.sql`).

### `users.lark_digest_opted_out`

A boolean defaulting to `false` (opted-in by default). Drives whether the daily Lark DM is sent to that user.

```sql
ALTER TABLE users ADD COLUMN lark_digest_opted_out boolean NOT NULL DEFAULT false;
```

Drizzle (in `db/schema/users.ts`):

```ts
larkDigestOptedOut: boolean('lark_digest_opted_out').notNull().default(false),
```

---

## 3. Page layout

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ My Tasks                                                                     │
│                                                                              │
│ 🔴 3 overdue · 🟠 2 blocked · 🟢 5 ready          <- in-app banner           │
│                                                                              │
│ [ Open Tasks (10) ] [ Pending Review (4) ] [ Completed ]                     │
│ ──────────────                                                               │
│                                                                              │
│ (Sorted task rows for active tab)                                            │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

- Banner appears only if any of overdue/blocked/ready > 0.
- Tab counts in parentheses reflect actual tab content.
- "Completed" tab has no count (history is unbounded).
- All three tabs share the same task-row component.
- Sidebar's existing "My Tasks" link points here (no rename needed).

### URL state

`/my-tasks?tab=<open|pending_review|completed>`. Default tab = `open`.

---

## 4. Tab definitions

### 4.1 Open Tasks (default)

**Filter:** tasks where `tasks.owner_id = current_user.id` AND `tasks.status NOT IN ('complete', 'wont_do')` AND the parent project is `in_progress` or `draft` (excludes tasks in archived/complete projects so the list stays current-work-focused).

**Sort:** see §5.

**Row content:**
- Status icon + label (🟢 on track / 🟠 at risk / 🔴 delay Nd) — same rules as project page
- Task name + chips: 🌶️ `HIGH` if `priority='high'`, 📍 `unplanned` if `is_unplanned=true`
- Project + phase as a small muted chip (`9 Greenwood Pl · Permitting`)
- Due date as relative text (`due in 3d` / `overdue 2d` / `due today` / `no due date`)
- Click row → navigates to `/projects/{projectId}?tab={phaseSlug}&task={taskId}` (deep-link into project page's task drawer)

### 4.2 Pending Review

**Filter:** tasks where `tasks.reviewer_id = current_user.id` AND `tasks.status = 'pending_review'` AND parent project is `in_progress`.

**Row content:** same as Open Tasks, plus an owner avatar + name shown to the left of the task name (so the reviewer sees who submitted).

**Sort:** ascending by `tasks.updated_at` (oldest pending submissions first — they've been waiting longest).

### 4.3 Completed

**Filter:** tasks where `tasks.owner_id = current_user.id` AND `tasks.status IN ('complete', 'wont_do')` AND `tasks.updated_at >= now() - 90 days`.

**Sort:** descending by `tasks.updated_at` (most recent first).

**Row content:** same as Open Tasks, but the status icon is replaced by ✓ (complete) or ✗ (wont_do). No "due in" text — instead a "completed N days ago" timestamp.

**Pagination:** the first 100 rows are rendered. "Show older" link at the bottom paginates 100 at a time via a URL param (`&offset=`).

---

## 5. Ranking algorithm

Pure function in `lib/my-tasks/ranking.ts`:

```ts
export function rankMyOpenTasks(
  tasks: TaskRanked[],
  todayDayOffset: number,
): TaskRanked[]
```

Where `TaskRanked` carries the fields needed to compute the sort key (id, isBlocked, plannedEndDay, isOnCriticalPath, priority, status, isUnplanned).

### Sort key tuple

For each task, compute `(blockedRank, urgency, criticalRank, priorityRank)`:

1. **blockedRank**: `0` if `is_blocked = false`, else `1`. Lower first.
2. **urgency**: `planned_end_day - todayDayOffset` (negative = overdue, lower = more urgent). Null `planned_end_day` → treated as `+Infinity` (least urgent).
3. **criticalRank**: `0` if `is_on_critical_path = true`, else `1`. Lower first.
4. **priorityRank**: `'high' → 0`, `'normal' → 1`, `'low' → 2`. Lower first.

Sort ascending by the tuple — task with the smallest tuple lexicographically is first in the list.

### Worked example

Five tasks, `todayDayOffset = 47`:

| Task | blocked | planned_end | critical | priority | tuple | rank |
|---|---|---|---|---|---|---|
| A | no | 45 (overdue 2) | yes | normal | (0, -2, 0, 1) | 1 |
| B | no | 50 (due 3) | yes | high | (0, 3, 0, 0) | 2 |
| C | no | 50 (due 3) | no | high | (0, 3, 1, 0) | 3 |
| D | no | null | no | high | (0, ∞, 1, 0) | 4 |
| E | yes | 40 (overdue 7) | yes | high | (1, -7, 0, 0) | 5 |

Note E is last despite being most overdue + critical + high priority — because it's blocked (you literally can't progress on it until deps clear). The banner still flags it.

### Tests

Exhaustively unit-tested in `lib/my-tasks/ranking.test.ts`:
- Empty input → empty output
- All-equal → stable sort by id
- Each sort key dominates the lower keys (one test per key transition)
- Worked example above

---

## 6. In-app banner

A pure-function counter in `lib/my-tasks/banner-counts.ts`:

```ts
export function computeBannerCounts(
  openTasks: Array<{ status: TaskStatus; isBlocked: boolean; plannedEndDay: number | null }>,
  todayDayOffset: number,
): { overdue: number; blocked: number; ready: number }
```

Definitions:
- **overdue** = `plannedEndDay !== null && todayDayOffset > plannedEndDay` (and status is non-terminal — already guaranteed by Open Tasks filter)
- **blocked** = `isBlocked === true`
- **ready** = `!blocked && !overdue`

Note: a task that is both blocked AND past its planned_end_day counts in the **blocked** bucket, not overdue. Blocked tells the user "you literally can't act on this" which is more actionable than the overdue flag.

### Render rules

- If `overdue + blocked + ready === 0`: render nothing (no empty banner).
- Otherwise render: `🔴 N overdue · 🟠 N blocked · 🟢 N ready` (omit zero buckets).

---

## 7. Lark daily digest

A scheduled Route Handler that iterates all eligible users and sends each a Lark DM summarizing their queue.

### Endpoint

`app/api/cron/lark-digest/route.ts` — `POST` handler.

Authentication: requires header `Authorization: Bearer <LARK_DIGEST_CRON_SECRET>` matching the env var. Without it, returns 401. (The endpoint is publicly reachable but only the secret-holder can trigger it.)

### Per-user processing

For each `users` row where `is_active = true` AND `lark_digest_opted_out = false`:

1. Compute counts:
   - `overdueCount` = my open tasks with `today > planned_end_day`
   - `dueThisWeekCount` = my open tasks with `0 <= planned_end_day - today <= 7`
   - `pendingMyReviewCount` = tasks where I'm reviewer AND status=pending_review
2. Skip if all three counts are 0.
3. Compose message body:
   ```
   📋 BuildFlow daily digest
   Overdue: 3
   Due this week: 5
   Pending your review: 2
   👉 https://buildflow.example.com/my-tasks
   ```
4. Send Lark DM (see §8).

### Scheduling

Deferred to deployment. The endpoint exists; the impl plan documents three options (Vercel Cron, GitHub Actions, self-hosted cron) but doesn't wire any of them up. Operator picks one when they deploy.

### Failure modes

- If Lark API fails for a user, log the error and continue with the next user. Never fail the whole batch.
- Response: 200 OK with JSON body `{ "processed": N, "sent": N, "skipped": N, "errors": [...] }` for observability.

---

## 8. Lark messaging API helper

New module `lib/lark/messaging.ts`:

```ts
export async function sendLarkDirectMessage(input: {
  openId: string
  text: string
  link?: string
  fetcher?: typeof fetch
}): Promise<void>
```

Implementation flow:

1. Obtain a tenant access token by POSTing `https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal` with `LARK_MESSAGING_APP_ID` + `LARK_MESSAGING_APP_SECRET`. Token cached in-process for ~1.5 hours (Lark tokens live 2 hours).
2. POST to `https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=open_id` with `receive_id = openId`, `msg_type = 'text'`, `content = JSON.stringify({ text: input.text + (input.link ? `\n${input.link}` : '') })`.
3. Throw on non-OK response.

### New env vars

```
LARK_MESSAGING_APP_ID=
LARK_MESSAGING_APP_SECRET=
LARK_DIGEST_CRON_SECRET=  # random hex; used to gate POST /api/cron/lark-digest
```

`.env.example` must be updated to include these. The messaging app **may** be the same Lark app as OAuth login if the operator wishes (both creds would then be identical), but for v1 the spec treats them as separate so messaging permissions are explicit. This is flagged in the implementation plan as an operational note.

### Token cache scope

The tenant access token is cached in a module-level variable. With the foundation's `serverActions` and single-process Next.js deployment, that's fine. If you scale horizontally later, each process maintains its own cache — Lark accepts that.

---

## 9. Server Actions

### 9.1 `setTaskPriority`

Sets a single task's priority. Used from the task drawer's new priority control.

```ts
// app/actions/tasks.ts
export async function setTaskPriority(raw: unknown): Promise<{ ok: true }>
```

Input zod schema:
```ts
z.object({ taskId: z.string().uuid(), priority: z.enum(['low','normal','high']) })
```

Permission: a new `Action` variant `'task.set_priority'` added to `lib/permissions.ts`:
- Allowed for: task owner (`isTaskOwner`), managing PM, system owner role.
- Same permission shape as `task.update_notes`.
- Enforced via `requirePermission`.

Revalidates `/projects/[id]` and `/my-tasks`.

### 9.2 `setLarkDigestOptOut`

```ts
// app/actions/users.ts
export async function setLarkDigestOptOut(raw: unknown): Promise<{ ok: true }>
```

Input: `z.object({ optedOut: z.boolean() })` (no `userId` parameter — always operates on the current user).

Permission: any authenticated user can flip their own toggle. No `requirePermission` call needed beyond the implicit auth check; just fetch the current user and update their row.

Revalidates `/settings/me`.

### 9.3 No new "send digest" Server Action

The digest is triggered by the cron Route Handler in §7, not by a Server Action. Keeping Server Actions UI-driven and the Route Handler ops-driven is consistent with the foundation's API surface.

---

## 10. New permission

`lib/permissions.ts` gains:

```ts
| { type: 'task.set_priority'; project: ProjectContext; task: TaskContext }
```

In `can()`:

```ts
case 'task.set_priority':
  return projectMutable(action.project) && (managesProject(action.project) || taskOwner(action.task))
```

Same logic as `task.update_notes`.

---

## 11. New routes

| Path | Purpose |
|---|---|
| `/my-tasks` | Server component. Reads `?tab=`. Renders banner + tab strip + active tab's task list. |
| `/settings/me` | Server component. Owner avatar + name + Lark digest opt-out toggle. Available to any authenticated user. |
| `/api/cron/lark-digest` | POST handler, secret-gated. |

The sidebar already has a "My Tasks" link. A "Settings" link to `/settings/me` should be added to the sidebar, visible to all roles (separate from the existing owner-only "Settings → Members/Audit" sub-section which stays as-is).

---

## 12. Component organization

```
app/(app)/my-tasks/
  page.tsx                          RSC — fetches data, renders banner + tabs
  loading.tsx                       Skeleton
  my-tasks-tabs.tsx                 Client — URL-sync tab strip (counts in tab labels)

app/(app)/settings/me/
  page.tsx                          RSC — renders form
  digest-opt-out-form.tsx           Client — toggle

app/api/cron/lark-digest/
  route.ts                          POST handler

components/my-tasks/
  banner.tsx                        Server — pure display
  task-row.tsx                      Server — cross-project row template
  empty-state.tsx                   "No open tasks. Nice work."

components/project/
  drawer-priority-control.tsx       Client — added to the existing task-drawer.tsx
                                    (drawer is modified, not replaced)

lib/my-tasks/
  ranking.ts                        Pure: sort tasks by tuple
  ranking.test.ts
  banner-counts.ts                  Pure: bucket counts
  banner-counts.test.ts
  digest-payload.ts                 Pure: count rules for the cron digest
  digest-payload.test.ts

lib/lark/
  messaging.ts                      Lark API helper
  messaging.test.ts                 (mocked fetcher; token cache; error paths)

db/queries/
  my-tasks.ts                       getMyTasks + getMyTasksDigest helpers
  my-tasks.test.ts
```

The existing `components/project/task-drawer.tsx` gets a new child component `drawer-priority-control.tsx` inserted above the status stepper. This is the only modification to project page code in this spec.

---

## 13. Data fetching

### My Tasks page

Single server function:

```ts
// db/queries/my-tasks.ts
export async function getMyTasks(
  db: DB,
  userId: string,
  opts?: { completedOffset?: number; completedLimit?: number },
): Promise<{
  openTasks: TaskWithContext[]      // sorted by ranking
  pendingReview: TaskWithContext[]  // sorted by updated_at asc
  completedTasks: TaskWithContext[] // sorted by updated_at desc (newest first), windowed
  completedTotal: number            // for "Show older" pagination
  todayDayOffset: number            // computed using earliest project kick-off if any
}>
```

`TaskWithContext` = the task row PLUS pre-joined `project.name`, `project.kickedOffAt`, `phase.name`. This is the same shape used by the row component.

The function does at most three SELECTs + a count: open tasks (joined with project + phase), pending review (joined), completed (joined + paginated), and `select count(*)` for the completed total.

### Lark digest endpoint

```ts
// db/queries/my-tasks.ts
export async function getDigestSummariesForActiveOptedInUsers(db: DB): Promise<Array<{
  userId: string
  larkOpenId: string
  overdueCount: number
  dueThisWeekCount: number
  pendingMyReviewCount: number
}>>
```

Returns one row per eligible user, all counts pre-computed via SQL aggregates in a single query (joining `users`, `tasks`, and `projects`). The Route Handler iterates the result rows and sends Lark DMs.

---

## 14. Permission gating (UI)

Most of the page is read-only and uses `requireUser()` from the foundation. The two interactive elements:

- **Drawer priority control**: uses `usePermissions().can({ type: 'task.set_priority', project, task })`. Hidden if false.
- **Digest opt-out toggle**: visible to every user (operates only on their own row); no `can()` check.

---

## 15. Testing strategy

### Unit (Vitest)

- `lib/my-tasks/ranking.ts`: every sort-key transition, empty input, stable order
- `lib/my-tasks/banner-counts.ts`: every bucket edge case
- `lib/my-tasks/digest-payload.ts`: digest counts, skip-when-zero rule
- `lib/lark/messaging.ts`: success path with mocked fetcher, token-cache hit/miss, retry-on-401 (token expired)

### Integration (Vitest + real Postgres)

- `db/queries/my-tasks.ts`: `getMyTasks` returns correct buckets and ordering; pagination boundary cases; tasks in archived projects excluded from Open
- `db/queries/my-tasks.ts`: `getDigestSummariesForActiveOptedInUsers` excludes opted-out users; excludes inactive users
- `app/actions/tasks.ts` `setTaskPriority`: happy path, forbidden path (unrelated IC), locked-project path
- `app/actions/users.ts` `setLarkDigestOptOut`: happy path
- `app/api/cron/lark-digest/route.ts`: unauthorized returns 401; authorized iterates users and produces a 200 with summary; failure on one user doesn't break the batch

### Component (RTL, selective)

- `components/my-tasks/task-row.tsx`: renders correctly for Open / Pending / Completed variants
- `components/project/drawer-priority-control.tsx`: hidden when no permission, dropdown changes priority via Server Action

### No E2E in v1

---

## 16. Out of scope

- LLM-based ranking or natural-language reasoning
- Live WebSocket / push updates within the app
- "All Projects" filter on My Tasks (it's intentionally always cross-project)
- Showing tasks where the user is neither owner nor reviewer (i.e. tasks they're following or just commented on)
- A "Reviewed" tab showing review history (only Pending Review and own Completed history are in v1)
- Mobile-specific layouts and digest delivery (email / SMS — Lark only)
- Operator-side scheduler config (Vercel Cron config, etc.) — implementation plan documents the three options but ships the endpoint only

---

## 17. Open implementation questions

1. **Settings sidebar link** — Should `/settings/me` get its own top-level sidebar entry, or live as a sub-item under a "Settings" group? V1 default: new top-level entry **Settings**, visible to everyone, with the existing Members / Audit / Workflows links demoted to sub-items shown when on a `/settings/*` page. Confirm at implementation time; safe to keep simple if you prefer.
2. **Lark digest message format** — V1 uses plain text. Lark also supports rich "interactive cards" (clickable buttons that deep-link). Defer cards to a follow-up polish iteration.
3. **Tenant access token cache key** — V1 caches one token per process. If you ever split messaging credentials per-tenant (multi-tenant SaaS, not the current single-instance model), the cache key would need tenant scoping. Out of scope today.
