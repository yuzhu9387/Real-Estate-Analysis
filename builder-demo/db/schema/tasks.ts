import { pgTable, uuid, text, integer, boolean, timestamp, AnyPgColumn } from 'drizzle-orm/pg-core'
import { projects } from './projects'
import { projectWorkflows } from './project_workflows'
import { users } from './users'
import { workflowTemplates } from './workflow_templates'
import { workflowTemplateTasks } from './workflow_template_tasks'

export const tasks = pgTable('tasks', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  projectWorkflowId: uuid('project_workflow_id').notNull().references(() => projectWorkflows.id, { onDelete: 'cascade' }),
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
  status: text('status', { enum: ['not_started','started','pending_review','approved','complete','wont_do'] }).notNull().default('not_started'),
  isBlocked: boolean('is_blocked').notNull().default(false),
  isUnplanned: boolean('is_unplanned').notNull().default(false),
  isOnCriticalPath: boolean('is_on_critical_path').notNull().default(false),
  sourceWorkflowTemplateId: uuid('source_workflow_template_id').references(() => workflowTemplates.id),
  sourceWorkflowTemplateTaskId: uuid('source_workflow_template_task_id').references(() => workflowTemplateTasks.id),
  sortOrder: integer('sort_order').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})
export type Task = typeof tasks.$inferSelect
export type NewTask = typeof tasks.$inferInsert
export type TaskStatus = Task['status']
