# Workflow Task Dates + List Page Enhancements — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `workflow_template_tasks.default_duration_days` with explicit `default_start_day` / `default_end_day` columns, persist aggregate `total_start_day` / `total_end_day` / `total_duration_days` on `workflow_templates`, rework the editor UI to type start/end days per task with a live workflow-level preview, simplify the snapshot to copy dates straight through, and add keyword search + richer cards on the `/workflows` list page.

**Architecture:** Half-open 1-indexed day numbering (see spec §2). A new pure helper `lib/workflow-editor/compute-totals.ts` is used by both the editor client component (live preview) and the service layer (persisted aggregates) — single source of truth. The migration is split in two so the codebase stays runnable between commits: `0009_workflow_task_dates_add.sql` adds new columns + backfills + adds CHECK, then code is switched over, then `0010_workflow_task_dates_drop_duration.sql` removes the old column. The `/workflows` list query moves from inline-in-RSC to a dedicated `db/queries/workflow-templates.ts` function so the new `?q=` filter is testable.

**Tech Stack:** Same as the rest of the repo — Next.js 14 App Router (RSC + Server Actions), TypeScript, Drizzle ORM + Postgres 16, Tailwind, `@dnd-kit/sortable` (already installed), Vitest with the test Postgres on `:5433`. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-05-27-workflow-task-dates-design.md`

---

## File map

**Created:**
- `db/migrations/0009_workflow_task_dates_add.sql`
- `db/migrations/0010_workflow_task_dates_drop_duration.sql`
- `lib/workflow-editor/compute-totals.ts` (+ `.test.ts`)
- `db/queries/workflow-templates.ts` (+ `.test.ts`)
- `components/workflows/list-search.tsx`
- `lib/services/workflow-template-service.dates.test.ts`

**Modified:**
- `db/schema/workflow_template_tasks.ts`
- `db/schema/workflow_templates.ts`
- `db/migrations/meta/_journal.json`
- `lib/services/workflow-template-service.ts`
- `lib/snapshot/apply-schedule.ts`
- `lib/snapshot/snapshot-workflows.ts`
- `lib/critical-path/index.ts`
- `app/actions/workflows.ts`
- `lib/workflow-editor/draft-storage.ts`
- `components/workflows/editor-shell.tsx`
- `components/workflows/task-row.tsx`
- `components/workflows/task-list.tsx`
- `app/(app)/workflows/page.tsx`
- `app/(app)/workflows/[id]/page.tsx`
- `db/seed.ts`
- `tests/fixtures/workflow-templates.ts`
- `lib/critical-path/index.test.ts`
- `lib/snapshot/apply-schedule.test.ts`
- `lib/snapshot/snapshot-workflows.test.ts`
- `lib/services/workflow-template-service.test.ts`
- `lib/services/workflow-template-service.cycle.test.ts`
- `lib/workflow-editor/draft-storage.test.ts`

---

## Phase 1 — Shared compute-totals helper (no DB)

This is fully self-contained and unblocks Phase 2.

### Task 1.1: `compute-totals.ts` pure helper

**Files:**
- Create: `lib/workflow-editor/compute-totals.ts`
- Create: `lib/workflow-editor/compute-totals.test.ts`

- [ ] **Step 1: Write tests first**

```ts
// lib/workflow-editor/compute-totals.test.ts
import { describe, it, expect } from 'vitest'
import { computeTotals } from './compute-totals'

describe('computeTotals', () => {
  it('zero tasks → all zeros', () => {
    expect(computeTotals([])).toEqual({ totalStartDay: 0, totalEndDay: 0, totalDurationDays: 0 })
  })

  it('single task → start/end/duration mirror the task', () => {
    expect(computeTotals([{ startDay: 1, endDay: 6 }])).toEqual({
      totalStartDay: 1, totalEndDay: 6, totalDurationDays: 5,
    })
  })

  it('multiple tasks → min start, max end, max-min duration', () => {
    expect(computeTotals([
      { startDay: 1, endDay: 6 },
      { startDay: 6, endDay: 11 },
      { startDay: 11, endDay: 14 },
    ])).toEqual({ totalStartDay: 1, totalEndDay: 14, totalDurationDays: 13 })
  })

  it('overlapping tasks → still min/max', () => {
    expect(computeTotals([
      { startDay: 1,  endDay: 10 },
      { startDay: 3,  endDay: 7  },
      { startDay: 5,  endDay: 12 },
    ])).toEqual({ totalStartDay: 1, totalEndDay: 12, totalDurationDays: 11 })
  })

  it('zero-duration milestone task → counted in min/max', () => {
    expect(computeTotals([
      { startDay: 1, endDay: 5 },
      { startDay: 5, endDay: 5 },
    ])).toEqual({ totalStartDay: 1, totalEndDay: 5, totalDurationDays: 4 })
  })
})
```

- [ ] **Step 2: Verify the tests fail**

```bash
npm test -- lib/workflow-editor/compute-totals.test.ts
```
Expected: FAIL with "Cannot find module './compute-totals'".

- [ ] **Step 3: Write the implementation**

```ts
// lib/workflow-editor/compute-totals.ts
export type TaskDates = { startDay: number; endDay: number }
export type Totals = {
  totalStartDay: number
  totalEndDay: number
  totalDurationDays: number
}

export function computeTotals(tasks: TaskDates[]): Totals {
  if (tasks.length === 0) {
    return { totalStartDay: 0, totalEndDay: 0, totalDurationDays: 0 }
  }
  const totalStartDay = Math.min(...tasks.map(t => t.startDay))
  const totalEndDay   = Math.max(...tasks.map(t => t.endDay))
  return { totalStartDay, totalEndDay, totalDurationDays: totalEndDay - totalStartDay }
}
```

- [ ] **Step 4: Verify tests pass**

```bash
npm test -- lib/workflow-editor/compute-totals.test.ts
```
Expected: all 5 specs PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/workflow-editor/compute-totals.ts lib/workflow-editor/compute-totals.test.ts
git commit -m "feat(workflow-editor): computeTotals pure helper"
```

---

## Phase 2 — Additive migration: new columns + backfill

This phase adds the new columns while leaving `default_duration_days` in place, so existing code keeps working between commits.

### Task 2.1: Write migration `0009_workflow_task_dates_add.sql`

**Files:**
- Create: `db/migrations/0009_workflow_task_dates_add.sql`
- Modify: `db/migrations/meta/_journal.json`

- [ ] **Step 1: Write the SQL**

The backfill walks the dep DAG per-template to compute `start_day` / `end_day` in 1-indexed half-open form. We do this in PL/pgSQL inside the migration so it's atomic and survives re-runs against an empty DB (the cursor loop is a no-op if there are no templates).

```sql
-- db/migrations/0009_workflow_task_dates_add.sql
-- Add per-task start/end day columns (half-open, 1-indexed); add workflow-level aggregates.
-- Backfill from existing default_duration_days + FS deps.

ALTER TABLE workflow_template_tasks
  ADD COLUMN default_start_day integer,
  ADD COLUMN default_end_day   integer;

ALTER TABLE workflow_templates
  ADD COLUMN total_start_day    integer NOT NULL DEFAULT 0,
  ADD COLUMN total_end_day      integer NOT NULL DEFAULT 0,
  ADD COLUMN total_duration_days integer NOT NULL DEFAULT 0;

-- Backfill per-task dates by topo-sorting deps inside each template.
DO $$
DECLARE
  tpl_row RECORD;
  task_row RECORD;
  pred_end integer;
  computed_start integer;
BEGIN
  FOR tpl_row IN SELECT id FROM workflow_templates LOOP
    -- For each task in this template (in any order; we'll iterate until all are set).
    -- Simple fixed-point: keep looping until no task changes.
    LOOP
      DECLARE changed boolean := false;
      BEGIN
        FOR task_row IN
          SELECT id, default_duration_days
          FROM workflow_template_tasks
          WHERE workflow_template_id = tpl_row.id
            AND default_start_day IS NULL
        LOOP
          -- Are all predecessors of this task already backfilled?
          IF NOT EXISTS (
            SELECT 1 FROM workflow_template_task_deps d
            JOIN workflow_template_tasks t ON t.id = d.from_task_id
            WHERE d.to_task_id = task_row.id
              AND t.default_end_day IS NULL
          ) THEN
            -- Compute start = max(predecessor.end + lag) OR 1 if none. (Half-open: +0 between adjacent tasks; lag stored as offset to add.)
            SELECT COALESCE(MAX(t.default_end_day + d.lag_days), 1)
              INTO computed_start
              FROM workflow_template_task_deps d
              JOIN workflow_template_tasks t ON t.id = d.from_task_id
              WHERE d.to_task_id = task_row.id;
            UPDATE workflow_template_tasks
               SET default_start_day = computed_start,
                   default_end_day   = computed_start + task_row.default_duration_days
             WHERE id = task_row.id;
            changed := true;
          END IF;
        END LOOP;
        EXIT WHEN NOT changed;
      END;
    END LOOP;
  END LOOP;
END $$;

-- Lock down per-task columns.
ALTER TABLE workflow_template_tasks
  ALTER COLUMN default_start_day SET NOT NULL,
  ALTER COLUMN default_end_day   SET NOT NULL;

ALTER TABLE workflow_template_tasks
  ADD CONSTRAINT chk_default_end_after_start CHECK (default_end_day >= default_start_day);

-- Backfill workflow-level aggregates.
UPDATE workflow_templates t SET
  total_start_day    = COALESCE(sub.min_s, 0),
  total_end_day      = COALESCE(sub.max_e, 0),
  total_duration_days = COALESCE(sub.max_e - sub.min_s, 0)
FROM (
  SELECT workflow_template_id, MIN(default_start_day) AS min_s, MAX(default_end_day) AS max_e
  FROM workflow_template_tasks
  GROUP BY workflow_template_id
) sub
WHERE t.id = sub.workflow_template_id;
```

