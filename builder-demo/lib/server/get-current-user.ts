import 'server-only'
import { cookies } from 'next/headers'
import { eq } from 'drizzle-orm'
import { db } from '@/db/client'
import { users, type User } from '@/db/schema'
import { SESSION_COOKIE_NAME, verifySessionToken } from '@/lib/auth/session'

async function getDevBypassUser(): Promise<User | null> {
  // Prefer an existing owner; fall back to the first active user; auto-create a dev owner if empty.
  const owners = await db.select().from(users).where(eq(users.role, 'owner')).limit(1)
  if (owners[0]?.isActive) return owners[0]
  const any = await db.select().from(users).limit(1)
  if (any[0]?.isActive) return any[0]
  const [created] = await db.insert(users).values({
    larkOpenId: 'dev_bypass_owner',
    larkTenantKey: 'dev',
    name: 'Dev Owner',
    role: 'owner',
    team: null,
    isActive: true,
  }).returning()
  return created
}

export async function getCurrentUser(): Promise<User | null> {
  if (process.env.DEV_AUTH_BYPASS === 'true') return getDevBypassUser()

  const secret = process.env.AUTH_SECRET
  if (!secret) throw new Error('AUTH_SECRET not set')
  const token = cookies().get(SESSION_COOKIE_NAME)?.value
  if (!token) return null
  let payload
  try {
    payload = await verifySessionToken(token, secret)
  } catch {
    return null
  }
  const rows = await db.select().from(users).where(eq(users.id, payload.userId)).limit(1)
  const user = rows[0]
  if (!user || !user.isActive) return null
  return user
}

export async function requireUser(): Promise<User> {
  const user = await getCurrentUser()
  if (!user) {
    const { redirect } = await import('next/navigation')
    redirect('/login')
  }
  return user!
}
