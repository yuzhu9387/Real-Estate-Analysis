import { eq } from 'drizzle-orm'
import type { DB } from '@/db/client'
import { users, systemBootstrap } from '@/db/schema'

const BOOTSTRAP_KEY = 'bootstrap_owner'

export async function applyBootstrapOwner(
  db: DB,
  input: { openId: string },
): Promise<{ promoted: boolean }> {
  if (!input.openId) return { promoted: false }

  const existing = await db.select().from(systemBootstrap).where(eq(systemBootstrap.id, BOOTSTRAP_KEY))
  if (existing.length > 0) return { promoted: false }

  const targets = await db.select().from(users).where(eq(users.larkOpenId, input.openId))
  if (targets.length === 0) return { promoted: false }

  await db.transaction(async (tx) => {
    await tx.update(users).set({ role: 'owner' }).where(eq(users.id, targets[0].id))
    await tx.insert(systemBootstrap).values({ id: BOOTSTRAP_KEY })
  })
  return { promoted: true }
}
