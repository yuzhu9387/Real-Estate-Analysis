import { pgTable, text, timestamp } from 'drizzle-orm/pg-core'

export const systemBootstrap = pgTable('system_bootstrap', {
  id: text('id').primaryKey(),
  consumedAt: timestamp('consumed_at', { withTimezone: true }).notNull().defaultNow(),
})
