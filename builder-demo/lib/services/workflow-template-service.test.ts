import { describe, it, expect, beforeEach } from 'vitest'
import { eq } from 'drizzle-orm'
import { testDb, truncateAll } from '@/tests/db'
import { workflowTemplates, workflowTemplateTasks, workflowTemplateTaskDeps } from '@/db/schema'
import { seedOwner } from '@/tests/fixtures/users'
import { workflowTemplateService } from './workflow-template-service'

describe('workflowTemplateService', () => {
  beforeEach(async () => { await truncateAll() })

  it('creates a template with tasks and deps in one transaction', async () => {
    const owner = await seedOwner()
    const tpl = await workflowTemplateService.create({
      createdById: owner.id,
      name: 'Permitting Basics',
      description: 'standard permit pipeline',
      tasks: [
        { name: 'Survey', durationDays: 5 },
        { name: 'Apply', durationDays: 10 },
      ],
      deps: [{ fromIdx: 0, toIdx: 1, lagDays: 0 }],
    }, testDb)
    expect(tpl.id).toBeDefined()
    const tasks = await testDb.select().from(workflowTemplateTasks).where(eq(workflowTemplateTasks.workflowTemplateId, tpl.id))
    expect(tasks).toHaveLength(2)
    const deps = await testDb.select().from(workflowTemplateTaskDeps).where(eq(workflowTemplateTaskDeps.workflowTemplateId, tpl.id))
    expect(deps).toHaveLength(1)
  })

  it('update replaces tasks and deps fully', async () => {
    const owner = await seedOwner()
    const tpl = await workflowTemplateService.create({
      createdById: owner.id, name: 'a',
      tasks: [{ name: 't', durationDays: 1 }], deps: [],
    }, testDb)

    await workflowTemplateService.update(tpl.id, {
      name: 'b', description: null,
      tasks: [
        { name: 'x', durationDays: 2 },
        { name: 'y', durationDays: 3 },
      ],
      deps: [{ fromIdx: 0, toIdx: 1, lagDays: 0 }],
    }, testDb)

    const reread = await testDb.select().from(workflowTemplates).where(eq(workflowTemplates.id, tpl.id))
    expect(reread[0].name).toBe('b')
    const tasks = await testDb.select().from(workflowTemplateTasks).where(eq(workflowTemplateTasks.workflowTemplateId, tpl.id))
    expect(tasks.map(t => t.name).sort()).toEqual(['x','y'])
  })

  it('archive sets is_archived=true', async () => {
    const owner = await seedOwner()
    const tpl = await workflowTemplateService.create({
      createdById: owner.id, name: 'a',
      tasks: [{ name: 't', durationDays: 1 }], deps: [],
    }, testDb)
    await workflowTemplateService.archive(tpl.id, testDb)
    const reread = await testDb.select().from(workflowTemplates).where(eq(workflowTemplates.id, tpl.id))
    expect(reread[0].isArchived).toBe(true)
  })
})
