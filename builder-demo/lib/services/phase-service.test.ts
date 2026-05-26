import { describe, it, expect, beforeEach } from 'vitest'
import { eq } from 'drizzle-orm'
import { testDb, truncateAll } from '@/tests/db'
import { projects, projectPhases } from '@/db/schema'
import { seedPm, seedOwner } from '@/tests/fixtures/users'
import { seedTemplate } from '@/tests/fixtures/workflow-templates'
import { projectService } from './project-service'
import { phaseService } from './phase-service'

async function makeProject() {
  const owner = await seedOwner()
  const pm = await seedPm()
  const { template } = await seedTemplate({
    createdById: owner.id, name: 'P',
    tasks: [{ name: 't', durationDays: 1 }], deps: [],
  })
  const project = await projectService.create({
    createdById: pm.id, name: 'X', brand: 'al_homes', pmId: pm.id,
    assignments: [{ phaseName: 'Permitting', templateId: template.id, sortOrder: 0 }],
  }, testDb)
  return { project, pm, owner }
}

describe('phaseService.kickOff', () => {
  beforeEach(async () => { await truncateAll() })

  it('kicks off Permitting and advances project to in_progress', async () => {
    const { project, pm } = await makeProject()
    const phases = await testDb.select().from(projectPhases).where(eq(projectPhases.projectId, project.id))
    const permitting = phases.find(p => p.name === 'Permitting')!
    await phaseService.kickOff({ phaseId: permitting.id, actorId: pm.id }, testDb)
    const updated = await testDb.select().from(projectPhases).where(eq(projectPhases.id, permitting.id))
    expect(updated[0].status).toBe('in_progress')
    const proj = await testDb.select().from(projects).where(eq(projects.id, project.id))
    expect(proj[0].status).toBe('in_progress')
    expect(proj[0].kickedOffAt).not.toBeNull()
  })

  it('refuses to kick off out-of-order phase (Construction before Permitting)', async () => {
    const { project, pm } = await makeProject()
    const phases = await testDb.select().from(projectPhases).where(eq(projectPhases.projectId, project.id))
    const construction = phases.find(p => p.name === 'Construction')!
    await expect(phaseService.kickOff({ phaseId: construction.id, actorId: pm.id }, testDb))
      .rejects.toThrow()
  })
})

describe('phaseService.markComplete', () => {
  beforeEach(async () => { await truncateAll() })

  it('marks Permitting complete; Construction stays pending (no auto-advance)', async () => {
    const { project, pm } = await makeProject()
    const phases = await testDb.select().from(projectPhases).where(eq(projectPhases.projectId, project.id))
    const permitting = phases.find(p => p.name === 'Permitting')!
    await phaseService.kickOff({ phaseId: permitting.id, actorId: pm.id }, testDb)
    await phaseService.markComplete({ phaseId: permitting.id, actorId: pm.id }, testDb)
    const reread = await testDb.select().from(projectPhases).where(eq(projectPhases.projectId, project.id))
    const re = Object.fromEntries(reread.map(p => [p.name, p.status]))
    expect(re['Permitting']).toBe('complete')
    expect(re['Construction']).toBe('pending')
  })
})
