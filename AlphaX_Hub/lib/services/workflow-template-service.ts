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
