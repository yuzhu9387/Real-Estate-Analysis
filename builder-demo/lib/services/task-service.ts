import { eq } from 'drizzle-orm'
import type { DB } from '@/db/client'
import { tasks, taskDeps, projectWorkflows, activities, taskComments, type TaskStatus } from '@/db/schema'
import { NotFoundError, ValidationError } from '@/lib/server/errors'
import { computeBlocked } from '@/lib/critical-path/blocked'

type Tx = Parameters<Parameters<DB['transaction']>[0]>[0]

const TERMINAL = new Set<TaskStatus>(['complete', 'wont_do'])

async function recomputeBlockedForProject(tx: Tx, projectId: string) {
  const allTasks = await tx.select().from(tasks).where(eq(tasks.projectId, projectId))
  const allDeps = await tx.select().from(taskDeps).where(eq(taskDeps.projectId, projectId))
  const blocked = computeBlocked({
    tasks: allTasks.map(t => ({ id: t.id, status: t.status })),
    deps: allDeps.map(d => ({ fromTaskId: d.fromTaskId, toTaskId: d.toTaskId })),
  })
  for (const b of blocked) {
    const existing = allTasks.find(t => t.id === b.taskId)
    if (existing && existing.isBlocked !== b.isBlocked) {
      await tx.update(tasks).set({ isBlocked: b.isBlocked, updatedAt: new Date() }).where(eq(tasks.id, b.taskId))
    }
  }
}

async function maybeAutoCompleteWorkflow(tx: Tx, projectWorkflowId: string) {
  const siblings = await tx.select().from(tasks).where(eq(tasks.projectWorkflowId, projectWorkflowId))
  const allTerminal = siblings.length > 0 && siblings.every(t => TERMINAL.has(t.status))
  const anyStarted = siblings.some(t => t.status !== 'not_started')
  const pw = (await tx.select().from(projectWorkflows).where(eq(projectWorkflows.id, projectWorkflowId)))[0]

  let newStatus: 'pending' | 'in_progress' | 'complete' = pw.status
  if (allTerminal) newStatus = 'complete'
  else if (anyStarted) newStatus = 'in_progress'
  else newStatus = 'pending'

  if (newStatus !== pw.status) {
    await tx.update(projectWorkflows).set({ status: newStatus }).where(eq(projectWorkflows.id, projectWorkflowId))
  }
}

