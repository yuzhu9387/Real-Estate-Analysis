# BuildFlow New-Project Wizard — Design

**Date**: 2026-05-27
**Status**: Draft
**Scope**: Replaces the minimal foundation Phase 12 stub at `/projects/new` with a full creation form that captures the required project metadata and per-phase workflow assignments, then lets the PM continue refining the task list on the project page in `draft` state. Includes one tightly-coupled adjacent enhancement: hard-delete of tasks while a project is in `draft` (the missing operation that completes the "customize task list per project" loop).
**Depends on**: `2026-05-22-foundation-design.md` (data model, `projectService.create`, permissions), `2026-05-26-project-page-design.md` (task list and drawer on the project page), `2026-05-27-workflow-editor-design.md` (workflow templates the PM picks from).

---

## 1. Overview

When a deal closes, the PM clicks "New Project" and lands in this wizard. They fill in the project's identity, location, target exit quarter, and at minimum one workflow for the Permitting phase. On submit, the foundation's `projectService.create` snapshots the chosen templates into the project's own task/dep tables and lands the user on the project page in `draft` state, where the rest of the foundation's editing surface (add task, edit task, kick off phase) takes over.

This spec also adds a small but missing capability on the project page: the ability to hard-delete a task while the project is still in `draft`. Today the PM can `+ Add task` but cannot remove one — they have to wait until `in_progress` and use `wont_do`, which is wrong for a still-being-shaped project. Adding delete-in-draft completes the "customize task list per project" workflow.

### Non-goals

- A multi-step wizard with Next/Back navigation (single page is enough for ~8 required fields)
- Letting the PM pre-edit individual task fields (name/duration/owner) before saving — they edit on the project page in draft mode after creation
- Setting the PM at creation time to anyone other than the current user — owner can transfer later via existing project-page actions
- Drag-and-drop from a template "library" pane (option B from brainstorming — heavier interaction, not needed)
- Bulk creation of projects from a CSV / Excel import
- Pre-filled project from a "duplicate from existing project" flow

---

## 2. Required vs optional fields

### Required at creation (validated client-side AND server-side)

- `name` — non-empty string
- `brand` — enum `al_homes | alera | apex`
- `city` — non-empty string
- `state` — non-empty string (US two-letter abbreviation accepted as free text in v1)
- `target_exit_quarter` — text matching `^\d{4}-Q[1-4]$`
- **at least one workflow assignment in the Permitting phase**

### Optional at creation (editable in the project page's metadata dialog later)

- `address` — street
- `zip`
- `title_holder`
- `project_strategy`
- `purchase_date`
- `purchase_price`
- `target_project_duration_days`
- `target_permit_date`
- `target_construction_end_date`

### Workflow assignments

- **Permitting**: must have ≥1 template
- **Construction**: 0+
- **Sale**: 0+

Construction and Sale phases can be populated later. **However**, there is no UI today on the project page for assigning new workflows to a phase after creation. The PM can only add/delete individual tasks (the new delete-in-draft is part of this spec). Adding workflows to Construction/Sale post-creation is flagged as a follow-up in §13.

---

## 3. Page layout

Single-page form at `/projects/new`. Three vertically stacked sections, single Create button at the bottom.

```
← Back to projects
New Project
─────────────────────────────────────────────────────────────────

Basics
  Name *               [ ____________________________ ]
  Brand *              [ Al Homes ▾ ]
  City *               [ _________ ]   State *  [ MA ]

Targets
  Target Exit Quarter *   [ 2026 ▾ ] [ Q3 ▾ ]

Workflows
  Permitting *
    [ ⠿ Survey Workflow × ] [ ⠿ Permit Workflow × ]
    [ + Add workflow ▾ ]

  Construction (optional)
    (no workflows assigned)
    [ + Add workflow ▾ ]

  Sale (optional)
    (no workflows assigned)
    [ + Add workflow ▾ ]

                                  [ Cancel ] [ Create Project ]
```

The Create button is disabled until validation passes; when disabled, a hover tooltip explains why (e.g., "Permitting needs at least one workflow"). Validation is checked live on each input change.

---

## 4. Workflow picker UX

The recommended pattern from brainstorming (Option A — inline per-phase rows).

For each phase row:

