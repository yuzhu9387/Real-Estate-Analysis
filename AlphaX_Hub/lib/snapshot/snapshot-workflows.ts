import { eq } from 'drizzle-orm'
import type { DB } from '@/db/client'
import {
  projectWorkflows,
  tasks,
  taskDeps,
  workflowTemplates,
  workflowTemplateTasks,
  workflowTemplateTaskDeps,
} from '@/db/schema'

export type SnapshotAssignment = {
  phaseId: string
  templateId: string
  sortOrder: number
}

type Tx = Parameters<Parameters<DB['transaction']>[0]>[0]

export async function snapshotWorkflowsIntoProject(tx: Tx, input: {
  projectId: string
  defaultOwnerId: string
  assignments: SnapshotAssignment[]
}): Promise<void> {
  const byPhase = new Map<string, SnapshotAssignment[]>()
  for (const a of input.assignments) {
    if (!byPhase.has(a.phaseId)) byPhase.set(a.phaseId, [])
    byPhase.get(a.phaseId)!.push(a)
  }
  for (const list of byPhase.values()) list.sort((x, y) => x.sortOrder - y.sortOrder)

  for (const [phaseId, list] of byPhase) {
    let prevWorkflowLeafTaskIds: string[] | null = null

    for (const a of list) {
      const tplRows = await tx.select().from(workflowTemplates).where(eq(workflowTemplates.id, a.templateId))
      if (tplRows.length === 0) throw new Error(`Template ${a.templateId} not found`)
      const tpl = tplRows[0]

      const tplTasks = await tx.select().from(workflowTemplateTasks)
        .where(eq(workflowTemplateTasks.workflowTemplateId, tpl.id))
      const tplDeps = await tx.select().from(workflowTemplateTaskDeps)
        .where(eq(workflowTemplateTaskDeps.workflowTemplateId, tpl.id))

      const [pw] = await tx.insert(projectWorkflows).values({
        projectId: input.projectId,
        projectPhaseId: phaseId,
        sourceWorkflowTemplateId: tpl.id,
        name: tpl.name,
        sortOrder: a.sortOrder,
      }).returning()

      const idMap = new Map<string, string>()
      for (const tt of tplTasks) {
        const [inserted] = await tx.insert(tasks).values({
          projectId: input.projectId,
          projectWorkflowId: pw.id,
          name: tt.name,
          description: tt.description,
          ownerId: input.defaultOwnerId,
          plannedDurationDays: tt.defaultDurationDays,
          sourceWorkflowTemplateId: tpl.id,
          sourceWorkflowTemplateTaskId: tt.id,
          sortOrder: tt.sortOrder,
        }).returning()
        idMap.set(tt.id, inserted.id)
      }

      for (const d of tplDeps) {
        await tx.insert(taskDeps).values({
          projectId: input.projectId,
          fromTaskId: idMap.get(d.fromTaskId)!,
          toTaskId:   idMap.get(d.toTaskId)!,
          dependencyType: d.dependencyType,
          lagDays: d.lagDays,
        })
      }

      if (prevWorkflowLeafTaskIds) {
        const inboundTaskIds = new Set(tplDeps.map(d => d.toTaskId))
        const rootProjectTaskIds = tplTasks.filter(t => !inboundTaskIds.has(t.id)).map(t => idMap.get(t.id)!)
        for (const fromId of prevWorkflowLeafTaskIds) {
          for (const toId of rootProjectTaskIds) {
            await tx.insert(taskDeps).values({
              projectId: input.projectId, fromTaskId: fromId, toTaskId: toId, lagDays: 0,
            })
          }
        }
      }

      const outboundTaskIds = new Set(tplDeps.map(d => d.fromTaskId))
      const leafProjectTaskIds = tplTasks.filter(t => !outboundTaskIds.has(t.id)).map(t => idMap.get(t.id)!)
      prevWorkflowLeafTaskIds = leafProjectTaskIds
    }
  }
}
