# Full-Page Task Detail — Design

**Date**: 2026-05-28
**Status**: Draft
**Scope**: Add a deep-linkable, full-page task detail screen at `/tasks/[taskId]`, reachable from My Tasks and (via a new "Open in full page" link) from the existing project drawer. The layout and information architecture follow the attached HTML mockup; the visual treatment (colors, fonts, icons, panels) follows the dashboard's existing theme — NOT the mockup's raw CSS. Reuses existing Server Actions wherever possible; introduces one new action (`updateTaskMetadata`) and a single denormalized read query. Attachments UI is stubbed (real implementation deferred to a separate spec).
**Depends on**: `2026-05-22-foundation-design.md` (task schema, status enum, permissions), `2026-05-26-project-page-design.md` (drawer pattern, status stepper, comments, subtasks).

---

## 1. Overview

Today, task detail lives in a project-page drawer opened by `?task=<id>`. It works for in-context quick edits but is invisible from the My Tasks list, can't be deep-linked, and provides no top-of-page presence for high-cost operations like Delete or Won't do.

This design adds a full-page task detail at `/tasks/[taskId]`. It mirrors the drawer's information set but lays it out in four labeled sections (Summary, Details, Comments, Attachments) plus a top action bar (Edit / Delete / Won't do) and a page-level navigation strip (Back / Previous / Next). The page is the canonical task view; the drawer stays as a quick in-context view on the project page with a new "Open in full page" link.

The page is project-agnostic in URL form. Permission gating happens action-by-action via the existing `requirePermission` infrastructure — there is no role-based redirect at the page level.

### Non-goals

- Real attachments (upload, storage, download). The Attachments section is rendered as a placeholder. Attachments get their own brainstorm + spec + plan.
- Editing parent task or upstream dependencies. Both are read-only links here, matching the drawer's current behavior.
- Replacing the project-page drawer. The drawer stays; this page coexists.
- Per-tab Prev/Next from My Tasks. Prev/Next walks the task's own project in sortOrder, ignoring how the user arrived.
- Optimistic UI. Each mutation triggers a server-side revalidation, same pattern as the drawer.

---

## 2. Day numbering and conventions

This page surfaces calendar dates (`targetStartDate`, `targetEndDate`, `actualStartDate`, `actualEndDate`) from the `tasks` table. Those are already materialized at project kickoff and updated when status transitions, per the foundation spec. This design does not change any date semantics.

---

## 3. Route and file layout

### 3.1 Routes

| Route | Purpose | Access |
|---|---|---|
| `/tasks/[taskId]` | Full-page task detail | Any signed-in user (read-only fallthrough; mutations gated per-action) |

The existing project-page drawer route `/projects/[id]?task=<id>` is unchanged. The drawer renders a new "↗ Open in full page" link to `/tasks/[taskId]`.

### 3.2 Files

```
app/(app)/tasks/[taskId]/
  page.tsx          ← RSC: loads detail via getTaskDetail, renders TaskDetailScreen
  loading.tsx       ← skeleton
  error.tsx         ← error boundary (matches app/(app)/error.tsx pattern)

components/tasks/
  task-detail-screen.tsx     ← top-level layout wrapper (client)
  summary-section.tsx        ← section 1
  details-section.tsx        ← section 2 (status flow + info grid + subtasks + description)
  status-flow.tsx            ← 2- or 3-stage widget (replaces nothing; drawer stepper stays)
  comments-section.tsx       ← section 3 (may reuse drawer-comments.tsx if signature matches)
  attachments-section.tsx    ← section 4, stubbed placeholder
  top-actions.tsx            ← Edit / Delete / Won't do
  page-nav.tsx               ← Back link + Prev/Next

components/project/
  task-drawer.tsx            ← MODIFIED: add "Open in full page" link

db/queries/
  task-detail.ts             ← new single denormalized query
  task-detail.test.ts        ← integration test against real test Postgres

app/actions/
  tasks.ts                   ← MODIFIED: add updateTaskMetadata
  tasks.update-metadata.test.ts  ← new integration test

lib/services/
  task-service.ts            ← MODIFIED: add updateMetadata method

lib/tasks/
  status-flow.ts             ← pure helpers shared with drawer stepper
  status-flow.test.ts        ← unit tests
```

---

## 4. Data loading

### 4.1 `getTaskDetail(taskId, db)` — `db/queries/task-detail.ts`

Single function called once from the RSC. Returns a denormalized object:

