import { describe, it, expect, beforeEach } from 'vitest'
import { testDb, truncateAll } from '@/tests/db'
import { seedUser } from '@/tests/fixtures/users'
import { seedTemplate } from '@/tests/fixtures/workflow-templates'
import { projectService } from '@/lib/services/project-service'
import { taskService } from '@/lib/services/task-service'
import { getTaskDetail } from './task-detail'
import { tasks } from '@/db/schema'
import { eq } from 'drizzle-orm'

async function seedProjectWithTasks() {
  const owner = await seedUser({ role: 'owner' })
  const pm = await seedUser({ role: 'pm' })
  const reviewer = await seedUser({ role: 'ic' })
  const tpl = await seedTemplate({
    createdById: owner.id, name: 'Permitting',
    tasks: [
      { name: 'Survey', startDay: 1, endDay: 6 },
      { name: 'Apply',  startDay: 6, endDay: 16 },
    ],
    deps: [{ fromIdx: 0, toIdx: 1 }],
  })
  // Use the same projectService.create signature you used in T2.1 / T2.2.
  // Check lib/services/task-service.update-metadata.test.ts for the canonical helper.
  const project = await projectService.create({
    name: 'P', brand: 'al_homes', pmId: pm.id,
    createdById: owner.id,
    assignments: [{ phaseName: 'Permitting', templateId: tpl.template.id, sortOrder: 0 }],
  } as never, testDb)
  const rows = await testDb.select().from(tasks).where(eq(tasks.projectId, project.id))
    .orderBy(tasks.sortOrder)
  return { owner, pm, reviewer, project, tasksList: rows }
}

describe('getTaskDetail', () => {
  beforeEach(truncateAll)

  it('returns null for unknown taskId', async () => {
    const res = await getTaskDetail('00000000-0000-0000-0000-000000000000', testDb)
    expect(res).toBeNull()
  })

  it('returns denormalized shape for a real task', async () => {
    const { tasksList } = await seedProjectWithTasks()
    const surveyTask = tasksList.find(t => t.name === 'Survey')!
    const detail = await getTaskDetail(surveyTask.id, testDb)
    expect(detail).not.toBeNull()
    expect(detail!.task.id).toBe(surveyTask.id)
    expect(detail!.project.id).toBe(surveyTask.projectId)
    expect(detail!.workflow.id).toBe(surveyTask.projectWorkflowId)
    expect(detail!.owner.id).toBeDefined()
    expect(detail!.reviewer).toBeNull()
    expect(detail!.parent).toBeNull()
    expect(detail!.upstreamDeps).toEqual([])
    expect(detail!.subtasks).toEqual([])
    expect(detail!.comments).toEqual([])
    expect(detail!.prevTaskId).toBeNull()
    expect(detail!.nextTaskId).toBe(tasksList.find(t => t.name === 'Apply')!.id)
  })

  it('resolves upstream deps with names', async () => {
    const { tasksList } = await seedProjectWithTasks()
    const applyTask = tasksList.find(t => t.name === 'Apply')!
    const detail = await getTaskDetail(applyTask.id, testDb)
    expect(detail!.upstreamDeps.map(d => d.name)).toEqual(['Survey'])
    expect(detail!.prevTaskId).toBe(tasksList.find(t => t.name === 'Survey')!.id)
    expect(detail!.nextTaskId).toBeNull()
  })

  it('returns subtasks with assignee name + status', async () => {
    const { tasksList, owner } = await seedProjectWithTasks()
    const parent = tasksList.find(t => t.name === 'Survey')!
    const sub = await taskService.addSubtask({
      parentTaskId: parent.id, name: 'Review business reqs',
      ownerId: owner.id, actorId: owner.id,
    }, testDb)

    const detail = await getTaskDetail(parent.id, testDb)
    expect(detail!.subtasks).toHaveLength(1)
    expect(detail!.subtasks[0].id).toBe(sub.id)
    expect(detail!.subtasks[0].ownerName).toBeDefined()
    expect(detail!.subtasks[0].status).toBe('not_started')
  })

  it('excludes subtasks from prev/next sibling chain', async () => {
    const { tasksList, owner } = await seedProjectWithTasks()
    const survey = tasksList.find(t => t.name === 'Survey')!
    const apply  = tasksList.find(t => t.name === 'Apply')!
    await taskService.addSubtask({
      parentTaskId: survey.id, name: 'A child',
      ownerId: owner.id, actorId: owner.id,
    }, testDb)
    const detailSurvey = await getTaskDetail(survey.id, testDb)
    expect(detailSurvey!.nextTaskId).toBe(apply.id)  // skipped subtask
  })

  it("subtask's own prev/next are null", async () => {
    const { tasksList, owner } = await seedProjectWithTasks()
    const parent = tasksList.find(t => t.name === 'Survey')!
    const sub = await taskService.addSubtask({
      parentTaskId: parent.id, name: 'Subby',
      ownerId: owner.id, actorId: owner.id,
    }, testDb)
    const detail = await getTaskDetail(sub.id, testDb)
    expect(detail!.prevTaskId).toBeNull()
    expect(detail!.nextTaskId).toBeNull()
    expect(detail!.parent?.id).toBe(parent.id)
  })
})
