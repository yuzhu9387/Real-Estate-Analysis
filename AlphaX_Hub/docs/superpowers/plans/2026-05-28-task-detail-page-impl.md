# Full-Page Task Detail — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `/tasks/[taskId]` — a deep-linkable full-page task detail screen with summary, details (status flow + info grid + subtasks + description), comments, and an attachments stub. Reuses existing Server Actions; introduces `updateTaskMetadata` (action + service method) and shared `lib/tasks/status-flow.ts` helpers. The drawer's "Open full task detail" link starts pointing at this new route.

**Architecture:** Pure-function status-flow helpers in `lib/tasks/status-flow.ts` are consumed by BOTH the new full-page widget and the existing drawer stepper (refactored to share the helper). One denormalized read in `db/queries/task-detail.ts` powers the RSC; mutations all flow through existing Server Actions plus one new `updateTaskMetadata` for the Edit dialog. Visual tokens come from the project's existing Tailwind theme (`glacier-panel`, Material Symbols Outlined icons, `font-headline-*`, `text-primary`); the attached mockup is the layout reference only.

**Tech Stack:** Same as the rest of the repo — Next.js 14 App Router (RSC + Server Actions), TypeScript strict, Drizzle ORM + Postgres 16, Tailwind, Radix Dialog, Vitest with the test Postgres on `:5433`. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-05-28-task-detail-page-design.md`
**Mockup:** `docs/superpowers/specs/2026-05-28-task-detail-mockup.html`

---

## File map

**Created:**
- `lib/tasks/status-flow.ts` (+ `.test.ts`)
- `db/queries/task-detail.ts` (+ `.test.ts`)
- `lib/services/task-service.update-metadata.test.ts`
- `app/actions/tasks.update-metadata.test.ts`
- `app/(app)/tasks/[taskId]/page.tsx`
- `app/(app)/tasks/[taskId]/loading.tsx`
- `app/(app)/tasks/[taskId]/error.tsx`
- `components/tasks/task-detail-screen.tsx`
- `components/tasks/page-nav.tsx`
- `components/tasks/top-actions.tsx`
- `components/tasks/summary-section.tsx`
- `components/tasks/status-flow.tsx`
- `components/tasks/details-section.tsx`
- `components/tasks/edit-task-metadata-dialog.tsx`
- `components/tasks/comments-section.tsx`
- `components/tasks/attachments-section.tsx`

**Modified:**
- `lib/services/task-service.ts` (add `updateMetadata` method)
- `app/actions/tasks.ts` (add `updateTaskMetadata` Server Action)
- `components/project/drawer-status-stepper.tsx` (refactor to use shared helper)
- `components/project/task-drawer.tsx` (fix "Open full task detail" href)

---

## Phase 1 — Pure helpers (status-flow)

### Task 1.1: `status-flow.ts` pure helpers

**Files:**
- Create: `lib/tasks/status-flow.ts`
- Create: `lib/tasks/status-flow.test.ts`

- [ ] **Step 1: Write tests first**

```ts
// lib/tasks/status-flow.test.ts
import { describe, it, expect } from 'vitest'
import { computeVisibleStages, activeStage } from './status-flow'

describe('computeVisibleStages', () => {
  it('with reviewer → 3 stages', () => {
    expect(computeVisibleStages(true)).toEqual(['start', 'submit_review', 'complete'])
  })

  it('without reviewer → 2 stages (no submit_review)', () => {
    expect(computeVisibleStages(false)).toEqual(['start', 'complete'])
  })
})

describe('activeStage', () => {
  it('not_started → start (both)', () => {
    expect(activeStage('not_started', true)).toBe('start')
    expect(activeStage('not_started', false)).toBe('start')
  })

  it('started → submit_review (with reviewer) / complete (without)', () => {
    expect(activeStage('started', true)).toBe('submit_review')
    expect(activeStage('started', false)).toBe('complete')
  })

  it('pending_review → submit_review (with reviewer) / null (without)', () => {
    expect(activeStage('pending_review', true)).toBe('submit_review')
    expect(activeStage('pending_review', false)).toBeNull()
  })

  it('approved → complete (with reviewer) / null (without)', () => {
    expect(activeStage('approved', true)).toBe('complete')
    expect(activeStage('approved', false)).toBeNull()
  })

  it('complete → complete (both)', () => {
    expect(activeStage('complete', true)).toBe('complete')
    expect(activeStage('complete', false)).toBe('complete')
  })

  it('wont_do → wont_do (both)', () => {
    expect(activeStage('wont_do', true)).toBe('wont_do')
    expect(activeStage('wont_do', false)).toBe('wont_do')
  })
})
```

- [ ] **Step 2: Verify failing**

```bash
cd /Users/guoyuzhu/Desktop/Real-Estate-Analysis/AlphaX_Hub
npm test -- lib/tasks/status-flow.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Write implementation**

```ts
// lib/tasks/status-flow.ts
import type { TaskStatus } from '@/db/schema'

export type FlowStage = 'start' | 'submit_review' | 'complete'

export function computeVisibleStages(hasReviewer: boolean): FlowStage[] {
  return hasReviewer
    ? ['start', 'submit_review', 'complete']
    : ['start', 'complete']
}

export function activeStage(
  status: TaskStatus,
  hasReviewer: boolean,
): FlowStage | 'wont_do' | null {
  if (status === 'wont_do') return 'wont_do'
  if (status === 'not_started') return 'start'
  if (status === 'complete') return 'complete'
  if (hasReviewer) {
    if (status === 'started' || status === 'pending_review') return 'submit_review'
    if (status === 'approved') return 'complete'
    return null
  } else {
    if (status === 'started') return 'complete'
    // pending_review / approved unreachable without a reviewer
    return null
  }
}
```

- [ ] **Step 4: Verify passing**

```bash
npm test -- lib/tasks/status-flow.test.ts
```
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git -C /Users/guoyuzhu/Desktop/Real-Estate-Analysis add \
  AlphaX_Hub/lib/tasks/status-flow.ts \
  AlphaX_Hub/lib/tasks/status-flow.test.ts
git -C /Users/guoyuzhu/Desktop/Real-Estate-Analysis commit -m "feat(tasks): status-flow pure helpers"
```

---

### Task 1.2: Refactor `drawer-status-stepper.tsx` to use shared helpers

**Files:**
- Modify: `components/project/drawer-status-stepper.tsx`

- [ ] **Step 1: Replace contents**

```tsx
// components/project/drawer-status-stepper.tsx
import type { TaskStatus } from '@/db/schema'
import { computeVisibleStages, type FlowStage } from '@/lib/tasks/status-flow'

const STAGE_LABEL: Record<FlowStage, string> = {
  start: 'Not started',
  submit_review: 'In review',
  complete: 'Complete',
}

// Drawer stepper uses the legacy 5-dot strip (Not started → Started → In review → Approved → Complete with reviewer)
// rather than the new 3-bucket model. Keep the legacy stages here; the shared FlowStage applies only to the
// new full-page widget. This refactor extracts the helper for the page widget without changing drawer behavior.
const LEGACY_STAGES_WITH_REVIEWER = [
  { id: 'not_started', label: 'Not started' },
  { id: 'started', label: 'Started' },
  { id: 'pending_review', label: 'In review' },
  { id: 'approved', label: 'Approved' },
  { id: 'complete', label: 'Complete' },
] as const

const LEGACY_STAGES_WITHOUT_REVIEWER = [
  { id: 'not_started', label: 'Not started' },
  { id: 'started', label: 'Started' },
  { id: 'complete', label: 'Complete' },
] as const

export function DrawerStatusStepper({
  status, hasReviewer,
}: { status: TaskStatus; hasReviewer: boolean }) {
  if (status === 'wont_do') {
    return <div className="rounded bg-zinc-100 text-zinc-700 text-xs px-2 py-1 text-center">Won&apos;t do</div>
  }

  const visibleStages = hasReviewer ? LEGACY_STAGES_WITH_REVIEWER : LEGACY_STAGES_WITHOUT_REVIEWER
  const currentIdx = visibleStages.findIndex(s => s.id === status)

  return (
    <div className="flex items-center text-[10px] text-zinc-500 gap-0">
      {visibleStages.map((s, i) => {
        const isPast = i < currentIdx
        const isCurrent = i === currentIdx
        const dotClass = isCurrent
          ? 'w-4 h-4 rounded-full border-2 border-blue-500 bg-white ring-2 ring-blue-100'
          : isPast
            ? 'w-3 h-3 rounded-full bg-emerald-500 border-2 border-emerald-500'
            : 'w-3 h-3 rounded-full border-2 border-zinc-300'
        return (
          <div key={s.id} className="flex-1 flex flex-col items-center">
            <div className="flex items-center w-full">
              {i > 0 && <div className={`flex-1 h-0.5 ${isPast || isCurrent ? 'bg-emerald-500' : 'bg-zinc-200'}`} />}
              <div className={dotClass} />
              {i < visibleStages.length - 1 && <div className={`flex-1 h-0.5 ${i < currentIdx ? 'bg-emerald-500' : 'bg-zinc-200'}`} />}
            </div>
            <div className={`mt-1 ${isCurrent ? 'text-blue-600 font-semibold' : ''}`}>{s.label}</div>
          </div>
        )
      })}
    </div>
  )
}

