import 'dotenv/config'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'
import { sql } from 'drizzle-orm'
import * as schema from '@/db/schema'

const url = process.env.DATABASE_URL_TEST
if (!url) throw new Error('DATABASE_URL_TEST is not set')

export const testSql = postgres(url, { max: 5 })
export const testDb = drizzle(testSql, { schema })

let migrated = false
export async function ensureMigrated() {
  if (migrated) return
  await migrate(testDb, { migrationsFolder: './db/migrations' })
  migrated = true
}

const TABLES = [
  'audit_logs','activities','task_comments','task_deps','tasks',
  'project_workflows','workflow_template_task_deps','workflow_template_tasks',
  'workflow_templates','project_phases','projects','sessions','users','system_bootstrap',
]

export async function truncateAll() {
  await ensureMigrated()
  await testDb.execute(sql.raw(`TRUNCATE TABLE ${TABLES.join(', ')} RESTART IDENTITY CASCADE`))
}
