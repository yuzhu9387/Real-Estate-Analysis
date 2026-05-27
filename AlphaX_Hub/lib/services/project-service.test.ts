import { describe, it, expect, beforeEach } from 'vitest'
import { eq } from 'drizzle-orm'
import { testDb, truncateAll } from '@/tests/db'
import { projectPhases, tasks } from '@/db/schema'
import { seedOwner, seedPm } from '@/tests/fixtures/users'
import { seedTemplate } from '@/tests/fixtures/workflow-templates'
import { projectService } from './project-service'

describe('projectService.create', () => {
  beforeEach(async () => { await truncateAll() })

  it('creates project, 3 phases, snapshots workflows, applies schedule', async () => {
    const owner = await seedOwner()
    const pm = await seedPm()
    const { template } = await seedTemplate({
      createdById: owner.id, name: 'Permits',
      tasks: [
        { name: 'Survey', durationDays: 5 },
        { name: 'Apply',  durationDays: 10 },
      ],
      deps: [{ fromIdx: 0, toIdx: 1 }],
    })

    const project = await projectService.create({
      createdById: pm.id,
      name: '88 Maple',
      brand: 'al_homes',
      pmId: pm.id,
      assignments: [
        { phaseName: 'Permitting', templateId: template.id, sortOrder: 0 },
      ],
    }, testDb)

    expect(project.status).toBe('draft')

    const phases = await testDb.select().from(projectPhases).where(eq(projectPhases.projectId, project.id))
    expect(phases).toHaveLength(3)
    expect(phases.map(p => p.name).sort()).toEqual(['Construction','Permitting','Sale'])

    const projectTasks = await testDb.select().from(tasks).where(eq(tasks.projectId, project.id))
    expect(projectTasks).toHaveLength(2)
    expect(projectTasks[0].plannedStartDay).not.toBeNull()
  })
})
