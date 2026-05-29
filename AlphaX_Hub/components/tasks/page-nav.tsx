'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'

type Props = {
  projectId: string
  prevTaskId: string | null
  nextTaskId: string | null
}

export function PageNav({ projectId, prevTaskId, nextTaskId }: Props) {
  const [backHref, setBackHref] = useState<string>('/my-tasks')
  const [backLabel, setBackLabel] = useState<string>('Back to My Tasks')

  useEffect(() => {
    const ref = typeof document !== 'undefined' ? document.referrer : ''
    if (!ref || !ref.includes('/my-tasks')) {
      setBackHref(`/projects/${projectId}`)
      setBackLabel('Back to Project')
    }
  }, [projectId])

  return (
    <div className="flex items-center justify-between mb-6">
      <Link
        href={backHref}
        className="inline-flex items-center gap-2 text-body-sm text-on-surface-variant hover:text-on-background"
      >
        <span className="material-symbols-outlined text-[20px]">arrow_back</span>
        {backLabel}
      </Link>

      <div className="flex items-center gap-2 text-body-sm">
        {prevTaskId ? (
          <Link
            href={`/tasks/${prevTaskId}`}
            className="inline-flex items-center gap-1 text-on-surface-variant hover:text-on-background"
          >
            <span className="material-symbols-outlined text-[20px]">chevron_left</span>
            Previous
          </Link>
        ) : (
          <span className="inline-flex items-center gap-1 text-outline" aria-disabled>
            <span className="material-symbols-outlined text-[20px]">chevron_left</span>
            Previous
          </span>
        )}

        <span className="text-outline">|</span>

        {nextTaskId ? (
          <Link
            href={`/tasks/${nextTaskId}`}
            className="inline-flex items-center gap-1 text-on-surface-variant hover:text-on-background"
          >
            Next
            <span className="material-symbols-outlined text-[20px]">chevron_right</span>
          </Link>
        ) : (
          <span className="inline-flex items-center gap-1 text-outline" aria-disabled>
            Next
            <span className="material-symbols-outlined text-[20px]">chevron_right</span>
          </span>
        )}
      </div>
    </div>
  )
}
