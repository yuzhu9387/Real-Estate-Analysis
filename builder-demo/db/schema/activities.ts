import { pgTable, uuid, text, jsonb, timestamp } from 'drizzle-orm/pg-core'
import { projects } from './projects'
import { users } from './users'

export const activities = pgTable('activities', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }),
  actorId: uuid('actor_id').notNull().references(() => users.id),
  type: text('type').notNull(),
  payload: jsonb('payload').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
export type Activity = typeof activities.$inferSelect
