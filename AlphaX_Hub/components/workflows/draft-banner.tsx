'use client'
function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diffMs / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return new Date(iso).toLocaleString()
}

export function DraftBanner({
  savedAt,
  onRestore,
  onDiscard,
}: {
  savedAt: string
  onRestore: () => void
  onDiscard: () => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-sm rounded-xl border border-secondary/30 bg-secondary/5 px-md py-sm text-body-sm text-on-surface mb-md">
      <span className="material-symbols-outlined text-secondary">history</span>
      <span>
        You have unsaved edits from <strong>{timeAgo(savedAt)}</strong>.
      </span>
      <div className="ml-auto flex items-center gap-xs">
        <button
          type="button"
          onClick={onRestore}
          className="inline-flex h-8 items-center gap-xs rounded-lg border border-outline-variant/40 bg-white px-sm text-body-sm font-semibold text-on-surface hover:border-primary hover:text-primary transition-colors"
        >
          Restore
        </button>
        <button
          type="button"
          onClick={onDiscard}
          className="px-xs text-body-sm text-on-surface-variant hover:text-on-surface"
        >
          Discard
        </button>
      </div>
    </div>
  )
}
