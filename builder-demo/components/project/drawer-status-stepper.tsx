import type { TaskStatus } from '@/db/schema'

const STAGES = [
  { id: 'not_started', label: 'Not started' },
  { id: 'started', label: 'Started' },
  { id: 'pending_review', label: 'In review' },
  { id: 'approved', label: 'Approved' },
  { id: 'complete', label: 'Complete' },
] as const

export function DrawerStatusStepper({
  status, hasReviewer,
}: { status: TaskStatus; hasReviewer: boolean }) {
  if (status === 'wont_do') {
    return <div className="rounded bg-zinc-100 text-zinc-700 text-xs px-2 py-1 text-center">Won't do</div>
  }

  const visibleStages = hasReviewer
    ? STAGES
    : STAGES.filter(s => s.id !== 'pending_review' && s.id !== 'approved')
  const currentIdx = visibleStages.findIndex(s => s.id === status)

  return (
    <div className="flex items-center text-[10px] text-zinc-500 gap-0">
      {visibleStages.map((s, i) => {
        const isPast = i < currentIdx
        const isCurrent = i === currentIdx
        const dotClass = isCurrent
          ? 'w-4 h-4 rounded-full border-2 border-blue-500 bg-white ring-2 ring-blue-100'
          : isPast
            ? 'w-3 h-3 rounded-full bg-emerald-500 border-2 border-emerald-500'
            : 'w-3 h-3 rounded-full border-2 border-zinc-300'
        return (
          <div key={s.id} className="flex-1 flex flex-col items-center">
            <div className="flex items-center w-full">
              {i > 0 && <div className={`flex-1 h-0.5 ${isPast || isCurrent ? 'bg-emerald-500' : 'bg-zinc-200'}`} />}
              <div className={dotClass} />
              {i < visibleStages.length - 1 && <div className={`flex-1 h-0.5 ${i < currentIdx ? 'bg-emerald-500' : 'bg-zinc-200'}`} />}
            </div>
            <div className={`mt-1 ${isCurrent ? 'text-blue-600 font-semibold' : ''}`}>{s.label}</div>
          </div>
        )
      })}
    </div>
  )
}
