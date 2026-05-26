'use client'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

const TABS = [
  { id: 'permitting', label: 'Permitting' },
  { id: 'construction', label: 'Construction' },
  { id: 'sale', label: 'Sale' },
  { id: 'activity', label: 'Activity', separate: true },
] as const

export type TabId = typeof TABS[number]['id']

export function Tabs({ current }: { current: TabId }) {
  const params = useSearchParams()
  return (
    <div className="border-b border-zinc-200 flex gap-6 mt-4">
      {TABS.map((t) => {
        const next = new URLSearchParams(params)
        next.set('tab', t.id)
        const isActive = t.id === current
        return (
          <Link
            key={t.id}
            href={`?${next.toString()}`}
            className={[
              'py-2',
              isActive ? 'border-b-2 border-blue-500 font-semibold text-blue-600' : 'text-zinc-600',
              t.separate ? 'ml-auto border-l border-zinc-200 pl-4' : '',
            ].join(' ')}
            scroll={false}
          >
            {t.label}
          </Link>
        )
      })}
    </div>
  )
}