- [ ] **Step 2: Append journal entry**

Open `db/migrations/meta/_journal.json` and add this entry to the `entries` array (after the existing `0008_password_auth` entry). The `when` value is the current epoch ms — use `Date.now()` from a Node REPL or hard-code a timestamp greater than the existing 1779913897017.

```json
    {
      "idx": 9,
      "version": "7",
      "when": 1780000000000,
      "tag": "0009_workflow_task_dates_add",
      "breakpoints": true
    }
```

- [ ] **Step 3: Apply to dev DB**

```bash
npm run db:migrate
```
Expected: prints something like `Applied 0009_workflow_task_dates_add`.

- [ ] **Step 4: Apply to test DB**

```bash
DATABASE_URL=postgres://buildflow:buildflow_dev@localhost:5433/buildflow_test npm run db:migrate
```
Expected: same `Applied 0009...` line.

- [ ] **Step 5: Smoke check**

```bash
docker exec buildflow-postgres psql -U buildflow -d buildflow -c "\d workflow_template_tasks"
docker exec buildflow-postgres psql -U buildflow -d buildflow -c "\d workflow_templates"
```
Expected: see `default_start_day` and `default_end_day` (NOT NULL) on `workflow_template_tasks`; `total_start_day` / `total_end_day` / `total_duration_days` (NOT NULL DEFAULT 0) on `workflow_templates`; `chk_default_end_after_start` CHECK constraint present.

- [ ] **Step 6: Commit**

```bash
git add db/migrations/0009_workflow_task_dates_add.sql db/migrations/meta/_journal.json
git commit -m "feat(db): add workflow template task start/end day columns + aggregates"
```

---

### Task 2.2: Schema TS — add fields (keep old)

**Files:**
- Modify: `db/schema/workflow_template_tasks.ts`
- Modify: `db/schema/workflow_templates.ts`

- [ ] **Step 1: Edit `workflow_template_tasks.ts`**

```ts
// db/schema/workflow_template_tasks.ts
import { pgTable, uuid, text, integer } from 'drizzle-orm/pg-core'
import { workflowTemplates } from './workflow_templates'

export const workflowTemplateTasks = pgTable('workflow_template_tasks', {
  id: uuid('id').defaultRandom().primaryKey(),
  workflowTemplateId: uuid('workflow_template_id').notNull().references(() => workflowTemplates.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  defaultDurationDays: integer('default_duration_days').notNull(),
  defaultStartDay: integer('default_start_day').notNull(),
  defaultEndDay: integer('default_end_day').notNull(),
  defaultOwnerRoleLabel: text('default_owner_role_label'),
  sortOrder: integer('sort_order').notNull(),
})
export type WorkflowTemplateTask = typeof workflowTemplateTasks.$inferSelect
```

- [ ] **Step 2: Edit `workflow_templates.ts`**

```ts
// db/schema/workflow_templates.ts
import { pgTable, uuid, text, boolean, timestamp, integer } from 'drizzle-orm/pg-core'
import { users } from './users'

export const workflowTemplates = pgTable('workflow_templates', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  createdById: uuid('created_by_id').notNull().references(() => users.id),
  isArchived: boolean('is_archived').notNull().default(false),
  totalStartDay: integer('total_start_day').notNull().default(0),
  totalEndDay: integer('total_end_day').notNull().default(0),
  totalDurationDays: integer('total_duration_days').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})
export type WorkflowTemplate = typeof workflowTemplates.$inferSelect
```

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```
Expected: PASS (no type errors — service still references `defaultDurationDays`, which is fine; the new fields are additive).

- [ ] **Step 4: Run all tests to confirm nothing broke**

```bash
npm test
```
Expected: all tests PASS. Reason: services still write `defaultDurationDays`; new task fields have `NOT NULL` but … wait — this WILL break inserts because we added NOT NULL columns and the service code doesn't set them.

**If Step 4 fails with NOT NULL errors on `default_start_day`:** roll forward to Task 2.3 immediately. Don't commit yet. The schema TS change isn't useful in isolation.

- [ ] **Step 5: Hold the commit until Task 2.3 is ready**

Do NOT commit yet. The schema TS change must be paired with the service write change. Continue directly to Task 2.3.

---

### Task 2.3: Service — write new columns

The service must populate `defaultStartDay` / `defaultEndDay` on every task insert and aggregate `total*` on the template row. Keep also writing `defaultDurationDays` (consistency for now; the column is dropped in Phase 4).

**Files:**
- Modify: `lib/services/workflow-template-service.ts`

- [ ] **Step 1: Update `TaskInput` type and service body**

Update the file. The full new content of `lib/services/workflow-template-service.ts`:

```ts
import { eq } from 'drizzle-orm'
import type { DB } from '@/db/client'
import { workflowTemplates, workflowTemplateTasks, workflowTemplateTaskDeps } from '@/db/schema'
import { NotFoundError, ValidationError } from '@/lib/server/errors'
import { hasCycle } from '@/lib/workflow-editor/has-cycle'
import { computeTotals } from '@/lib/workflow-editor/compute-totals'

type TaskInput = {
  name: string
  description?: string | null
  startDay: number
  endDay: number
  ownerRoleLabel?: string | null
}
type DepInput  = { fromIdx: number; toIdx: number; lagDays: number }

function validateTaskDates(tasks: TaskInput[]) {
  for (const t of tasks) {
    if (!Number.isInteger(t.startDay) || t.startDay < 1) {
      throw new ValidationError(`Task "${t.name}": startDay must be an integer >= 1`)
    }
    if (!Number.isInteger(t.endDay) || t.endDay < t.startDay) {
      throw new ValidationError(`Task "${t.name}": endDay must be an integer >= startDay`)
    }
  }
}

