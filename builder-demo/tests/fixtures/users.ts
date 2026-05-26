import { testDb } from '@/tests/db'
import { users, type User, type NewUser } from '@/db/schema'

export async function seedUser(overrides: Partial<NewUser> = {}): Promise<User> {
  const [row] = await testDb.insert(users).values({
    larkOpenId: overrides.larkOpenId ?? `lark_${Math.random().toString(36).slice(2)}`,
    larkTenantKey: overrides.larkTenantKey ?? 't1',
    name: overrides.name ?? 'Test User',
    role: overrides.role ?? 'ic',
    team: overrides.team ?? null,
    email: overrides.email ?? null,
    avatarUrl: overrides.avatarUrl ?? null,
    isActive: overrides.isActive ?? true,
    ...overrides,
  }).returning()
  return row
}

export async function seedOwner(name = 'Owner') { return seedUser({ role: 'owner', name }) }
export async function seedPm(name = 'PM')       { return seedUser({ role: 'pm', name, team: 'design' }) }
export async function seedIc(name = 'IC', team: 'design'|'construction'|'sales' = 'design') {
  return seedUser({ role: 'ic', name, team })
}
