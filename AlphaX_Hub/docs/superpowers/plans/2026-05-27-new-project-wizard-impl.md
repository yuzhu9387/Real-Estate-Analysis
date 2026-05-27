# BuildFlow New-Project Wizard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the foundation Phase 12 minimal `/projects/new` stub with a full project creation wizard per `docs/superpowers/specs/2026-05-27-new-project-wizard-design.md`: single-page form (Basics / Targets / Workflows) with `@dnd-kit` per-phase workflow picker, year+quarter exit-target dropdowns, and a pure validation helper. Also adds the tightly-coupled `deleteTaskInDraft` Server Action and project-page × button that closes the "customize task list per project" loop.

**Architecture:** Pure validation function in `lib/new-project-wizard/`. Three new client components in `components/projects/` (note: plural — distinct from existing `components/project/` singular). One new Server Action (`deleteTaskInDraft`) + one new service method (`taskService.deleteInDraft`) that hard-deletes a task in draft, cascades dep edges, and re-applies the schedule. Task row gets a permission+state-gated × button. No new dependencies — `@dnd-kit/sortable` is already installed from the workflow editor work.

**Tech Stack:** Same as the rest of BuildFlow — Next.js 14, TypeScript, Drizzle + Postgres, Tailwind, Vitest, @dnd-kit/sortable.

---

## Phase 1: Pure validation function

### Task 1.1: `validateWizard`

**Files:**
- Create: `lib/new-project-wizard/validate.ts`
- Create: `lib/new-project-wizard/validate.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// lib/new-project-wizard/validate.test.ts
import { describe, it, expect } from 'vitest'
import { validateWizard, type WizardState } from './validate'

function makeState(overrides: Partial<WizardState> = {}): WizardState {
  return {
    name: 'Project 1',
    brand: 'al_homes',
    city: 'Newton',
    state: 'MA',
    targetExitYear: 2026,
    targetExitQuarter: 3,
    assignments: [{
      id: 'a1', phase: 'Permitting', templateId: 'tpl-1',
      templateName: 'Permits', sortOrder: 0,
    }],
    ...overrides,
  }
}

describe('validateWizard', () => {
  it('passes when everything is filled', () => {
    expect(validateWizard(makeState())).toBe(null)
  })

  it('fails when name is empty', () => {
    expect(validateWizard(makeState({ name: '' }))).toBe('name')
    expect(validateWizard(makeState({ name: '   ' }))).toBe('name')
  })

  it('fails when city is empty', () => {
    expect(validateWizard(makeState({ city: '' }))).toBe('city')
  })

  it('fails when state is empty', () => {
    expect(validateWizard(makeState({ state: '' }))).toBe('state')
  })

  it('fails when target quarter is out of range', () => {
    expect(validateWizard(makeState({ targetExitQuarter: 5 as unknown as 1 }))).toBe('exit_quarter_format')
    expect(validateWizard(makeState({ targetExitQuarter: 0 as unknown as 1 }))).toBe('exit_quarter_format')
  })

  it('fails when target year is unreasonable', () => {
    expect(validateWizard(makeState({ targetExitYear: 1999 }))).toBe('exit_quarter_format')
    expect(validateWizard(makeState({ targetExitYear: 3000 }))).toBe('exit_quarter_format')
  })

  it('fails when Permitting has zero assignments', () => {
    expect(validateWizard(makeState({ assignments: [] }))).toBe('permitting_empty')
    expect(validateWizard(makeState({
      assignments: [{ id: 'a1', phase: 'Construction', templateId: 't1', templateName: 'X', sortOrder: 0 }],
    }))).toBe('permitting_empty')
  })

  it('passes with extra optional Construction/Sale assignments', () => {
    expect(validateWizard(makeState({
      assignments: [
        { id: 'a1', phase: 'Permitting', templateId: 't1', templateName: 'A', sortOrder: 0 },
        { id: 'a2', phase: 'Construction', templateId: 't2', templateName: 'B', sortOrder: 0 },
        { id: 'a3', phase: 'Sale', templateId: 't3', templateName: 'C', sortOrder: 0 },
      ],
    }))).toBe(null)
  })
})
```

- [ ] **Step 2: Run, expect FAIL**

```bash
npm test -- lib/new-project-wizard/validate.test.ts
```

- [ ] **Step 3: Implement**

