import Link from 'next/link'
import { eq, inArray, asc } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/server/get-current-user'
import { db } from '@/db/client'
import { workflowTemplates, users } from '@/db/schema'
import { ProjectForm, type ProjectFormInitial } from '@/components/projects/project-form'

export default async function NewProjectPage() {
  const me = await requireUser()
  if (me.role !== 'pm' && me.role !== 'owner') redirect('/')

  const [templates, pmCandidates] = await Promise.all([
    db.select({ id: workflowTemplates.id, name: workflowTemplates.name })
      .from(workflowTemplates)
      .where(eq(workflowTemplates.isArchived, false))
      .orderBy(workflowTemplates.name),
    db.select({ id: users.id, name: users.name, role: users.role, team: users.team })
      .from(users)
      .where(inArray(users.role, ['pm', 'owner']))
      .orderBy(asc(users.name)),
  ])

  if (templates.length === 0) {
    return (
      <div className="space-y-md max-w-2xl pt-md">
        <h1 className="font-headline-lg text-headline-lg tracking-tight text-on-surface">New Project</h1>
        <div className="rounded-xl border border-dashed border-outline-variant/40 bg-white p-xl text-center text-body-sm text-on-surface-variant">
          No workflow templates exist yet. The owner needs to create one before projects can be added.
          <div className="mt-md">
            <Link href="/workflows" className="text-primary font-semibold hover:underline">
              Go to Workflow Templates →
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const initial: ProjectFormInitial = {
    name: '',
    brand: 'al_homes',
    address: '', city: '', state: '', zip: '',
    titleHolder: '', projectStrategy: '',
    purchaseDate: '', purchasePrice: '',
    targetStartDate: '',
    targetPermittingDurationDays: '',
    targetConstructionDurationDays: '',
    targetSalesDurationDays: '',
    pmId: me.id,
    permittingPmId: '', constructionPmId: '', salesPmId: '',
  }

  return (
    <ProjectForm
      mode="create"
      initial={initial}
      templates={templates}
      users={pmCandidates}
      currentUserId={me.id}
    />
  )
}
