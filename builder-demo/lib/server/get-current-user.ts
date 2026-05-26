import 'server-only'
import { cookies } from 'next/headers'
import { eq } from 'drizzle-orm'
import { db } from '@/db/client'
import { users, type User } from '@/db/schema'
import { SESSION_COOKIE_NAME, verifySessionToken } from '@/lib/auth/session'

export async function getCurrentUser(): Promise<User | null> {
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
