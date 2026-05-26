import { eq } from 'drizzle-orm'
import { requireUser } from '@/lib/server/get-current-user'
import { db } from '@/db/client'
import { tasks } from '@/db/schema'

export default async function MyTasksPage() {
  const user = await requireUser()
  const mine = await db.select().from(tasks).where(eq(tasks.ownerId, user.id))
  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold">My Tasks</h1>
      <p className="mb-4 text-sm text-slate-600">
        Full My Tasks UI (LLM ranking, daily reminders, three tabs) is a follow-up spec.
      </p>
      <ul className="space-y-2">
        {mine.map(t => (
          <li key={t.id} className="rounded border bg-white p-3">
            <div className="font-medium">{t.name}</div>
            <div className="text-xs text-slate-500">{t.status}{t.isBlocked && ' · blocked'}</div>
          </li>
        ))}
      </ul>
    </div>
  )
}