```ts
type TaskDetail = {
  task: TaskRow                        // tasks.*
  project: { id, name, brand, status, pmId, kickedOffAt }
  workflow: { id, name, phase }        // project_workflows row
  owner: { id, name, larkOpenId, avatarUrl }
  reviewer: { id, name, larkOpenId, avatarUrl } | null
  parent: { id, name } | null          // for "Parent task" link
  upstreamDeps: Array<{ id, name }>    // FS predecessors, name-resolved
  subtasks: Array<{
    id, name, ownerId, ownerName, status: TaskStatus
  }>
  comments: Array<{
    id, body, authorId, authorName, createdAt
  }>                                   // chronological asc
  activity: Array<{
    id, kind, payload, actorId, actorName, createdAt
  }>                                   // last 20, desc
  prevTaskId: string | null            // sibling in same project sortOrder
  nextTaskId: string | null
}
```

Implementation:
- Run the underlying queries via `Promise.all` for the independent ones (project, workflow, owner, reviewer, parent, upstreamDeps, subtasks, comments, activity).
- Prev/Next: one query that selects `id, sortOrder` of all top-level tasks (`parentTaskId IS NULL`) in the same `projectId`, ordered by `sortOrder ASC, createdAt ASC`. Find the current task's index; pick neighbours. If the current task is itself a subtask, Prev/Next are null.
- Activity feed: reuse the existing query that powers the project page's activity tab, but filtered to events whose `payload.taskId == taskId`. Cap at 20.
- Return `null` from `getTaskDetail` if the task row doesn't exist; the RSC then calls `notFound()`.

### 4.2 Page (`app/(app)/tasks/[taskId]/page.tsx`)

```ts
export default async function TaskDetailPage(
  { params }: { params: { taskId: string } }
) {
  const me = await requireUser()
  const detail = await getTaskDetail(params.taskId, db)
  if (!detail) notFound()
  return <TaskDetailScreen me={me} {...detail} />
}
```

No role-based redirect — all three roles can read any task per the permissions matrix.

### 4.3 Activity streaming (deferred)

Initial implementation fetches activity inline (blocking render). If the page feels slow in QA, wrap the activity feed in a `<Suspense>` boundary and stream it. Not done in v1.

---

## 5. Page layout (mockup → component map)

The HTML mockup is checked in at **`docs/superpowers/specs/2026-05-28-task-detail-mockup.html`** alongside this spec. Open it in a browser for the visual reference.

The mockup is the **layout & information architecture reference** — section ordering, grid splits, field placement, mobile breakpoints. The mockup's inline CSS variables (e.g., `--teal: #007c78`, color tokens, fonts, emoji icons) are NOT used directly. Instead, the implementation uses the project's existing Tailwind theme and component conventions — see §5.6 for the explicit token mapping.

The mockup maps to these components:

| Mockup region | Component | Notes |
|---|---|---|
| Sidebar | existing `components/layout/sidebar.tsx` | unchanged |
| Top bar (search + bell + user) | existing `components/layout/top-app-bar.tsx` | unchanged |
| "← Back to My Tasks" + "‹ Previous \| Next ›" | `page-nav.tsx` | see §5.1 |
| Task title + health line + Edit/Delete/Won't do | `top-actions.tsx` (title + health rendered alongside) | see §6 |
| Section "1. Summary" | `summary-section.tsx` | see §5.2 |
| Section "2. Details" | `details-section.tsx` | wraps `status-flow.tsx`, info grid, subtasks, description |
| Section "3. Comments / Notes" | `comments-section.tsx` | reuses drawer comments if signatures align |
| Section "4. Attachments" | `attachments-section.tsx` | stubbed placeholder |

### 5.1 `page-nav.tsx`

- **Back link** label: "← Back to My Tasks" when `document.referrer` starts with `/my-tasks` (read on the client at mount; SSR renders the generic label "← Back"). Falls back to a `<Link>` to `/projects/[project.id]` if referrer is empty or doesn't match. Implementation note: we cannot read referrer in the RSC, so the back-link's `href` is `/my-tasks` by default, and a client-side effect rewrites it to `/projects/[project.id]` if referrer doesn't match.
- **Previous / Next**: render as `<Link>` with `href={`/tasks/${prevTaskId}`}` etc. When the corresponding id is null, render as a `<span aria-disabled>` styled the same but unclickable.

### 5.2 Summary section

Six fields rendered in a 6-column grid (responsive: stacks on narrow):

