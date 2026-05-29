'use client'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

export type MyTabId = 'open' | 'pending_review' | 'completed'

const TABS: Array<{ id: MyTabId; label: string }> = [
  { id: 'open', label: 'My Tasks' },
  { id: 'pending_review', label: 'Under Review' },
  { id: 'completed', label: 'Completed' },
]

export function MyTasksTabs({
  current,
  counts,
}: {
  current: MyTabId
  counts: { open: number; pending_review: number; completed: number | null }
}) {
  const params = useSearchParams()

  return (
    <div className="flex items-center gap-xs border-b border-outline-variant/30">
      {TABS.map((t) => {
        const next = new URLSearchParams(params)
        next.set('tab', t.id)
        // Reset Kanban view if switching to a non-Open tab.
        if (t.id !== 'open') next.delete('view')
        const isActive = t.id === current
        const count = counts[t.id]
        return (
          <Link
            key={t.id}
            href={`?${next.toString()}`}
            scroll={false}
            className={[
              'inline-flex items-center gap-xs h-12 px-md text-body-md font-bold border-b-2 transition-colors',
              isActive
                ? 'text-primary border-primary'
                : 'text-on-surface-variant border-transparent hover:text-on-surface',
            ].join(' ')}
          >
            {t.label}
            {count !== null && (
              <span
                className={[
                  'inline-flex items-center justify-center min-w-[22px] h-[20px] px-xs rounded-full text-[11px] font-bold',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'bg-surface-container text-on-surface-variant',
                ].join(' ')}
              >
                {count}
              </span>
            )}
          </Link>
        )
      })}
    </div>
  )
}
