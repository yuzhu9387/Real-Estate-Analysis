import { describe, it, expect, beforeEach } from 'vitest'
import { eq } from 'drizzle-orm'
import { testDb, truncateAll } from '@/tests/db'
import { tasks, taskDeps, activities, projectPhases } from '@/db/schema'
import { seedOwner, seedPm } from '@/tests/fixtures/users'
import { seedTemplate } from '@/tests/fixtures/workflow-templates'
import { projectService } from './project-service'
import { phaseService } from './phase-service'
import { taskService } from './task-service'
import { ProjectLockedError, NotFoundError } from '@/lib/server/errors'

async function setup() {
  const owner = await seedOwner()
  const pm = await seedPm()
  const { template } = await seedTemplate({
    createdById: owner.id, name: 'P',
    tasks: [
      { name: 'A', durationDays: 2 },
      { name: 'B', durationDays: 3 },
      { name: 'C', durationDays: 1 },
    ],
    deps: [
      { fromIdx: 0, toIdx: 1 },
      { fromIdx: 1, toIdx: 2 },
    ],
  })
  const project = await projectService.create({
    createdById: pm.id, name: 'X', brand: 'al_homes', pmId: pm.id,
    assignments: [{ phaseName: 'Permitting', templateId: template.id, sortOrder: 0 }],
  }, testDb)
  return { project, pm }
}

describe('taskService.deleteInDraft', () => {
  beforeEach(async () => { await truncateAll() })

  it('hard deletes the task in draft', async () => {
    const { project, pm } = await setup()
    const all = await testDb.select().from(tasks).where(eq(tasks.projectId, project.id))
    const target = all.find(t => t.name === 'B')!
    await taskService.deleteInDraft(target.id, pm.id, testDb)
    const remaining = await testDb.select().from(tasks).where(eq(tasks.projectId, project.id))
    expect(remaining.map(t => t.name).sort()).toEqual(['A', 'C'])
  })

  it('cascades dep edges (FK on cascade)', async () => {
    const { project, pm } = await setup()
    const all = await testDb.select().from(tasks).where(eq(tasks.projectId, project.id))
    const target = all.find(t => t.name === 'B')!
    await taskService.deleteInDraft(target.id, pm.id, testDb)
    const remainingDeps = await testDb.select().from(taskDeps).where(eq(taskDeps.projectId, project.id))
    expect(remainingDeps.some(d => d.fromTaskId === target.id || d.toTaskId === target.id)).toBe(false)
  })

  it('writes activity row', async () => {
    const { project, pm } = await setup()
    const all = await testDb.select().from(tasks).where(eq(tasks.projectId, project.id))
    const target = all.find(t => t.name === 'B')!
    await taskService.deleteInDraft(target.id, pm.id, testDb)
    const acts = await testDb.select().from(activities).where(eq(activities.type, 'task.deleted'))
    expect(acts.length).toBe(1)
    expect((acts[0].payload as { taskId: string; name: string }).name).toBe('B')
  })

  it('throws ProjectLockedError when project is in_progress', async () => {
    const { project, pm } = await setup()
    const phases = await testDb.select().from(projectPhases).where(eq(projectPhases.projectId, project.id))
    const permitting = phases.find(p => p.name === 'Permitting')!
    await phaseService.kickOff({ phaseId: permitting.id, actorId: pm.id }, testDb)
    const all = await testDb.select().from(tasks).where(eq(tasks.projectId, project.id))
    await expect(taskService.deleteInDraft(all[0].id, pm.id, testDb))
      .rejects.toThrow(ProjectLockedError)
  })

  it('throws NotFoundError on unknown task', async () => {
    const { pm } = await setup()
    await expect(taskService.deleteInDraft('00000000-0000-0000-0000-000000000000', pm.id, testDb))
      .rejects.toThrow(NotFoundError)
  })
})
