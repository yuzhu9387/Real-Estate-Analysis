'use server'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { eq } from 'drizzle-orm'
import { db } from '@/db/client'
import { tasks, projects } from '@/db/schema'
import { requirePermission } from '@/lib/server/require-permission'
import { taskService } from '@/lib/services/task-service'
import { NotFoundError } from '@/lib/server/errors'

async function loadTaskCtx(taskId: string) {
  const taskRows = await db.select().from(tasks).where(eq(tasks.id, taskId))
  if (taskRows.length === 0) throw new NotFoundError('Task')
  const projRows = await db.select().from(projects).where(eq(projects.id, taskRows[0].projectId))
  return { task: taskRows[0], project: projRows[0] }
}

export async function setTaskStatus(raw: unknown) {
  const input = z.object({
    taskId: z.string().uuid(),
    status: z.enum(['not_started','started','pending_review','approved','complete','wont_do']),
  }).parse(raw)
  const { task, project } = await loadTaskCtx(input.taskId)
  const user = await requirePermission({
    type: 'task.set_status',
    project: { pmId: project.pmId, status: project.status },
    task: { ownerId: task.ownerId, reviewerId: task.reviewerId },
  })
  await taskService.setStatus({ taskId: input.taskId, status: input.status, actorId: user.id }, db)
  revalidatePath(`/projects/${project.id}`)
  revalidatePath('/my-tasks')
  return { ok: true }
}

export async function submitTaskForReview(raw: unknown) {
  const input = z.object({ taskId: z.string().uuid(), body: z.string().optional() }).parse(raw)
  const { task, project } = await loadTaskCtx(input.taskId)
  const user = await requirePermission({
    type: 'task.submit_review',
    project: { pmId: project.pmId, status: project.status },
    task: { ownerId: task.ownerId, reviewerId: task.reviewerId },
  })
  await taskService.submitForReview({ taskId: input.taskId, actorId: user.id, body: input.body }, db)
  revalidatePath(`/projects/${project.id}`)
  return { ok: true }
}

export async function approveTask(raw: unknown) {
  const input = z.object({ taskId: z.string().uuid(), body: z.string().optional() }).parse(raw)
  const { task, project } = await loadTaskCtx(input.taskId)
  const user = await requirePermission({
    type: 'task.review_decision',
    project: { pmId: project.pmId, status: project.status },
    task: { ownerId: task.ownerId, reviewerId: task.reviewerId },
  })
  await taskService.approve({ taskId: input.taskId, actorId: user.id, body: input.body }, db)
  revalidatePath(`/projects/${project.id}`)
  return { ok: true }
}

export async function requestTaskRevision(raw: unknown) {
  const input = z.object({ taskId: z.string().uuid(), body: z.string().min(1) }).parse(raw)
  const { task, project } = await loadTaskCtx(input.taskId)
  const user = await requirePermission({
    type: 'task.review_decision',
    project: { pmId: project.pmId, status: project.status },
    task: { ownerId: task.ownerId, reviewerId: task.reviewerId },
  })
  await taskService.requestRevision({ taskId: input.taskId, actorId: user.id, body: input.body }, db)
  revalidatePath(`/projects/${project.id}`)
  return { ok: true }
}

export async function addUnplannedTask(raw: unknown) {
  const input = z.object({
    projectId: z.string().uuid(),
    projectWorkflowId: z.string().uuid(),
    name: z.string().min(1),
    description: z.string().optional().nullable(),
    plannedDurationDays: z.number().int().min(0),
    ownerId: z.string().uuid(),
    reviewerId: z.string().uuid().optional().nullable(),
    upstreamTaskId: z.string().uuid().optional().nullable(),
  }).parse(raw)
  const projRows = await db.select().from(projects).where(eq(projects.id, input.projectId))
  if (projRows.length === 0) throw new NotFoundError('Project')
  const project = projRows[0]
  const user = await requirePermission({
    type: 'task.add_unplanned',
    project: { pmId: project.pmId, status: project.status },
  })
  const created = await taskService.addUnplannedTask({ ...input, actorId: user.id }, db)
  revalidatePath(`/projects/${project.id}`)
  return { ok: true, taskId: created.id }
}

