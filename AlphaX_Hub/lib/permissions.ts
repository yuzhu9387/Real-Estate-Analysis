import type { User } from '@/db/schema'

export type ProjectStatus = 'draft' | 'in_progress' | 'complete' | 'archived'
export type Role = 'owner' | 'pm' | 'ic'

export type ProjectContext = { pmId: string; status: ProjectStatus }
export type TaskContext = { ownerId: string; reviewerId: string | null }
export type WorkflowTemplateContext = { createdById: string }

export type Action =
  | { type: 'workflow.create' }
  | { type: 'workflow.update'; workflow: WorkflowTemplateContext }
  | { type: 'workflow.delete'; workflow: WorkflowTemplateContext }
  | { type: 'project.create' }
  | { type: 'project.update_meta'; project: ProjectContext }
  | { type: 'project.update_structure'; project: ProjectContext }
  | { type: 'project.kick_off_phase'; project: ProjectContext }
  | { type: 'project.mark_phase_complete'; project: ProjectContext }
  | { type: 'project.mark_complete'; project: ProjectContext }
  | { type: 'project.archive'; project: ProjectContext }
  | { type: 'project.transfer_pm'; project: ProjectContext }
  | { type: 'project.force_reassign_pm' }
  | { type: 'project.unlock_to_draft' }
  | { type: 'task.add_planned'; project: ProjectContext }
  | { type: 'task.add_unplanned'; project: ProjectContext }
  | { type: 'task.update_structure'; project: ProjectContext }
  | { type: 'task.update_notes'; project: ProjectContext; task: TaskContext }
  | { type: 'task.set_priority'; project: ProjectContext; task: TaskContext }
  | { type: 'task.set_status'; project: ProjectContext; task: TaskContext }
  | { type: 'task.submit_review'; project: ProjectContext; task: TaskContext }
  | { type: 'task.review_decision'; project: ProjectContext; task: TaskContext }
  | { type: 'task.add_subtask'; project: ProjectContext; task: TaskContext }
  | { type: 'task.add_comment'; project: ProjectContext; task: TaskContext }
  | { type: 'task.reassign'; project: ProjectContext; task: TaskContext }
  | { type: 'user.update_role' }
  | { type: 'user.disable' }
  | { type: 'auth.admin_reset_password' }
  | { type: 'audit.view' }

export function can(user: User, action: Action): boolean {
  if (!user.isActive) return false

  const isOwnerRole = user.role === 'owner'
  const isPm = user.role === 'pm' || isOwnerRole

  const managesProject = (p: { pmId: string }) => isOwnerRole || p.pmId === user.id
  const projectIsDraft   = (p: { status: ProjectStatus }) => p.status === 'draft'
  const projectIsActive  = (p: { status: ProjectStatus }) => p.status === 'in_progress'
  const projectMutable   = (p: { status: ProjectStatus }) => p.status !== 'archived' && p.status !== 'complete'
  const taskOwner    = (t: TaskContext) => t.ownerId === user.id
  const taskReviewer = (t: TaskContext) => t.reviewerId === user.id

  switch (action.type) {
    case 'workflow.create':
    case 'workflow.update':
    case 'workflow.delete':
      return isOwnerRole

    case 'project.create':
      return isPm

    case 'project.update_meta':
      return managesProject(action.project) && projectMutable(action.project)

    case 'project.update_structure':
      return managesProject(action.project) && projectIsDraft(action.project)

    case 'project.kick_off_phase':
    case 'project.mark_phase_complete':
      return managesProject(action.project) && projectIsActive(action.project)

    case 'project.mark_complete':
      return managesProject(action.project) && projectIsActive(action.project)

    case 'project.archive':
      return managesProject(action.project) && action.project.status === 'complete'

    case 'project.transfer_pm':
      return managesProject(action.project) && projectMutable(action.project)

    case 'project.force_reassign_pm':
    case 'project.unlock_to_draft':
      return isOwnerRole

    case 'task.add_planned':
      return managesProject(action.project) && projectIsDraft(action.project)

    case 'task.add_unplanned':
      return managesProject(action.project) && projectIsActive(action.project)

    case 'task.update_structure':
      return managesProject(action.project) && projectIsDraft(action.project)

    case 'task.update_notes':
      return projectMutable(action.project) && (managesProject(action.project) || taskOwner(action.task))

    case 'task.set_priority':
      return projectMutable(action.project) && (managesProject(action.project) || taskOwner(action.task))

    case 'task.set_status':
      return projectMutable(action.project) && (managesProject(action.project) || taskOwner(action.task))

    case 'task.submit_review':
      return projectMutable(action.project) && (managesProject(action.project) || taskOwner(action.task))

    case 'task.review_decision':
      return projectMutable(action.project) && (managesProject(action.project) || taskReviewer(action.task))

    case 'task.add_subtask':
      return projectMutable(action.project) && (managesProject(action.project) || taskOwner(action.task))

    case 'task.add_comment':
      return projectMutable(action.project) && (managesProject(action.project) || taskOwner(action.task) || taskReviewer(action.task))

    case 'task.reassign':
      return projectMutable(action.project) && (managesProject(action.project) || taskOwner(action.task))

    case 'user.update_role':
    case 'user.disable':
    case 'auth.admin_reset_password':
    case 'audit.view':
      return isOwnerRole
  }
}