1. **Chip list** — selected workflows render as horizontal chips with a drag handle (⠿) and × remove button. Drag a chip to reorder within the same phase. Reorder updates the `sortOrder` that gets sent to the snapshot operation.
2. **Add dropdown** — `+ Add workflow ▾` opens a menu listing all non-archived workflow templates that aren't already assigned to this phase. Click one to append it to this phase's chips.
3. **Cross-phase reuse** — the same template *can* be assigned to multiple phases (rare, but allowed; the foundation's snapshot operation handles this fine — each assignment becomes its own `project_workflows` row with its own copied task set).
4. **Visual state** — Permitting row shows a red asterisk in its label and renders the "+ Add workflow" link in error red if the chip list is empty. Other phases are subdued.

Drag-and-drop uses the already-installed `@dnd-kit/sortable` from the workflow editor work. Each phase row has its own `SortableContext`; drags do not cross phase boundaries.

---

## 5. Target Exit Quarter input

Rather than a free-text input that the user has to format as `2026-Q3`, the wizard renders two side-by-side dropdowns:

- **Year** — current year through current year + 3 (e.g., 2026 / 2027 / 2028 / 2029)
- **Quarter** — Q1 / Q2 / Q3 / Q4

The form composes them into `target_exit_quarter = "{year}-{quarter}"`. Server still accepts and validates the regex format — the wizard just shields the PM from having to type it.

---

## 6. Form state and validation

Local React state in `new-project-form.tsx`:

```ts
type WizardState = {
  name: string
  brand: 'al_homes' | 'alera' | 'apex'
  city: string
  state: string
  targetExitYear: number
  targetExitQuarter: 1 | 2 | 3 | 4
  assignments: Array<{
    id: string                                // client-side temp id for chip keying / drag
    phase: 'Permitting' | 'Construction' | 'Sale'
    templateId: string
    templateName: string                      // for display
    sortOrder: number                         // within the phase
  }>
}
```

Pure validation function in `lib/new-project-wizard/validate.ts`:

```ts
export type ValidationError = 'name' | 'city' | 'state' | 'exit_quarter_format' | 'permitting_empty'

export function validateWizard(state: WizardState): ValidationError | null
```

Returns the first failing rule, or `null` if valid. The Create button is disabled while non-null.

Server validates everything as ground truth (foundation's `projectService.create` already rejects empty `assignments` and missing required fields).

---

## 7. Submit flow

On Create button click:

1. Run `validateWizard(state)` — if non-null, surface the error inline and abort.
2. Compose the payload for `createProject` (existing Server Action — foundation Phase 9.4):
   ```ts
   {
     name, brand, city, state,
     targetExitQuarter: `${targetExitYear}-Q${targetExitQuarter}`,
     assignments: state.assignments.map(a => ({
       phaseName: a.phase, templateId: a.templateId, sortOrder: a.sortOrder,
     })),
   }
   ```
   (`address`, `zip`, and other optional fields are not in the wizard; they default to `null` server-side.)
3. Disable the Create button (show "Creating…" spinner).
4. Call `createProject(payload)` — foundation's existing action:
   - Validates permission `project.create`
   - Calls `projectService.create` which inserts the project row, creates the three phases, snapshots the workflows, applies the initial schedule
5. On success → `router.push('/projects/<newId>')`. The PM lands on the project page in `draft` state.
6. On error → display the message inline (no special parsing of error type; the server's error message is shown verbatim).

---

## 8. Permission gating

- The page route requires `currentUser.role IN ('pm', 'owner')`. `ic` users redirect to `/`.
- The existing `createProject` Server Action calls `requirePermission({ type: 'project.create' })`, which the foundation's `can()` already restricts to those two roles.

The page does its own check for snappy UX (no flash of redirect); the action's check is the ground truth.

---

## 9. Adjacent enhancement: delete task in draft

The wizard delivers a project in `draft` state with workflows snapshotted. The PM should be able to fully customize that task list before kick-off. Today the project page lets them ADD planned tasks (foundation Phase 10) but not DELETE — that gap closes here.

### 9.1 New Server Action

`deleteTaskInDraft` in `app/actions/tasks.ts`:

```ts
export async function deleteTaskInDraft(raw: unknown): Promise<{ ok: true }>
```

Input zod: `z.object({ taskId: z.string().uuid() })`.

Permission: existing `task.update_structure` action (gates by `draft` status + managing PM or owner — see foundation §6).

### 9.2 New service method

`taskService.deleteInDraft(taskId, db)`:

1. Load the task. If not found, `NotFoundError`.
2. Load the project. If `status !== 'draft'`, throw `ProjectLockedError`.
3. In a transaction:
   - Delete the task (FK cascade on `task_deps` already drops associated edges from foundation Phase 2.6 schema).
   - Cascade also drops subtasks (`parent_task_id` self-FK on cascade).
   - Insert an `activities` row with `type='task.deleted'` and `payload={ taskId, name }` for audit visibility.
4. After delete, re-apply the schedule: `applyScheduleToProject(tx, { projectId })` — downstream tasks' `planned_*` values now reflect the gap, and `is_on_critical_path` is recomputed.

### 9.3 UI change on the project page

In `components/project/task-row.tsx`, add a small × button on the far-right of each row, visible only when:
- `project.status === 'draft'` AND
- `can({ type: 'task.update_structure', project })` returns true

Click handler: shows a native `confirm("Delete \"<task name>\"? This cannot be undone.")`. On confirm: calls `deleteTaskInDraft({ taskId })`. On success: optimistic UI removes the row (or relies on RSC revalidatePath).

The drawer's existing "Won't do" button is unchanged — it remains the soft-delete mechanism for `in_progress` and beyond. The new × button is **only** for draft mode.

---

## 10. Routes and components

```
app/(app)/projects/new/
  page.tsx                       RSC — fetches templates, gates by role, renders form

components/projects/
  new-project-form.tsx           Client — owns wizard state, calls Server Action
  workflow-phase-row.tsx         Client — one phase's chip list + add dropdown
  workflow-chip.tsx              Client — single sortable chip with × remove

lib/new-project-wizard/
  validate.ts                    Pure: validateWizard
  validate.test.ts               Unit tests for each rule

components/project/
  task-row.tsx                   Modify: add × delete button (gated by state + permission)
```

The new components live under `components/projects/` (plural) to distinguish from the existing `components/project/` (singular, for the project page). This separation already exists for `components/my-tasks/` etc.

---

## 11. Data fetch on page load

The page fetches:

```ts
const templates = await db.select({ id, name }).from(workflowTemplates)
  .where(eq(workflowTemplates.isArchived, false))
  .orderBy(workflowTemplates.name)
```

Returned as a flat list. The wizard groups them by phase only through user selection — there's no schema-level "this template belongs to phase X" concept. Templates can serve any phase. This matches the foundation's snapshot model.

If the templates list is empty, the page shows an empty state: "No workflow templates exist yet. The owner needs to create one before projects can be added. [Go to /workflows]".

---

## 12. Testing strategy

### Unit

`lib/new-project-wizard/validate.ts`:
- name empty → 'name'
- city empty → 'city'
- state empty → 'state'
- exit quarter not in `YYYY-Q[1-4]` format → 'exit_quarter_format'
- Permitting has zero assignments → 'permitting_empty'
- All required filled → null

### Integration

`taskService.deleteInDraft`:
- Happy path: deletes task, cascades dep edges, removes subtasks, schedule recomputed
- Throws `ProjectLockedError` when project is `in_progress` / `complete` / `archived`
- Throws `NotFoundError` for unknown taskId
- Writes activity row

### Component (RTL)

`components/project/task-row.tsx`:
- Renders × button only in draft + permission true
- Hides × button in `in_progress` regardless of permission
- Click triggers confirm and Server Action call (mocked)

`new-project-form.tsx`:
- Create button disabled until all required filled
- "+ Add workflow" dropdown excludes already-assigned templates within the same phase
- Chip drag reorder updates sortOrder
- Successful submit redirects to `/projects/<id>` (router mocked)

### No new E2E in v1

---

## 13. Out of scope

- Setting the PM to someone other than the creator at creation time (owner can transfer via existing project-page action)
- Pre-edit of individual task fields (name/duration/owner) before saving — PM edits in draft mode on the project page
- Drag-from-library two-pane picker (option B in brainstorming)
- A "save and continue later" mid-wizard draft (single form, single submission)
- **Post-creation workflow assignment**: today, after creation, the project page does not have UI to add workflows to Construction or Sale phases. This will be a small follow-up feature on the project page (an "+ Add workflow to phase" button on each empty phase tab when in `draft` state). Flagged here so it's not lost.
- Soft-delete (status `wont_do`) in draft mode — the new `deleteTaskInDraft` is a hard delete because nothing about the task matters yet in draft
- Bulk import / CSV
- "Duplicate from existing project" flow

---

## 14. Open implementation questions

1. **State two-letter validation**: v1 accepts any non-empty string for `state` (foundation already does). A future polish could enforce US two-letter codes. Out of scope today.
2. **Empty templates empty-state copy**: §11 shows a placeholder. Final wording can be tweaked during implementation; nothing functional depends on the exact phrasing.
3. **Task delete vs `wont_do` precedence**: §9 says `wont_do` is the only mechanism in `in_progress`. If you ever want hard-delete in `in_progress` too (e.g., owner override), it would be a separate Server Action gated by `audit_log` reason. Not in v1.