export const workflowTemplateService = {
  async create(input: {
    createdById: string
    name: string
    description?: string | null
    tasks: TaskInput[]
    deps: DepInput[]
  }, db: DB) {
    if (input.tasks.length === 0) throw new ValidationError('Template must have at least one task')
    validateTaskDates(input.tasks)

    const fakeTasks = input.tasks.map((_, i) => ({ id: String(i) }))
    const fakeDeps = input.deps.map(d => ({ fromId: String(d.fromIdx), toId: String(d.toIdx) }))
    if (hasCycle({ tasks: fakeTasks, deps: fakeDeps })) {
      throw new ValidationError('Dependencies form a cycle')
    }

    const totals = computeTotals(input.tasks.map(t => ({ startDay: t.startDay, endDay: t.endDay })))

    return db.transaction(async (tx) => {
      const [tpl] = await tx.insert(workflowTemplates).values({
        name: input.name,
        description: input.description ?? null,
        createdById: input.createdById,
        totalStartDay: totals.totalStartDay,
        totalEndDay: totals.totalEndDay,
        totalDurationDays: totals.totalDurationDays,
      }).returning()

      const insertedTasks = await tx.insert(workflowTemplateTasks).values(
        input.tasks.map((t, i) => ({
          workflowTemplateId: tpl.id,
          name: t.name,
          description: t.description ?? null,
          defaultDurationDays: t.endDay - t.startDay,
          defaultStartDay: t.startDay,
          defaultEndDay: t.endDay,
          defaultOwnerRoleLabel: t.ownerRoleLabel ?? null,
          sortOrder: i,
        })),
      ).returning()

      if (input.deps.length > 0) {
        await tx.insert(workflowTemplateTaskDeps).values(
          input.deps.map(d => {
            if (d.fromIdx === d.toIdx) throw new ValidationError('Self-dependency not allowed')
            return {
              workflowTemplateId: tpl.id,
              fromTaskId: insertedTasks[d.fromIdx].id,
              toTaskId:   insertedTasks[d.toIdx].id,
              lagDays: d.lagDays,
            }
          }),
        )
      }
      return tpl
    })
  },

  async update(id: string, input: {
    name?: string
    description?: string | null
    tasks: TaskInput[]
    deps: DepInput[]
  }, db: DB) {
    validateTaskDates(input.tasks)

    const fakeTasks = input.tasks.map((_, i) => ({ id: String(i) }))
    const fakeDeps = input.deps.map(d => ({ fromId: String(d.fromIdx), toId: String(d.toIdx) }))
    if (hasCycle({ tasks: fakeTasks, deps: fakeDeps })) {
      throw new ValidationError('Dependencies form a cycle')
    }

    const totals = computeTotals(input.tasks.map(t => ({ startDay: t.startDay, endDay: t.endDay })))

    return db.transaction(async (tx) => {
      const existing = await tx.select().from(workflowTemplates).where(eq(workflowTemplates.id, id))
      if (existing.length === 0) throw new NotFoundError('WorkflowTemplate')

      await tx.update(workflowTemplates).set({
        name: input.name ?? existing[0].name,
        description: input.description ?? existing[0].description,
        totalStartDay: totals.totalStartDay,
        totalEndDay: totals.totalEndDay,
        totalDurationDays: totals.totalDurationDays,
        updatedAt: new Date(),
      }).where(eq(workflowTemplates.id, id))

      await tx.delete(workflowTemplateTaskDeps).where(eq(workflowTemplateTaskDeps.workflowTemplateId, id))
      await tx.delete(workflowTemplateTasks).where(eq(workflowTemplateTasks.workflowTemplateId, id))

      const insertedTasks = await tx.insert(workflowTemplateTasks).values(
        input.tasks.map((t, i) => ({
          workflowTemplateId: id,
          name: t.name,
          description: t.description ?? null,
          defaultDurationDays: t.endDay - t.startDay,
          defaultStartDay: t.startDay,
          defaultEndDay: t.endDay,
          defaultOwnerRoleLabel: t.ownerRoleLabel ?? null,
          sortOrder: i,
        })),
      ).returning()

      if (input.deps.length > 0) {
        await tx.insert(workflowTemplateTaskDeps).values(
          input.deps.map(d => ({
            workflowTemplateId: id,
            fromTaskId: insertedTasks[d.fromIdx].id,
            toTaskId:   insertedTasks[d.toIdx].id,
            lagDays: d.lagDays,
          })),
        )
      }
    })
  },

  async archive(id: string, db: DB) {
    const result = await db.update(workflowTemplates).set({ isArchived: true, updatedAt: new Date() })
      .where(eq(workflowTemplates.id, id)).returning()
    if (result.length === 0) throw new NotFoundError('WorkflowTemplate')
  },

  async getById(id: string, db: DB) {
    const rows = await db.select().from(workflowTemplates).where(eq(workflowTemplates.id, id))
    return rows[0] ?? null
  },

  async list(db: DB, opts: { includeArchived?: boolean } = {}) {
    const rows = await db.select().from(workflowTemplates)
    return opts.includeArchived ? rows : rows.filter(r => !r.isArchived)
  },

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
        totalStartDay: sourceRows[0].totalStartDay,
        totalEndDay: sourceRows[0].totalEndDay,
        totalDurationDays: sourceRows[0].totalDurationDays,
      }).returning()

      const idMap = new Map<string, string>()
      const insertedTasks = await tx.insert(workflowTemplateTasks).values(
        sourceTasks.map(t => ({
          workflowTemplateId: newTpl.id,
          name: t.name,
          description: t.description,
          defaultDurationDays: t.defaultDurationDays,
          defaultStartDay: t.defaultStartDay,
          defaultEndDay: t.defaultEndDay,
          defaultOwnerRoleLabel: t.defaultOwnerRoleLabel,
          sortOrder: t.sortOrder,
        })),
      ).returning()
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

  async unarchive(id: string, db: DB) {
    const result = await db.update(workflowTemplates)
      .set({ isArchived: false, updatedAt: new Date() })
      .where(eq(workflowTemplates.id, id))
      .returning()
    if (result.length === 0) throw new NotFoundError('WorkflowTemplate')
  },
}
```

The Server Action zod schema still sends `durationDays`. We haven't switched the action yet — that happens in Task 2.4. Until then, the service expects `startDay` / `endDay` but the action sends `durationDays`. This means service tests must be updated before the action is exercised. Do not run the full test suite until Task 2.5.

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```
Expected: fails inside `app/actions/workflows.ts` (it builds a `tasks` array with `durationDays`, which no longer matches the service's `TaskInput`). That's expected and fixed in Task 2.4.

- [ ] **Step 3: Hold commit**

Do not commit yet. Proceed to Task 2.4.

---

### Task 2.4: Update Server Action payload

**Files:**
- Modify: `app/actions/workflows.ts`

- [ ] **Step 1: Edit the zod schemas and pass-through**

Replace `TaskInput` block and the surrounding refines:

```ts
// app/actions/workflows.ts
'use server'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { db } from '@/db/client'
import { requirePermission } from '@/lib/server/require-permission'
import { workflowTemplateService } from '@/lib/services/workflow-template-service'

const TaskInput = z.object({
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  startDay: z.number().int().min(1),
  endDay: z.number().int().min(1),
  ownerRoleLabel: z.string().optional().nullable(),
}).refine(t => t.endDay >= t.startDay, { message: 'endDay must be >= startDay' })

const DepInput = z.object({
  fromIdx: z.number().int().min(0),
  toIdx: z.number().int().min(0),
  lagDays: z.number().int().default(0),
})

const CreateInput = z.object({
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  tasks: z.array(TaskInput).min(1),
  deps: z.array(DepInput),
})

export async function createWorkflowTemplate(raw: unknown) {
  const input = CreateInput.parse(raw)
  const user = await requirePermission({ type: 'workflow.create' })
  const tpl = await workflowTemplateService.create({ ...input, createdById: user.id }, db)
  revalidatePath('/workflows')
  return { ok: true, id: tpl.id }
}

const UpdateInput = z.object({
  id: z.string().uuid(),
  name: z.string().optional(),
  description: z.string().optional().nullable(),
  tasks: z.array(TaskInput).min(1),
  deps: z.array(DepInput),
})

export async function updateWorkflowTemplate(raw: unknown) {
  const input = UpdateInput.parse(raw)
  const existing = await workflowTemplateService.getById(input.id, db)
  if (!existing) throw new Error('not found')
  await requirePermission({ type: 'workflow.update', workflow: { createdById: existing.createdById } })
  await workflowTemplateService.update(input.id, input, db)
  revalidatePath('/workflows')
  revalidatePath(`/workflows/${input.id}`)
  return { ok: true }
}

export async function archiveWorkflowTemplate(raw: unknown) {
  const input = z.object({ id: z.string().uuid() }).parse(raw)
  const existing = await workflowTemplateService.getById(input.id, db)
  if (!existing) throw new Error('not found')
  await requirePermission({ type: 'workflow.delete', workflow: { createdById: existing.createdById } })
  await workflowTemplateService.archive(input.id, db)
  revalidatePath('/workflows')
  return { ok: true }
}

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

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```
Expected: still fails in `editor-shell.tsx` (which builds the payload with `durationDays`). That's fixed in Phase 5. Service tests are next.

- [ ] **Step 3: Hold commit**

Continue to Task 2.5.

---

### Task 2.5: Update service tests

**Files:**
- Modify: `lib/services/workflow-template-service.test.ts`
- Modify: `lib/services/workflow-template-service.cycle.test.ts`

- [ ] **Step 1: Bulk-replace `durationDays: N` with `startDay: …, endDay: …` in both files**

Concrete edits for `workflow-template-service.test.ts` — these are the lines flagged by the earlier grep at lines 18, 19, 34, 40, 41, 56. For each task literal, pick non-overlapping start/end days that match the original duration. Example transformation (within the file's test contexts):

| Original | Replacement |
|---|---|
| `{ name: 'Survey', durationDays: 5 }` | `{ name: 'Survey', startDay: 1, endDay: 6 }` |
| `{ name: 'Apply',  durationDays: 10 }` | `{ name: 'Apply',  startDay: 6, endDay: 16 }` |
| `{ name: 't', durationDays: 1 }` | `{ name: 't', startDay: 1, endDay: 2 }` |
| `{ name: 'x', durationDays: 2 }` | `{ name: 'x', startDay: 1, endDay: 3 }` |
| `{ name: 'y', durationDays: 3 }` | `{ name: 'y', startDay: 3, endDay: 6 }` |

For `workflow-template-service.cycle.test.ts`, every `{ name: <n>, durationDays: 1 }` becomes `{ name: <n>, startDay: 1, endDay: 2 }`. The cycle tests don't actually exercise dates — duration was incidental — so they can all start at day 1.

- [ ] **Step 2: If the tests assert on `defaultDurationDays` from the DB, update those assertions to read `defaultStartDay` / `defaultEndDay` instead**

Skim the file after the bulk replace. The original test file's `expect` calls may assert that inserted task rows have `defaultDurationDays: 5`. Replace those with `defaultStartDay: 1, defaultEndDay: 6` (and similar). If the test does not need to assert specific date values, dropping the assertion is fine.

- [ ] **Step 3: Run service tests**

```bash
npm test -- lib/services/workflow-template-service
```
Expected: all PASS.

- [ ] **Step 4: Commit Phase 2 batch (schema TS + service + action + tests)**

```bash
git add db/schema/workflow_template_tasks.ts db/schema/workflow_templates.ts \
        lib/services/workflow-template-service.ts \
        app/actions/workflows.ts \
        lib/services/workflow-template-service.test.ts \
        lib/services/workflow-template-service.cycle.test.ts
git commit -m "feat(workflows): switch service + action to startDay/endDay payload"
```

---

### Task 2.6: New dates-focused service test

**Files:**
- Create: `lib/services/workflow-template-service.dates.test.ts`

- [ ] **Step 1: Write the test**

```ts
// lib/services/workflow-template-service.dates.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { testDb, resetDb } from '@/tests/db'
import { seedUser } from '@/tests/fixtures/users'
import { workflowTemplateService } from '@/lib/services/workflow-template-service'
import { workflowTemplates } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { ValidationError } from '@/lib/server/errors'

describe('workflowTemplateService date semantics', () => {
  beforeEach(resetDb)

  it('persists aggregate totals on create', async () => {
    const owner = await seedUser({ role: 'owner' })
    const tpl = await workflowTemplateService.create({
      createdById: owner.id,
      name: 'Demo',
      tasks: [
        { name: 'A', startDay: 1,  endDay: 6  },
        { name: 'B', startDay: 6,  endDay: 11 },
        { name: 'C', startDay: 11, endDay: 14 },
      ],
      deps: [],
    }, testDb)
    const [row] = await testDb.select().from(workflowTemplates).where(eq(workflowTemplates.id, tpl.id))
    expect(row.totalStartDay).toBe(1)
    expect(row.totalEndDay).toBe(14)
    expect(row.totalDurationDays).toBe(13)
  })

  it('recomputes aggregate totals on update', async () => {
    const owner = await seedUser({ role: 'owner' })
    const tpl = await workflowTemplateService.create({
      createdById: owner.id,
      name: 'Demo',
      tasks: [{ name: 'A', startDay: 1, endDay: 6 }],
      deps: [],
    }, testDb)
    await workflowTemplateService.update(tpl.id, {
      tasks: [
        { name: 'A', startDay: 1,  endDay: 6 },
        { name: 'B', startDay: 6,  endDay: 16 },
      ],
      deps: [],
    }, testDb)
    const [row] = await testDb.select().from(workflowTemplates).where(eq(workflowTemplates.id, tpl.id))
    expect(row.totalStartDay).toBe(1)
    expect(row.totalEndDay).toBe(16)
    expect(row.totalDurationDays).toBe(15)
  })

  it('rejects startDay < 1', async () => {
    const owner = await seedUser({ role: 'owner' })
    await expect(workflowTemplateService.create({
      createdById: owner.id,
      name: 'Demo',
      tasks: [{ name: 'A', startDay: 0, endDay: 5 }],
      deps: [],
    }, testDb)).rejects.toBeInstanceOf(ValidationError)
  })

  it('rejects endDay < startDay', async () => {
    const owner = await seedUser({ role: 'owner' })
    await expect(workflowTemplateService.create({
      createdById: owner.id,
      name: 'Demo',
      tasks: [{ name: 'A', startDay: 5, endDay: 4 }],
      deps: [],
    }, testDb)).rejects.toBeInstanceOf(ValidationError)
  })

  it('allows endDay == startDay (zero-duration milestone)', async () => {
    const owner = await seedUser({ role: 'owner' })
    const tpl = await workflowTemplateService.create({
      createdById: owner.id,
      name: 'Demo',
      tasks: [
        { name: 'Work',     startDay: 1, endDay: 5 },
        { name: 'Approval', startDay: 5, endDay: 5 },
      ],
      deps: [],
    }, testDb)
    const [row] = await testDb.select().from(workflowTemplates).where(eq(workflowTemplates.id, tpl.id))
    expect(row.totalDurationDays).toBe(4)
  })
})
```

Note: this assumes a `seedUser` helper exists under `tests/fixtures/users.ts` — verify it's there. If not, inline the user insert.

- [ ] **Step 2: Run**

```bash
npm test -- lib/services/workflow-template-service.dates.test.ts
```
Expected: all 5 specs PASS.

- [ ] **Step 3: Commit**

```bash
git add lib/services/workflow-template-service.dates.test.ts
git commit -m "test(workflows): cover startDay/endDay validation + aggregate persistence"
```

---

### Task 2.7: Update test fixtures + seed

**Files:**
- Modify: `tests/fixtures/workflow-templates.ts`
- Modify: `db/seed.ts`

- [ ] **Step 1: Edit `tests/fixtures/workflow-templates.ts`**

Replace the `seedTemplate` helper so callers pass `startDay` + `endDay` per task:

```ts
import { testDb } from '@/tests/db'
import { workflowTemplates, workflowTemplateTasks, workflowTemplateTaskDeps } from '@/db/schema'
import { computeTotals } from '@/lib/workflow-editor/compute-totals'

export async function seedTemplate(input: {
  createdById: string
  name: string
  tasks: Array<{ name: string; startDay: number; endDay: number; ownerRoleLabel?: string }>
  deps: Array<{ fromIdx: number; toIdx: number; lagDays?: number }>
}) {
  const totals = computeTotals(input.tasks.map(t => ({ startDay: t.startDay, endDay: t.endDay })))
  const [tpl] = await testDb.insert(workflowTemplates).values({
    name: input.name,
    createdById: input.createdById,
    totalStartDay: totals.totalStartDay,
    totalEndDay: totals.totalEndDay,
    totalDurationDays: totals.totalDurationDays,
  }).returning()
  const insertedTasks = await testDb.insert(workflowTemplateTasks).values(
    input.tasks.map((t, i) => ({
      workflowTemplateId: tpl.id,
      name: t.name,
      defaultDurationDays: t.endDay - t.startDay,
      defaultStartDay: t.startDay,
      defaultEndDay: t.endDay,
      defaultOwnerRoleLabel: t.ownerRoleLabel ?? null,
      sortOrder: i,
    })),
  ).returning()
  if (input.deps.length) {
    await testDb.insert(workflowTemplateTaskDeps).values(
      input.deps.map(d => ({
        workflowTemplateId: tpl.id,
        fromTaskId: insertedTasks[d.fromIdx].id,
        toTaskId:   insertedTasks[d.toIdx].id,
        lagDays:    d.lagDays ?? 0,
      })),
    )
  }
  return { template: tpl, tasks: insertedTasks }
}
```

- [ ] **Step 2: Edit `db/seed.ts`**

```ts
import 'dotenv/config'
import { db } from './client'
import { users, workflowTemplates, workflowTemplateTasks } from './schema'
import { eq } from 'drizzle-orm'

async function main() {
  const owners = await db.select().from(users).where(eq(users.role, 'owner'))
  if (owners.length === 0) { console.error('No owner; sign in first via Lark.'); process.exit(1) }
  const [tpl] = await db.insert(workflowTemplates).values({
    name: 'Permitting Basics',
    description: 'Standard permit pipeline',
    createdById: owners[0].id,
    totalStartDay: 1,
    totalEndDay: 16,
    totalDurationDays: 15,
  }).returning()
  await db.insert(workflowTemplateTasks).values([
    {
      workflowTemplateId: tpl.id, name: 'Survey',
      defaultDurationDays: 5, defaultStartDay: 1, defaultEndDay: 6,
      sortOrder: 0,
    },
    {
      workflowTemplateId: tpl.id, name: 'Apply',
      defaultDurationDays: 10, defaultStartDay: 6, defaultEndDay: 16,
      sortOrder: 1,
    },
  ])
  console.log('Seeded template:', tpl.id)
  process.exit(0)
}
main()
```

- [ ] **Step 3: Find callers of `seedTemplate` and update them**

```bash
grep -rn "seedTemplate" --include="*.ts" /Users/guoyuzhu/Desktop/Real-Estate-Analysis/AlphaX_Hub
```
For every call site, change task literals from `{ name: …, durationDays: N }` to `{ name: …, startDay: M, endDay: M+N }` choosing M so successive tasks don't overlap (or do — overlap is fine for fixtures that don't assert on totals). Most call sites are in `lib/services/`, `lib/snapshot/`, `db/queries/`, and `lib/services/*.test.ts`.

- [ ] **Step 4: Run all tests**

```bash
npm test
```
Expected: any remaining test that used the old fixture shape now passes. There may still be failures in `lib/snapshot/` and `lib/critical-path/` — those are addressed in Phase 3.

- [ ] **Step 5: Commit**

```bash
git add tests/fixtures/workflow-templates.ts db/seed.ts
# Plus any test files you touched as call-site updates:
git add lib/services/ lib/snapshot/ db/queries/
git commit -m "test(workflows): migrate fixtures + seed to startDay/endDay"
```

---

## Phase 3 — Scheduler input, snapshot simplification, draft storage

### Task 3.1: Critical-path scheduler input shape

The existing scheduler computes start/end from `durationDays` + deps. Once tasks carry explicit start/end, the scheduler still needs to:
1. Detect cycles (still does).
2. Compute the critical-path flag (longest chain of FS-dep predecessors that ends at the latest end day).

The simplest change: instead of *computing* `earliestStart` / `earliestEnd`, *read* them from inputs. Slack is `(latestEnd from backward pass) − (earliestStart from inputs)`. Backward pass still uses deps + durations, where `duration = endDay − startDay`.

**Files:**
- Modify: `lib/critical-path/index.ts`
- Modify: `lib/critical-path/index.test.ts`

- [ ] **Step 1: Update test fixtures inline first (red phase)**

Open `lib/critical-path/index.test.ts`. Every `TaskInput` literal currently has `durationDays`. Replace each with `startDay` + `endDay`. Concrete examples:

| Original | Replacement |
|---|---|
| `{ id: 'a', durationDays: 5, status: 'not_started' }` | `{ id: 'a', startDay: 1, endDay: 6, status: 'not_started' }` |
| `{ id: 'b', durationDays: 3, status: 'not_started' }` | `{ id: 'b', startDay: 6, endDay: 9, status: 'not_started' }` |

For tests asserting on `earliestStartDay` / `earliestEndDay`: those should now equal the input `startDay` / `endDay`, so update the assertions accordingly.

- [ ] **Step 2: Update `lib/critical-path/index.ts`**

```ts
export type TaskInput = {
  id: string
  startDay: number
  endDay: number
  status: 'not_started' | 'started' | 'pending_review' | 'approved' | 'complete' | 'wont_do'
}
export type DepInput = { fromTaskId: string; toTaskId: string; lagDays: number }

export type ScheduleOutput = {
  taskId: string
  earliestStartDay: number
  earliestEndDay: number
  latestStartDay: number
  latestEndDay: number
  slackDays: number
  isOnCriticalPath: boolean
}

export function recomputeSchedule(input: {
  tasks: TaskInput[]
  deps: DepInput[]
}): ScheduleOutput[] {
  const liveTasks = input.tasks.filter(t => t.status !== 'wont_do')
  const liveIds = new Set(liveTasks.map(t => t.id))
  const liveDeps = input.deps.filter(d => liveIds.has(d.fromTaskId) && liveIds.has(d.toTaskId))

  const successors = new Map<string, DepInput[]>()
  const predecessors = new Map<string, DepInput[]>()
  for (const t of liveTasks) { successors.set(t.id, []); predecessors.set(t.id, []) }
  for (const d of liveDeps) {
    successors.get(d.fromTaskId)!.push(d)
    predecessors.get(d.toTaskId)!.push(d)
  }

  // Topo-sort for cycle detection (still required).
  const indeg = new Map<string, number>()
  for (const t of liveTasks) indeg.set(t.id, predecessors.get(t.id)!.length)
  const queue: string[] = []
  for (const [id, n] of indeg) if (n === 0) queue.push(id)
  const order: string[] = []
  while (queue.length) {
    const id = queue.shift()!
    order.push(id)
    for (const d of successors.get(id)!) {
      const n = indeg.get(d.toTaskId)! - 1
      indeg.set(d.toTaskId, n)
      if (n === 0) queue.push(d.toTaskId)
    }
  }
  if (order.length !== liveTasks.length) {
    throw new Error('Cycle detected in task dependencies')
  }

  const taskById = new Map(liveTasks.map(t => [t.id, t]))
  const earliestStart = new Map<string, number>()
  const earliestEnd = new Map<string, number>()
  for (const t of liveTasks) {
    earliestStart.set(t.id, t.startDay)
    earliestEnd.set(t.id, t.endDay)
  }

  // Backward pass over deps + durations to compute slack + critical-path flag.
  const projectEnd = Math.max(0, ...liveTasks.map(t => t.endDay))
  const latestEnd = new Map<string, number>()
  const latestStart = new Map<string, number>()
  for (const id of [...order].reverse()) {
    const succs = successors.get(id)!
    const le = succs.length === 0
      ? projectEnd
      : Math.min(...succs.map(s => latestStart.get(s.toTaskId)! - s.lagDays))
    const t = taskById.get(id)!
    const dur = t.endDay - t.startDay
    latestEnd.set(id, le)
    latestStart.set(id, le - dur)
  }

  return liveTasks.map(t => {
    const es = earliestStart.get(t.id)!
    const ee = earliestEnd.get(t.id)!
    const ls = latestStart.get(t.id)!
    const le = latestEnd.get(t.id)!
    const slack = ls - es
    return {
      taskId: t.id,
      earliestStartDay: es,
      earliestEndDay: ee,
      latestStartDay: ls,
      latestEndDay: le,
      slackDays: slack,
      isOnCriticalPath: slack === 0,
    }
  })
}
```

- [ ] **Step 3: Run scheduler tests**

```bash
npm test -- lib/critical-path
```
Expected: PASS. If a test was previously asserting a specific earliest end day computed from duration + deps and the new fixture has incompatible explicit dates, fix the fixture to be self-consistent.

- [ ] **Step 4: Commit**

```bash
git add lib/critical-path/index.ts lib/critical-path/index.test.ts
git commit -m "feat(critical-path): consume explicit task startDay/endDay; deps drive critical-path flag"
```

---

### Task 3.2: Snapshot — copy template dates straight to project

**Files:**
- Modify: `lib/snapshot/snapshot-workflows.ts`
- Modify: `lib/snapshot/apply-schedule.ts`
- Modify: `lib/snapshot/snapshot-workflows.test.ts`
- Modify: `lib/snapshot/apply-schedule.test.ts`

- [ ] **Step 1: Update `snapshot-workflows.ts`**

Edit the per-task insert (around the existing line 55) to include `plannedStartDay` and `plannedEndDay`:

```ts
const [inserted] = await tx.insert(tasks).values({
  projectId: input.projectId,
  projectWorkflowId: pw.id,
  name: tt.name,
  description: tt.description,
  ownerId: input.defaultOwnerId,
  plannedDurationDays: tt.defaultEndDay - tt.defaultStartDay,
  plannedStartDay: tt.defaultStartDay,
  plannedEndDay: tt.defaultEndDay,
  sourceWorkflowTemplateId: tpl.id,
  sourceWorkflowTemplateTaskId: tt.id,
  sortOrder: tt.sortOrder,
}).returning()
```

(Replace the existing `plannedDurationDays: tt.defaultDurationDays` line with the three lines above.)

- [ ] **Step 2: Update `apply-schedule.ts`**

The current `applyScheduleToProject` reads `plannedDurationDays` from each task, runs `recomputeSchedule`, and writes `plannedStartDay` / `plannedEndDay`. Now, `recomputeSchedule` takes explicit `startDay` / `endDay`, so feed it the values already on the project task row — its job becomes ONLY computing the critical-path flag + blocked flag and writing those back. `plannedStartDay` / `plannedEndDay` were already written by the snapshot.

```ts
import { eq } from 'drizzle-orm'
import type { DB } from '@/db/client'
import { tasks, taskDeps } from '@/db/schema'
import { recomputeSchedule } from '@/lib/critical-path'
import { computeBlocked } from '@/lib/critical-path/blocked'

type Tx = Parameters<Parameters<DB['transaction']>[0]>[0]

export async function applyScheduleToProject(tx: Tx, input: { projectId: string }): Promise<void> {
  const taskRows = await tx.select().from(tasks).where(eq(tasks.projectId, input.projectId))
  const depRows = await tx.select().from(taskDeps).where(eq(taskDeps.projectId, input.projectId))

  const schedule = recomputeSchedule({
    tasks: taskRows.map(t => ({
      id: t.id,
      startDay: t.plannedStartDay ?? 0,
      endDay: t.plannedEndDay ?? 0,
      status: t.status,
    })),
    deps: depRows.map(d => ({
      fromTaskId: d.fromTaskId,
      toTaskId: d.toTaskId,
      lagDays: d.lagDays,
    })),
  })
  const blocked = computeBlocked({
    tasks: taskRows.map(t => ({ id: t.id, status: t.status })),
    deps: depRows.map(d => ({ fromTaskId: d.fromTaskId, toTaskId: d.toTaskId })),
  })
  const blockedById = new Map(blocked.map(b => [b.taskId, b.isBlocked]))

  for (const s of schedule) {
    await tx.update(tasks).set({
      isOnCriticalPath: s.isOnCriticalPath,
      isBlocked: blockedById.get(s.taskId) ?? false,
      updatedAt: new Date(),
    }).where(eq(tasks.id, s.taskId))
  }
}
```

Note: we no longer rewrite `plannedStartDay` / `plannedEndDay` here. Those are set once by the snapshot. If a task is added unplanned later (via the project page "add unplanned task" flow), the caller is responsible for setting `plannedStartDay`/`plannedEndDay` directly — verify by grepping for `applyScheduleToProject` call sites.

- [ ] **Step 3: Update `snapshot-workflows.test.ts`**

Replace the input `tasks` arrays per the table in Task 2.5. Existing assertions about `plannedDurationDays` should still hold (because `defaultEndDay - defaultStartDay` equals the old duration when the fixture is migrated 1:1). Add a new assertion that `plannedStartDay` / `plannedEndDay` are copied straight from the template.

- [ ] **Step 4: Update `apply-schedule.test.ts`**

The test currently sets up tasks via `seedTemplate` (now post-Task-2.7 it accepts startDay/endDay) and asserts schedule output. Update assertions: `plannedStartDay` / `plannedEndDay` should not change after `applyScheduleToProject` (they're inputs now). `isOnCriticalPath` and `isBlocked` should still be set correctly.

- [ ] **Step 5: Run**

```bash
npm test -- lib/snapshot
```
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/snapshot/snapshot-workflows.ts lib/snapshot/apply-schedule.ts \
        lib/snapshot/snapshot-workflows.test.ts lib/snapshot/apply-schedule.test.ts
git commit -m "feat(snapshot): copy template start/end days into project tasks directly"
```

---

### Task 3.3: Draft storage shape + drop-old-draft

**Files:**
- Modify: `lib/workflow-editor/draft-storage.ts`
- Modify: `lib/workflow-editor/draft-storage.test.ts`

- [ ] **Step 1: Update the type and `loadDraft`**

```ts
// lib/workflow-editor/draft-storage.ts
export type DraftTask = {
  id: string
  name: string
  description: string
  startDay: number
  endDay: number
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
  savedAt: string
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
    const parsed = JSON.parse(raw) as { tasks?: Array<Record<string, unknown>> }
    // Drop drafts saved before the start/end day shape change.
    if (parsed.tasks?.some(t => !('startDay' in t) || !('endDay' in t))) return null
    return parsed as Draft
  } catch {
    return null
  }
}

export function clearDraft(idOrNew: string, storage: Storage = localStorage): void {
  storage.removeItem(draftKey(idOrNew))
}
```

- [ ] **Step 2: Update `draft-storage.test.ts`**

Line 15 currently constructs a draft with `durationDays: 1`. Replace with `startDay: 1, endDay: 2`. Add a new test:

```ts
it('discards pre-change drafts that have durationDays instead of startDay/endDay', () => {
  const storage = new MemoryStorage()
  storage.setItem('workflow-draft-foo', JSON.stringify({
    name: 'old', description: '', tasks: [
      { id: 't1', name: 'A', description: '', durationDays: 1, ownerRoleLabel: '', sortOrder: 0 },
    ], deps: [], savedAt: new Date().toISOString(),
  }))
  expect(loadDraft('foo', storage)).toBeNull()
})
```

(Use the existing `MemoryStorage` test double pattern if present; otherwise mock `localStorage` per the file's existing approach.)

- [ ] **Step 3: Run**

```bash
npm test -- lib/workflow-editor/draft-storage
```
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add lib/workflow-editor/draft-storage.ts lib/workflow-editor/draft-storage.test.ts
git commit -m "feat(workflow-editor): switch draft shape to startDay/endDay; drop stale drafts"
```

---

## Phase 4 — Drop `default_duration_days`

At this point all code references `defaultDurationDays` only to back-compute the value when writing (we still write it because the column is NOT NULL with no default). Now drop the column.

### Task 4.1: Migration `0010_workflow_task_dates_drop_duration.sql`

**Files:**
- Create: `db/migrations/0010_workflow_task_dates_drop_duration.sql`
- Modify: `db/migrations/meta/_journal.json`

- [ ] **Step 1: Write the SQL**

```sql
-- db/migrations/0010_workflow_task_dates_drop_duration.sql
ALTER TABLE workflow_template_tasks DROP COLUMN default_duration_days;
```

- [ ] **Step 2: Add journal entry**

```json
    {
      "idx": 10,
      "version": "7",
      "when": 1780000060000,
      "tag": "0010_workflow_task_dates_drop_duration",
      "breakpoints": true
    }
```

- [ ] **Step 3: Apply to both DBs**

```bash
npm run db:migrate
DATABASE_URL=postgres://buildflow:buildflow_dev@localhost:5433/buildflow_test npm run db:migrate
```
Expected: column dropped on both.

- [ ] **Step 4: Hold commit**

Do not commit yet — the schema TS still has `defaultDurationDays` and code still references it. Continue to Task 4.2.

---

### Task 4.2: Remove `defaultDurationDays` from schema TS and code

**Files:**
- Modify: `db/schema/workflow_template_tasks.ts`
- Modify: `lib/services/workflow-template-service.ts`
- Modify: `lib/snapshot/snapshot-workflows.ts`
- Modify: `tests/fixtures/workflow-templates.ts`
- Modify: `db/seed.ts`

- [ ] **Step 1: Remove field from schema**

```ts
// db/schema/workflow_template_tasks.ts
import { pgTable, uuid, text, integer } from 'drizzle-orm/pg-core'
import { workflowTemplates } from './workflow_templates'

export const workflowTemplateTasks = pgTable('workflow_template_tasks', {
  id: uuid('id').defaultRandom().primaryKey(),
  workflowTemplateId: uuid('workflow_template_id').notNull().references(() => workflowTemplates.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  defaultStartDay: integer('default_start_day').notNull(),
  defaultEndDay: integer('default_end_day').notNull(),
  defaultOwnerRoleLabel: text('default_owner_role_label'),
  sortOrder: integer('sort_order').notNull(),
})
export type WorkflowTemplateTask = typeof workflowTemplateTasks.$inferSelect
```

- [ ] **Step 2: Remove `defaultDurationDays:` writes**

In `lib/services/workflow-template-service.ts`: remove the line `defaultDurationDays: t.endDay - t.startDay,` from both `create` and `update` task insert blocks, AND remove `defaultDurationDays: t.defaultDurationDays,` from the `duplicate` task insert block.

In `tests/fixtures/workflow-templates.ts`: remove `defaultDurationDays: t.endDay - t.startDay,` from the task insert.

In `db/seed.ts`: remove the two `defaultDurationDays: …,` lines.

- [ ] **Step 3: Drop `defaultDurationDays` reference in `snapshot-workflows.ts`**

The line you set in Task 3.2 step 1 reads `tt.defaultEndDay - tt.defaultStartDay` for `plannedDurationDays` — leave that. The original `tt.defaultDurationDays` reference is already gone.

- [ ] **Step 4: Typecheck**

```bash
npm run typecheck
```
Expected: PASS.

- [ ] **Step 5: Run full test suite**

```bash
npm test
```
Expected: all PASS.

- [ ] **Step 6: Commit Phase 4**

```bash
git add db/migrations/0010_workflow_task_dates_drop_duration.sql \
        db/migrations/meta/_journal.json \
        db/schema/workflow_template_tasks.ts \
        lib/services/workflow-template-service.ts \
        lib/snapshot/snapshot-workflows.ts \
        tests/fixtures/workflow-templates.ts \
        db/seed.ts
git commit -m "feat(db): drop workflow_template_tasks.default_duration_days"
```

---

## Phase 5 — Editor UI

### Task 5.1: Task row UI (start/end inputs + derived duration)

**Files:**
- Modify: `components/workflows/task-row.tsx`

- [ ] **Step 1: Edit the row**

```tsx
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
  const duration = task.endDay - task.startDay

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
        <label className="text-xs text-zinc-500">Start</label>
        <input
          type="number"
          min="1"
          value={task.startDay}
          onChange={(e) => onChange({ startDay: e.target.value === '' ? 1 : Number(e.target.value) })}
          onFocus={(e) => e.target.select()}
          className="w-14 border border-zinc-200 rounded px-1 text-sm text-right"
          aria-label="start day"
        />
        <label className="text-xs text-zinc-500">End</label>
        <input
          type="number"
          min="1"
          value={task.endDay}
          onChange={(e) => onChange({ endDay: e.target.value === '' ? task.startDay : Number(e.target.value) })}
          onFocus={(e) => e.target.select()}
          className="w-14 border border-zinc-200 rounded px-1 text-sm text-right"
          aria-label="end day"
        />
        <span className="text-xs text-zinc-500 tabular-nums whitespace-nowrap min-w-[2.5rem]">
          {duration}d
        </span>
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

Note: the `schedule` prop is removed — start/end come from `task` directly and the per-row "day N–M" computed display is no longer needed.

- [ ] **Step 2: Commit**

```bash
git add components/workflows/task-row.tsx
git commit -m "feat(workflow-editor): start/end day inputs with derived duration on task row"
```

---

### Task 5.2: Task list (remove schedule computation + prop)

**Files:**
- Modify: `components/workflows/task-list.tsx`

- [ ] **Step 1: Edit**

```tsx
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

Note: `recomputeSchedule` import is removed.

- [ ] **Step 2: Commit**

```bash
git add components/workflows/task-list.tsx
git commit -m "refactor(workflow-editor): remove per-row schedule computation"
```

---

### Task 5.3: Editor shell — add-task default, validation, payload, auto-suggest, schedule info, soft warning

**Files:**
- Modify: `components/workflows/editor-shell.tsx`

This is the biggest single file change. Replace its contents wholesale:

- [ ] **Step 1: Edit**

```tsx
'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { EditorHeader } from './editor-header'
import { DraftBanner } from './draft-banner'
import { TaskList } from './task-list'
import { hasCycle } from '@/lib/workflow-editor/has-cycle'
import { computeTotals } from '@/lib/workflow-editor/compute-totals'
import {
  saveDraft, loadDraft, clearDraft, NEW_MODE_KEY,
  type Draft, type DraftTask,
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

  useEffect(() => {
    const d = loadDraft(draftKeyId)
    if (!d) return
    if (serverUpdatedAt && new Date(d.savedAt) <= new Date(serverUpdatedAt)) {
      clearDraft(draftKeyId)
      return
    }
    setDraftToOffer(d)
  }, [draftKeyId, serverUpdatedAt])

  useEffect(() => {
    if (state === lastSavedRef.current) return
    saveDraft(draftKeyId, { ...state, savedAt: new Date().toISOString() })
  }, [state, draftKeyId])

  const isDirty = JSON.stringify(state) !== JSON.stringify(lastSavedRef.current)
  useLeavePrompt(isDirty)

  const totals = useMemo(
    () => computeTotals(state.tasks.map(t => ({ startDay: t.startDay, endDay: t.endDay }))),
    [state.tasks],
  )

  const violations = useMemo(() => {
    const taskById = new Map(state.tasks.map(t => [t.id, t]))
    return state.deps
      .map(d => ({
        pred: taskById.get(d.fromTaskId),
        succ: taskById.get(d.toTaskId),
      }))
      .filter(({ pred, succ }) => pred && succ && succ.startDay < pred.endDay)
      .map(({ pred, succ }) => ({ predName: pred!.name || '(unnamed)', succName: succ!.name || '(unnamed)' }))
  }, [state.tasks, state.deps])

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
    const startDay = state.tasks.length === 0
      ? 1
      : Math.max(...state.tasks.map(t => t.endDay))
    patch({
      tasks: [...state.tasks, {
        id, name: '', description: '',
        startDay, endDay: startDay,
        ownerRoleLabel: '', sortOrder: state.tasks.length,
      }],
    })
  }
  function addDep(taskId: string, upstreamTaskId: string) {
    if (state.deps.some(d => d.toTaskId === taskId && d.fromTaskId === upstreamTaskId)) return
    const id = `dep-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    const newDeps = [...state.deps, { id, fromTaskId: upstreamTaskId, toTaskId: taskId, lagDays: 0 }]
    // Auto-suggest: shift successor start to max(predecessor.endDay + lag) for all current preds (incl. the new one).
    const target = state.tasks.find(t => t.id === taskId)
    if (!target) { patch({ deps: newDeps }); return }
    const newPredEnds = newDeps
      .filter(d => d.toTaskId === taskId)
      .map(d => {
        const p = state.tasks.find(t => t.id === d.fromTaskId)
        return p ? p.endDay + d.lagDays : 0
      })
    const newStart = Math.max(...newPredEnds, 1)
    const duration = target.endDay - target.startDay
    patch({
      tasks: state.tasks.map(t =>
        t.id === taskId ? { ...t, startDay: newStart, endDay: newStart + duration } : t
      ),
      deps: newDeps,
    })
  }
  function removeDep(taskId: string, upstreamTaskId: string) {
    patch({ deps: state.deps.filter(d => !(d.toTaskId === taskId && d.fromTaskId === upstreamTaskId)) })
  }

  function validate(): string | null {
    if (!state.name.trim()) return 'Name is required'
    if (state.tasks.length === 0) return 'At least one task is required'
    if (state.tasks.some(t => !t.name.trim())) return 'Every task needs a name'
    if (state.tasks.some(t => !Number.isInteger(t.startDay) || t.startDay < 1))
      return 'Every task needs a start day >= 1'
    if (state.tasks.some(t => !Number.isInteger(t.endDay) || t.endDay < t.startDay))
      return 'End day cannot be before start day'
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
          startDay: t.startDay, endDay: t.endDay,
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
    if (!window.confirm("Archive this template? Existing projects are unaffected; new projects won't see it in the picker.")) return
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

        <div className="rounded border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm flex items-center gap-4">
          <span className="text-zinc-500 font-medium">Workflow schedule:</span>
          {state.tasks.length === 0 ? (
            <span className="text-zinc-500">Add a task to see the schedule.</span>
          ) : (
            <>
              <span>Start: day {totals.totalStartDay}</span>
              <span>·</span>
              <span>End: day {totals.totalEndDay}</span>
              <span>·</span>
              <span>Duration: {totals.totalDurationDays} days</span>
              <span>·</span>
              <span>{state.tasks.length} tasks</span>
            </>
          )}
        </div>

        {violations.length > 0 && (
          <div className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {violations.length === 1
              ? `Task "${violations[0].succName}" starts before its dependency "${violations[0].predName}" ends.`
              : `${violations.length} tasks start before their dependencies end.`}
          </div>
        )}

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

- [ ] **Step 2: Smoke test in the browser**

```bash
npm run dev
```
Open `http://localhost:3000/workflows/new/edit` (or whichever route the existing wiring uses to enter the editor). Verify:
- Name + description inputs work.
- "Workflow schedule" block reads "Add a task to see the schedule." when empty.
- Clicking "+ Add task" creates a task starting at day 1 (first time) or right after the last task's end day. Start/end inputs each accept integers; the `d` label updates live as you change them.
- Adding a dep via the dep picker shifts the successor's start day to the predecessor's end day.
- Setting successor.startDay below predecessor.endDay triggers the amber warning banner.
- Save persists; reloading the page shows the saved start/end.

- [ ] **Step 3: Commit**

```bash
git add components/workflows/editor-shell.tsx
git commit -m "feat(workflow-editor): aggregate schedule block, dep auto-suggest, soft violation warning"
```

---

## Phase 6 — List page query + search + redesigned cards

### Task 6.1: Extract list query

**Files:**
- Create: `db/queries/workflow-templates.ts`
- Create: `db/queries/workflow-templates.test.ts`

- [ ] **Step 1: Write the query**

```ts
// db/queries/workflow-templates.ts
import { eq, ilike, or, sql, asc } from 'drizzle-orm'
import type { DB } from '@/db/client'
import { workflowTemplates, workflowTemplateTasks } from '@/db/schema'

export type WorkflowTemplateListItem = {
  id: string
  name: string
  description: string | null
  isArchived: boolean
  totalDurationDays: number
  taskCount: number
}

export async function listWorkflowTemplates(
  opts: { q?: string; includeArchived: boolean },
  db: DB,
): Promise<WorkflowTemplateListItem[]> {
  const tpls = await db
    .select({
      id: workflowTemplates.id,
      name: workflowTemplates.name,
      description: workflowTemplates.description,
      isArchived: workflowTemplates.isArchived,
      totalDurationDays: workflowTemplates.totalDurationDays,
    })
    .from(workflowTemplates)
    .where(
      opts.q && opts.q.trim().length > 0
        ? or(
            ilike(workflowTemplates.name, `%${opts.q}%`),
            ilike(workflowTemplates.description, `%${opts.q}%`),
          )
        : undefined,
    )
    .orderBy(asc(workflowTemplates.name))

  const filtered = opts.includeArchived ? tpls : tpls.filter(t => !t.isArchived)
  if (filtered.length === 0) return []

  const counts = await db
    .select({
      workflowTemplateId: workflowTemplateTasks.workflowTemplateId,
      c: sql<number>`count(*)::int`,
    })
    .from(workflowTemplateTasks)
    .groupBy(workflowTemplateTasks.workflowTemplateId)
  const countById = new Map(counts.map(r => [r.workflowTemplateId, r.c]))

  return filtered.map(t => ({ ...t, taskCount: countById.get(t.id) ?? 0 }))
}
```

- [ ] **Step 2: Write the test**

```ts
// db/queries/workflow-templates.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { testDb, resetDb } from '@/tests/db'
import { seedUser } from '@/tests/fixtures/users'
import { seedTemplate } from '@/tests/fixtures/workflow-templates'
import { listWorkflowTemplates } from './workflow-templates'

describe('listWorkflowTemplates', () => {
  beforeEach(resetDb)

  it('returns name, description, task count, total duration', async () => {
    const owner = await seedUser({ role: 'owner' })
    await seedTemplate({
      createdById: owner.id, name: 'Permitting Basics',
      tasks: [
        { name: 'Survey', startDay: 1, endDay: 6 },
        { name: 'Apply',  startDay: 6, endDay: 16 },
      ],
      deps: [],
    })
    const rows = await listWorkflowTemplates({ includeArchived: false }, testDb)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      name: 'Permitting Basics',
      taskCount: 2,
      totalDurationDays: 15,
    })
  })

  it('q filters by name (case-insensitive)', async () => {
    const owner = await seedUser({ role: 'owner' })
    await seedTemplate({ createdById: owner.id, name: 'Foundation Standard',
      tasks: [{ name: 'A', startDay: 1, endDay: 2 }], deps: [] })
    await seedTemplate({ createdById: owner.id, name: 'Permitting Basics',
      tasks: [{ name: 'A', startDay: 1, endDay: 2 }], deps: [] })
    const rows = await listWorkflowTemplates({ q: 'foundation', includeArchived: false }, testDb)
    expect(rows.map(r => r.name)).toEqual(['Foundation Standard'])
  })

  it('q matches in description too', async () => {
    const owner = await seedUser({ role: 'owner' })
    const created = await seedTemplate({ createdById: owner.id, name: 'X',
      tasks: [{ name: 'A', startDay: 1, endDay: 2 }], deps: [] })
    await testDb.update((await import('@/db/schema')).workflowTemplates)
      .set({ description: 'matches foundation keyword' })
      .where((await import('drizzle-orm')).eq((await import('@/db/schema')).workflowTemplates.id, created.template.id))
    const rows = await listWorkflowTemplates({ q: 'foundation', includeArchived: false }, testDb)
    expect(rows.map(r => r.name)).toEqual(['X'])
  })

  it('excludes archived unless includeArchived', async () => {
    const owner = await seedUser({ role: 'owner' })
    const a = await seedTemplate({ createdById: owner.id, name: 'Active',
      tasks: [{ name: 'A', startDay: 1, endDay: 2 }], deps: [] })
    const b = await seedTemplate({ createdById: owner.id, name: 'Archived',
      tasks: [{ name: 'A', startDay: 1, endDay: 2 }], deps: [] })
    const { workflowTemplates } = await import('@/db/schema')
    const { eq } = await import('drizzle-orm')
    await testDb.update(workflowTemplates).set({ isArchived: true })
      .where(eq(workflowTemplates.id, b.template.id))

    const without = await listWorkflowTemplates({ includeArchived: false }, testDb)
    expect(without.map(r => r.name)).toEqual(['Active'])
    const withArchived = await listWorkflowTemplates({ includeArchived: true }, testDb)
    expect(withArchived.map(r => r.name)).toEqual(['Active', 'Archived'])
  })
})
```

- [ ] **Step 3: Run**

```bash
npm test -- db/queries/workflow-templates
```
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add db/queries/workflow-templates.ts db/queries/workflow-templates.test.ts
git commit -m "feat(db): listWorkflowTemplates with keyword filter + per-template aggregates"
```

---

### Task 6.2: Search input client component

**Files:**
- Create: `components/workflows/list-search.tsx`

- [ ] **Step 1: Write the component**

```tsx
'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

export function ListSearch() {
  const router = useRouter()
  const params = useSearchParams()
  const initial = params.get('q') ?? ''
  const [value, setValue] = useState(initial)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      const next = new URLSearchParams(params.toString())
      if (value.trim().length === 0) next.delete('q')
      else next.set('q', value.trim())
      router.replace(`/workflows?${next.toString()}`)
    }, 200)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  return (
    <input
      type="search"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      placeholder="Search workflows…"
      className="w-full max-w-sm border border-zinc-200 rounded px-3 py-1.5 text-sm focus:border-blue-400 outline-none"
      aria-label="search workflows"
    />
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/workflows/list-search.tsx
git commit -m "feat(workflows): debounced keyword search input"
```

---

### Task 6.3: Redesign `/workflows` page (card layout + query)

**Files:**
- Modify: `app/(app)/workflows/page.tsx`

- [ ] **Step 1: Rewrite the page**

```tsx
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/server/get-current-user'
import { db } from '@/db/client'
import { listWorkflowTemplates } from '@/db/queries/workflow-templates'
import { ListSearch } from '@/components/workflows/list-search'

export default async function WorkflowsPage({
  searchParams,
}: { searchParams: { archived?: string; q?: string } }) {
  const me = await requireUser()
  if (me.role !== 'owner') redirect('/')
  const showArchived = searchParams.archived === '1'
  const q = searchParams.q?.trim()

  const list = await listWorkflowTemplates({ q, includeArchived: showArchived }, db)

  return (
    <div className="space-y-4">
      <div className="flex items-center">
        <h1 className="text-2xl font-semibold">Workflow Templates</h1>
        <Link href="/workflows/new"
          className="ml-auto px-3 py-1.5 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded text-sm hover:opacity-90">
          + New template
        </Link>
      </div>

      <div className="flex items-center gap-4">
        <ListSearch />
        <Link href={showArchived
            ? `/workflows${q ? `?q=${encodeURIComponent(q)}` : ''}`
            : `/workflows?archived=1${q ? `&q=${encodeURIComponent(q)}` : ''}`}
          className="text-xs text-blue-600 hover:underline whitespace-nowrap">
          {showArchived ? 'Hide archived' : 'Show archived'}
        </Link>
      </div>

      {list.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-200 bg-white p-12 text-center text-zinc-500 text-sm">
          {q
            ? <>No templates match &quot;{q}&quot;.</>
            : <>No templates yet. Click &quot;+ New template&quot; to start.</>}
        </div>
      ) : (
        <ul className="space-y-2">
          {list.map(w => (
            <li key={w.id} className="rounded border border-zinc-200 bg-white px-4 py-3 hover:bg-zinc-50">
              <Link href={`/workflows/${w.id}`} className="block">
                <div className="flex items-center gap-2">
                  <span className={`font-medium ${w.isArchived ? 'text-zinc-400' : ''}`}>{w.name}</span>
                  {w.isArchived && (
                    <span className="text-xs bg-zinc-200 text-zinc-700 px-2 py-0.5 rounded">archived</span>
                  )}
                </div>
                {w.description && (
                  <div className="text-sm text-zinc-500 mt-0.5 line-clamp-1">{w.description}</div>
                )}
                <div className="text-xs text-zinc-500 mt-1">
                  {w.taskCount} tasks · {w.totalDurationDays} days
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Smoke test in browser**

```bash
npm run dev
```
Visit `/workflows`. Verify:
- The seeded template (run `npm run db:seed` if needed) shows as a card with description and "2 tasks · 15 days".
- Typing in the search input filters the list after a short debounce; the URL updates with `?q=`.
- Clearing the input restores all templates and removes the param.
- "Show archived" toggle preserves the `q` param when navigating.

- [ ] **Step 3: Commit**

```bash
git add app/(app)/workflows/page.tsx
git commit -m "feat(workflows): redesign list cards + add keyword search"
```

---

## Phase 7 — Detail page schedule block

### Task 7.1: Add schedule info to `/workflows/[id]`

**Files:**
- Modify: `app/(app)/workflows/[id]/page.tsx`

- [ ] **Step 1: Read the file first to see its current structure**

```bash
cat app/\(app\)/workflows/\[id\]/page.tsx
```

- [ ] **Step 2: Add the schedule info block near the top of the rendered page**

Insert a new block right after the template header (name + description), before the task list section. The block reads `tpl.totalStartDay`, `tpl.totalEndDay`, `tpl.totalDurationDays` (already on the row) plus the task count (use the same logic the page is already doing or call `listWorkflowTemplates` for this one row).

Concrete JSX to insert:

```tsx
<div className="rounded border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm flex items-center gap-4">
  <span className="text-zinc-500 font-medium">Workflow schedule:</span>
  {tasks.length === 0 ? (
    <span className="text-zinc-500">No tasks.</span>
  ) : (
    <>
      <span>Start: day {tpl.totalStartDay}</span>
      <span>·</span>
      <span>End: day {tpl.totalEndDay}</span>
      <span>·</span>
      <span>Duration: {tpl.totalDurationDays} days</span>
      <span>·</span>
      <span>{tasks.length} tasks</span>
    </>
  )}
</div>
```

Where `tpl` is the `WorkflowTemplate` row loaded by the page and `tasks` is the corresponding task array. Use the same names already in scope in the file.

- [ ] **Step 3: Also surface each task's start/end on the same page**

If the task rows currently show only name and (old) duration, update them to show "day {start}–{end} · {end-start}d" instead. Adjust per the existing read-only formatting — keep the same Tailwind classes used elsewhere on the page.

- [ ] **Step 4: Smoke test in browser**

```bash
npm run dev
```
Visit `/workflows/[id]` for the seeded template. Verify the schedule block appears and the task rows show start/end.

- [ ] **Step 5: Commit**

```bash
git add app/(app)/workflows/[id]/page.tsx
git commit -m "feat(workflows): show schedule + per-task dates on detail page"
```

---

## Phase 8 — Final verification

### Task 8.1: Full test suite + typecheck + build

**Files:** none — verification only.

- [ ] **Step 1: Typecheck**

```bash
npm run typecheck
```
Expected: PASS.

- [ ] **Step 2: Full test suite**

```bash
npm test
```
Expected: ALL specs PASS. Likely candidates for breakage we may have missed: anything else that imported `defaultDurationDays` or constructed scheduler input. Grep:

```bash
grep -rn "defaultDurationDays\|durationDays" --include="*.ts" --include="*.tsx" .
```
Expected: matches only in `plannedDurationDays` references (project-side tasks table) and `lib/critical-path/index.ts` internal `dur` local. No matches on `defaultDurationDays`. If you find unexpected hits, follow up before considering this phase done.

- [ ] **Step 3: Production build**

```bash
npm run build
```
Expected: succeeds, no warnings about unused imports from removed code.

- [ ] **Step 4: Manual end-to-end check**

```bash
npm run dev
```
Walk through:
1. `/workflows` shows the seeded "Permitting Basics" card with "2 tasks · 15 days".
2. Search "perm" filters to just it.
3. Open `/workflows/[id]` — schedule block shows "Start: day 1 · End: day 16 · Duration: 15 days · 2 tasks". Task rows show their start/end.
4. Click Edit → editor opens with the same numbers in the row inputs.
5. Click "+ Add task" → new task appears with start = 16, end = 16. Type name; change end to 20. Schedule block updates to "End: day 20 · Duration: 19 days".
6. Add a dep: pick the new task as a successor of "Apply". Successor's start auto-shifts to 16 (no change, already there). Manually set successor.startDay to 10 → amber violation banner appears.
7. Save. List page shows the updated total duration.

- [ ] **Step 5: Commit (only if there are stray verification fixes)**

```bash
git add -A
git commit -m "chore: post-impl verification fixes"
```
Skip if `git status` is clean.

---

## Self-review notes (post-write)

- **Spec §2 (day convention):** covered by Task 1.1 helper, Tasks 2.3/2.4 service+action validation, Task 5.1 task row UI, Task 5.3 schedule info block.
- **Spec §3.1 (per-task schema):** Tasks 2.1, 2.2, 4.1, 4.2.
- **Spec §3.2 (template aggregates):** Tasks 2.1, 2.2, 2.3, 2.6.
- **Spec §3.3 (migration order):** split across Tasks 2.1 (additive) and 4.1 (drop), so the codebase is runnable between commits.
- **Spec §4.1 (zod payload):** Task 2.4.
- **Spec §4.2 (service):** Task 2.3.
- **Spec §4.3 (new query):** Task 6.1.
- **Spec §5.1 (task row):** Task 5.1.
- **Spec §5.2 (add-task default):** Task 5.3 (`addTask` function).
- **Spec §5.3 (schedule info block):** Task 5.3 (JSX block).
- **Spec §5.4 (removed UI):** Task 5.2 (removed schedule prop) and Task 5.1 (no per-row preview).
- **Spec §5.5 (detail page):** Task 7.1.
- **Spec §6.1 (auto-suggest):** Task 5.3 (`addDep` function).
- **Spec §6.2 (soft warning):** Task 5.3 (`violations` memo + banner JSX).
- **Spec §6.3 (validation):** Task 5.3 (`validate()` function) + Task 2.3 (service `validateTaskDates`).
- **Spec §6.4 (scheduler simplification):** Tasks 3.1, 3.2.
- **Spec §6.5 (cycle detection):** unchanged; covered by existing `hasCycle` tests, still imported.
- **Spec §7 (draft storage):** Task 3.3.
- **Spec §8 (list page):** Tasks 6.1, 6.2, 6.3.
- **Spec §9 (files affected):** matches the file map at the top.
- **Spec §10 (testing):** covered across Tasks 1.1, 2.5, 2.6, 3.1, 3.2, 3.3, 6.1, and the verification in 8.1.
- **Spec §11 (rollout):** single deployable change; the two migrations apply together; no feature flag.
