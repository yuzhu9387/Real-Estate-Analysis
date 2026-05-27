'use server'
import { z } from 'zod'
import { sql } from 'drizzle-orm'
import { db } from '@/db/client'
import { users } from '@/db/schema'
import { hashPassword } from '@/lib/auth/password'
import { issueSession } from '@/lib/auth/session'

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