| Field | Source | Editable inline? | Action |
|---|---|---|---|
| Project | `project.name` + link to `/projects/${project.id}` | no | navigate |
| Owner | `owner.name` + avatar | yes (PM/owner) | `reassignTask` via inline avatar picker |
| Reviewer | `reviewer.name` or "—" + avatar | yes (PM/owner) | `updateTaskMetadata({ reviewerId })` via inline avatar picker |
| Due date | `task.targetEndDate` | yes (PM/owner) | `updateTaskMetadata({ targetEndDate })` via date picker |
| Priority | `task.priority` | yes (owner / reviewer / PM) | `setTaskPriority` |
| Status | `task.status` | yes (owner) | `setTaskStatus` |

Owner and Reviewer inline editors reuse the same avatar-picker control. Both load the candidate user list lazily on open (existing pattern).

### 5.3 Details section

Two-column layout:

**Left column:**
- **Status flow widget** (`status-flow.tsx`) — see §7.
- **Info grid** (2x2): Target start date, Target end date, Parent task link, Depends on (read-only).

**Right column:**
- **Description** — `task.description` rendered as plain text. Click to enter edit mode (textarea + Save/Cancel). Save calls `updateTaskNotes`.
- **Subtasks** — list with checkbox, name, assignee mini-avatar, status pill. Checkbox toggles `setTaskStatus` between `not_started` and `complete`. "+ Add subtask" button opens an inline form → `addSubtask`.

### 5.4 Comments section

- List existing comments chronologically with author avatar + name + relative time.
- Input box at the bottom + "Post" button → `addTaskComment` (existing action in `app/actions/task-comments.ts`).
- Reuse `components/project/drawer-comments.tsx` if its props signature accepts the same input (`taskId`, `comments`, `me`). If not, the new `comments-section.tsx` is a thin wrapper.

### 5.5 Attachments section (stub)

The mockup shows an upload box and a file list with two example files. For v1:
- Render the dashed upload box with copy "Attachments coming soon" and a disabled state.
- Do NOT render the file list (no schema yet).
- File the real design under `docs/superpowers/specs/YYYY-MM-DD-task-attachments-design.md` separately.

### 5.6 Theme & visual mapping

The mockup uses standalone HTML colors, fonts, and emoji icons. The implementation uses the project's existing theme (`tailwind.config.ts` + `app/globals.css`). Concrete substitutions:

**Colors** — replace mockup CSS vars with these Tailwind tokens:

| Mockup token | Mockup hex | Use Tailwind / project token instead |
|---|---|---|
| `--bg` | `#f7f9fb` | `bg-background` (`#f8fafc`) |
| `--panel` | `#ffffff` | `bg-surface` / `bg-white` — or `glacier-panel` class for the four section cards |
| `--line` | `#e5eaf0` | `border-outline-variant` (`#d1d9da`) |
| `--text` | `#101828` | `text-on-background` (`#1a1c1e`) |
| `--muted` | `#667085` | `text-body-muted` (`#71717a`) or `text-on-surface-variant` |
| `--teal` | `#007c78` | `text-primary` / `bg-primary` (`#006970`) |
| `--teal-soft` | `#e7f5f3` | `bg-primary/10` |
| `--blue` | `#2563eb` | `text-tertiary` (`#5e5ce6`) — used for inline links + comment Post button |
| `--blue-soft` | `#dbeafe` | `bg-tertiary-fixed` (`#e1e0ff`) |
| `--green` (health dot on-track) | `#16a34a` | `bg-secondary` (`#00a572`) |
| `--red` (critical-path, danger) | `#ef4444` | `bg-error` / `text-error` (`#ba1a1a`) |
| `--orange` | `#f97316` | (unused in v1; if needed, `bg-amber-500`) |
| `--gray-soft` | `#f1f5f9` | `bg-surface-container-low` |
| `--shadow` | custom | use existing `glacier-panel` shadow OR Tailwind `shadow-sm` |
| `--radius: 16px` | — | use Tailwind `rounded-xl` (16px) for section cards; `rounded-lg` (12px) for inner controls |

**Fonts** — Inter is already loaded globally. Apply the project's typography classes:

| Mockup style | Use project token |
|---|---|
| Brand title 32px / 850 | `font-headline-lg` (32px / 700 / -0.02em tracking) |
| Section header 18px / 850 | `font-headline-md` (20px / 600) |
| Page title (task name) 36px | `font-headline-lg` for desktop, `font-headline-lg-mobile` (24px) for narrow |
| Body text 14px | `font-body-sm` (14px / 400) |
| Body 16px | `font-body-md` (16px / 400) |
| `.label` 12px uppercase | `font-label-caps` (12px / 600 / JetBrains Mono / uppercase / 0.1em tracking) |
| Number / data values | `font-data-display` (28px / JetBrains Mono / 500) — apply to anything showing dates, counts, durations |

