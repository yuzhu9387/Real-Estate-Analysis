import { eq, inArray, desc } from 'drizzle-orm'
import type { DB } from '@/db/client'
import {
  projects, projectPhases, projectWorkflows, tasks, taskDeps, activities, taskComments, users,
  type Project, type ProjectPhase, type ProjectWorkflow, type Task, type TaskDep, type Activity, type TaskComment, type User,
} from '@/db/schema'

export type ProjectPageData = {
  project: Project
  phases: ProjectPhase[]
  workflows: ProjectWorkflow[]
  tasks: Task[]
  taskDeps: TaskDep[]
  users: User[]
}

export async function getProjectPageData(db: DB, projectId: string): Promise<ProjectPageData | null> {
  const projectRows = await db.select().from(projects).where(eq(projects.id, projectId))
  if (projectRows.length === 0) return null
  const project = projectRows[0]

  const [phaseRows, workflowRows, taskRows, depRows] = await Promise.all([
    db.select().from(projectPhases).where(eq(projectPhases.projectId, projectId)),
    db.select().from(projectWorkflows).where(eq(projectWorkflows.projectId, projectId)),
    db.select().from(tasks).where(eq(tasks.projectId, projectId)),
    db.select().from(taskDeps).where(eq(taskDeps.projectId, projectId)),
  ])

  const userIds = new Set<string>([project.pmId, project.createdById])
  for (const t of taskRows) {
    userIds.add(t.ownerId)
    if (t.reviewerId) userIds.add(t.reviewerId)
  }
  const userRows = userIds.size === 0
    ? []
    : await db.select().from(users).where(inArray(users.id, Array.from(userIds)))

  return {
    project, phases: phaseRows, workflows: workflowRows,
    tasks: taskRows, taskDeps: depRows, users: userRows,
  }
}

export type ProjectActivitiesData = {
  activities: Activity[]
  users: User[]
  tasks: Task[]
}

export async function getProjectActivities(db: DB, projectId: string, limit = 100): Promise<ProjectActivitiesData> {
  const acts = await db.select().from(activities)
    .where(eq(activities.projectId, projectId))
    .orderBy(desc(activities.createdAt))
    .limit(limit)
  if (acts.length === 0) return { activities: [], users: [], tasks: [] }

  const actorIds = Array.from(new Set(acts.map(a => a.actorId)))
  const taskIds = Array.from(new Set(
    acts
      .map(a => (a.payload as { taskId?: string })?.taskId)
      .filter((id): id is string => typeof id === 'string'),
  ))
  const [actorRows, taskRows] = await Promise.all([
    db.select().from(users).where(inArray(users.id, actorIds)),
    taskIds.length === 0 ? Promise.resolve([] as Task[]) : db.select().from(tasks).where(inArray(tasks.id, taskIds)),
  ])
  return { activities: acts, users: actorRows, tasks: taskRows }
}

export async function getTaskComments(db: DB, taskId: string): Promise<{ comments: TaskComment[]; users: User[] }> {
  const rows = await db.select().from(taskComments)
    .where(eq(taskComments.taskId, taskId))
    .orderBy(desc(taskComments.createdAt))
  if (rows.length === 0) return { comments: [], users: [] }
  const userIds = Array.from(new Set(rows.map(r => r.authorId)))
  const userRows = await db.select().from(users).where(inArray(users.id, userIds))
  return { comments: rows, users: userRows }
}
