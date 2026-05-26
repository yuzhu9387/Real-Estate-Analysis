# BuildFlow Project Page — Design

**Date**: 2026-05-26
**Status**: Draft
**Scope**: UI design for the per-project detail view at `/projects/[id]`. Replaces the Phase-12 stub from the foundation. Read- and write-side both — uses Server Actions already implemented in the foundation. The full task detail page (linked from the drawer) is a separate spec, as is the My Tasks page (which surfaces tasks across projects).
**Depends on**: `2026-05-22-foundation-design.md` (post-update). Data model unchanged; all writes use foundation Server Actions.

---

## 1. Overview

The project page is where most day-to-day work happens. A PM monitors phase progress and tasks; an IC opens the drawer to update their assigned task's status and post comments; an owner can edit project metadata and force-unlock if needed.

The page is desktop-first. Tablet (>= 768px) works via flex/grid wrapping; mobile-specific polish is out of scope.

### Non-goals (in this spec)

- Full task detail page (the drawer links to it but it lives in a future spec)
- My Tasks page (LLM ranking, daily reminders — separate spec)
- Workflow template editor (separate spec)
- Activity feed filters / pagination beyond a recent-N window
- WebSocket-based live updates
- Mobile-specific layouts

---

## 2. Layout

```
┌───────────────────────────────────────────────────────────────────┐
│  9 Greenwood Pl  Newton, MA  [Al Homes]    ● In Progress  [Edit]  │
│  PM: Jenny  Purchased: 2026-01-15 $720k  Tgt Permit: …  Tgt Exit… │
├───────────────────────────────────────────────────────────────────┤
│  Permitting | Construction | Sale                       Activity  │
├───────────────────────────────────────────────────────────────────┤
│  [phase action bar — Kick Off / Mark Complete]                    │
│  [Gantt timeline — workflows + tasks of this phase]               │
│  [Task list — current phase tasks, scrollable, color-coded]       │
└───────────────────────────────────────────────────────────────────┘

(Task drawer floats as overlay on right when ?task=<id> is set)
```

The header is always visible (does not scroll out). The tab bar sits directly below. Each tab swaps the content area only.

---

## 3. Header summary

A single horizontal panel above the tabs. Content:

**Top row:**
- Project name (bold, larger)
- City, state (muted)
- Brand chip (`Al Homes` / `Alera` / `Apex` — colored badge)
- Right-aligned: project status indicator (`● Draft` / `● In Progress` / `● Complete` / `● Archived` with color) + outlined `Edit` button

**Bottom row** (flex-wrap on narrow screens):
- `PM: <name>`
- `Purchased: <date> · $<price>`
- `Target Permit: <date>`
- `Target Construction End: <date>`
- `Target Exit: <quarter>`

All fields are display-only here; the `Edit` button opens the metadata dialog (§9).

Empty/null values render as `—`. Currency formatted to USD with thousands separators.

---

## 4. Tab structure

