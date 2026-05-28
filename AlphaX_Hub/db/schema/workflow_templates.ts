import { pgTable, uuid, text, boolean, timestamp, integer } from 'drizzle-orm/pg-core'
import { users } from './users'

export const workflowTemplates = pgTable('workflow_templates', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  createdById: uuid('created_by_id').notNull().references(() => users.id),
  isArchived: boolean('is_archived').notNull().default(false),
  totalStartDay: integer('total_start_day').notNull().default(0),
  totalEndDay: integer('total_end_day').notNull().default(0),
  totalDurationDays: integer('total_duration_days').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})
export type WorkflowTemplate = typeof workflowTemplates.$inferSelect
