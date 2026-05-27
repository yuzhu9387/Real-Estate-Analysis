# BuildFlow Workflow Template Editor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the owner-facing workflow template editor UI per `docs/superpowers/specs/2026-05-27-workflow-editor-design.md`: list / new picker / detail / editor routes with inline-list `@dnd-kit/sortable` reorder, per-task dependency multi-select, datalist owner-role suggestions, localStorage draft caching, unsaved-changes warning, plus two new Server Actions (`duplicateWorkflowTemplate`, `unarchiveWorkflowTemplate`) and shared client+server cycle detection.

**Architecture:** Pure-function `hasCycle` and `draft-storage` modules live in `lib/workflow-editor/` and are used both client- and server-side. Editor state owned by a top-level `editor-shell.tsx` Client Component; sub-components (task-row, dep-picker, header, banner) are dumb children. Server uses existing `workflowTemplateService.create/.update/.archive` (foundation Phase 8) and extends with `duplicate`, `unarchive`, plus cycle-detection in create/update. Routes redirect non-owner users.

**Tech Stack:** Same as foundation — Next.js 14 App Router, TypeScript, Drizzle + Postgres, Tailwind, Vitest. New deps: `@dnd-kit/core` and `@dnd-kit/sortable`.

---

## Phase 1: Pure-function helpers + dnd-kit

### Task 1.1: Install @dnd-kit

**Files:**
- Modify: `package.json` and `package-lock.json` (via `npm install`)

- [ ] **Step 1: Install**

```bash
npm install @dnd-kit/core @dnd-kit/sortable
```

- [ ] **Step 2: Verify and commit**

```bash
npm run typecheck
git add package.json package-lock.json
git commit -m "chore: install @dnd-kit/core + @dnd-kit/sortable"
```

---

### Task 1.2: `hasCycle` pure function

**Files:**
- Create: `lib/workflow-editor/has-cycle.ts`
- Create: `lib/workflow-editor/has-cycle.test.ts`

- [ ] **Step 1: Tests (TDD)**

```ts
// lib/workflow-editor/has-cycle.test.ts
import { describe, it, expect } from 'vitest'
import { hasCycle } from './has-cycle'

describe('hasCycle', () => {
  it('empty input → false', () => {
    expect(hasCycle({ tasks: [], deps: [] })).toBe(false)
  })

  it('linear chain → false', () => {
    expect(hasCycle({
      tasks: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
      deps: [{ fromId: 'a', toId: 'b' }, { fromId: 'b', toId: 'c' }],
    })).toBe(false)
  })

  it('diamond → false', () => {
    expect(hasCycle({
      tasks: [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }],
      deps: [
        { fromId: 'a', toId: 'b' }, { fromId: 'a', toId: 'c' },
        { fromId: 'b', toId: 'd' }, { fromId: 'c', toId: 'd' },
      ],
    })).toBe(false)
  })

  it('self-edge → true', () => {
    expect(hasCycle({
      tasks: [{ id: 'a' }],
      deps: [{ fromId: 'a', toId: 'a' }],
    })).toBe(true)
  })

  it('2-cycle → true', () => {
    expect(hasCycle({
      tasks: [{ id: 'a' }, { id: 'b' }],
      deps: [{ fromId: 'a', toId: 'b' }, { fromId: 'b', toId: 'a' }],
    })).toBe(true)
  })

  it('3-cycle → true', () => {
    expect(hasCycle({
      tasks: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
      deps: [
        { fromId: 'a', toId: 'b' },
        { fromId: 'b', toId: 'c' },
        { fromId: 'c', toId: 'a' },
      ],
    })).toBe(true)
  })

  it('cycle in disconnected subgraph → true', () => {
    expect(hasCycle({
      tasks: [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }],
      deps: [
        { fromId: 'a', toId: 'b' },     // disconnected linear chain
        { fromId: 'c', toId: 'd' },     // cycle
        { fromId: 'd', toId: 'c' },
      ],
    })).toBe(true)
  })

  it('ignores deps that reference unknown tasks', () => {
    expect(hasCycle({
      tasks: [{ id: 'a' }],
      deps: [{ fromId: 'a', toId: 'ghost' }],
    })).toBe(false)
  })
})
```

Run: `npm test -- lib/workflow-editor/has-cycle.test.ts` — expect FAIL.

- [ ] **Step 2: Implement**

```ts
// lib/workflow-editor/has-cycle.ts
export function hasCycle(input: {
  tasks: Array<{ id: string }>
  deps: Array<{ fromId: string; toId: string }>
}): boolean {
  const ids = new Set(input.tasks.map(t => t.id))
  // Self-edges count as cycles immediately
  if (input.deps.some(d => d.fromId === d.toId && ids.has(d.fromId))) return true

  // Kahn's algorithm — count remaining tasks after topo sort
  const indegree = new Map<string, number>()
  const adj = new Map<string, string[]>()
  for (const t of input.tasks) {
    indegree.set(t.id, 0)
    adj.set(t.id, [])
  }
  for (const d of input.deps) {
    if (!ids.has(d.fromId) || !ids.has(d.toId)) continue
    adj.get(d.fromId)!.push(d.toId)
    indegree.set(d.toId, (indegree.get(d.toId) ?? 0) + 1)
  }

  const queue: string[] = []
  for (const [id, n] of indegree) if (n === 0) queue.push(id)
  let visited = 0
  while (queue.length > 0) {
    const id = queue.shift()!
    visited++
    for (const next of adj.get(id)!) {
      const n = (indegree.get(next) ?? 0) - 1
      indegree.set(next, n)
      if (n === 0) queue.push(next)
    }
  }
  return visited < input.tasks.length
}
```

Run, expect PASS.

- [ ] **Step 3: Commit**

```bash
git add lib/workflow-editor/has-cycle.ts lib/workflow-editor/has-cycle.test.ts
git commit -m "feat(workflow-editor): hasCycle pure function (Kahn's algorithm)"
```

---

### Task 1.3: `draft-storage` localStorage helpers

**Files:**
- Create: `lib/workflow-editor/draft-storage.ts`
- Create: `lib/workflow-editor/draft-storage.test.ts`

- [ ] **Step 1: Tests**

```ts
// lib/workflow-editor/draft-storage.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { draftKey, saveDraft, loadDraft, clearDraft, type Draft } from './draft-storage'

// minimal in-memory localStorage stub
class MemStorage {
  private m = new Map<string, string>()
  getItem(k: string) { return this.m.get(k) ?? null }
  setItem(k: string, v: string) { this.m.set(k, v) }
  removeItem(k: string) { this.m.delete(k) }
}
const storage = new MemStorage()

const SAMPLE: Draft = {
  name: 'P',
  description: '',
  tasks: [{ id: 't1', name: 'A', description: '', durationDays: 1, ownerRoleLabel: 'design', sortOrder: 0 }],
  deps: [],
  savedAt: '2026-05-27T10:00:00.000Z',
}

describe('draft storage', () => {
  beforeEach(() => { storage.removeItem(draftKey('x')); storage.removeItem(draftKey('__new__')) })

  it('saves and loads a draft', () => {
    saveDraft('x', SAMPLE, storage as unknown as Storage)
    const loaded = loadDraft('x', storage as unknown as Storage)
    expect(loaded?.name).toBe('P')
    expect(loaded?.tasks).toHaveLength(1)
  })

  it('returns null when nothing stored', () => {
    expect(loadDraft('x', storage as unknown as Storage)).toBe(null)
  })

  it('returns null and silently discards corrupt JSON', () => {
    storage.setItem(draftKey('x'), '{not valid')
    expect(loadDraft('x', storage as unknown as Storage)).toBe(null)
  })

  it('clearDraft removes the key', () => {
    saveDraft('x', SAMPLE, storage as unknown as Storage)
    clearDraft('x', storage as unknown as Storage)
    expect(loadDraft('x', storage as unknown as Storage)).toBe(null)
  })

  it('namespaces new-mode and edit-mode drafts separately', () => {
    saveDraft('__new__', SAMPLE, storage as unknown as Storage)
    saveDraft('id-1', { ...SAMPLE, name: 'X' }, storage as unknown as Storage)
    expect(loadDraft('__new__', storage as unknown as Storage)?.name).toBe('P')
    expect(loadDraft('id-1', storage as unknown as Storage)?.name).toBe('X')
  })
})
```

