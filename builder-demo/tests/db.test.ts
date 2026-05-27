import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { testDb, truncateAll } from './db'
import { users } from '@/db/schema'

describe('test db helper', () => {
  beforeAll(async () => { await truncateAll() })
  beforeEach(async () => { await truncateAll() })

  it('can insert and read users', async () => {
    await testDb.insert(users).values({
      larkOpenId: 'lark_test_1',
      larkTenantKey: 'tenant_a',
      email: 'test_user@buildflow.local',
      name: 'Test User',
      role: 'ic',
    })
    const rows = await testDb.select().from(users)
    expect(rows).toHaveLength(1)
    expect(rows[0].name).toBe('Test User')
  })
})
