import { eq, inArray, asc } from 'drizzle-orm'
import { notFound, redirect } from 'next/navigation'
import { requireUser } from '@/lib/server/get-current-user'
import { db } from '@/db/client'
import { projects, users } from '@/db/schema'
import { ProjectForm, type ProjectFormInitial } from '@/components/projects/project-form'

export default async function EditProjectPage({ params }: { params: { id: string } }) {
  const me = await requireUser()
  if (me.role !== 'pm' && me.role !== 'owner') redirect('/')

  const project = (await db.select().from(projects).where(eq(projects.id, params.id)))[0]
  if (!project) notFound()

  // Only the PM of this project + owners can edit it. (The action also enforces this.)
  if (me.role !== 'owner' && project.pmId !== me.id) redirect(`/projects/${project.id}`)

  const pmCandidates = await db
    .select({ id: users.id, name: users.name, role: users.role, team: users.team })
    .from(users)
    .where(inArray(users.role, ['pm', 'owner']))
    .orderBy(asc(users.name))

  const initial: ProjectFormInitial = {
    id: project.id,
    status: project.status,
    name: project.name,
    brand: project.brand,
    address: project.address ?? '',
    city: project.city ?? '',
    state: project.state ?? '',
    zip: project.zip ?? '',
    titleHolder: project.titleHolder ?? '',
    projectStrategy: project.projectStrategy ?? '',
    purchaseDate: project.purchaseDate ?? '',
    purchasePrice: project.purchasePrice ?? '',
    targetStartDate: project.targetStartDate ?? '',
    targetPermittingDurationDays:
      project.targetPermittingDurationDays != null ? String(project.targetPermittingDurationDays) : '',
    targetConstructionDurationDays:
      project.targetConstructionDurationDays != null ? String(project.targetConstructionDurationDays) : '',
    targetSalesDurationDays:
      project.targetSalesDurationDays != null ? String(project.targetSalesDurationDays) : '',
    pmId: project.pmId,
    permittingPmId: project.permittingPmId ?? '',
    constructionPmId: project.constructionPmId ?? '',
    salesPmId: project.salesPmId ?? '',
  }

  return (
    <ProjectForm
      mode="edit"
      initial={initial}
      templates={[]}
      users={pmCandidates}
      currentUserId={me.id}
    />
  )
}
