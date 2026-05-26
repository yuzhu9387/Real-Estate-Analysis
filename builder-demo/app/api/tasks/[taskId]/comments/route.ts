import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/server/get-current-user'
import { db } from '@/db/client'
import { getTaskComments } from '@/db/queries/project-page'

export async function GET(_req: Request, { params }: { params: { taskId: string } }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { comments, users } = await getTaskComments(db, params.taskId)
  return NextResponse.json({ comments, users })
}
