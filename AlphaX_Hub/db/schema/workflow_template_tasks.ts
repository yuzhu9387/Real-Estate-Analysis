import { pgTable, uuid, text, integer } from 'drizzle-orm/pg-core'
import { workflowTemplates } from './workflow_templates'

export const workflowTemplateTasks = pgTable('workflow_template_tasks', {
  id: uuid('id').defaultRandom().primaryKey(),
  workflowTemplateId: uuid('workflow_template_id').notNull().references(() => workflowTemplates.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  defaultDurationDays: integer('default_duration_days').notNull(),
  defaultOwnerRoleLabel: text('default_owner_role_label'),
  sortOrder: integer('sort_order').notNull(),
})
export type WorkflowTemplateTask = typeof workflowTemplateTasks.$inferSelect
