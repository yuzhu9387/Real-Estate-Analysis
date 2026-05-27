import { describe, it, expect, beforeEach } from 'vitest'
import { testDb, truncateAll } from '@/tests/db'
import { seedOwner } from '@/tests/fixtures/users'
import { workflowTemplateService } from './workflow-template-service'
import { ValidationError } from '@/lib/server/errors'

describe('workflowTemplateService cycle detection', () => {
  beforeEach(async () => { await truncateAll() })

  it('create rejects deps that form a cycle', async () => {
    const owner = await seedOwner()
    await expect(workflowTemplateService.create({
      createdById: owner.id, name: 'X',
      tasks: [{ name: 'A', durationDays: 1 }, { name: 'B', durationDays: 1 }],
      deps: [
        { fromIdx: 0, toIdx: 1, lagDays: 0 },
        { fromIdx: 1, toIdx: 0, lagDays: 0 },
      ],
    }, testDb)).rejects.toThrow(ValidationError)
  })

  it('update rejects deps that form a cycle', async () => {
    const owner = await seedOwner()
    const tpl = await workflowTemplateService.create({
      createdById: owner.id, name: 'X',
      tasks: [{ name: 'A', durationDays: 1 }, { name: 'B', durationDays: 1 }],
      deps: [{ fromIdx: 0, toIdx: 1, lagDays: 0 }],
    }, testDb)
    await expect(workflowTemplateService.update(tpl.id, {
      tasks: [{ name: 'A', durationDays: 1 }, { name: 'B', durationDays: 1 }],
      deps: [
        { fromIdx: 0, toIdx: 1, lagDays: 0 },
        { fromIdx: 1, toIdx: 0, lagDays: 0 },
      ],
    }, testDb)).rejects.toThrow(ValidationError)
  })

  it('linear chain still accepted', async () => {
    const owner = await seedOwner()
    await expect(workflowTemplateService.create({
      createdById: owner.id, name: 'OK',
      tasks: [{ name: 'A', durationDays: 1 }, { name: 'B', durationDays: 1 }, { name: 'C', durationDays: 1 }],
      deps: [
        { fromIdx: 0, toIdx: 1, lagDays: 0 },
        { fromIdx: 1, toIdx: 2, lagDays: 0 },
      ],
    }, testDb)).resolves.toBeDefined()
  })
})
