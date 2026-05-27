# Email/Password Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add email + password registration / login coexisting with Lark OAuth per `docs/superpowers/specs/2026-05-27-password-auth-design.md`, plus an owner-only admin password reset in `/settings/members`.

**Architecture:** Three coordinated changes — (1) DB schema migration that relaxes Lark identity columns and adds `password_hash`, (2) a thin `lib/auth/password.ts` wrapper around `bcryptjs` + a new `issueSession` helper extracted into `lib/auth/session.ts`, (3) Server Actions `registerWithPassword` / `loginWithPassword` / `adminResetPassword` in `app/actions/auth.ts` consumed by new client components on `/login`, new `/register` page, and a per-row button in `/settings/members`. Lark, middleware, and `DEV_AUTH_BYPASS` are not touched.

**Tech Stack:** Next.js 14, TypeScript, Drizzle ORM + Postgres, Vitest, bcryptjs.

---

## Phase 1: Dependencies + schema migration

### Task 1.1: Install bcryptjs

**Files:**
- Modify: `package.json` (via npm install)

- [ ] **Step 1: Install package**

```bash
npm install bcryptjs
npm install --save-dev @types/bcryptjs
```

- [ ] **Step 2: Verify install**

```bash
npm ls bcryptjs
```

Expected: `bcryptjs@<version>` listed at top level.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add bcryptjs for password hashing

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 1.2: Database migration + schema update

**Files:**
- Create: `db/migrations/0008_password_auth.sql`
- Modify: `db/schema/users.ts`
- Modify: `db/migrations/meta/_journal.json` (auto-edited by drizzle-kit, but the .sql migration is hand-written so the journal needs a manual entry; check existing pattern in this repo)

Note: this repo hand-writes some migrations (see `0005_add_check_constraints.sql`) and uses `tsx db/migrate.ts` to apply them. The migration file is read directly from the `db/migrations` folder, but the Drizzle journal at `db/migrations/meta/_journal.json` must include an entry for the new migration so drizzle-kit doesn't try to regenerate it. The simplest approach: write the SQL by hand, then run `npm run db:generate` against the modified schema, accept the auto-generated migration if it matches, OR if drizzle-kit produces a different filename, rename the hand-written file to match and delete the auto-generated one. **Read** existing migration `0005_add_check_constraints.sql` and the journal file BEFORE starting this task to understand the convention used in this repo.

- [ ] **Step 1: Read the existing convention**

```bash
cat db/migrations/0005_add_check_constraints.sql
cat db/migrations/meta/_journal.json | head -50
```

Confirm the journal lists `0005_add_check_constraints` and how the entry is formatted.

- [ ] **Step 2: Modify `db/schema/users.ts`**

Replace the file with:

```ts
import { pgTable, uuid, text, boolean, timestamp } from 'drizzle-orm/pg-core'

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  larkOpenId: text('lark_open_id').unique(),
  larkTenantKey: text('lark_tenant_key'),
  email: text('email').notNull(),
  passwordHash: text('password_hash'),
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
```

Changes from previous version: `larkOpenId` no longer `.notNull()`, `larkTenantKey` no longer `.notNull()`, `email` becomes `.notNull()`, new `passwordHash` column.

- [ ] **Step 3: Create the migration file**

Create `db/migrations/0008_password_auth.sql`:

```sql
-- Backfill NULL emails so the NOT NULL constraint can be added
UPDATE users SET email = 'legacy_' || id || '@buildflow.local' WHERE email IS NULL;

-- Email becomes mandatory
ALTER TABLE users ALTER COLUMN email SET NOT NULL;

-- Case-insensitive unique index on email
CREATE UNIQUE INDEX users_email_unique_lower ON users (lower(email));

-- Lark identity columns become optional (password-only users have NULL for both)
ALTER TABLE users ALTER COLUMN lark_open_id DROP NOT NULL;
ALTER TABLE users ALTER COLUMN lark_tenant_key DROP NOT NULL;

-- New password hash column (NULL = Lark-only user)
ALTER TABLE users ADD COLUMN password_hash text;
```

- [ ] **Step 4: Add journal entry**

Open `db/migrations/meta/_journal.json`. After the entry for `0007_bright_leopardon` add a new entry. The exact JSON shape must match the existing entries — read the file to confirm format. Example entry (adapt `when` to a current epoch ms timestamp, `idx` to next integer, `tag` to `0008_password_auth`):

```json
{
  "idx": 8,
  "version": "7",
  "when": 1748390000000,
  "tag": "0008_password_auth",
  "breakpoints": true
}
```

- [ ] **Step 5: Apply the migration to dev DB**

```bash
npm run db:migrate
```

Expected: clean run, no errors. If the journal entry was malformed, drizzle-kit will complain — fix and re-run.

- [ ] **Step 6: Apply the migration to test DB and verify schema**

```bash
DATABASE_URL=$DATABASE_URL_TEST npm run db:migrate
docker exec buildflow-postgres psql -U buildflow -d buildflow -c "\d users"
```

