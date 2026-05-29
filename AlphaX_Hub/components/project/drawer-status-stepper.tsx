import type { TaskStatus } from '@/db/schema'
import { computeVisibleStages, type FlowStage } from '@/lib/tasks/status-flow'

const STAGE_LABEL: Record<FlowStage, string> = {
  start: 'Not started',
  submit_review: 'In review',
  complete: 'Complete',
}

// Drawer stepper uses the legacy 5-dot strip (Not started → Started → In review → Approved → Complete with reviewer)
// rather than the new 3-bucket model. Keep the legacy stages here; the shared FlowStage applies only to the
// new full-page widget. This refactor extracts the helper for the page widget without changing drawer behavior.
const LEGACY_STAGES_WITH_REVIEWER = [
  { id: 'not_started', label: 'Not started' },
  { id: 'started', label: 'Started' },
  { id: 'pending_review', label: 'In review' },
  { id: 'approved', label: 'Approved' },
  { id: 'complete', label: 'Complete' },
] as const

const LEGACY_STAGES_WITHOUT_REVIEWER = [
  { id: 'not_started', label: 'Not started' },
  { id: 'started', label: 'Started' },
  { id: 'complete', label: 'Complete' },
] as const

export function DrawerStatusStepper({
  status, hasReviewer,
}: { status: TaskStatus; hasReviewer: boolean }) {
  if (status === 'wont_do') {
    return <div className="rounded bg-zinc-100 text-zinc-700 text-xs px-2 py-1 text-center">Won&apos;t do</div>
  }

  const visibleStages = hasReviewer ? LEGACY_STAGES_WITH_REVIEWER : LEGACY_STAGES_WITHOUT_REVIEWER
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

// Re-export so the legacy stepper's hasReviewer-derived stage count is visible to anyone importing.
export { computeVisibleStages, STAGE_LABEL }