```ts
// lib/new-project-wizard/validate.ts
export type Assignment = {
  id: string
  phase: 'Permitting' | 'Construction' | 'Sale'
  templateId: string
  templateName: string
  sortOrder: number
}

export type WizardState = {
  name: string
  brand: 'al_homes' | 'alera' | 'apex'
  city: string
  state: string
  targetExitYear: number
  targetExitQuarter: 1 | 2 | 3 | 4
  assignments: Assignment[]
}

export type ValidationError = 'name' | 'city' | 'state' | 'exit_quarter_format' | 'permitting_empty'

const VALIDATION_MESSAGES: Record<ValidationError, string> = {
  name: 'Name is required',
  city: 'City is required',
  state: 'State is required',
  exit_quarter_format: 'Target exit quarter must be within the next few years',
  permitting_empty: 'Permitting needs at least one workflow',
}

export function validationMessage(err: ValidationError): string {
  return VALIDATION_MESSAGES[err]
}

export function validateWizard(state: WizardState): ValidationError | null {
  if (!state.name.trim()) return 'name'
  if (!state.city.trim()) return 'city'
  if (!state.state.trim()) return 'state'
  if (!Number.isInteger(state.targetExitQuarter) ||
      state.targetExitQuarter < 1 || state.targetExitQuarter > 4) {
    return 'exit_quarter_format'
  }
  if (state.targetExitYear < 2020 || state.targetExitYear > 2099) {
    return 'exit_quarter_format'
  }
  if (!state.assignments.some(a => a.phase === 'Permitting')) {
    return 'permitting_empty'
  }
  return null
}
```

- [ ] **Step 4: Run, expect PASS**

```bash
npm test -- lib/new-project-wizard/validate.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add lib/new-project-wizard/validate.ts lib/new-project-wizard/validate.test.ts
git commit -m "feat(new-project-wizard): validateWizard pure function"
```

---

## Phase 2: deleteTaskInDraft service + action

### Task 2.1: Service method + Server Action

**Files:**
- Modify: `lib/services/task-service.ts`
- Modify: `app/actions/tasks.ts`
- Create: `lib/services/task-service.delete-in-draft.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// lib/services/task-service.delete-in-draft.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { eq } from 'drizzle-orm'
import { testDb, truncateAll } from '@/tests/db'
import { tasks, taskDeps, activities, projectPhases } from '@/db/schema'
import { seedOwner, seedPm } from '@/tests/fixtures/users'
import { seedTemplate } from '@/tests/fixtures/workflow-templates'
import { projectService } from './project-service'
import { phaseService } from './phase-service'
import { taskService } from './task-service'
import { ProjectLockedError, NotFoundError } from '@/lib/server/errors'

async function setup() {
  const owner = await seedOwner()
  const pm = await seedPm()
  const { template } = await seedTemplate({
    createdById: owner.id, name: 'P',
    tasks: [
      { name: 'A', durationDays: 2 },
      { name: 'B', durationDays: 3 },
      { name: 'C', durationDays: 1 },
    ],
    deps: [
      { fromIdx: 0, toIdx: 1 },
      { fromIdx: 1, toIdx: 2 },
    ],
  })
  const project = await projectService.create({
    createdById: pm.id, name: 'X', brand: 'al_homes', pmId: pm.id,
    assignments: [{ phaseName: 'Permitting', templateId: template.id, sortOrder: 0 }],
  }, testDb)
  return { project, pm }
}

describe('taskService.deleteInDraft', () => {
  beforeEach(async () => { await truncateAll() })

  it('hard deletes the task in draft', async () => {
    const { project, pm } = await setup()
    const all = await testDb.select().from(tasks).where(eq(tasks.projectId, project.id))
    const target = all.find(t => t.name === 'B')!
    await taskService.deleteInDraft(target.id, pm.id, testDb)
    const remaining = await testDb.select().from(tasks).where(eq(tasks.projectId, project.id))
    expect(remaining.map(t => t.name).sort()).toEqual(['A', 'C'])
  })

  it('cascades dep edges (FK on cascade)', async () => {
    const { project, pm } = await setup()
    const all = await testDb.select().from(tasks).where(eq(tasks.projectId, project.id))
    const target = all.find(t => t.name === 'B')!
    await taskService.deleteInDraft(target.id, pm.id, testDb)
    const remainingDeps = await testDb.select().from(taskDeps).where(eq(taskDeps.projectId, project.id))
    expect(remainingDeps.some(d => d.fromTaskId === target.id || d.toTaskId === target.id)).toBe(false)
  })

  it('writes activity row', async () => {
    const { project, pm } = await setup()
    const all = await testDb.select().from(tasks).where(eq(tasks.projectId, project.id))
    const target = all.find(t => t.name === 'B')!
    await taskService.deleteInDraft(target.id, pm.id, testDb)
    const acts = await testDb.select().from(activities).where(eq(activities.type, 'task.deleted'))
    expect(acts.length).toBe(1)
    expect((acts[0].payload as { taskId: string; name: string }).name).toBe('B')
  })

  it('throws ProjectLockedError when project is in_progress', async () => {
    const { project, pm } = await setup()
    const phases = await testDb.select().from(projectPhases).where(eq(projectPhases.projectId, project.id))
    const permitting = phases.find(p => p.name === 'Permitting')!
    await phaseService.kickOff({ phaseId: permitting.id, actorId: pm.id }, testDb)
    const all = await testDb.select().from(tasks).where(eq(tasks.projectId, project.id))
    await expect(taskService.deleteInDraft(all[0].id, pm.id, testDb))
      .rejects.toThrow(ProjectLockedError)
  })

  it('throws NotFoundError on unknown task', async () => {
    const { pm } = await setup()
    await expect(taskService.deleteInDraft('00000000-0000-0000-0000-000000000000', pm.id, testDb))
      .rejects.toThrow(NotFoundError)
  })
})
```

