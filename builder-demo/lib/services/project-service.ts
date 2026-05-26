import { eq } from 'drizzle-orm'
import type { DB } from '@/db/client'
import { projects, projectPhases, auditLogs, type Project } from '@/db/schema'
import { snapshotWorkflowsIntoProject } from '@/lib/snapshot/snapshot-workflows'
import { applyScheduleToProject } from '@/lib/snapshot/apply-schedule'
import { ValidationError, NotFoundError, ConflictError } from '@/lib/server/errors'

const PHASE_NAMES = ['Permitting', 'Construction', 'Sale'] as const
type PhaseName = (typeof PHASE_NAMES)[number]

export const projectService = {
  async create(input: {
    createdById: string
    name: string
    brand: 'al_homes' | 'alera' | 'apex'
    pmId: string
    address?: string | null
    city?: string | null
    state?: string | null
    zip?: string | null
    titleHolder?: string | null
    projectStrategy?: string | null
    purchaseDate?: string | null
    purchasePrice?: string | null
    targetExitQuarter?: string | null
    targetProjectDurationDays?: number | null
    targetPermitDate?: string | null
    targetConstructionEndDate?: string | null
    assignments: Array<{ phaseName: PhaseName; templateId: string; sortOrder: number }>
  }, db: DB): Promise<Project> {
    if (input.assignments.length === 0) {
      throw new ValidationError('Project must have at least one workflow assigned')
    }
    return db.transaction(async (tx) => {
      const [project] = await tx.insert(projects).values({
        name: input.name,
        brand: input.brand,
        pmId: input.pmId,
        createdById: input.createdById,
        address: input.address ?? null,
        city: input.city ?? null,
        state: input.state ?? null,
        zip: input.zip ?? null,
        titleHolder: input.titleHolder ?? null,
        projectStrategy: input.projectStrategy ?? null,
        purchaseDate: input.purchaseDate ?? null,
        purchasePrice: input.purchasePrice ?? null,
        targetExitQuarter: input.targetExitQuarter ?? null,
        targetProjectDurationDays: input.targetProjectDurationDays ?? null,
        targetPermitDate: input.targetPermitDate ?? null,
        targetConstructionEndDate: input.targetConstructionEndDate ?? null,
      }).returning()

      const phases = await tx.insert(projectPhases).values(
        PHASE_NAMES.map((name, i) => ({ projectId: project.id, name, sortOrder: i + 1 })),
      ).returning()
      const phaseIdByName = new Map(phases.map(p => [p.name, p.id]))

      await snapshotWorkflowsIntoProject(tx, {
        projectId: project.id,
        defaultOwnerId: input.pmId,
        assignments: input.assignments.map(a => ({
          phaseId: phaseIdByName.get(a.phaseName)!,
          templateId: a.templateId,
          sortOrder: a.sortOrder,
        })),
      })

      await applyScheduleToProject(tx, { projectId: project.id })
      return project
    })
  },

  async getById(id: string, db: DB) {
    const rows = await db.select().from(projects).where(eq(projects.id, id))
    return rows[0] ?? null
  },

  async list(db: DB) {
    return db.select().from(projects)
  },

  // The lifecycle methods (markComplete, archive, transferPm, unlockToDraft) are added in Task 9.3.
  async markComplete(input: { projectId: string; actorId: string }, db: DB) {
    return db.transaction(async (tx) => {
      const phases = await tx.select().from(projectPhases).where(eq(projectPhases.projectId, input.projectId))
      if (phases.length === 0) throw new NotFoundError('Project')
      if (phases.some(p => p.status !== 'complete')) {
        throw new ConflictError('All phases must be complete')
      }
      const now = new Date()
      await tx.update(projects).set({ status: 'complete', completedAt: now, updatedAt: now })
        .where(eq(projects.id, input.projectId))
    })
  },

  async archive(input: { projectId: string; actorId: string }, db: DB) {
    const now = new Date()
    await db.update(projects).set({ status: 'archived', archivedAt: now, updatedAt: now })
      .where(eq(projects.id, input.projectId))
  },

  async transferPm(input: { projectId: string; toUserId: string; actorId: string }, db: DB) {
    const now = new Date()
    await db.update(projects).set({ pmId: input.toUserId, updatedAt: now })
      .where(eq(projects.id, input.projectId))
  },

  async updateMetadata(input: {
    projectId: string
    actorId: string
    patch: {
      name?: string
      brand?: 'al_homes' | 'alera' | 'apex'
      address?: string | null
      city?: string | null
      state?: string | null
      zip?: string | null
      pmId?: string
      titleHolder?: string | null
      projectStrategy?: string | null
      purchaseDate?: string | null
      purchasePrice?: string | null
      targetExitQuarter?: string | null
      targetProjectDurationDays?: number | null
      targetPermitDate?: string | null
      targetConstructionEndDate?: string | null
    }
  }, db: DB) {
    const { ProjectLockedError } = await import('@/lib/server/errors')

    const existing = (await db.select().from(projects).where(eq(projects.id, input.projectId)))[0]
    if (!existing) throw new NotFoundError('Project')
    if (existing.status === 'complete' || existing.status === 'archived') {
      throw new ProjectLockedError(existing.status)
    }

    const DRAFT_ONLY_KEYS = [
      'titleHolder', 'projectStrategy', 'purchaseDate', 'purchasePrice',
      'targetExitQuarter', 'targetProjectDurationDays', 'targetPermitDate', 'targetConstructionEndDate',
    ] as const

    if (existing.status !== 'draft') {
      for (const k of DRAFT_ONLY_KEYS) {
        if (input.patch[k] !== undefined) throw new ProjectLockedError(existing.status)
      }
    }

    const setObj: Record<string, unknown> = { updatedAt: new Date() }
    for (const [k, v] of Object.entries(input.patch)) {
      if (v !== undefined) setObj[k] = v
    }
    await db.update(projects).set(setObj).where(eq(projects.id, input.projectId))
  },

  async unlockToDraft(input: { projectId: string; actorId: string; reason: string }, db: DB) {
    if (!input.reason?.trim()) {
      throw new ValidationError('Reason is required for unlock')
    }
    return db.transaction(async (tx) => {
      const existing = await tx.select().from(projects).where(eq(projects.id, input.projectId))
      if (existing.length === 0) throw new NotFoundError('Project')
      const before = existing[0]
      const now = new Date()
      await tx.update(projects).set({ status: 'draft', updatedAt: now }).where(eq(projects.id, input.projectId))
      await tx.insert(auditLogs).values({
        actorId: input.actorId,
        action: 'project.unlock_to_draft',
        targetType: 'project',
        targetId: input.projectId,
        before: { status: before.status },
        after:  { status: 'draft' },
        reason: input.reason,
      })
    })
  },
}
