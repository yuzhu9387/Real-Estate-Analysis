import { and, eq, inArray } from 'drizzle-orm'
import type { DB } from '@/db/client'
import { tasks, users, taskComments } from '@/db/schema'

export type TeamPerformance = {
  tasksCompleted: number
  wontDoCount: number
  firstPassApprovalRate: number
  revisionRate: number
  perPerson: Array<{
    userId: string
    name: string
    tasksCompleted: number
    firstPassApprovalRate: number
  }>
}

export async function computeTeamPerformance(
  db: DB,
  opts: { team: 'design' | 'construction' | 'sales'; since: Date; until: Date },
): Promise<TeamPerformance> {
  const teamUsers = await db.select().from(users).where(eq(users.team, opts.team))
  if (teamUsers.length === 0) {
    return { tasksCompleted: 0, wontDoCount: 0, firstPassApprovalRate: 1, revisionRate: 0, perPerson: [] }
  }
  const teamUserIds = teamUsers.map(u => u.id)

  const ownedTasks = await db.select().from(tasks).where(inArray(tasks.ownerId, teamUserIds))
  const inWindow = ownedTasks.filter(t =>
    t.updatedAt >= opts.since && t.updatedAt <= opts.until,
  )
  const completed = inWindow.filter(t => t.status === 'complete')
  const wontDo = inWindow.filter(t => t.status === 'wont_do')

  const completedTaskIds = completed.map(t => t.id)
  const revisionComments = completedTaskIds.length === 0 ? [] : await db.select()
    .from(taskComments)
    .where(and(
      inArray(taskComments.taskId, completedTaskIds),
      eq(taskComments.kind, 'review_revision'),
    ))
  const revisionedTaskIds = new Set(revisionComments.map(c => c.taskId))
  const firstPass = completed.filter(t => !revisionedTaskIds.has(t.id)).length
  const firstPassRate = completed.length === 0 ? 1 : firstPass / completed.length

  const perPerson = teamUsers.map(u => {
    const userCompleted = completed.filter(t => t.ownerId === u.id)
    const userFirstPass = userCompleted.filter(t => !revisionedTaskIds.has(t.id)).length
    return {
      userId: u.id,
      name: u.name,
      tasksCompleted: userCompleted.length,
      firstPassApprovalRate: userCompleted.length === 0 ? 1 : userFirstPass / userCompleted.length,
    }
  })

  return {
    tasksCompleted: completed.length,
    wontDoCount: wontDo.length,
    firstPassApprovalRate: firstPassRate,
    revisionRate: 1 - firstPassRate,
    perPerson,
  }
}
