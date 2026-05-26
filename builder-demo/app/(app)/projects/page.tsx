import { db } from '@/db/client'
import { projects } from '@/db/schema'

export default async function ProjectsPage() {
  const list = await db.select().from(projects)
  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold">Projects</h1>
      <p className="mb-4 text-sm text-slate-600">
        Full project page UI is in a follow-up spec.
      </p>
      <ul className="space-y-2">
        {list.map(p => (
          <li key={p.id} className="rounded border bg-white p-3">
            <a href={`/projects/${p.id}`}>{p.name}</a>
          </li>
        ))}
      </ul>
    </div>
  )
}
