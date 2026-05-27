import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/server/get-current-user'
import { EditorShell } from '@/components/workflows/editor-shell'

export default async function NewWorkflowEditorPage() {
  const me = await requireUser()
  if (me.role !== 'owner') redirect('/')
  return (
    <EditorShell
      mode="new"
      templateId={null}
      initial={{
        name: '', description: '', tasks: [], deps: [],
        savedAt: new Date().toISOString(),
      }}
      serverUpdatedAt={null}
      isArchived={false}
    />
  )
}
