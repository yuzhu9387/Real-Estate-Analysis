import type { BannerCounts } from '@/lib/my-tasks/banner-counts'

export function Banner({ counts }: { counts: BannerCounts }) {
  const parts: string[] = []
  if (counts.overdue > 0) parts.push(`🔴 ${counts.overdue} overdue`)
  if (counts.blocked > 0) parts.push(`🟠 ${counts.blocked} blocked`)
  if (counts.ready > 0)   parts.push(`🟢 ${counts.ready} ready`)
  if (parts.length === 0) return null
  return (
    <div className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm">
      {parts.join(' · ')}
    </div>
  )
}
