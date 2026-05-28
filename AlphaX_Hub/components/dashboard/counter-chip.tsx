'use client'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

export type CounterFilter = 'active' | 'at_risk' | 'under_permitting' | 'under_construction' | 'on_sale'

type Accent = 'primary' | 'error' | 'neutral' | 'secondary' | 'sale'

type AccentConfig = {
  number: string
  icon: string
  dot: string
  hoverBorder: string
}

const ACCENTS: Record<Accent, AccentConfig> = {
  primary: {
    number: 'text-primary',
    icon: 'text-secondary',
    dot: 'bg-primary active-glow',
    hoverBorder: 'hover:border-primary/40',
  },
  error: {
    number: 'text-error',
    icon: 'text-error',
    dot: 'bg-error',
    hoverBorder: 'hover:border-error/40',
  },
  neutral: {
    number: 'text-on-surface',
    icon: 'text-outline',
    dot: 'bg-outline-variant',
    hoverBorder: '',
  },
  secondary: {
    number: 'text-secondary',
    icon: 'text-secondary',
    dot: 'bg-secondary',
    hoverBorder: '',
  },
  sale: {
    number: 'text-on-surface',
    icon: 'text-outline',
    dot: 'bg-primary/40',
    hoverBorder: '',
  },
}

export function CounterChip({
  filter,
  label,
  count,
  icon,
  caption,
  accent = 'neutral',
}: {
  filter: CounterFilter
  label: string
  count: number
  icon: string
  caption: string
  accent?: Accent
}) {
  const params = useSearchParams()
  const isActive = params.get('filter') === filter
  const next = new URLSearchParams(params)
  if (isActive) next.delete('filter')
  else next.set('filter', filter)

  const a = ACCENTS[accent]
  const formatted = count.toString().padStart(2, '0')

  return (
    <Link
      href={`?${next.toString()}`}
      className={[
        'glacier-panel p-lg rounded-xl relative overflow-hidden group transition-all cursor-pointer',
        a.hoverBorder,
        isActive ? 'ring-2 ring-primary/60' : '',
      ].join(' ')}
    >
      <div className="flex flex-col">
        <span className="text-label-caps font-label-caps text-outline mb-sm tracking-widest">
          {label}
        </span>
        <div className="flex items-baseline gap-sm">
          <span className={`font-data-display text-data-display ${a.number}`}>{formatted}</span>
          <span className={`material-symbols-outlined text-sm ${a.icon}`}>{icon}</span>
        </div>
        <div className="mt-md flex items-center gap-xs">
          <div className={`w-1.5 h-1.5 rounded-full ${a.dot}`} />
          <span className="text-[11px] text-on-surface-variant uppercase">{caption}</span>
        </div>
      </div>
    </Link>
  )
}
