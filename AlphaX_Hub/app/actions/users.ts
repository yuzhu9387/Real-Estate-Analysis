'use server'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { eq, ne, and } from 'drizzle-orm'
import { db } from '@/db/client'
import { users } from '@/db/schema'
import { requirePermission } from '@/lib/server/require-permission'
import { ValidationError, NotFoundError } from '@/lib/server/errors'
import { requireUser } from '@/lib/server/get-current-user'

export async function updateUserRole(raw: unknown) {
  const input = z.object({
    userId: z.string().uuid(),
    role: z.enum(['owner', 'pm', 'ic']),
  }).parse(raw)
  await requirePermission({ type: 'user.update_role' })

  if (input.role !== 'owner') {
    const otherOwners = await db.select().from(users)
      .where(and(eq(users.role, 'owner'), eq(users.isActive, true), ne(users.id, input.userId)))
    if (otherOwners.length === 0) {
      throw new ValidationError('Cannot demote the last active owner')
    }
  }
  const updated = await db.update(users).set({ role: input.role }).where(eq(users.id, input.userId)).returning()
  if (updated.length === 0) throw new NotFoundError('User')
  revalidatePath('/settings/members')
  return { ok: true }
}

export async function updateUserTeam(raw: unknown) {
  const input = z.object({
    userId: z.string().uuid(),
    team: z.enum(['design','construction','sales']).nullable(),
  }).parse(raw)
  await requirePermission({ type: 'user.update_role' })
  await db.update(users).set({ team: input.team }).where(eq(users.id, input.userId))
  revalidatePath('/settings/members')
  return { ok: true }
}

export async function setUserActive(raw: unknown) {
  const input = z.object({ userId: z.string().uuid(), isActive: z.boolean() }).parse(raw)
  await requirePermission({ type: 'user.disable' })
  if (!input.isActive) {
    const target = (await db.select().from(users).where(eq(users.id, input.userId)))[0]
    if (target?.role === 'owner') {
      const otherOwners = await db.select().from(users)
        .where(and(eq(users.role, 'owner'), eq(users.isActive, true), ne(users.id, input.userId)))
      if (otherOwners.length === 0) throw new ValidationError('Cannot disable the last active owner')
    }
  }
  await db.update(users).set({ isActive: input.isActive }).where(eq(users.id, input.userId))
  revalidatePath('/settings/members')
  return { ok: true }
}

export async function setLarkDigestOptOut(raw: unknown) {
  const input = z.object({ optedOut: z.boolean() }).parse(raw)
  const user = await requireUser()
  await db.update(users).set({ larkDigestOptedOut: input.optedOut }).where(eq(users.id, user.id))
  revalidatePath('/settings/me')
  return { ok: true }
}
