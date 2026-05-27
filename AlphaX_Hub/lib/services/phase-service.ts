import { eq, and, lt } from 'drizzle-orm'
import type { DB } from '@/db/client'
import { projects, projectPhases, activities } from '@/db/schema'
import { assertPhaseTransition } from '@/lib/state-machine/phase'
import { NotFoundError, ConflictError } from '@/lib/server/errors'

export const phaseService = {
  async kickOff(input: { phaseId: string; actorId: string }, db: DB) {
    return db.transaction(async (tx) => {
      const phaseRows = await tx.select().from(projectPhases).where(eq(projectPhases.id, input.phaseId))
      if (phaseRows.length === 0) throw new NotFoundError('Phase')
      const phase = phaseRows[0]
      assertPhaseTransition(phase.status, 'in_progress')

      const earlier = await tx.select().from(projectPhases).where(
        and(eq(projectPhases.projectId, phase.projectId), lt(projectPhases.sortOrder, phase.sortOrder)),
      )
      if (earlier.some(p => p.status !== 'complete')) {
        throw new ConflictError('Earlier phase must be complete before kicking off this one')
      }

      const now = new Date()
      await tx.update(projectPhases).set({
        status: 'in_progress', kickedOffAt: now, kickedOffById: input.actorId,
      }).where(eq(projectPhases.id, phase.id))

      const proj = (await tx.select().from(projects).where(eq(projects.id, phase.projectId)))[0]
      if (proj.status === 'draft') {
        await tx.update(projects).set({
          status: 'in_progress', kickedOffAt: now, updatedAt: now,
        }).where(eq(projects.id, proj.id))
      }

      await tx.insert(activities).values({
        projectId: phase.projectId, actorId: input.actorId,
        type: 'phase.kicked_off', payload: { phaseId: phase.id, phaseName: phase.name },
      })
    })
  },

  async markComplete(input: { phaseId: string; actorId: string }, db: DB) {
    return db.transaction(async (tx) => {
      const phaseRows = await tx.select().from(projectPhases).where(eq(projectPhases.id, input.phaseId))
      if (phaseRows.length === 0) throw new NotFoundError('Phase')
      const phase = phaseRows[0]
      assertPhaseTransition(phase.status, 'complete')

      const now = new Date()
      await tx.update(projectPhases).set({
        status: 'complete', markedCompleteAt: now, markedCompleteById: input.actorId,
      }).where(eq(projectPhases.id, phase.id))

      await tx.insert(activities).values({
        projectId: phase.projectId, actorId: input.actorId,
        type: 'phase.marked_complete', payload: { phaseId: phase.id, phaseName: phase.name },
      })
    })
  },
}
