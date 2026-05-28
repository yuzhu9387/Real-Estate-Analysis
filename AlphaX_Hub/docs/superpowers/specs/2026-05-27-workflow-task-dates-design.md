# Workflow Task Dates + List Page Enhancements — Design

**Date**: 2026-05-27
**Status**: Draft
**Scope**: Replace the per-task `default_duration_days` field on workflow templates with explicit `default_start_day` / `default_end_day` columns; auto-compute and persist aggregate schedule fields (`total_start_day`, `total_end_day`, `total_duration_days`) on the parent template at save time; update the editor UI to type start/end days per task with a live schedule preview; add keyword search and richer cards to the `/workflows` list page.
**Depends on**: `2026-05-27-workflow-editor-design.md` (editor shell, dep picker, draft-storage, save/validate flow). `2026-05-22-foundation-design.md` (snapshot semantics, project-side `tasks` schema with `plannedStartDay` / `plannedEndDay` / `plannedDurationDays`).

---

## 1. Overview

Today, a workflow template task carries a `default_duration_days` integer; the schedule shown to the user ("day N–M") is computed at display time by walking the FS dependency DAG. This design replaces that compute-from-duration model with a "user types the start day and end day directly" model. The duration becomes derived (`end − start`), and the workflow's aggregate schedule (start, end, total duration) is computed and persisted on the `workflow_templates` row whenever a template is saved.

The project-side `tasks` table already stores `plannedStartDay` / `plannedEndDay` / `plannedDurationDays` independently. The snapshot operation, which previously ran the DAG scheduler to populate those three project fields, is simplified to a straight copy from the template task's start/end into the project task.

Three secondary changes ride on the same plan:
- Workflows list page (`/workflows`) cards show description, task count, and total duration.
- Workflows list page gains a keyword search across `name` and `description`.
- Workflow detail page (`/workflows/[id]`) and editor (`/workflows/[id]/edit`) gain a small "Workflow schedule" info block showing aggregate start/end/duration.

### Non-goals

- Calendar dates on templates — day numbers are relative offsets (day 0 = phase kick-off date at snapshot time). Calendar dates are computed only on the project side, after kick-off.
- Removing finish-to-start dependencies — they stay, and they auto-suggest task start days on dep-add (one-shot, not propagating).
- Changing the Gantt or task drawer on the project page — they already render from `plannedStartDay` / `plannedEndDay`.
- Renaming the "owner-role label" column to "department" — UI keeps current copy; schema name unchanged.
- Reworking `/projects/new`, `/my-tasks`, dashboard, team, performance, or permissions.

---

## 2. Day numbering convention

- Days are **1-indexed integers**: the first task in a workflow can start on `default_start_day = 1`.
- **Half-open interval semantics**: a task with `start = N, end = M` covers days `N, N+1, …, M-1` and has duration `M − N`. The `end` value is the "next available start day" for a successor, not the last day the task is actively worked. This is the existing scheduler's convention (`lib/critical-path/index.ts`), shifted from 0-indexed to 1-indexed for display.
- `default_end_day >= default_start_day` is enforced by a CHECK constraint. Zero-duration tasks (`start == end`, e.g. an inspection sign-off milestone) are allowed.
- The workflow's aggregate `total_start_day` is `min(task.default_start_day)`, `total_end_day` is `max(task.default_end_day)`, and `total_duration_days = total_end_day − total_start_day`. For a template with zero tasks, all three aggregates are `0`.
- Worked example: a 5-day task that begins the workflow has `start = 1, end = 6, duration = 5`. A successor immediately after has `start = 6`. A 0-day inspection milestone after that has `start = 6, end = 6`.

---

## 3. Schema changes

### 3.1 `workflow_template_tasks`

```diff
- defaultDurationDays: integer('default_duration_days').notNull(),
+ defaultStartDay: integer('default_start_day').notNull(),
+ defaultEndDay: integer('default_end_day').notNull(),
```