Expected: `\d users` output shows `password_hash text`, `email text NOT NULL`, `lark_open_id text` (nullable), `lark_tenant_key text` (nullable), and the unique index `users_email_unique_lower`.

- [ ] **Step 7: Run the full test suite to make sure nothing existing broke**

```bash
npm test
```

Expected: all existing tests pass. Note that `seedUser` in `tests/fixtures/users.ts` no longer needs `larkOpenId`/`larkTenantKey` to be set, but the fixture provides them — no change needed.

- [ ] **Step 8: Commit**

```bash
git add db/migrations/0008_password_auth.sql db/migrations/meta/_journal.json db/schema/users.ts
git commit -m "feat(schema): allow password-only users (nullable lark cols, password_hash)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Phase 2: Password helper

### Task 2.1: bcryptjs wrapper

**Files:**
- Create: `lib/auth/password.ts`
- Create: `lib/auth/password.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/auth/password.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { hashPassword, verifyPassword } from './password'

describe('hashPassword', () => {
  it('returns a bcrypt-format string different from the plaintext', async () => {
    const hash = await hashPassword('secret123')
    expect(hash).not.toBe('secret123')
    expect(hash).toMatch(/^\$2[aby]\$/)
  })

  it('produces different hashes for the same input (salt)', async () => {
    const a = await hashPassword('secret123')
    const b = await hashPassword('secret123')
    expect(a).not.toBe(b)
  })
})

describe('verifyPassword', () => {
  it('returns true for the correct password', async () => {
    const hash = await hashPassword('secret123')
    expect(await verifyPassword('secret123', hash)).toBe(true)
  })

  it('returns false for the wrong password', async () => {
    const hash = await hashPassword('secret123')
    expect(await verifyPassword('wrong', hash)).toBe(false)
  })
})
```

- [ ] **Step 2: Run, expect FAIL**

```bash
npm test -- lib/auth/password.test.ts
```

Expected: module not found.

- [ ] **Step 3: Implement**

Create `lib/auth/password.ts`:

```ts
import bcrypt from 'bcryptjs'

const COST = 10

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, COST)
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash)
}
```

- [ ] **Step 4: Run, expect PASS**

```bash
npm test -- lib/auth/password.test.ts
```

All 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/auth/password.ts lib/auth/password.test.ts
git commit -m "feat(auth): bcryptjs hash/verify helpers

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 2.2: issueSession helper

**Files:**
- Modify: `lib/auth/session.ts` — add `issueSession(userId)` that signs a token and writes the cookie

The existing Lark callback inlines this logic; we extract a helper so password Server Actions can call it. The plan does NOT refactor Lark callback in this task — leave existing code alone to keep scope tight. Lark refactor is a separate follow-up.

- [ ] **Step 1: Read existing session.ts**

```bash
cat lib/auth/session.ts
```

Note the existing exports: `signSessionToken`, `verifySessionToken`, `SESSION_COOKIE_NAME`, `SESSION_DURATION_MS`. The helper we add depends on `next/headers` `cookies()`, so it must NOT be importable from Edge runtime (middleware). Since middleware already imports only `session-constants.ts` (Edge-safe), adding a Node-only `issueSession` to `session.ts` is fine.

- [ ] **Step 2: Append to `lib/auth/session.ts`**

Append at the end of the file (do not modify existing exports):

```ts
import { cookies } from 'next/headers'

export async function issueSession(userId: string): Promise<void> {
  const secret = process.env.AUTH_SECRET
  if (!secret) throw new Error('AUTH_SECRET not set')
  const expiresAt = Date.now() + SESSION_DURATION_MS
  const token = await signSessionToken({ userId, expiresAt }, secret)
  cookies().set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    expires: new Date(expiresAt),
    path: '/',
  })
}
```

If `next/headers` is already imported at the top of the file, add `cookies` to the existing import instead of re-importing.

- [ ] **Step 3: Verify**

```bash
npm run typecheck
```

Must pass.

- [ ] **Step 4: Commit**

```bash
git add lib/auth/session.ts
git commit -m "feat(auth): issueSession helper for password-based logins

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Phase 3: Permission

### Task 3.1: Add `auth.admin_reset_password` permission

**Files:**
- Modify: `lib/permissions.ts`

- [ ] **Step 1: Open `lib/permissions.ts`**

Read the file to find the `Action` discriminated union and the `can()` function.

- [ ] **Step 2: Add the action variant**

In the `Action` type, add a new member:

```ts
  | { type: 'auth.admin_reset_password' }
```

Place it next to `'user.update_role'` for grouping.

- [ ] **Step 3: Add the case in `can()`**

Inside the switch (or if-chain) handling actions, add:

```ts
    case 'auth.admin_reset_password':
      return user.role === 'owner'
```

Match the surrounding pattern (the file uses either `switch (action.type)` or sequential `if`s — match whichever is used).

- [ ] **Step 4: Verify**

