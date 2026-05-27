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

import type { User } from '@/db/schema'
let __currentUser: User | null = null
function __setCurrentUser(u: User | null) { __currentUser = u }

vi.mock('@/lib/server/get-current-user', () => ({
  getCurrentUser: async () => __currentUser,
  requireUser: async () => {
    if (!__currentUser) throw new Error('Test: no current user set')
    return __currentUser
  },
}))

vi.mock('@/lib/server/require-permission', () => ({
  requirePermission: async (action: { type: string }) => {
    const { UnauthorizedError, ForbiddenError } = await import('@/lib/server/errors')
    if (!__currentUser) throw new UnauthorizedError()
    const { can } = await import('@/lib/permissions')
    if (!can(__currentUser as User, action as Parameters<typeof can>[1])) {
      throw new ForbiddenError(`Denied: ${action.type}`)
    }
    return __currentUser
  },
}))

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

import { loginWithPassword } from './auth'

describe('loginWithPassword', () => {
  beforeEach(async () => { await truncateAll() })

  async function setupUser() {
    await registerWithPassword({ email: 'alice@example.com', name: 'Alice', password: 'supersecret' })
  }

  it('returns ok=true and updates lastLoginAt on correct password', async () => {
    await setupUser()
    const before = (await testDb.select().from(users))[0].lastLoginAt
    const res = await loginWithPassword({ email: 'alice@example.com', password: 'supersecret' })
    expect(res).toEqual({ ok: true })
    const after = (await testDb.select().from(users))[0].lastLoginAt
    expect(after).not.toEqual(before)
    expect(after).not.toBeNull()
  })

  it('returns unified error on wrong password', async () => {
    await setupUser()
    expect(await loginWithPassword({ email: 'alice@example.com', password: 'wrong' }))
      .toEqual({ ok: false, message: 'Invalid email or password' })
  })

  it('returns unified error on unknown email', async () => {
    expect(await loginWithPassword({ email: 'nobody@example.com', password: 'whatever' }))
      .toEqual({ ok: false, message: 'Invalid email or password' })
  })

  it('returns unified error when user has no password (Lark-only)', async () => {
    await testDb.insert(users).values({
      larkOpenId: 'lark_only', larkTenantKey: 't1',
      email: 'lark@example.com', name: 'Lark User', role: 'ic',
    })
    expect(await loginWithPassword({ email: 'lark@example.com', password: 'supersecret' }))
      .toEqual({ ok: false, message: 'Invalid email or password' })
  })

  it('returns Account disabled when user.isActive=false', async () => {
    await setupUser()
    await testDb.update(users).set({ isActive: false })
    expect(await loginWithPassword({ email: 'alice@example.com', password: 'supersecret' }))
      .toEqual({ ok: false, message: 'Account disabled' })
  })

  it('matches email case-insensitively', async () => {
    await setupUser()
    expect(await loginWithPassword({ email: 'ALICE@EXAMPLE.com', password: 'supersecret' }))
      .toEqual({ ok: true })
  })
})

import { adminResetPassword } from './auth'
import { ForbiddenError } from '@/lib/server/errors'
import { seedOwner, seedPm, seedIc } from '@/tests/fixtures/users'

describe('adminResetPassword', () => {
  beforeEach(async () => {
    await truncateAll()
    __setCurrentUser(null)
  })

  it('owner can reset another user password; new password works, old fails', async () => {
    const owner = await seedOwner()
    await registerWithPassword({ email: 'a@x.com', name: 'A', password: 'oldsecret' })
    const target = (await testDb.select().from(users).where(eq(users.email, 'a@x.com')))[0]

    __setCurrentUser(owner)
    const res = await adminResetPassword({ userId: target.id, newPassword: 'newsecret' })
    expect(res).toEqual({ ok: true })

    __setCurrentUser(null)
    expect(await loginWithPassword({ email: 'a@x.com', password: 'oldsecret' }))
      .toEqual({ ok: false, message: 'Invalid email or password' })
    expect(await loginWithPassword({ email: 'a@x.com', password: 'newsecret' }))
      .toEqual({ ok: true })
  })

  it('PM cannot reset', async () => {
    const pm = await seedPm()
    await registerWithPassword({ email: 'a@x.com', name: 'A', password: 'oldsecret' })
    const target = (await testDb.select().from(users).where(eq(users.email, 'a@x.com')))[0]
    __setCurrentUser(pm)
    await expect(adminResetPassword({ userId: target.id, newPassword: 'newsecret' }))
      .rejects.toThrow(ForbiddenError)
  })

  it('IC cannot reset', async () => {
    const ic = await seedIc()
    await registerWithPassword({ email: 'a@x.com', name: 'A', password: 'oldsecret' })
    const target = (await testDb.select().from(users).where(eq(users.email, 'a@x.com')))[0]
    __setCurrentUser(ic)
    await expect(adminResetPassword({ userId: target.id, newPassword: 'newsecret' }))
      .rejects.toThrow(ForbiddenError)
  })

  it('owner can set initial password for a Lark-only user', async () => {
    const owner = await seedOwner()
    const [larkUser] = await testDb.insert(users).values({
      larkOpenId: 'lark_only', larkTenantKey: 't1',
      email: 'lark@example.com', name: 'Lark User', role: 'ic',
    }).returning()

    __setCurrentUser(owner)
    await adminResetPassword({ userId: larkUser.id, newPassword: 'newsecret' })

    __setCurrentUser(null)
    expect(await loginWithPassword({ email: 'lark@example.com', password: 'newsecret' }))
      .toEqual({ ok: true })
  })
})
