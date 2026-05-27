'use client'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

export type MyTabId = 'open' | 'pending_review' | 'completed'

const TABS: Array<{ id: MyTabId; label: string }> = [
  { id: 'open', label: 'Open Tasks' },
  { id: 'pending_review', label: 'Pending Review' },
  { id: 'completed', label: 'Completed' },
]

export function MyTasksTabs({ current, counts }: {
  current: MyTabId
  counts: { open: number; pending_review: number; completed: number | null }
}) {
  const params = useSearchParams()
  return (
    <div className="border-b border-zinc-200 flex gap-6 mt-2">
      {TABS.map(t => {
        const next = new URLSearchParams(params)
        next.set('tab', t.id)
        const isActive = t.id === current
        const count = counts[t.id]
        return (
          <Link key={t.id} href={`?${next.toString()}`} scroll={false}
            className={[
              'py-2',
              isActive ? 'border-b-2 border-blue-500 font-semibold text-blue-600' : 'text-zinc-600',
            ].join(' ')}>
            {t.label}{count !== null ? ` (${count})` : ''}
          </Link>
        )
      })}
    </div>
  )
}
