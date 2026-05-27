import { pgTable, uuid, text, integer, check } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { workflowTemplates } from './workflow_templates'
import { workflowTemplateTasks } from './workflow_template_tasks'

export const workflowTemplateTaskDeps = pgTable('workflow_template_task_deps', {
  id: uuid('id').defaultRandom().primaryKey(),
  workflowTemplateId: uuid('workflow_template_id').notNull().references(() => workflowTemplates.id, { onDelete: 'cascade' }),
  fromTaskId: uuid('from_task_id').notNull().references(() => workflowTemplateTasks.id, { onDelete: 'cascade' }),
  toTaskId: uuid('to_task_id').notNull().references(() => workflowTemplateTasks.id, { onDelete: 'cascade' }),
  dependencyType: text('dependency_type', { enum: ['finish_to_start'] }).notNull().default('finish_to_start'),
  lagDays: integer('lag_days').notNull().default(0),
}, (t) => ({
  noSelfDep: check('wt_no_self_dep', sql`${t.fromTaskId} <> ${t.toTaskId}`),
}))
export type WorkflowTemplateTaskDep = typeof workflowTemplateTaskDeps.$inferSelect
