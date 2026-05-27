import { eq } from 'drizzle-orm'
import type { DB } from '@/db/client'
import { workflowTemplates, workflowTemplateTasks, workflowTemplateTaskDeps } from '@/db/schema'
import { NotFoundError, ValidationError } from '@/lib/server/errors'
import { hasCycle } from '@/lib/workflow-editor/has-cycle'

type TaskInput = { name: string; description?: string | null; durationDays: number; ownerRoleLabel?: string | null }
type DepInput  = { fromIdx: number; toIdx: number; lagDays: number }

export const workflowTemplateService = {
  async create(input: {
    createdById: string
    name: string
    description?: string | null
    tasks: TaskInput[]
    deps: DepInput[]
  }, db: DB) {
    if (input.tasks.length === 0) throw new ValidationError('Template must have at least one task')

    const fakeTasks = input.tasks.map((_, i) => ({ id: String(i) }))
    const fakeDeps = input.deps.map(d => ({ fromId: String(d.fromIdx), toId: String(d.toIdx) }))
    if (hasCycle({ tasks: fakeTasks, deps: fakeDeps })) {
      throw new ValidationError('Dependencies form a cycle')
    }

    return db.transaction(async (tx) => {
      const [tpl] = await tx.insert(workflowTemplates).values({
        name: input.name,
        description: input.description ?? null,
        createdById: input.createdById,
      }).returning()

      const insertedTasks = await tx.insert(workflowTemplateTasks).values(
        input.tasks.map((t, i) => ({
          workflowTemplateId: tpl.id,
          name: t.name,
          description: t.description ?? null,
          defaultDurationDays: t.durationDays,
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
    const fakeTasks = input.tasks.map((_, i) => ({ id: String(i) }))
    const fakeDeps = input.deps.map(d => ({ fromId: String(d.fromIdx), toId: String(d.toIdx) }))
    if (hasCycle({ tasks: fakeTasks, deps: fakeDeps })) {
      throw new ValidationError('Dependencies form a cycle')
    }

    return db.transaction(async (tx) => {
      const existing = await tx.select().from(workflowTemplates).where(eq(workflowTemplates.id, id))
      if (existing.length === 0) throw new NotFoundError('WorkflowTemplate')

      await tx.update(workflowTemplates).set({
        name: input.name ?? existing[0].name,
        description: input.description ?? existing[0].description,
        updatedAt: new Date(),
      }).where(eq(workflowTemplates.id, id))

      await tx.delete(workflowTemplateTaskDeps).where(eq(workflowTemplateTaskDeps.workflowTemplateId, id))
      await tx.delete(workflowTemplateTasks).where(eq(workflowTemplateTasks.workflowTemplateId, id))

      const insertedTasks = await tx.insert(workflowTemplateTasks).values(
        input.tasks.map((t, i) => ({
          workflowTemplateId: id,
          name: t.name,
          description: t.description ?? null,
          defaultDurationDays: t.durationDays,
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
}
