import { pgTable, uuid, text, boolean, timestamp } from 'drizzle-orm/pg-core'

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  larkOpenId: text('lark_open_id').notNull().unique(),
  larkTenantKey: text('lark_tenant_key').notNull(),
  email: text('email'),
  name: text('name').notNull(),
  avatarUrl: text('avatar_url'),
  role: text('role', { enum: ['owner', 'pm', 'ic'] }).notNull().default('ic'),
  team: text('team', { enum: ['design', 'construction', 'sales'] }),
  isActive: boolean('is_active').notNull().default(true),
  larkDigestOptedOut: boolean('lark_digest_opted_out').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
})

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
