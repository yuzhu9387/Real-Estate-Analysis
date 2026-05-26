import { desc } from 'drizzle-orm'
import { db } from '@/db/client'
import { auditLogs } from '@/db/schema'
import { requireUser } from '@/lib/server/get-current-user'
import { redirect } from 'next/navigation'

export default async function AuditPage() {
  const me = await requireUser()
  if (me.role !== 'owner') redirect('/')
  const list = await db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(200)
  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold">Audit Logs</h1>
      <ul className="space-y-2 text-sm">
        {list.map(a => (
          <li key={a.id} className="rounded border bg-white p-3">
            <div className="font-medium">{a.action}</div>
            <div className="text-xs text-zinc-500">target: {a.targetType}/{a.targetId} — reason: {a.reason}</div>
            <div className="text-xs text-zinc-500">{a.createdAt.toString()}</div>
          </li>
        ))}
      </ul>
    </div>
  )
}
