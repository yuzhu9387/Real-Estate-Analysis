'use client'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

export type CounterFilter = 'active' | 'at_risk' | 'under_permitting' | 'under_construction'

export function CounterChip({
  filter, label, count, accent,
}: { filter: CounterFilter; label: string; count: number; accent?: 'red' }) {
  const params = useSearchParams()
  const isActive = params.get('filter') === filter
  const next = new URLSearchParams(params)
  if (isActive) next.delete('filter')
  else next.set('filter', filter)
  return (
    <Link
      href={`?${next.toString()}`}
      className={[
        'flex flex-col rounded-xl border px-4 py-3',
        isActive ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white',
      ].join(' ')}
    >
      <span className={['text-2xl font-semibold', accent === 'red' ? 'text-red-600' : ''].join(' ')}>{count}</span>
      <span className="text-xs text-slate-600">{label}</span>
    </Link>
  )
}