```bash
npm run typecheck
```

Must pass.

- [ ] **Step 5: Commit**

```bash
git add lib/permissions.ts
git commit -m "feat(perms): auth.admin_reset_password for owners

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Phase 4: Server Actions + integration tests

### Task 4.1: `registerWithPassword` action

**Files:**
- Create: `app/actions/auth.ts`
- Create: `app/actions/auth.test.ts`

- [ ] **Step 1: Write the failing test**

Create `app/actions/auth.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { sql, eq } from 'drizzle-orm'
import { testDb, truncateAll } from '@/tests/db'
import { users } from '@/db/schema'
import { registerWithPassword } from './auth'

// Server Actions read `db` via `@/db/client`. We patch via env: tests reuse the
// dev DB through DATABASE_URL_TEST swapping, OR — same pattern as other action
// tests — we call the action and inspect `testDb` afterwards. This action
// writes via the production `db` import, so the test database needs to be the
// active one in vitest. Other action tests in this repo do this; mirror them.

describe('registerWithPassword', () => {
  beforeEach(async () => { await truncateAll() })

  it('creates a user with role=ic, isActive=true, hashed password, and issues session', async () => {
    const res = await registerWithPassword({
      email: 'alice@example.com',
      name: 'Alice',
      password: 'supersecret',
    })
    expect(res).toEqual({ ok: true })
    const rows = await testDb.select().from(users).where(eq(users.email, 'alice@example.com'))
    expect(rows.length).toBe(1)
    const u = rows[0]
    expect(u.role).toBe('ic')
    expect(u.isActive).toBe(true)
    expect(u.larkOpenId).toBeNull()
    expect(u.larkTenantKey).toBeNull()
    expect(u.passwordHash).not.toBeNull()
    expect(u.passwordHash).not.toBe('supersecret')
  })

  it('rejects duplicate email (case-insensitive)', async () => {
    await registerWithPassword({ email: 'Alice@example.com', name: 'Alice', password: 'supersecret' })
    const res = await registerWithPassword({ email: 'alice@EXAMPLE.com', name: 'Alice2', password: 'anothersecret' })
    expect(res).toEqual({ ok: false, field: 'email', message: 'Email already registered' })
  })

  it('trims whitespace from name and lowercases email', async () => {
    await registerWithPassword({ email: '  ALICE@example.com  ', name: '  Alice  ', password: 'supersecret' })
    const rows = await testDb.select().from(users)
    expect(rows[0].email).toBe('alice@example.com')
    expect(rows[0].name).toBe('Alice')
  })

  it('rejects short password (Zod throws)', async () => {
    await expect(registerWithPassword({
      email: 'bob@example.com', name: 'Bob', password: 'short',
    })).rejects.toThrow()
  })
})
```

- [ ] **Step 2: Run, expect FAIL**

```bash
npm test -- app/actions/auth.test.ts
```

Module not found.

- [ ] **Step 3: Implement `app/actions/auth.ts`**

```ts
'use server'
import { z } from 'zod'
import { sql, eq } from 'drizzle-orm'
import { db } from '@/db/client'
import { users } from '@/db/schema'
import { hashPassword, verifyPassword } from '@/lib/auth/password'
import { issueSession } from '@/lib/auth/session'
import { requirePermission } from '@/lib/server/require-permission'

export async function registerWithPassword(raw: unknown) {
  const input = z.object({
    email: z.string().email().transform(s => s.trim().toLowerCase()),
    name: z.string().min(1).transform(s => s.trim()),
    password: z.string().min(8),
  }).parse(raw)

  const existing = await db.select().from(users)
    .where(sql`lower(${users.email}) = ${input.email}`)
    .limit(1)
  if (existing.length > 0) {
    return { ok: false as const, field: 'email' as const, message: 'Email already registered' }
  }

  const passwordHash = await hashPassword(input.password)
  const [created] = await db.insert(users).values({
    email: input.email,
    name: input.name,
    passwordHash,
    role: 'ic',
    isActive: true,
    larkOpenId: null,
    larkTenantKey: null,
  }).returning()

  await issueSession(created.id)
  return { ok: true as const }
}
```

- [ ] **Step 4: Run, expect PASS**

```bash
npm test -- app/actions/auth.test.ts
```

The 4 register tests pass.

Note: `issueSession` calls `cookies().set(...)` from `next/headers`. In Vitest this needs to be tolerated. If the test crashes inside `issueSession` because the cookie context is missing, mock `next/headers` at the top of the test file:

```ts
import { vi } from 'vitest'
vi.mock('next/headers', () => ({
  cookies: () => ({ set: () => {}, get: () => undefined, delete: () => {} }),
}))
```

Add the mock at the top of `auth.test.ts` if and only if running the test fails due to this. Other action tests in this repo (`task-service.delete-in-draft.test.ts`, `users.opt-out.test.ts`) may already do this — check their imports for the pattern before adding ad-hoc.

- [ ] **Step 5: Commit**

```bash
git add app/actions/auth.ts app/actions/auth.test.ts
git commit -m "feat(auth): registerWithPassword Server Action

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 4.2: `loginWithPassword` action

