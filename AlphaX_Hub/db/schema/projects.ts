import { pgTable, uuid, text, integer, boolean, date, numeric, timestamp } from 'drizzle-orm/pg-core'
import { users } from './users'

export const projects = pgTable('projects', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  brand: text('brand', { enum: ['al_homes', 'alera', 'apex'] }).notNull(),
  address: text('address'),
  city: text('city'),
  state: text('state'),
  zip: text('zip'),
  pmId: uuid('pm_id').notNull().references(() => users.id),
  // Section 3 — per-phase owners (all optional, default to the project PM at display time).
  permittingPmId: uuid('permitting_pm_id').references(() => users.id),
  constructionPmId: uuid('construction_pm_id').references(() => users.id),
  salesPmId: uuid('sales_pm_id').references(() => users.id),
  titleHolder: text('title_holder'),
  projectStrategy: text('project_strategy'),
  purchaseDate: date('purchase_date'),
  purchasePrice: numeric('purchase_price', { precision: 14, scale: 2 }),
  targetExitQuarter: text('target_exit_quarter'),
  // Section 2 — schedule cascade (start + 3 phase durations → 3 milestone dates + total).
  //   target_*_duration_days fields are user-supplied; target_permit_date /
  //   target_construction_end_date / target_exit_date / target_project_duration_days
  //   are recomputed from them whenever a project is saved.
  targetStartDate: date('target_start_date'),
  targetPermittingDurationDays: integer('target_permitting_duration_days'),
  targetConstructionDurationDays: integer('target_construction_duration_days'),
  targetSalesDurationDays: integer('target_sales_duration_days'),
  targetProjectDurationDays: integer('target_project_duration_days'),
  targetPermitDate: date('target_permit_date'),
  targetConstructionEndDate: date('target_construction_end_date'),
  targetExitDate: date('target_exit_date'),
  actualPermitDate: date('actual_permit_date'),
  actualConstructionEndDate: date('actual_construction_end_date'),
  actualDurationDays: integer('actual_duration_days'),
  presalePhase1Date: date('presale_phase1_date'),
  presalePhase2Date: date('presale_phase2_date'),
  presalePhase3Date: date('presale_phase3_date'),
  listingDate: date('listing_date'),
  sold: boolean('sold').notNull().default(false),
  soldPrice: numeric('sold_price', { precision: 14, scale: 2 }),
  status: text('status', { enum: ['draft', 'in_progress', 'complete', 'archived'] }).notNull().default('draft'),
  createdById: uuid('created_by_id').notNull().references(() => users.id),
  kickedOffAt: timestamp('kicked_off_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export type Project = typeof projects.$inferSelect
export type NewProject = typeof projects.$inferInsert
export type ProjectStatus = Project['status']
