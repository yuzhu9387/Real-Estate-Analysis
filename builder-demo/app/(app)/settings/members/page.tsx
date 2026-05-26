import { db } from '@/db/client'
import { users } from '@/db/schema'
import { requireUser } from '@/lib/server/get-current-user'
import { redirect } from 'next/navigation'

export default async function MembersPage() {
  const me = await requireUser()
  if (me.role !== 'owner') redirect('/')
  const list = await db.select().from(users)
  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold">Members</h1>
      <table className="w-full text-sm">
        <thead><tr className="text-left"><th>Name</th><th>Role</th><th>Team</th><th>Active</th></tr></thead>
        <tbody>
          {list.map(u => (
            <tr key={u.id} className="border-t">
              <td>{u.name}</td><td>{u.role}</td><td>{u.team ?? '—'}</td><td>{u.isActive ? 'yes' : 'no'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-4 text-sm text-zinc-600">Edit UI follows in a follow-up plan; for now use server actions in <code>app/actions/users.ts</code>.</p>
    </div>
  )
}