The mockup's `font-weight: 850` does not exist in the project font set (Inter loads 400/500/600/700). Cap at 700.

**Icons** — replace ALL emoji glyphs in the mockup (`▦ ▣ ▧ ✓ 👥 ▥ ♙ ↺ ⚙ ⌕ 🔔 ← → ▶ ○ ↗ ↑ ↓ ⋯ ✎ 🗑 ⊘ 📅 🔗 ＋`) with **Material Symbols Outlined** spans, which the app already loads via `app/globals.css` (the `.material-symbols-outlined` class is defined there). Concrete substitutions:

| Mockup emoji | Material Symbols Outlined name |
|---|---|
| ▦ Dashboard | `dashboard` |
| ▣ Projects / project link | `folder_open` |
| ▧ Workflow Templates | `account_tree` |
| ✓ My Tasks | `task_alt` |
| 👥 Team | `groups` |
| ▥ Performance Review | `analytics` |
| ♙ Members | `manage_accounts` |
| ↺ Audit Logs | `history` |
| ⚙ Settings | `settings` |
| ⌕ Search | `search` |
| 🔔 Bell | `notifications` |
| ← Back | `arrow_back` |
| ‹ Previous | `chevron_left` |
| Next › | `chevron_right` |
| ▶ Start | `play_arrow` |
| ○ Submit to review | `radio_button_unchecked` |
| ✓ Complete | `check_circle` |
| ✎ Edit | `edit` |
| 🗑 Delete | `delete` |
| ⊘ Won't do | `block` |
| 📅 Date | `calendar_today` |
| 🔗 Parent task | `link` |
| ＋ Add subtask | `add` |
| ↓ Download | `download` |
| ⬆ Upload | `upload` |
| ⋯ More menu | `more_horiz` |

**Panel treatment** — the four section cards (Summary / Details / Comments / Attachments) use the `glacier-panel` class (translucent white + backdrop blur + soft shadow) instead of the mockup's flat `background: white; border: 1px solid var(--line); box-shadow: var(--shadow)`. This matches the dashboard's existing visual language. Inner controls (inputs, selects, buttons) use solid `bg-white` with `border-outline-variant` borders.

**Brand chip / sidebar** — the existing `components/layout/sidebar.tsx` and `top-app-bar.tsx` are unchanged. The mockup's sidebar styling is the dashboard's actual styling — re-use the existing components verbatim, do not re-implement.

**Spacing** — use the project's spacing tokens where available (`spacing.md = 16px`, `spacing.gutter = 24px`, `spacing.lg = 24px`, `spacing.xl = 40px`). The mockup's 20px/22px/28px values map to the nearest token (`5`/`6`/`7` in default Tailwind scale, or the named tokens above).

**Mobile breakpoint** — the mockup's `@media (max-width: 1100px)` collapses the sidebar and stacks grids. Re-implement using Tailwind responsive prefixes (`lg:grid-cols-6`, etc.). Use the project's existing breakpoint values (Tailwind defaults: `sm: 640px`, `md: 768px`, `lg: 1024px`, `xl: 1280px`).

---

## 6. Top action bar — Edit / Delete / Won't do

Rendered to the right of the task title.

### 6.1 Edit

- Opens a modal dialog reusing the existing `components/project/edit-metadata-dialog.tsx`.
- Dialog form fields: `name`, `targetStartDate`, `targetEndDate`, `reviewerId`.
- Submit calls `updateTaskMetadata` (new action; see §8.1).
- Visible when actor has `task.update_structure` permission (PM, owner).

### 6.2 Delete

- Click → `window.confirm('Delete this task? This cannot be undone.')` → on confirm, call `deleteTaskInDraft` (existing). On success, `router.push('/projects/[project.id]')`.
- Visible only when:
  - Actor has `task.update_structure` permission (PM of project, or any owner), AND
  - The project is in `draft` status (the existing `deleteTaskInDraft` action enforces this server-side; we mirror the gate on the client for UX).
- Outside draft, the button is hidden (not disabled).

### 6.3 Won't do

- Click → `window.confirm("Mark this task as won't do?")` → on confirm, call `setTaskStatus({ status: 'wont_do' })`.
- Visible when:
  - Actor has `task.set_status` permission (task owner; PM/owner for the project), AND
  - Current status is not `wont_do` and not `complete`.

