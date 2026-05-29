import { ilike, or, sql, asc, eq, inArray } from 'drizzle-orm'
import type { DB } from '@/db/client'
import {
  workflowTemplates,
  workflowTemplateTasks,
  workflowTemplateTaskDeps,
  projectWorkflows,
  users,
} from '@/db/schema'
import type { ProductType } from '@/lib/workflows/product-types'

export type WorkflowTemplateListItem = {
  id: string
  name: string
  description: string | null
  productType: ProductType | null
  isArchived: boolean
  totalDurationDays: number
  taskCount: number
  depCount: number
  usedCount: number
  ownerName: string | null
  updatedAt: Date
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
      productType: workflowTemplates.productType,
      isArchived: workflowTemplates.isArchived,
      totalDurationDays: workflowTemplates.totalDurationDays,
      updatedAt: workflowTemplates.updatedAt,
      createdById: workflowTemplates.createdById,
      ownerName: users.name,
    })
    .from(workflowTemplates)
    .leftJoin(users, eq(users.id, workflowTemplates.createdById))
    .where(
      opts.q && opts.q.trim().length > 0
        ? or(
            ilike(workflowTemplates.name, `%${opts.q}%`),
            ilike(workflowTemplates.description, `%${opts.q}%`),
          )
        : undefined,
    )
    .orderBy(asc(workflowTemplates.name))

  const filtered = opts.includeArchived ? tpls : tpls.filter((t) => !t.isArchived)
  if (filtered.length === 0) return []

  const ids = filtered.map((t) => t.id)

  const [taskCounts, depCounts, usedCounts] = await Promise.all([
    db
      .select({
        workflowTemplateId: workflowTemplateTasks.workflowTemplateId,
        c: sql<number>`count(*)::int`,
      })
      .from(workflowTemplateTasks)
      .where(inArray(workflowTemplateTasks.workflowTemplateId, ids))
      .groupBy(workflowTemplateTasks.workflowTemplateId),
    db
      .select({
        workflowTemplateId: workflowTemplateTaskDeps.workflowTemplateId,
        c: sql<number>`count(*)::int`,
      })
      .from(workflowTemplateTaskDeps)
      .where(inArray(workflowTemplateTaskDeps.workflowTemplateId, ids))
      .groupBy(workflowTemplateTaskDeps.workflowTemplateId),
    db
      .select({
        sourceWorkflowTemplateId: projectWorkflows.sourceWorkflowTemplateId,
        c: sql<number>`count(*)::int`,
      })
      .from(projectWorkflows)
      .where(inArray(projectWorkflows.sourceWorkflowTemplateId, ids))
      .groupBy(projectWorkflows.sourceWorkflowTemplateId),
  ])

  const taskById = new Map(taskCounts.map((r) => [r.workflowTemplateId, r.c]))
  const depById = new Map(depCounts.map((r) => [r.workflowTemplateId, r.c]))
  const usedById = new Map(
    usedCounts
      .filter((r) => r.sourceWorkflowTemplateId !== null)
      .map((r) => [r.sourceWorkflowTemplateId as string, r.c]),
  )

  return filtered.map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    productType: t.productType,
    isArchived: t.isArchived,
    totalDurationDays: t.totalDurationDays,
    taskCount: taskById.get(t.id) ?? 0,
    depCount: depById.get(t.id) ?? 0,
    usedCount: usedById.get(t.id) ?? 0,
    ownerName: t.ownerName ?? null,
    updatedAt: t.updatedAt,
  }))
}
