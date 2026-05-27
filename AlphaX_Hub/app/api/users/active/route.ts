import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { getCurrentUser } from '@/lib/server/get-current-user'
import { db } from '@/db/client'
import { users } from '@/db/schema'

export async function GET() {
  const me = await getCurrentUser()
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const list = await db.select({ id: users.id, name: users.name }).from(users).where(eq(users.isActive, true))
  return NextResponse.json({ users: list })
}