Four tabs in this order: **Permitting**, **Construction**, **Sale**, **Activity** (last, visually separated by a left border to indicate it's of a different kind).

- Active tab is reflected in the URL: `?tab=permitting|construction|sale|activity`
- Default (no `?tab` param): first non-complete phase, or `permitting` if all are pending
- Clicking a tab updates the URL and re-renders content; the rest of the page (header, sidebar) does not flicker
- Each tab is independently lazy: the Gantt + task list for Permitting do not run their queries while Construction is active

The Activity tab is treated specially — its content is fetched in a Suspense boundary so the rest of the page is interactive immediately.

---

## 5. Phase tab content

Each of the three phase tabs (`Permitting`, `Construction`, `Sale`) shows three stacked sections in this order: action bar → Gantt → task list.

### 5.1 Action bar

A horizontal strip with:
- Phase name
- Phase status pill (`● pending` / `● in progress` / `● complete` — color-coded)
- If `in_progress`: day counter (`day N of est. <total>`)
- Right-aligned action button (label is dynamic — see below)

**Button label & state** — pure function `phaseActionState(phase, earlierPhases, userRole, projectPmId)`:

| Phase status | Earlier phases | Result |
|---|---|---|
| `pending` | all `complete` | Button: **"Kick Off Phase"**, enabled |
| `pending` | any not complete | Button: **"Kick Off Phase"**, disabled with tooltip `"Earlier phase must complete first"` |
| `in_progress` | — | Button: **"Mark Phase Complete"**, enabled |
| `complete` | — | Button hidden |

Permission: only `pm` (managing) or `owner` see the button at all. ICs don't render this row's button.

Confirmation modal appears when clicking **Mark Phase Complete** if any workflow in the phase is not yet `complete` — text:
> "X workflow(s) in this phase still have incomplete tasks. Mark phase complete anyway?"
> [Cancel] [Yes, mark complete]

### 5.2 Gantt timeline

Renders **only the workflows and tasks belonging to the active phase**. SVG-based. Each task is a horizontal bar on a time axis.

**Rows:**
- One row per workflow as a parent (collapsible) with an aggregate bar spanning its tasks
- Below each workflow row: one row per task (indented)
- Subtasks are not shown in the Gantt (only in the drawer)

**Bar styling:**
- Planned bar: light blue background, spans `plannedStartDay → plannedEndDay`
- Actual progress overlay (when `actualStartDay` is set): darker blue overlay, from `actualStartDay` to `min(today, actualEndDay or planned_end)`
- Unplanned tasks (`isUnplanned=true`): red border + light red fill
- **Critical path tasks** (`isOnCriticalPath=true`): bordered with a 2px red border (independent of the unplanned styling, so a task that's both critical and unplanned has both treatments)

**Decorations:**
- Today line: vertical red line at `today` day-offset, full-height
- Dependency arrows: thin gray curves from `from_task` end to `to_task` start; visible at week-zoom and finer; hidden at quarter zoom for clarity

**Zoom controls** (top-right of Gantt):
- `[Week] [Month] [Quarter]` toggle buttons. Default = Month. Week shows day ticks; Month shows week ticks; Quarter shows month ticks.

**Click behavior:**
- Click a task bar → open task drawer (set `?task=<id>` URL param)
- Click a workflow row's name → toggle collapse/expand
- Hover task bar → tooltip with name + dates + owner

**Empty state:** if the phase has no workflows yet, render: "No workflows assigned to this phase. Edit the project to add workflows."

### 5.3 Task list

Below the Gantt, a scrollable list of every task in the active phase (including subtasks, indented). Box has a fixed max-height (~250px) with internal scroll.

**Row content** (left to right, flex):
- Status track icon (🟢 / 🟠 / 🔴)
- Status label (text matching icon, e.g. `on track` / `at risk` / `delay 5d`)
- Task name (color-matched: green / orange / red)
- Owner name (right-aligned)

**Status color rules** (`lib/project-page/current-task-status.ts`):

| Display | Rule |
|---|---|
| 🔴 `delay <N>d` | `today > planned_end_day` AND `status NOT IN ('complete', 'wont_do')`. N = days past planned_end_day. |
| 🟠 `at risk` | `is_blocked = true` (deps incomplete) |
| 🟢 `on track` | Everything else, including `complete` and `wont_do` |

Where "today" is `today_day_offset = (today - project.kicked_off_at) / 1 day`. Before kick-off, today_day_offset = 0 and no task can be `delay`.

**Add task button** (top-right of list):
- Label is contextual: in `draft` state → `+ Add task`; in `in_progress` → `+ Add unplanned task`
- Visible only to `pm` (managing) or `owner`
- Click → opens add-task dialog (§8)

**Click behavior:** clicking anywhere on a task row opens its drawer (same `?task=<id>` mechanism).

**Empty state:** "No tasks in this phase yet."

---

## 6. Task drawer

A floating overlay that slides in from the right when the URL contains `?task=<uuid>`. Width fixed at 380px; full viewport height. Background page is **not** dimmed or pushed — drawer just floats on top with a subtle left-edge shadow.

### 6.1 Open / close

- Opens on URL change to include `?task=<id>` (clicking a task row or task bar)
- Closes on:
  - Click × button at top-right of drawer
  - Press `Escape`
  - Browser back button (since open state is URL-derived)
- Closing removes `?task` from URL (preserves other params like `?tab=`)
- No backdrop click-to-close — user might be referring to the page behind the drawer

### 6.2 Drawer content (top to bottom)

1. **Close button** — × at top-right
2. **Breadcrumb**: `<Workflow name> · <Phase name>` (small, uppercase, muted)
3. **Task name** (h3)
4. **Risk pill**: `🔴 delay Nd` / `🟠 at risk` / `🟢 on track` + `· on critical path` if `isOnCriticalPath`
5. **Owner + Reviewer** (side-by-side block on light gray background):
   - Each shows: avatar initials in colored circle + full name + label "Owner" / "Reviewer"
   - If no reviewer assigned: show `—` and "no reviewer required" in the Reviewer slot
6. **Status flow stepper** — horizontal indicator with the 5 statuses positioned as nodes:
   - Order: `not_started → started → pending_review → approved → complete`
   - Current state: filled circle
   - Past states: green
   - Future states: gray
   - When `wont_do`: a separate gray badge "Won't do" replaces the stepper
   - If no reviewer: `pending_review` and `approved` are dimmed and skipped visually (line goes `started → complete` directly)
7. **Status action card** — light blue background, shows context-relevant text + primary button + secondary action:
   - See §6.3 for the matrix of which buttons show when
8. **Key facts grid** (label / value):
   - Planned: `Day <start>–<end> (<N>d)`
   - Actual start: `Day <N>` (only if set)
   - Actual end: `Day <N>` (only if set)
   - Depends on: comma-joined upstream task names (or `—`)
9. **Subtasks section**:
   - Header: `Subtasks (<N>)`
   - List of subtasks with status icon (✓ for complete, ○ for not_started, etc.) and name
   - `+ Add subtask` link — opens an inline mini-form (name + owner) right below; available to task owner, managing PM, owner
10. **Comments section**:
    - Header: `Comments`
    - Recent comments list, newest first, with author + relative time + kind badge (`discussion` / `review_request` / `review_approve` / `review_revision`) + body
    - Comment composer at the bottom: textarea + "Post" button. Placeholder: `Write a comment as <current user name>…`. Posts as `discussion` kind via `addTaskComment` Server Action.
    - Review-kind comments are not posted from this composer — they're auto-attached when the user clicks Submit for Review / Approve / Request Revision in the action card.
11. **Footer link**: `Open full task detail →` (links to future task detail page; href is `/projects/<projectId>/tasks/<taskId>` for now, page is a stub that says "future spec")

### 6.3 Status action card — button matrix

The card shows a one-sentence context line followed by 1–2 buttons. Only the next legal action renders as the primary (filled) button; "Won't do" is always offered as a secondary outlined button to the owner.

`taskActionState(task, currentUser, project)`:

| User role | Status | Primary button | Secondary | Context line |
|---|---|---|---|---|
| Owner of task | `not_started` | **Start** | Won't do | "You're the owner. Begin work?" |
| Owner of task | `started`, has reviewer | **Submit for Review** | Won't do | "You're the owner. Ready for review?" |
| Owner of task | `started`, no reviewer | **Mark Complete** | Won't do | "You're the owner. Mark this done?" |
| Owner of task | `approved` | **Mark Complete** | Won't do | "Approved by reviewer. Wrap up?" |
| Owner of task | `pending_review` | — | Won't do | "Waiting on reviewer. <reviewer name> needs to act." |
| Owner of task | `wont_do` | **Revert to Not Started** | — | "Marked won't do. Bring it back?" |
| Owner of task | `complete` | — | — | "Done. Marked complete <relative time>." |
| Reviewer of task | `pending_review` | **Approve** + **Request Revision** (two side-by-side) | — | "You're the reviewer. <owner name> submitted this for your review." |
| Reviewer of task (other state) | — | — | — | "You're the reviewer. Waiting on owner to submit." |
| PM (managing) or `owner` role, regardless of task assignment | mirror of whatever the task owner/reviewer would see, plus a small "(acting as PM)" / "(acting as owner)" annotation | | |
| IC unrelated to the task | — | — | — | "View only." |

When `Request Revision` is clicked: a small inline modal appears asking for required comment body (≥ 1 char), then on submit calls `requestTaskRevision`. The body is stored as a `review_revision` task comment.

When `Submit for Review` / `Approve` is clicked: optional comment field — if blank, no comment is added; if filled, attached as `review_request` / `review_approve` respectively.

---

## 7. Add task dialog

Triggered from the task list's `+ Add task` / `+ Add unplanned task` button (visible only to PM-managing or owner).

Built with Radix Dialog (already in foundation deps). Backdrop dims the page. Close on × or Escape.

### 7.1 Fields

Common (both modes):
- **Name** (required, text)
- **Planned duration (days)** (required, integer ≥ 0)
- **Owner** (required, user dropdown — searchable, lists active users)
- **Reviewer** (optional, user dropdown — same)
- **Description** (optional, textarea)

Mode-specific:

**Draft mode** (`project.status = 'draft'`):
- **Workflow** (required, dropdown of workflows in the active phase) — task is placed within this workflow
- **Sort position** (optional integer — defaults to end of workflow)
- **Upstream task(s)** (optional, multi-select of other tasks in the project) — creates `task_deps` rows
- No schedule recompute happens until kick-off

**In-progress mode** (`project.status = 'in_progress'`):
- **Workflow** (required, same as above)
- **Upstream task** (optional, single-select) — defaults to last task of the chosen workflow so unplanned work chains in naturally
- Submit triggers `addUnplannedTask` Server Action which inserts the task with `is_unplanned=true` and runs `applyScheduleToProject` to push downstream tasks if it's on the critical path

### 7.2 Validation

- All required fields filled
- `plannedDurationDays >= 0`
- If `upstreamTaskId` set, ensure no cycle would result (server already enforces via service; client shows a friendly error if rejected)

### 7.3 On submit

- Calls appropriate Server Action (`addPlannedTask` in draft or `addUnplannedTask` in in_progress — `addPlannedTask` is added in this spec's implementation plan; foundation only has `addUnplannedTask`)
- Closes dialog
- Toast confirmation
- The phase content re-renders (revalidatePath already done by the action)

**Note on missing foundation action:** the foundation's Server Action surface includes `addUnplannedTask` but not `addPlannedTask` (draft-mode planned task creation). This spec's implementation plan must add it. The service-layer logic is similar but skips the snapshot-driven schedule and accepts a position/sort_order rather than appending at the end.

---

## 8. Edit metadata dialog

Triggered from the header's `Edit` button. Radix Dialog. Visible to PM-managing or owner.

### 8.1 Editable fields by state

**Always editable** (in `draft`, `in_progress`):
- name
- address, city, state, zip
- brand (selecting changes the chip color)
- Project Manager (transfer to another user with `pm` or `owner` role)

**Editable only in `draft`** (becomes grayed/read-only after kick-off):
- target_permit_date
- target_construction_end_date
- target_exit_quarter (`YYYY-Qn` text input with regex validation)
- target_project_duration_days
- purchase_date, purchase_price
- title_holder
- project_strategy

**Read-only fields displayed but never editable from this dialog:**
- created_at, updated_at, status, kicked_off_at, completed_at, archived_at, actual_permit_date, actual_construction_end_date, actual_duration_days, presale_phase1/2/3_date, listing_date, sold, sold_price
- These are updated by other actions (phase completion, task progress) or not exposed yet (sale milestones — future spec)

### 8.2 Owner override section

A collapsible section at the bottom of the dialog, visible only to system `owner` role:

**"Owner overrides"**
- Button: **Unlock to Draft** — opens a sub-prompt requiring a `reason` (≥ 1 char), then calls `unlockProjectToDraft` Server Action. After unlock, all draft-only fields above become editable again.
- Button: **Force Reassign PM** — opens a sub-prompt with target user + reason; calls `forceReassignPm`.

These are clearly visually separated from the main form (red-tinted border, "Owner only" label) so they're not accidentally invoked.

### 8.3 Submit

- All standard edits go through a new `updateProjectMetadata` Server Action that this spec's plan must add (foundation only has `transferPm` and lifecycle actions)
- The action validates per-state editability server-side (re-checks; never trust the UI grayness)
- Closes dialog on success, header re-renders

---

## 9. Activity tab

Reverse-chronological list of events from the `activities` table for this project, with a default fetch limit of 100 most recent.

### 9.1 Event humanization (`lib/project-page/activity-humanize.ts`)

A pure function takes `{ type, payload, actor }` and returns a renderable string. Examples:

| type | payload | rendered text |
|---|---|---|
| `phase.kicked_off` | `{ phaseName }` | `Jenny Wang kicked off the <Permitting> phase` |
| `phase.marked_complete` | `{ phaseName }` | `Jenny Wang marked the <Permitting> phase complete` |
| `task.status_changed` | `{ taskId, from, to }` | `Mark Chen moved <Apply building permit> from <started> to <pending_review>` |
| `task.submitted_for_review` | `{ taskId }` | `Mark Chen submitted <Apply building permit> for review` |
| `task.approved` | `{ taskId }` | `Jenny Wang approved <Apply building permit>` |
| `task.revision_requested` | `{ taskId }` | `Jenny Wang requested revision on <Apply building permit>` |
| `task.added_unplanned` | `{ taskId, name }` | `Mark Chen added unplanned task <Schedule inspection>` |
| `task.subtask_added` | `{ parentTaskId, subtaskId }` | `Mark Chen added a subtask under <Apply building permit>` |
| `task.reassigned` | `{ taskId, from, to }` | `Mark Chen reassigned <Apply building permit> from Mark Chen to Bob Lee` |
| _unknown type_ | _any_ | `Mark Chen: <type>` (graceful fallback) |

Task names linked from event text open that task's drawer when clicked.

### 9.2 Display

Each entry:
- Avatar (initials)
- Humanized text
- Relative timestamp (`2h ago`, `Yesterday`, `Mar 15`)

No filters in v1. No pagination UI — just "Show older" link at the bottom that fetches the next 100. Defer if not needed.

---

## 10. Component organization

```
app/(app)/projects/[id]/
  page.tsx                      RSC — fetches all data, renders header + tabs + active tab
  project-page-client.tsx       Client — wraps tab state, drawer state, modal state (URL-driven)
  loading.tsx                   Skeleton
  error.tsx                     Error boundary
  tasks/[taskId]/page.tsx       Stub: "Full task detail page — covered by a separate spec"

components/project/
  header-summary.tsx            RSC display
  edit-metadata-button.tsx      Client (opens dialog)
  edit-metadata-dialog.tsx      Client (Radix Dialog)
  tabs.tsx                      Client (URL-sync)
  phase-content.tsx             RSC composing the three sections
  action-bar.tsx                Client (button + confirm modal)
  task-list.tsx                 RSC
  task-row.tsx                  RSC (link via URL param)
  add-task-button.tsx           Client (opens add-task dialog)
  add-task-dialog.tsx           Client (Radix Dialog with form)
  task-drawer.tsx               Client (overlay, reads ?task= param)
  drawer-status-stepper.tsx     Client (visual)
  drawer-status-actions.tsx     Client (state-driven buttons)
  drawer-subtasks.tsx           Client (list + inline add)
  drawer-comments.tsx           Client (list + composer)
  activity-feed.tsx             RSC (Suspense)
  activity-item.tsx             RSC
  gantt/
    gantt-chart.tsx             Client (SVG renderer + zoom + dep arrows + today line)
    gantt-bar.tsx               Client (single bar — planned + actual + flags)
    gantt-row-workflow.tsx      Client (collapsible aggregate row)
    gantt-toolbar.tsx           Client (zoom + collapse-all buttons)
    gantt-types.ts              Shared types
    gantt-layout.ts             Pure function: day → x-pixel mapping per zoom
```

Pure-function modules:

```
lib/project-page/
  current-task-status.ts        on-track / at-risk / delay rules
  phase-action-state.ts         Button label + enabled/disabled rules
  task-action-state.ts          Which buttons render for which user/state
  activity-humanize.ts          Event → rendered text

db/queries/
  project-page.ts               One-shot fetch: project + phases + workflows + tasks + deps
                                Activity feed has its own query in the same file
```

New Server Actions to add (foundation didn't include these):

```
app/actions/projects.ts
  updateProjectMetadata          Updates name, brand, address, target fields (per-state guards)

app/actions/tasks.ts
  addPlannedTask                 Draft-mode planned task creation (vs unplanned)
```

---

## 11. State management

All non-form state lives in the URL so links are shareable and the browser back button works as expected.

| State | Mechanism |
|---|---|
| Active tab | `?tab=<permitting|construction|sale|activity>` |
| Open drawer | `?task=<uuid>` |
| Edit / Add modals | Local React state (transient, intentionally non-shareable) |
| Confirmation modals | Local React state |

URL params are read in the RSC layer and passed to client wrappers. Client components mutating URL state use `useRouter().push(`?${updated}`, { scroll: false })`.

---

## 12. Data fetching

Single server-side function:

```ts
// db/queries/project-page.ts
export async function getProjectPageData(projectId: string): Promise<{
  project: Project,
  phases: ProjectPhase[],
  workflows: ProjectWorkflow[],
  tasks: Task[],          // all tasks for the project including subtasks
  taskDeps: TaskDep[],
  users: User[],          // all referenced users (owner, reviewer, comment authors) for the project
}>
```

Activity feed has its own query (only run when the Activity tab is the active tab):

```ts
export async function getProjectActivities(projectId: string, limit = 100): Promise<{
  activities: Activity[],
  users: User[],          // actors
  tasks: Task[],          // tasks referenced in payloads (for name lookup)
}>
```

The drawer's task data comes from the already-fetched `tasks` array. The drawer's comments list issues its own small query (`getTaskComments(taskId)`) when the drawer opens so comments are always fresh.

---

## 13. Permission gating

All checks already implemented via the foundation's `usePermissions()` hook + server-side `requirePermission` in Server Actions. This spec wires the existing primitives into UI conditionals.

Examples:
- Action bar buttons: `can({ type: 'project.kick_off_phase', project })` and `can({ type: 'project.mark_phase_complete', project })`
- Edit metadata button: `can({ type: 'project.update_meta', project })`
- Add task button: `can({ type: 'task.add_planned', project })` in draft, `can({ type: 'task.add_unplanned', project })` in in_progress
- Drawer status actions: `can({ type: 'task.set_status', project, task })`, `can({ type: 'task.submit_review', ... })`, etc.
- Owner overrides section: `user.role === 'owner'`

Server Actions re-check; never trust the client.

---

## 14. Testing strategy

### Unit (Vitest)

- `lib/project-page/current-task-status.ts` — all rules: on track / at risk / delay with edge cases (no kick_off_at, just-past-planned-end, wont_do counts as on-track, etc.)
- `lib/project-page/phase-action-state.ts` — every combination of (phase status, earlier phase complete-ness, user role)
- `lib/project-page/task-action-state.ts` — every (user role, task ownerId/reviewerId, status) combination
- `lib/project-page/activity-humanize.ts` — every event type, plus unknown-type fallback
- `components/project/gantt/gantt-layout.ts` — day-to-pixel mapping at each zoom

### Component (Vitest + RTL)

Focus on permission-conditional rendering:
- `drawer-status-actions.test.tsx`: render with different (currentUser, task, project) tuples, assert which buttons appear / disappear
- `action-bar.test.tsx`: render with different (phase, earlierPhases, userRole), assert button label and enabled state
- `task-list.test.tsx`: render with mixed-status tasks, assert color classes applied correctly

### Integration

Server Actions already tested by foundation. The two new actions added in this spec (`updateProjectMetadata`, `addPlannedTask`) require their own integration tests with happy / forbidden / locked cases (matching the foundation's pattern).

### E2E (Playwright)

Deferred. Add when stable enough to justify.

---

## 15. Visual design language

### Theme palette: Off-white + Electric Blue

Light off-white background, white surface cards, gradient cyan→blue accents on primary actions and brand-aware elements.

**Base:**
- Page background: `bg-zinc-50` (#fafafa)
- Card / surface: `bg-white`
- Border: `border-zinc-200`
- Body text: `text-zinc-900`
- Muted text: `text-zinc-500`

**Primary accent (Electric Blue gradient):**
- From: `cyan-500` (#06b6d4)
- To: `blue-500` (#3b82f6)
- Applied as `bg-gradient-to-r from-cyan-500 to-blue-500` on primary buttons and brand chips
- Solid alternative: `bg-blue-600` (#2563eb) for dense places where a gradient is visually heavy (small inline buttons, secondary spots)

**Secondary buttons:**
- `bg-white text-zinc-700 border border-zinc-300 hover:bg-zinc-50`

**Status colors (consistent across the app, do not vary by brand or theme):**
- Green (`text-emerald-600`, `bg-emerald-50`) — on track / complete
- Amber (`text-amber-600`, `bg-amber-50`) — at risk / blocked
- Red (`text-red-600`, `bg-red-50`) — delay / critical path emphasis / errors
- Blue (`text-blue-600`, `bg-blue-50`) — in progress / pending review

**Brand chips:**
- All three brands (`al_homes`, `alera`, `apex`) share the same gradient chip in v1: `bg-gradient-to-r from-cyan-500 to-blue-500 text-white`
- Per-brand distinct palettes are deferred to a polish iteration; can be added by mapping `project.brand` → palette config when distinct branding is needed

**Implication for already-shipped pages:** the dashboard, team, and performance pages currently use slate / solid blue (Theme A-ish). The implementation plan for this spec must include a tailwind config update plus a sweep of buttons / chips / cards on those pages to align with Theme B.

### Default avatars

When a user has no `avatarUrl` (before Lark sync, or backfill cases), they receive a deterministic SVG fallback. The same `user.id` always maps to the same shape, so visual identity is consistent across sessions.

**Avatar set (6 shapes, saved to `public/avatars/avatar-1.svg` through `avatar-6.svg`):**

1. **Solid circle** — cyan→blue gradient on cyan-50 background
2. **Triangle up** — purple→pink gradient on purple-50 background
3. **Diamond (rotated square)** — emerald→cyan gradient on green-50 background
4. **Two dots** — amber→orange gradient on amber-50 background
5. **Triangle down** — indigo→violet gradient on indigo-50 background
6. **Ring (hollow circle)** — rose→orange gradient stroke on red-50 background

All 40×40 SVG viewBox. The wrapping `<img>` / `<svg>` element applies `border-radius:50%` for circular crop.

**Selection algorithm** (pure function, lives in `lib/avatar/default-avatar.ts`):

```ts
export function pickDefaultAvatar(userId: string): number {
  let hash = 0
  for (const ch of userId) hash = (hash * 31 + ch.charCodeAt(0)) & 0x7fffffff
  return (hash % 6) + 1   // returns 1..6
}
```

**Avatar component** (`components/shared/avatar.tsx`):

- Accepts `user: { id: string; avatarUrl: string | null; name: string }` and `size: 'xs' | 'sm' | 'md' | 'lg'`
- Renders an `<img>` with `user.avatarUrl` when available; on load error or null URL, falls back to `<img src="/avatars/avatar-N.svg">` where N = `pickDefaultAvatar(user.id)`
- `name` is used for `alt=` and `title=` attributes only — never shown as initials
- Size mapping: xs=16, sm=24, md=40, lg=64 (pixels)

**Where each size is used:**
- xs: dense lists (activity feed inline mentions)
- sm: row avatars, status stepper actor labels, drawer breadcrumb
- md: drawer's Owner/Reviewer block
- lg: project page header (PM), settings/members table

---

## 16. Out of scope

- Full task detail page (`/projects/[id]/tasks/[taskId]`) — stub only in this spec, real page is a follow-up
- My Tasks page (cross-project ranked task list) — separate spec
- Workflow template editor — separate spec
- Mobile-specific layouts and gestures (tablet+ works; phone is best-effort)
- Live updates via WebSocket — RSC `revalidatePath` is the v1 mechanism
- Activity feed filters and pagination UI — fetch most-recent 100 with a "Show older" link
- Sale-milestone editing (presale_phase1/2/3_date, listing_date, sold, sold_price) — these are read-only in v1; setting them is part of the Sale-phase workflow, deferred until that workflow is designed

---

## 17. Open implementation questions

1. **Today day-offset before kick-off**: when `kicked_off_at` is null (draft), "today" maps to day 0. Status colors degenerate (everything is "on track"). This is the intended behavior — no tasks should be delayed before the project even starts. Confirm.
2. **Per-brand distinct palettes**: v1 ships all three brands using the same cyan→blue gradient chip. If you later want Al Homes / Alera / Apex to each have a distinct accent color, that's a small mapping config to add — flag during implementation if you want it now instead of deferred.

(Resolved during brainstorming: avatar source — see §15.)
