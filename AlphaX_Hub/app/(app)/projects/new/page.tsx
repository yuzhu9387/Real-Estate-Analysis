import Link from 'next/link'
import { eq } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/server/get-current-user'
import { db } from '@/db/client'
import { workflowTemplates } from '@/db/schema'
import { NewProjectForm } from '@/components/projects/new-project-form'

export default async function NewProjectPage() {
  const me = await requireUser()
  if (me.role !== 'pm' && me.role !== 'owner') redirect('/')

  const templates = await db.select({
    id: workflowTemplates.id,
    name: workflowTemplates.name,
  }).from(workflowTemplates)
    .where(eq(workflowTemplates.isArchived, false))
    .orderBy(workflowTemplates.name)

  if (templates.length === 0) {
    return (
      <div className="space-y-4 max-w-2xl">
        <h1 className="text-2xl font-semibold">New Project</h1>
        <div className="rounded-lg border border-dashed border-zinc-200 bg-white p-12 text-center text-zinc-500 text-sm">
          No workflow templates exist yet. The owner needs to create one before projects can be added.
          <div className="mt-4">
            <Link href="/workflows" className="text-blue-600 hover:underline">Go to Workflow Templates →</Link>
          </div>
        </div>
      </div>
    )
  }

  return <NewProjectForm templates={templates} />
}
