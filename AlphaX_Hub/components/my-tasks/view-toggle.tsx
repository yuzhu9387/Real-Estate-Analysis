'use client'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

export type ViewMode = 'list' | 'kanban'

export function ViewToggle({ current }: { current: ViewMode }) {
  const params = useSearchParams()

  function hrefFor(mode: ViewMode): string {
    const next = new URLSearchParams(params)
    if (mode === 'list') next.delete('view')
    else next.set('view', mode)
    return `?${next.toString()}`
  }

  return (
    <div className="inline-flex items-center rounded-lg border border-outline-variant/40 bg-white p-[2px] gap-[2px]">
      <ToggleLink href={hrefFor('list')} active={current === 'list'} icon="view_list">
        List
      </ToggleLink>
      <ToggleLink href={hrefFor('kanban')} active={current === 'kanban'} icon="view_kanban">
        Kanban
      </ToggleLink>
    </div>
  )
}

function ToggleLink({
  href,
  active,
  icon,
  children,
}: {
  href: string
  active: boolean
  icon: string
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      scroll={false}
      className={[
        'inline-flex items-center gap-xs h-8 px-sm rounded-md text-body-sm font-bold transition-colors',
        active
          ? 'bg-primary/10 text-primary'
          : 'text-on-surface-variant hover:text-on-surface',
      ].join(' ')}
    >
      <span className="material-symbols-outlined text-[16px]">{icon}</span>
      {children}
    </Link>
  )
}
