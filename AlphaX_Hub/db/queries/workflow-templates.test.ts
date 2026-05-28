import { describe, it, expect, beforeEach } from 'vitest'
import { testDb, truncateAll } from '@/tests/db'
import { seedUser } from '@/tests/fixtures/users'
import { seedTemplate } from '@/tests/fixtures/workflow-templates'
import { listWorkflowTemplates } from './workflow-templates'

describe('listWorkflowTemplates', () => {
  beforeEach(truncateAll)

  it('returns name, description, task count, total duration', async () => {
    const owner = await seedUser({ role: 'owner' })
    await seedTemplate({
      createdById: owner.id, name: 'Permitting Basics',
      tasks: [
        { name: 'Survey', startDay: 1, endDay: 6 },
        { name: 'Apply',  startDay: 6, endDay: 16 },
      ],
      deps: [],
    })
    const rows = await listWorkflowTemplates({ includeArchived: false }, testDb)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      name: 'Permitting Basics',
      taskCount: 2,
      totalDurationDays: 15,
    })
  })

  it('q filters by name (case-insensitive)', async () => {
    const owner = await seedUser({ role: 'owner' })
    await seedTemplate({ createdById: owner.id, name: 'Foundation Standard',
      tasks: [{ name: 'A', startDay: 1, endDay: 2 }], deps: [] })
    await seedTemplate({ createdById: owner.id, name: 'Permitting Basics',
      tasks: [{ name: 'A', startDay: 1, endDay: 2 }], deps: [] })
    const rows = await listWorkflowTemplates({ q: 'foundation', includeArchived: false }, testDb)
    expect(rows.map(r => r.name)).toEqual(['Foundation Standard'])
  })

  it('q matches in description too', async () => {
    const { workflowTemplates } = await import('@/db/schema')
    const { eq } = await import('drizzle-orm')
    const owner = await seedUser({ role: 'owner' })
    const created = await seedTemplate({ createdById: owner.id, name: 'X',
      tasks: [{ name: 'A', startDay: 1, endDay: 2 }], deps: [] })
    await testDb.update(workflowTemplates)
      .set({ description: 'matches foundation keyword' })
      .where(eq(workflowTemplates.id, created.template.id))
    const rows = await listWorkflowTemplates({ q: 'foundation', includeArchived: false }, testDb)
    expect(rows.map(r => r.name)).toEqual(['X'])
  })

  it('excludes archived unless includeArchived', async () => {
    const { workflowTemplates } = await import('@/db/schema')
    const { eq } = await import('drizzle-orm')
    const owner = await seedUser({ role: 'owner' })
    await seedTemplate({ createdById: owner.id, name: 'Active',
      tasks: [{ name: 'A', startDay: 1, endDay: 2 }], deps: [] })
    const b = await seedTemplate({ createdById: owner.id, name: 'Archived',
      tasks: [{ name: 'A', startDay: 1, endDay: 2 }], deps: [] })
    await testDb.update(workflowTemplates).set({ isArchived: true })
      .where(eq(workflowTemplates.id, b.template.id))

    const without = await listWorkflowTemplates({ includeArchived: false }, testDb)
    expect(without.map(r => r.name)).toEqual(['Active'])
    const withArchived = await listWorkflowTemplates({ includeArchived: true }, testDb)
    expect(withArchived.map(r => r.name)).toEqual(['Active', 'Archived'])
  })
})
