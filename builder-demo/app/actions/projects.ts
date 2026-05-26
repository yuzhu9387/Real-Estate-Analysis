'use server'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { db } from '@/db/client'
import { requirePermission } from '@/lib/server/require-permission'
import { projectService } from '@/lib/services/project-service'
import { NotFoundError } from '@/lib/server/errors'

const CreateInput = z.object({
  name: z.string().min(1),
  brand: z.enum(['al_homes', 'alera', 'apex']),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  zip: z.string().optional().nullable(),
  titleHolder: z.string().optional().nullable(),
  projectStrategy: z.string().optional().nullable(),
  purchaseDate: z.string().optional().nullable(),
  purchasePrice: z.string().optional().nullable(),
  targetExitQuarter: z.string().optional().nullable(),
  targetProjectDurationDays: z.number().int().optional().nullable(),
  targetPermitDate: z.string().optional().nullable(),
  targetConstructionEndDate: z.string().optional().nullable(),
  assignments: z.array(z.object({
    phaseName: z.enum(['Permitting','Construction','Sale']),
    templateId: z.string().uuid(),
    sortOrder: z.number().int().min(0),
  })).min(1),
})

export async function createProject(raw: unknown) {
  const input = CreateInput.parse(raw)
  const user = await requirePermission({ type: 'project.create' })
  const project = await projectService.create({ ...input, createdById: user.id, pmId: user.id }, db)
  revalidatePath('/projects')
  return { ok: true, id: project.id }
}

export async function transferPm(raw: unknown) {
  const input = z.object({ projectId: z.string().uuid(), toUserId: z.string().uuid() }).parse(raw)
  const project = await projectService.getById(input.projectId, db)
  if (!project) throw new NotFoundError('Project')
  const user = await requirePermission({ type: 'project.transfer_pm', project: { pmId: project.pmId, status: project.status } })
  await projectService.transferPm({ ...input, actorId: user.id }, db)
  revalidatePath(`/projects/${input.projectId}`)
  return { ok: true }
}

export async function forceReassignPm(raw: unknown) {
  const input = z.object({
    projectId: z.string().uuid(), toUserId: z.string().uuid(), reason: z.string().min(1),
  }).parse(raw)
  const user = await requirePermission({ type: 'project.force_reassign_pm' })
  await projectService.transferPm({ projectId: input.projectId, toUserId: input.toUserId, actorId: user.id }, db)
  revalidatePath(`/projects/${input.projectId}`)
  return { ok: true }
}

export async function markProjectComplete(raw: unknown) {
  const input = z.object({ projectId: z.string().uuid() }).parse(raw)
  const project = await projectService.getById(input.projectId, db)
  if (!project) throw new NotFoundError('Project')
  const user = await requirePermission({ type: 'project.mark_complete', project: { pmId: project.pmId, status: project.status } })
  await projectService.markComplete({ projectId: input.projectId, actorId: user.id }, db)
  revalidatePath(`/projects/${input.projectId}`)
  return { ok: true }
}

export async function archiveProject(raw: unknown) {
  const input = z.object({ projectId: z.string().uuid() }).parse(raw)
  const project = await projectService.getById(input.projectId, db)
  if (!project) throw new NotFoundError('Project')
  const user = await requirePermission({ type: 'project.archive', project: { pmId: project.pmId, status: project.status } })
  await projectService.archive({ projectId: input.projectId, actorId: user.id }, db)
  revalidatePath('/projects')
  return { ok: true }
}

export async function unlockProjectToDraft(raw: unknown) {
  const input = z.object({ projectId: z.string().uuid(), reason: z.string().min(1) }).parse(raw)
  const user = await requirePermission({ type: 'project.unlock_to_draft' })
  await projectService.unlockToDraft({ projectId: input.projectId, actorId: user.id, reason: input.reason }, db)
  revalidatePath(`/projects/${input.projectId}`)
  return { ok: true }
}
