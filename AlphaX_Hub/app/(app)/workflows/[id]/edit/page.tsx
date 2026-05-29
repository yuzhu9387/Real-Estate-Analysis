import { eq } from 'drizzle-orm'
import { notFound, redirect } from 'next/navigation'
import { requireUser } from '@/lib/server/get-current-user'
import { db } from '@/db/client'
import { workflowTemplates, workflowTemplateTasks, workflowTemplateTaskDeps } from '@/db/schema'
import { EditorShell } from '@/components/workflows/editor-shell'

export default async function EditWorkflowPage({ params }: { params: { id: string } }) {
  const me = await requireUser()
  if (me.role !== 'owner') redirect('/')

  const tpl = (await db.select().from(workflowTemplates).where(eq(workflowTemplates.id, params.id)))[0]
  if (!tpl) notFound()
  const tasks = await db.select().from(workflowTemplateTasks).where(eq(workflowTemplateTasks.workflowTemplateId, tpl.id))
  const deps = await db.select().from(workflowTemplateTaskDeps).where(eq(workflowTemplateTaskDeps.workflowTemplateId, tpl.id))

  return (
    <EditorShell
      mode="edit"
      templateId={tpl.id}
      isArchived={tpl.isArchived}
      serverUpdatedAt={tpl.updatedAt.toISOString()}
      initial={{
        name: tpl.name,
        description: tpl.description ?? '',
        productType: tpl.productType ?? null,
        tasks: tasks.sort((a, b) => a.sortOrder - b.sortOrder).map(t => ({
          id: t.id,
          name: t.name,
          description: t.description ?? '',
          startDay: t.defaultStartDay,
          endDay: t.defaultEndDay,
          ownerRoleLabel: t.defaultOwnerRoleLabel ?? '',
          sortOrder: t.sortOrder,
        })),
        deps: deps.map(d => ({
          id: d.id, fromTaskId: d.fromTaskId, toTaskId: d.toTaskId, lagDays: d.lagDays,
        })),
        savedAt: tpl.updatedAt.toISOString(),
      }}
    />
  )
}
