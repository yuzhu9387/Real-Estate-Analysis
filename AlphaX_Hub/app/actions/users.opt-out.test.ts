import { describe, it, expect, beforeEach } from 'vitest'
import { eq } from 'drizzle-orm'
import { testDb, truncateAll } from '@/tests/db'
import { users } from '@/db/schema'
import { seedIc } from '@/tests/fixtures/users'

describe('lark digest opt-out (DB layer)', () => {
  beforeEach(async () => { await truncateAll() })

  it('default is opted-in (false)', async () => {
    const u = await seedIc('IC', 'design')
    const re = await testDb.select().from(users).where(eq(users.id, u.id))
    expect(re[0].larkDigestOptedOut).toBe(false)
  })

  it('flipping to opted-out persists', async () => {
    const u = await seedIc('IC', 'design')
    await testDb.update(users).set({ larkDigestOptedOut: true }).where(eq(users.id, u.id))
    const re = await testDb.select().from(users).where(eq(users.id, u.id))
    expect(re[0].larkDigestOptedOut).toBe(true)
  })
})
