# BuildFlow Workflow Template Editor — Design

**Date**: 2026-05-27
**Status**: Draft
**Scope**: Owner-facing UI for creating, editing, duplicating, and archiving workflow templates. Replaces the foundation Phase 12 stubs at `/workflows` and `/workflows/[id]`. Adds a new editor route, a "new template" route with a blank/duplicate picker, and one new Server Action (`duplicateWorkflowTemplate`). All other Server Actions (`createWorkflowTemplate`, `updateWorkflowTemplate`, `archiveWorkflowTemplate`) are reused from foundation Phase 8.
**Depends on**: `2026-05-22-foundation-design.md` (data model, permissions, workflow template Server Actions). Snapshot semantics are unchanged — editing a template never affects projects that already snapshotted from it.

---

## 1. Overview

Workflow templates are the company's reusable definitions of "how we do a phase's worth of work" — owned by the `owner` role and consumed by PMs when assembling a project. The editor lets owners author and refine these templates over time without affecting any project that has already snapshotted from them.

Templates are simple in structure: a name, an optional description, a list of tasks (each with default duration and an informational owner-role label), and a set of dependency edges between tasks. The editor's job is to make all four trivial to author and edit on one page.

### Non-goals

- Versioning or edit history of past template revisions
- Importing / exporting templates across BuildFlow instances
- Hard-deleting a template (only archive — soft delete)
- Concurrent multi-owner editing (no locking; last-save-wins is acceptable for v1)
- Visual DAG-canvas editing (option C in brainstorming) — kept as a future enhancement if ever needed

---

## 2. Pages and routes

| Route | Purpose | Access |
|---|---|---|
| `/workflows` | List of templates, "+ New template" button | owner only |
| `/workflows/new` | Picker: "Start blank" or "Duplicate from existing" | owner only |
| `/workflows/new/edit` | New-template editor (template not yet persisted; saves create new row) | owner only |
| `/workflows/[id]` | Read-only detail view, "Edit" + "Duplicate" buttons | owner only |
| `/workflows/[id]/edit` | Editor (persisted template; saves update existing row) | owner only |

The middleware + foundation's `(app)` layout already requires authentication. Each workflow route additionally redirects to `/` if `user.role !== 'owner'`. (The current stubs already do this in some places — confirm and standardize during implementation.)

---

## 3. List page (`/workflows`)

Lists all workflow templates with optional "show archived" toggle.

Layout:
```
Workflow Templates                                  [+ New template]
─────────────────────────────────────────────────────────────
Show archived: [off]

Permitting Basics                            12 tasks
   For SFH with standard permitting              [archived]

Foundation Standard                          8 tasks
…
```

- Each row links to `/workflows/[id]` (read-only detail).
- Sort: non-archived first by `name`; archived last (grayed).
- "+ New template" button → `/workflows/new`.
- "Show archived" toggle is a URL query param `?archived=1` so it's shareable. Default off.
- Empty state: "No templates yet. Click '+ New template' to start."

---

## 4. Detail page (`/workflows/[id]`)

Read-only view. Used when someone wants to inspect a template (e.g. a PM clicks a reference from the project page in the future, or an owner is reading before editing).

Layout:
```
← Back to list                          [Edit]  [Duplicate]
Permitting Basics                                [archived]
A short description here.

Tasks (sorted by sort_order):
  1. Survey property              5d    Permit Specialist
  2. Submit zoning app           10d    Permit Specialist
     ← depends on: Survey property
  3. Apply building permit        3d    Permit Specialist
     ← depends on: Submit zoning app

Created by Owner Name · 2026-04-15
```

- **Edit** button → `/workflows/[id]/edit`.
- **Duplicate** button → opens a small inline form for the new name, then calls `duplicateWorkflowTemplate({ sourceId, newName })` and on success redirects to `/workflows/<newId>/edit`.
- If template is archived: "Edit" is hidden, "Restore" appears in its place. Duplicate is always available.
- Created-by and timestamp shown in the footer.

---

## 5. New-template picker (`/workflows/new`)

A simple two-choice page:

```
New workflow template

  [ Start blank ]            Begin with an empty editor.

  [ Duplicate from existing ]
    ┌──────────────────────────────────────┐
    │ Choose a template to copy:           │
    │  ⬇ Permitting Basics                 │
    │    Foundation Standard               │
    │    Framing                           │
    │ New name: [_________________________]│
    │                       [ Duplicate ]  │
    └──────────────────────────────────────┘
```

"Start blank" → `/workflows/new/edit` (the editor in new-template mode).
"Duplicate" → calls `duplicateWorkflowTemplate({ sourceId, newName })` → redirects to `/workflows/<newId>/edit`.

Archived templates do not appear in the duplicate dropdown.

---

## 6. Editor (`/workflows/new/edit` and `/workflows/[id]/edit`)

