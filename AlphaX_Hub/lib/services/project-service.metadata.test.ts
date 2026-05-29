import { describe, it, expect, beforeEach } from 'vitest'
import { eq } from 'drizzle-orm'
import { testDb, truncateAll } from '@/tests/db'
import { projects, projectPhases } from '@/db/schema'
import { seedOwner, seedPm } from '@/tests/fixtures/users'
import { seedTemplate } from '@/tests/fixtures/workflow-templates'
import { projectService } from './project-service'
import { ProjectLockedError } from '@/lib/server/errors'

async function setup() {
  const owner = await seedOwner()
  const pm = await seedPm()
  const { template } = await seedTemplate({
    createdById: owner.id, name: 'P',
    tasks: [{ name: 'A', startDay: 1, endDay: 2 }], deps: [],
  })
  const project = await projectService.create({
    createdById: pm.id, name: 'X', brand: 'al_homes', pmId: pm.id,
    assignments: [{ phaseName: 'Permitting', templateId: template.id, sortOrder: 0 }],
  }, testDb)
  return { project, pm }
}

describe('updateProjectMetadata', () => {
  beforeEach(async () => { await truncateAll() })

  it('updates always-editable fields in any mutable state', async () => {
    const { project, pm } = await setup()
    await projectService.updateMetadata({
      projectId: project.id, actorId: pm.id,
      patch: { name: 'New Name', address: '12 New St', brand: 'alera' },
    }, testDb)
    const re = await testDb.select().from(projects).where(eq(projects.id, project.id))
    expect(re[0].name).toBe('New Name')
    expect(re[0].brand).toBe('alera')
  })

  it('refuses to update draft-only fields when project is in_progress', async () => {
    const { project, pm } = await setup()
    const phases = await testDb.select().from(projectPhases).where(eq(projectPhases.projectId, project.id))
    await (await import('./phase-service')).phaseService
      .kickOff({ phaseId: phases.find(p => p.sortOrder === 1)!.id, actorId: pm.id }, testDb)
    await expect(projectService.updateMetadata({
      projectId: project.id, actorId: pm.id,
      patch: { targetStartDate: '2027-01-01' },
    }, testDb)).rejects.toThrow(ProjectLockedError)
  })

  it('allows draft-only fields when still in draft and cascades target dates', async () => {
    const { project, pm } = await setup()
    await projectService.updateMetadata({
      projectId: project.id, actorId: pm.id,
      patch: {
        targetStartDate: '2027-01-01',
        targetPermittingDurationDays: 30,
        targetConstructionDurationDays: 60,
        targetSalesDurationDays: 90,
        purchasePrice: '850000.00',
      },
    }, testDb)
    const re = await testDb.select().from(projects).where(eq(projects.id, project.id))
    expect(re[0].targetStartDate).toBe('2027-01-01')
    expect(re[0].purchasePrice).toBe('850000.00')
    // Cascade: start + permitting = permit; + construction = constructionEnd; + sales = exit.
    expect(re[0].targetPermitDate).toBe('2027-01-31')
    expect(re[0].targetConstructionEndDate).toBe('2027-04-01')
    expect(re[0].targetExitDate).toBe('2027-06-30')
    expect(re[0].targetProjectDurationDays).toBe(180)
  })
})