### 6.4 Title

- Task title (`task.name`) rendered as an h1, inline-editable on click for actors with `task.update_structure`. Save → `updateTaskMetadata({ name })`.

### 6.5 Health line

Two health chips below the title:
- **On track / At risk / Overdue**: derived client-side from `task.targetEndDate` vs today and current `status` (use the same helper that powers the My Tasks banner, if it exists; otherwise inline the rule: overdue if `targetEndDate < today AND status NOT IN ('complete', 'wont_do')`, on-track otherwise).
- **On critical path**: rendered only when `task.isOnCriticalPath` is true.

Wont-do tasks show a single muted "Won't do" pill instead of the health chips.

---

## 7. Status flow widget

### 7.1 Visible stages

`computeVisibleStages(hasReviewer: boolean): FlowStage[]`:

```ts
type FlowStage = 'start' | 'submit_review' | 'complete'
// with reviewer:    ['start', 'submit_review', 'complete']
// without reviewer: ['start', 'complete']
```

### 7.2 Active stage

`activeStage(status, hasReviewer): FlowStage | 'wont_do' | null`:

| `status` | with reviewer | without reviewer |
|---|---|---|
| `not_started` | `'start'` | `'start'` |
| `started` | `'submit_review'` | `'complete'` |
| `pending_review` | `'submit_review'` (in-flight) | n/a — unreachable, returns `null` |
| `approved` | `'complete'` (auto-advanced) | n/a — unreachable, returns `null` |
| `complete` | `'complete'` (done) | `'complete'` (done) |
| `wont_do` | `'wont_do'` | `'wont_do'` |

### 7.3 Buttons rendered at each active stage

**Owner perspective:**

| Active stage | Status | Button(s) | Action |
|---|---|---|---|
| `'start'` | `not_started` | `Start` | `setTaskStatus('started')` |
| `'submit_review'` | `started` | `Submit to review` | `submitTaskForReview` |
| `'submit_review'` | `pending_review` | `Awaiting review` (disabled) | — |
| `'submit_review'` | `approved` | (none — stage ③ active) | — |
| `'complete'` (with reviewer) | `approved` | `Complete` | `setTaskStatus('complete')` |
| `'complete'` (with reviewer) | `complete` | (no button — done) | — |
| `'complete'` (without reviewer) | `started` | `Complete` | `setTaskStatus('complete')` |
| `'complete'` (without reviewer) | `complete` | (no button — done) | — |
| `'wont_do'` | `wont_do` | (widget hidden, replaced by "Won't do" pill) | — |

**Reviewer perspective (when `viewerIsReviewer` and `status === 'pending_review'`):**

Stage `'submit_review'` renders two side-by-side buttons instead of the disabled "Awaiting review":
- `Approve` → `approveTask`
- `Request revision` → opens a textarea modal → `requestTaskRevision` (body required).

### 7.4 Visual

- Stages BEFORE active: filled green circle with checkmark.
- Active stage: blue ring around the circle.
- Stages AFTER active: outlined gray.
- Connecting lines: green for completed segments, gray for upcoming.

### 7.5 Pure helpers in `lib/tasks/status-flow.ts`

Both `computeVisibleStages` and `activeStage` are exported as pure functions and unit-tested. The drawer's existing `components/project/drawer-status-stepper.tsx` is refactored to consume the same helpers (its hard-coded `STAGES` array becomes `computeVisibleStages(hasReviewer).map(stage => STAGE_LABELS[stage])`).

---

## 8. Server Actions

### 8.1 New action: `updateTaskMetadata`

```ts
// app/actions/tasks.ts
export async function updateTaskMetadata(raw: unknown) {
  const input = z.object({
    taskId: z.string().uuid(),
    name: z.string().min(1).optional(),
    description: z.string().optional().nullable(),
    reviewerId: z.string().uuid().nullable().optional(),
    targetStartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    targetEndDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  }).refine(
    v => !v.targetStartDate || !v.targetEndDate || v.targetEndDate >= v.targetStartDate,
    { message: 'targetEndDate must be on or after targetStartDate' },
  ).parse(raw)

  const { task, project } = await loadTaskCtx(input.taskId)
  const user = await requirePermission({
    type: 'task.update_structure',
    project: { pmId: project.pmId, status: project.status },
  })
  await taskService.updateMetadata({ ...input, actorId: user.id }, db)
  revalidatePath(`/tasks/${input.taskId}`)
  revalidatePath(`/projects/${project.id}`)
  return { ok: true }
}
```

