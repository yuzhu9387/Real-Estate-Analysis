'use client'
import { useState } from 'react'
import { usePermissions } from '@/lib/hooks/use-permissions'
import type { Project } from '@/db/schema'
import { EditMetadataDialog } from './edit-metadata-dialog'

export function EditMetadataButton({ project }: { project: Project }) {
  const [open, setOpen] = useState(false)
  const { can } = usePermissions()
  if (!can({ type: 'project.update_meta', project: { pmId: project.pmId, status: project.status } })) return null
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="bg-white text-zinc-700 border border-zinc-300 px-3 py-1 rounded text-xs hover:bg-zinc-50"
      >
        Edit
      </button>
      {open && <EditMetadataDialog project={project} onClose={() => setOpen(false)} />}
    </>
  )
}
