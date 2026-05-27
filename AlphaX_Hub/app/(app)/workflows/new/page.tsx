import Link from 'next/link'
import { eq } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/server/get-current-user'
import { db } from '@/db/client'
import { workflowTemplates } from '@/db/schema'
import { DuplicatePicker } from '@/components/workflows/duplicate-picker'

export default async function NewWorkflowPickerPage() {
  const me = await requireUser()
  if (me.role !== 'owner') redirect('/')
  const all = await db.select({ id: workflowTemplates.id, name: workflowTemplates.name })
    .from(workflowTemplates).where(eq(workflowTemplates.isArchived, false)).orderBy(workflowTemplates.name)

  return (
    <div className="space-y-4 max-w-xl">
      <div>
        <Link href="/workflows" className="text-blue-600 text-sm hover:underline">← Back to list</Link>
      </div>
      <h1 className="text-2xl font-semibold">New workflow template</h1>

      <Link href="/workflows/new/edit"
        className="block rounded-lg border border-zinc-200 bg-white p-4 hover:bg-zinc-50">
        <h2 className="font-medium">Start blank</h2>
        <p className="text-sm text-zinc-600 mt-1">Begin with an empty editor.</p>
      </Link>

      <DuplicatePicker templates={all} />
    </div>
  )
}
