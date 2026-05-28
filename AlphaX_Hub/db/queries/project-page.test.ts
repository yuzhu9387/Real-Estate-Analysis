import { describe, it, expect, beforeEach } from 'vitest'
import { testDb, truncateAll } from '@/tests/db'
import { seedOwner, seedPm, seedIc } from '@/tests/fixtures/users'
import { seedTemplate } from '@/tests/fixtures/workflow-templates'
import { projectService } from '@/lib/services/project-service'
import { getProjectPageData, getProjectActivities } from './project-page'
import { taskService } from '@/lib/services/task-service'
import { tasks } from '@/db/schema'
import { eq } from 'drizzle-orm'

describe('getProjectPageData', () => {
  beforeEach(async () => { await truncateAll() })

  it('returns project + phases + workflows + tasks + deps + referenced users', async () => {
    const owner = await seedOwner()
    const pm = await seedPm()
    const ic = await seedIc('IC1', 'design')
    const { template } = await seedTemplate({
      createdById: owner.id, name: 'P',
      tasks: [{ name: 'A', startDay: 1, endDay: 3 }, { name: 'B', startDay: 3, endDay: 6 }],
      deps: [{ fromIdx: 0, toIdx: 1 }],
    })
    const project = await projectService.create({
      createdById: pm.id, name: 'X', brand: 'al_homes', pmId: pm.id,
      assignments: [{ phaseName: 'Permitting', templateId: template.id, sortOrder: 0 }],
    }, testDb)
    const allTasks = await testDb.select().from(tasks).where(eq(tasks.projectId, project.id))
    await testDb.update(tasks).set({ ownerId: ic.id }).where(eq(tasks.id, allTasks[0].id))

    const data = await getProjectPageData(testDb, project.id)
    expect(data).not.toBeNull()
    expect(data!.project.id).toBe(project.id)
    expect(data!.phases).toHaveLength(3)
    expect(data!.workflows).toHaveLength(1)
    expect(data!.tasks).toHaveLength(2)
    expect(data!.taskDeps).toHaveLength(1)
    expect(data!.users.find(u => u.id === pm.id)).toBeDefined()
    expect(data!.users.find(u => u.id === ic.id)).toBeDefined()
  })

  it('returns null when project does not exist', async () => {
    const data = await getProjectPageData(testDb, '00000000-0000-0000-0000-000000000000')
    expect(data).toBeNull()
  })
})

describe('getProjectActivities', () => {
  beforeEach(async () => { await truncateAll() })

  it('returns activities + actors + referenced tasks', async () => {
    const owner = await seedOwner()
    const pm = await seedPm()
    const { template } = await seedTemplate({
      createdById: owner.id, name: 'P', tasks: [{ name: 'A', startDay: 1, endDay: 2 }], deps: [],
    })
    const project = await projectService.create({
      createdById: pm.id, name: 'X', brand: 'al_homes', pmId: pm.id,
      assignments: [{ phaseName: 'Permitting', templateId: template.id, sortOrder: 0 }],
    }, testDb)
    const [task] = await testDb.select().from(tasks).where(eq(tasks.projectId, project.id))
    await taskService.setStatus({ taskId: task.id, status: 'started', actorId: pm.id }, testDb)

    const out = await getProjectActivities(testDb, project.id, 50)
    expect(out.activities.length).toBeGreaterThan(0)
    expect(out.users.find(u => u.id === pm.id)).toBeDefined()
  })
})
