'use server'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { eq } from 'drizzle-orm'
import { db } from '@/db/client'
import { projectPhases, projects } from '@/db/schema'
import { requirePermission } from '@/lib/server/require-permission'
import { phaseService } from '@/lib/services/phase-service'
import { NotFoundError } from '@/lib/server/errors'

async function loadPhaseAndProject(phaseId: string) {
  const phaseRows = await db.select().from(projectPhases).where(eq(projectPhases.id, phaseId))
  if (phaseRows.length === 0) throw new NotFoundError('Phase')
  const projRows = await db.select().from(projects).where(eq(projects.id, phaseRows[0].projectId))
  return { phase: phaseRows[0], project: projRows[0] }
}

export async function kickOffPhase(raw: unknown) {
  const input = z.object({ phaseId: z.string().uuid() }).parse(raw)
  const { project } = await loadPhaseAndProject(input.phaseId)
  const user = await requirePermission({
    type: 'project.kick_off_phase',
    project: { pmId: project.pmId, status: project.status },
  })
  await phaseService.kickOff({ phaseId: input.phaseId, actorId: user.id }, db)
  revalidatePath(`/projects/${project.id}`)
  return { ok: true }
}

export async function markPhaseComplete(raw: unknown) {
  const input = z.object({ phaseId: z.string().uuid() }).parse(raw)
  const { project } = await loadPhaseAndProject(input.phaseId)
  const user = await requirePermission({
    type: 'project.mark_phase_complete',
    project: { pmId: project.pmId, status: project.status },
  })
  await phaseService.markComplete({ phaseId: input.phaseId, actorId: user.id }, db)
  revalidatePath(`/projects/${project.id}`)
  return { ok: true }
}
