# BuildFlow Email/Password Auth — Design Spec

## 1. Goal

Add email + password registration and login as a coexisting alternative to Lark OAuth. Both methods remain visible on the login page; users can sign up with email/password and use BuildFlow without ever touching Lark. No email infrastructure is introduced — admin (owner) resets passwords manually.

## 2. Scope decisions (recorded from brainstorming)

| Decision | Choice | Rationale |
|---|---|---|
| Replace Lark vs coexist | Coexist — both auth methods active | User chose B for login UI; Lark code stays functional |
| Registration policy | Open registration | Anyone can self-register; lands as `ic` role |
| Email infrastructure | None | No verification email; no password-reset email |
| Password reset flow | Admin (owner) resets via `/settings/members` | No user self-serve in v1 |
| Login page UI | Lark button + email/password form on same page | Both visible, "or" separator between them |

## 3. Architecture overview

- **New external dependency**: `bcryptjs` (pure JS, no native compile step; small bundle; works everywhere). Pinned choice — not `bcrypt`.
- **Existing session machinery is reused unchanged**: cookie name, HMAC token format, expiration window all from `lib/auth/session.ts`. Password login issues sessions the same way Lark callback does.
- **Middleware behavior unchanged**: cookie-based gating. Auth method is invisible to middleware.
- **Permission system unchanged**: role assignment continues via `lib/permissions.ts`. New password users default to `ic`.
- **Existing `DEV_AUTH_BYPASS` env flag stays**: independent dev shortcut; not affected by password auth.

## 4. Schema changes

### 4.1 Migration `db/migrations/00XX_password_auth.sql`

```sql
-- 1. Add password_hash column (nullable; Lark users have NULL, password users have value)
ALTER TABLE users ADD COLUMN password_hash text;

-- 2. Make Lark identity columns optional (password users have NULL for both)
ALTER TABLE users ALTER COLUMN lark_open_id DROP NOT NULL;
ALTER TABLE users ALTER COLUMN lark_tenant_key DROP NOT NULL;

-- 3. Email becomes the login key for password users; backfill any NULLs first
UPDATE users SET email = CONCAT('legacy_', id, '@buildflow.local') WHERE email IS NULL;
ALTER TABLE users ALTER COLUMN email SET NOT NULL;
CREATE UNIQUE INDEX users_email_unique_lower ON users (lower(email));
```

The unique index on `lower(email)` enforces case-insensitive email uniqueness.

### 4.2 Drizzle schema (`db/schema/users.ts`)

```ts
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  larkOpenId: text('lark_open_id').unique(),        // CHANGED: no longer .notNull()
  larkTenantKey: text('lark_tenant_key'),            // CHANGED: no longer .notNull()
  email: text('email').notNull(),                    // CHANGED: now .notNull()
  passwordHash: text('password_hash'),               // NEW
  name: text('name').notNull(),
  avatarUrl: text('avatar_url'),
  role: text('role', { enum: ['owner', 'pm', 'ic'] }).notNull().default('ic'),
  team: text('team', { enum: ['design', 'construction', 'sales'] }),
  isActive: boolean('is_active').notNull().default(true),
  larkDigestOptedOut: boolean('lark_digest_opted_out').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
})
```

### 4.3 Application-level invariant

A user must have at least one of: `larkOpenId` OR `passwordHash`. Enforced in Server Actions (services trust this). Not enforced in the DB.

## 5. Password helper module

### 5.1 `lib/auth/password.ts`

```ts
import bcrypt from 'bcryptjs'

const COST = 10  // bcrypt work factor; ~100ms hash on modern hardware

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, COST)
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash)
}
```

Tested in `lib/auth/password.test.ts` (pure unit tests, no DB).

## 6. Registration flow

### 6.1 Route

New page `app/register/page.tsx` (RSC shell, embeds client `RegisterForm`). Linked from `/login` via "Don't have an account? Register".

### 6.2 Form fields

| Field | Validation |
|---|---|
| `email` | required, regex match, trimmed, lowercased server-side |
| `name` | required, trimmed |
| `password` | required, ≥ 8 chars |
| `confirmPassword` | required, must equal `password` (client only) |

### 6.3 Server Action `registerWithPassword(raw)`

Location: `app/actions/auth.ts`