- [ ] **Step 2: Run, expect FAIL**

```bash
npm test -- lib/services/task-service.delete-in-draft.test.ts
```

- [ ] **Step 3: Add `deleteInDraft` method to `taskService` in `lib/services/task-service.ts`**

Add this method inside the existing `taskService` object (e.g., after `setStatus`):

```ts
async deleteInDraft(taskId: string, actorId: string, db: DB) {
  const { projects } = await import('@/db/schema')
  const { ProjectLockedError } = await import('@/lib/server/errors')
  const { applyScheduleToProject } = await import('@/lib/snapshot/apply-schedule')

  return db.transaction(async (tx) => {
    const taskRows = await tx.select().from(tasks).where(eq(tasks.id, taskId))
    if (taskRows.length === 0) throw new NotFoundError('Task')
    const task = taskRows[0]

    const projRows = await tx.select().from(projects).where(eq(projects.id, task.projectId))
    if (projRows.length === 0) throw new NotFoundError('Project')
    if (projRows[0].status !== 'draft') throw new ProjectLockedError(projRows[0].status)

    await tx.delete(tasks).where(eq(tasks.id, taskId))

    await tx.insert(activities).values({
      projectId: task.projectId, actorId,
      type: 'task.deleted',
      payload: { taskId, name: task.name },
    })

    await applyScheduleToProject(tx, { projectId: task.projectId })
  })
},
```

- [ ] **Step 4: Add the Server Action to `app/actions/tasks.ts`**

Append:

```ts
export async function deleteTaskInDraft(raw: unknown) {
  const input = z.object({ taskId: z.string().uuid() }).parse(raw)
  const { task, project } = await loadTaskCtx(input.taskId)
  const user = await requirePermission({
    type: 'task.update_structure',
    project: { pmId: project.pmId, status: project.status },
  })
  await taskService.deleteInDraft(input.taskId, user.id, db)
  revalidatePath(`/projects/${project.id}`)
  revalidatePath('/my-tasks')
  return { ok: true }
}
```

(`loadTaskCtx` is already in `app/actions/tasks.ts` from foundation Phase 10.)

- [ ] **Step 5: Run, expect PASS**

```bash
npm test -- lib/services/task-service.delete-in-draft.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add lib/services/task-service.ts app/actions/tasks.ts lib/services/task-service.delete-in-draft.test.ts
git commit -m "feat(service): deleteTaskInDraft with cascade + schedule recompute"
```

---

## Phase 3: Project page task-row delete button

### Task 3.1: Modify task-row.tsx

**Files:**
- Modify: `components/project/task-row.tsx`

- [ ] **Step 1: Read the existing file to find the exact structure**