export const taskService = {
  async setStatus(input: { taskId: string; status: TaskStatus; actorId: string }, db: DB) {
    return db.transaction(async (tx) => {
      const rows = await tx.select().from(tasks).where(eq(tasks.id, input.taskId))
      if (rows.length === 0) throw new NotFoundError('Task')
      const task = rows[0]
      if (task.status === input.status) return

      const now = new Date()
      await tx.update(tasks).set({ status: input.status, updatedAt: now }).where(eq(tasks.id, task.id))

      await tx.insert(activities).values({
        projectId: task.projectId, actorId: input.actorId,
        type: 'task.status_changed',
        payload: { taskId: task.id, from: task.status, to: input.status },
      })

      await recomputeBlockedForProject(tx, task.projectId)
      await maybeAutoCompleteWorkflow(tx, task.projectWorkflowId)
    })
  },

  async getById(id: string, db: DB) {
    const rows = await db.select().from(tasks).where(eq(tasks.id, id))
    return rows[0] ?? null
  },

  async submitForReview(input: { taskId: string; actorId: string; body?: string }, db: DB) {
    return db.transaction(async (tx) => {
      const rows = await tx.select().from(tasks).where(eq(tasks.id, input.taskId))
      if (rows.length === 0) throw new NotFoundError('Task')
      await tx.update(tasks).set({ status: 'pending_review', updatedAt: new Date() })
        .where(eq(tasks.id, input.taskId))
      if (input.body && input.body.trim()) {
        await tx.insert(taskComments).values({
          taskId: input.taskId, authorId: input.actorId,
          body: input.body, kind: 'review_request',
        })
      }
      await tx.insert(activities).values({
        projectId: rows[0].projectId, actorId: input.actorId,
        type: 'task.submitted_for_review', payload: { taskId: input.taskId },
      })
    })
  },

  async approve(input: { taskId: string; actorId: string; body?: string }, db: DB) {
    return db.transaction(async (tx) => {
      const rows = await tx.select().from(tasks).where(eq(tasks.id, input.taskId))
      if (rows.length === 0) throw new NotFoundError('Task')
      if (rows[0].status !== 'pending_review') {
        throw new ValidationError('Task must be pending_review to approve')
      }
      await tx.update(tasks).set({ status: 'approved', updatedAt: new Date() })
        .where(eq(tasks.id, input.taskId))
      if (input.body?.trim()) {
        await tx.insert(taskComments).values({
          taskId: input.taskId, authorId: input.actorId,
          body: input.body, kind: 'review_approve',
        })
      }
      await tx.insert(activities).values({
        projectId: rows[0].projectId, actorId: input.actorId,
        type: 'task.approved', payload: { taskId: input.taskId },
      })
    })
  },

  async requestRevision(input: { taskId: string; actorId: string; body: string }, db: DB) {
    if (!input.body?.trim()) throw new ValidationError('Revision request requires a comment')
    return db.transaction(async (tx) => {
      const rows = await tx.select().from(tasks).where(eq(tasks.id, input.taskId))
      if (rows.length === 0) throw new NotFoundError('Task')
      await tx.update(tasks).set({ status: 'started', updatedAt: new Date() })
        .where(eq(tasks.id, input.taskId))
      await tx.insert(taskComments).values({
        taskId: input.taskId, authorId: input.actorId,
        body: input.body, kind: 'review_revision',
      })
      await tx.insert(activities).values({
        projectId: rows[0].projectId, actorId: input.actorId,
        type: 'task.revision_requested', payload: { taskId: input.taskId },
      })
    })
  },

  async markComplete(input: { taskId: string; actorId: string }, db: DB) {
    return this.setStatus({ taskId: input.taskId, status: 'complete', actorId: input.actorId }, db)
  },

  async addUnplannedTask(input: {
    projectId: string
    projectWorkflowId: string
    name: string
    description?: string | null
    plannedDurationDays: number
    ownerId: string
    reviewerId?: string | null
    actorId: string
    upstreamTaskId?: string | null
  }, db: DB) {
    return db.transaction(async (tx) => {
      const siblings = await tx.select().from(tasks).where(eq(tasks.projectWorkflowId, input.projectWorkflowId))
      const sortOrder = siblings.length === 0 ? 0 : Math.max(...siblings.map(s => s.sortOrder)) + 1

      const [inserted] = await tx.insert(tasks).values({
        projectId: input.projectId,
        projectWorkflowId: input.projectWorkflowId,
        name: input.name,
        description: input.description ?? null,
        ownerId: input.ownerId,
        reviewerId: input.reviewerId ?? null,
        plannedDurationDays: input.plannedDurationDays,
        isUnplanned: true,
        sortOrder,
      }).returning()

      if (input.upstreamTaskId) {
        await tx.insert(taskDeps).values({
          projectId: input.projectId,
          fromTaskId: input.upstreamTaskId,
          toTaskId: inserted.id,
          lagDays: 0,
        })
      }

      const { applyScheduleToProject } = await import('@/lib/snapshot/apply-schedule')
      await applyScheduleToProject(tx, { projectId: input.projectId })

      await tx.insert(activities).values({
        projectId: input.projectId, actorId: input.actorId,
        type: 'task.added_unplanned', payload: { taskId: inserted.id, name: input.name },
      })

      const updated = await tx.select().from(tasks).where(eq(tasks.id, inserted.id))
      return updated[0]
    })
  },

  async addPlannedTask(input: {
    projectId: string
    projectWorkflowId: string
    name: string
    description?: string | null
    plannedDurationDays: number
    ownerId: string
    reviewerId?: string | null
    actorId: string
    upstreamTaskIds?: string[]
    sortOrder?: number
  }, db: DB) {
    const { projects } = await import('@/db/schema')
    const { ProjectLockedError } = await import('@/lib/server/errors')
    const proj = (await db.select().from(projects).where(eq(projects.id, input.projectId)))[0]
    if (!proj) throw new NotFoundError('Project')
    if (proj.status !== 'draft') throw new ProjectLockedError(proj.status)

    return db.transaction(async (tx) => {
      const siblings = await tx.select().from(tasks).where(eq(tasks.projectWorkflowId, input.projectWorkflowId))
      const sortOrder = input.sortOrder ?? (siblings.length === 0 ? 0 : Math.max(...siblings.map(s => s.sortOrder)) + 1)

      const [inserted] = await tx.insert(tasks).values({
        projectId: input.projectId,
        projectWorkflowId: input.projectWorkflowId,
        name: input.name,
        description: input.description ?? null,
        ownerId: input.ownerId,
        reviewerId: input.reviewerId ?? null,
        plannedDurationDays: input.plannedDurationDays,
        isUnplanned: false,
        sortOrder,
      }).returning()

      for (const upstreamId of input.upstreamTaskIds ?? []) {
        await tx.insert(taskDeps).values({
          projectId: input.projectId,
          fromTaskId: upstreamId,
          toTaskId: inserted.id,
          lagDays: 0,
        })
      }

      await tx.insert(activities).values({
        projectId: input.projectId, actorId: input.actorId,
        type: 'task.added_planned', payload: { taskId: inserted.id, name: input.name },
      })

      return inserted
    })
  },

  async addSubtask(input: {
    parentTaskId: string
    name: string
    description?: string | null
    ownerId: string
    actorId: string
  }, db: DB) {
    return db.transaction(async (tx) => {
      const parentRows = await tx.select().from(tasks).where(eq(tasks.id, input.parentTaskId))
      if (parentRows.length === 0) throw new NotFoundError('Parent task')
      const parent = parentRows[0]
      const siblings = await tx.select().from(tasks).where(eq(tasks.parentTaskId, parent.id))
      const sortOrder = siblings.length === 0 ? 0 : Math.max(...siblings.map(s => s.sortOrder)) + 1
      const [inserted] = await tx.insert(tasks).values({
        projectId: parent.projectId,
        projectWorkflowId: parent.projectWorkflowId,
        parentTaskId: parent.id,
        name: input.name,
        description: input.description ?? null,
        ownerId: input.ownerId,
        plannedDurationDays: 0,
        sortOrder,
      }).returning()
      await tx.insert(activities).values({
        projectId: parent.projectId, actorId: input.actorId,
        type: 'task.subtask_added', payload: { parentTaskId: parent.id, subtaskId: inserted.id },
      })
      return inserted
    })
  },

  async reassign(input: { taskId: string; toUserId: string; actorId: string }, db: DB) {
    return db.transaction(async (tx) => {
      const rows = await tx.select().from(tasks).where(eq(tasks.id, input.taskId))
      if (rows.length === 0) throw new NotFoundError('Task')
      const before = rows[0]
      await tx.update(tasks).set({ ownerId: input.toUserId, updatedAt: new Date() })
        .where(eq(tasks.id, input.taskId))
      await tx.insert(activities).values({
        projectId: before.projectId, actorId: input.actorId,
        type: 'task.reassigned',
        payload: { taskId: input.taskId, from: before.ownerId, to: input.toUserId },
      })
    })
  },

  async updateNotes(input: { taskId: string; description: string; actorId: string }, db: DB) {
    await db.update(tasks).set({ description: input.description, updatedAt: new Date() })
      .where(eq(tasks.id, input.taskId))
  },
}