Service-layer method `taskService.updateMetadata` updates whichever subset of fields was provided, in a single `UPDATE`. Writes an activity row for each changed field.

Why not extend `updateTaskNotes`? Different permission scope (`update_structure` vs `update_notes`) and different audit semantics. Keep them separate.

### 8.2 Existing actions reused as-is

| Action | Used by | File |
|---|---|---|
| `setTaskStatus` | Summary status dropdown, status flow buttons, Won't do, subtask checkbox | `app/actions/tasks.ts` |
| `setTaskPriority` | Summary priority dropdown | same |
| `reassignTask` | Owner avatar picker | same |
| `updateTaskNotes` | Description inline edit | same |
| `submitTaskForReview` | Status flow Submit button | same |
| `approveTask` | Reviewer Approve button | same |
| `requestTaskRevision` | Reviewer Request-revision modal | same |
| `addSubtask` | "+ Add subtask" | same |
| `deleteTaskInDraft` | Top Delete button | same |
| `addTaskComment` | Comments Post button | `app/actions/task-comments.ts` |

All keep their existing permission checks via `requirePermission`. After mutation, each calls `revalidatePath` — we extend the list to include `/tasks/${input.taskId}` everywhere it's missing.

---

## 9. Error handling

| Scenario | Behavior |
|---|---|
| Task not found | RSC calls `notFound()` → Next.js 404 page |
| `getTaskDetail` throws | Next.js error boundary at `app/(app)/tasks/[taskId]/error.tsx` |
| Server Action throws (permission, validation, state machine) | Client catches the throw and renders a banner above the relevant section with the error message |
| Project archived | Page renders; status flow widget hidden; comment posting still allowed |
| Two PMs edit metadata concurrently | Last-write-wins; no special handling |
| User clicks Prev/Next to a since-deleted task | Target page returns 404 (handled by route's `notFound()`) |

No optimistic UI. Each action calls `revalidatePath` which triggers an RSC re-render with fresh data.

---

## 10. Permissions

Read access: any signed-in user (per existing matrix — `owner`/`pm`/`ic` all have read on everything). No role redirect at the page level.

Mutation gates handled per-action by existing `requirePermission` checks. The page shows / hides controls client-side per the same matrix for UX, but the server is the source of truth.

| Control | Server permission |
|---|---|
| Title inline edit, Edit dialog, Delete | `task.update_structure` |
| Owner avatar picker | `task.reassign` |
| Reviewer picker, dates, name (via Edit) | `task.update_structure` |
| Description edit | `task.update_notes` |
| Priority dropdown | `task.set_priority` |
| Status dropdown, status flow buttons, Won't do, subtask checkbox | `task.set_status` |
| Submit for review | `task.submit_review` |
| Approve / Request revision | `task.review_decision` |
| Add subtask | `task.add_subtask` |
| Post comment | `task.comment` |

---

## 11. Testing strategy

| Concern | Test |
|---|---|
| `computeVisibleStages` / `activeStage` purity | `lib/tasks/status-flow.test.ts` — every (status, hasReviewer) combination |
| `getTaskDetail` shape and prev/next | `db/queries/task-detail.test.ts` — seed project with tasks A, B + subtask under A; assert subtask appears in `subtasks[]`, `prevTaskId === null` for A, `nextTaskId === B.id`, subtask's own `prevTaskId/nextTaskId` are both null |
| `updateTaskMetadata` permission + payload | `app/actions/tasks.update-metadata.test.ts` — PM can update, IC cannot; rejects `endDate < startDate`; rejects empty name |
| `taskService.updateMetadata` partial updates | `lib/services/task-service.update-metadata.test.ts` — only changed fields are touched; activity rows match |
| Drawer "Open in full page" link renders | manual QA only |
| Page rendering | no automated test (matches existing project-page convention) |

---

## 12. Out of scope

- Attachments storage, upload, download, schema. See separate spec.
- Editing parent task or upstream dependencies. Read-only here.
- Replacing the project-page drawer. Drawer stays as-is plus a new link.
- Tab-aware Prev/Next from My Tasks. Always walks project sortOrder.
- Optimistic UI / live presence.

---

## 13. Rollout

Single deployable change. No migration (no schema changes). No feature flag. The drawer's "Open in full page" link starts working as soon as the new route ships.

If `updateTaskMetadata` lands without the page (e.g., page work is split into a follow-up PR), the action is callable but unused — safe.
