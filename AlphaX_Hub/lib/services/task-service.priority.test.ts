import { describe, it, expect, beforeEach } from 'vitest'
import { eq } from 'drizzle-orm'
import { testDb, truncateAll } from '@/tests/db'
import { tasks, activities } from '@/db/schema'
import { seedOwner, seedPm } from '@/tests/fixtures/users'
import { seedTemplate } from '@/tests/fixtures/workflow-templates'
import { projectService } from './project-service'
import { taskService } from './task-service'

async function setup() {
  const owner = await seedOwner()
  const pm = await seedPm()
  const { template } = await seedTemplate({
    createdById: owner.id, name: 'P', tasks: [{ name: 'A', durationDays: 1 }], deps: [],
  })
  const project = await projectService.create({
    createdById: pm.id, name: 'X', brand: 'al_homes', pmId: pm.id,
    assignments: [{ phaseName: 'Permitting', templateId: template.id, sortOrder: 0 }],
  }, testDb)
  const [task] = await testDb.select().from(tasks).where(eq(tasks.projectId, project.id))
  return { project, pm, task }
}

describe('taskService.setPriority', () => {
  beforeEach(async () => { await truncateAll() })

  it('updates priority and stores it', async () => {
    const { task, pm } = await setup()
    await taskService.setPriority({ taskId: task.id, priority: 'high', actorId: pm.id }, testDb)
    const re = await testDb.select().from(tasks).where(eq(tasks.id, task.id))
    expect(re[0].priority).toBe('high')
  })

  it('writes activity row', async () => {
    const { task, pm } = await setup()
    await taskService.setPriority({ taskId: task.id, priority: 'high', actorId: pm.id }, testDb)
    const acts = await testDb.select().from(activities).where(eq(activities.type, 'task.priority_changed'))
    expect(acts.length).toBe(1)
    expect((acts[0].payload as { to: string }).to).toBe('high')
  })
})
