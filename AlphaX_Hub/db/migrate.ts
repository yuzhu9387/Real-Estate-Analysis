import 'dotenv/config'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'

const url = process.env.DATABASE_URL
if (!url) throw new Error('DATABASE_URL is not set')

const client = postgres(url, { max: 1 })
const db = drizzle(client)

async function main() {
  console.log('Running migrations against', new URL(url!).host)
  await migrate(db, { migrationsFolder: './db/migrations' })
  console.log('Migrations complete')
  await client.end()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
