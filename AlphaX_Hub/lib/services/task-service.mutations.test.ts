import { describe, it, expect, beforeEach } from 'vitest'
import { eq } from 'drizzle-orm'
import { testDb, truncateAll } from '@/tests/db'
import { tasks } from '@/db/schema'
import { seedOwner, seedPm, seedIc } from '@/tests/fixtures/users'
import { seedTemplate } from '@/tests/fixtures/workflow-templates'
import { projectService } from './project-service'
import { taskService } from './task-service'

async function setup() {
  const owner = await seedOwner()
  const pm = await seedPm()
  const ic = await seedIc('IC1')
  const { template } = await seedTemplate({
    createdById: owner.id, name: 'P', tasks: [{ name: 'A', startDay: 1, endDay: 3 }], deps: [],
  })
  const project = await projectService.create({
    createdById: pm.id, name: 'X', brand: 'al_homes', pmId: pm.id,
    assignments: [{ phaseName: 'Permitting', templateId: template.id, sortOrder: 0 }],
  }, testDb)
  const [task] = await testDb.select().from(tasks).where(eq(tasks.projectId, project.id))
  await testDb.update(tasks).set({ ownerId: ic.id }).where(eq(tasks.id, task.id))
  return { project, pm, ic, task: { ...task, ownerId: ic.id } }
}

describe('addUnplannedTask', () => {
  beforeEach(async () => { await truncateAll() })

  it('inserts a new task with is_unplanned=true and recomputes schedule', async () => {
    const { project, pm, task } = await setup()
    const created = await taskService.addUnplannedTask({
      projectId: project.id,
      projectWorkflowId: task.projectWorkflowId!,
      name: 'Extra inspection',
      plannedDurationDays: 3,
      ownerId: pm.id,
      actorId: pm.id,
      upstreamTaskId: task.id,
    }, testDb)
    const rows = await testDb.select().from(tasks).where(eq(tasks.id, created.id))
    expect(rows[0].isUnplanned).toBe(true)
    expect(rows[0].plannedStartDay).not.toBeNull()
  })
})

describe('setStatus writes actual_*_date on transitions', () => {
  beforeEach(async () => { await truncateAll() })

  it('stamps actual_start_date when status moves to started, and actual_end_date when complete', async () => {
    const { ic, task } = await setup()

    // not_started -> started: actual_start_date set, actual_end_date still null
    await taskService.setStatus({ taskId: task.id, status: 'started', actorId: ic.id }, testDb)
    let row = (await testDb.select().from(tasks).where(eq(tasks.id, task.id)))[0]
    expect(row.actualStartDate).not.toBeNull()
    expect(row.actualEndDate).toBeNull()
    const firstStart = row.actualStartDate

    // started -> complete: actual_end_date set; actual_start_date unchanged
    await taskService.setStatus({ taskId: task.id, status: 'complete', actorId: ic.id }, testDb)
    row = (await testDb.select().from(tasks).where(eq(tasks.id, task.id)))[0]
    expect(row.actualStartDate).toBe(firstStart)
    expect(row.actualEndDate).not.toBeNull()
  })

  it('does not overwrite an existing actual_start_date when status moves to started again', async () => {
    const { ic, task } = await setup()
    await taskService.setStatus({ taskId: task.id, status: 'started', actorId: ic.id }, testDb)
    const before = (await testDb.select().from(tasks).where(eq(tasks.id, task.id)))[0]

    // Re-toggle: not_started -> started again should keep the original actual_start_date.
    await taskService.setStatus({ taskId: task.id, status: 'not_started', actorId: ic.id }, testDb)
    await taskService.setStatus({ taskId: task.id, status: 'started', actorId: ic.id }, testDb)
    const after = (await testDb.select().from(tasks).where(eq(tasks.id, task.id)))[0]
    expect(after.actualStartDate).toBe(before.actualStartDate)
  })
})

describe('addSubtask', () => {
  beforeEach(async () => { await truncateAll() })

  it('creates a subtask linked to parent', async () => {
    const { task, ic } = await setup()
    const sub = await taskService.addSubtask({
      parentTaskId: task.id, name: 'investigate', ownerId: ic.id, actorId: ic.id,
    }, testDb)
    expect(sub.parentTaskId).toBe(task.id)
    expect(sub.projectWorkflowId).toBe(task.projectWorkflowId)
  })
})

describe('reassign', () => {
  beforeEach(async () => { await truncateAll() })

  it('changes ownerId and writes activity', async () => {
    const { task, ic } = await setup()
    const newOwner = await seedIc('IC2')
    await taskService.reassign({
      taskId: task.id, toUserId: newOwner.id, actorId: ic.id,
    }, testDb)
    const rows = await testDb.select().from(tasks).where(eq(tasks.id, task.id))
    expect(rows[0].ownerId).toBe(newOwner.id)
  })
})

describe('updateNotes', () => {
  beforeEach(async () => { await truncateAll() })

  it('updates description', async () => {
    const { task, ic } = await setup()
    await taskService.updateNotes({ taskId: task.id, description: 'remember to bring caulk', actorId: ic.id }, testDb)
    const rows = await testDb.select().from(tasks).where(eq(tasks.id, task.id))
    expect(rows[0].description).toBe('remember to bring caulk')
  })
})
