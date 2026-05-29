import type { BannerCounts } from '@/lib/my-tasks/banner-counts'

export function Banner({ counts }: { counts: BannerCounts }) {
  // Only flag things that need attention; "ready" is the happy default and doesn't deserve a badge.
  if (counts.overdue === 0 && counts.blocked === 0) return null
  return (
    <div className="flex flex-wrap items-center gap-sm">
      {counts.overdue > 0 && (
        <Chip variant="error" icon="error">
          <strong className="font-data-display">{counts.overdue}</strong> overdue
        </Chip>
      )}
      {counts.blocked > 0 && (
        <Chip variant="warn" icon="block">
          <strong className="font-data-display">{counts.blocked}</strong> blocked
        </Chip>
      )}
    </div>
  )
}

function Chip({
  variant,
  icon,
  children,
}: {
  variant: 'error' | 'warn' | 'ok'
  icon: string
  children: React.ReactNode
}) {
  const variants: Record<string, string> = {
    error: 'border-error/20 bg-error/5 text-error',
    warn: 'border-tertiary/30 bg-tertiary/5 text-tertiary',
    ok: 'border-secondary/20 bg-secondary/5 text-secondary',
  }
  return (
    <span
      className={`inline-flex items-center gap-xs h-8 px-sm rounded-full border text-body-sm font-semibold ${variants[variant]}`}
    >
      <span className="material-symbols-outlined text-[16px]">{icon}</span>
      {children}
    </span>
  )
}
