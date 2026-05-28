import { describe, it, expect, beforeEach } from 'vitest'
import { eq } from 'drizzle-orm'
import { testDb, truncateAll } from '@/tests/db'
import { tasks, projectWorkflows } from '@/db/schema'
import { seedOwner, seedPm } from '@/tests/fixtures/users'
import { seedTemplate } from '@/tests/fixtures/workflow-templates'
import { projectService } from './project-service'
import { taskService } from './task-service'

async function setup() {
  const owner = await seedOwner()
  const pm = await seedPm()
  const { template } = await seedTemplate({
    createdById: owner.id, name: 'P',
    tasks: [
      { name: 'A', startDay: 1, endDay: 2 },
      { name: 'B', startDay: 2, endDay: 3 },
    ],
    deps: [{ fromIdx: 0, toIdx: 1 }],
  })
  const project = await projectService.create({
    createdById: pm.id, name: 'X', brand: 'al_homes', pmId: pm.id,
    assignments: [{ phaseName: 'Permitting', templateId: template.id, sortOrder: 0 }],
  }, testDb)
  const rows = await testDb.select().from(tasks).where(eq(tasks.projectId, project.id))
  const a = rows.find(t => t.name === 'A')!
  const b = rows.find(t => t.name === 'B')!
  return { owner, pm, project, a, b }
}

describe('taskService.setStatus', () => {
  beforeEach(async () => { await truncateAll() })

  it('changes status to started', async () => {
    const { a } = await setup()
    await taskService.setStatus({ taskId: a.id, status: 'started', actorId: a.ownerId }, testDb)
    const re = await testDb.select().from(tasks).where(eq(tasks.id, a.id))
    expect(re[0].status).toBe('started')
  })

  it('updates is_blocked on downstream task when upstream becomes complete', async () => {
    const { a, b } = await setup()
    const before = await testDb.select().from(tasks).where(eq(tasks.id, b.id))
    expect(before[0].isBlocked).toBe(true)
    await taskService.setStatus({ taskId: a.id, status: 'complete', actorId: a.ownerId }, testDb)
    const after = await testDb.select().from(tasks).where(eq(tasks.id, b.id))
    expect(after[0].isBlocked).toBe(false)
  })

  it('auto-completes workflow when all its tasks reach terminal status', async () => {
    const { a, b, project } = await setup()
    const pws0 = await testDb.select().from(projectWorkflows).where(eq(projectWorkflows.projectId, project.id))
    expect(pws0[0].status).toBe('pending')
    await taskService.setStatus({ taskId: a.id, status: 'complete', actorId: a.ownerId }, testDb)
    await taskService.setStatus({ taskId: b.id, status: 'complete', actorId: b.ownerId }, testDb)
    const pws = await testDb.select().from(projectWorkflows).where(eq(projectWorkflows.projectId, project.id))
    expect(pws[0].status).toBe('complete')
  })

  it('wont_do counts as terminal for workflow auto-complete', async () => {
    const { a, b, project } = await setup()
    await taskService.setStatus({ taskId: a.id, status: 'complete', actorId: a.ownerId }, testDb)
    await taskService.setStatus({ taskId: b.id, status: 'wont_do', actorId: b.ownerId }, testDb)
    const pws = await testDb.select().from(projectWorkflows).where(eq(projectWorkflows.projectId, project.id))
    expect(pws[0].status).toBe('complete')
  })
})
