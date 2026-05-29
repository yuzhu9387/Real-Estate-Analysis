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
  const all = await db
    .select({ id: workflowTemplates.id, name: workflowTemplates.name })
    .from(workflowTemplates)
    .where(eq(workflowTemplates.isArchived, false))
    .orderBy(workflowTemplates.name)

  return (
    <div className="space-y-xl max-w-2xl pt-md">
      <Link
        href="/workflows"
        className="inline-flex items-center gap-xs text-body-sm font-semibold text-primary hover:underline"
      >
        <span className="material-symbols-outlined text-[18px]">arrow_back</span>
        Back to Workflow Templates
      </Link>

      <div>
        <h1 className="font-headline-lg text-headline-lg tracking-tight text-on-surface">
          New Workflow Template
        </h1>
        <p className="mt-xs text-body-md text-on-surface-variant">
          Start from scratch or duplicate an existing template as a starting point.
        </p>
      </div>

      <Link
        href="/workflows/new/edit"
        className="group block rounded-xl border border-outline-variant/30 bg-white p-lg shadow-sm hover:border-primary hover:shadow-md transition-all"
      >
        <div className="flex items-start gap-md">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
            <span className="material-symbols-outlined">edit_document</span>
          </div>
          <div className="flex-1">
            <h2 className="font-headline-md text-headline-md text-on-surface group-hover:text-primary transition-colors">
              Start blank
            </h2>
            <p className="mt-xs text-body-sm text-on-surface-variant">
              Begin with an empty editor and build your workflow task-by-task.
            </p>
          </div>
          <span className="material-symbols-outlined text-outline group-hover:text-primary transition-colors">
            chevron_right
          </span>
        </div>
      </Link>

      <DuplicatePicker templates={all} />
    </div>
  )
}
