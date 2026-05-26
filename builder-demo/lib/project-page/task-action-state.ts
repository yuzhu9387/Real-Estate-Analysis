import type { TaskStatus, ProjectStatus } from '@/db/schema'

export type TaskActionId =
  | 'start' | 'submit_review' | 'mark_complete' | 'wont_do' | 'revert'
  | 'approve' | 'request_revision'

export type TaskActionButton = {
  action: TaskActionId
  label: string
}

export type TaskActionState = {
  primary: TaskActionButton | null
  secondary: TaskActionButton | null
  context: string
}

const NONE: TaskActionState = { primary: null, secondary: null, context: 'View only.' }

export function taskActionState(input: {
  task: { ownerId: string; reviewerId: string | null; status: TaskStatus }
  project: { pmId: string; status: ProjectStatus }
  user: { id: string; role: 'owner' | 'pm' | 'ic' }
}): TaskActionState {
  const { task, project, user } = input

  if (project.status === 'archived' || project.status === 'complete') return NONE

  const isOwnerRole = user.role === 'owner'
  const isManagingPm = user.role === 'pm' && project.pmId === user.id
  const isTaskOwner = task.ownerId === user.id
  const isReviewer = task.reviewerId !== null && task.reviewerId === user.id
  const hasReviewer = task.reviewerId !== null

  const acting =
    isTaskOwner ? '' :
    isReviewer ? '' :
    isManagingPm ? ' (acting as PM)' :
    isOwnerRole ? ' (acting as owner)' :
    ''

  const canActAsOwner = isTaskOwner || isManagingPm || isOwnerRole
  const canActAsReviewer = isReviewer || isManagingPm || isOwnerRole

  if (task.status === 'pending_review') {
    if (canActAsReviewer) {
      return {
        primary: { action: 'approve', label: 'Approve' },
        secondary: { action: 'request_revision', label: 'Request Revision' },
        context: `Reviewer view${acting}.`,
      }
    }
    if (canActAsOwner) {
      return {
        primary: null,
        secondary: { action: 'wont_do', label: "Won't do" },
        context: `Waiting on reviewer${acting}.`,
      }
    }
    return NONE
  }

  if (!canActAsOwner) return NONE

  switch (task.status) {
    case 'not_started':
      return {
        primary: { action: 'start', label: 'Start' },
        secondary: { action: 'wont_do', label: "Won't do" },
        context: `Begin work${acting}.`,
      }
    case 'started':
      return {
        primary: hasReviewer
          ? { action: 'submit_review', label: 'Submit for Review' }
          : { action: 'mark_complete', label: 'Mark Complete' },
        secondary: { action: 'wont_do', label: "Won't do" },
        context: hasReviewer ? `Ready for review${acting}.` : `Mark this done${acting}.`,
      }
    case 'approved':
      return {
        primary: { action: 'mark_complete', label: 'Mark Complete' },
        secondary: { action: 'wont_do', label: "Won't do" },
        context: `Approved by reviewer${acting}.`,
      }
    case 'complete':
      return { primary: null, secondary: null, context: `Done${acting}.` }
    case 'wont_do':
      return {
        primary: { action: 'revert', label: 'Revert to Not Started' },
        secondary: null,
        context: `Marked won't do${acting}.`,
      }
    default:
      return NONE
  }
}
