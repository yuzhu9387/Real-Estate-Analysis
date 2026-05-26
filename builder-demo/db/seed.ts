import 'dotenv/config'
import { db } from './client'
import { users, workflowTemplates, workflowTemplateTasks } from './schema'
import { eq } from 'drizzle-orm'

async function main() {
  const owners = await db.select().from(users).where(eq(users.role, 'owner'))
  if (owners.length === 0) { console.error('No owner; sign in first via Lark.'); process.exit(1) }
  const [tpl] = await db.insert(workflowTemplates).values({
    name: 'Permitting Basics', description: 'Standard permit pipeline', createdById: owners[0].id,
  }).returning()
  await db.insert(workflowTemplateTasks).values([
    { workflowTemplateId: tpl.id, name: 'Survey', defaultDurationDays: 5,  sortOrder: 0 },
    { workflowTemplateId: tpl.id, name: 'Apply',  defaultDurationDays: 10, sortOrder: 1 },
  ])
  console.log('Seeded template:', tpl.id)
  process.exit(0)
}
main()
