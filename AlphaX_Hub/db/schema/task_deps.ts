import { pgTable, uuid, text, integer, unique, check } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { projects } from './projects'
import { tasks } from './tasks'

export const taskDeps = pgTable('task_deps', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  fromTaskId: uuid('from_task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  toTaskId: uuid('to_task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  dependencyType: text('dependency_type', { enum: ['finish_to_start'] }).notNull().default('finish_to_start'),
  lagDays: integer('lag_days').notNull().default(0),
}, (t) => ({
  uniqueEdge: unique().on(t.projectId, t.fromTaskId, t.toTaskId),
  noSelfDep: check('td_no_self_dep', sql`${t.fromTaskId} <> ${t.toTaskId}`),
}))
export type TaskDep = typeof taskDeps.$inferSelect
