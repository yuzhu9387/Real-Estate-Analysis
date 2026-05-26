import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core'
import { tasks } from './tasks'
import { users } from './users'

export const taskComments = pgTable('task_comments', {
  id: uuid('id').defaultRandom().primaryKey(),
  taskId: uuid('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  authorId: uuid('author_id').notNull().references(() => users.id),
  body: text('body').notNull(),
  kind: text('kind', { enum: ['discussion','review_request','review_approve','review_revision'] }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
export type TaskComment = typeof taskComments.$inferSelect
