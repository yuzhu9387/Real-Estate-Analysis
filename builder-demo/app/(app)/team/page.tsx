import { db } from '@/db/client'
import { users } from '@/db/schema'

export default async function TeamPage() {
  const list = await db.select().from(users)
  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold">Team</h1>
      <p className="mb-4 text-sm text-slate-600">
        Full Team view is in the dashboard spec.
      </p>
      <ul className="space-y-2">
        {list.map(u => (
          <li key={u.id} className="rounded border bg-white p-3">
            {u.name} — {u.role} — team: {u.team ?? '(none)'}
          </li>
        ))}
      </ul>
    </div>
  )
}