```ts
export async function registerWithPassword(raw: unknown) {
  const input = z.object({
    email: z.string().email().transform(s => s.trim().toLowerCase()),
    name: z.string().min(1).transform(s => s.trim()),
    password: z.string().min(8),
  }).parse(raw)

  // Duplicate check (case-insensitive via lower(email) unique index)
  const existing = await db.select().from(users)
    .where(sql`lower(${users.email}) = ${input.email}`)
    .limit(1)
  if (existing.length > 0) {
    return { ok: false as const, field: 'email', message: 'Email already registered' }
  }

  const hash = await hashPassword(input.password)
  const [created] = await db.insert(users).values({
    email: input.email,
    name: input.name,
    passwordHash: hash,
    role: 'ic',
    isActive: true,
    larkOpenId: null,
    larkTenantKey: null,
  }).returning()

  await issueSession(created.id)
  return { ok: true as const }
}
```

### 6.4 Client behavior

`RegisterForm` calls the action; on `{ ok: true }` calls `router.push('/')`; on `{ ok: false }` shows `message` under the named field (or as a top banner if no field).

## 7. Login flow

### 7.1 Form fields

| Field | Validation |
|---|---|
| `email` | required |
| `password` | required |

### 7.2 Server Action `loginWithPassword(raw)`

Location: `app/actions/auth.ts`

```ts
export async function loginWithPassword(raw: unknown) {
  const input = z.object({
    email: z.string().transform(s => s.trim().toLowerCase()),
    password: z.string(),
  }).parse(raw)

  const rows = await db.select().from(users)
    .where(sql`lower(${users.email}) = ${input.email}`)
    .limit(1)
  const user = rows[0]

  // Unified failure: do not distinguish "no such email" vs "wrong password" vs "no password"
  const fail = { ok: false as const, message: 'Invalid email or password' }
  if (!user) return fail
  if (!user.passwordHash) return fail
  if (!user.isActive) return { ok: false as const, message: 'Account disabled' }

  const ok = await verifyPassword(input.password, user.passwordHash)
  if (!ok) return fail

  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id))
  await issueSession(user.id)
  return { ok: true as const }
}
```

### 7.3 Logout

Uses existing `/api/auth/logout` route. No new code.

## 8. Admin reset password

### 8.1 UI

In `/settings/members`, each user row gets a "Reset Password" button (visible only to owner). Clicking opens a small modal:
- One input: "New password" (≥ 8 chars)
- "Reset" button
- On success: dialog shows "Password reset. Share it with the user yourself."

### 8.2 Server Action `adminResetPassword(raw)`

```ts
export async function adminResetPassword(raw: unknown) {
  const input = z.object({
    userId: z.string().uuid(),
    newPassword: z.string().min(8),
  }).parse(raw)

  await requirePermission({ type: 'auth.admin_reset_password' })

  const hash = await hashPassword(input.newPassword)
  await db.update(users).set({ passwordHash: hash }).where(eq(users.id, input.userId))
  revalidatePath('/settings/members')
  return { ok: true as const }
}
```

### 8.3 Permission

Add to `lib/permissions.ts`:

```ts
case 'auth.admin_reset_password':
  return user.role === 'owner'
```

### 8.4 Side effects

- Does NOT invalidate the target user's existing sessions (admin can manually ask them to re-sign-in if concerned)
- Does NOT email the user (no email infra)

## 9. Login page UI

### 9.1 Layout (login `/login`)

```
┌──────────────────────────────────┐
│           BuildFlow              │
│                                  │
│  [Sign in with Lark]   gradient  │
│                                  │
│  ────────  or  ────────          │
│                                  │
│  Email      [_______________]    │
│  Password   [_______________]    │
│                                  │
│  [Sign in]                       │
│                                  │
│  Don't have an account? Register │
└──────────────────────────────────┘
```

### 9.2 Layout (register `/register`)

Title: "Create Account". Fields: Email, Name, Password, Confirm Password. Single "Create Account" submit button. "Already have an account? Sign in" link back to `/login`.

### 9.3 Components to create

- `components/auth/login-form.tsx` — client component, email/password fields, "Sign in" submit, error banner
- `components/auth/register-form.tsx` — client component, four fields, field-level + banner errors
- `app/register/page.tsx` — RSC page, embeds RegisterForm
- Modify `app/login/page.tsx` — keep Lark button, add divider + LoginForm + register link

### 9.4 Error display

- Top-of-form red banner for global errors (unknown server error, "Account disabled")
- Per-field red text under the field for validation errors (`field: 'email', message: 'Email already registered'`)
- Submit button shows "Signing in…" / "Creating account…" while busy

## 10. Testing strategy

### 10.1 Unit tests

`lib/auth/password.test.ts` — pure tests of `hashPassword` and `verifyPassword`:
- hash output ≠ plain input
- hash output is deterministic-looking string (bcrypt format)
- `verifyPassword(plain, hash)` returns `true` for correct password, `false` for wrong

