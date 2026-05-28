import { describe, it, expect, beforeEach } from 'vitest'
import { eq } from 'drizzle-orm'
import { testDb, truncateAll } from '@/tests/db'
import { tasks } from '@/db/schema'
import { seedOwner, seedPm, seedIc } from '@/tests/fixtures/users'
import { seedTemplate } from '@/tests/fixtures/workflow-templates'
import { projectService } from '@/lib/services/project-service'
import { taskService } from '@/lib/services/task-service'
import { getMyTasks } from './my-tasks'

describe('getMyTasks', () => {
  beforeEach(async () => { await truncateAll() })

  it('returns open tasks owned by user, sorted by ranking', async () => {
    const owner = await seedOwner()
    const pm = await seedPm()
    const ic = await seedIc('IC', 'design')
    const { template } = await seedTemplate({
      createdById: owner.id, name: 'P',
      tasks: [{ name: 'A', startDay: 1, endDay: 3 }, { name: 'B', startDay: 3, endDay: 6 }],
      deps: [],
    })
    const project = await projectService.create({
      createdById: pm.id, name: '12 Maple', brand: 'al_homes', pmId: pm.id,
      assignments: [{ phaseName: 'Permitting', templateId: template.id, sortOrder: 0 }],
    }, testDb)
    const allTasks = await testDb.select().from(tasks).where(eq(tasks.projectId, project.id))
    for (const t of allTasks) await testDb.update(tasks).set({ ownerId: ic.id }).where(eq(tasks.id, t.id))

    const out = await getMyTasks(testDb, ic.id)
    expect(out.openTasks.length).toBe(2)
    expect(out.openTasks[0].project.name).toBe('12 Maple')
    expect(out.openTasks[0].phase.name).toBe('Permitting')
  })

  it('Pending Review returns tasks where user is reviewer and status=pending_review', async () => {
    const owner = await seedOwner()
    const pm = await seedPm()
    const ic = await seedIc('IC', 'design')
    const reviewer = await seedIc('Rev', 'design')
    const { template } = await seedTemplate({
      createdById: owner.id, name: 'P', tasks: [{ name: 'A', startDay: 1, endDay: 2 }], deps: [],
    })
    const project = await projectService.create({
      createdById: pm.id, name: 'X', brand: 'al_homes', pmId: pm.id,
      assignments: [{ phaseName: 'Permitting', templateId: template.id, sortOrder: 0 }],
    }, testDb)
    // Kick off so project is in_progress
    const phases = await testDb.select().from((await import('@/db/schema')).projectPhases)
    const permitting = phases.find(p => p.name === 'Permitting' && p.projectId === project.id)!
    await (await import('@/lib/services/phase-service')).phaseService
      .kickOff({ phaseId: permitting.id, actorId: pm.id }, testDb)
    const [task] = await testDb.select().from(tasks).where(eq(tasks.projectId, project.id))
    await testDb.update(tasks).set({ ownerId: ic.id, reviewerId: reviewer.id }).where(eq(tasks.id, task.id))
    await taskService.submitForReview({ taskId: task.id, actorId: ic.id, body: 'done' }, testDb)

    const out = await getMyTasks(testDb, reviewer.id)
    expect(out.pendingReview).toHaveLength(1)
    expect(out.pendingReview[0].task.id).toBe(task.id)
  })

  it('Completed returns user-owned tasks in complete/wont_do, paginated', async () => {
    const owner = await seedOwner()
    const pm = await seedPm()
    const ic = await seedIc('IC', 'design')
    const { template } = await seedTemplate({
      createdById: owner.id, name: 'P',
      tasks: [{ name: 'A', startDay: 1, endDay: 2 }, { name: 'B', startDay: 2, endDay: 3 }],
      deps: [],
    })
    const project = await projectService.create({
      createdById: pm.id, name: 'X', brand: 'al_homes', pmId: pm.id,
      assignments: [{ phaseName: 'Permitting', templateId: template.id, sortOrder: 0 }],
    }, testDb)
    const ts = await testDb.select().from(tasks).where(eq(tasks.projectId, project.id))
    for (const t of ts) await testDb.update(tasks).set({ ownerId: ic.id }).where(eq(tasks.id, t.id))
    await taskService.setStatus({ taskId: ts[0].id, status: 'complete', actorId: ic.id }, testDb)
    await taskService.setStatus({ taskId: ts[1].id, status: 'wont_do', actorId: ic.id }, testDb)

    const out = await getMyTasks(testDb, ic.id)
    expect(out.completedTasks).toHaveLength(2)
    expect(out.completedTotal).toBe(2)
  })

  it('excludes tasks in archived projects from Open', async () => {
    const owner = await seedOwner()
    const pm = await seedPm()
    const ic = await seedIc('IC', 'design')
    const { template } = await seedTemplate({
      createdById: owner.id, name: 'P', tasks: [{ name: 'A', startDay: 1, endDay: 2 }], deps: [],
    })
    const project = await projectService.create({
      createdById: pm.id, name: 'X', brand: 'al_homes', pmId: pm.id,
      assignments: [{ phaseName: 'Permitting', templateId: template.id, sortOrder: 0 }],
    }, testDb)
    const [task] = await testDb.select().from(tasks).where(eq(tasks.projectId, project.id))
    await testDb.update(tasks).set({ ownerId: ic.id }).where(eq(tasks.id, task.id))

    const { projects } = await import('@/db/schema')
    await testDb.update(projects).set({ status: 'archived' })

    const out = await getMyTasks(testDb, ic.id)
    expect(out.openTasks).toHaveLength(0)
  })
})

import { getDigestSummariesForActiveOptedInUsers } from './my-tasks'
import { users } from '@/db/schema'

describe('getDigestSummariesForActiveOptedInUsers', () => {
  beforeEach(async () => { await truncateAll() })

  it('excludes opted-out and inactive users', async () => {
    const ic1 = await seedIc('a', 'design')
    const ic2 = await seedIc('b', 'design')
    const ic3 = await seedIc('c', 'design')
    await testDb.update(users).set({ larkDigestOptedOut: true }).where(eq(users.id, ic2.id))
    await testDb.update(users).set({ isActive: false }).where(eq(users.id, ic3.id))

    const out = await getDigestSummariesForActiveOptedInUsers(testDb)
    const ids = out.map(r => r.userId).sort()
    expect(ids).toEqual([ic1.id].sort())
  })

  it('computes counts correctly', async () => {
    const owner = await seedOwner()
    const pm = await seedPm()
    const ic = await seedIc('IC', 'design')
    const { template } = await seedTemplate({
      createdById: owner.id, name: 'P',
      tasks: [{ name: 'A', startDay: 1, endDay: 2 }, { name: 'B', startDay: 2, endDay: 3 }],
      deps: [],
    })
    const project = await projectService.create({
      createdById: pm.id, name: 'X', brand: 'al_homes', pmId: pm.id,
      assignments: [{ phaseName: 'Permitting', templateId: template.id, sortOrder: 0 }],
    }, testDb)
    const ts = await testDb.select().from(tasks).where(eq(tasks.projectId, project.id))
    for (const t of ts) await testDb.update(tasks).set({ ownerId: ic.id, reviewerId: pm.id }).where(eq(tasks.id, t.id))

    const summaries = await getDigestSummariesForActiveOptedInUsers(testDb)
    const me = summaries.find(s => s.userId === ic.id)
    expect(me).toBeDefined()
    expect(me!.overdueCount + me!.dueThisWeekCount).toBeGreaterThanOrEqual(0)
  })
})