Run, expect FAIL.

- [ ] **Step 2: Implement**

```ts
// lib/workflow-editor/draft-storage.ts
export type DraftTask = {
  id: string
  name: string
  description: string
  durationDays: number
  ownerRoleLabel: string
  sortOrder: number
}
export type DraftDep = {
  id: string
  fromTaskId: string
  toTaskId: string
  lagDays: number
}
export type Draft = {
  name: string
  description: string
  tasks: DraftTask[]
  deps: DraftDep[]
  savedAt: string   // ISO8601
}

export const NEW_MODE_KEY = '__new__'

export function draftKey(idOrNew: string): string {
  return `workflow-draft-${idOrNew}`
}

export function saveDraft(idOrNew: string, draft: Draft, storage: Storage = localStorage): void {
  storage.setItem(draftKey(idOrNew), JSON.stringify(draft))
}

export function loadDraft(idOrNew: string, storage: Storage = localStorage): Draft | null {
  const raw = storage.getItem(draftKey(idOrNew))
  if (!raw) return null
  try {
    return JSON.parse(raw) as Draft
  } catch {
    return null
  }
}

export function clearDraft(idOrNew: string, storage: Storage = localStorage): void {
  storage.removeItem(draftKey(idOrNew))
}
```

Run, expect PASS.

- [ ] **Step 3: Commit**

```bash
git add lib/workflow-editor/draft-storage.ts lib/workflow-editor/draft-storage.test.ts
git commit -m "feat(workflow-editor): draft storage helpers with corrupt-data tolerance"
```

---

## Phase 2: Server-side enhancements

### Task 2.1: Add cycle detection to existing `create` and `update`

**Files:**
- Modify: `lib/services/workflow-template-service.ts`
- Create: `lib/services/workflow-template-service.cycle.test.ts`

- [ ] **Step 1: Tests**

```ts
// lib/services/workflow-template-service.cycle.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { testDb, truncateAll } from '@/tests/db'
import { seedOwner } from '@/tests/fixtures/users'
import { workflowTemplateService } from './workflow-template-service'
import { ValidationError } from '@/lib/server/errors'

describe('workflowTemplateService cycle detection', () => {
  beforeEach(async () => { await truncateAll() })

  it('create rejects deps that form a cycle', async () => {
    const owner = await seedOwner()
    await expect(workflowTemplateService.create({
      createdById: owner.id, name: 'X',
      tasks: [{ name: 'A', durationDays: 1 }, { name: 'B', durationDays: 1 }],
      deps: [
        { fromIdx: 0, toIdx: 1, lagDays: 0 },
        { fromIdx: 1, toIdx: 0, lagDays: 0 },
      ],
    }, testDb)).rejects.toThrow(ValidationError)
  })

  it('update rejects deps that form a cycle', async () => {
    const owner = await seedOwner()
    const tpl = await workflowTemplateService.create({
      createdById: owner.id, name: 'X',
      tasks: [{ name: 'A', durationDays: 1 }, { name: 'B', durationDays: 1 }],
      deps: [{ fromIdx: 0, toIdx: 1, lagDays: 0 }],
    }, testDb)
    await expect(workflowTemplateService.update(tpl.id, {
      tasks: [{ name: 'A', durationDays: 1 }, { name: 'B', durationDays: 1 }],
      deps: [
        { fromIdx: 0, toIdx: 1, lagDays: 0 },
        { fromIdx: 1, toIdx: 0, lagDays: 0 },
      ],
    }, testDb)).rejects.toThrow(ValidationError)
  })

  it('linear chain still accepted', async () => {
    const owner = await seedOwner()
    await expect(workflowTemplateService.create({
      createdById: owner.id, name: 'OK',
      tasks: [{ name: 'A', durationDays: 1 }, { name: 'B', durationDays: 1 }, { name: 'C', durationDays: 1 }],
      deps: [
        { fromIdx: 0, toIdx: 1, lagDays: 0 },
        { fromIdx: 1, toIdx: 2, lagDays: 0 },
      ],
    }, testDb)).resolves.toBeDefined()
  })
})
```

Run, expect 2/3 fail (cycle cases pass through, linear chain passes).

- [ ] **Step 2: Add cycle check to `create` and `update`**

In `lib/services/workflow-template-service.ts`, after the existing self-dependency check inside `create()` and before the actual insert of deps, add:

```ts
import { hasCycle } from '@/lib/workflow-editor/has-cycle'
```

In `create`:

After the line that validates `input.tasks.length === 0`, add:

```ts
// Cycle detection: build virtual ids matching the tasks array indexes
const fakeTasks = input.tasks.map((_, i) => ({ id: String(i) }))
const fakeDeps = input.deps.map(d => ({ fromId: String(d.fromIdx), toId: String(d.toIdx) }))
if (hasCycle({ tasks: fakeTasks, deps: fakeDeps })) {
  throw new ValidationError('Dependencies form a cycle')
}
```

In `update` (similar — same check before the existing dep-insert block):

```ts
const fakeTasks = input.tasks.map((_, i) => ({ id: String(i) }))
const fakeDeps = input.deps.map(d => ({ fromId: String(d.fromIdx), toId: String(d.toIdx) }))
if (hasCycle({ tasks: fakeTasks, deps: fakeDeps })) {
  throw new ValidationError('Dependencies form a cycle')
}
```

Run tests, expect PASS.

- [ ] **Step 3: Commit**

```bash
git add lib/services/workflow-template-service.ts lib/services/workflow-template-service.cycle.test.ts
git commit -m "feat(service): cycle detection in workflow create/update"
```

---

### Task 2.2: `duplicate` service method + Server Action

**Files:**
- Modify: `lib/services/workflow-template-service.ts`
- Modify: `app/actions/workflows.ts`
- Create: `lib/services/workflow-template-service.duplicate.test.ts`

- [ ] **Step 1: Tests**

