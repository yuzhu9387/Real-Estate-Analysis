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
