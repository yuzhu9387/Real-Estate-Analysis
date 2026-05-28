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
