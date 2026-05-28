import { describe, it, expect, beforeEach } from 'vitest'
import { testDb, truncateAll } from '@/tests/db'
import { seedOwner, seedPm } from '@/tests/fixtures/users'
import { seedTemplate } from '@/tests/fixtures/workflow-templates'
import { projectService } from '@/lib/services/project-service'
import { listProjectsForDashboard } from './dashboard'

describe('listProjectsForDashboard', () => {
  beforeEach(async () => { await truncateAll() })

  it('returns all non-archived projects with their phases', async () => {
    const owner = await seedOwner()
    const pm = await seedPm()
    const { template } = await seedTemplate({
      createdById: owner.id, name: 't', tasks: [{ name: 'a', startDay: 1, endDay: 2 }], deps: [],
    })
    await projectService.create({
      createdById: pm.id, name: '1 Main', brand: 'al_homes', pmId: pm.id,
      assignments: [{ phaseName: 'Permitting', templateId: template.id, sortOrder: 0 }],
    }, testDb)
    await projectService.create({
      createdById: pm.id, name: '2 Oak', brand: 'alera', pmId: pm.id,
      assignments: [{ phaseName: 'Permitting', templateId: template.id, sortOrder: 0 }],
    }, testDb)

    const rows = await listProjectsForDashboard(testDb)
    expect(rows).toHaveLength(2)
    expect(rows[0].phases).toHaveLength(3)
    expect(rows[0].phases.map(p => p.name).sort()).toEqual(['Construction','Permitting','Sale'])
  })

  it('filters by brand', async () => {
    const owner = await seedOwner()
    const pm = await seedPm()
    const { template } = await seedTemplate({
      createdById: owner.id, name: 't', tasks: [{ name: 'a', startDay: 1, endDay: 2 }], deps: [],
    })
    await projectService.create({
      createdById: pm.id, name: '1', brand: 'al_homes', pmId: pm.id,
      assignments: [{ phaseName: 'Permitting', templateId: template.id, sortOrder: 0 }],
    }, testDb)
    await projectService.create({
      createdById: pm.id, name: '2', brand: 'alera', pmId: pm.id,
      assignments: [{ phaseName: 'Permitting', templateId: template.id, sortOrder: 0 }],
    }, testDb)

    const filtered = await listProjectsForDashboard(testDb, { brand: 'al_homes' })
    expect(filtered).toHaveLength(1)
    expect(filtered[0].name).toBe('1')
  })
})

import { computeDashboardCounters, listActiveProjectsForTeam } from './dashboard'
import { tasks } from '@/db/schema'
import { eq } from 'drizzle-orm'

describe('computeDashboardCounters', () => {
  beforeEach(async () => { await truncateAll() })

  it('counts active, under_permitting, under_construction', async () => {
    const owner = await seedOwner()
    const pm = await seedPm()
    const { template } = await seedTemplate({
      createdById: owner.id, name: 't', tasks: [{ name: 'a', startDay: 1, endDay: 2 }], deps: [],
    })
    await projectService.create({ createdById: pm.id, name: 'A', brand: 'al_homes', pmId: pm.id,
      assignments: [{ phaseName: 'Permitting', templateId: template.id, sortOrder: 0 }] }, testDb)
    await projectService.create({ createdById: pm.id, name: 'B', brand: 'al_homes', pmId: pm.id,
      assignments: [{ phaseName: 'Permitting', templateId: template.id, sortOrder: 0 }] }, testDb)
    const counts = await computeDashboardCounters(testDb, { brand: 'al_homes' }, new Date('2026-06-01'))
    expect(counts.active).toBe(0)
    expect(counts.atRisk).toBe(0)
    expect(counts.underPermitting).toBe(0)
    expect(counts.underConstruction).toBe(0)
  })
})

describe('listActiveProjectsForTeam', () => {
  beforeEach(async () => { await truncateAll() })

  it('returns projects where the team owns ≥1 non-terminal task', async () => {
    const owner = await seedOwner()
    const pm = await seedPm()
    const designIc = await (await import('@/tests/fixtures/users')).seedIc('IC-design', 'design')
    const { template } = await seedTemplate({
      createdById: owner.id, name: 't',
      tasks: [{ name: 'a', startDay: 1, endDay: 2 }, { name: 'b', startDay: 2, endDay: 3 }],
      deps: [],
    })
    const project = await projectService.create({
      createdById: pm.id, name: 'P', brand: 'al_homes', pmId: pm.id,
      assignments: [{ phaseName: 'Permitting', templateId: template.id, sortOrder: 0 }],
    }, testDb)
    // Project goes from draft to in_progress so it appears in team-active listing
    const phasesNow = (await import('@/db/schema')).projectPhases
    const allPhases = await testDb.select().from(phasesNow).where(eq(phasesNow.projectId, project.id))
    const permitting = allPhases.find(p => p.name === 'Permitting')!
    await (await import('@/lib/services/phase-service')).phaseService
      .kickOff({ phaseId: permitting.id, actorId: pm.id }, testDb)

    const allTasks = await testDb.select().from(tasks)
    await testDb.update(tasks).set({ ownerId: designIc.id }).where(eq(tasks.id, allTasks[0].id))

    const designProjects = await listActiveProjectsForTeam(testDb, { team: 'design' })
    expect(designProjects).toHaveLength(1)
    expect(designProjects[0].id).toBe(project.id)
  })
})
