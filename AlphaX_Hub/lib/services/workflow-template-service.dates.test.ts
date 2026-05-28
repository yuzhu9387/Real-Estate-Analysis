import { describe, it, expect, beforeEach } from 'vitest'
import { testDb, truncateAll } from '@/tests/db'
import { seedUser } from '@/tests/fixtures/users'
import { workflowTemplateService } from '@/lib/services/workflow-template-service'
import { workflowTemplates } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { ValidationError } from '@/lib/server/errors'

describe('workflowTemplateService date semantics', () => {
  beforeEach(truncateAll)

  it('persists aggregate totals on create', async () => {
    const owner = await seedUser({ role: 'owner' })
    const tpl = await workflowTemplateService.create({
      createdById: owner.id,
      name: 'Demo',
      tasks: [
        { name: 'A', startDay: 1,  endDay: 6  },
        { name: 'B', startDay: 6,  endDay: 11 },
        { name: 'C', startDay: 11, endDay: 14 },
      ],
      deps: [],
    }, testDb)
    const [row] = await testDb.select().from(workflowTemplates).where(eq(workflowTemplates.id, tpl.id))
    expect(row.totalStartDay).toBe(1)
    expect(row.totalEndDay).toBe(14)
    expect(row.totalDurationDays).toBe(13)
  })

  it('recomputes aggregate totals on update', async () => {
    const owner = await seedUser({ role: 'owner' })
    const tpl = await workflowTemplateService.create({
      createdById: owner.id,
      name: 'Demo',
      tasks: [{ name: 'A', startDay: 1, endDay: 6 }],
      deps: [],
    }, testDb)
    await workflowTemplateService.update(tpl.id, {
      tasks: [
        { name: 'A', startDay: 1,  endDay: 6 },
        { name: 'B', startDay: 6,  endDay: 16 },
      ],
      deps: [],
    }, testDb)
    const [row] = await testDb.select().from(workflowTemplates).where(eq(workflowTemplates.id, tpl.id))
    expect(row.totalStartDay).toBe(1)
    expect(row.totalEndDay).toBe(16)
    expect(row.totalDurationDays).toBe(15)
  })

  it('rejects startDay < 1', async () => {
    const owner = await seedUser({ role: 'owner' })
    await expect(workflowTemplateService.create({
      createdById: owner.id,
      name: 'Demo',
      tasks: [{ name: 'A', startDay: 0, endDay: 5 }],
      deps: [],
    }, testDb)).rejects.toBeInstanceOf(ValidationError)
  })

  it('rejects endDay < startDay', async () => {
    const owner = await seedUser({ role: 'owner' })
    await expect(workflowTemplateService.create({
      createdById: owner.id,
      name: 'Demo',
      tasks: [{ name: 'A', startDay: 5, endDay: 4 }],
      deps: [],
    }, testDb)).rejects.toBeInstanceOf(ValidationError)
  })

  it('allows endDay == startDay (zero-duration milestone)', async () => {
    const owner = await seedUser({ role: 'owner' })
    const tpl = await workflowTemplateService.create({
      createdById: owner.id,
      name: 'Demo',
      tasks: [
        { name: 'Work',     startDay: 1, endDay: 5 },
        { name: 'Approval', startDay: 5, endDay: 5 },
      ],
      deps: [],
    }, testDb)
    const [row] = await testDb.select().from(workflowTemplates).where(eq(workflowTemplates.id, tpl.id))
    expect(row.totalDurationDays).toBe(4)
  })
})