**Files:**
- Modify: `app/actions/auth.ts` — append the new action
- Modify: `app/actions/auth.test.ts` — append the new test block

- [ ] **Step 1: Append the failing test**

Append to `app/actions/auth.test.ts` (after the registerWithPassword describe):

```ts
import { loginWithPassword } from './auth'

describe('loginWithPassword', () => {
  beforeEach(async () => { await truncateAll() })

  async function setupUser() {
    await registerWithPassword({ email: 'alice@example.com', name: 'Alice', password: 'supersecret' })
  }

  it('returns ok=true and updates lastLoginAt on correct password', async () => {
    await setupUser()
    const before = (await testDb.select().from(users))[0].lastLoginAt
    const res = await loginWithPassword({ email: 'alice@example.com', password: 'supersecret' })
    expect(res).toEqual({ ok: true })
    const after = (await testDb.select().from(users))[0].lastLoginAt
    expect(after).not.toEqual(before)
    expect(after).not.toBeNull()
  })

  it('returns unified error on wrong password', async () => {
    await setupUser()
    expect(await loginWithPassword({ email: 'alice@example.com', password: 'wrong' }))
      .toEqual({ ok: false, message: 'Invalid email or password' })
  })

  it('returns unified error on unknown email', async () => {
    expect(await loginWithPassword({ email: 'nobody@example.com', password: 'whatever' }))
      .toEqual({ ok: false, message: 'Invalid email or password' })
  })

  it('returns unified error when user has no password (Lark-only)', async () => {
    await testDb.insert(users).values({
      larkOpenId: 'lark_only', larkTenantKey: 't1',
      email: 'lark@example.com', name: 'Lark User', role: 'ic',
    })
    expect(await loginWithPassword({ email: 'lark@example.com', password: 'supersecret' }))
      .toEqual({ ok: false, message: 'Invalid email or password' })
  })

  it('returns Account disabled when user.isActive=false', async () => {
    await setupUser()
    await testDb.update(users).set({ isActive: false })
    expect(await loginWithPassword({ email: 'alice@example.com', password: 'supersecret' }))
      .toEqual({ ok: false, message: 'Account disabled' })
  })

  it('matches email case-insensitively', async () => {
    await setupUser()
    expect(await loginWithPassword({ email: 'ALICE@EXAMPLE.com', password: 'supersecret' }))
      .toEqual({ ok: true })
  })
})
```

- [ ] **Step 2: Run, expect FAIL**

```bash
npm test -- app/actions/auth.test.ts
```

`loginWithPassword` not exported.

- [ ] **Step 3: Append to `app/actions/auth.ts`**

```ts
export async function loginWithPassword(raw: unknown) {
  const input = z.object({
    email: z.string().transform(s => s.trim().toLowerCase()),
    password: z.string(),
  }).parse(raw)

  const fail = { ok: false as const, message: 'Invalid email or password' as const }

  const rows = await db.select().from(users)
    .where(sql`lower(${users.email}) = ${input.email}`)
    .limit(1)
  const user = rows[0]
  if (!user) return fail
  if (!user.passwordHash) return fail
  if (!user.isActive) return { ok: false as const, message: 'Account disabled' as const }

  const ok = await verifyPassword(input.password, user.passwordHash)
  if (!ok) return fail

  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id))
  await issueSession(user.id)
  return { ok: true as const }
}
```

- [ ] **Step 4: Run, expect PASS**

```bash
npm test -- app/actions/auth.test.ts
```

10 tests pass (4 register + 6 login).

- [ ] **Step 5: Commit**

```bash
git add app/actions/auth.ts app/actions/auth.test.ts
git commit -m "feat(auth): loginWithPassword Server Action

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 4.3: `adminResetPassword` action

**Files:**
- Modify: `app/actions/auth.ts`
- Modify: `app/actions/auth.test.ts`

- [ ] **Step 1: Append the failing test**

Append at the end of `auth.test.ts`:

```ts
import { adminResetPassword } from './auth'
import { ForbiddenError } from '@/lib/server/errors'
import { seedOwner, seedPm, seedIc } from '@/tests/fixtures/users'

// adminResetPassword requires a current user — same as other "admin" actions.
// requirePermission reads the current user via getCurrentUser; we mock by
// pre-creating users then injecting a session cookie via the existing pattern.
// Other admin-only tests in this repo use the same mechanism — mirror them.
//
// If a current-user fixture helper exists (e.g. tests/fixtures/auth.ts), use it.
// Otherwise patch lib/server/get-current-user via vi.mock.

vi.mock('@/lib/server/get-current-user', async (orig) => {
  const real = await orig() as Record<string, unknown>
  return {
    ...real,
    getCurrentUser: async () => global.__testCurrentUser ?? null,
    requireUser: async () => {
      if (!global.__testCurrentUser) throw new Error('No test user set')
      return global.__testCurrentUser
    },
  }
})
declare global {
  // eslint-disable-next-line no-var
  var __testCurrentUser: import('@/db/schema').User | null | undefined
}