// Re-export so the legacy stepper's hasReviewer-derived stage count is visible to anyone importing.
export { computeVisibleStages, STAGE_LABEL }
```

Rationale: this refactor introduces the `computeVisibleStages` import for downstream sharing without changing the drawer's visible behavior — the drawer keeps its 5-dot UI by design. The full-page widget in Phase 4 uses the same helper but renders the 3-stage bucket model.

- [ ] **Step 2: Typecheck and run tests**

```bash
npm run typecheck
npm test
```
Expected: typecheck PASS, all tests PASS (no regressions).

- [ ] **Step 3: Commit**

```bash
git -C /Users/guoyuzhu/Desktop/Real-Estate-Analysis add AlphaX_Hub/components/project/drawer-status-stepper.tsx
git -C /Users/guoyuzhu/Desktop/Real-Estate-Analysis commit -m "refactor(drawer): import shared status-flow helper (no behavior change)"
```

---

## Phase 2 — New Server Action: `updateTaskMetadata`

### Task 2.1: Service method `taskService.updateMetadata`

**Files:**
- Modify: `lib/services/task-service.ts`
- Create: `lib/services/task-service.update-metadata.test.ts`

- [ ] **Step 1: Write the test first**

```ts
// lib/services/task-service.update-metadata.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { testDb, truncateAll } from '@/tests/db'
import { seedUser } from '@/tests/fixtures/users'
import { seedTemplate } from '@/tests/fixtures/workflow-templates'
import { taskService } from '@/lib/services/task-service'
import { projectService } from '@/lib/services/project-service'
import { tasks, activities } from '@/db/schema'
import { eq } from 'drizzle-orm'

async function seedProjectWithOneTask() {
  const owner = await seedUser({ role: 'owner' })
  const pm = await seedUser({ role: 'pm' })
  const tpl = await seedTemplate({
    createdById: owner.id, name: 'Permitting',
    tasks: [{ name: 'Survey', startDay: 1, endDay: 6 }],
    deps: [],
  })
  const project = await projectService.create({
    name: 'Test Project', brand: 'al_homes', pmId: pm.id,
    targetExitQuarter: '2026-Q4',
    workflows: { permitting: [tpl.template.id], construction: [], sale: [] },
    actorId: owner.id,
  }, testDb)
  const taskRows = await testDb.select().from(tasks).where(eq(tasks.projectId, project.id))
  return { owner, pm, project, task: taskRows[0] }
}

