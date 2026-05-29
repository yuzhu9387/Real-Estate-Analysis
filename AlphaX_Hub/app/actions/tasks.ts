'use server'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { eq } from 'drizzle-orm'
import { db } from '@/db/client'
import { tasks, projects, type Project } from '@/db/schema'
import { requirePermission } from '@/lib/server/require-permission'
import { requireUser } from '@/lib/server/get-current-user'
import { taskService } from '@/lib/services/task-service'
import { NotFoundError } from '@/lib/server/errors'

async function loadTaskCtx(taskId: string) {
  const taskRows = await db.select().from(tasks).where(eq(tasks.id, taskId))
  if (taskRows.length === 0) throw new NotFoundError('Task')
  const task = taskRows[0]
  // Personal tasks have task.projectId === null — no project row to load.
  const project = task.projectId
    ? (await db.select().from(projects).where(eq(projects.id, task.projectId)))[0] ?? null
    : null
  return { task, project }
}

/**
 * Narrows `project` to non-null. Use at the top of any action that cannot meaningfully
 * operate on a personal task (review flow, planned-task structure changes, etc.).
 */
function assertProjectTask(project: Project | null): asserts project is Project {
  if (!project) {
    throw new Error('This action is not available for personal tasks (no project).')
  }
}

export async function setTaskStatus(raw: unknown) {
  const input = z.object({
    taskId: z.string().uuid(),
    status: z.enum(['not_started','started','pending_review','approved','complete','wont_do']),
  }).parse(raw)
  const { task, project } = await loadTaskCtx(input.taskId)

  let actorId: string
  if (project) {
    // Project task: gate through the existing permission system.
    const user = await requirePermission({
      type: 'task.set_status',
      project: { pmId: project.pmId, status: project.status },
      task: { ownerId: task.ownerId, reviewerId: task.reviewerId },
    })
    actorId = user.id
  } else {
    // Personal task: only the owner can change status. No project context to authorize against.
    const me = await requireUser()
    if (task.ownerId !== me.id) throw new Error('You can only change status on your own personal tasks.')
    actorId = me.id
  }

  await taskService.setStatus({ taskId: input.taskId, status: input.status, actorId }, db)
  if (project) revalidatePath(`/projects/${project.id}`)
  revalidatePath('/my-tasks')
  return { ok: true }
}

export async function submitTaskForReview(raw: unknown) {
  const input = z.object({ taskId: z.string().uuid(), body: z.string().optional() }).parse(raw)
  const { task, project } = await loadTaskCtx(input.taskId)
  assertProjectTask(project)
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
  assertProjectTask(project)
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
  assertProjectTask(project)
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

/**
 * Quick add from /my-tasks. Creates a *personal* task — no project, no workflow.
 *
 *   - target_start_date / target_end_date are stored directly from the caller.
 *   - planned_*_day, project_id, project_workflow_id, sort_order all NULL.
 *
 * The actor must be the task owner (you can only quick-add tasks for yourself).
 */
export async function quickAddTask(raw: unknown) {
  const input = z.object({
    name: z.string().min(1, 'Task name is required'),
    ownerId: z.string().uuid('Assignee is required'),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Target start date is required'),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Target end date is required'),
  }).parse(raw)

  if (input.endDate < input.startDate) {
    throw new Error('Target end date must be on or after target start date.')
  }

  const me = await requireUser()
  if (input.ownerId !== me.id) {
    throw new Error('You can only quick-add tasks for yourself.')
  }

  const created = await taskService.quickAddPersonalTask({
    name: input.name,
    ownerId: input.ownerId,
    targetStartDate: input.startDate,
    targetEndDate: input.endDate,
    actorId: me.id,
  }, db)

  revalidatePath('/my-tasks')
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
  assertProjectTask(project)
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
  assertProjectTask(project)
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
  assertProjectTask(project)
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
  assertProjectTask(project)
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
  const { project } = await loadTaskCtx(input.taskId)
  assertProjectTask(project)
  const user = await requirePermission({
    type: 'task.update_structure',
    project: { pmId: project.pmId, status: project.status },
  })
  await taskService.deleteInDraft(input.taskId, user.id, db)
  revalidatePath(`/projects/${project.id}`)
  revalidatePath('/my-tasks')
  return { ok: true }
}

export async function updateTaskMetadata(raw: unknown) {
  const input = z.object({
    taskId: z.string().uuid(),
    name: z.string().min(1).optional(),
    description: z.string().optional().nullable(),
    reviewerId: z.string().uuid().nullable().optional(),
    targetStartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    targetEndDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  }).refine(
    v => !v.targetStartDate || !v.targetEndDate || v.targetEndDate >= v.targetStartDate,
    { message: 'targetEndDate must be on or after targetStartDate' },
  ).parse(raw)

  const { task, project } = await loadTaskCtx(input.taskId)
  assertProjectTask(project)
  const user = await requirePermission({
    type: 'task.update_structure',
    project: { pmId: project.pmId, status: project.status },
  })
  await taskService.updateMetadata({ ...input, actorId: user.id }, db)
  revalidatePath(`/tasks/${input.taskId}`)
  revalidatePath(`/projects/${project.id}`)
  return { ok: true }
}
