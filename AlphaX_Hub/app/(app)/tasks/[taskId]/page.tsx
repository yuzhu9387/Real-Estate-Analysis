import { notFound } from 'next/navigation'
import { requireUser } from '@/lib/server/get-current-user'
import { db } from '@/db/client'
import { getTaskDetail } from '@/db/queries/task-detail'
import { TaskDetailScreen } from '@/components/tasks/task-detail-screen'

export default async function TaskDetailPage({
  params,
}: { params: { taskId: string } }) {
  const me = await requireUser()
  const detail = await getTaskDetail(params.taskId, db)
  if (!detail) notFound()
  return <TaskDetailScreen me={me} detail={detail} />
}
