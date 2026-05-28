import { describe, it, expect, beforeEach } from 'vitest'
import { eq } from 'drizzle-orm'
import { testDb, truncateAll } from '@/tests/db'
import { tasks } from '@/db/schema'
import { applyScheduleToProject } from './apply-schedule'
import { seedOwner, seedPm } from '@/tests/fixtures/users'
import { seedTemplate } from '@/tests/fixtures/workflow-templates'
import { snapshotWorkflowsIntoProject } from './snapshot-workflows'
import { projects, projectPhases } from '@/db/schema'

describe('applyScheduleToProject', () => {
  beforeEach(async () => { await truncateAll() })

  it('writes earliest start/end and critical-path flag to tasks', async () => {
    const owner = await seedOwner()
    const pm = await seedPm()
    const { template } = await seedTemplate({
      createdById: owner.id, name: 'T',
      tasks: [
        { name: 'a', startDay: 1, endDay: 3 },
        { name: 'b', startDay: 3, endDay: 6 },
      ],
      deps: [{ fromIdx: 0, toIdx: 1 }],
    })
    const [project] = await testDb.insert(projects).values({
      name: 'p', brand: 'al_homes', pmId: pm.id, createdById: pm.id,
    }).returning()
    const [phase] = await testDb.insert(projectPhases).values({
      projectId: project.id, name: 'Permitting', sortOrder: 1,
    }).returning()
    await testDb.transaction(async (tx) => {
      await snapshotWorkflowsIntoProject(tx, {
        projectId: project.id, defaultOwnerId: pm.id,
        assignments: [{ phaseId: phase.id, templateId: template.id, sortOrder: 0 }],
      })
    })

    await testDb.transaction(async (tx) => {
      await applyScheduleToProject(tx, { projectId: project.id })
    })

    const rows = await testDb.select().from(tasks).where(eq(tasks.projectId, project.id))
    const a = rows.find(t => t.name === 'a')!
    const b = rows.find(t => t.name === 'b')!
    // plannedStartDay/plannedEndDay are set by the snapshot from template values, not by applyScheduleToProject
    expect(a.plannedStartDay).toBe(1)
    expect(a.plannedEndDay).toBe(3)
    expect(b.plannedStartDay).toBe(3)
    expect(b.plannedEndDay).toBe(6)
    expect(a.isOnCriticalPath).toBe(true)
    expect(b.isOnCriticalPath).toBe(true)
  })
})
