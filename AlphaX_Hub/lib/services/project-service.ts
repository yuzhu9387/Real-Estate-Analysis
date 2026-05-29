import { eq } from 'drizzle-orm'
import type { DB } from '@/db/client'
import { projects, projectPhases, auditLogs, type Project } from '@/db/schema'
import { snapshotWorkflowsIntoProject } from '@/lib/snapshot/snapshot-workflows'
import { applyScheduleToProject } from '@/lib/snapshot/apply-schedule'
import { ValidationError, NotFoundError, ConflictError } from '@/lib/server/errors'
import { cascadeProjectSchedule } from '@/lib/scheduling/project-targets'

const PHASE_NAMES = ['Permitting', 'Construction', 'Sale'] as const
type PhaseName = (typeof PHASE_NAMES)[number]

export const projectService = {
  async create(input: {
    createdById: string
    name: string
    brand: 'al_homes' | 'alera' | 'apex'
    pmId: string
    // Section 1
    address?: string | null
    city?: string | null
    state?: string | null
    zip?: string | null
    titleHolder?: string | null
    projectStrategy?: string | null
    purchaseDate?: string | null
    purchasePrice?: string | null
    // Section 2 — start + 3 durations; computed dates derived in this method.
    targetExitQuarter?: string | null
    targetStartDate?: string | null
    targetPermittingDurationDays?: number | null
    targetConstructionDurationDays?: number | null
    targetSalesDurationDays?: number | null
    // Section 3
    permittingPmId?: string | null
    constructionPmId?: string | null
    salesPmId?: string | null
    assignments: Array<{ phaseName: PhaseName; templateId: string; sortOrder: number }>
  }, db: DB): Promise<Project> {
    if (input.assignments.length === 0) {
      throw new ValidationError('Project must have at least one workflow assigned')
    }
    const cascade = cascadeProjectSchedule({
      targetStartDate: input.targetStartDate ?? null,
      targetPermittingDurationDays: input.targetPermittingDurationDays ?? null,
      targetConstructionDurationDays: input.targetConstructionDurationDays ?? null,
      targetSalesDurationDays: input.targetSalesDurationDays ?? null,
    })
    return db.transaction(async (tx) => {
      const [project] = await tx.insert(projects).values({
        name: input.name,
        brand: input.brand,
        pmId: input.pmId,
        permittingPmId: input.permittingPmId ?? null,
        constructionPmId: input.constructionPmId ?? null,
        salesPmId: input.salesPmId ?? null,
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
        targetStartDate: cascade.targetStartDate,
        targetPermittingDurationDays: cascade.targetPermittingDurationDays,
        targetConstructionDurationDays: cascade.targetConstructionDurationDays,
        targetSalesDurationDays: cascade.targetSalesDurationDays,
        targetProjectDurationDays: cascade.targetProjectDurationDays,
        targetPermitDate: cascade.targetPermitDate,
        targetConstructionEndDate: cascade.targetConstructionEndDate,
        targetExitDate: cascade.targetExitDate,
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
      // Section 1
      address?: string | null
      city?: string | null
      state?: string | null
      zip?: string | null
      titleHolder?: string | null
      projectStrategy?: string | null
      purchaseDate?: string | null
      purchasePrice?: string | null
      // Section 2 — start + 3 durations; the cascade is recomputed below.
      targetExitQuarter?: string | null
      targetStartDate?: string | null
      targetPermittingDurationDays?: number | null
      targetConstructionDurationDays?: number | null
      targetSalesDurationDays?: number | null
      // Section 3
      pmId?: string
      permittingPmId?: string | null
      constructionPmId?: string | null
      salesPmId?: string | null
    }
  }, db: DB) {
    const { ProjectLockedError } = await import('@/lib/server/errors')

    const existing = (await db.select().from(projects).where(eq(projects.id, input.projectId)))[0]
    if (!existing) throw new NotFoundError('Project')
    if (existing.status === 'complete' || existing.status === 'archived') {
      throw new ProjectLockedError(existing.status)
    }

    // Once a project is kicked off, the section-1 deal facts and the schedule cascade are
    // locked. The form disables them in non-draft mode; this is the server-side enforcement.
    const DRAFT_ONLY_KEYS = [
      'titleHolder', 'projectStrategy', 'purchaseDate', 'purchasePrice',
      'targetExitQuarter',
      'targetStartDate',
      'targetPermittingDurationDays', 'targetConstructionDurationDays', 'targetSalesDurationDays',
    ] as const

    if (existing.status !== 'draft') {
      for (const k of DRAFT_ONLY_KEYS) {
        if (input.patch[k] !== undefined) throw new ProjectLockedError(existing.status)
      }
    }

    // Build the row patch. For the schedule, we always re-run the cascade so the derived
    // dates (target_permit_date / target_construction_end_date / target_exit_date /
    // target_project_duration_days) stay consistent with the inputs the user just edited.
    const setObj: Record<string, unknown> = { updatedAt: new Date() }
    for (const [k, v] of Object.entries(input.patch)) {
      if (v === undefined) continue
      // The cascade-derived columns are owned by the cascade, not the patch — skip them
      // even if the client somehow sends them.
      if (k === 'targetPermitDate' || k === 'targetConstructionEndDate' ||
          k === 'targetExitDate' || k === 'targetProjectDurationDays') continue
      setObj[k] = v
    }

    const scheduleTouched =
      input.patch.targetStartDate !== undefined ||
      input.patch.targetPermittingDurationDays !== undefined ||
      input.patch.targetConstructionDurationDays !== undefined ||
      input.patch.targetSalesDurationDays !== undefined

    if (scheduleTouched) {
      const cascade = cascadeProjectSchedule({
        targetStartDate:
          input.patch.targetStartDate !== undefined
            ? input.patch.targetStartDate
            : existing.targetStartDate,
        targetPermittingDurationDays:
          input.patch.targetPermittingDurationDays !== undefined
            ? input.patch.targetPermittingDurationDays
            : existing.targetPermittingDurationDays,
        targetConstructionDurationDays:
          input.patch.targetConstructionDurationDays !== undefined
            ? input.patch.targetConstructionDurationDays
            : existing.targetConstructionDurationDays,
        targetSalesDurationDays:
          input.patch.targetSalesDurationDays !== undefined
            ? input.patch.targetSalesDurationDays
            : existing.targetSalesDurationDays,
      })
      setObj.targetPermitDate = cascade.targetPermitDate
      setObj.targetConstructionEndDate = cascade.targetConstructionEndDate
      setObj.targetExitDate = cascade.targetExitDate
      setObj.targetProjectDurationDays = cascade.targetProjectDurationDays
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