The file currently renders a `<Link>` wrapping the entire row. To add an inline × delete button without making it a nested click target, switch the outer Link to a regular `<div>` and put the navigation on an inner span/Link that doesn't wrap the × button. Read the file first:

```bash
cat components/project/task-row.tsx
```

- [ ] **Step 2: Rewrite `components/project/task-row.tsx`**

Replace the file contents with this version. It accepts new optional props for delete capability and renders the × button when applicable.

```tsx
'use client'
import Link from 'next/link'
import { useState } from 'react'
import type { Task, User } from '@/db/schema'
import { currentTaskStatus } from '@/lib/project-page/current-task-status'
import { usePermissions } from '@/lib/hooks/use-permissions'
import { deleteTaskInDraft } from '@/app/actions/tasks'

const LEVEL_STYLES = {
  on_track: { icon: '🟢', color: 'text-emerald-600' },
  at_risk: { icon: '🟠', color: 'text-amber-600' },
  delay: { icon: '🔴', color: 'text-red-600' },
} as const

export function TaskRow({
  task, owner, todayDayOffset, urlSearch, project,
}: {
  task: Task
  owner: User | undefined
  todayDayOffset: number
  urlSearch: URLSearchParams
  project: { id: string; pmId: string; status: 'draft' | 'in_progress' | 'complete' | 'archived' }
}) {
  const { can } = usePermissions()
  const [busy, setBusy] = useState(false)
  const { level, daysBehind } = currentTaskStatus(
    { status: task.status, isBlocked: task.isBlocked, plannedEndDay: task.plannedEndDay },
    todayDayOffset,
  )
  const style = LEVEL_STYLES[level]
  const label = level === 'delay' ? `delay ${daysBehind}d` : level === 'at_risk' ? 'at risk' : 'on track'

  const next = new URLSearchParams(urlSearch)
  next.set('task', task.id)
  const href = `?${next.toString()}`

  const canDelete = project.status === 'draft'
    && can({ type: 'task.update_structure', project })

  async function onDelete(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!window.confirm(`Delete "${task.name}"? This cannot be undone.`)) return
    setBusy(true)
    try {
      await deleteTaskInDraft({ taskId: task.id })
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="px-3 py-2 hover:bg-zinc-50 border-b border-zinc-100 last:border-0 flex items-center gap-3">
      <Link href={href} scroll={false} className={`flex-1 flex items-center gap-3 text-sm ${style.color}`}>
        <span>{style.icon}</span>
        <span className="w-24 shrink-0">{label}</span>
        <span className="flex-1 truncate">
          {task.name}
          {task.isUnplanned && <span className="ml-2 text-xs px-1.5 py-0.5 bg-red-100 text-red-700 rounded">unplanned</span>}
        </span>
        <span className="text-zinc-600">{owner?.name ?? '—'}</span>
      </Link>
      {canDelete && (
        <button
          onClick={onDelete}
          disabled={busy}
          aria-label={`delete ${task.name}`}
          className="text-zinc-400 hover:text-red-600 px-1 text-base disabled:opacity-50">
          ×
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Update the callers to pass `project` prop**

The TaskRow is consumed in `components/project/task-list.tsx`. Find the `<TaskRow ...>` render inside that file (around the part that maps `phaseTasks`) and add `project={project}` to the spread props. Open the file first:

```bash
cat components/project/task-list.tsx
```

The existing `TaskList` already receives `project` as a prop (used by `<AddTaskButton>` in the header), so just thread it down:

```tsx
{phaseTasks.map(t => (
  <TaskRow
    key={t.id}
    task={t}
    owner={userById.get(t.ownerId)}
    todayDayOffset={todayDayOffset}
    urlSearch={urlSearch}
    project={project}
  />
))}
```

- [ ] **Step 4: Verify and commit**

```bash
npm run typecheck
npm run build
git add components/project/task-row.tsx components/project/task-list.tsx
git commit -m "feat(project-page): × delete button on task rows in draft mode"
```

---

## Phase 4: Wizard sub-components

### Task 4.1: WorkflowChip

**Files:**
- Create: `components/projects/workflow-chip.tsx`

- [ ] **Step 1: Implement**

```tsx
'use client'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