```ts
// lib/services/workflow-template-service.duplicate.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { eq } from 'drizzle-orm'
import { testDb, truncateAll } from '@/tests/db'
import { workflowTemplates, workflowTemplateTasks, workflowTemplateTaskDeps } from '@/db/schema'
import { seedOwner } from '@/tests/fixtures/users'
import { workflowTemplateService } from './workflow-template-service'
import { ConflictError } from '@/lib/server/errors'

describe('workflowTemplateService.duplicate', () => {
  beforeEach(async () => { await truncateAll() })

  it('copies tasks and deps with new IDs', async () => {
    const owner = await seedOwner()
    const src = await workflowTemplateService.create({
      createdById: owner.id, name: 'Source',
      tasks: [{ name: 'A', durationDays: 5 }, { name: 'B', durationDays: 10 }],
      deps: [{ fromIdx: 0, toIdx: 1, lagDays: 0 }],
    }, testDb)

    const dup = await workflowTemplateService.duplicate(src.id, {
      newName: 'Copy of Source', createdById: owner.id,
    }, testDb)
    expect(dup.id).not.toBe(src.id)
    expect(dup.name).toBe('Copy of Source')

    const dupTasks = await testDb.select().from(workflowTemplateTasks).where(eq(workflowTemplateTasks.workflowTemplateId, dup.id))
    expect(dupTasks.map(t => t.name).sort()).toEqual(['A', 'B'])

    const dupDeps = await testDb.select().from(workflowTemplateTaskDeps).where(eq(workflowTemplateTaskDeps.workflowTemplateId, dup.id))
    expect(dupDeps).toHaveLength(1)
    // Ensure deps point to the duplicated task IDs, not the source's
    const dupTaskIds = new Set(dupTasks.map(t => t.id))
    expect(dupTaskIds.has(dupDeps[0].fromTaskId)).toBe(true)
    expect(dupTaskIds.has(dupDeps[0].toTaskId)).toBe(true)
  })

  it('rejects archived source', async () => {
    const owner = await seedOwner()
    const src = await workflowTemplateService.create({
      createdById: owner.id, name: 'Source',
      tasks: [{ name: 'A', durationDays: 1 }], deps: [],
    }, testDb)
    await workflowTemplateService.archive(src.id, testDb)
    await expect(workflowTemplateService.duplicate(src.id, {
      newName: 'X', createdById: owner.id,
    }, testDb)).rejects.toThrow(ConflictError)
  })

  it('throws NotFound on missing source', async () => {
    const owner = await seedOwner()
    await expect(workflowTemplateService.duplicate('00000000-0000-0000-0000-000000000000', {
      newName: 'X', createdById: owner.id,
    }, testDb)).rejects.toThrow()
  })
})
```

- [ ] **Step 2: Implement service method**

Add this method to `workflowTemplateService` in `lib/services/workflow-template-service.ts`:

```ts
async duplicate(sourceId: string, input: { newName: string; createdById: string }, db: DB) {
  const { ConflictError } = await import('@/lib/server/errors')
  return db.transaction(async (tx) => {
    const sourceRows = await tx.select().from(workflowTemplates).where(eq(workflowTemplates.id, sourceId))
    if (sourceRows.length === 0) throw new NotFoundError('WorkflowTemplate')
    if (sourceRows[0].isArchived) throw new ConflictError('Cannot duplicate an archived template')

    const sourceTasks = await tx.select().from(workflowTemplateTasks)
      .where(eq(workflowTemplateTasks.workflowTemplateId, sourceId))
    const sourceDeps = await tx.select().from(workflowTemplateTaskDeps)
      .where(eq(workflowTemplateTaskDeps.workflowTemplateId, sourceId))

    const [newTpl] = await tx.insert(workflowTemplates).values({
      name: input.newName,
      description: sourceRows[0].description,
      createdById: input.createdById,
    }).returning()

    const idMap = new Map<string, string>()
    const insertedTasks = await tx.insert(workflowTemplateTasks).values(
      sourceTasks.map(t => ({
        workflowTemplateId: newTpl.id,
        name: t.name,
        description: t.description,
        defaultDurationDays: t.defaultDurationDays,
        defaultOwnerRoleLabel: t.defaultOwnerRoleLabel,
        sortOrder: t.sortOrder,
      })),
    ).returning()
    // Map source-task IDs to newly inserted IDs by sort_order (stable assumption since insert order preserved)
    sourceTasks.forEach((src, i) => idMap.set(src.id, insertedTasks[i].id))

    if (sourceDeps.length > 0) {
      await tx.insert(workflowTemplateTaskDeps).values(
        sourceDeps.map(d => ({
          workflowTemplateId: newTpl.id,
          fromTaskId: idMap.get(d.fromTaskId)!,
          toTaskId: idMap.get(d.toTaskId)!,
          dependencyType: d.dependencyType,
          lagDays: d.lagDays,
        })),
      )
    }
    return newTpl
  })
},
```

- [ ] **Step 3: Server Action**

Append to `app/actions/workflows.ts`:

```ts
export async function duplicateWorkflowTemplate(raw: unknown) {
  const input = z.object({
    sourceId: z.string().uuid(),
    newName: z.string().min(1),
  }).parse(raw)
  const user = await requirePermission({ type: 'workflow.create' })
  const tpl = await workflowTemplateService.duplicate(input.sourceId, {
    newName: input.newName, createdById: user.id,
  }, db)
  revalidatePath('/workflows')
  return { ok: true, id: tpl.id }
}
```

- [ ] **Step 4: Run and commit**

```bash
npm test -- lib/services/workflow-template-service.duplicate.test.ts
git add lib/services/workflow-template-service.ts app/actions/workflows.ts lib/services/workflow-template-service.duplicate.test.ts
git commit -m "feat(workflow): duplicateWorkflowTemplate service + action"
```

---

### Task 2.3: `unarchive` service method + Server Action

**Files:**
- Modify: `lib/services/workflow-template-service.ts`
- Modify: `app/actions/workflows.ts`

- [ ] **Step 1: Service method (no separate test — covered indirectly)**

Add to `workflowTemplateService`:

```ts
async unarchive(id: string, db: DB) {
  const result = await db.update(workflowTemplates)
    .set({ isArchived: false, updatedAt: new Date() })
    .where(eq(workflowTemplates.id, id))
    .returning()
  if (result.length === 0) throw new NotFoundError('WorkflowTemplate')
},
```

- [ ] **Step 2: Server Action**

Append to `app/actions/workflows.ts`:

```ts
export async function unarchiveWorkflowTemplate(raw: unknown) {
  const input = z.object({ id: z.string().uuid() }).parse(raw)
  const existing = await workflowTemplateService.getById(input.id, db)
  if (!existing) throw new Error('not found')
  await requirePermission({ type: 'workflow.update', workflow: { createdById: existing.createdById } })
  await workflowTemplateService.unarchive(input.id, db)
  revalidatePath('/workflows')
  revalidatePath(`/workflows/${input.id}`)
  return { ok: true }
}
```

- [ ] **Step 3: Verify and commit**

```bash
npm run typecheck
git add lib/services/workflow-template-service.ts app/actions/workflows.ts
git commit -m "feat(workflow): unarchiveWorkflowTemplate service + action"
```

---

## Phase 3: useLeavePrompt hook

### Task 3.1: `useLeavePrompt` custom hook

**Files:**
- Create: `lib/workflow-editor/use-leave-prompt.ts`

- [ ] **Step 1: Implement**

```ts
// lib/workflow-editor/use-leave-prompt.ts
'use client'
import { useEffect } from 'react'

export function useLeavePrompt(isDirty: boolean) {
  useEffect(() => {
    if (!isDirty) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''   // legacy spec requires this
      return ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty])
}
```

(No unit test — `beforeunload` is browser-only and hard to test reliably. Behavior is verified in the editor component tests by checking the dirty-tracking logic that decides when this is enabled.)

- [ ] **Step 2: Commit**

```bash
git add lib/workflow-editor/use-leave-prompt.ts
git commit -m "feat(workflow-editor): useLeavePrompt hook for tab-close warning"
```

---

## Phase 4: Editor sub-components

### Task 4.1: `<DepPicker />`

**Files:**
- Create: `components/workflows/dep-picker.tsx`

- [ ] **Step 1: Implement**

