import type { TaskStatus } from '@/db/schema'

export type FlowStage = 'start' | 'submit_review' | 'complete'

export function computeVisibleStages(hasReviewer: boolean): FlowStage[] {
  return hasReviewer
    ? ['start', 'submit_review', 'complete']
    : ['start', 'complete']
}

export function activeStage(
  status: TaskStatus,
  hasReviewer: boolean,
): FlowStage | 'wont_do' | null {
  if (status === 'wont_do') return 'wont_do'
  if (status === 'not_started') return 'start'
  if (status === 'complete') return 'complete'
  if (hasReviewer) {
    if (status === 'started' || status === 'pending_review') return 'submit_review'
    if (status === 'approved') return 'complete'
    return null
  } else {
    if (status === 'started') return 'complete'
    // pending_review / approved unreachable without a reviewer
    return null
  }
}
