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
  | { type: 'task.set_status'; project: ProjectContext; task: TaskContext }
  | { type: 'task.submit_review'; project: ProjectContext; task: TaskContext }
  | { type: 'task.review_decision'; project: ProjectContext; task: TaskContext }
  | { type: 'task.add_subtask'; project: ProjectContext; task: TaskContext }
  | { type: 'task.add_comment'; project: ProjectContext; task: TaskContext }
  | { type: 'task.reassign'; project: ProjectContext; task: TaskContext }
  | { type: 'user.update_role' }
  | { type: 'user.disable' }
  | { type: 'audit.view' }

export function can(_user: User, _action: Action): boolean {
  return false   // implemented in next step (Task 4.3)
}
