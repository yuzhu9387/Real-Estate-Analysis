import Link from 'next/link'
import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/server/get-current-user'
import { db } from '@/db/client'
import { listWorkflowTemplates } from '@/db/queries/workflow-templates'
import { WorkflowList } from '@/components/workflows/workflow-list'

export default async function WorkflowsPage() {
  const me = await requireUser()
  if (me.role !== 'owner') redirect('/')

  const items = await listWorkflowTemplates({ includeArchived: true }, db)

  return (
    <div className="space-y-xl max-w-[1240px] pt-md">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-md">
        <div>
          <h1 className="font-headline-lg text-headline-lg tracking-tight text-on-surface">
            Workflow Templates
          </h1>
          <p className="mt-xs text-body-md text-on-surface-variant max-w-2xl">
            Manage reusable workflows for permitting, construction, sales, and project execution.
          </p>
        </div>
        <Link
          href="/workflows/new"
          className="inline-flex items-center gap-xs whitespace-nowrap rounded-lg bg-primary px-md py-sm font-bold text-body-sm text-white shadow-lg shadow-primary/10 hover:brightness-110 active:scale-[0.98] transition-all"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          New Template
        </Link>
      </div>

      <WorkflowList items={items} />
    </div>
  )
}
