'use client'
import Link from 'next/link'
import { usePermissions } from '@/lib/hooks/use-permissions'
import type { Project } from '@/db/schema'

/**
 * "Edit" affordance on the project page header. Navigates to /projects/{id}/edit which is the
 * shared ProjectForm in edit mode — same page (and same layout) as /projects/new.
 *
 * The old in-place dialog has been retired in favor of a full-page form so users see all three
 * sections (Property / Schedule / Team) and the auto-cascaded target dates at once.
 */
export function EditMetadataButton({ project }: { project: Project }) {
  const { can } = usePermissions()
  if (!can({ type: 'project.update_meta', project: { pmId: project.pmId, status: project.status } })) return null
  return (
    <Link
      href={`/projects/${project.id}/edit`}
      className="inline-flex h-8 items-center gap-xs rounded-lg border border-outline-variant/40 bg-white px-sm text-body-sm font-semibold text-on-surface-variant hover:border-primary hover:text-primary transition-colors"
    >
      <span className="material-symbols-outlined text-[16px]">edit</span>
      Edit
    </Link>
  )
}