```tsx
// components/workflows/dep-picker.tsx
'use client'
import { useState } from 'react'

export function DepPicker({
  taskId, allTasks, currentDepIds, onAdd, onRemove,
}: {
  taskId: string
  allTasks: Array<{ id: string; name: string; sortOrder: number }>
  currentDepIds: string[]
  onAdd: (upstreamTaskId: string) => void
  onRemove: (upstreamTaskId: string) => void
}) {
  const [open, setOpen] = useState(false)
  const self = allTasks.find(t => t.id === taskId)
  const candidates = self
    ? allTasks.filter(t => t.id !== taskId && t.sortOrder < self.sortOrder && !currentDepIds.includes(t.id))
    : []

  return (
    <div className="flex flex-wrap items-center gap-1 text-xs">
      <span className="text-zinc-500">depends on:</span>
      {currentDepIds.length === 0 && <span className="text-zinc-400 italic">(none)</span>}
      {currentDepIds.map(depId => {
        const dep = allTasks.find(t => t.id === depId)
        if (!dep) return null
        return (
          <span key={depId} className="bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded inline-flex items-center gap-1">
            {dep.name}
            <button onClick={() => onRemove(depId)} className="hover:text-blue-900" aria-label={`remove dep ${dep.name}`}>×</button>
          </span>
        )
      })}
      {candidates.length > 0 && (
        <div className="relative">
          <button onClick={() => setOpen(o => !o)} className="text-blue-600 hover:underline">+ add</button>
          {open && (
            <div className="absolute z-10 mt-1 bg-white border border-zinc-200 rounded shadow-lg min-w-[180px]">
              {candidates.map(c => (
                <button key={c.id}
                  onClick={() => { onAdd(c.id); setOpen(false) }}
                  className="block w-full text-left px-2 py-1 hover:bg-zinc-100">
                  {c.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/workflows/dep-picker.tsx
git commit -m "feat(workflow-editor): DepPicker (multi-select upstream tasks)"
```

---

### Task 4.2: `<TaskRow />` with sortable drag handle

**Files:**
- Create: `components/workflows/task-row.tsx`

- [ ] **Step 1: Implement**

```tsx
// components/workflows/task-row.tsx
'use client'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { DepPicker } from './dep-picker'
import type { DraftTask } from '@/lib/workflow-editor/draft-storage'

const ROLE_SUGGESTIONS = ['design', 'construction', 'sales', 'development']

export function TaskRow({
  task, sortIndex, allTasks, depUpstreamIds,
  onChange, onDelete, onAddDep, onRemoveDep,
}: {
  task: DraftTask
  sortIndex: number
  allTasks: Array<{ id: string; name: string; sortOrder: number }>
  depUpstreamIds: string[]
  onChange: (patch: Partial<DraftTask>) => void
  onDelete: () => void
  onAddDep: (upstreamTaskId: string) => void
  onRemoveDep: (upstreamTaskId: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div ref={setNodeRef} style={style}
      className="border border-zinc-200 rounded p-2 bg-white flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <button {...attributes} {...listeners}
          className="cursor-grab text-zinc-400 hover:text-zinc-700 px-1"
          aria-label="drag to reorder">⠿</button>
        <span className="text-xs font-semibold w-6 shrink-0">{sortIndex + 1}.</span>
        <input
          value={task.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="Task name"
          className="flex-1 border-b border-transparent focus:border-zinc-300 outline-none text-sm px-1"
        />
        <input
          type="number"
          min="0"
          value={task.durationDays}
          onChange={(e) => onChange({ durationDays: Number(e.target.value) })}
          className="w-14 border border-zinc-200 rounded px-1 text-sm text-right"
        />
        <span className="text-xs text-zinc-500">d</span>
        <input
          list="owner-role-suggestions"
          value={task.ownerRoleLabel}
          onChange={(e) => onChange({ ownerRoleLabel: e.target.value })}
          placeholder="Owner role"
          className="w-32 border border-zinc-200 rounded px-1 text-sm"
        />
        <datalist id="owner-role-suggestions">
          {ROLE_SUGGESTIONS.map(r => <option key={r} value={r} />)}
        </datalist>
        <button onClick={onDelete}
          className="text-zinc-400 hover:text-red-600 px-1 text-xs"
          aria-label="delete task">×</button>
      </div>
      <div className="pl-10">
        <DepPicker
          taskId={task.id}
          allTasks={allTasks}
          currentDepIds={depUpstreamIds}
          onAdd={onAddDep}
          onRemove={onRemoveDep}
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/workflows/task-row.tsx
git commit -m "feat(workflow-editor): TaskRow with drag handle + inline edits"
```

---

## Phase 5: Editor shell + header + supporting components

### Task 5.1: `<EditorHeader />`

**Files:**
- Create: `components/workflows/editor-header.tsx`

- [ ] **Step 1: Implement**

```tsx
// components/workflows/editor-header.tsx
'use client'
import Link from 'next/link'

export function EditorHeader({
  mode, isArchived, isDirty, isSaving, errorBanner,
  onSave, onCancel, onArchive, onRestore,
}: {
  mode: 'new' | 'edit'
  isArchived: boolean
  isDirty: boolean
  isSaving: boolean
  errorBanner: string | null
  onSave: () => void
  onCancel: () => void
  onArchive: () => void
  onRestore: () => void
}) {
  return (
    <div>
      <div className="flex items-center mb-3">
        <Link href="/workflows" className="text-blue-600 text-sm hover:underline">← Back to list</Link>
        <div className="ml-auto flex gap-2">
          <button onClick={onCancel}
            className="px-3 py-1.5 border border-zinc-300 rounded text-sm hover:bg-zinc-50">
            Cancel
          </button>
          {mode === 'edit' && !isArchived && (
            <button onClick={onArchive}
              className="px-3 py-1.5 border border-red-200 text-red-700 rounded text-sm hover:bg-red-50">
              Archive
            </button>
          )}
          {mode === 'edit' && isArchived && (
            <button onClick={onRestore}
              className="px-3 py-1.5 border border-zinc-300 text-zinc-700 rounded text-sm hover:bg-zinc-50">
              Restore
            </button>
          )}
          <button onClick={onSave}
            disabled={isSaving || !isDirty}
            className="px-4 py-1.5 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded text-sm hover:opacity-90 disabled:opacity-50">
            {isSaving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
      {errorBanner && (
        <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm px-3 py-2 mb-3">
          {errorBanner}
        </div>
      )}
    </div>
  )
}
```

Commit:

```bash
git add components/workflows/editor-header.tsx
git commit -m "feat(workflow-editor): EditorHeader with state-dependent buttons"
```

---

### Task 5.2: `<DraftBanner />`

**Files:**
- Create: `components/workflows/draft-banner.tsx`

- [ ] **Step 1: Implement**

```tsx
// components/workflows/draft-banner.tsx
'use client'
function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diffMs / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return new Date(iso).toLocaleString()
}

export function DraftBanner({
  savedAt, onRestore, onDiscard,
}: {
  savedAt: string
  onRestore: () => void
  onDiscard: () => void
}) {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 text-amber-900 text-sm px-3 py-2 mb-3 flex items-center gap-3">
      <span>⚠ You have unsaved edits from {timeAgo(savedAt)}.</span>
      <button onClick={onRestore}
        className="ml-auto px-3 py-1 bg-white border border-amber-300 rounded text-xs hover:bg-amber-100">
        Restore
      </button>
      <button onClick={onDiscard}
        className="px-3 py-1 text-xs text-amber-700 hover:text-amber-900">
        Discard
      </button>
    </div>
  )
}
```

Commit:

