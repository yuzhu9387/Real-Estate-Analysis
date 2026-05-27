import { describe, it, expect, beforeEach } from 'vitest'
import { eq } from 'drizzle-orm'
import { testDb, truncateAll } from '@/tests/db'
import { workflowTemplates, workflowTemplateTasks, workflowTemplateTaskDeps } from '@/db/schema'
import { seedOwner } from '@/tests/fixtures/users'
import { workflowTemplateService } from './workflow-template-service'
import { ConflictError } from '@/lib/server/errors'

describe('workflowTemplateService.duplicate', () => {
  beforeEach(async () => { await truncateAll() })

  it('copies tasks and deps with new IDs', async () => {
    const owner = await seedOwner()
    const src = await workflowTemplateService.create({
      createdById: owner.id, name: 'Source',
      tasks: [{ name: 'A', durationDays: 5 }, { name: 'B', durationDays: 10 }],
      deps: [{ fromIdx: 0, toIdx: 1, lagDays: 0 }],
    }, testDb)

    const dup = await workflowTemplateService.duplicate(src.id, {
      newName: 'Copy of Source', createdById: owner.id,
    }, testDb)
    expect(dup.id).not.toBe(src.id)
    expect(dup.name).toBe('Copy of Source')

    const dupTasks = await testDb.select().from(workflowTemplateTasks).where(eq(workflowTemplateTasks.workflowTemplateId, dup.id))
    expect(dupTasks.map(t => t.name).sort()).toEqual(['A', 'B'])

    const dupDeps = await testDb.select().from(workflowTemplateTaskDeps).where(eq(workflowTemplateTaskDeps.workflowTemplateId, dup.id))
    expect(dupDeps).toHaveLength(1)
    const dupTaskIds = new Set(dupTasks.map(t => t.id))
    expect(dupTaskIds.has(dupDeps[0].fromTaskId)).toBe(true)
    expect(dupTaskIds.has(dupDeps[0].toTaskId)).toBe(true)
  })

  it('rejects archived source', async () => {
    const owner = await seedOwner()
    const src = await workflowTemplateService.create({
      createdById: owner.id, name: 'Source',
      tasks: [{ name: 'A', durationDays: 1 }], deps: [],
    }, testDb)
    await workflowTemplateService.archive(src.id, testDb)
    await expect(workflowTemplateService.duplicate(src.id, {
      newName: 'X', createdById: owner.id,
    }, testDb)).rejects.toThrow(ConflictError)
  })

  it('throws NotFound on missing source', async () => {
    const owner = await seedOwner()
    await expect(workflowTemplateService.duplicate('00000000-0000-0000-0000-000000000000', {
      newName: 'X', createdById: owner.id,
    }, testDb)).rejects.toThrow()
  })
})
