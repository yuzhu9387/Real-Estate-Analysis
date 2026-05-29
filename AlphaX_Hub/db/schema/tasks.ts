import { pgTable, uuid, text, integer, boolean, timestamp, date, AnyPgColumn } from 'drizzle-orm/pg-core'
import { projects } from './projects'
import { projectWorkflows } from './project_workflows'
import { users } from './users'
import { workflowTemplates } from './workflow_templates'
import { workflowTemplateTasks } from './workflow_template_tasks'

export const tasks = pgTable('tasks', {
  id: uuid('id').defaultRandom().primaryKey(),
  // Nullable since tasks can be "personal" — created from the My Tasks Quick Add without a project.
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }),
  projectWorkflowId: uuid('project_workflow_id').references(() => projectWorkflows.id, { onDelete: 'cascade' }),
  parentTaskId: uuid('parent_task_id').references((): AnyPgColumn => tasks.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  ownerId: uuid('owner_id').notNull().references(() => users.id),
  reviewerId: uuid('reviewer_id').references(() => users.id),
  plannedDurationDays: integer('planned_duration_days').notNull(),
  plannedStartDay: integer('planned_start_day'),
  plannedEndDay: integer('planned_end_day'),
  actualStartDay: integer('actual_start_day'),
  actualEndDay: integer('actual_end_day'),
  // Calendar-date materializations.
  //   target_*_date  — materialized at project kickoff from project.kickedOffAt + planned_*_day.
  //   actual_*_date  — written when the owner clicks Start (status -> started) and
  //                    Complete (status -> complete / wont_do).
  targetStartDate: date('target_start_date'),
  targetEndDate: date('target_end_date'),
  actualStartDate: date('actual_start_date'),
  actualEndDate: date('actual_end_date'),
  status: text('status', { enum: ['not_started','started','pending_review','approved','complete','wont_do'] }).notNull().default('not_started'),
  priority: text('priority', { enum: ['low', 'normal', 'high'] }).notNull().default('normal'),
  isBlocked: boolean('is_blocked').notNull().default(false),
  isUnplanned: boolean('is_unplanned').notNull().default(false),
  isOnCriticalPath: boolean('is_on_critical_path').notNull().default(false),
  sourceWorkflowTemplateId: uuid('source_workflow_template_id').references(() => workflowTemplates.id),
  sourceWorkflowTemplateTaskId: uuid('source_workflow_template_task_id').references(() => workflowTemplateTasks.id),
  sortOrder: integer('sort_order'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})
export type Task = typeof tasks.$inferSelect
export type NewTask = typeof tasks.$inferInsert
export type TaskStatus = Task['status']
export type TaskPriority = Task['priority']