export async function addPlannedTask(raw: unknown) {
  const input = z.object({
    projectId: z.string().uuid(),
    projectWorkflowId: z.string().uuid(),
    name: z.string().min(1),
    description: z.string().optional().nullable(),
    plannedDurationDays: z.number().int().min(0),
    ownerId: z.string().uuid(),
    reviewerId: z.string().uuid().optional().nullable(),
    upstreamTaskIds: z.array(z.string().uuid()).optional(),
    sortOrder: z.number().int().min(0).optional(),
  }).parse(raw)
  const projRows = await db.select().from(projects).where(eq(projects.id, input.projectId))
  if (projRows.length === 0) throw new NotFoundError('Project')
  const project = projRows[0]
  const user = await requirePermission({
    type: 'task.add_planned',
    project: { pmId: project.pmId, status: project.status },
  })
  const created = await taskService.addPlannedTask({ ...input, actorId: user.id }, db)
  revalidatePath(`/projects/${project.id}`)
  return { ok: true, taskId: created.id }
}

export async function addSubtask(raw: unknown) {
  const input = z.object({
    parentTaskId: z.string().uuid(),
    name: z.string().min(1),
    description: z.string().optional().nullable(),
    ownerId: z.string().uuid(),
  }).parse(raw)
  const { task, project } = await loadTaskCtx(input.parentTaskId)
  const user = await requirePermission({
    type: 'task.add_subtask',
    project: { pmId: project.pmId, status: project.status },
    task: { ownerId: task.ownerId, reviewerId: task.reviewerId },
  })
  const sub = await taskService.addSubtask({ ...input, actorId: user.id }, db)
  revalidatePath(`/projects/${project.id}`)
  return { ok: true, subtaskId: sub.id }
}

export async function reassignTask(raw: unknown) {
  const input = z.object({ taskId: z.string().uuid(), toUserId: z.string().uuid() }).parse(raw)
  const { task, project } = await loadTaskCtx(input.taskId)
  const user = await requirePermission({
    type: 'task.reassign',
    project: { pmId: project.pmId, status: project.status },
    task: { ownerId: task.ownerId, reviewerId: task.reviewerId },
  })
  await taskService.reassign({ taskId: input.taskId, toUserId: input.toUserId, actorId: user.id }, db)
  revalidatePath(`/projects/${project.id}`)
  return { ok: true }
}

export async function updateTaskNotes(raw: unknown) {
  const input = z.object({ taskId: z.string().uuid(), description: z.string() }).parse(raw)
  const { task, project } = await loadTaskCtx(input.taskId)
  const user = await requirePermission({
    type: 'task.update_notes',
    project: { pmId: project.pmId, status: project.status },
    task: { ownerId: task.ownerId, reviewerId: task.reviewerId },
  })
  await taskService.updateNotes({ ...input, actorId: user.id }, db)
  revalidatePath(`/projects/${project.id}`)
  return { ok: true }
}

export async function setTaskPriority(raw: unknown) {
  const input = z.object({
    taskId: z.string().uuid(),
    priority: z.enum(['low','normal','high']),
  }).parse(raw)
  const { task, project } = await loadTaskCtx(input.taskId)
  const user = await requirePermission({
    type: 'task.set_priority',
    project: { pmId: project.pmId, status: project.status },
    task: { ownerId: task.ownerId, reviewerId: task.reviewerId },
  })
  await taskService.setPriority({ taskId: input.taskId, priority: input.priority, actorId: user.id }, db)
  revalidatePath(`/projects/${project.id}`)
  revalidatePath('/my-tasks')
  return { ok: true }
}

export async function deleteTaskInDraft(raw: unknown) {
  const input = z.object({ taskId: z.string().uuid() }).parse(raw)
  const { task, project } = await loadTaskCtx(input.taskId)
  const user = await requirePermission({
    type: 'task.update_structure',
    project: { pmId: project.pmId, status: project.status },
  })
  await taskService.deleteInDraft(input.taskId, user.id, db)
  revalidatePath(`/projects/${project.id}`)
  revalidatePath('/my-tasks')
  return { ok: true }
}
