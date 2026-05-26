import { describe, it, expect, beforeEach } from 'vitest'
import { eq } from 'drizzle-orm'
import { testDb, truncateAll } from '@/tests/db'
import { tasks } from '@/db/schema'
import { seedOwner, seedPm, seedIc } from '@/tests/fixtures/users'
import { seedTemplate } from '@/tests/fixtures/workflow-templates'
import { projectService } from '@/lib/services/project-service'
import { taskService } from '@/lib/services/task-service'
import { computeTeamPerformance } from './performance'

describe('computeTeamPerformance', () => {
  beforeEach(async () => { await truncateAll() })

  it('counts tasks completed in window for team', async () => {
    const owner = await seedOwner()
    const pm = await seedPm()
    const ic = await seedIc('IC-design', 'design')
    const { template } = await seedTemplate({
      createdById: owner.id, name: 't',
      tasks: [{ name: 'A', durationDays: 1 }, { name: 'B', durationDays: 1 }],
      deps: [],
    })
    const project = await projectService.create({
      createdById: pm.id, name: 'P', brand: 'al_homes', pmId: pm.id,
      assignments: [{ phaseName: 'Permitting', templateId: template.id, sortOrder: 0 }],
    }, testDb)
    const allTasks = await testDb.select().from(tasks).where(eq(tasks.projectId, project.id))
    for (const t of allTasks) {
      await testDb.update(tasks).set({ ownerId: ic.id }).where(eq(tasks.id, t.id))
    }
    await taskService.setStatus({ taskId: allTasks[0].id, status: 'complete', actorId: ic.id }, testDb)

    const result = await computeTeamPerformance(testDb, {
      team: 'design',
      since: new Date('2020-01-01'),
      until: new Date('2030-01-01'),
    })
    expect(result.tasksCompleted).toBe(1)
    expect(result.wontDoCount).toBe(0)
    expect(result.perPerson.find(p => p.userId === ic.id)?.tasksCompleted).toBe(1)
  })

  it('counts revision rate from task_comments review_revision', async () => {
    const owner = await seedOwner()
    const pm = await seedPm()
    const ic = await seedIc('IC-design', 'design')
    const reviewer = await seedIc('Reviewer', 'design')
    const { template } = await seedTemplate({
      createdById: owner.id, name: 't', tasks: [{ name: 'A', durationDays: 1 }], deps: [],
    })
    const project = await projectService.create({
      createdById: pm.id, name: 'P', brand: 'al_homes', pmId: pm.id,
      assignments: [{ phaseName: 'Permitting', templateId: template.id, sortOrder: 0 }],
    }, testDb)
    const [task] = await testDb.select().from(tasks).where(eq(tasks.projectId, project.id))
    await testDb.update(tasks).set({ ownerId: ic.id, reviewerId: reviewer.id }).where(eq(tasks.id, task.id))
    await taskService.submitForReview({ taskId: task.id, actorId: ic.id, body: 'done' }, testDb)
    await taskService.requestRevision({ taskId: task.id, actorId: reviewer.id, body: 'fix' }, testDb)
    await taskService.submitForReview({ taskId: task.id, actorId: ic.id, body: 'fixed' }, testDb)
    await taskService.approve({ taskId: task.id, actorId: reviewer.id }, testDb)
    await taskService.markComplete({ taskId: task.id, actorId: ic.id }, testDb)

    const result = await computeTeamPerformance(testDb, {
      team: 'design', since: new Date('2020-01-01'), until: new Date('2030-01-01'),
    })
    expect(result.firstPassApprovalRate).toBe(0)
  })
})
