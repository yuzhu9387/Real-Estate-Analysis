'use server'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { db } from '@/db/client'
import { requirePermission } from '@/lib/server/require-permission'
import { projectService } from '@/lib/services/project-service'
import { NotFoundError } from '@/lib/server/errors'

const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const UuidOrNull = z.string().uuid().nullable().optional()
const PosInt = z.number().int().min(0).optional().nullable()

const CreateInput = z.object({
  name: z.string().min(1),
  brand: z.enum(['al_homes', 'alera', 'apex']),
  // Section 1
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  zip: z.string().optional().nullable(),
  titleHolder: z.string().optional().nullable(),
  projectStrategy: z.string().optional().nullable(),
  purchaseDate: IsoDate.optional().nullable(),
  purchasePrice: z.string().optional().nullable(),
  // Section 2 — caller supplies start + 3 durations; the service runs the cascade.
  targetExitQuarter: z.string().optional().nullable(),
  targetStartDate: IsoDate.optional().nullable(),
  targetPermittingDurationDays: PosInt,
  targetConstructionDurationDays: PosInt,
  targetSalesDurationDays: PosInt,
  // Section 3 — overall PM is required (becomes the project pmId); per-phase PMs optional.
  pmId: z.string().uuid().optional(),
  permittingPmId: UuidOrNull,
  constructionPmId: UuidOrNull,
  salesPmId: UuidOrNull,
  assignments: z.array(z.object({
    phaseName: z.enum(['Permitting','Construction','Sale']),
    templateId: z.string().uuid(),
    sortOrder: z.number().int().min(0),
  })).min(1),
})

export async function createProject(raw: unknown) {
  const input = CreateInput.parse(raw)
  const user = await requirePermission({ type: 'project.create' })
  const project = await projectService.create({
    ...input,
    createdById: user.id,
    pmId: input.pmId ?? user.id,
  }, db)
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

export async function updateProjectMetadata(raw: unknown) {
  const PatchSchema = z.object({
    name: z.string().min(1).optional(),
    brand: z.enum(['al_homes', 'alera', 'apex']).optional(),
    // Section 1
    address: z.string().optional().nullable(),
    city: z.string().optional().nullable(),
    state: z.string().optional().nullable(),
    zip: z.string().optional().nullable(),
    titleHolder: z.string().optional().nullable(),
    projectStrategy: z.string().optional().nullable(),
    purchaseDate: IsoDate.optional().nullable(),
    purchasePrice: z.string().optional().nullable(),
    // Section 2 — start + 3 durations. Computed dates are derived server-side.
    targetExitQuarter: z.string().regex(/^\d{4}-Q[1-4]$/).optional().nullable(),
    targetStartDate: IsoDate.optional().nullable(),
    targetPermittingDurationDays: PosInt,
    targetConstructionDurationDays: PosInt,
    targetSalesDurationDays: PosInt,
    // Section 3
    pmId: z.string().uuid().optional(),
    permittingPmId: UuidOrNull,
    constructionPmId: UuidOrNull,
    salesPmId: UuidOrNull,
  })
  const input = z.object({
    projectId: z.string().uuid(),
    patch: PatchSchema,
  }).parse(raw)
  const project = await projectService.getById(input.projectId, db)
  if (!project) throw new NotFoundError('Project')
  const user = await requirePermission({
    type: 'project.update_meta',
    project: { pmId: project.pmId, status: project.status },
  })
  await projectService.updateMetadata({ ...input, actorId: user.id }, db)
  revalidatePath(`/projects/${input.projectId}`)
  return { ok: true }
}

export async function unlockProjectToDraft(raw: unknown) {
  const input = z.object({ projectId: z.string().uuid(), reason: z.string().min(1) }).parse(raw)
  const user = await requirePermission({ type: 'project.unlock_to_draft' })
  await projectService.unlockToDraft({ projectId: input.projectId, actorId: user.id, reason: input.reason }, db)
  revalidatePath(`/projects/${input.projectId}`)
  return { ok: true }
}