describe('adminResetPassword', () => {
  beforeEach(async () => {
    await truncateAll()
    global.__testCurrentUser = null
  })

  it('owner can reset another user password', async () => {
    const owner = await seedOwner()
    await registerWithPassword({ email: 'a@x.com', name: 'A', password: 'oldsecret' })
    const target = (await testDb.select().from(users).where(eq(users.email, 'a@x.com')))[0]

    global.__testCurrentUser = owner
    const res = await adminResetPassword({ userId: target.id, newPassword: 'newsecret' })
    expect(res).toEqual({ ok: true })

    // Old password no longer works
    global.__testCurrentUser = null
    expect(await loginWithPassword({ email: 'a@x.com', password: 'oldsecret' }))
      .toEqual({ ok: false, message: 'Invalid email or password' })
    // New password works
    expect(await loginWithPassword({ email: 'a@x.com', password: 'newsecret' }))
      .toEqual({ ok: true })
  })

  it('PM cannot reset', async () => {
    const pm = await seedPm()
    await registerWithPassword({ email: 'a@x.com', name: 'A', password: 'oldsecret' })
    const target = (await testDb.select().from(users).where(eq(users.email, 'a@x.com')))[0]
    global.__testCurrentUser = pm
    await expect(adminResetPassword({ userId: target.id, newPassword: 'newsecret' }))
      .rejects.toThrow(ForbiddenError)
  })

  it('IC cannot reset', async () => {
    const ic = await seedIc()
    await registerWithPassword({ email: 'a@x.com', name: 'A', password: 'oldsecret' })
    const target = (await testDb.select().from(users).where(eq(users.email, 'a@x.com')))[0]
    global.__testCurrentUser = ic
    await expect(adminResetPassword({ userId: target.id, newPassword: 'newsecret' }))
      .rejects.toThrow(ForbiddenError)
  })

  it('owner can set initial password for a Lark-only user', async () => {
    const owner = await seedOwner()
    const [larkUser] = await testDb.insert(users).values({
      larkOpenId: 'lark_only', larkTenantKey: 't1',
      email: 'lark@example.com', name: 'Lark User', role: 'ic',
    }).returning()

    global.__testCurrentUser = owner
    await adminResetPassword({ userId: larkUser.id, newPassword: 'newsecret' })

    global.__testCurrentUser = null
    expect(await loginWithPassword({ email: 'lark@example.com', password: 'newsecret' }))
      .toEqual({ ok: true })
  })
})
```

The `vi.mock` block above must be at the top of the test file (Vitest hoists `vi.mock` calls). If you cannot move it to the top because earlier `describe` blocks need a different setup, restructure: hoist the mock to the top of the file, and use `global.__testCurrentUser = null` in beforeEach of the earlier describes too. The earlier register/login tests don't depend on `getCurrentUser`, so the mock is harmless to them.

- [ ] **Step 2: Run, expect FAIL**

```bash
npm test -- app/actions/auth.test.ts
```

`adminResetPassword` not exported.

- [ ] **Step 3: Append to `app/actions/auth.ts`**

```ts
export async function adminResetPassword(raw: unknown) {
  const input = z.object({
    userId: z.string().uuid(),
    newPassword: z.string().min(8),
  }).parse(raw)

  await requirePermission({ type: 'auth.admin_reset_password' })

  const passwordHash = await hashPassword(input.newPassword)
  await db.update(users).set({ passwordHash }).where(eq(users.id, input.userId))
  return { ok: true as const }
}
```

Note: `requirePermission` resolves the current user via `getCurrentUser` and throws `ForbiddenError` if `can()` returns false. The vi.mock in the test replaces `getCurrentUser` so the test controls which user is "logged in."

- [ ] **Step 4: Run, expect PASS**

```bash
npm test -- app/actions/auth.test.ts
```

All 14 tests pass (4 register + 6 login + 4 admin reset).

- [ ] **Step 5: Commit**

```bash
git add app/actions/auth.ts app/actions/auth.test.ts
git commit -m "feat(auth): adminResetPassword Server Action

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Phase 5: Client components

### Task 5.1: LoginForm

**Files:**
- Create: `components/auth/login-form.tsx`

- [ ] **Step 1: Implement**

```tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { loginWithPassword } from '@/app/actions/auth'

export function LoginForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const res = await loginWithPassword({ email, password })
      if (res.ok) {
        router.push('/')
        router.refresh()
      } else {
        setError(res.message)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign-in failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      {error && (
        <div className="rounded border border-red-200 bg-red-50 text-red-700 text-sm px-3 py-2">{error}</div>
      )}
      <label className="block">
        <span className="text-xs text-zinc-600">Email</span>
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          autoComplete="email"
          className="mt-1 w-full border border-zinc-300 rounded px-2 py-1 text-sm"
        />
      </label>
      <label className="block">
        <span className="text-xs text-zinc-600">Password</span>
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          autoComplete="current-password"
          className="mt-1 w-full border border-zinc-300 rounded px-2 py-1 text-sm"
        />
      </label>
      <button
        type="submit"
        disabled={busy}
        className="w-full bg-zinc-900 text-white rounded px-4 py-2 text-sm hover:bg-zinc-800 disabled:opacity-50">
        {busy ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Must pass.

- [ ] **Step 3: Commit**

```bash
git add components/auth/login-form.tsx
git commit -m "feat(auth): LoginForm client component

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 5.2: RegisterForm

**Files:**
- Create: `components/auth/register-form.tsx`

- [ ] **Step 1: Implement**

```tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { registerWithPassword } from '@/app/actions/auth'

export function RegisterForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [banner, setBanner] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setBanner(null)
    setFieldErrors({})

    if (password.length < 8) {
      setFieldErrors({ password: 'Password must be at least 8 characters' })
      return
    }
    if (password !== confirm) {
      setFieldErrors({ confirm: 'Passwords do not match' })
      return
    }

    setBusy(true)
    try {
      const res = await registerWithPassword({ email, name, password })
      if (res.ok) {
        router.push('/')
        router.refresh()
      } else {
        if (res.field) {
          setFieldErrors({ [res.field]: res.message })
        } else {
          setBanner(res.message)
        }
      }
    } catch (e) {
      setBanner(e instanceof Error ? e.message : 'Sign-up failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      {banner && (
        <div className="rounded border border-red-200 bg-red-50 text-red-700 text-sm px-3 py-2">{banner}</div>
      )}
      <label className="block">
        <span className="text-xs text-zinc-600">Email</span>
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          autoComplete="email"
          className="mt-1 w-full border border-zinc-300 rounded px-2 py-1 text-sm"
        />
        {fieldErrors.email && <span className="text-xs text-red-600">{fieldErrors.email}</span>}
      </label>
      <label className="block">
        <span className="text-xs text-zinc-600">Name</span>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          required
          autoComplete="name"
          className="mt-1 w-full border border-zinc-300 rounded px-2 py-1 text-sm"
        />
        {fieldErrors.name && <span className="text-xs text-red-600">{fieldErrors.name}</span>}
      </label>
      <label className="block">
        <span className="text-xs text-zinc-600">Password</span>
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          autoComplete="new-password"
          className="mt-1 w-full border border-zinc-300 rounded px-2 py-1 text-sm"
        />
        {fieldErrors.password && <span className="text-xs text-red-600">{fieldErrors.password}</span>}
      </label>
      <label className="block">
        <span className="text-xs text-zinc-600">Confirm Password</span>
        <input
          type="password"
          value={confirm}
          onChange={e => setConfirm(e.target.value)}
          required
          autoComplete="new-password"
          className="mt-1 w-full border border-zinc-300 rounded px-2 py-1 text-sm"
        />
        {fieldErrors.confirm && <span className="text-xs text-red-600">{fieldErrors.confirm}</span>}
      </label>
      <button
        type="submit"
        disabled={busy}
        className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded px-4 py-2 text-sm hover:opacity-90 disabled:opacity-50">
        {busy ? 'Creating account…' : 'Create Account'}
      </button>
    </form>
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

- [ ] **Step 3: Commit**

```bash
git add components/auth/register-form.tsx
git commit -m "feat(auth): RegisterForm client component

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 5.3: AdminResetPasswordButton

**Files:**
- Create: `components/settings/admin-reset-password-button.tsx`

- [ ] **Step 1: Implement**

```tsx
'use client'
import { useState } from 'react'
import { adminResetPassword } from '@/app/actions/auth'

export function AdminResetPasswordButton({ userId, userName }: { userId: string; userName: string }) {
  const [open, setOpen] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    setBusy(true)
    try {
      await adminResetPassword({ userId, newPassword })
      setDone(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Reset failed')
    } finally {
      setBusy(false)
    }
  }

  function close() {
    setOpen(false)
    setNewPassword('')
    setError(null)
    setDone(false)
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="text-xs text-blue-600 hover:underline">
        Reset Password
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="w-96 rounded-lg bg-white p-6 shadow">
            {done ? (
              <>
                <h2 className="mb-2 text-lg font-semibold">Password reset</h2>
                <p className="text-sm text-zinc-700">
                  Share the new password with {userName} yourself (no email is sent).
                </p>
                <div className="mt-4 flex justify-end">
                  <button onClick={close} className="rounded bg-zinc-900 text-white px-4 py-2 text-sm">Done</button>
                </div>
              </>
            ) : (
              <form onSubmit={onSubmit}>
                <h2 className="mb-2 text-lg font-semibold">Reset password for {userName}</h2>
                {error && <div className="mb-2 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
                <label className="block">
                  <span className="text-xs text-zinc-600">New password (≥ 8 chars)</span>
                  <input
                    type="text"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    autoFocus
                    className="mt-1 w-full border border-zinc-300 rounded px-2 py-1 text-sm"
                  />
                </label>
                <div className="mt-4 flex justify-end gap-2">
                  <button type="button" onClick={close} className="rounded border border-zinc-300 px-4 py-2 text-sm">Cancel</button>
                  <button type="submit" disabled={busy} className="rounded bg-zinc-900 text-white px-4 py-2 text-sm disabled:opacity-50">
                    {busy ? 'Resetting…' : 'Reset'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  )
}
```