Plus a hand-written CHECK constraint:
```sql
ALTER TABLE workflow_template_tasks
  ADD CONSTRAINT chk_default_end_after_start CHECK (default_end_day >= default_start_day);
```

### 3.2 `workflow_templates`

Add three integer columns, all `NOT NULL DEFAULT 0`:

```diff
+ totalStartDay: integer('total_start_day').notNull().default(0),
+ totalEndDay: integer('total_end_day').notNull().default(0),
+ totalDurationDays: integer('total_duration_days').notNull().default(0),
```

These are written by the service layer on every `createWorkflowTemplate` and `updateWorkflowTemplate` call, computed from the incoming task list. Stored (not generated) so the workflows list query stays a single-table SELECT.

### 3.3 Migration (`db/migrations/00NN_workflow_task_dates.sql`)

Numbered after the highest existing migration; journal entry added per the repo convention.

1. `ALTER TABLE workflow_template_tasks ADD COLUMN default_start_day integer, ADD COLUMN default_end_day integer;`
2. **Backfill task dates.** For each existing `workflow_templates` row, run `recomputeSchedule` from `lib/critical-path/index.ts` over its tasks + deps. For each task, write `default_start_day = earliestStartDay + 1` and `default_end_day = earliestEndDay + 1` (shifting the existing scheduler's 0-indexed half-open output to 1-indexed half-open). Lag (`workflow_template_task_deps.lag_days`) is honored by the existing scheduler — no extra handling needed.
3. `ALTER COLUMN default_start_day SET NOT NULL`, same for `default_end_day`.
4. `ALTER TABLE workflow_template_tasks ADD CONSTRAINT chk_default_end_after_start CHECK (default_end_day >= default_start_day);`
5. `ALTER TABLE workflow_template_tasks DROP COLUMN default_duration_days;`
6. `ALTER TABLE workflow_templates ADD COLUMN total_start_day integer NOT NULL DEFAULT 0, ADD COLUMN total_end_day integer NOT NULL DEFAULT 0, ADD COLUMN total_duration_days integer NOT NULL DEFAULT 0;`
7. **Backfill template aggregates.** `UPDATE workflow_templates t SET total_start_day = sub.min_s, total_end_day = sub.max_e, total_duration_days = sub.max_e - sub.min_s FROM (SELECT workflow_template_id, MIN(default_start_day) AS min_s, MAX(default_end_day) AS max_e FROM workflow_template_tasks GROUP BY workflow_template_id) sub WHERE t.id = sub.workflow_template_id;`

Migration is hand-written SQL with a journal entry, per the repo's existing convention. Applied to both dev (`:5434`) and test (`:5433`) DBs.

---

## 4. Server-side changes

### 4.1 Server Action payload (`app/actions/workflows.ts`)

The `createWorkflowTemplate` and `updateWorkflowTemplate` zod schemas change:

```diff
  tasks: z.array(z.object({
    name: z.string().min(1),
    description: z.string().nullable(),
-   durationDays: z.number().int().min(0),
+   startDay: z.number().int().min(1),
+   endDay: z.number().int().min(1),
    ownerRoleLabel: z.string().nullable(),
- })),
+ })).refine(arr => arr.every(t => t.endDay >= t.startDay), {
+   message: 'endDay must be >= startDay',
+ }),
```

Other payload fields (`name`, `description`, `deps`) are unchanged.

### 4.2 Service layer (`lib/services/workflow-template-service.ts`)

`createWorkflowTemplate(input, db)` and `updateWorkflowTemplate(input, db)` both:
1. Validate `endDay >= startDay >= 1` for every task (cheap re-check after zod).
2. Run existing cycle detection on `deps`.
3. Compute aggregates: `totalStartDay = min(task.startDay)`, `totalEndDay = max(task.endDay)`, `totalDurationDays = totalEndDay - totalStartDay`. For 0 tasks, all three are `0`.
4. Persist tasks (insert/upsert) and write aggregates onto the parent row, all in a single transaction.

### 4.3 Read query (`db/queries/workflow-templates.ts` — new)

Currently the `/workflows` list page inlines its query in the RSC. Extract it into a query function:

```ts
listWorkflowTemplates({ q, includeArchived }: { q?: string; includeArchived: boolean }, db)
  → Array<{ id, name, description, isArchived, totalDurationDays, taskCount }>
```

- `q` filter: `WHERE name ILIKE %q% OR description ILIKE %q%`, both null-safe.
- `taskCount` joined via the same aggregate the page currently does.
- Sorted by `name`.

Existing inlined queries elsewhere in `/workflows/[id]` and `/workflows/[id]/edit` are left in place — only the list page extracts.

---

## 5. Editor UI changes

### 5.1 Task row (`components/workflows/task-row.tsx`)

Replace the duration input with start/end inputs plus a derived duration label:

```
┌─[drag] Task name ────── Start ── End ── Dur ── Owner role ── [deps] [×]─┐
│       [name input]       [N]      [M]   (M−N)d   [role]                 │
│       Description: …                                                    │
└─────────────────────────────────────────────────────────────────────────┘
```

- Start and End: small `<input type="number" min="1">` controls.
- Dur: read-only `<span>` showing `endDay - startDay` followed by `d`. Updates live as the inputs change.
- Owner role: existing free-text `defaultOwnerRoleLabel` input with `ROLE_SUGGESTIONS` datalist, placement and behavior unchanged.

### 5.2 Add-task default

In `editorShell.addTask()`:
- `startDay = max(existing.endDay)`, or `1` if no existing tasks. (In half-open semantics, `max(existing.endDay)` is the next available day after the last task ends — no gap.)
- `endDay = startDay`.

So a freshly added task is a zero-duration placeholder slotted in right after the existing schedule.

### 5.3 Workflow schedule info block

A new compact block between the description input and the "Tasks" heading in `editor-shell.tsx`:

```
┌─ Workflow schedule ──────────────────────────────────────────────┐
│  Start: day 1   ·   End: day 28   ·   Duration: 28 days   ·   6 tasks  │
└──────────────────────────────────────────────────────────────────┘
```

- All numbers computed live from the in-memory task drafts (same code path used by the service-layer aggregation, extracted into `lib/workflow-editor/compute-totals.ts` so both client and server share it).
- 0 tasks → "Add a task to see the schedule."
- This is a *live preview* during editing; the *persisted* `workflow_templates.total_*` columns are only rewritten on save.

### 5.4 Removed UI

- The current "day N–M" computed label on each task row goes away — the user now types those numbers directly.
- The current per-row "show schedule cycle" warning is replaced by the dep-violation soft warning (see §6.2).

### 5.5 Read-only detail page (`/workflows/[id]`)

Same schedule info block appears at the top of the read-only view, sourced from the persisted `workflow_templates.total_*` columns. Below it, the task list shows each task's start/end inline.

---

## 6. Dependencies, auto-suggest, and validation

### 6.1 Auto-suggest on dep-add

When the user adds a predecessor edge `A → B` via the existing dep picker:
- Let `predEnds = [endDay of every current predecessor of B, including A]`.
- Set `B.startDay = max(predEnds)`. (Half-open semantics: predecessor's `end` is already "the day after," so successor's `start = predecessor.end` means immediate succession with no gap. Note: this corrects the "+1" stated during brainstorming, which would have introduced a 1-day gap.)
- Set `B.endDay = newStartDay + (oldEndDay - oldStartDay)` — preserves the user's intended task length.
- Dep `lagDays` is 0 in practice (the editor never exposes it; the field defaults to 0 in `addDep`). The auto-suggest formula does not branch on lag — it just uses `predecessor.endDay`. If lag handling is added later, the formula becomes `max(predecessor.endDay + dep.lagDays)`.

Auto-suggest fires **only on the dep-add event**. It does *not* propagate when:
- An upstream task's `endDay` changes later.
- The user removes a dep.
- The user manually edits `B.startDay` after the suggest.

Rationale: dates are the user's truth; deps are an editing convenience. Constant propagation would feel magical and would overwrite manual placements.

### 6.2 Soft dep-violation warning

After every state change in the editor, recompute `violations = deps.filter(d => successor.startDay < predecessor.endDay)`. (In half-open semantics, `successor.startDay == predecessor.endDay` is the no-gap, no-overlap case — that's fine. Only strict `<` is a real violation.) If any:
- Banner above the task list: "Task <successor.name> starts before its dependency <predecessor.name> ends."
- Save is **not blocked**; the user can save anyway. The banner is a nudge, not a gate.

Rationale: user-typed dates win over the dep order. Surfacing the inconsistency is enough; enforcing it would force the user to choose between the dep and the date every time, which is the same trade-off we already chose by going with explicit dates.

### 6.3 Validation on save (`editor-shell.tsx validate()`)

| Existing | Kept? | Notes |
|---|---|---|
| `state.name.trim()` non-empty | yes | unchanged |
| `state.tasks.length > 0` | yes | unchanged |
| every task has a name | yes | unchanged |
| `t.durationDays >= 0` | **removed** | replaced below |
| `hasCycle(deps)` | yes | unchanged |
| — | **new** | every task: `t.startDay >= 1` |
| — | **new** | every task: `t.endDay >= t.startDay` |

Dep-violation does NOT count as a validation failure — only a soft warning per §6.2.

### 6.4 Scheduler simplification

- `lib/critical-path/index.ts` — input shape change: tasks now carry `startDay` / `endDay` instead of `durationDays`. The DAG walk is no longer needed to compute schedule (start/end are inputs), but is still needed to compute the **critical-path flag** (longest dep chain by end day). Same return shape.
- `lib/snapshot/apply-schedule.ts` — was the bridge from template `durationDays` + deps to project `plannedStartDay` / `plannedEndDay` / `plannedDurationDays`. Now: straight copy from template task to project task. Function stays as the snapshot's date-math entry point; body shrinks.
- `lib/snapshot/snapshot-workflows.ts` — calls `apply-schedule` the same way; no signature change.

### 6.5 Live editor cycle detection

`lib/workflow-editor/has-cycle.ts` is unchanged — operates on `{ tasks: [{ id }], deps: [{ fromId, toId }] }` and doesn't touch durations.

---

## 7. Draft storage (`lib/workflow-editor/draft-storage.ts`)

`DraftTask` type changes:

```diff
  type DraftTask = {
    id: string
    name: string
    description: string
-   durationDays: number
+   startDay: number
+   endDay: number
    ownerRoleLabel: string
    sortOrder: number
  }
```

Drafts in localStorage from before this change will fail the shape check on load. Add a one-line migration in `loadDraft`: if a stored draft has `durationDays` but not `startDay`/`endDay`, discard it (return `null`). Rationale: drafts are throwaway working state; cleanest path is to drop pre-change drafts rather than back-compute dates. The `DraftBanner` simply won't appear in that case.

---

## 8. Workflows list page (`app/(app)/workflows/page.tsx`)

### 8.1 Card layout

Replace the current single-line row with a card:

```
┌──────────────────────────────────────────────────────────┐
│  Workflow name                          [archived chip]  │
│  Description goes here, truncated to one line…           │
│  6 tasks  ·  28 days                                     │
└──────────────────────────────────────────────────────────┘
```

- Description: `workflowTemplates.description`, CSS `line-clamp-1`. If null/empty, skip the line entirely (no "—").
- Stats line: "<N> tasks · <D> days", both from `db/queries/workflow-templates.ts` results.
- Archived chip: shown only when `isArchived = true`.
- Whole card is a `<Link>` to `/workflows/[id]` — same as today.

### 8.2 Keyword search

- URL searchParam `?q=...`.
- New client component `components/workflows/list-search.tsx` renders a search input at the top of the page. It calls `router.replace('/workflows?...')` with a ~200ms debounce. Empty input clears the param.
- Page is a Server Component; reads `searchParams.q` and passes it to `listWorkflowTemplates`. Preserves the `archived` param via the router update.
- Empty state copy:
  - No query, no templates → "No templates yet. Click + New template to start." (current copy)
  - Query set, no matches → "No templates match \"<q>\"."

### 8.3 Other list-page behavior

- Existing `?archived=1` toggle unchanged.
- Owner-only redirect to `/` unchanged.
- Sort by `name` unchanged.

---

## 9. Files affected

| File | Change |
|---|---|
| `db/schema/workflow_template_tasks.ts` | drop `defaultDurationDays`, add `defaultStartDay` / `defaultEndDay` |
| `db/schema/workflow_templates.ts` | add `totalStartDay` / `totalEndDay` / `totalDurationDays` |
| `db/migrations/00NN_workflow_task_dates.sql` (new) | schema + backfill |
| `db/migrations/meta/_journal.json` | new entry |
| `db/seed.ts` | rewrite "Permitting Basics" template with start/end days |
| `db/queries/workflow-templates.ts` (new) | `listWorkflowTemplates({ q, includeArchived })` |
| `app/actions/workflows.ts` | zod payload change |
| `lib/services/workflow-template-service.ts` | validation + aggregate computation + transactional write |
| `lib/workflow-editor/draft-storage.ts` | `DraftTask` shape + pre-change-draft drop |
| `lib/workflow-editor/compute-totals.ts` (new) | shared min/max/duration helper |
| `lib/critical-path/index.ts` | input shape change; critical-path flag still computed |
| `lib/snapshot/apply-schedule.ts` | straight copy from template start/end to project planned start/end |
| `components/workflows/task-row.tsx` | start/end inputs + duration label |
| `components/workflows/editor-shell.tsx` | add-task defaults, schedule info block, soft warning, validation |
| `components/workflows/list-search.tsx` (new) | debounced search input |
| `app/(app)/workflows/page.tsx` | card layout + search + use new query |
| `app/(app)/workflows/[id]/page.tsx` | schedule info block at top |
| `tests/fixtures/workflow-templates.ts` | fixture rewrite |
| `lib/critical-path/index.test.ts` | fixture rewrite |
| `lib/snapshot/apply-schedule.test.ts` | simplified |
| `lib/snapshot/snapshot-workflows.test.ts` | fixture rewrite |
| `lib/services/workflow-template-service.test.ts` + `.cycle.test.ts` | payload shape |
| `lib/workflow-editor/draft-storage.test.ts` | shape + drop-old-draft |
| `lib/services/workflow-template-service.dates.test.ts` (new) | aggregate computation + start/end validation |
| `db/queries/workflow-templates.test.ts` (new) | `q` filter + archived filter |

---

## 10. Testing strategy

- Service-level tests against the real test Postgres (existing pattern): payload validation (`endDay >= startDay`, `startDay >= 1`), aggregate computation on create + update, transactional write of tasks + aggregates, cycle rejection.
- Critical-path tests: feed tasks with explicit start/end + deps, assert the critical-path flag matches the longest dep chain by end day.
- Snapshot tests: assert template task `(startDay, endDay)` propagates verbatim to project task `(plannedStartDay, plannedEndDay)` and `plannedDurationDays = endDay - startDay`.
- Query tests: `listWorkflowTemplates` honors `q` (case-insensitive ILIKE across name and description), respects `includeArchived`, returns correct task count and total duration.
- Draft-storage unit test: a localStorage entry with the old `durationDays` shape returns `null` from `loadDraft`.

No new E2E / Playwright tests are added — the editor and list page behaviors are covered by service + query tests plus the existing editor unit tests.

---

## 11. Rollout

Single migration applied to both dev and test DBs (`npm run db:migrate` + the documented test-DB invocation). No staging env exists; the migration is destructive (drops `default_duration_days`) but back-filled and CHECK-constrained, so it's safe to run in one shot. No feature flag.

After deployment, any user-side localStorage drafts older than the change are silently discarded (§7); users see a fresh editor with no draft banner, which is the intended fallback.
