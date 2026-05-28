import { ilike, or, sql, asc } from 'drizzle-orm'
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
