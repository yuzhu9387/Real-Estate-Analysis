import { db } from '@/db/client'
import { getProjectActivities } from '@/db/queries/project-page'
import { ActivityItem } from './activity-item'

export async function ActivityFeed({ projectId }: { projectId: string }) {
  const data = await getProjectActivities(db, projectId, 100)
  const actorById = new Map(data.users.map(u => [u.id, u]))
  const taskById = new Map(data.tasks.map(t => [t.id, t.name]))

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-3">
      <div className="text-xs uppercase text-zinc-600 mb-2">Activity (recent 100)</div>
      {data.activities.length === 0 ? (
        <div className="p-4 text-sm text-zinc-500">No activity yet.</div>
      ) : (
        <div className="divide-y divide-zinc-100">
          {data.activities.map(a => (
            <ActivityItem
              key={a.id}
              activity={a}
              actor={actorById.get(a.actorId)}
              taskById={taskById}
              projectId={projectId}
            />
          ))}
        </div>
      )}
    </div>
  )
}
