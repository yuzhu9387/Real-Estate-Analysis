import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock next/headers BEFORE any imports that transitively use it.
// vi.mock is hoisted to the top of the file by Vitest.
vi.mock('next/headers', () => ({
  cookies: () => ({
    set: () => {},
    get: () => undefined,
    delete: () => {},
  }),
}))

// Route the action's db import to the test database so writes are visible
// in testDb queries and get cleaned up by truncateAll().
vi.mock('@/db/client', async () => {
  const { testDb, testSql } = await import('@/tests/db')
  return { db: testDb, sql: testSql }
})

import { eq } from 'drizzle-orm'
import { testDb, truncateAll } from '@/tests/db'
import { users } from '@/db/schema'
import { registerWithPassword } from './auth'

describe('registerWithPassword', () => {
  beforeEach(async () => { await truncateAll() })

  it('creates a user with role=ic, isActive=true, hashed password, null Lark fields', async () => {
    const res = await registerWithPassword({
      email: 'alice@example.com',
      name: 'Alice',
      password: 'supersecret',
    })
    expect(res).toEqual({ ok: true })
    const rows = await testDb.select().from(users).where(eq(users.email, 'alice@example.com'))
    expect(rows.length).toBe(1)
    const u = rows[0]
    expect(u.role).toBe('ic')
    expect(u.isActive).toBe(true)
    expect(u.larkOpenId).toBeNull()
    expect(u.larkTenantKey).toBeNull()
    expect(u.passwordHash).not.toBeNull()
    expect(u.passwordHash).not.toBe('supersecret')
  })

  it('rejects duplicate email (case-insensitive)', async () => {
    await registerWithPassword({ email: 'Alice@example.com', name: 'Alice', password: 'supersecret' })
    const res = await registerWithPassword({ email: 'alice@EXAMPLE.com', name: 'Alice2', password: 'anothersecret' })
    expect(res).toEqual({ ok: false, field: 'email', message: 'Email already registered' })
  })

  it('trims whitespace from name and lowercases email', async () => {
    await registerWithPassword({ email: '  ALICE@example.com  ', name: '  Alice  ', password: 'supersecret' })
    const rows = await testDb.select().from(users)
    expect(rows[0].email).toBe('alice@example.com')
    expect(rows[0].name).toBe('Alice')
  })

  it('rejects short password (Zod throws)', async () => {
    await expect(registerWithPassword({
      email: 'bob@example.com', name: 'Bob', password: 'short',
    })).rejects.toThrow()
  })
})
