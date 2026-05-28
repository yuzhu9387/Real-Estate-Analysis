import { describe, it, expect, beforeEach } from 'vitest'
import { eq } from 'drizzle-orm'
import { testDb, truncateAll } from '@/tests/db'
import { tasks, taskDeps, projectPhases } from '@/db/schema'
import { seedOwner, seedPm } from '@/tests/fixtures/users'
import { seedTemplate } from '@/tests/fixtures/workflow-templates'
import { projectService } from './project-service'
import { taskService } from './task-service'
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

describe('addPlannedTask', () => {
  beforeEach(async () => { await truncateAll() })

  it('creates a planned task in draft project', async () => {
    const { project, pm } = await setup()
    const projTasks = await testDb.select().from(tasks).where(eq(tasks.projectId, project.id))
    const workflowId = projTasks[0].projectWorkflowId
    const created = await taskService.addPlannedTask({
      projectId: project.id, projectWorkflowId: workflowId,
      name: 'Extra survey', plannedDurationDays: 3, ownerId: pm.id, actorId: pm.id,
    }, testDb)
    expect(created.isUnplanned).toBe(false)
    const re = await testDb.select().from(tasks).where(eq(tasks.id, created.id))
    expect(re[0].name).toBe('Extra survey')
  })

  it('refuses when project is not draft', async () => {
    const { project, pm } = await setup()
    const phases = await testDb.select().from(projectPhases).where(eq(projectPhases.projectId, project.id))
    const permitting = phases.find(p => p.name === 'Permitting')!
    await (await import('./phase-service')).phaseService
      .kickOff({ phaseId: permitting.id, actorId: pm.id }, testDb)
    const projTasks = await testDb.select().from(tasks).where(eq(tasks.projectId, project.id))
    await expect(taskService.addPlannedTask({
      projectId: project.id, projectWorkflowId: projTasks[0].projectWorkflowId,
      name: 'X', plannedDurationDays: 1, ownerId: pm.id, actorId: pm.id,
    }, testDb)).rejects.toThrow(ProjectLockedError)
  })

  it('adds optional dependencies', async () => {
    const { project, pm } = await setup()
    const projTasks = await testDb.select().from(tasks).where(eq(tasks.projectId, project.id))
    const created = await taskService.addPlannedTask({
      projectId: project.id, projectWorkflowId: projTasks[0].projectWorkflowId,
      name: 'After A', plannedDurationDays: 1, ownerId: pm.id, actorId: pm.id,
      upstreamTaskIds: [projTasks[0].id],
    }, testDb)
    const deps = await testDb.select().from(taskDeps).where(eq(taskDeps.toTaskId, created.id))
    expect(deps).toHaveLength(1)
    expect(deps[0].fromTaskId).toBe(projTasks[0].id)
  })
})
