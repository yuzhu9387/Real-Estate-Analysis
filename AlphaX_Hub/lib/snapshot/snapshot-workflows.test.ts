import { describe, it, expect, beforeEach } from 'vitest'
import { eq } from 'drizzle-orm'
import { testDb, truncateAll } from '@/tests/db'
import { projects, projectPhases, projectWorkflows, tasks, taskDeps } from '@/db/schema'
import { seedOwner, seedPm } from '@/tests/fixtures/users'
import { seedTemplate } from '@/tests/fixtures/workflow-templates'
import { snapshotWorkflowsIntoProject } from './snapshot-workflows'

describe('snapshotWorkflowsIntoProject', () => {
  beforeEach(async () => { await truncateAll() })

  it('copies template tasks and deps into project tables', async () => {
    const owner = await seedOwner()
    const pm = await seedPm()
    const { template } = await seedTemplate({
      createdById: owner.id,
      name: 'Permitting Basics',
      tasks: [
        { name: 'Survey', startDay: 1, endDay: 6 },
        { name: 'Zoning', startDay: 6, endDay: 16 },
        { name: 'Submit', startDay: 16, endDay: 18 },
      ],
      deps: [
        { fromIdx: 0, toIdx: 1 },
        { fromIdx: 1, toIdx: 2 },
      ],
    })

    const [project] = await testDb.insert(projects).values({
      name: '12 Main St', brand: 'al_homes', pmId: pm.id, createdById: pm.id,
    }).returning()
    const phases = await testDb.insert(projectPhases).values([
      { projectId: project.id, name: 'Permitting',  sortOrder: 1 },
      { projectId: project.id, name: 'Construction', sortOrder: 2 },
      { projectId: project.id, name: 'Sale',         sortOrder: 3 },
    ]).returning()
    const permittingPhase = phases.find(p => p.sortOrder === 1)!

    await testDb.transaction(async (tx) => {
      await snapshotWorkflowsIntoProject(tx, {
        projectId: project.id,
        defaultOwnerId: pm.id,
        assignments: [{ phaseId: permittingPhase.id, templateId: template.id, sortOrder: 0 }],
      })
    })

    const pws = await testDb.select().from(projectWorkflows).where(eq(projectWorkflows.projectId, project.id))
    expect(pws).toHaveLength(1)
    expect(pws[0].name).toBe('Permitting Basics')

    const projTasks = await testDb.select().from(tasks).where(eq(tasks.projectId, project.id))
    expect(projTasks).toHaveLength(3)
    const surveyTask = projTasks.find(t => t.name === 'Survey')!
    expect(surveyTask.plannedDurationDays).toBe(5)
    expect(surveyTask.ownerId).toBe(pm.id)
    expect(surveyTask.sourceWorkflowTemplateId).toBe(template.id)

    const projDeps = await testDb.select().from(taskDeps).where(eq(taskDeps.projectId, project.id))
    expect(projDeps).toHaveLength(2)
    const surveyId = projTasks.find(t => t.name === 'Survey')!.id
    const zoningId = projTasks.find(t => t.name === 'Zoning')!.id
    expect(projDeps.some(d => d.fromTaskId === surveyId && d.toTaskId === zoningId)).toBe(true)
  })

  it('chains multiple workflows in the same phase with leaf→root cross-edges', async () => {
    const owner = await seedOwner()
    const pm = await seedPm()
    const a = await seedTemplate({
      createdById: owner.id, name: 'A',
      tasks: [
        { name: 'A1', startDay: 1, endDay: 2 },
        { name: 'A2', startDay: 2, endDay: 3 },
      ],
      deps: [{ fromIdx: 0, toIdx: 1 }],
    })
    const b = await seedTemplate({
      createdById: owner.id, name: 'B',
      tasks: [{ name: 'B1', startDay: 1, endDay: 2 }],
      deps: [],
    })

    const [project] = await testDb.insert(projects).values({
      name: 'p', brand: 'al_homes', pmId: pm.id, createdById: pm.id,
    }).returning()
    const phases = await testDb.insert(projectPhases).values([
      { projectId: project.id, name: 'Permitting',  sortOrder: 1 },
      { projectId: project.id, name: 'Construction', sortOrder: 2 },
      { projectId: project.id, name: 'Sale',         sortOrder: 3 },
    ]).returning()

    await testDb.transaction(async (tx) => {
      await snapshotWorkflowsIntoProject(tx, {
        projectId: project.id,
        defaultOwnerId: pm.id,
        assignments: [
          { phaseId: phases[0].id, templateId: a.template.id, sortOrder: 0 },
          { phaseId: phases[0].id, templateId: b.template.id, sortOrder: 1 },
        ],
      })
    })

    const projDeps = await testDb.select().from(taskDeps).where(eq(taskDeps.projectId, project.id))
    // A1 → A2 (within A), plus A2 → B1 (cross)
    expect(projDeps).toHaveLength(2)
  })
})
