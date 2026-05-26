import { pgTable, uuid, text, integer, timestamp } from 'drizzle-orm/pg-core'
import { projects } from './projects'
import { projectPhases } from './project_phases'
import { workflowTemplates } from './workflow_templates'

export const projectWorkflows = pgTable('project_workflows', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  projectPhaseId: uuid('project_phase_id').notNull().references(() => projectPhases.id, { onDelete: 'cascade' }),
  sourceWorkflowTemplateId: uuid('source_workflow_template_id').references(() => workflowTemplates.id),
  name: text('name').notNull(),
  sortOrder: integer('sort_order').notNull(),
  status: text('status', { enum: ['pending', 'in_progress', 'complete'] }).notNull().default('pending'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
export type ProjectWorkflow = typeof projectWorkflows.$inferSelect
