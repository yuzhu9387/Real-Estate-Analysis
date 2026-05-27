import { testDb } from '@/tests/db'
import { workflowTemplates, workflowTemplateTasks, workflowTemplateTaskDeps } from '@/db/schema'

export async function seedTemplate(input: {
  createdById: string
  name: string
  tasks: Array<{ name: string; durationDays: number; ownerRoleLabel?: string }>
  deps: Array<{ fromIdx: number; toIdx: number; lagDays?: number }>
}) {
  const [tpl] = await testDb.insert(workflowTemplates).values({
    name: input.name, createdById: input.createdById,
  }).returning()
  const insertedTasks = await testDb.insert(workflowTemplateTasks).values(
    input.tasks.map((t, i) => ({
      workflowTemplateId: tpl.id,
      name: t.name,
      defaultDurationDays: t.durationDays,
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
