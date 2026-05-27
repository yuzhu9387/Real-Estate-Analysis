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
  savedAt, onRestore, onDiscard,
}: {
  savedAt: string
  onRestore: () => void
  onDiscard: () => void
}) {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 text-amber-900 text-sm px-3 py-2 mb-3 flex items-center gap-3">
      <span>⚠ You have unsaved edits from {timeAgo(savedAt)}.</span>
      <button onClick={onRestore}
        className="ml-auto px-3 py-1 bg-white border border-amber-300 rounded text-xs hover:bg-amber-100">
        Restore
      </button>
      <button onClick={onDiscard}
        className="px-3 py-1 text-xs text-amber-700 hover:text-amber-900">
        Discard
      </button>
    </div>
  )
}