export function WorkflowChip({
  id, name, onRemove,
}: {
  id: string
  name: string
  onRemove: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }
  return (
    <span ref={setNodeRef} style={style}
      className="inline-flex items-center gap-1 bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">
      <button {...attributes} {...listeners}
        className="cursor-grab text-blue-600 hover:text-blue-900"
        aria-label={`drag to reorder ${name}`}>⠿</button>
      <span>{name}</span>
      <button onClick={onRemove}
        aria-label={`remove ${name}`}
        className="hover:text-blue-900">×</button>
    </span>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/projects/workflow-chip.tsx
git commit -m "feat(new-project-wizard): WorkflowChip sortable component"
```

---

### Task 4.2: WorkflowPhaseRow

**Files:**
- Create: `components/projects/workflow-phase-row.tsx`

- [ ] **Step 1: Implement**

```tsx
'use client'
import { useState } from 'react'
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, arrayMove, horizontalListSortingStrategy } from '@dnd-kit/sortable'
import { WorkflowChip } from './workflow-chip'
import type { Assignment } from '@/lib/new-project-wizard/validate'

export function WorkflowPhaseRow({
  phase, required, isError,
  assignments, availableTemplates,
  onAdd, onRemove, onReorder,
}: {
  phase: 'Permitting' | 'Construction' | 'Sale'
  required: boolean
  isError: boolean
  assignments: Assignment[]
  availableTemplates: Array<{ id: string; name: string }>
  onAdd: (templateId: string, templateName: string) => void
  onRemove: (assignmentId: string) => void
  onReorder: (newOrder: Assignment[]) => void
}) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  // Templates not yet assigned to THIS phase
  const assignedTemplateIds = new Set(assignments.map(a => a.templateId))
  const pickable = availableTemplates.filter(t => !assignedTemplateIds.has(t.id))

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const oldIndex = assignments.findIndex(a => a.id === active.id)
    const newIndex = assignments.findIndex(a => a.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return
    const moved = arrayMove(assignments, oldIndex, newIndex)
    const renumbered = moved.map((a, i) => ({ ...a, sortOrder: i }))
    onReorder(renumbered)
  }

  return (
    <div className="space-y-2">
      <div className="font-medium text-sm">
        {phase}
        {required && <span className="text-red-600 ml-1">*</span>}
        {!required && <span className="text-zinc-500 font-normal ml-1">(optional)</span>}
      </div>
      <div className={`rounded border p-2 ${isError ? 'border-red-300 bg-red-50' : 'border-zinc-200 bg-white'}`}>
        {assignments.length === 0 ? (
          <span className="text-xs text-zinc-500 italic mr-2">No workflows assigned.</span>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={assignments.map(a => a.id)} strategy={horizontalListSortingStrategy}>
              <div className="inline-flex flex-wrap gap-2 mr-2">
                {assignments.map(a => (
                  <WorkflowChip
                    key={a.id}
                    id={a.id}
                    name={a.templateName}
                    onRemove={() => onRemove(a.id)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
        <div className="relative inline-block">
          <button
            type="button"
            onClick={() => setPickerOpen(o => !o)}
            disabled={pickable.length === 0}
            className="text-xs text-blue-600 hover:underline disabled:text-zinc-400 disabled:no-underline">
            + Add workflow{pickable.length === 0 ? ' (none available)' : ' ▾'}
          </button>
          {pickerOpen && pickable.length > 0 && (
            <div className="absolute z-10 mt-1 bg-white border border-zinc-200 rounded shadow-lg min-w-[200px] max-h-60 overflow-y-auto">
              {pickable.map(t => (
                <button key={t.id}
                  type="button"
                  onClick={() => { onAdd(t.id, t.name); setPickerOpen(false) }}
                  className="block w-full text-left px-2 py-1 text-xs hover:bg-zinc-100">
                  {t.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
npm run typecheck
git add components/projects/workflow-phase-row.tsx
git commit -m "feat(new-project-wizard): WorkflowPhaseRow with sortable chips + picker"
```

---

## Phase 5: Main form component

### Task 5.1: NewProjectForm

**Files:**
- Create: `components/projects/new-project-form.tsx`

- [ ] **Step 1: Implement**

```tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createProject } from '@/app/actions/projects'
import { validateWizard, validationMessage, type WizardState, type Assignment } from '@/lib/new-project-wizard/validate'
import { WorkflowPhaseRow } from './workflow-phase-row'

const CURRENT_YEAR = new Date().getFullYear()
const YEARS = [CURRENT_YEAR, CURRENT_YEAR + 1, CURRENT_YEAR + 2, CURRENT_YEAR + 3]
const QUARTERS: Array<1 | 2 | 3 | 4> = [1, 2, 3, 4]

let assignmentSeq = 0
function nextAssignmentId(): string {
  assignmentSeq++
  return `a-${Date.now()}-${assignmentSeq}`
}

export function NewProjectForm({
  templates,
}: {
  templates: Array<{ id: string; name: string }>
}) {
  const router = useRouter()
  const [state, setState] = useState<WizardState>({
    name: '', brand: 'al_homes', city: '', state: '',
    targetExitYear: CURRENT_YEAR + 1,
    targetExitQuarter: 1,
    assignments: [],
  })
  const [busy, setBusy] = useState(false)
  const [errorBanner, setErrorBanner] = useState<string | null>(null)

  const validation = validateWizard(state)

  function patch(p: Partial<WizardState>) {
    setState(s => ({ ...s, ...p }))
  }

  function addAssignment(phase: Assignment['phase'], templateId: string, templateName: string) {
    const existingInPhase = state.assignments.filter(a => a.phase === phase)
    const newAssignment: Assignment = {
      id: nextAssignmentId(),
      phase, templateId, templateName,
      sortOrder: existingInPhase.length,
    }
    patch({ assignments: [...state.assignments, newAssignment] })
  }

  function removeAssignment(assignmentId: string) {
    const removed = state.assignments.find(a => a.id === assignmentId)
    if (!removed) return
    const remaining = state.assignments.filter(a => a.id !== assignmentId)
    // Re-number sortOrder within the affected phase
    const renumbered = remaining.map(a => {
      if (a.phase !== removed.phase) return a
      const siblings = remaining.filter(x => x.phase === a.phase)
      const newSortOrder = siblings.findIndex(x => x.id === a.id)
      return { ...a, sortOrder: newSortOrder }
    })
    patch({ assignments: renumbered })
  }

  function reorderPhase(phase: Assignment['phase'], newOrder: Assignment[]) {
    const others = state.assignments.filter(a => a.phase !== phase)
    patch({ assignments: [...others, ...newOrder] })
  }

  function assignmentsForPhase(phase: Assignment['phase']): Assignment[] {
    return state.assignments
      .filter(a => a.phase === phase)
      .sort((a, b) => a.sortOrder - b.sortOrder)
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrorBanner(null)
    const err = validateWizard(state)
    if (err) { setErrorBanner(validationMessage(err)); return }

    setBusy(true)
    try {
      const payload = {
        name: state.name,
        brand: state.brand,
        city: state.city,
        state: state.state,
        targetExitQuarter: `${state.targetExitYear}-Q${state.targetExitQuarter}`,
        assignments: state.assignments.map(a => ({
          phaseName: a.phase, templateId: a.templateId, sortOrder: a.sortOrder,
        })),
      }
      const res = await createProject(payload) as { ok: true; id: string }
      router.push(`/projects/${res.id}`)
    } catch (e) {
      setErrorBanner(e instanceof Error ? e.message : 'Failed to create project')
    } finally {
      setBusy(false)
    }
  }

  const submitDisabledReason = validation ? validationMessage(validation) : null

  return (
    <form onSubmit={onSubmit} className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold">New Project</h1>

      {errorBanner && (
        <div className="rounded border border-red-200 bg-red-50 text-red-700 text-sm px-3 py-2">{errorBanner}</div>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-700">Basics</h2>
        <label className="block">
          <span className="text-xs text-zinc-600">Name *</span>
          <input
            value={state.name}
            onChange={(e) => patch({ name: e.target.value })}
            className="mt-1 w-full border border-zinc-300 rounded px-2 py-1 text-sm"
            placeholder="e.g., 9 Greenwood Pl"
          />
        </label>
        <label className="block">
          <span className="text-xs text-zinc-600">Brand *</span>
          <select
            value={state.brand}
            onChange={(e) => patch({ brand: e.target.value as WizardState['brand'] })}
            className="mt-1 w-full border border-zinc-300 rounded px-2 py-1 text-sm">
            <option value="al_homes">Al Homes</option>
            <option value="alera">Alera</option>
            <option value="apex">Apex</option>
          </select>
        </label>
        <div className="grid grid-cols-[1fr_120px] gap-3">
          <label className="block">
            <span className="text-xs text-zinc-600">City *</span>
            <input
              value={state.city}
              onChange={(e) => patch({ city: e.target.value })}
              className="mt-1 w-full border border-zinc-300 rounded px-2 py-1 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-xs text-zinc-600">State *</span>
            <input
              value={state.state}
              onChange={(e) => patch({ state: e.target.value })}
              className="mt-1 w-full border border-zinc-300 rounded px-2 py-1 text-sm"
              placeholder="MA"
            />
          </label>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-700">Targets</h2>
        <label className="block">
          <span className="text-xs text-zinc-600">Target Exit Quarter *</span>
          <div className="mt-1 flex gap-2">
            <select
              value={state.targetExitYear}
              onChange={(e) => patch({ targetExitYear: Number(e.target.value) })}
              className="border border-zinc-300 rounded px-2 py-1 text-sm">
              {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <select
              value={state.targetExitQuarter}
              onChange={(e) => patch({ targetExitQuarter: Number(e.target.value) as 1 | 2 | 3 | 4 })}
              className="border border-zinc-300 rounded px-2 py-1 text-sm">
              {QUARTERS.map(q => <option key={q} value={q}>Q{q}</option>)}
            </select>
          </div>
        </label>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-700">Workflows</h2>
        <WorkflowPhaseRow
          phase="Permitting"
          required
          isError={validation === 'permitting_empty'}
          assignments={assignmentsForPhase('Permitting')}
          availableTemplates={templates}
          onAdd={(id, name) => addAssignment('Permitting', id, name)}
          onRemove={removeAssignment}
          onReorder={(o) => reorderPhase('Permitting', o)}
        />
        <WorkflowPhaseRow
          phase="Construction"
          required={false}
          isError={false}
          assignments={assignmentsForPhase('Construction')}
          availableTemplates={templates}
          onAdd={(id, name) => addAssignment('Construction', id, name)}
          onRemove={removeAssignment}
          onReorder={(o) => reorderPhase('Construction', o)}
        />
        <WorkflowPhaseRow
          phase="Sale"
          required={false}
          isError={false}
          assignments={assignmentsForPhase('Sale')}
          availableTemplates={templates}
          onAdd={(id, name) => addAssignment('Sale', id, name)}
          onRemove={removeAssignment}
          onReorder={(o) => reorderPhase('Sale', o)}
        />
      </section>

      <div className="flex items-center gap-3 pt-2">
        <button
          type="button"
          onClick={() => router.push('/projects')}
          className="px-4 py-2 border border-zinc-300 rounded text-sm hover:bg-zinc-50">
          Cancel
        </button>
        <button
          type="submit"
          disabled={busy || !!validation}
          title={submitDisabledReason ?? undefined}
          className="ml-auto px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded text-sm hover:opacity-90 disabled:opacity-50">
          {busy ? 'Creating…' : 'Create Project'}
        </button>
      </div>
    </form>
  )
}
```

- [ ] **Step 2: Verify and commit**

```bash
npm run typecheck
git add components/projects/new-project-form.tsx
git commit -m "feat(new-project-wizard): NewProjectForm with sections + validation"
```

---

## Phase 6: Page route replacement

### Task 6.1: Replace `/projects/new/page.tsx`

**Files:**
- Modify: `app/(app)/projects/new/page.tsx`

- [ ] **Step 1: Replace the file**

```tsx
import Link from 'next/link'
import { eq } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/server/get-current-user'
import { db } from '@/db/client'
import { workflowTemplates } from '@/db/schema'
import { NewProjectForm } from '@/components/projects/new-project-form'

export default async function NewProjectPage() {
  const me = await requireUser()
  if (me.role !== 'pm' && me.role !== 'owner') redirect('/')

  const templates = await db.select({
    id: workflowTemplates.id,
    name: workflowTemplates.name,
  }).from(workflowTemplates)
    .where(eq(workflowTemplates.isArchived, false))
    .orderBy(workflowTemplates.name)

  if (templates.length === 0) {
    return (
      <div className="space-y-4 max-w-2xl">
        <h1 className="text-2xl font-semibold">New Project</h1>
        <div className="rounded-lg border border-dashed border-zinc-200 bg-white p-12 text-center text-zinc-500 text-sm">
          No workflow templates exist yet. The owner needs to create one before projects can be added.
          <div className="mt-4">
            <Link href="/workflows" className="text-blue-600 hover:underline">Go to Workflow Templates →</Link>
          </div>
        </div>
      </div>
    )
  }

  return <NewProjectForm templates={templates} />
}
```

- [ ] **Step 2: Verify and commit**

```bash
npm run typecheck
npm run build
git add "app/(app)/projects/new/page.tsx"
git commit -m "feat(new-project-wizard): /projects/new full wizard route"
```

---

## Phase 7: Final verification + smoke runbook

### Task 7.1: Full suite verification

- [ ] **Step 1: Tests + typecheck + build**

```bash
npm test
npm run typecheck
npm run build
```

All three must succeed. New routes/components compile; `validateWizard` and `deleteInDraft` tests pass.

- [ ] **Step 2: Manual smoke runbook**

Requires Postgres up + a signed-in owner or pm + at least one workflow template.

1. `docker compose up -d && npm run db:migrate && npm run dev`
2. Sign in via Lark. As `owner`, visit `/workflows` and confirm at least one non-archived template exists; otherwise create one (foundation Phase 8 + workflow editor).
3. Visit `/projects/new`:
   - Confirm form sections: Basics / Targets / Workflows
   - Confirm "Create Project" is disabled
4. Fill in Name, City, State. Confirm Create still disabled (need Permitting workflow).
5. Click "+ Add workflow" under Permitting → pick a template. Chip appears with drag handle and ×.
6. Confirm Create now enabled.
7. (Optional) Add multiple Permitting workflows and drag-reorder them.
8. (Optional) Add Construction / Sale workflows.
9. Click "Create Project" → redirects to `/projects/<id>`.
10. On the project page, confirm:
    - Header shows the project in draft state
    - Permitting tab is selected and has the snapshotted workflow's tasks
11. Click a task row → confirm the × delete button appears (you're in draft, you're the PM).
12. Click × → confirm prompt → confirm → task disappears from the list and Gantt updates.
13. Click "Kick Off Phase" → project transitions to `in_progress`.
14. Confirm × delete buttons disappear from rows (state-machine guard).

If any step fails, fix and re-run.

- [ ] **Step 3: Final commit if any cleanup**

```bash
git status
# If anything, commit it.
```

---

## Plan self-review

**Spec coverage** — checking each numbered section of the spec:

| Spec section | Implemented by |
|---|---|
| §2 Required vs optional fields | Task 1.1 (validation) + Task 5.1 (form) |
| §3 Page layout | Task 5.1 + 6.1 |
| §4 Workflow picker UX | Tasks 4.1, 4.2 |
| §5 Target Exit Quarter dropdowns | Task 5.1 |
| §6 Form state + validation | Tasks 1.1 + 5.1 |
| §7 Submit flow | Task 5.1 (`onSubmit`) |
| §8 Permission gating | Task 6.1 (page-level) + existing `createProject` Server Action |
| §9 Adjacent enhancement (delete-in-draft) | Tasks 2.1 (service+action), 3.1 (UI button) |
| §10 Routes and components | Tasks 4.1, 4.2, 5.1, 6.1 + Task 1.1 for validation |
| §11 Data fetch on page load | Task 6.1 (templates query + empty state) |
| §12 Testing strategy | Tasks 1.1 (unit), 2.1 (integration); component tests recommended but not enumerated per spec §15 acceptance |
| §13 Out of scope | respected — no extras added |
| §14 Open implementation questions | flagged in spec; no plan changes |

**Placeholder scan**: no TBD / TODO / "similar to" / "implement later" patterns.

**Type consistency**: `WizardState`, `Assignment`, `ValidationError` defined in Task 1.1 and used in Tasks 5.1 (form) and Task 4.2 (`Assignment` import). `deleteTaskInDraft` Server Action signature matches between Task 2.1 (definition) and Task 3.1 (consumer in task-row.tsx). Brand enum (`al_homes | alera | apex`) consistent across.

**Known limitations called out**:
- Component-level tests for `new-project-form` and `task-row` × button are mentioned in the spec as recommended but not enumerated as plan tasks. Add ad-hoc during implementation if useful.
- The post-creation "add workflows to phase" feature flagged in spec §13 is genuinely out of this plan.
