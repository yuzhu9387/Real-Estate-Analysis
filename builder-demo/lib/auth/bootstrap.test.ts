import { describe, it, expect, beforeEach } from 'vitest'
import { truncateAll, testDb } from '@/tests/db'
import { users } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { applyBootstrapOwner } from './bootstrap'

describe('applyBootstrapOwner', () => {
  beforeEach(async () => { await truncateAll() })

  it('promotes the matching open_id to owner exactly once', async () => {
    const [u] = await testDb.insert(users).values({
      larkOpenId: 'ou_boot', larkTenantKey: 't1', name: 'Boot', role: 'ic',
    }).returning()

    const first = await applyBootstrapOwner(testDb, { openId: 'ou_boot' })
    expect(first.promoted).toBe(true)

    const reread = await testDb.select().from(users).where(eq(users.id, u.id))
    expect(reread[0].role).toBe('owner')

    const second = await applyBootstrapOwner(testDb, { openId: 'ou_boot' })
    expect(second.promoted).toBe(false)
  })

  it('is a no-op when openId is empty', async () => {
    const out = await applyBootstrapOwner(testDb, { openId: '' })
    expect(out.promoted).toBe(false)
  })
})
