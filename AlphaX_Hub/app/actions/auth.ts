'use server'
import { z } from 'zod'
import { eq, sql } from 'drizzle-orm'
import { db } from '@/db/client'
import { users } from '@/db/schema'
import { hashPassword, verifyPassword } from '@/lib/auth/password'
import { issueSession } from '@/lib/auth/session'
import { requirePermission } from '@/lib/server/require-permission'

export async function registerWithPassword(raw: unknown) {
  const input = z.object({
    email: z.preprocess(s => typeof s === 'string' ? s.trim().toLowerCase() : s, z.string().email()),
    name: z.preprocess(s => typeof s === 'string' ? s.trim() : s, z.string().min(1)),
    password: z.string().min(8),
  }).parse(raw)

  const existing = await db.select().from(users)
    .where(sql`lower(${users.email}) = ${input.email}`)
    .limit(1)
  if (existing.length > 0) {
    return { ok: false as const, field: 'email' as const, message: 'Email already registered' }
  }

  const passwordHash = await hashPassword(input.password)
  const [created] = await db.insert(users).values({
    email: input.email,
    name: input.name,
    passwordHash,
    role: 'ic',
    isActive: true,
    larkOpenId: null,
    larkTenantKey: null,
  }).returning()

  await issueSession(created.id)
  return { ok: true as const }
}

export async function loginWithPassword(raw: unknown) {
  const input = z.object({
    email: z.preprocess(s => typeof s === 'string' ? s.trim().toLowerCase() : s, z.string()),
    password: z.string(),
  }).parse(raw)

  const fail = { ok: false as const, message: 'Invalid email or password' as const }

  const rows = await db.select().from(users)
    .where(sql`lower(${users.email}) = ${input.email}`)
    .limit(1)
  const user = rows[0]
  if (!user) return fail
  if (!user.passwordHash) return fail
  if (!user.isActive) return { ok: false as const, message: 'Account disabled' as const }

  const ok = await verifyPassword(input.password, user.passwordHash)
  if (!ok) return fail

  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id))
  await issueSession(user.id)
  return { ok: true as const }
}

export async function adminResetPassword(raw: unknown) {
  const input = z.object({
    userId: z.string().uuid(),
    newPassword: z.string().min(8),
  }).parse(raw)

  await requirePermission({ type: 'auth.admin_reset_password' })

  const passwordHash = await hashPassword(input.newPassword)
  await db.update(users).set({ passwordHash }).where(eq(users.id, input.userId))
  return { ok: true as const }
}
