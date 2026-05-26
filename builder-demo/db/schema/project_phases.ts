import { pgTable, uuid, text, integer, timestamp, unique } from 'drizzle-orm/pg-core'
import { projects } from './projects'
import { users } from './users'

export const projectPhases = pgTable('project_phases', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  name: text('name', { enum: ['Permitting', 'Construction', 'Sale'] }).notNull(),
  sortOrder: integer('sort_order').notNull(),
  status: text('status', { enum: ['pending', 'in_progress', 'complete'] }).notNull().default('pending'),
  kickedOffAt: timestamp('kicked_off_at', { withTimezone: true }),
  kickedOffById: uuid('kicked_off_by_id').references(() => users.id),
  markedCompleteAt: timestamp('marked_complete_at', { withTimezone: true }),
  markedCompleteById: uuid('marked_complete_by_id').references(() => users.id),
}, (t) => ({
  uniqueProjectOrder: unique().on(t.projectId, t.sortOrder),
}))

export type ProjectPhase = typeof projectPhases.$inferSelect
export type PhaseStatus = ProjectPhase['status']