describe('taskService.updateMetadata', () => {
  beforeEach(truncateAll)

  it('updates name + writes activity row', async () => {
    const { task, owner } = await seedProjectWithOneTask()
    await taskService.updateMetadata({
      taskId: task.id, name: 'Survey + Title', actorId: owner.id,
    }, testDb)
    const [updated] = await testDb.select().from(tasks).where(eq(tasks.id, task.id))
    expect(updated.name).toBe('Survey + Title')
    const acts = await testDb.select().from(activities).where(eq(activities.projectId, task.projectId))
    expect(acts.some(a => a.type === 'task.metadata_updated')).toBe(true)
  })

  it('updates reviewerId', async () => {
    const { task, owner } = await seedProjectWithOneTask()
    const reviewer = await seedUser({ role: 'ic' })
    await taskService.updateMetadata({
      taskId: task.id, reviewerId: reviewer.id, actorId: owner.id,
    }, testDb)
    const [updated] = await testDb.select().from(tasks).where(eq(tasks.id, task.id))
    expect(updated.reviewerId).toBe(reviewer.id)
  })

  it('updates target dates', async () => {
    const { task, owner } = await seedProjectWithOneTask()
    await taskService.updateMetadata({
      taskId: task.id,
      targetStartDate: '2026-06-01',
      targetEndDate: '2026-06-10',
      actorId: owner.id,
    }, testDb)
    const [updated] = await testDb.select().from(tasks).where(eq(tasks.id, task.id))
    expect(updated.targetStartDate).toBe('2026-06-01')
    expect(updated.targetEndDate).toBe('2026-06-10')
  })

  it('only touches fields provided (partial update)', async () => {
    const { task, owner } = await seedProjectWithOneTask()
    const originalDescription = task.description
    await taskService.updateMetadata({ taskId: task.id, name: 'New Name', actorId: owner.id }, testDb)
    const [updated] = await testDb.select().from(tasks).where(eq(tasks.id, task.id))
    expect(updated.name).toBe('New Name')
    expect(updated.description).toBe(originalDescription)
  })

  it('clears reviewerId when reviewerId is null', async () => {
    const { task, owner } = await seedProjectWithOneTask()
    const reviewer = await seedUser({ role: 'ic' })
    await taskService.updateMetadata({ taskId: task.id, reviewerId: reviewer.id, actorId: owner.id }, testDb)
    await taskService.updateMetadata({ taskId: task.id, reviewerId: null, actorId: owner.id }, testDb)
    const [updated] = await testDb.select().from(tasks).where(eq(tasks.id, task.id))
    expect(updated.reviewerId).toBeNull()
  })

  it('throws on unknown taskId', async () => {
    const owner = await seedUser({ role: 'owner' })
    await expect(taskService.updateMetadata({
      taskId: '00000000-0000-0000-0000-000000000000',
      name: 'x', actorId: owner.id,
    }, testDb)).rejects.toThrow()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- lib/services/task-service.update-metadata.test.ts
```
Expected: FAIL — `taskService.updateMetadata` is not a function.

- [ ] **Step 3: Add the service method**

Edit `lib/services/task-service.ts`. Insert this method between `updateNotes` and `setPriority`:

```ts
  async updateMetadata(input: {
    taskId: string
    actorId: string
    name?: string
    description?: string | null
    reviewerId?: string | null
    targetStartDate?: string  // YYYY-MM-DD
    targetEndDate?: string    // YYYY-MM-DD
  }, db: DB) {
    return db.transaction(async (tx) => {
      const rows = await tx.select().from(tasks).where(eq(tasks.id, input.taskId))
      if (rows.length === 0) throw new NotFoundError('Task')
      const before = rows[0]

      const patch: Partial<typeof before> = { updatedAt: new Date() }
      const changes: Record<string, { from: unknown; to: unknown }> = {}

      if (input.name !== undefined && input.name !== before.name) {
        patch.name = input.name
        changes.name = { from: before.name, to: input.name }
      }
      if (input.description !== undefined && input.description !== before.description) {
        patch.description = input.description
        changes.description = { from: before.description, to: input.description }
      }
      if (input.reviewerId !== undefined && input.reviewerId !== before.reviewerId) {
        patch.reviewerId = input.reviewerId
        changes.reviewerId = { from: before.reviewerId, to: input.reviewerId }
      }
      if (input.targetStartDate !== undefined && input.targetStartDate !== before.targetStartDate) {
        patch.targetStartDate = input.targetStartDate
        changes.targetStartDate = { from: before.targetStartDate, to: input.targetStartDate }
      }
      if (input.targetEndDate !== undefined && input.targetEndDate !== before.targetEndDate) {
        patch.targetEndDate = input.targetEndDate
        changes.targetEndDate = { from: before.targetEndDate, to: input.targetEndDate }
      }

      if (Object.keys(changes).length === 0) return  // no-op

      await tx.update(tasks).set(patch).where(eq(tasks.id, before.id))

      if (before.projectId) {
        await tx.insert(activities).values({
          projectId: before.projectId,
          actorId: input.actorId,
          type: 'task.metadata_updated',
          payload: { taskId: before.id, changes },
        })
      }
    })
  },
```

- [ ] **Step 4: Verify**

```bash
npm test -- lib/services/task-service.update-metadata.test.ts
```
Expected: all 6 specs PASS.

- [ ] **Step 5: Commit**

```bash
git -C /Users/guoyuzhu/Desktop/Real-Estate-Analysis add \
  AlphaX_Hub/lib/services/task-service.ts \
  AlphaX_Hub/lib/services/task-service.update-metadata.test.ts
git -C /Users/guoyuzhu/Desktop/Real-Estate-Analysis commit -m "feat(tasks): taskService.updateMetadata partial-update method"
```

---

### Task 2.2: Server Action `updateTaskMetadata`

**Files:**
- Modify: `app/actions/tasks.ts`
- Create: `app/actions/tasks.update-metadata.test.ts`

- [ ] **Step 1: Write the test first**

```ts
// app/actions/tasks.update-metadata.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { truncateAll } from '@/tests/db'
import { seedUser } from '@/tests/fixtures/users'
import { seedTemplate } from '@/tests/fixtures/workflow-templates'
import { projectService } from '@/lib/services/project-service'
import { testDb } from '@/tests/db'
import { tasks } from '@/db/schema'
import { eq } from 'drizzle-orm'

// Mock the get-current-user module so requirePermission picks up our actor.
vi.mock('@/lib/server/get-current-user', () => ({
  requireUser: vi.fn(),
  getCurrentUser: vi.fn(),
}))

// Use the real db for the action by mocking the import.
vi.mock('@/db/client', async () => {
  const { testDb } = await import('@/tests/db')
  return { db: testDb }
})

import { updateTaskMetadata } from '@/app/actions/tasks'
import { requireUser, getCurrentUser } from '@/lib/server/get-current-user'

async function seed() {
  const owner = await seedUser({ role: 'owner' })
  const pm = await seedUser({ role: 'pm' })
  const ic = await seedUser({ role: 'ic' })
  const tpl = await seedTemplate({
    createdById: owner.id, name: 'Permitting',
    tasks: [{ name: 'Survey', startDay: 1, endDay: 6 }],
    deps: [],
  })
  const project = await projectService.create({
    name: 'P', brand: 'al_homes', pmId: pm.id,
    targetExitQuarter: '2026-Q4',
    workflows: { permitting: [tpl.template.id], construction: [], sale: [] },
    actorId: owner.id,
  }, testDb)
  const [task] = await testDb.select().from(tasks).where(eq(tasks.projectId, project.id))
  return { owner, pm, ic, project, task }
}

describe('updateTaskMetadata action', () => {
  beforeEach(async () => {
    await truncateAll()
    vi.mocked(requireUser).mockReset()
    vi.mocked(getCurrentUser).mockReset()
  })

  it('PM can update task metadata', async () => {
    const { pm, task } = await seed()
    vi.mocked(requireUser).mockResolvedValue(pm as never)
    vi.mocked(getCurrentUser).mockResolvedValue(pm as never)
    await updateTaskMetadata({ taskId: task.id, name: 'Updated Name' })
    const [updated] = await testDb.select().from(tasks).where(eq(tasks.id, task.id))
    expect(updated.name).toBe('Updated Name')
  })

  it('IC (non-owner, non-PM) cannot update metadata', async () => {
    const { ic, task } = await seed()
    vi.mocked(requireUser).mockResolvedValue(ic as never)
    vi.mocked(getCurrentUser).mockResolvedValue(ic as never)
    await expect(updateTaskMetadata({ taskId: task.id, name: 'x' })).rejects.toThrow()
  })

  it('rejects targetEndDate < targetStartDate', async () => {
    const { pm, task } = await seed()
    vi.mocked(requireUser).mockResolvedValue(pm as never)
    vi.mocked(getCurrentUser).mockResolvedValue(pm as never)
    await expect(updateTaskMetadata({
      taskId: task.id, targetStartDate: '2026-06-10', targetEndDate: '2026-06-05',
    })).rejects.toThrow()
  })

  it('rejects empty name', async () => {
    const { pm, task } = await seed()
    vi.mocked(requireUser).mockResolvedValue(pm as never)
    vi.mocked(getCurrentUser).mockResolvedValue(pm as never)
    await expect(updateTaskMetadata({ taskId: task.id, name: '' })).rejects.toThrow()
  })
})
```

- [ ] **Step 2: Run test, expect fail**

```bash
npm test -- app/actions/tasks.update-metadata.test.ts
```
Expected: FAIL — `updateTaskMetadata` is not exported.

- [ ] **Step 3: Add the action**

Append to `app/actions/tasks.ts`:

```ts
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

- [ ] **Step 4: Verify**

```bash
npm test -- app/actions/tasks.update-metadata.test.ts
```
Expected: 4 specs PASS.

- [ ] **Step 5: Commit**

```bash
git -C /Users/guoyuzhu/Desktop/Real-Estate-Analysis add \
  AlphaX_Hub/app/actions/tasks.ts \
  AlphaX_Hub/app/actions/tasks.update-metadata.test.ts
git -C /Users/guoyuzhu/Desktop/Real-Estate-Analysis commit -m "feat(tasks): updateTaskMetadata Server Action"
```

---

## Phase 3 — Denormalized read query

### Task 3.1: `getTaskDetail` + tests

**Files:**
- Create: `db/queries/task-detail.ts`
- Create: `db/queries/task-detail.test.ts`

- [ ] **Step 1: Write the test**

```ts
// db/queries/task-detail.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { testDb, truncateAll } from '@/tests/db'
import { seedUser } from '@/tests/fixtures/users'
import { seedTemplate } from '@/tests/fixtures/workflow-templates'
import { projectService } from '@/lib/services/project-service'
import { taskService } from '@/lib/services/task-service'
import { getTaskDetail } from './task-detail'
import { tasks } from '@/db/schema'
import { eq } from 'drizzle-orm'

async function seedProjectWithTasks() {
  const owner = await seedUser({ role: 'owner' })
  const pm = await seedUser({ role: 'pm' })
  const reviewer = await seedUser({ role: 'ic' })
  const tpl = await seedTemplate({
    createdById: owner.id, name: 'Permitting',
    tasks: [
      { name: 'Survey', startDay: 1, endDay: 6 },
      { name: 'Apply',  startDay: 6, endDay: 16 },
    ],
    deps: [{ fromIdx: 0, toIdx: 1 }],
  })
  const project = await projectService.create({
    name: 'P', brand: 'al_homes', pmId: pm.id,
    targetExitQuarter: '2026-Q4',
    workflows: { permitting: [tpl.template.id], construction: [], sale: [] },
    actorId: owner.id,
  }, testDb)
  const rows = await testDb.select().from(tasks).where(eq(tasks.projectId, project.id))
    .orderBy(tasks.sortOrder)
  return { owner, pm, reviewer, project, tasksList: rows }
}

describe('getTaskDetail', () => {
  beforeEach(truncateAll)

  it('returns null for unknown taskId', async () => {
    const res = await getTaskDetail('00000000-0000-0000-0000-000000000000', testDb)
    expect(res).toBeNull()
  })

  it('returns denormalized shape for a real task', async () => {
    const { tasksList, owner } = await seedProjectWithTasks()
    const surveyTask = tasksList.find(t => t.name === 'Survey')!
    const detail = await getTaskDetail(surveyTask.id, testDb)
    expect(detail).not.toBeNull()
    expect(detail!.task.id).toBe(surveyTask.id)
    expect(detail!.project.id).toBe(surveyTask.projectId)
    expect(detail!.workflow.id).toBe(surveyTask.projectWorkflowId)
    expect(detail!.owner.id).toBeDefined()
    expect(detail!.reviewer).toBeNull()
    expect(detail!.parent).toBeNull()
    expect(detail!.upstreamDeps).toEqual([])
    expect(detail!.subtasks).toEqual([])
    expect(detail!.comments).toEqual([])
    expect(detail!.activity.length).toBeGreaterThan(0)
    expect(detail!.prevTaskId).toBeNull()
    expect(detail!.nextTaskId).toBe(tasksList.find(t => t.name === 'Apply')!.id)
  })

  it('resolves upstream deps with names', async () => {
    const { tasksList } = await seedProjectWithTasks()
    const applyTask = tasksList.find(t => t.name === 'Apply')!
    const detail = await getTaskDetail(applyTask.id, testDb)
    expect(detail!.upstreamDeps.map(d => d.name)).toEqual(['Survey'])
    expect(detail!.prevTaskId).toBe(tasksList.find(t => t.name === 'Survey')!.id)
    expect(detail!.nextTaskId).toBeNull()
  })

  it('returns subtasks with assignee name + status', async () => {
    const { tasksList, owner } = await seedProjectWithTasks()
    const parent = tasksList.find(t => t.name === 'Survey')!
    const sub = await taskService.addSubtask({
      parentTaskId: parent.id, name: 'Review business reqs',
      ownerId: owner.id, actorId: owner.id,
    }, testDb)

    const detail = await getTaskDetail(parent.id, testDb)
    expect(detail!.subtasks).toHaveLength(1)
    expect(detail!.subtasks[0].id).toBe(sub.id)
    expect(detail!.subtasks[0].ownerName).toBeDefined()
    expect(detail!.subtasks[0].status).toBe('not_started')
  })

  it('excludes subtasks from prev/next sibling chain', async () => {
    const { tasksList, owner } = await seedProjectWithTasks()
    const survey = tasksList.find(t => t.name === 'Survey')!
    const apply  = tasksList.find(t => t.name === 'Apply')!
    await taskService.addSubtask({
      parentTaskId: survey.id, name: 'A child',
      ownerId: owner.id, actorId: owner.id,
    }, testDb)
    const detailSurvey = await getTaskDetail(survey.id, testDb)
    expect(detailSurvey!.nextTaskId).toBe(apply.id)  // skipped subtask
  })

  it("subtask's own prev/next are null", async () => {
    const { tasksList, owner } = await seedProjectWithTasks()
    const parent = tasksList.find(t => t.name === 'Survey')!
    const sub = await taskService.addSubtask({
      parentTaskId: parent.id, name: 'Subby',
      ownerId: owner.id, actorId: owner.id,
    }, testDb)
    const detail = await getTaskDetail(sub.id, testDb)
    expect(detail!.prevTaskId).toBeNull()
    expect(detail!.nextTaskId).toBeNull()
    expect(detail!.parent?.id).toBe(parent.id)
  })
})
```

- [ ] **Step 2: Verify failing**

```bash
npm test -- db/queries/task-detail.test.ts
```
Expected: FAIL — `getTaskDetail` not exported.

- [ ] **Step 3: Write the query**

```ts
// db/queries/task-detail.ts
import { eq, and, isNull, asc, desc } from 'drizzle-orm'
import type { DB } from '@/db/client'
import {
  tasks, projects, projectWorkflows, users, taskDeps, taskComments, activities,
  type TaskStatus, type TaskPriority,
} from '@/db/schema'

export type TaskDetailSubtask = {
  id: string
  name: string
  ownerId: string
  ownerName: string
  status: TaskStatus
}

export type TaskDetailComment = {
  id: string
  body: string
  kind: 'discussion' | 'review_request' | 'review_approve' | 'review_revision'
  authorId: string
  authorName: string
  createdAt: Date
}

export type TaskDetailActivity = {
  id: string
  kind: string
  payload: unknown
  actorId: string
  actorName: string
  createdAt: Date
}

export type TaskDetail = {
  task: typeof tasks.$inferSelect
  project: {
    id: string
    name: string
    brand: string
    status: string
    pmId: string
    kickedOffAt: Date | null
  }
  workflow: {
    id: string
    name: string
    projectPhaseId: string
  }
  owner: { id: string; name: string; larkOpenId: string | null; avatarUrl: string | null }
  reviewer: { id: string; name: string; larkOpenId: string | null; avatarUrl: string | null } | null
  parent: { id: string; name: string } | null
  upstreamDeps: Array<{ id: string; name: string }>
  subtasks: TaskDetailSubtask[]
  comments: TaskDetailComment[]
  activity: TaskDetailActivity[]
  prevTaskId: string | null
  nextTaskId: string | null
}

export async function getTaskDetail(
  taskId: string,
  db: DB,
): Promise<TaskDetail | null> {
  const taskRows = await db.select().from(tasks).where(eq(tasks.id, taskId))
  if (taskRows.length === 0) return null
  const task = taskRows[0]

  if (!task.projectId) {
    // Personal task (no project) — supported in the schema but not by this page.
    // Return minimal shape so caller can render an error / not-found.
    return null
  }

  const [
    projRows, wfRows, ownerRows, reviewerRows, parentRows,
    upstreamDepRows, subtaskRows, commentRows, activityRows,
    siblingRows,
  ] = await Promise.all([
    db.select().from(projects).where(eq(projects.id, task.projectId)),
    db.select().from(projectWorkflows).where(eq(projectWorkflows.id, task.projectWorkflowId!)),
    db.select().from(users).where(eq(users.id, task.ownerId)),
    task.reviewerId
      ? db.select().from(users).where(eq(users.id, task.reviewerId))
      : Promise.resolve([]),
    task.parentTaskId
      ? db.select({ id: tasks.id, name: tasks.name })
          .from(tasks).where(eq(tasks.id, task.parentTaskId))
      : Promise.resolve([]),
    db.select({
        id: tasks.id,
        name: tasks.name,
      })
      .from(taskDeps)
      .innerJoin(tasks, eq(tasks.id, taskDeps.fromTaskId))
      .where(eq(taskDeps.toTaskId, task.id)),
    db.select({
        id: tasks.id, name: tasks.name, ownerId: tasks.ownerId, status: tasks.status,
        ownerName: users.name,
      })
      .from(tasks).innerJoin(users, eq(users.id, tasks.ownerId))
      .where(eq(tasks.parentTaskId, task.id))
      .orderBy(asc(tasks.sortOrder)),
    db.select({
        id: taskComments.id, body: taskComments.body, kind: taskComments.kind,
        authorId: taskComments.authorId, createdAt: taskComments.createdAt,
        authorName: users.name,
      })
      .from(taskComments).innerJoin(users, eq(users.id, taskComments.authorId))
      .where(eq(taskComments.taskId, task.id))
      .orderBy(asc(taskComments.createdAt)),
    db.select({
        id: activities.id, kind: activities.type, payload: activities.payload,
        actorId: activities.actorId, createdAt: activities.createdAt,
        actorName: users.name,
      })
      .from(activities).innerJoin(users, eq(users.id, activities.actorId))
      .where(eq(activities.projectId, task.projectId))
      .orderBy(desc(activities.createdAt))
      .limit(50),
    // Top-level sibling task IDs in this project, sortOrder asc, for prev/next.
    task.parentTaskId
      ? Promise.resolve([])  // subtasks have no siblings in this nav
      : db.select({ id: tasks.id, sortOrder: tasks.sortOrder, createdAt: tasks.createdAt })
          .from(tasks)
          .where(and(eq(tasks.projectId, task.projectId), isNull(tasks.parentTaskId)))
          .orderBy(asc(tasks.sortOrder), asc(tasks.createdAt)),
  ])

  if (projRows.length === 0 || wfRows.length === 0 || ownerRows.length === 0) {
    return null
  }

  const proj = projRows[0]
  const wf = wfRows[0]
  const owner = ownerRows[0]
  const reviewer = reviewerRows[0] ?? null
  const parent = parentRows[0] ?? null

  // Filter activity by payload.taskId === task.id (cheaper than SQL JSON predicate).
  const taskActivity = activityRows
    .filter(a => {
      const p = a.payload as Record<string, unknown> | null
      return p && (p.taskId === task.id || p.subtaskId === task.id || p.parentTaskId === task.id)
    })
    .slice(0, 20)

  let prevTaskId: string | null = null
  let nextTaskId: string | null = null
  if (siblingRows.length > 0) {
    const idx = siblingRows.findIndex(r => r.id === task.id)
    if (idx > 0) prevTaskId = siblingRows[idx - 1].id
    if (idx >= 0 && idx < siblingRows.length - 1) nextTaskId = siblingRows[idx + 1].id
  }

  return {
    task,
    project: {
      id: proj.id, name: proj.name, brand: proj.brand,
      status: proj.status, pmId: proj.pmId, kickedOffAt: proj.kickedOffAt,
    },
    workflow: { id: wf.id, name: wf.name, projectPhaseId: wf.projectPhaseId },
    owner: { id: owner.id, name: owner.name, larkOpenId: owner.larkOpenId, avatarUrl: owner.avatarUrl ?? null },
    reviewer: reviewer
      ? { id: reviewer.id, name: reviewer.name, larkOpenId: reviewer.larkOpenId, avatarUrl: reviewer.avatarUrl ?? null }
      : null,
    parent,
    upstreamDeps: upstreamDepRows,
    subtasks: subtaskRows,
    comments: commentRows.map(c => ({
      id: c.id, body: c.body, kind: c.kind, authorId: c.authorId,
      authorName: c.authorName, createdAt: c.createdAt,
    })),
    activity: taskActivity.map(a => ({
      id: a.id, kind: a.kind, payload: a.payload, actorId: a.actorId,
      actorName: a.actorName, createdAt: a.createdAt,
    })),
    prevTaskId,
    nextTaskId,
  }
}
```

Note: column names like `larkOpenId`, `avatarUrl` must match the actual `users` schema. If your `users` table uses different names (e.g., `lark_open_id` mapped to `larkOpenId` in Drizzle), keep them; if avatar isn't stored, just default to `null`.

- [ ] **Step 4: Verify**

```bash
npm test -- db/queries/task-detail.test.ts
```
Expected: all 6 specs PASS.

If a test fails because the users schema doesn't have a field assumed above (e.g., `avatarUrl`), open `db/schema/users.ts` and adjust the `getTaskDetail` selection accordingly — keep the returned shape stable.

- [ ] **Step 5: Commit**

```bash
git -C /Users/guoyuzhu/Desktop/Real-Estate-Analysis add \
  AlphaX_Hub/db/queries/task-detail.ts \
  AlphaX_Hub/db/queries/task-detail.test.ts
git -C /Users/guoyuzhu/Desktop/Real-Estate-Analysis commit -m "feat(db): getTaskDetail denormalized read with prev/next"
```

---

## Phase 4 — Page route + skeleton + error boundary

### Task 4.1: Route, loading, error

**Files:**
- Create: `app/(app)/tasks/[taskId]/page.tsx`
- Create: `app/(app)/tasks/[taskId]/loading.tsx`
- Create: `app/(app)/tasks/[taskId]/error.tsx`

- [ ] **Step 1: Write `page.tsx`**

```tsx
// app/(app)/tasks/[taskId]/page.tsx
import { notFound } from 'next/navigation'
import { requireUser } from '@/lib/server/get-current-user'
import { db } from '@/db/client'
import { getTaskDetail } from '@/db/queries/task-detail'
import { TaskDetailScreen } from '@/components/tasks/task-detail-screen'

export default async function TaskDetailPage({
  params,
}: { params: { taskId: string } }) {
  const me = await requireUser()
  const detail = await getTaskDetail(params.taskId, db)
  if (!detail) notFound()
  return <TaskDetailScreen me={me} detail={detail} />
}
```

- [ ] **Step 2: Write `loading.tsx`**

```tsx
// app/(app)/tasks/[taskId]/loading.tsx
export default function Loading() {
  return (
    <div className="p-6 space-y-4">
      <div className="h-6 w-32 bg-surface-container-low rounded animate-pulse" />
      <div className="h-10 w-2/3 bg-surface-container-low rounded animate-pulse" />
      <div className="glacier-panel rounded-xl h-32 animate-pulse" />
      <div className="glacier-panel rounded-xl h-64 animate-pulse" />
      <div className="glacier-panel rounded-xl h-48 animate-pulse" />
      <div className="glacier-panel rounded-xl h-40 animate-pulse" />
    </div>
  )
}
```

- [ ] **Step 3: Write `error.tsx`**

```tsx
// app/(app)/tasks/[taskId]/error.tsx
'use client'
export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="p-6">
      <h1 className="font-headline-md text-on-background">Something went wrong</h1>
      <p className="mt-2 text-body-sm text-body-muted">{error.message}</p>
      <button
        onClick={reset}
        className="mt-4 px-4 py-2 rounded-lg bg-primary text-on-primary font-body-sm"
      >
        Try again
      </button>
    </div>
  )
}
```

- [ ] **Step 4: Typecheck**

```bash
cd /Users/guoyuzhu/Desktop/Real-Estate-Analysis/AlphaX_Hub
npm run typecheck
```
Expected: typecheck fails because `TaskDetailScreen` doesn't exist yet. That's fine — Phase 4.10 creates it. **DO NOT COMMIT YET** — hold until Task 4.10.

---

### Task 4.2: `page-nav.tsx` — back link + prev/next

**Files:**
- Create: `components/tasks/page-nav.tsx`

- [ ] **Step 1: Write**

```tsx
// components/tasks/page-nav.tsx
'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'

type Props = {
  projectId: string
  prevTaskId: string | null
  nextTaskId: string | null
}

export function PageNav({ projectId, prevTaskId, nextTaskId }: Props) {
  const [backHref, setBackHref] = useState<string>('/my-tasks')
  const [backLabel, setBackLabel] = useState<string>('Back to My Tasks')

  useEffect(() => {
    const ref = typeof document !== 'undefined' ? document.referrer : ''
    if (!ref || !ref.includes('/my-tasks')) {
      setBackHref(`/projects/${projectId}`)
      setBackLabel('Back to Project')
    }
  }, [projectId])

  return (
    <div className="flex items-center justify-between mb-6">
      <Link
        href={backHref}
        className="inline-flex items-center gap-2 text-body-sm text-on-surface-variant hover:text-on-background"
      >
        <span className="material-symbols-outlined text-[20px]">arrow_back</span>
        {backLabel}
      </Link>

      <div className="flex items-center gap-2 text-body-sm">
        {prevTaskId ? (
          <Link
            href={`/tasks/${prevTaskId}`}
            className="inline-flex items-center gap-1 text-on-surface-variant hover:text-on-background"
          >
            <span className="material-symbols-outlined text-[20px]">chevron_left</span>
            Previous
          </Link>
        ) : (
          <span className="inline-flex items-center gap-1 text-outline" aria-disabled>
            <span className="material-symbols-outlined text-[20px]">chevron_left</span>
            Previous
          </span>
        )}

        <span className="text-outline">|</span>

        {nextTaskId ? (
          <Link
            href={`/tasks/${nextTaskId}`}
            className="inline-flex items-center gap-1 text-on-surface-variant hover:text-on-background"
          >
            Next
            <span className="material-symbols-outlined text-[20px]">chevron_right</span>
          </Link>
        ) : (
          <span className="inline-flex items-center gap-1 text-outline" aria-disabled>
            Next
            <span className="material-symbols-outlined text-[20px]">chevron_right</span>
          </span>
        )}
      </div>
    </div>
  )
}
```

Hold the commit; Phase 4 commits as one batch in Task 4.10.

---

### Task 4.3: `top-actions.tsx` — title + health + Edit/Delete/Won't do

**Files:**
- Create: `components/tasks/top-actions.tsx`

- [ ] **Step 1: Write**

```tsx
// components/tasks/top-actions.tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { setTaskStatus, deleteTaskInDraft } from '@/app/actions/tasks'
import type { TaskDetail } from '@/db/queries/task-detail'
import { EditTaskMetadataDialog } from './edit-task-metadata-dialog'

type Role = 'owner' | 'pm' | 'ic'

function healthLevel(targetEndDate: string | null, status: string): 'overdue' | 'on_track' {
  if (status === 'complete' || status === 'wont_do') return 'on_track'
  if (!targetEndDate) return 'on_track'
  const today = new Date().toISOString().slice(0, 10)
  return targetEndDate < today ? 'overdue' : 'on_track'
}

export function TopActions({ detail, me }: {
  detail: TaskDetail
  me: { id: string; role: Role }
}) {
  const router = useRouter()
  const [editOpen, setEditOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const { task, project } = detail
  const canUpdateStructure =
    me.role === 'owner' || (me.role === 'pm' && project.pmId === me.id)
  const canSetStatus =
    canUpdateStructure || task.ownerId === me.id
  const isDraft = project.status === 'draft'
  const canDelete = canUpdateStructure && isDraft
  const canWontDo =
    canSetStatus && task.status !== 'wont_do' && task.status !== 'complete'

  const health = healthLevel(task.targetEndDate, task.status)

  async function onDelete() {
    if (!window.confirm('Delete this task? This cannot be undone.')) return
    setBusy(true)
    setErr(null)
    try {
      await deleteTaskInDraft({ taskId: task.id })
      router.push(`/projects/${project.id}`)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Delete failed')
    } finally {
      setBusy(false)
    }
  }

  async function onWontDo() {
    if (!window.confirm("Mark this task as won't do?")) return
    setBusy(true)
    setErr(null)
    try {
      await setTaskStatus({ taskId: task.id, status: 'wont_do' })
      router.refresh()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Update failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex items-start justify-between gap-6 mb-6">
      <div className="min-w-0">
        <h1 className="font-headline-lg text-on-background break-words">{task.name}</h1>
        <div className="mt-2 flex items-center gap-4 text-body-sm">
          {task.status === 'wont_do' ? (
            <span className="inline-flex items-center gap-2 text-body-muted">
              <span className="w-3 h-3 rounded-full bg-surface-container-highest" />
              Won&apos;t do
            </span>
          ) : (
            <>
              {health === 'overdue' ? (
                <span className="inline-flex items-center gap-2 text-error">
                  <span className="w-3 h-3 rounded-full bg-error" />
                  Overdue
                </span>
              ) : (
                <span className="inline-flex items-center gap-2 text-secondary">
                  <span className="w-3 h-3 rounded-full bg-secondary" />
                  On track
                </span>
              )}
              {task.isOnCriticalPath && (
                <span className="inline-flex items-center gap-2 text-error">
                  <span className="w-3 h-3 rounded-full bg-error" />
                  On critical path
                </span>
              )}
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {canUpdateStructure && (
          <button
            onClick={() => setEditOpen(true)}
            className="inline-flex items-center gap-2 h-9 px-3 rounded-lg border border-outline-variant bg-white text-body-sm font-medium text-on-surface-variant hover:text-primary hover:border-primary"
          >
            <span className="material-symbols-outlined text-[18px]">edit</span>
            Edit
          </button>
        )}
        {canDelete && (
          <button
            onClick={onDelete}
            disabled={busy}
            className="inline-flex items-center gap-2 h-9 px-3 rounded-lg border border-outline-variant bg-white text-body-sm font-medium text-error hover:border-error disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[18px]">delete</span>
            Delete
          </button>
        )}
        {canWontDo && (
          <button
            onClick={onWontDo}
            disabled={busy}
            className="inline-flex items-center gap-2 h-9 px-3 rounded-lg border border-outline-variant bg-white text-body-sm font-medium text-on-surface-variant hover:text-primary hover:border-primary disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[18px]">block</span>
            Won&apos;t do
          </button>
        )}
      </div>

      {err && (
        <div className="absolute mt-16 text-error text-body-sm">{err}</div>
      )}

      {editOpen && (
        <EditTaskMetadataDialog
          detail={detail}
          onClose={() => setEditOpen(false)}
        />
      )}
    </div>
  )
}
```

---

### Task 4.4: `summary-section.tsx`

**Files:**
- Create: `components/tasks/summary-section.tsx`

- [ ] **Step 1: Write**

```tsx
// components/tasks/summary-section.tsx
'use client'
import Link from 'next/link'
import { useState } from 'react'
import { setTaskStatus, setTaskPriority } from '@/app/actions/tasks'
import type { TaskDetail } from '@/db/queries/task-detail'
import { Avatar } from '@/components/shared/avatar'

const STATUS_LABEL: Record<string, string> = {
  not_started: 'Not started',
  started: 'In progress',
  pending_review: 'Submitted',
  approved: 'Approved',
  complete: 'Completed',
  wont_do: "Won't do",
}

const PRIORITY_LABEL: Record<string, string> = {
  high: 'High', normal: 'Normal', low: 'Low',
}

function fmtDate(d: string | null): string {
  if (!d) return '—'
  const [y, m, day] = d.split('-')
  const dt = new Date(Number(y), Number(m) - 1, Number(day))
  return dt.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

export function SummarySection({ detail, me }: {
  detail: TaskDetail
  me: { id: string; role: 'owner' | 'pm' | 'ic' }
}) {
  const { task, project, workflow, owner, reviewer } = detail
  const canSetStatus =
    me.role === 'owner' ||
    (me.role === 'pm' && project.pmId === me.id) ||
    task.ownerId === me.id ||
    task.reviewerId === me.id
  const canSetPriority = canSetStatus
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function changeStatus(next: string) {
    if (next === task.status) return
    setBusy(true); setErr(null)
    try {
      await setTaskStatus({ taskId: task.id, status: next })
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Update failed')
    } finally { setBusy(false) }
  }

  async function changePriority(next: string) {
    if (next === task.priority) return
    setBusy(true); setErr(null)
    try {
      await setTaskPriority({ taskId: task.id, priority: next })
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Update failed')
    } finally { setBusy(false) }
  }

  return (
    <section className="glacier-panel rounded-xl mb-4">
      <h2 className="px-5 pt-5 font-headline-md text-on-background">1. Summary</h2>
      <div className="px-5 pb-6 pt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-5">
        <Field label="Project">
          <Link
            href={`/projects/${project.id}`}
            className="inline-flex items-center gap-2 text-tertiary hover:underline font-body-sm font-semibold"
          >
            <span className="material-symbols-outlined text-[18px]">folder_open</span>
            {project.name}
          </Link>
        </Field>

        <Field label="Owner">
          <div className="flex items-center gap-2">
            <Avatar user={{ id: owner.id, name: owner.name }} size="sm" />
            <span className="font-body-md font-semibold text-on-background">{owner.name}</span>
          </div>
        </Field>

        <Field label="Reviewer">
          {reviewer ? (
            <div className="flex items-center gap-2">
              <Avatar user={{ id: reviewer.id, name: reviewer.name }} size="sm" />
              <span className="font-body-md font-semibold text-on-background">{reviewer.name}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-body-muted">
              <span className="w-7 h-7 rounded-full bg-surface-container-low" />
              <span>—</span>
            </div>
          )}
        </Field>

        <Field label="Due date">
          <span className="inline-flex items-center gap-2 font-body-sm font-semibold text-on-background">
            <span className="material-symbols-outlined text-[18px] text-body-muted">calendar_today</span>
            {fmtDate(task.targetEndDate)}
          </span>
        </Field>

        <Field label="Priority">
          <select
            value={task.priority}
            disabled={!canSetPriority || busy}
            onChange={(e) => changePriority(e.target.value)}
            className="glacier-select h-10 min-w-[140px] rounded-lg border border-outline-variant bg-white px-3 font-body-sm font-semibold text-on-surface-variant disabled:opacity-50 focus:border-primary focus:outline-none"
          >
            {Object.entries(PRIORITY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>

        <Field label="Status">
          <select
            value={task.status}
            disabled={!canSetStatus || busy}
            onChange={(e) => changeStatus(e.target.value)}
            className="glacier-select h-10 min-w-[150px] rounded-lg border border-outline-variant bg-white px-3 font-body-sm font-semibold text-on-surface-variant disabled:opacity-50 focus:border-primary focus:outline-none"
          >
            {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
      </div>
      {err && <div className="px-5 pb-3 text-error text-body-sm">{err}</div>}
    </section>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="font-label-caps text-body-muted mb-2">{label}</div>
      <div className="min-h-9 flex items-center">{children}</div>
    </div>
  )
}
```

---

### Task 4.5: `status-flow.tsx` widget

**Files:**
- Create: `components/tasks/status-flow.tsx`

- [ ] **Step 1: Write**

```tsx
// components/tasks/status-flow.tsx
'use client'
import { useState } from 'react'
import {
  setTaskStatus, submitTaskForReview, approveTask, requestTaskRevision,
} from '@/app/actions/tasks'
import { computeVisibleStages, activeStage, type FlowStage } from '@/lib/tasks/status-flow'
import type { TaskDetail } from '@/db/queries/task-detail'

const STAGE_LABEL: Record<FlowStage, { name: string; sub: string }> = {
  start: { name: 'Start', sub: 'Not started' },
  submit_review: { name: 'Submit to review', sub: 'In progress' },
  complete: { name: 'Complete', sub: 'Completed' },
}

const STAGE_ICON: Record<FlowStage, string> = {
  start: 'play_arrow',
  submit_review: 'radio_button_unchecked',
  complete: 'check_circle',
}

export function StatusFlow({ detail, me }: {
  detail: TaskDetail
  me: { id: string; role: 'owner' | 'pm' | 'ic' }
}) {
  const { task, project, reviewer } = detail
  const hasReviewer = reviewer !== null
  const visible = computeVisibleStages(hasReviewer)
  const current = activeStage(task.status, hasReviewer)

  const isOwner = task.ownerId === me.id
  const isReviewer = task.reviewerId === me.id
  const isPmOrOwner =
    me.role === 'owner' || (me.role === 'pm' && project.pmId === me.id)
  const canSetStatus = isOwner || isPmOrOwner

  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [reviseOpen, setReviseOpen] = useState(false)
  const [reviseBody, setReviseBody] = useState('')

  if (current === 'wont_do') {
    return (
      <div className="glacier-panel rounded-xl p-4 mb-5">
        <div className="font-label-caps text-body-muted mb-2">Update status</div>
        <div className="bg-surface-container-low rounded-lg px-4 py-3 text-body-sm text-on-surface-variant">
          Won&apos;t do
        </div>
      </div>
    )
  }

  async function act(fn: () => Promise<unknown>) {
    setBusy(true); setErr(null)
    try { await fn() } catch (e) {
      setErr(e instanceof Error ? e.message : 'Action failed')
    } finally { setBusy(false) }
  }

  function renderButton(stage: FlowStage) {
    const isCurrent = stage === current
    if (!isCurrent) return null

    // Reviewer perspective when waiting for review.
    if (stage === 'submit_review' && task.status === 'pending_review') {
      if (isReviewer || isPmOrOwner) {
        return (
          <div className="flex items-center gap-2 mt-2">
            <button
              disabled={busy}
              onClick={() => act(() => approveTask({ taskId: task.id }))}
              className="px-3 h-8 rounded-lg bg-primary text-on-primary font-body-sm font-semibold disabled:opacity-50"
            >
              Approve
            </button>
            <button
              disabled={busy}
              onClick={() => setReviseOpen(true)}
              className="px-3 h-8 rounded-lg border border-outline-variant text-body-sm font-semibold text-on-surface-variant hover:border-primary disabled:opacity-50"
            >
              Request revision
            </button>
          </div>
        )
      }
      return (
        <span className="mt-2 inline-block text-body-sm text-body-muted">Awaiting review</span>
      )
    }

    // Owner perspective: action depends on current status & visible stage.
    if (stage === 'start' && task.status === 'not_started' && canSetStatus) {
      return (
        <button
          disabled={busy}
          onClick={() => act(() => setTaskStatus({ taskId: task.id, status: 'started' }))}
          className="mt-2 px-3 h-8 rounded-lg bg-primary text-on-primary font-body-sm font-semibold disabled:opacity-50"
        >
          Start
        </button>
      )
    }
    if (stage === 'submit_review' && task.status === 'started' && canSetStatus) {
      return (
        <button
          disabled={busy}
          onClick={() => act(() => submitTaskForReview({ taskId: task.id }))}
          className="mt-2 px-3 h-8 rounded-lg bg-primary text-on-primary font-body-sm font-semibold disabled:opacity-50"
        >
          Submit to review
        </button>
      )
    }
    if (stage === 'complete' && canSetStatus) {
      if (task.status === 'approved' || (!hasReviewer && task.status === 'started')) {
        return (
          <button
            disabled={busy}
            onClick={() => act(() => setTaskStatus({ taskId: task.id, status: 'complete' }))}
            className="mt-2 px-3 h-8 rounded-lg bg-primary text-on-primary font-body-sm font-semibold disabled:opacity-50"
          >
            Complete
          </button>
        )
      }
    }
    return null
  }

  return (
    <div className="glacier-panel rounded-xl p-4 mb-5">
      <div className="font-label-caps text-body-muted mb-3">Update status</div>
      <div className="grid items-center gap-2"
           style={{ gridTemplateColumns: visible.length === 3 ? '1fr 32px 1fr 32px 1fr' : '1fr 32px 1fr' }}>
        {visible.map((stage, i) => {
          const isActive = stage === current
          const idx = visible.indexOf(current as FlowStage)
          const isPast = idx >= 0 && i < idx
          return (
            <div key={stage} className="contents">
              <div className="flex items-center gap-3">
                <div className={
                  'w-9 h-9 rounded-full grid place-items-center border-2 ' +
                  (isActive
                    ? 'border-tertiary text-tertiary ring-4 ring-tertiary/15 bg-white'
                    : isPast
                      ? 'border-secondary bg-secondary text-on-secondary'
                      : 'border-outline-variant bg-white text-body-muted')
                }>
                  <span className="material-symbols-outlined text-[18px]">{STAGE_ICON[stage]}</span>
                </div>
                <div>
                  <div className="font-body-sm font-semibold text-on-background">{STAGE_LABEL[stage].name}</div>
                  <div className="text-body-muted text-[11px]">{STAGE_LABEL[stage].sub}</div>
                  {renderButton(stage)}
                </div>
              </div>
              {i < visible.length - 1 && (
                <span className="material-symbols-outlined text-outline text-[22px] text-center">
                  chevron_right
                </span>
              )}
            </div>
          )
        })}
      </div>
      {err && <div className="text-error text-body-sm mt-3">{err}</div>}

      {reviseOpen && (
        <ReviseDialog
          busy={busy}
          body={reviseBody}
          onBodyChange={setReviseBody}
          onCancel={() => { setReviseOpen(false); setReviseBody('') }}
          onSubmit={async () => {
            if (!reviseBody.trim()) { setErr('Please enter a revision note.'); return }
            await act(() => requestTaskRevision({ taskId: task.id, body: reviseBody }))
            setReviseOpen(false); setReviseBody('')
          }}
        />
      )}
    </div>
  )
}

function ReviseDialog({
  busy, body, onBodyChange, onCancel, onSubmit,
}: {
  busy: boolean; body: string; onBodyChange: (v: string) => void
  onCancel: () => void; onSubmit: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/30">
      <div className="bg-white rounded-xl p-6 w-[420px] max-w-[90vw]">
        <h3 className="font-headline-md text-on-background mb-3">Request revision</h3>
        <textarea
          value={body}
          onChange={(e) => onBodyChange(e.target.value)}
          placeholder="What needs to change?"
          className="w-full border border-outline-variant rounded-lg px-3 py-2 font-body-sm"
          rows={4}
        />
        <div className="flex items-center gap-2 mt-4">
          <button
            onClick={onCancel}
            disabled={busy}
            className="px-3 h-9 rounded-lg border border-outline-variant text-body-sm font-semibold"
          >
            Cancel
          </button>
          <button
            onClick={onSubmit}
            disabled={busy}
            className="ml-auto px-4 h-9 rounded-lg bg-primary text-on-primary text-body-sm font-semibold disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  )
}
```

---

### Task 4.6: `details-section.tsx` — info grid, subtasks, description

**Files:**
- Create: `components/tasks/details-section.tsx`

- [ ] **Step 1: Write**

```tsx
// components/tasks/details-section.tsx
'use client'
import Link from 'next/link'
import { useState } from 'react'
import { addSubtask, setTaskStatus, updateTaskNotes } from '@/app/actions/tasks'
import { StatusFlow } from './status-flow'
import { Avatar } from '@/components/shared/avatar'
import type { TaskDetail } from '@/db/queries/task-detail'

function fmtDate(d: string | null): string {
  if (!d) return '—'
  const [y, m, day] = d.split('-')
  const dt = new Date(Number(y), Number(m) - 1, Number(day))
  return dt.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

const STATUS_SHORT: Record<string, string> = {
  not_started: 'Not started',
  started: 'In progress',
  pending_review: 'In review',
  approved: 'Approved',
  complete: 'Completed',
  wont_do: "Won't do",
}

export function DetailsSection({ detail, me }: {
  detail: TaskDetail
  me: { id: string; role: 'owner' | 'pm' | 'ic' }
}) {
  const { task, project, parent, upstreamDeps, subtasks } = detail
  const canEditDescription =
    task.ownerId === me.id ||
    me.role === 'owner' ||
    (me.role === 'pm' && project.pmId === me.id)
  const canAddSubtask = canEditDescription

  return (
    <section className="glacier-panel rounded-xl mb-4">
      <h2 className="px-5 pt-5 font-headline-md text-on-background">2. Details</h2>
      <div className="px-5 pb-6 pt-4 grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-7">
        <div>
          <StatusFlow detail={detail} me={me} />

          <div className="grid grid-cols-2 gap-5 pt-5 border-t border-outline-variant">
            <Info label="Target start date">
              <span className="inline-flex items-center gap-2 font-body-sm font-semibold text-on-background">
                <span className="material-symbols-outlined text-[18px] text-body-muted">calendar_today</span>
                {fmtDate(task.targetStartDate)}
              </span>
            </Info>
            <Info label="Target end date">
              <span className="inline-flex items-center gap-2 font-body-sm font-semibold text-on-background">
                <span className="material-symbols-outlined text-[18px] text-body-muted">calendar_today</span>
                {fmtDate(task.targetEndDate)}
              </span>
            </Info>
            <Info label="Parent task">
              {parent ? (
                <Link href={`/tasks/${parent.id}`}
                      className="inline-flex items-center gap-2 text-tertiary hover:underline font-body-sm font-semibold">
                  <span className="material-symbols-outlined text-[18px]">link</span>
                  {parent.name}
                </Link>
              ) : <span className="font-body-sm text-body-muted">—</span>}
            </Info>
            <Info label="Depends on">
              {upstreamDeps.length === 0
                ? <span className="font-body-sm text-body-muted">—</span>
                : (
                  <div className="flex flex-wrap gap-2">
                    {upstreamDeps.map(d => (
                      <Link key={d.id} href={`/tasks/${d.id}`}
                            className="text-tertiary hover:underline font-body-sm font-semibold">
                        {d.name}
                      </Link>
                    ))}
                  </div>
                )}
            </Info>
          </div>
        </div>

        <div>
          <DescriptionBlock
            taskId={task.id}
            initial={task.description ?? ''}
            canEdit={canEditDescription}
          />
          <SubtasksBlock
            parentTaskId={task.id}
            subtasks={subtasks}
            canAdd={canAddSubtask}
            ownerIdForNewSubtask={me.id}
          />
        </div>
      </div>
    </section>
  )
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-h-11">
      <div className="font-label-caps text-body-muted mb-1">{label}</div>
      <div>{children}</div>
    </div>
  )
}

function DescriptionBlock({ taskId, initial, canEdit }: {
  taskId: string; initial: string; canEdit: boolean
}) {
  const [text, setText] = useState(initial)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function save() {
    setBusy(true); setErr(null)
    try {
      await updateTaskNotes({ taskId, description: draft })
      setText(draft); setEditing(false)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Save failed')
    } finally { setBusy(false) }
  }

  return (
    <div className="mb-5">
      <div className="font-label-caps text-body-muted mb-1">Description</div>
      {editing ? (
        <>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="w-full border border-outline-variant rounded-lg px-3 py-2 font-body-sm"
            rows={4}
          />
          <div className="flex items-center gap-2 mt-2">
            <button
              onClick={() => { setDraft(text); setEditing(false) }}
              className="px-3 h-8 rounded-lg border border-outline-variant text-body-sm"
            >Cancel</button>
            <button
              onClick={save}
              disabled={busy}
              className="ml-auto px-3 h-8 rounded-lg bg-primary text-on-primary text-body-sm font-semibold disabled:opacity-50"
            >Save</button>
          </div>
          {err && <div className="text-error text-body-sm mt-1">{err}</div>}
        </>
      ) : (
        <div
          onClick={() => canEdit && setEditing(true)}
          className={
            'font-body-sm text-on-surface-variant leading-relaxed mt-1 ' +
            (canEdit ? 'cursor-text hover:bg-surface-container-low rounded p-1 -m-1' : '')
          }
        >
          {text || <span className="text-body-muted italic">No description.</span>}
        </div>
      )}
    </div>
  )
}

function SubtasksBlock({
  parentTaskId, subtasks, canAdd, ownerIdForNewSubtask,
}: {
  parentTaskId: string
  subtasks: TaskDetail['subtasks']
  canAdd: boolean
  ownerIdForNewSubtask: string
}) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')

  async function toggle(subId: string, current: string) {
    setBusy(true); setErr(null)
    const next = current === 'complete' ? 'not_started' : 'complete'
    try {
      await setTaskStatus({ taskId: subId, status: next })
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Update failed')
    } finally { setBusy(false) }
  }

  async function add() {
    if (!name.trim()) return
    setBusy(true); setErr(null)
    try {
      await addSubtask({ parentTaskId, name: name.trim(), ownerId: ownerIdForNewSubtask })
      setName(''); setAdding(false)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Add failed')
    } finally { setBusy(false) }
  }

  return (
    <div className="border border-outline-variant rounded-xl overflow-hidden">
      <div className="grid grid-cols-[1fr_120px_120px] gap-3 px-4 py-3 bg-surface-container-low font-label-caps text-body-muted">
        <div>Subtasks ({subtasks.length})</div>
        <div>Assignee</div>
        <div>Status</div>
      </div>
      {subtasks.map(s => (
        <div key={s.id} className="grid grid-cols-[1fr_120px_120px] gap-3 px-4 py-3 border-t border-outline-variant items-center font-body-sm text-on-surface-variant">
          <label className="flex items-center gap-3 font-medium">
            <input
              type="checkbox"
              checked={s.status === 'complete'}
              onChange={() => toggle(s.id, s.status)}
              disabled={busy}
              className="w-4 h-4"
            />
            <Link href={`/tasks/${s.id}`} className="hover:underline">{s.name}</Link>
          </label>
          <div>
            <Avatar user={{ id: s.ownerId, name: s.ownerName }} size="sm" />
          </div>
          <div>
            <span className="inline-flex items-center h-6 px-2 rounded-md bg-tertiary-fixed text-tertiary text-[11px] font-semibold">
              {STATUS_SHORT[s.status]}
            </span>
          </div>
        </div>
      ))}
      {canAdd && (
        <div className="px-4 py-3 border-t border-outline-variant">
          {adding ? (
            <div className="flex items-center gap-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Subtask name"
                className="flex-1 border border-outline-variant rounded-lg px-3 py-1.5 font-body-sm"
              />
              <button
                onClick={add}
                disabled={busy || !name.trim()}
                className="px-3 h-8 rounded-lg bg-primary text-on-primary text-body-sm font-semibold disabled:opacity-50"
              >Add</button>
              <button
                onClick={() => { setName(''); setAdding(false) }}
                className="px-3 h-8 rounded-lg border border-outline-variant text-body-sm"
              >Cancel</button>
            </div>
          ) : (
            <button
              onClick={() => setAdding(true)}
              className="inline-flex items-center gap-1 text-tertiary font-body-sm font-semibold hover:underline"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              Add subtask
            </button>
          )}
          {err && <div className="text-error text-body-sm mt-2">{err}</div>}
        </div>
      )}
    </div>
  )
}
```

---

### Task 4.7: `edit-task-metadata-dialog.tsx`

**Files:**
- Create: `components/tasks/edit-task-metadata-dialog.tsx`

- [ ] **Step 1: Write**

```tsx
// components/tasks/edit-task-metadata-dialog.tsx
'use client'
import * as Dialog from '@radix-ui/react-dialog'
import { useState } from 'react'
import { updateTaskMetadata } from '@/app/actions/tasks'
import type { TaskDetail } from '@/db/queries/task-detail'

export function EditTaskMetadataDialog({
  detail, onClose,
}: { detail: TaskDetail; onClose: () => void }) {
  const { task } = detail
  const [name, setName] = useState(task.name)
  const [startDate, setStartDate] = useState(task.targetStartDate ?? '')
  const [endDate, setEndDate] = useState(task.targetEndDate ?? '')
  const [reviewerId, setReviewerId] = useState<string>(task.reviewerId ?? '')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null); setBusy(true)
    try {
      const patch: Record<string, unknown> = {
        taskId: task.id,
        name: name.trim() || undefined,
        reviewerId: reviewerId === '' ? null : reviewerId,
      }
      if (startDate) patch.targetStartDate = startDate
      if (endDate) patch.targetEndDate = endDate
      await updateTaskMetadata(patch)
      onClose()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Update failed')
    } finally { setBusy(false) }
  }

  return (
    <Dialog.Root open onOpenChange={(o) => { if (!o) onClose() }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/30 z-40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[480px] max-w-[90vw] bg-white rounded-xl p-6 shadow-xl z-50">
          <Dialog.Title className="font-headline-md text-on-background">Edit task</Dialog.Title>
          <form onSubmit={submit} className="mt-4 space-y-4">
            <label className="block text-body-sm">
              <span className="font-label-caps text-body-muted">Name</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full border border-outline-variant rounded-lg px-3 py-2 font-body-sm"
                required
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-body-sm">
                <span className="font-label-caps text-body-muted">Target start</span>
                <input
                  type="date" value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="mt-1 w-full border border-outline-variant rounded-lg px-3 py-2 font-body-sm"
                />
              </label>
              <label className="block text-body-sm">
                <span className="font-label-caps text-body-muted">Target end</span>
                <input
                  type="date" value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="mt-1 w-full border border-outline-variant rounded-lg px-3 py-2 font-body-sm"
                />
              </label>
            </div>
            <label className="block text-body-sm">
              <span className="font-label-caps text-body-muted">Reviewer (user UUID; blank = none)</span>
              <input
                value={reviewerId}
                onChange={(e) => setReviewerId(e.target.value)}
                placeholder="00000000-0000-0000-0000-000000000000"
                className="mt-1 w-full border border-outline-variant rounded-lg px-3 py-2 font-body-sm"
              />
            </label>

            {err && <div className="text-error text-body-sm">{err}</div>}

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button" onClick={onClose}
                className="px-3 h-9 rounded-lg border border-outline-variant text-body-sm font-semibold"
              >Cancel</button>
              <button
                type="submit" disabled={busy}
                className="ml-auto px-4 h-9 rounded-lg bg-primary text-on-primary text-body-sm font-semibold disabled:opacity-50"
              >Save</button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
```

Note: the reviewer picker is a plain UUID input for v1. A proper user-picker is a future improvement and would reuse whatever the project page drawer uses for reassign. The trade-off is acceptable because the user typically has the reviewer's UUID copied from the drawer or settings page.

---

### Task 4.8: `comments-section.tsx`

**Files:**
- Create: `components/tasks/comments-section.tsx`

- [ ] **Step 1: Write**

```tsx
// components/tasks/comments-section.tsx
'use client'
import { useState } from 'react'
import { addTaskComment } from '@/app/actions/task-comments'
import { Avatar } from '@/components/shared/avatar'
import type { TaskDetail } from '@/db/queries/task-detail'

export function CommentsSection({ detail }: { detail: TaskDetail }) {
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function post() {
    if (!body.trim()) return
    setBusy(true); setErr(null)
    try {
      await addTaskComment({ taskId: detail.task.id, body: body.trim(), kind: 'discussion' })
      setBody('')
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Post failed')
    } finally { setBusy(false) }
  }

  return (
    <section className="glacier-panel rounded-xl mb-4">
      <h2 className="px-5 pt-5 font-headline-md text-on-background">3. Comments / Notes</h2>
      <div className="px-5 pb-6 pt-4">
        <div className="space-y-4 mb-4">
          {detail.comments.length === 0 && (
            <div className="text-body-muted font-body-sm">No comments yet.</div>
          )}
          {detail.comments.map(c => (
            <div key={c.id} className="grid grid-cols-[34px_1fr] gap-3 pb-3 border-b border-outline-variant last:border-b-0">
              <Avatar user={{ id: c.authorId, name: c.authorName }} size="sm" />
              <div>
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="font-body-sm font-semibold text-on-background">{c.authorName}</span>
                  <span className="text-body-muted text-[12px]">
                    {new Date(c.createdAt).toLocaleString(undefined, {
                      year: 'numeric', month: 'short', day: 'numeric',
                      hour: 'numeric', minute: '2-digit',
                    })}
                  </span>
                </div>
                <div className="font-body-sm text-on-surface-variant whitespace-pre-wrap">{c.body}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-[1fr_auto] gap-3 items-center">
          <input
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') post() }}
            placeholder="Write a comment..."
            className="h-11 border border-outline-variant rounded-lg px-4 font-body-sm"
          />
          <button
            onClick={post}
            disabled={busy || !body.trim()}
            className="h-11 px-5 rounded-lg bg-tertiary text-on-primary font-body-sm font-semibold disabled:opacity-50"
          >
            Post
          </button>
        </div>
        {err && <div className="text-error text-body-sm mt-2">{err}</div>}
      </div>
    </section>
  )
}
```

---

### Task 4.9: `attachments-section.tsx` (stub)

**Files:**
- Create: `components/tasks/attachments-section.tsx`

- [ ] **Step 1: Write**

```tsx
// components/tasks/attachments-section.tsx
export function AttachmentsSection() {
  return (
    <section className="glacier-panel rounded-xl mb-4">
      <h2 className="px-5 pt-5 font-headline-md text-on-background">4. Attachments</h2>
      <div className="px-5 pb-6 pt-4">
        <div className="border border-dashed border-outline rounded-xl h-32 grid place-items-center text-center text-body-muted font-body-sm">
          <div>
            <span className="material-symbols-outlined text-[24px] block mb-2">upload</span>
            Attachments coming soon
          </div>
        </div>
      </div>
    </section>
  )
}
```

---

### Task 4.10: `task-detail-screen.tsx` + final commit

**Files:**
- Create: `components/tasks/task-detail-screen.tsx`

- [ ] **Step 1: Write**

```tsx
// components/tasks/task-detail-screen.tsx
import { PageNav } from './page-nav'
import { TopActions } from './top-actions'
import { SummarySection } from './summary-section'
import { DetailsSection } from './details-section'
import { CommentsSection } from './comments-section'
import { AttachmentsSection } from './attachments-section'
import type { TaskDetail } from '@/db/queries/task-detail'

type Me = { id: string; role: 'owner' | 'pm' | 'ic' }

export function TaskDetailScreen({ me, detail }: { me: Me; detail: TaskDetail }) {
  return (
    <div className="px-10 py-7 pb-16 max-w-[1360px] mx-auto">
      <PageNav
        projectId={detail.project.id}
        prevTaskId={detail.prevTaskId}
        nextTaskId={detail.nextTaskId}
      />
      <TopActions detail={detail} me={me} />
      <SummarySection detail={detail} me={me} />
      <DetailsSection detail={detail} me={me} />
      <CommentsSection detail={detail} />
      <AttachmentsSection />
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
cd /Users/guoyuzhu/Desktop/Real-Estate-Analysis/AlphaX_Hub
npm run typecheck
```
Expected: PASS. If any type error remains, it's likely in one of the section components — fix it there.

- [ ] **Step 3: Run tests**

```bash
npm test 2>&1 | tail -10
```
Expected: full suite pass (count varies; previous baseline 232 + new tests from Phases 1–3).

- [ ] **Step 4: Smoke test in the browser**

```bash
npm run dev
```
Visit `http://localhost:3000/tasks/<some-task-uuid>` (find a real task ID via `npm run db:studio` or by visiting the project page and copying it from the drawer URL `?task=<id>`).

Verify:
- Page renders without errors.
- Title, status dot, priority/status dropdowns all visible.
- Status flow widget shows 2 or 3 stages depending on whether the task has a reviewer.
- Edit button opens the metadata dialog; saving applies the change and the page refreshes.
- "Open in full page" link in the drawer (will be wired in Phase 5) currently still points at the old URL — that's fine for now.

- [ ] **Step 5: Commit Phase 4 batch**

```bash
git -C /Users/guoyuzhu/Desktop/Real-Estate-Analysis add \
  AlphaX_Hub/app/\(app\)/tasks/ \
  AlphaX_Hub/components/tasks/
git -C /Users/guoyuzhu/Desktop/Real-Estate-Analysis commit -m "feat(tasks): /tasks/[taskId] full-page detail screen"
```

---

## Phase 5 — Drawer integration

### Task 5.1: Fix drawer "Open full task detail" link

**Files:**
- Modify: `components/project/task-drawer.tsx`

- [ ] **Step 1: Edit the link at the bottom of the drawer**

In `components/project/task-drawer.tsx`, find the block (currently near the bottom, around line 119):

```tsx
<div className="mt-6 pt-4 border-t border-zinc-200 text-xs">
  <a href={`/projects/${projectId}/tasks/${task.id}`} className="text-blue-600 hover:underline">
    Open full task detail →
  </a>
  <span className="text-zinc-400 ml-2">(future spec)</span>
</div>
```

Replace with:

```tsx
<div className="mt-6 pt-4 border-t border-zinc-200 text-xs">
  <a href={`/tasks/${task.id}`} className="text-blue-600 hover:underline inline-flex items-center gap-1">
    <span className="material-symbols-outlined text-[16px]">open_in_new</span>
    Open in full page
  </a>
</div>
```

- [ ] **Step 2: Typecheck + smoke test**

```bash
npm run typecheck
npm run dev
```
Open the project page, click any task to open the drawer, click "Open in full page" — verify navigation to `/tasks/[taskId]`.

- [ ] **Step 3: Commit**

```bash
git -C /Users/guoyuzhu/Desktop/Real-Estate-Analysis add AlphaX_Hub/components/project/task-drawer.tsx
git -C /Users/guoyuzhu/Desktop/Real-Estate-Analysis commit -m "feat(drawer): wire 'Open in full page' link to /tasks/[taskId]"
```

---

## Phase 6 — Final verification

### Task 6.1: Full suite + build + manual walkthrough

- [ ] **Step 1: Typecheck**

```bash
cd /Users/guoyuzhu/Desktop/Real-Estate-Analysis/AlphaX_Hub
npm run typecheck
```
Expected: ZERO errors.

- [ ] **Step 2: Full test suite**

```bash
npm test 2>&1 | tail -10
```
Expected: ALL specs PASS. New tests added:
- `lib/tasks/status-flow.test.ts` (8 specs)
- `lib/services/task-service.update-metadata.test.ts` (6 specs)
- `app/actions/tasks.update-metadata.test.ts` (4 specs)
- `db/queries/task-detail.test.ts` (6 specs)

- [ ] **Step 3: Production build**

```bash
npm run build
```
Expected: succeeds, no errors.

- [ ] **Step 4: Manual walkthrough**

```bash
npm run dev
```

Walk through:
1. From a kicked-off project, open the project page, click any task → drawer opens.
2. Click "Open in full page" → navigates to `/tasks/[id]`. Verify URL.
3. Page shows: PageNav (Back to Project / Prev / Next), Title + health + Edit/Delete/Won't do, Summary section, Details (status flow + info grid + description + subtasks), Comments, Attachments stub.
4. Click Status dropdown → change status → page revalidates.
5. Click Start in status flow widget (if `not_started`) → status advances.
6. Click +Add subtask, enter a name → submits successfully.
7. Type a comment, hit Post → comment appears.
8. Click Edit → metadata dialog opens; change name; save → title updates.
9. Click Prev/Next → navigates to neighbouring tasks. Disabled at boundaries.
10. Navigate from My Tasks → click a task → back link says "Back to My Tasks". From the project drawer → back link says "Back to Project".
11. As an IC (non-owner-non-PM) viewing a task you don't own: Edit / Delete buttons hidden; status dropdown disabled; you can still see comments and add new ones.

- [ ] **Step 5: If any stray fixes**

```bash
git -C /Users/guoyuzhu/Desktop/Real-Estate-Analysis add -A
git -C /Users/guoyuzhu/Desktop/Real-Estate-Analysis status --short
# If anything appeared:
git -C /Users/guoyuzhu/Desktop/Real-Estate-Analysis commit -m "chore: post-impl verification fixes"
```
Skip this step if `git status` is clean.

---

## Self-review notes (post-write)

- **Spec §3 (route, files):** covered by Tasks 4.1 + 4.10 + 5.1.
- **Spec §4.1 (`getTaskDetail`):** Task 3.1.
- **Spec §4.2 (RSC page):** Task 4.1.
- **Spec §5.1 (page-nav):** Task 4.2.
- **Spec §5.2 (summary section):** Task 4.4.
- **Spec §5.3 (details section + subtasks + description):** Task 4.6.
- **Spec §5.4 (comments):** Task 4.8.
- **Spec §5.5 (attachments stub):** Task 4.9.
- **Spec §5.6 (theme mapping):** applied throughout Phase 4 components — every `glacier-panel`, `font-headline-*`, `text-primary`, `text-tertiary`, `material-symbols-outlined`, etc.
- **Spec §6.1–6.5 (Edit/Delete/Won't do, title, health):** Task 4.3.
- **Spec §7.1–7.4 (status flow widget):** Task 4.5 + Task 1.1 helper.
- **Spec §7.5 (drawer stepper refactor):** Task 1.2.
- **Spec §8.1 (`updateTaskMetadata`):** Tasks 2.1 (service) + 2.2 (action).
- **Spec §8.2 (existing actions reused):** consumed in Tasks 4.3 / 4.4 / 4.5 / 4.6 / 4.8.
- **Spec §9 (error handling):** Task 4.1 (error boundary) + per-component try/catch banners.
- **Spec §10 (permissions):** server side via existing `requirePermission`; UI gates via `me.role`/owner/PM checks in Tasks 4.3 / 4.4 / 4.5 / 4.6.
- **Spec §11 (testing):** covered by Tasks 1.1, 2.1, 2.2, 3.1.
- **Spec §12 (out of scope):** attachments (stub in 4.9), parent/dep editing (read-only in 4.6).
- **Spec §13 (rollout):** no migration; ships in one go after Phase 6 passes.
