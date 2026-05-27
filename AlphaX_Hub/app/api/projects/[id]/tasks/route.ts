import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { getCurrentUser } from '@/lib/server/get-current-user'
import { db } from '@/db/client'
import { tasks } from '@/db/schema'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const me = await getCurrentUser()
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const rows = await db.select({
    id: tasks.id, name: tasks.name, projectWorkflowId: tasks.projectWorkflowId,
  }).from(tasks).where(eq(tasks.projectId, params.id))
  return NextResponse.json({ tasks: rows })
}