Plain-text input (`type="text"`) is intentional: the owner needs to read and share the new password.

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

- [ ] **Step 3: Commit**

```bash
git add components/settings/admin-reset-password-button.tsx
git commit -m "feat(settings): AdminResetPasswordButton client component

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Phase 6: Pages

### Task 6.1: Modify `/login` to embed LoginForm

**Files:**
- Modify: `app/login/page.tsx`

- [ ] **Step 1: Replace the file**

```tsx
import { LoginForm } from '@/components/auth/login-form'
import Link from 'next/link'

type SearchParams = { error?: string }

const ERRORS: Record<string, string> = {
  invalid_state: 'Login attempt expired or invalid. Please try again.',
  tenant_mismatch: 'Your Lark workspace is not authorized to use this app.',
  account_disabled: 'Your account has been disabled. Contact an administrator.',
}

export default function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const err = searchParams.error ? ERRORS[searchParams.error] ?? 'Login failed.' : null
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50">
      <div className="w-96 rounded-2xl bg-white p-8 shadow space-y-4">
        <h1 className="text-2xl font-semibold">BuildFlow</h1>
        {err && <div className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>}

        <a
          href="/api/auth/lark/start"
          className="block w-full rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 px-4 py-3 text-center font-medium text-white hover:opacity-90"
        >
          Sign in with Lark
        </a>

        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <span className="flex-1 border-t border-zinc-200" />
          <span>or</span>
          <span className="flex-1 border-t border-zinc-200" />
        </div>

        <LoginForm />

        <p className="text-center text-xs text-zinc-600">
          Don&rsquo;t have an account?{' '}
          <Link href="/register" className="text-blue-600 hover:underline">Register</Link>
        </p>
      </div>
    </main>
  )
}
```

- [ ] **Step 2: Verify**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add app/login/page.tsx
git commit -m "feat(auth): add LoginForm + register link to login page

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 6.2: Create `/register` page

**Files:**
- Create: `app/register/page.tsx`

The middleware's `PUBLIC_PATHS` array allows `/login` and `/api/auth` through unauthenticated. `/register` is not in that list, so visitors will be redirected to `/login` before they can register. We need to add `/register` to PUBLIC_PATHS.

- [ ] **Step 1: Modify `middleware.ts` PUBLIC_PATHS**

Open `middleware.ts`. Update the `PUBLIC_PATHS` constant:

```ts
const PUBLIC_PATHS = ['/login', '/register', '/api/auth', '/api/health', '/_next', '/favicon']
```

(Only the `/register` addition; other entries unchanged.)

- [ ] **Step 2: Create the page**

`app/register/page.tsx`:

```tsx
import Link from 'next/link'
import { RegisterForm } from '@/components/auth/register-form'

export default function RegisterPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50">
      <div className="w-96 rounded-2xl bg-white p-8 shadow space-y-4">
        <h1 className="text-2xl font-semibold">Create Account</h1>
        <RegisterForm />
        <p className="text-center text-xs text-zinc-600">
          Already have an account?{' '}
          <Link href="/login" className="text-blue-600 hover:underline">Sign in</Link>
        </p>
      </div>
    </main>
  )
}
```

- [ ] **Step 3: Verify**

```bash
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add app/register/page.tsx middleware.ts
git commit -m "feat(auth): /register page with public-path middleware allowance

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 6.3: Add Reset Password button to members page

**Files:**
- Modify: `app/(app)/settings/members/page.tsx`

- [ ] **Step 1: Replace the file**

```tsx
import { db } from '@/db/client'
import { users } from '@/db/schema'
import { requireUser } from '@/lib/server/get-current-user'
import { redirect } from 'next/navigation'
import { AdminResetPasswordButton } from '@/components/settings/admin-reset-password-button'

export default async function MembersPage() {
  const me = await requireUser()
  if (me.role !== 'owner') redirect('/')
  const list = await db.select().from(users)
  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold">Members</h1>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left">
            <th>Name</th><th>Email</th><th>Role</th><th>Team</th><th>Active</th><th></th>
          </tr>
        </thead>
        <tbody>
          {list.map(u => (
            <tr key={u.id} className="border-t">
              <td>{u.name}</td>
              <td>{u.email}</td>
              <td>{u.role}</td>
              <td>{u.team ?? '—'}</td>
              <td>{u.isActive ? 'yes' : 'no'}</td>
              <td className="text-right">
                <AdminResetPasswordButton userId={u.id} userName={u.name} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-4 text-sm text-zinc-600">Role/team/active editing UI follows in a follow-up plan; for now use server actions in <code>app/actions/users.ts</code>.</p>
    </div>
  )
}
```

