import Link from 'next/link'
import { Avatar } from '@/components/shared/avatar'
import type { Activity, User } from '@/db/schema'
import { humanizeActivity } from '@/lib/project-page/activity-humanize'

function timeAgo(when: Date): string {
  const diff = Date.now() - when.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  if (hrs < 48) return 'Yesterday'
  return when.toLocaleDateString()
}

export function ActivityItem({
  activity, actor, taskById, projectId,
}: {
  activity: Activity
  actor: User | undefined
  taskById: Map<string, string>
  projectId: string
}) {
  if (!actor) return null
  const h = humanizeActivity({
    type: activity.type,
    payload: activity.payload as Record<string, unknown>,
    actor: { id: actor.id, name: actor.name },
    taskById,
  })
  const body = h.taskId
    ? <Link href={`/projects/${projectId}?task=${h.taskId}`} className="hover:underline">{h.text}</Link>
    : <span>{h.text}</span>

  return (
    <div className="flex items-start gap-3 py-2">
      <Avatar user={actor} size="sm" />
      <div className="flex-1 text-sm">
        <div>{body}</div>
        <div className="text-xs text-zinc-500">{timeAgo(new Date(activity.createdAt))}</div>
      </div>
    </div>
  )
}
