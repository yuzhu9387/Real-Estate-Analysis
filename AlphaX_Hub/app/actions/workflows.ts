'use server'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { db } from '@/db/client'
import { requirePermission } from '@/lib/server/require-permission'
import { workflowTemplateService } from '@/lib/services/workflow-template-service'
import { PRODUCT_TYPES } from '@/lib/workflows/product-types'

const ProductTypeEnum = z.enum(PRODUCT_TYPES)

const TaskInput = z.object({
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  startDay: z.number().int().min(1),
  endDay: z.number().int().min(1),
  ownerRoleLabel: z.string().optional().nullable(),
}).refine(t => t.endDay >= t.startDay, { message: 'endDay must be >= startDay' })

const DepInput = z.object({
  fromIdx: z.number().int().min(0),
  toIdx: z.number().int().min(0),
  lagDays: z.number().int().default(0),
})

const CreateInput = z.object({
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  productType: ProductTypeEnum,
  tasks: z.array(TaskInput).min(1),
  deps: z.array(DepInput),
})

export async function createWorkflowTemplate(raw: unknown) {
  const input = CreateInput.parse(raw)
  const user = await requirePermission({ type: 'workflow.create' })
  const tpl = await workflowTemplateService.create({ ...input, createdById: user.id }, db)
  revalidatePath('/workflows')
  return { ok: true, id: tpl.id }
}

const UpdateInput = z.object({
  id: z.string().uuid(),
  name: z.string().optional(),
  description: z.string().optional().nullable(),
  productType: ProductTypeEnum.nullable().optional(),
  tasks: z.array(TaskInput).min(1),
  deps: z.array(DepInput),
})

export async function updateWorkflowTemplate(raw: unknown) {
  const input = UpdateInput.parse(raw)
  const existing = await workflowTemplateService.getById(input.id, db)
  if (!existing) throw new Error('not found')
  await requirePermission({ type: 'workflow.update', workflow: { createdById: existing.createdById } })
  await workflowTemplateService.update(input.id, input, db)
  revalidatePath('/workflows')
  revalidatePath(`/workflows/${input.id}`)
  return { ok: true }
}

export async function archiveWorkflowTemplate(raw: unknown) {
  const input = z.object({ id: z.string().uuid() }).parse(raw)
  const existing = await workflowTemplateService.getById(input.id, db)
  if (!existing) throw new Error('not found')
  await requirePermission({ type: 'workflow.delete', workflow: { createdById: existing.createdById } })
  await workflowTemplateService.archive(input.id, db)
  revalidatePath('/workflows')
  return { ok: true }
}

export async function duplicateWorkflowTemplate(raw: unknown) {
  const input = z.object({
    sourceId: z.string().uuid(),
    newName: z.string().min(1),
  }).parse(raw)
  const user = await requirePermission({ type: 'workflow.create' })
  const tpl = await workflowTemplateService.duplicate(input.sourceId, {
    newName: input.newName, createdById: user.id,
  }, db)
  revalidatePath('/workflows')
  return { ok: true, id: tpl.id }
}

export async function unarchiveWorkflowTemplate(raw: unknown) {
  const input = z.object({ id: z.string().uuid() }).parse(raw)
  const existing = await workflowTemplateService.getById(input.id, db)
  if (!existing) throw new Error('not found')
  await requirePermission({ type: 'workflow.update', workflow: { createdById: existing.createdById } })
  await workflowTemplateService.unarchive(input.id, db)
  revalidatePath('/workflows')
  revalidatePath(`/workflows/${input.id}`)
  return { ok: true }
}