### 10.2 Integration tests (real Postgres test DB, like other services)

`app/actions/auth.test.ts`:
- `registerWithPassword`:
  - Happy path — user row created with `role='ic'`, `isActive=true`, `passwordHash` set, `larkOpenId=null`
  - Duplicate email (same case) returns `{ ok: false, field: 'email' }`
  - Duplicate email (different case) — `Alice@x.com` after `alice@X.com` exists — returns duplicate error
  - Email with surrounding whitespace gets trimmed/lowercased
  - Name with surrounding whitespace gets trimmed
  - Zod rejects short password (< 8 chars)
- `loginWithPassword`:
  - Happy path — returns `{ ok: true }`, `lastLoginAt` updated
  - Wrong password — `{ ok: false, message: 'Invalid email or password' }`
  - Nonexistent email — same unified error message
  - Lark-only user (passwordHash IS NULL) attempts password login — same unified error
  - Disabled user (`isActive=false`) — `{ ok: false, message: 'Account disabled' }`
- `adminResetPassword`:
  - Owner can reset another user's password; new password works for login; old password fails
  - PM calling — throws `ForbiddenError`
  - IC calling — throws `ForbiddenError`
  - Resetting a Lark-only user (no prior `passwordHash`) — succeeds; that user can now also use password login

### 10.3 Manual smoke runbook

After implementation:
1. Visit `/register` → fill email + name + password → submit → redirected to `/` and signed in
2. Click logout → redirected to `/login`
3. On `/login`, enter same credentials → signed in
4. Existing Lark flow still works: click "Sign in with Lark" → completes (if Lark configured)
5. Sign in as owner, go to `/settings/members`, reset another user's password, sign out, sign in as that user with new password → success
6. Try login with wrong password → see "Invalid email or password"
7. Disable a user (existing functionality), try logging in as them → "Account disabled"

## 11. File inventory

### Created

- `db/migrations/00XX_password_auth.sql`
- `lib/auth/password.ts`
- `lib/auth/password.test.ts`
- `app/actions/auth.ts` (registerWithPassword, loginWithPassword, adminResetPassword)
- `app/actions/auth.test.ts`
- `app/register/page.tsx`
- `components/auth/login-form.tsx`
- `components/auth/register-form.tsx`
- `components/settings/admin-reset-password-button.tsx` (or inline in members page)

### Modified

- `db/schema/users.ts` — column nullability changes + passwordHash
- `lib/permissions.ts` — add `auth.admin_reset_password` action
- `app/login/page.tsx` — add divider + LoginForm + register link below Lark button
- `app/(app)/settings/members/page.tsx` — add Reset Password button per row (owner only)
- `package.json` — add `bcryptjs` (and `@types/bcryptjs` to devDependencies)

### Untouched

- `lib/auth/session.ts`, `lib/auth/session-constants.ts`, `lib/auth/lark.ts`, `lib/auth/bootstrap.ts`
- `middleware.ts` (DEV_AUTH_BYPASS unchanged)
- All Lark routes under `app/api/auth/lark/`

## 12. Out of scope (v1)

- Email verification on registration
- Forgot-password email flow
- User self-serve "Change Password" page in `/settings/me`
- Rate limiting / failed-login lockout
- Captcha
- 2FA / TOTP
- "Remember me" / longer-lived sessions
- Linking a Lark account to an existing password account (or vice versa) so they share an identity
- Third-party SSO (Google / Microsoft / etc.)
- Deleting Lark-related code

## 13. Open questions / risks

- **Risk**: Open registration means anyone with the URL can create an account. Mitigation deferred — current scale is small and the app isn't yet publicly indexed. If spam appears, add admin-approval gate or invite-only flow as a v2.
- **Risk**: If a Lark user already exists with a given email and someone registers via password with the same email, they'll get "Email already registered" — they cannot create the password account. This is intentional (no account linking in v1); the Lark user must ask owner to add a `passwordHash` via `adminResetPassword`.
- **No risk to existing data**: The migration backfills NULL emails with `legacy_<id>@buildflow.local`. If the DB already contains real users with NULL emails, owner should rename those manually post-migration, but the placeholder lets the migration succeed without manual prep.

## 14. Acceptance criteria

- [ ] Migration runs cleanly on fresh DB
- [ ] All unit + integration tests pass
- [ ] `npm run typecheck` + `npm run build` succeed
- [ ] Manual smoke runbook (§10.3) passes step by step
- [ ] Lark sign-in still works
- [ ] DEV_AUTH_BYPASS still works
- [ ] Owner can reset any user's password
- [ ] Wrong-password / unknown-email paths return unified error
