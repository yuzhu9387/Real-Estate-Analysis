import { describe, it, expect, beforeEach } from 'vitest'
import { testDb, truncateAll } from '@/tests/db'
import { seedUser } from '@/tests/fixtures/users'
import { seedTemplate } from '@/tests/fixtures/workflow-templates'
import { taskService } from '@/lib/services/task-service'
import { projectService } from '@/lib/services/project-service'
import { tasks, activities } from '@/db/schema'
import { eq } from 'drizzle-orm'

async function seedProjectWithOneTask() {
  const owner = await seedUser({ role: 'owner' })
  const pm = await seedUser({ role: 'pm' })
  const { template } = await seedTemplate({
    createdById: owner.id, name: 'Permitting',
    tasks: [{ name: 'Survey', startDay: 1, endDay: 6 }],
    deps: [],
  })
  const project = await projectService.create({
    createdById: pm.id, name: 'Test Project', brand: 'al_homes', pmId: pm.id,
    assignments: [{ phaseName: 'Permitting', templateId: template.id, sortOrder: 0 }],
  }, testDb)
  const taskRows = await testDb.select().from(tasks).where(eq(tasks.projectId, project.id))
  return { owner, pm, project, task: taskRows[0] }
}

describe('taskService.updateMetadata', () => {
  beforeEach(truncateAll)

  it('updates name + writes activity row', async () => {
    const { task, owner } = await seedProjectWithOneTask()
    await taskService.updateMetadata({
      taskId: task.id, name: 'Survey + Title', actorId: owner.id,
    }, testDb)
    const [updated] = await testDb.select().from(tasks).where(eq(tasks.id, task.id))
    expect(updated.name).toBe('Survey + Title')
    const acts = await testDb.select().from(activities).where(eq(activities.projectId, task.projectId!))
    expect(acts.some(a => a.type === 'task.metadata_updated')).toBe(true)
  })

  it('updates reviewerId', async () => {
    const { task, owner } = await seedProjectWithOneTask()
    const reviewer = await seedUser({ role: 'ic' })
    await taskService.updateMetadata({
      taskId: task.id, reviewerId: reviewer.id, actorId: owner.id,
    }, testDb)
    const [updated] = await testDb.select().from(tasks).where(eq(tasks.id, task.id))
    expect(updated.reviewerId).toBe(reviewer.id)
  })

  it('updates target dates', async () => {
    const { task, owner } = await seedProjectWithOneTask()
    await taskService.updateMetadata({
      taskId: task.id,
      targetStartDate: '2026-06-01',
      targetEndDate: '2026-06-10',
      actorId: owner.id,
    }, testDb)
    const [updated] = await testDb.select().from(tasks).where(eq(tasks.id, task.id))
    expect(updated.targetStartDate).toBe('2026-06-01')
    expect(updated.targetEndDate).toBe('2026-06-10')
  })

  it('only touches fields provided (partial update)', async () => {
    const { task, owner } = await seedProjectWithOneTask()
    const originalDescription = task.description
    await taskService.updateMetadata({ taskId: task.id, name: 'New Name', actorId: owner.id }, testDb)
    const [updated] = await testDb.select().from(tasks).where(eq(tasks.id, task.id))
    expect(updated.name).toBe('New Name')
    expect(updated.description).toBe(originalDescription)
  })

  it('clears reviewerId when reviewerId is null', async () => {
    const { task, owner } = await seedProjectWithOneTask()
    const reviewer = await seedUser({ role: 'ic' })
    await taskService.updateMetadata({ taskId: task.id, reviewerId: reviewer.id, actorId: owner.id }, testDb)
    await taskService.updateMetadata({ taskId: task.id, reviewerId: null, actorId: owner.id }, testDb)
    const [updated] = await testDb.select().from(tasks).where(eq(tasks.id, task.id))
    expect(updated.reviewerId).toBeNull()
  })

  it('throws on unknown taskId', async () => {
    const owner = await seedUser({ role: 'owner' })
    await expect(taskService.updateMetadata({
      taskId: '00000000-0000-0000-0000-000000000000',
      name: 'x', actorId: owner.id,
    }, testDb)).rejects.toThrow()
  })
})