The main work. One page; same component for both new and edit modes. Mode is determined by whether the URL path includes a real ID.

### 6.1 Layout

```
← Back to detail                  [Cancel]  [Archive]  [Save]

Name: [Permitting Basics                              ]
Description: [optional one-line description           ]

Tasks
─────────────────────────────────────────────────────────────
⠿  1. [Survey property            ]  [5  ]d  [Permit Specialist ▾]
       depends on: (none) [+ add]
                                                          [delete]
⠿  2. [Submit zoning app          ]  [10 ]d  [Permit Specialist ▾]
       depends on: [Survey property ×] [+ add]
                                                          [delete]
⠿  3. [Apply building permit      ]  [3  ]d  [Permit Specialist ▾]
       depends on: [Submit zoning app ×] [+ add]
                                                          [delete]

[+ Add task]
```

- `⠿` is the drag handle (provided by `@dnd-kit/sortable`).
- Rows are reorderable by dragging the handle. Reorder updates `sort_order` of all tasks (recomputed contiguously 0…N–1 on save).
- The "depends on" multi-select can only reference tasks that appear EARLIER in the list (sort_order < current task's). This rule enforces a topological default; cycles still need a server-side check (the user can reorder to violate temporarily — UI prevents Save in that case).
- Owner-role input is a text field with an HTML `<datalist>` providing autocomplete: `design`, `construction`, `sales`, `development`. Free text is allowed; the datalist is just suggestions.
- Description is a single-line input (no markdown, no rich text). Multi-line note goes to `description` if needed later.

### 6.2 Header buttons

| Button | Visible when | Behavior |
|---|---|---|
| **Save** | Always | Calls `createWorkflowTemplate` (new mode) or `updateWorkflowTemplate` (edit mode). On success: clears localStorage draft, navigates to `/workflows/<id>` (read-only detail). |
| **Cancel** | Always | If dirty: confirm "Discard changes?". If clean: navigates back to `/workflows/<id>` (edit mode) or `/workflows` (new mode). |
| **Archive** | Edit mode AND template is `!isArchived` | Confirm "Archive this template? Existing projects are unaffected; new projects won't see it in the picker." On confirm: calls `archiveWorkflowTemplate` and navigates to `/workflows`. |
| **Restore** | Edit mode AND template `isArchived` | Calls a new `unarchiveWorkflowTemplate` Server Action (added in this spec — see §11). Stays on editor. |

### 6.3 Validation (client-side, before Save)

Save button is disabled and a banner explains why if any of:

- Name is empty
- Any task name is empty
- Any duration is `< 0` (negative)
- Any task has self-dependency (UI prevents adding it via the picker, but defense in depth)
- The dependency graph has a cycle — client-side `hasCycle(tasks, deps)` check (see §10)
- More than one task references the same task as a dep (deduped at the picker level; should never happen, but defensive check)

Server still validates everything as ground truth. Client validation is just for fast feedback.

### 6.4 Draft persistence (localStorage)

On every form change, the editor saves a snapshot of the in-progress form to localStorage:

```
Key:   workflow-draft-<templateIdOrNew>
Value: { name, description, tasks, deps, savedAt: ISO8601 }
```

On page load:
- If no localStorage key, render with server data (or empty for new mode).
- If localStorage key exists AND `savedAt > template.updatedAt` (or `template` is null and key exists with `__new__`): show a small banner at the top:

  ```
  ⚠ You have unsaved edits from <relative time>. [Restore] [Discard]
  ```

  - **Restore** → loads localStorage values into the form.
  - **Discard** → clears localStorage and loads server values.

On successful Save, localStorage key is cleared.

### 6.5 Unsaved-changes browser warning

When the form is dirty (state differs from the last server snapshot OR the most recent restore point):

- Register a `beforeunload` listener that returns a string. Modern browsers ignore the message and just show a default "Leave site?" dialog.
- Use Next's `useBeforeUnload` pattern (custom hook) to also intercept in-app navigations from `next/link` and back-button via the App Router's `useRouter().push` not triggering `beforeunload`. **Implementation detail**: a small `useLeavePrompt(isDirty)` hook that adds the event listener for tab close and uses `next/navigation`'s router with a confirm prompt for in-app navs.

### 6.6 Dragging behavior

- Drag a task row by the handle; live preview shows the moved position.
- When dropped, the entire list re-renders with the new order; `sort_order` is recomputed on the client and persisted on Save.
- Drag is restricted to within the task list container.
- Library: `@dnd-kit/core` + `@dnd-kit/sortable` (small footprint, modern, well-maintained).

---

## 7. Duplicate UX

There are two entry points:

1. **Detail page → Duplicate button**: opens an inline name-input prompt, defaults to "Copy of <source name>", on submit calls the action and redirects.
2. **New-template page → Duplicate from existing**: select source template + type new name, click "Duplicate", calls the action, redirects.

Both call the same `duplicateWorkflowTemplate({ sourceId, newName })` Server Action.

Behavior: the new template starts as a fresh row (`is_archived = false`, `created_by_id = currentUser.id`, `created_at = now`). All tasks and deps are copied. Then the user lands on its editor at `/workflows/<newId>/edit` and can immediately modify.

---

## 8. List page nuance — archived items

Archived templates:
- Render in the list (when "Show archived" is toggled on) with a grayed-out name and an "archived" chip.
- Excluded from the duplicate picker (you can still navigate to the detail page from the list and use the Duplicate button there if you really want to).
- Excluded from project creation (foundation's project-creation Server Action already filters by `isArchived`).

---

## 9. Restore (un-archive)

In the editor's header when viewing an archived template, the **Archive** button is replaced by **Restore**. Click → confirms "Restore this template to active state?" → calls `unarchiveWorkflowTemplate({ id })` → re-renders.

This requires a new Server Action — see §11.

---

## 10. Cycle detection (client-side)

A pure function `lib/workflow-editor/has-cycle.ts`:

```ts
export function hasCycle(input: {
  tasks: Array<{ id: string }>
  deps: Array<{ fromId: string; toId: string }>
}): boolean
```

Implementation: standard Kahn's-algorithm topological sort. If the sorted order's length is less than the input task count, there's a cycle.

Used in the editor to disable the Save button (with a banner) before the user submits invalid data. The server-side `workflowTemplateService.create / .update` doesn't currently have cycle detection (the foundation implementation only checks self-dependency). We add server-side cycle detection in this spec — see §11.

Tests for `hasCycle`:
- empty input → false
- linear chain → false
- diamond → false
- self-edge → true
- 2-cycle (A→B, B→A) → true
- 3-cycle (A→B, B→C, C→A) → true
- unrelated cycle in disconnected subgraph → true

---

## 11. New Server Actions

### 11.1 `duplicateWorkflowTemplate`

File: `app/actions/workflows.ts` (extend existing).

```ts
export async function duplicateWorkflowTemplate(raw: unknown):
  Promise<{ ok: true; id: string }>
```

Input zod:
```ts
z.object({ sourceId: z.string().uuid(), newName: z.string().min(1) })
```

Permission: `workflow.create` (existing — owner-only).

Service method (new, in `lib/services/workflow-template-service.ts`):

```ts
async duplicate(sourceId: string, input: { newName: string; createdById: string }, db: DB): Promise<WorkflowTemplate>
```

Implementation:
- Load source template + tasks + deps in a transaction.
- If source not found or archived: throw `NotFoundError` (or `ConflictError` if archived — pick: `ConflictError` to make the failure mode clearer).
- Insert new template row.
- Re-insert all tasks (new IDs, same sort_order, durations, owner role labels).
- Re-insert all deps using the new task IDs.
- Return the new template.

### 11.2 `unarchiveWorkflowTemplate`

```ts
export async function unarchiveWorkflowTemplate(raw: unknown):
  Promise<{ ok: true }>
```

Input: `z.object({ id: z.string().uuid() })`.

Permission: `workflow.update` on a context with `createdById` matching what's in the row (existing — owner-only).

Service method:

```ts
async unarchive(id: string, db: DB): Promise<void>
```

Sets `isArchived = false`, `updatedAt = now`. Throws `NotFoundError` if missing.

### 11.3 Cycle detection in `workflowTemplateService.create` and `.update`

Update the existing service methods (foundation Phase 8) to detect cycles before inserting deps. Use the same `hasCycle` pure function (shared with the client). Throw `ValidationError` on cycle.

Backwards compatibility: the foundation's create/update already validates self-dependency. Cycle detection is a strict superset — adding it does not break any existing data (we've verified no live data has cycles given our test corpus, and any future caller hitting the new check is doing so for a real cycle that should be blocked).

---

## 12. Component organization

```
app/(app)/workflows/
  page.tsx                          RSC — list page (archived toggle via ?archived=1)
  new/page.tsx                      RSC — picker: blank or duplicate
  new/edit/page.tsx                 RSC — editor in new mode (no id)
  [id]/page.tsx                     RSC — detail (read-only)
  [id]/edit/page.tsx                RSC — editor in edit mode (with id)

components/workflows/
  editor-shell.tsx                  Client — owns form state, dirty tracking, localStorage draft sync, beforeunload handler. Composes the children below.
  editor-header.tsx                 Client — Save / Cancel / Archive|Restore buttons + dirty banner
  task-list.tsx                     Client — wraps DndContext + SortableContext
  task-row.tsx                      Client — single sortable row with all inline fields
  dep-picker.tsx                    Client — "depends on" multi-select component for one task
  duplicate-prompt.tsx              Client — used on detail page for inline name input
  duplicate-picker.tsx              Client — used on /workflows/new for selecting source + new name
  archive-restore-button.tsx        Client — handles confirm + action call
  draft-banner.tsx                  Client — restore/discard prompt at top of editor
  list-row.tsx                      Server — single row on the list page

lib/workflow-editor/
  has-cycle.ts                      Pure: cycle detection
  has-cycle.test.ts
  draft-storage.ts                  Pure: localStorage key utilities + serialization
  draft-storage.test.ts
  use-leave-prompt.ts               Client hook: beforeunload + in-app nav confirm
```

The editor state shape (in `editor-shell.tsx`):

```ts
type DraftTask = {
  id: string         // client-side temp id ("new-1") or server id (uuid)
  name: string
  description: string
  durationDays: number
  ownerRoleLabel: string
  sortOrder: number
}
type DraftDep = {
  id: string         // client-side temp id ("dep-1") or server id (uuid)
  fromTaskId: string
  toTaskId: string
  lagDays: number    // default 0; field hidden in v1 UI but stored for future
}
type EditorState = {
  name: string
  description: string
  tasks: DraftTask[]
  deps: DraftDep[]
}
```

Client-side temp ids let the user add tasks before saving; the server-side `updateWorkflowTemplate` re-creates all rows on save (foundation's existing replace-wholesale semantic), so persisted IDs only matter for snapshotted projects (which keep their own copies anyway).

---

## 13. Data flow on Save

1. Editor calls `validateLocally(state)` (required fields, durations, cycle check).
2. If invalid → button stays disabled with banner; abort.
3. Build payload — for new mode call `createWorkflowTemplate(payload)`; for edit mode call `updateWorkflowTemplate({ id, ...payload })`.
4. On Server Action success: clear localStorage draft for this template ID, navigate to `/workflows/<id>` (read-only detail). Toast "Template saved."
5. On Server Action error (e.g. server cycle re-check fails, or DB error): show the error inline at the top of the editor, leave state as-is (localStorage draft retained).

---

## 14. Permissions

All routes and actions are owner-only:
- Routes redirect to `/` if `user.role !== 'owner'` (handled in each page's RSC via `requireUser()` + role check, or a shared layout under `app/(app)/workflows/layout.tsx`).
- Server Actions use existing `requirePermission({ type: 'workflow.{create|update|delete}' })`.

No new permission action types needed — `workflow.create`, `workflow.update`, `workflow.delete` already cover create/duplicate, update/unarchive, and archive respectively.

---

## 15. Testing strategy

### Unit (Vitest)

- `lib/workflow-editor/has-cycle.ts`: every cycle topology (empty, linear, diamond, self, 2-cycle, 3-cycle, disconnected cycle)
- `lib/workflow-editor/draft-storage.ts`: serialize/deserialize roundtrip; key namespacing; gracefully handles old/corrupt entries

### Integration (Vitest + real Postgres)

- `workflowTemplateService.duplicate` happy path (tasks + deps copied with new IDs)
- `workflowTemplateService.duplicate` rejects archived source
- `workflowTemplateService.unarchive` happy path + NotFound
- `workflowTemplateService.create` rejects cycle
- `workflowTemplateService.update` rejects cycle

### Component (Vitest + RTL)

- `editor-shell.test.tsx`: dirty state turns on after edit; Save disabled when invalid; localStorage draft saved on change; restore-banner shows when stale draft exists
- `task-row.test.tsx`: drag handle moves a row (mock dnd-kit interactions); delete confirms before removing
- `dep-picker.test.tsx`: only earlier tasks (by sort_order) appear as options

### E2E

Deferred. Add when shape stabilizes.

---

## 16. Out of scope

- Visual DAG-canvas editor (option C from brainstorming)
- Template versioning / edit history
- Concurrent multi-owner editing with locks
- Bulk operations on templates (mass archive, bulk export)
- Lag-days UI field (the data model supports `lag_days` per dep; v1 UI doesn't expose it. Default = 0. Future spec can add the input.)
- Markdown / rich-text in description

---

## 17. Open implementation questions

1. **dnd-kit subpackage selection**: `@dnd-kit/core` + `@dnd-kit/sortable` is the minimum needed. Add `@dnd-kit/modifiers` only if we need axis-locking; default is "no modifier".
2. **localStorage size cap**: a template with 100 tasks + 200 deps serializes to ~50KB. localStorage limit is ~5MB per origin, so we're fine. No GC needed for now; clear-on-save is enough.
3. **Cycle detection on existing data**: §11.3 adds server-side cycle detection. We've verified no foundation tests exercise cycles; the new check is additive. If migrating production data later, run a one-off audit query to confirm no existing template has a cycle.