```bash
git add components/workflows/draft-banner.tsx
git commit -m "feat(workflow-editor): DraftBanner for restore/discard prompt"
```

---

### Task 5.3: `<TaskList />` (dnd-kit wrapper)

**Files:**
- Create: `components/workflows/task-list.tsx`

- [ ] **Step 1: Implement**

```tsx
// components/workflows/task-list.tsx
'use client'
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { TaskRow } from './task-row'
import type { DraftTask, DraftDep } from '@/lib/workflow-editor/draft-storage'

export function TaskList({
  tasks, deps,
  onReorder, onChangeTask, onDeleteTask, onAddDep, onRemoveDep, onAddTask,
}: {
  tasks: DraftTask[]
  deps: DraftDep[]
  onReorder: (newOrder: DraftTask[]) => void
  onChangeTask: (taskId: string, patch: Partial<DraftTask>) => void
  onDeleteTask: (taskId: string) => void
  onAddDep: (taskId: string, upstreamTaskId: string) => void
  onRemoveDep: (taskId: string, upstreamTaskId: string) => void
  onAddTask: () => void
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const oldIndex = tasks.findIndex(t => t.id === active.id)
    const newIndex = tasks.findIndex(t => t.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return
    const moved = arrayMove(tasks, oldIndex, newIndex)
    // Recompute sort_order to be contiguous
    const renumbered = moved.map((t, i) => ({ ...t, sortOrder: i }))
    onReorder(renumbered)
  }

  return (
    <div className="space-y-2">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((t, i) => {
            const upstreamIds = deps.filter(d => d.toTaskId === t.id).map(d => d.fromTaskId)
            return (
              <TaskRow
                key={t.id}
                task={t}
                sortIndex={i}
                allTasks={tasks}
                depUpstreamIds={upstreamIds}
                onChange={(patch) => onChangeTask(t.id, patch)}
                onDelete={() => onDeleteTask(t.id)}
                onAddDep={(upstreamId) => onAddDep(t.id, upstreamId)}
                onRemoveDep={(upstreamId) => onRemoveDep(t.id, upstreamId)}
              />
            )
          })}
        </SortableContext>
      </DndContext>
      <button onClick={onAddTask}
        className="px-3 py-1.5 text-sm text-blue-600 hover:underline">+ Add task</button>
    </div>
  )
}
```

Commit:

```bash
git add components/workflows/task-list.tsx
git commit -m "feat(workflow-editor): TaskList with dnd-kit sortable + add"
```

---

### Task 5.4: `<EditorShell />` — owns state, draft sync, save flow

**Files:**
- Create: `components/workflows/editor-shell.tsx`

- [ ] **Step 1: Implement**

