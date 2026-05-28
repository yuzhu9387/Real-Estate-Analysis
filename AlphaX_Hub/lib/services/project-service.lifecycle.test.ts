import { describe, it, expect, beforeEach } from 'vitest'
import { eq } from 'drizzle-orm'
import { testDb, truncateAll } from '@/tests/db'
import { projects, projectPhases, auditLogs } from '@/db/schema'
import { seedOwner, seedPm } from '@/tests/fixtures/users'
import { seedTemplate } from '@/tests/fixtures/workflow-templates'
import { projectService } from './project-service'
import { phaseService } from './phase-service'
import { ConflictError } from '@/lib/server/errors'

async function makeReadyProject() {
  const owner = await seedOwner()
  const pm = await seedPm()
  const { template } = await seedTemplate({
    createdById: owner.id, name: 'P', tasks: [{ name: 't', startDay: 1, endDay: 2 }], deps: [],
  })
  const project = await projectService.create({
    createdById: pm.id, name: 'X', brand: 'al_homes', pmId: pm.id,
    assignments: [{ phaseName: 'Permitting', templateId: template.id, sortOrder: 0 }],
  }, testDb)
  return { project, pm, owner }
}

describe('projectService.markComplete', () => {
  beforeEach(async () => { await truncateAll() })

  it('requires all 3 phases complete', async () => {
    const { project, pm } = await makeReadyProject()
    await expect(projectService.markComplete({ projectId: project.id, actorId: pm.id }, testDb))
      .rejects.toThrow(ConflictError)
  })

  it('succeeds when all phases complete', async () => {
    const { project, pm } = await makeReadyProject()
    const phases = await testDb.select().from(projectPhases).where(eq(projectPhases.projectId, project.id))
    for (const ph of phases.sort((a,b) => a.sortOrder - b.sortOrder)) {
      await phaseService.kickOff({ phaseId: ph.id, actorId: pm.id }, testDb)
      await phaseService.markComplete({ phaseId: ph.id, actorId: pm.id }, testDb)
    }
    await projectService.markComplete({ projectId: project.id, actorId: pm.id }, testDb)
    const p = await testDb.select().from(projects).where(eq(projects.id, project.id))
    expect(p[0].status).toBe('complete')
  })
})

describe('projectService.transferPm', () => {
  beforeEach(async () => { await truncateAll() })

  it('transfers ownership to another pm', async () => {
    const { project, pm } = await makeReadyProject()
    const newPm = await seedPm('PM2')
    await projectService.transferPm({ projectId: project.id, toUserId: newPm.id, actorId: pm.id }, testDb)
    const p = await testDb.select().from(projects).where(eq(projects.id, project.id))
    expect(p[0].pmId).toBe(newPm.id)
  })
})

describe('projectService.unlockToDraft', () => {
  beforeEach(async () => { await truncateAll() })

  it('sets status to draft and writes audit log', async () => {
    const { project, pm, owner } = await makeReadyProject()
    const phases = await testDb.select().from(projectPhases).where(eq(projectPhases.projectId, project.id))
    await phaseService.kickOff({ phaseId: phases.find(p => p.sortOrder === 1)!.id, actorId: pm.id }, testDb)

    await projectService.unlockToDraft({
      projectId: project.id, actorId: owner.id, reason: 'permit error must be corrected',
    }, testDb)

    const p = await testDb.select().from(projects).where(eq(projects.id, project.id))
    expect(p[0].status).toBe('draft')
    const audit = await testDb.select().from(auditLogs)
    expect(audit).toHaveLength(1)
    expect(audit[0].action).toBe('project.unlock_to_draft')
    expect(audit[0].reason).toContain('permit error')
  })
})