- [ ] **Step 2: Verify**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add "app/(app)/settings/members/page.tsx"
git commit -m "feat(settings): admin Reset Password button per member row

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Phase 7: Final verification + smoke

### Task 7.1: Full suite + smoke runbook

- [ ] **Step 1: Run tests, typecheck, build**

```bash
npm test
npm run typecheck
npm run build
```

All three must succeed.

- [ ] **Step 2: Manual smoke runbook**

Prerequisites: dev Postgres up, `DEV_AUTH_BYPASS=false` in `.env.local` for this session (revert when done), `npm run dev` running.

1. Visit `/login` — should see Lark gradient button, "or" divider, email/password form, "Register" link.
2. Click "Register" → form shows Email, Name, Password, Confirm Password.
3. Submit with mismatched passwords → "Passwords do not match" under Confirm field. Form does not submit.
4. Submit with `password` short (< 8 chars) → "Password must be at least 8 characters" under Password field.
5. Submit valid form → redirected to `/`, user is signed in as new IC.
6. Click logout → back at `/login`.
7. Sign in with the same email/password → at `/`, signed in.
8. Try wrong password → "Invalid email or password" banner. Form stays at `/login`.
9. Try email that doesn't exist → same "Invalid email or password" banner.
10. In a separate Postgres shell, promote your user to owner: `UPDATE users SET role='owner' WHERE email='<your-email>';`
11. Visit `/settings/members` → see the table now includes Email column and a "Reset Password" button per row.
12. Sign up a second user via incognito.
13. Back as owner, click "Reset Password" on the second user, set a new 8+ char password, confirm dialog says "Share with X yourself."
14. In incognito, sign out, sign back in as the second user with the new password → success.
15. (Optional) If Lark is configured: sign in with Lark on the same browser → goes through.

- [ ] **Step 3: Restore `.env.local`**

If you flipped `DEV_AUTH_BYPASS` to false for the smoke runbook, decide whether to leave it off (now password works) or set it back to `true` (instant dev login). User preference.

---

## Plan self-review

**Spec coverage:**

| Spec section | Implemented by |
|---|---|
| §3 Architecture overview | Phases 1, 2 — bcryptjs + issueSession |
| §4 Schema changes | Task 1.2 |
| §5 Password helper | Task 2.1 |
| §6 Registration flow | Task 4.1 + Task 5.2 + Task 6.2 |
| §7 Login flow | Task 4.2 + Task 5.1 + Task 6.1 |
| §8 Admin reset password | Task 4.3 + Task 5.3 + Task 6.3 + Task 3.1 (perm) |
| §9 Login page UI | Task 6.1 + Task 6.2 |
| §10 Testing strategy | Tasks 2.1, 4.1, 4.2, 4.3 (TDD), Task 7.1 (smoke) |
| §11 File inventory | Matches every Created/Modified entry above |
| §12 Out of scope | Respected — no email infra, no rate limit, no self-serve change password, no account linking |
| §13 Open questions | Risks documented; nothing actionable changes the plan |
| §14 Acceptance criteria | Task 7.1 covers all 8 boxes |

**Placeholder scan:** None of TBD/TODO/"implement later"/"add error handling" patterns present. The `00XX` migration number in early prose is replaced with concrete `0008_password_auth.sql` in Task 1.2.

**Type consistency:**
- `registerWithPassword` return shape `{ ok: true } | { ok: false; field: 'email'; message: string }` consistent across Task 4.1 and Task 5.2
- `loginWithPassword` return shape `{ ok: true } | { ok: false; message: 'Invalid email or password' | 'Account disabled' }` consistent across Task 4.2 and Task 5.1
- `adminResetPassword` return shape `{ ok: true }`; throws `ForbiddenError` on permission denial — consistent across Task 4.3 and Task 5.3
- Permission action `{ type: 'auth.admin_reset_password' }` consistent between Task 3.1 (definition) and Task 4.3 (consumption)
- `seedOwner` / `seedPm` / `seedIc` come from `tests/fixtures/users.ts` (already exists) — confirmed by grep before plan writing

**Known limitations:**
- Component-level tests for forms are not enumerated. The smoke runbook covers user flow. If time, add Vitest + @testing-library/react component tests for LoginForm and RegisterForm — not strictly required to ship.
- The test mock pattern for `getCurrentUser` (Task 4.3) uses a global. This is pragmatic, not elegant. If a `tests/fixtures/auth.ts` helper appears during implementation, prefer that.
- Lark callback at `app/api/auth/lark/callback/route.ts` continues to inline session-cookie writing rather than calling the new `issueSession`. Refactor is intentionally out of scope to keep this plan tight; can be a follow-up commit.