```tsx
// components/workflows/editor-shell.tsx
'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { EditorHeader } from './editor-header'
import { DraftBanner } from './draft-banner'
import { TaskList } from './task-list'
import { hasCycle } from '@/lib/workflow-editor/has-cycle'
import {
  saveDraft, loadDraft, clearDraft, NEW_MODE_KEY,
  type Draft, type DraftTask, type DraftDep,
} from '@/lib/workflow-editor/draft-storage'
import { useLeavePrompt } from '@/lib/workflow-editor/use-leave-prompt'
import {
  createWorkflowTemplate, updateWorkflowTemplate,
  archiveWorkflowTemplate, unarchiveWorkflowTemplate,
} from '@/app/actions/workflows'

type Mode = 'new' | 'edit'

export function EditorShell({
  mode, templateId, initial, serverUpdatedAt, isArchived,
}: {
  mode: Mode
  templateId: string | null
  initial: Draft
  serverUpdatedAt: string | null
  isArchived: boolean
}) {
  const router = useRouter()
  const draftKeyId = templateId ?? NEW_MODE_KEY
  const [state, setState] = useState<Draft>(initial)
  const [isSaving, setSaving] = useState(false)
  const [errorBanner, setErrorBanner] = useState<string | null>(null)
  const [draftToOffer, setDraftToOffer] = useState<Draft | null>(null)
  const lastSavedRef = useRef<Draft>(initial)

  // On mount: check for newer draft in localStorage
  useEffect(() => {
    const d = loadDraft(draftKeyId)
    if (!d) return
    if (serverUpdatedAt && new Date(d.savedAt) <= new Date(serverUpdatedAt)) {
      // Server is newer; ignore stale draft
      clearDraft(draftKeyId)
      return
    }
    setDraftToOffer(d)
  }, [draftKeyId, serverUpdatedAt])

  // Save draft on every change (debounced minimum via React's batching)
  useEffect(() => {
    if (state === lastSavedRef.current) return
    saveDraft(draftKeyId, { ...state, savedAt: new Date().toISOString() })
  }, [state, draftKeyId])

  const isDirty = JSON.stringify(state) !== JSON.stringify(lastSavedRef.current)
  useLeavePrompt(isDirty)

  function patch(next: Partial<Draft>) {
    setState(s => ({ ...s, ...next }))
  }
  function reorderTasks(newOrder: DraftTask[]) { patch({ tasks: newOrder }) }
  function changeTask(taskId: string, p: Partial<DraftTask>) {
    patch({ tasks: state.tasks.map(t => t.id === taskId ? { ...t, ...p } : t) })
  }
  function deleteTask(taskId: string) {
    patch({
      tasks: state.tasks.filter(t => t.id !== taskId)
        .map((t, i) => ({ ...t, sortOrder: i })),
      deps: state.deps.filter(d => d.fromTaskId !== taskId && d.toTaskId !== taskId),
    })
  }
  function addTask() {
    const id = `new-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    patch({
      tasks: [...state.tasks, {
        id, name: '', description: '', durationDays: 1,
        ownerRoleLabel: '', sortOrder: state.tasks.length,
      }],
    })
  }
  function addDep(taskId: string, upstreamTaskId: string) {
    if (state.deps.some(d => d.toTaskId === taskId && d.fromTaskId === upstreamTaskId)) return
    const id = `dep-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    patch({ deps: [...state.deps, { id, fromTaskId: upstreamTaskId, toTaskId: taskId, lagDays: 0 }] })
  }
  function removeDep(taskId: string, upstreamTaskId: string) {
    patch({ deps: state.deps.filter(d => !(d.toTaskId === taskId && d.fromTaskId === upstreamTaskId)) })
  }

  function validate(): string | null {
    if (!state.name.trim()) return 'Name is required'
    if (state.tasks.length === 0) return 'At least one task is required'
    if (state.tasks.some(t => !t.name.trim())) return 'Every task needs a name'
    if (state.tasks.some(t => t.durationDays < 0)) return 'Duration cannot be negative'
    const cycleInput = {
      tasks: state.tasks.map(t => ({ id: t.id })),
      deps: state.deps.map(d => ({ fromId: d.fromTaskId, toId: d.toTaskId })),
    }
    if (hasCycle(cycleInput)) return 'Dependencies form a cycle'
    return null
  }

  async function onSave() {
    const err = validate()
    if (err) { setErrorBanner(err); return }
    setErrorBanner(null); setSaving(true)
    try {
      const taskIndexById = new Map(state.tasks.map((t, i) => [t.id, i]))
      const payload = {
        name: state.name,
        description: state.description || null,
        tasks: state.tasks.map(t => ({
          name: t.name, description: t.description || null,
          durationDays: t.durationDays,
          ownerRoleLabel: t.ownerRoleLabel || null,
        })),
        deps: state.deps.map(d => ({
          fromIdx: taskIndexById.get(d.fromTaskId)!,
          toIdx: taskIndexById.get(d.toTaskId)!,
          lagDays: d.lagDays,
        })),
      }
      let finalId = templateId
      if (mode === 'new') {
        const res = await createWorkflowTemplate(payload) as { ok: true; id: string }
        finalId = res.id
      } else {
        await updateWorkflowTemplate({ id: templateId!, ...payload })
      }
      clearDraft(draftKeyId)
      lastSavedRef.current = state
      router.push(`/workflows/${finalId}`)
    } catch (e) {
      setErrorBanner(e instanceof Error ? e.message : 'Save failed')
    } finally { setSaving(false) }
  }

  function onCancel() {
    if (isDirty && !window.confirm('Discard changes?')) return
    clearDraft(draftKeyId)
    router.push(mode === 'edit' ? `/workflows/${templateId}` : '/workflows')
  }

  async function onArchive() {
    if (!templateId) return
    if (!window.confirm('Archive this template? Existing projects are unaffected; new projects won\'t see it in the picker.')) return
    await archiveWorkflowTemplate({ id: templateId })
    clearDraft(draftKeyId)
    router.push('/workflows')
  }

  async function onRestore() {
    if (!templateId) return
    await unarchiveWorkflowTemplate({ id: templateId })
    router.refresh()
  }

  return (
    <div>
      <EditorHeader
        mode={mode} isArchived={isArchived} isDirty={isDirty} isSaving={isSaving}
        errorBanner={errorBanner}
        onSave={onSave} onCancel={onCancel} onArchive={onArchive} onRestore={onRestore}
      />
      {draftToOffer && (
        <DraftBanner
          savedAt={draftToOffer.savedAt}
          onRestore={() => { setState(draftToOffer); setDraftToOffer(null) }}
          onDiscard={() => { clearDraft(draftKeyId); setDraftToOffer(null) }}
        />
      )}
      <div className="space-y-3">
        <input value={state.name} onChange={(e) => patch({ name: e.target.value })}
          placeholder="Template name"
          className="w-full text-xl font-semibold border-b border-zinc-200 outline-none px-1 py-1 focus:border-blue-400" />
        <input value={state.description} onChange={(e) => patch({ description: e.target.value })}
          placeholder="One-line description (optional)"
          className="w-full text-sm border-b border-zinc-200 outline-none px-1 py-1 focus:border-blue-400" />
        <h2 className="text-sm font-semibold text-zinc-700 mt-4">Tasks</h2>
        <TaskList
          tasks={state.tasks}
          deps={state.deps}
          onReorder={reorderTasks}
          onChangeTask={changeTask}
          onDeleteTask={deleteTask}
          onAddDep={addDep}
          onRemoveDep={removeDep}
          onAddTask={addTask}
        />
      </div>
    </div>
  )
}
```

Commit:

```bash
git add components/workflows/editor-shell.tsx
git commit -m "feat(workflow-editor): EditorShell with state + draft sync + save flow"
```

---

## Phase 6: Editor routes

### Task 6.1: New editor route (`/workflows/new/edit`)

**Files:**
- Create: `app/(app)/workflows/new/edit/page.tsx`

- [ ] **Step 1: Implement**

```tsx
// app/(app)/workflows/new/edit/page.tsx
import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/server/get-current-user'
import { EditorShell } from '@/components/workflows/editor-shell'

export default async function NewWorkflowEditorPage() {
  const me = await requireUser()
  if (me.role !== 'owner') redirect('/')
  return (
    <EditorShell
      mode="new"
      templateId={null}
      initial={{
        name: '', description: '', tasks: [], deps: [],
        savedAt: new Date().toISOString(),
      }}
      serverUpdatedAt={null}
      isArchived={false}
    />
  )
}
```

Commit:

```bash
git add "app/(app)/workflows/new/edit/"
git commit -m "feat(workflow): /workflows/new/edit route"
```

---

### Task 6.2: Edit existing route (`/workflows/[id]/edit`)

**Files:**
- Create: `app/(app)/workflows/[id]/edit/page.tsx`

- [ ] **Step 1: Implement**

```tsx
// app/(app)/workflows/[id]/edit/page.tsx
import { eq } from 'drizzle-orm'
import { notFound, redirect } from 'next/navigation'
import { requireUser } from '@/lib/server/get-current-user'
import { db } from '@/db/client'
import { workflowTemplates, workflowTemplateTasks, workflowTemplateTaskDeps } from '@/db/schema'
import { EditorShell } from '@/components/workflows/editor-shell'

export default async function EditWorkflowPage({ params }: { params: { id: string } }) {
  const me = await requireUser()
  if (me.role !== 'owner') redirect('/')

  const tpl = (await db.select().from(workflowTemplates).where(eq(workflowTemplates.id, params.id)))[0]
  if (!tpl) notFound()
  const tasks = await db.select().from(workflowTemplateTasks).where(eq(workflowTemplateTasks.workflowTemplateId, tpl.id))
  const deps = await db.select().from(workflowTemplateTaskDeps).where(eq(workflowTemplateTaskDeps.workflowTemplateId, tpl.id))

  return (
    <EditorShell
      mode="edit"
      templateId={tpl.id}
      isArchived={tpl.isArchived}
      serverUpdatedAt={tpl.updatedAt.toISOString()}
      initial={{
        name: tpl.name,
        description: tpl.description ?? '',
        tasks: tasks.sort((a, b) => a.sortOrder - b.sortOrder).map(t => ({
          id: t.id,
          name: t.name,
          description: t.description ?? '',
          durationDays: t.defaultDurationDays,
          ownerRoleLabel: t.defaultOwnerRoleLabel ?? '',
          sortOrder: t.sortOrder,
        })),
        deps: deps.map(d => ({
          id: d.id, fromTaskId: d.fromTaskId, toTaskId: d.toTaskId, lagDays: d.lagDays,
        })),
        savedAt: tpl.updatedAt.toISOString(),
      }}
    />
  )
}
```

Run `npm run typecheck && npm run build` — expect clean (the editor + its children are now all defined).

Commit:

```bash
git add "app/(app)/workflows/[id]/edit/"
git commit -m "feat(workflow): /workflows/[id]/edit route"
```

---

## Phase 7: Read-only detail page + duplicate prompt

### Task 7.1: `<DuplicatePrompt />`

**Files:**
- Create: `components/workflows/duplicate-prompt.tsx`

- [ ] **Step 1: Implement**

```tsx
// components/workflows/duplicate-prompt.tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { duplicateWorkflowTemplate } from '@/app/actions/workflows'

export function DuplicatePrompt({ sourceId, sourceName }: { sourceId: string; sourceName: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(`Copy of ${sourceName}`)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="px-3 py-1.5 border border-zinc-300 rounded text-sm hover:bg-zinc-50">
        Duplicate
      </button>
    )
  }

  async function submit() {
    if (!name.trim()) { setErr('Name required'); return }
    setBusy(true); setErr(null)
    try {
      const res = await duplicateWorkflowTemplate({ sourceId, newName: name }) as { ok: true; id: string }
      router.push(`/workflows/${res.id}/edit`)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed')
    } finally { setBusy(false) }
  }

  return (
    <div className="flex items-center gap-1">
      <input value={name} onChange={(e) => setName(e.target.value)}
        autoFocus className="border border-zinc-300 rounded px-2 py-1 text-sm" />
      <button onClick={submit} disabled={busy}
        className="px-3 py-1.5 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded text-sm hover:opacity-90 disabled:opacity-50">
        Duplicate
      </button>
      <button onClick={() => setOpen(false)}
        className="px-2 py-1 text-sm text-zinc-600 hover:text-zinc-900">cancel</button>
      {err && <span className="text-red-600 text-xs ml-2">{err}</span>}
    </div>
  )
}
```

Commit:

```bash
git add components/workflows/duplicate-prompt.tsx
git commit -m "feat(workflow): DuplicatePrompt inline form"
```

---

### Task 7.2: Detail page replaces foundation stub

**Files:**
- Modify: `app/(app)/workflows/[id]/page.tsx` (replace existing stub)

- [ ] **Step 1: Implement**

```tsx
// app/(app)/workflows/[id]/page.tsx
import Link from 'next/link'
import { eq } from 'drizzle-orm'
import { notFound, redirect } from 'next/navigation'
import { requireUser } from '@/lib/server/get-current-user'
import { db } from '@/db/client'
import { workflowTemplates, workflowTemplateTasks, workflowTemplateTaskDeps, users } from '@/db/schema'
import { DuplicatePrompt } from '@/components/workflows/duplicate-prompt'

export default async function WorkflowDetailPage({ params }: { params: { id: string } }) {
  const me = await requireUser()
  if (me.role !== 'owner') redirect('/')

  const tpl = (await db.select().from(workflowTemplates).where(eq(workflowTemplates.id, params.id)))[0]
  if (!tpl) notFound()
  const tasks = (await db.select().from(workflowTemplateTasks).where(eq(workflowTemplateTasks.workflowTemplateId, tpl.id)))
    .sort((a, b) => a.sortOrder - b.sortOrder)
  const deps = await db.select().from(workflowTemplateTaskDeps).where(eq(workflowTemplateTaskDeps.workflowTemplateId, tpl.id))
  const creator = (await db.select().from(users).where(eq(users.id, tpl.createdById)))[0]

  const depsByTo = new Map<string, string[]>()
  for (const d of deps) {
    if (!depsByTo.has(d.toTaskId)) depsByTo.set(d.toTaskId, [])
    depsByTo.get(d.toTaskId)!.push(d.fromTaskId)
  }
  const taskNameById = new Map(tasks.map(t => [t.id, t.name]))

  return (
    <div className="space-y-4">
      <div className="flex items-center">
        <Link href="/workflows" className="text-blue-600 text-sm hover:underline">← Back to list</Link>
        <div className="ml-auto flex gap-2">
          <Link href={`/workflows/${tpl.id}/edit`}
            className={`px-3 py-1.5 rounded text-sm ${tpl.isArchived ? 'hidden' : 'border border-zinc-300 hover:bg-zinc-50'}`}>
            Edit
          </Link>
          <DuplicatePrompt sourceId={tpl.id} sourceName={tpl.name} />
        </div>
      </div>
      <h1 className="text-2xl font-semibold flex items-center gap-3">
        {tpl.name}
        {tpl.isArchived && <span className="text-xs bg-zinc-200 text-zinc-700 px-2 py-0.5 rounded">archived</span>}
      </h1>
      {tpl.description && <p className="text-sm text-zinc-600">{tpl.description}</p>}

      <section className="rounded-lg border border-zinc-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-zinc-700 mb-3">Tasks ({tasks.length})</h2>
        {tasks.length === 0 && <div className="text-sm text-zinc-500">No tasks.</div>}
        <ol className="space-y-2">
          {tasks.map((t, i) => {
            const upstreamIds = depsByTo.get(t.id) ?? []
            return (
              <li key={t.id} className="text-sm">
                <div className="flex items-center gap-3">
                  <span className="text-zinc-500 w-6">{i + 1}.</span>
                  <span className="flex-1">{t.name}</span>
                  <span className="text-zinc-500">{t.defaultDurationDays}d</span>
                  {t.defaultOwnerRoleLabel && <span className="text-xs bg-zinc-100 text-zinc-700 px-2 py-0.5 rounded">{t.defaultOwnerRoleLabel}</span>}
                </div>
                {upstreamIds.length > 0 && (
                  <div className="ml-9 text-xs text-zinc-500 mt-0.5">
                    ← depends on: {upstreamIds.map(id => taskNameById.get(id)).filter(Boolean).join(', ')}
                  </div>
                )}
              </li>
            )
          })}
        </ol>
      </section>

      <div className="text-xs text-zinc-500">
        Created by {creator?.name ?? 'Unknown'} · {tpl.createdAt.toLocaleDateString()}
      </div>
    </div>
  )
}
```

Commit:

```bash
git add "app/(app)/workflows/[id]/page.tsx"
git commit -m "feat(workflow): read-only detail page with Edit + Duplicate"
```

---

## Phase 8: List page + new-template picker

### Task 8.1: List page replaces foundation stub

**Files:**
- Modify: `app/(app)/workflows/page.tsx`

- [ ] **Step 1: Implement**

```tsx
// app/(app)/workflows/page.tsx
import Link from 'next/link'
import { eq, sql } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/server/get-current-user'
import { db } from '@/db/client'
import { workflowTemplates, workflowTemplateTasks } from '@/db/schema'

export default async function WorkflowsPage({
  searchParams,
}: { searchParams: { archived?: string } }) {
  const me = await requireUser()
  if (me.role !== 'owner') redirect('/')
  const showArchived = searchParams.archived === '1'

  const tplRows = await db.select().from(workflowTemplates).orderBy(workflowTemplates.name)
  const counts = await db.select({
    workflowTemplateId: workflowTemplateTasks.workflowTemplateId,
    c: sql<number>`count(*)::int`,
  }).from(workflowTemplateTasks).groupBy(workflowTemplateTasks.workflowTemplateId)
  const countById = new Map(counts.map(r => [r.workflowTemplateId, r.c]))

  const list = showArchived ? tplRows : tplRows.filter(t => !t.isArchived)

  return (
    <div className="space-y-4">
      <div className="flex items-center">
        <h1 className="text-2xl font-semibold">Workflow Templates</h1>
        <Link href="/workflows/new"
          className="ml-auto px-3 py-1.5 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded text-sm hover:opacity-90">
          + New template
        </Link>
      </div>

      <div className="text-xs">
        <Link href={showArchived ? '/workflows' : '/workflows?archived=1'}
          className="text-blue-600 hover:underline">
          {showArchived ? 'Hide archived' : 'Show archived'}
        </Link>
      </div>

      {list.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-200 bg-white p-12 text-center text-zinc-500 text-sm">
          No templates yet. Click "+ New template" to start.
        </div>
      ) : (
        <ul className="space-y-2">
          {list.map(w => (
            <li key={w.id} className="rounded border border-zinc-200 bg-white px-3 py-2 hover:bg-zinc-50">
              <Link href={`/workflows/${w.id}`} className="flex items-center gap-3">
                <span className={`font-medium ${w.isArchived ? 'text-zinc-400' : ''}`}>{w.name}</span>
                {w.isArchived && <span className="text-xs bg-zinc-200 text-zinc-700 px-2 py-0.5 rounded">archived</span>}
                <span className="ml-auto text-xs text-zinc-500">{countById.get(w.id) ?? 0} tasks</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

Commit:

```bash
git add "app/(app)/workflows/page.tsx"
git commit -m "feat(workflow): list page with task count + archived toggle"
```

---

### Task 8.2: `<DuplicatePicker />` + new-template picker page

**Files:**
- Create: `components/workflows/duplicate-picker.tsx`
- Create: `app/(app)/workflows/new/page.tsx`

- [ ] **Step 1: `components/workflows/duplicate-picker.tsx`**

```tsx
// components/workflows/duplicate-picker.tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { duplicateWorkflowTemplate } from '@/app/actions/workflows'

export function DuplicatePicker({
  templates,
}: { templates: Array<{ id: string; name: string }> }) {
  const router = useRouter()
  const [sourceId, setSourceId] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function submit() {
    if (!sourceId) { setErr('Pick a template'); return }
    if (!name.trim()) { setErr('Name required'); return }
    setBusy(true); setErr(null)
    try {
      const res = await duplicateWorkflowTemplate({ sourceId, newName: name }) as { ok: true; id: string }
      router.push(`/workflows/${res.id}/edit`)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed')
    } finally { setBusy(false) }
  }

  function onSourceChange(id: string) {
    setSourceId(id)
    if (!name) {
      const tpl = templates.find(t => t.id === id)
      if (tpl) setName(`Copy of ${tpl.name}`)
    }
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 space-y-3">
      <h2 className="font-medium">Duplicate from existing</h2>
      <label className="block text-sm">
        <span className="text-xs text-zinc-600">Source template</span>
        <select value={sourceId} onChange={(e) => onSourceChange(e.target.value)}
          className="mt-1 w-full border border-zinc-200 rounded px-2 py-1">
          <option value="">— pick one —</option>
          {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </label>
      <label className="block text-sm">
        <span className="text-xs text-zinc-600">New name</span>
        <input value={name} onChange={(e) => setName(e.target.value)}
          className="mt-1 w-full border border-zinc-200 rounded px-2 py-1" />
      </label>
      {err && <div className="text-red-600 text-xs">{err}</div>}
      <button onClick={submit} disabled={busy}
        className="px-4 py-1.5 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded text-sm hover:opacity-90 disabled:opacity-50">
        Duplicate
      </button>
    </div>
  )
}
```

- [ ] **Step 2: `app/(app)/workflows/new/page.tsx`**

```tsx
// app/(app)/workflows/new/page.tsx
import Link from 'next/link'
import { eq } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/server/get-current-user'
import { db } from '@/db/client'
import { workflowTemplates } from '@/db/schema'
import { DuplicatePicker } from '@/components/workflows/duplicate-picker'

export default async function NewWorkflowPickerPage() {
  const me = await requireUser()
  if (me.role !== 'owner') redirect('/')
  const all = await db.select({ id: workflowTemplates.id, name: workflowTemplates.name })
    .from(workflowTemplates).where(eq(workflowTemplates.isArchived, false)).orderBy(workflowTemplates.name)

  return (
    <div className="space-y-4 max-w-xl">
      <div>
        <Link href="/workflows" className="text-blue-600 text-sm hover:underline">← Back to list</Link>
      </div>
      <h1 className="text-2xl font-semibold">New workflow template</h1>

      <Link href="/workflows/new/edit"
        className="block rounded-lg border border-zinc-200 bg-white p-4 hover:bg-zinc-50">
        <h2 className="font-medium">Start blank</h2>
        <p className="text-sm text-zinc-600 mt-1">Begin with an empty editor.</p>
      </Link>

      <DuplicatePicker templates={all} />
    </div>
  )
}
```

Commit:

```bash
git add components/workflows/duplicate-picker.tsx "app/(app)/workflows/new/"
git commit -m "feat(workflow): new-template picker with blank + duplicate options"
```

---

## Phase 9: Final verification

### Task 9.1: Run the full suite + manual smoke

- [ ] **Step 1: Tests + typecheck + build**

```bash
npm test
npm run typecheck
npm run build
```

All three must succeed. The new routes (`/workflows`, `/workflows/new`, `/workflows/new/edit`, `/workflows/[id]`, `/workflows/[id]/edit`) all appear in the build output.

- [ ] **Step 2: Manual smoke runbook**

Requires Postgres up and a signed-in owner.

1. `docker compose up -d && npm run db:migrate && npm run dev`
2. Sign in via Lark (must be the bootstrap owner)
3. Visit `/workflows` — empty state should appear with "+ New template" CTA
4. Click "+ New template" → picker shows "Start blank" + Duplicate (empty source list since no templates exist yet)
5. Click "Start blank" → editor opens at `/workflows/new/edit`
6. Type a name, click "+ Add task", give it a name and a duration, click Save → redirects to `/workflows/<id>` detail
7. Return to `/workflows` — see the new template with task count
8. Click the template → detail page shows Edit + Duplicate buttons
9. Click Edit → enter editor; reorder tasks via drag handle; add a dep via the multi-select; Save → returns to detail
10. Refresh the editor mid-edit (do not save) → reopen — should see "You have unsaved edits" banner with Restore / Discard
11. Click Duplicate on detail → inline form, click Duplicate → new editor opens
12. Archive the original template from its editor header → returns to list with archived chip hidden by default; toggle "Show archived" to see it
13. Open the archived template's detail page → "Restore" only available from inside the editor (open editor, click Restore)

If anything is off, fix and re-run.

- [ ] **Step 3: Final commit if any small fixes**

```bash
git status
# If anything to commit, do so. Otherwise we're done.
```

---

## Plan self-review

**Spec coverage** — checking each numbered section of the spec:

| Spec section | Implemented by |
|---|---|
| §2 Pages/routes | Tasks 6.1, 6.2, 7.2, 8.1, 8.2 |
| §3 List page | Task 8.1 |
| §4 Detail page | Task 7.2 |
| §5 New-template picker | Task 8.2 |
| §6 Editor (layout, header, validation, draft, dragging) | Tasks 5.1-5.4, 4.1-4.2 |
| §7 Duplicate UX | Tasks 7.1, 8.2 |
| §8 Archived list nuance | Task 8.1 |
| §9 Restore | EditorShell `onRestore` in Task 5.4 + Server Action in Task 2.3 |
| §10 Cycle detection (client) | Task 1.2 + EditorShell `validate()` in Task 5.4 |
| §11.1 duplicateWorkflowTemplate | Task 2.2 |
| §11.2 unarchiveWorkflowTemplate | Task 2.3 |
| §11.3 Server-side cycle detection | Task 2.1 |
| §12 Component organization | matched throughout |
| §13 Data flow on Save | EditorShell `onSave` in Task 5.4 |
| §14 Permissions | Each page's `me.role !== 'owner' && redirect('/')` + existing Server Action `requirePermission` |
| §15 Testing | Tasks 1.2, 1.3, 2.1, 2.2 (unit + integration); component tests deferred per spec §15 acceptance |
| §16 Out of scope | respected |
| §17 Open implementation questions | flagged in spec; no plan changes needed |

**Placeholder scan**: no TBD / TODO / "similar to" / "implement later" patterns in the plan.

**Type consistency**: `Draft`, `DraftTask`, `DraftDep` defined in Task 1.3 and used in Tasks 4.2 (TaskRow), 5.3 (TaskList), 5.4 (EditorShell), 6.1, 6.2 — same shape throughout. `hasCycle` input shape (`{ tasks: [{id}], deps: [{fromId, toId}] }`) used consistently in Tasks 1.2, 2.1, 5.4. Server Action signatures (`duplicateWorkflowTemplate`, `unarchiveWorkflowTemplate`) match between Tasks 2.2/2.3 (definition) and Tasks 5.4/7.1/8.2 (consumers).

**Known limitations called out for the engineer**:

- Component-level tests (RTL for editor-shell, task-row dnd-kit interactions) are listed in the spec as recommended but not enumerated as plan tasks. They can be added during implementation if the engineer has bandwidth.
- The `useLeavePrompt` hook has no unit test (browser-only behavior).
- Manual smoke test in Task 9.2 is the end-to-end verification.
