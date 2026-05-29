import { eq, and, isNull, asc, desc } from 'drizzle-orm'
import type { DB } from '@/db/client'
import {
  tasks, projects, projectWorkflows, users, taskDeps, taskComments, activities,
  type TaskStatus,
} from '@/db/schema'

export type TaskDetailSubtask = {
  id: string
  name: string
  ownerId: string
  ownerName: string
  status: TaskStatus
}

export type TaskDetailComment = {
  id: string
  body: string
  kind: 'discussion' | 'review_request' | 'review_approve' | 'review_revision'
  authorId: string
  authorName: string
  createdAt: Date
}

export type TaskDetailActivity = {
  id: string
  kind: string
  payload: unknown
  actorId: string
  actorName: string
  createdAt: Date
}

export type TaskDetail = {
  task: typeof tasks.$inferSelect
  project: {
    id: string
    name: string
    brand: string
    status: string
    pmId: string
    kickedOffAt: Date | null
  }
  workflow: {
    id: string
    name: string
    projectPhaseId: string
  }
  owner: { id: string; name: string; larkOpenId: string | null; avatarUrl: string | null }
  reviewer: { id: string; name: string; larkOpenId: string | null; avatarUrl: string | null } | null
  parent: { id: string; name: string } | null
  upstreamDeps: Array<{ id: string; name: string }>
  subtasks: TaskDetailSubtask[]
  comments: TaskDetailComment[]
  activity: TaskDetailActivity[]
  prevTaskId: string | null
  nextTaskId: string | null
}

export async function getTaskDetail(
  taskId: string,
  db: DB,
): Promise<TaskDetail | null> {
  const taskRows = await db.select().from(tasks).where(eq(tasks.id, taskId))
  if (taskRows.length === 0) return null
  const task = taskRows[0]

  if (!task.projectId) {
    // Personal task (no project) — supported in the schema but not by this page.
    return null
  }

  const [
    projRows, wfRows, ownerRows, reviewerRows, parentRows,
    upstreamDepRows, subtaskRows, commentRows, activityRows,
    siblingRows,
  ] = await Promise.all([
    db.select().from(projects).where(eq(projects.id, task.projectId)),
    db.select().from(projectWorkflows).where(eq(projectWorkflows.id, task.projectWorkflowId!)),
    db.select().from(users).where(eq(users.id, task.ownerId)),
    task.reviewerId
      ? db.select().from(users).where(eq(users.id, task.reviewerId))
      : Promise.resolve([]),
    task.parentTaskId
      ? db.select({ id: tasks.id, name: tasks.name })
          .from(tasks).where(eq(tasks.id, task.parentTaskId))
      : Promise.resolve([]),
    db.select({ id: tasks.id, name: tasks.name })
      .from(taskDeps)
      .innerJoin(tasks, eq(tasks.id, taskDeps.fromTaskId))
      .where(eq(taskDeps.toTaskId, task.id)),
    db.select({
        id: tasks.id, name: tasks.name, ownerId: tasks.ownerId, status: tasks.status,
        ownerName: users.name,
      })
      .from(tasks).innerJoin(users, eq(users.id, tasks.ownerId))
      .where(eq(tasks.parentTaskId, task.id))
      .orderBy(asc(tasks.sortOrder)),
    db.select({
        id: taskComments.id, body: taskComments.body, kind: taskComments.kind,
        authorId: taskComments.authorId, createdAt: taskComments.createdAt,
        authorName: users.name,
      })
      .from(taskComments).innerJoin(users, eq(users.id, taskComments.authorId))
      .where(eq(taskComments.taskId, task.id))
      .orderBy(asc(taskComments.createdAt)),
    db.select({
        id: activities.id, kind: activities.type, payload: activities.payload,
        actorId: activities.actorId, createdAt: activities.createdAt,
        actorName: users.name,
      })
      .from(activities).innerJoin(users, eq(users.id, activities.actorId))
      .where(eq(activities.projectId, task.projectId))
      .orderBy(desc(activities.createdAt))
      .limit(50),
    // Top-level sibling task IDs in this project, sortOrder asc, for prev/next.
    task.parentTaskId
      ? Promise.resolve([])
      : db.select({ id: tasks.id, sortOrder: tasks.sortOrder, createdAt: tasks.createdAt })
          .from(tasks)
          .where(and(eq(tasks.projectId, task.projectId), isNull(tasks.parentTaskId)))
          .orderBy(asc(tasks.sortOrder), asc(tasks.createdAt)),
  ])

  if (projRows.length === 0 || wfRows.length === 0 || ownerRows.length === 0) {
    return null
  }

  const proj = projRows[0]
  const wf = wfRows[0]
  const owner = ownerRows[0]
  const reviewer = reviewerRows[0] ?? null
  const parent = parentRows[0] ?? null

  // Filter activity by payload.taskId === task.id.
  const taskActivity = activityRows
    .filter(a => {
      const p = a.payload as Record<string, unknown> | null
      return p && (p.taskId === task.id || p.subtaskId === task.id || p.parentTaskId === task.id)
    })
    .slice(0, 20)

  let prevTaskId: string | null = null
  let nextTaskId: string | null = null
  if (siblingRows.length > 0) {
    const idx = siblingRows.findIndex(r => r.id === task.id)
    if (idx > 0) prevTaskId = siblingRows[idx - 1].id
    if (idx >= 0 && idx < siblingRows.length - 1) nextTaskId = siblingRows[idx + 1].id
  }

  return {
    task,
    project: {
      id: proj.id, name: proj.name, brand: proj.brand,
      status: proj.status, pmId: proj.pmId, kickedOffAt: proj.kickedOffAt,
    },
    workflow: { id: wf.id, name: wf.name, projectPhaseId: wf.projectPhaseId },
    owner: { id: owner.id, name: owner.name, larkOpenId: owner.larkOpenId ?? null, avatarUrl: owner.avatarUrl ?? null },
    reviewer: reviewer
      ? { id: reviewer.id, name: reviewer.name, larkOpenId: reviewer.larkOpenId ?? null, avatarUrl: reviewer.avatarUrl ?? null }
      : null,
    parent,
    upstreamDeps: upstreamDepRows,
    subtasks: subtaskRows,
    comments: commentRows.map(c => ({
      id: c.id, body: c.body, kind: c.kind, authorId: c.authorId,
      authorName: c.authorName, createdAt: c.createdAt,
    })),
    activity: taskActivity.map(a => ({
      id: a.id, kind: a.kind, payload: a.payload, actorId: a.actorId,
      actorName: a.actorName, createdAt: a.createdAt,
    })),
    prevTaskId,
    nextTaskId,
  }
}
