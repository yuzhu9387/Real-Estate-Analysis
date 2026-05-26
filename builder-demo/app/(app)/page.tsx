import { db } from '@/db/client'
import { projects } from '@/db/schema'

export default async function DashboardPage() {
  const projectList = await db.select().from(projects)
  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold">Dashboard</h1>
      <p className="text-sm text-slate-600">
        Full Dashboard / Team / Performance Review designs are implemented in a follow-up plan
        (see <code>docs/superpowers/specs/2026-05-25-dashboard-design.md</code>).
        This stub lists raw projects for smoke testing.
      </p>
      <ul className="mt-6 space-y-2">
        {projectList.map(p => (
          <li key={p.id} className="rounded border border-slate-200 bg-white p-3">
            <div className="font-medium">{p.name}</div>
            <div className="text-xs text-slate-500">brand: {p.brand} · status: {p.status} · pmId: {p.pmId}</div>
          </li>
        ))}
      </ul>
    </div>
  )
}
