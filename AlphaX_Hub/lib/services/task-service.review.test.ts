import { describe, it, expect, beforeEach } from 'vitest'
import { eq } from 'drizzle-orm'
import { testDb, truncateAll } from '@/tests/db'
import { tasks, taskComments } from '@/db/schema'
import { seedOwner, seedPm, seedIc } from '@/tests/fixtures/users'
import { seedTemplate } from '@/tests/fixtures/workflow-templates'
import { projectService } from './project-service'
import { taskService } from './task-service'

async function setup() {
  const owner = await seedOwner()
  const pm = await seedPm()
  const ic = await seedIc('IC1')
  const reviewer = await seedIc('Reviewer')
  const { template } = await seedTemplate({
    createdById: owner.id, name: 'P', tasks: [{ name: 'A', startDay: 1, endDay: 2 }], deps: [],
  })
  const project = await projectService.create({
    createdById: pm.id, name: 'X', brand: 'al_homes', pmId: pm.id,
    assignments: [{ phaseName: 'Permitting', templateId: template.id, sortOrder: 0 }],
  }, testDb)
  const [task] = await testDb.select().from(tasks).where(eq(tasks.projectId, project.id))
  await testDb.update(tasks).set({ ownerId: ic.id, reviewerId: reviewer.id }).where(eq(tasks.id, task.id))
  return { ic, reviewer, pm, task: { ...task, ownerId: ic.id, reviewerId: reviewer.id } }
}

describe('taskService review flow', () => {
  beforeEach(async () => { await truncateAll() })

  it('submit → approve → mark complete', async () => {
    const { ic, reviewer, task } = await setup()
    await taskService.submitForReview({ taskId: task.id, actorId: ic.id, body: 'Done with task' }, testDb)
    let re = await testDb.select().from(tasks).where(eq(tasks.id, task.id))
    expect(re[0].status).toBe('pending_review')
    const comments1 = await testDb.select().from(taskComments).where(eq(taskComments.taskId, task.id))
    expect(comments1.find(c => c.kind === 'review_request')?.body).toBe('Done with task')

    await taskService.approve({ taskId: task.id, actorId: reviewer.id, body: 'lgtm' }, testDb)
    re = await testDb.select().from(tasks).where(eq(tasks.id, task.id))
    expect(re[0].status).toBe('approved')

    await taskService.markComplete({ taskId: task.id, actorId: ic.id }, testDb)
    re = await testDb.select().from(tasks).where(eq(tasks.id, task.id))
    expect(re[0].status).toBe('complete')
  })

  it('request revision drops back to started + saves reviewer comment', async () => {
    const { ic, reviewer, task } = await setup()
    await taskService.submitForReview({ taskId: task.id, actorId: ic.id, body: 'check it' }, testDb)
    await taskService.requestRevision({
      taskId: task.id, actorId: reviewer.id, body: 'redo section 2',
    }, testDb)
    const re = await testDb.select().from(tasks).where(eq(tasks.id, task.id))
    expect(re[0].status).toBe('started')
    const comments = await testDb.select().from(taskComments).where(eq(taskComments.taskId, task.id))
    expect(comments.find(c => c.kind === 'review_revision')?.body).toBe('redo section 2')
  })
})
