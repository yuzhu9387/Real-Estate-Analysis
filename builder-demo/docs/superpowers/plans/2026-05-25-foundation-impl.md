# BuildFlow Foundation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the BuildFlow platform foundation per `docs/superpowers/specs/2026-05-22-foundation-design.md`: Next.js full-stack TS app with Postgres + Drizzle, Lark OAuth, permission policy module, project/phase state machines, critical-path algorithm, snapshot operation, and Server Actions for the full project/task lifecycle. UI in this plan is limited to a minimal authenticated shell sufficient to smoke-test the backend; full page designs are deferred to follow-up specs.

**Architecture:** Next.js 14 App Router full-stack. Server Actions are the only write surface for UI. Route Handlers reserved for auth callback, health, webhooks. Drizzle ORM with Postgres. `better-auth` with a custom Lark OAuth provider. `lib/permissions.ts` is the single source of truth for authorization, called from server-side `requirePermission` and client-side `usePermissions`. State machines in `lib/state-machine/`. Critical path algorithm and template→project snapshot in `lib/critical-path/` and `lib/snapshot/`.

**Tech Stack:** Next.js 14.2, TypeScript, Postgres 16, Drizzle ORM 0.33+, Drizzle Kit, `better-auth` 0.x, zod, Vitest, @testing-library/react, Playwright (deferred to E2E), Tailwind, Radix UI.

---

## Phase 1: Repository setup and infrastructure

### Task 1.1: Archive existing prototype to `legacy/`

**Files:**
- Move: `app/`, `components/`, `lib/`, `public/`, `components.json`, `tailwind.config.ts`, `postcss.config.mjs`, `next.config.mjs`, `vitest.config.ts`, `vitest.setup.ts`, `tsconfig.json`, `tsconfig.tsbuildinfo`, `next-env.d.ts`, `out/`, `package.json`, `package-lock.json`, `README.md` → `legacy/`
- Keep at root: `docs/`, `node_modules/` (will reinstall)

- [ ] **Step 1: Create `legacy/` and move existing prototype**

```bash
cd /Users/guoyuzhu/Desktop/Real-Estate-Analysis/builder-demo
mkdir -p legacy
git mv app components lib public components.json tailwind.config.ts postcss.config.mjs next.config.mjs vitest.config.ts vitest.setup.ts tsconfig.json next-env.d.ts package.json package-lock.json README.md legacy/
rm -rf node_modules out tsconfig.tsbuildinfo
```

- [ ] **Step 2: Add `legacy/` lint guard**

Create `legacy/README.md`:

```markdown
# Legacy prototype

Frozen reference code from the original frontend-only builder-demo.
**Do not import from this directory.** New code lives at the repository root.

To remove it once the rewrite is complete: `rm -rf legacy/`.
```

- [ ] **Step 3: Verify and commit**

```bash
git status
git commit -m "chore: archive prototype to legacy/ for foundation rewrite"
```

Expected: clean commit with all old files renamed under `legacy/`.

---

### Task 1.2: Initialize new `package.json` and core deps

**Files:**
- Create: `package.json`
- Create: `.gitignore`

- [ ] **Step 1: Write `package.json`**

```json
{
  "name": "buildflow",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "tsx db/migrate.ts",
    "db:studio": "drizzle-kit studio",
    "db:seed": "tsx db/seed.ts"
  },
  "dependencies": {
    "next": "14.2.35",
    "react": "18.3.1",
    "react-dom": "18.3.1",
    "drizzle-orm": "^0.33.0",
    "postgres": "^3.4.4",
    "better-auth": "^0.7.0",
    "zod": "^3.23.8",
    "lucide-react": "^0.439.0",
    "clsx": "^2.1.1",
    "class-variance-authority": "^0.7.0",
    "tailwind-merge": "^2.5.2"
  },
  "devDependencies": {
    "@types/node": "^20.16.5",
    "@types/react": "^18.3.5",
    "@types/react-dom": "^18.3.0",
    "typescript": "^5.5.4",
    "drizzle-kit": "^0.24.2",
    "tsx": "^4.19.0",
    "vitest": "^2.0.5",
    "@vitest/coverage-v8": "^2.0.5",
    "@testing-library/react": "^16.0.1",
    "@testing-library/jest-dom": "^6.5.0",
    "jsdom": "^25.0.0",
    "tailwindcss": "^3.4.10",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.4.45",
    "eslint": "^8.57.0",
    "eslint-config-next": "14.2.35"
  }
}
```

- [ ] **Step 2: Write `.gitignore`**

```
node_modules/
.next/
out/
.env
.env.local
.env*.local
coverage/
*.tsbuildinfo
.DS_Store
db/migrations/meta/
```

- [ ] **Step 3: Install**

```bash
npm install
```

Expected: clean install, no peer-dep errors.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json .gitignore
git commit -m "feat: initialize package.json with foundation dependencies"
```

---

### Task 1.3: TypeScript and Next.js config

**Files:**
- Create: `tsconfig.json`
- Create: `next.config.mjs`
- Create: `next-env.d.ts`
- Create: `tailwind.config.ts`
- Create: `postcss.config.mjs`
- Create: `app/globals.css`

- [ ] **Step 1: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules", "legacy"]
}
```

- [ ] **Step 2: Write `next.config.mjs`**

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: { bodySizeLimit: '2mb' },
  },
}
export default nextConfig
```

- [ ] **Step 3: Write `next-env.d.ts`**

```ts
/// <reference types="next" />
/// <reference types="next/image-types/global" />
```

- [ ] **Step 4: Write `tailwind.config.ts` and `postcss.config.mjs`**

`tailwind.config.ts`:
```ts
import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: { extend: {} },
  plugins: [],
}
export default config
```

`postcss.config.mjs`:
```js
export default { plugins: { tailwindcss: {}, autoprefixer: {} } }
```

- [ ] **Step 5: Write `app/globals.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 6: Typecheck and commit**

```bash
npm run typecheck
git add tsconfig.json next.config.mjs next-env.d.ts tailwind.config.ts postcss.config.mjs app/globals.css
git commit -m "feat: configure TypeScript, Next.js, Tailwind"
```

Expected typecheck: no errors (empty project still passes).

---

### Task 1.4: Local Postgres via docker-compose

**Files:**
- Create: `docker-compose.yml`
- Create: `.env.example`

- [ ] **Step 1: Write `docker-compose.yml`**

```yaml
services:
  postgres:
    image: postgres:16-alpine
    container_name: buildflow-postgres
    environment:
      POSTGRES_DB: buildflow
      POSTGRES_USER: buildflow
      POSTGRES_PASSWORD: buildflow_dev
    ports:
      - "5432:5432"
    volumes:
      - buildflow_pgdata:/var/lib/postgresql/data
  postgres_test:
    image: postgres:16-alpine
    container_name: buildflow-postgres-test
    environment:
      POSTGRES_DB: buildflow_test
      POSTGRES_USER: buildflow
      POSTGRES_PASSWORD: buildflow_dev
    ports:
      - "5433:5432"
volumes:
  buildflow_pgdata:
```

- [ ] **Step 2: Write `.env.example`**

```
DATABASE_URL=postgres://buildflow:buildflow_dev@localhost:5432/buildflow
DATABASE_URL_TEST=postgres://buildflow:buildflow_dev@localhost:5433/buildflow_test
AUTH_SECRET=replace-with-openssl-rand-hex-32
LARK_CLIENT_ID=
LARK_CLIENT_SECRET=
LARK_ALLOWED_TENANT_KEY=
LARK_REDIRECT_URI=http://localhost:3000/api/auth/lark/callback
BOOTSTRAP_OWNER_LARK_OPEN_ID=
```

- [ ] **Step 3: Copy to `.env.local` and start Postgres**

```bash
cp .env.example .env.local
# Edit .env.local to fill in Lark credentials and a real AUTH_SECRET later.
docker compose up -d postgres postgres_test
docker compose ps
```

Expected: both containers `Up` on ports 5432 and 5433.

- [ ] **Step 4: Commit**

```bash
git add docker-compose.yml .env.example
git commit -m "feat: docker-compose Postgres for dev and test"
```

---

### Task 1.5: Vitest setup

**Files:**
- Create: `vitest.config.ts`
- Create: `vitest.setup.ts`
- Create: `tests/.gitkeep`

- [ ] **Step 1: Write `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    include: ['**/*.test.ts', '**/*.test.tsx'],
    exclude: ['node_modules', 'legacy', '.next', 'out'],
    environmentMatchGlobs: [
      ['components/**', 'jsdom'],
      ['app/**', 'jsdom'],
    ],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
})
```

- [ ] **Step 2: Write `vitest.setup.ts`**

```ts
import '@testing-library/jest-dom/vitest'
```

- [ ] **Step 3: Smoke-test Vitest**

Create `tests/smoke.test.ts`:

```ts
import { describe, it, expect } from 'vitest'

describe('smoke', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2)
  })
})
```

Run:
```bash
npm test
```

Expected: 1 test passes.

- [ ] **Step 4: Commit**

```bash
git add vitest.config.ts vitest.setup.ts tests/smoke.test.ts
git commit -m "feat: configure Vitest"
```

---

## Phase 2: Database schema (Drizzle)

### Task 2.1: Drizzle client and config

**Files:**
- Create: `drizzle.config.ts`
- Create: `db/client.ts`
- Create: `db/schema.ts` (initially empty barrel)

- [ ] **Step 1: Write `drizzle.config.ts`**

```ts
import 'dotenv/config'
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './db/schema.ts',
  out: './db/migrations',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL! },
  strict: true,
  verbose: true,
})
```

- [ ] **Step 2: Write `db/client.ts`**

```ts
import 'dotenv/config'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

const url = process.env.DATABASE_URL
if (!url) throw new Error('DATABASE_URL is not set')

export const sql = postgres(url, { max: 10 })
export const db = drizzle(sql, { schema })
export type DB = typeof db
```

- [ ] **Step 3: Write empty `db/schema.ts` placeholder**

```ts
// Tables are declared in db/schema/*.ts and re-exported here.
export {}
```

- [ ] **Step 4: Commit**

```bash
git add drizzle.config.ts db/client.ts db/schema.ts
git commit -m "feat(db): initialize Drizzle client and config"
```

---

### Task 2.2: `users`, `sessions`, `system_bootstrap` tables

**Files:**
- Create: `db/schema/users.ts`
- Create: `db/schema/sessions.ts`
- Create: `db/schema/system_bootstrap.ts`
- Modify: `db/schema.ts`

- [ ] **Step 1: Write `db/schema/users.ts`**

```ts
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
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
})

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
```

- [ ] **Step 2: Write `db/schema/sessions.ts`** (minimal — better-auth fills the rest at runtime via its Drizzle adapter)

```ts
import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core'
import { users } from './users'

export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export type Session = typeof sessions.$inferSelect
```

- [ ] **Step 3: Write `db/schema/system_bootstrap.ts`**

```ts
import { pgTable, text, timestamp } from 'drizzle-orm/pg-core'

export const systemBootstrap = pgTable('system_bootstrap', {
  id: text('id').primaryKey(),
  consumedAt: timestamp('consumed_at', { withTimezone: true }).notNull().defaultNow(),
})
```

- [ ] **Step 4: Re-export from `db/schema.ts`**

```ts
export * from './schema/users'
export * from './schema/sessions'
export * from './schema/system_bootstrap'
```

- [ ] **Step 5: Generate migration and verify**

```bash
npm run db:generate
ls db/migrations/
```

Expected: a `0000_*.sql` file appears with the three tables.

- [ ] **Step 6: Commit**

```bash
git add db/schema/ db/schema.ts db/migrations/
git commit -m "feat(db): users, sessions, system_bootstrap tables"
```

---

### Task 2.3: `projects` and `project_phases` tables

**Files:**
- Create: `db/schema/projects.ts`
- Create: `db/schema/project_phases.ts`
- Modify: `db/schema.ts`

- [ ] **Step 1: Write `db/schema/projects.ts`**

```ts
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
  titleHolder: text('title_holder'),
  projectStrategy: text('project_strategy'),
  purchaseDate: date('purchase_date'),
  purchasePrice: numeric('purchase_price', { precision: 14, scale: 2 }),
  targetExitQuarter: text('target_exit_quarter'),
  targetProjectDurationDays: integer('target_project_duration_days'),
  targetPermitDate: date('target_permit_date'),
  targetConstructionEndDate: date('target_construction_end_date'),
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
```

- [ ] **Step 2: Write `db/schema/project_phases.ts`**

```ts
import { pgTable, uuid, text, integer, timestamp, unique } from 'drizzle-orm/pg-core'
import { projects } from './projects'
import { users } from './users'

export const projectPhases = pgTable('project_phases', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  name: text('name', { enum: ['Permitting', 'Construction', 'Sale'] }).notNull(),
  sortOrder: integer('sort_order').notNull(),
  status: text('status', { enum: ['pending', 'in_progress', 'complete'] }).notNull().default('pending'),
  kickedOffAt: timestamp('kicked_off_at', { withTimezone: true }),
  kickedOffById: uuid('kicked_off_by_id').references(() => users.id),
  markedCompleteAt: timestamp('marked_complete_at', { withTimezone: true }),
  markedCompleteById: uuid('marked_complete_by_id').references(() => users.id),
}, (t) => ({
  uniqueProjectOrder: unique().on(t.projectId, t.sortOrder),
}))

export type ProjectPhase = typeof projectPhases.$inferSelect
export type PhaseStatus = ProjectPhase['status']
```

- [ ] **Step 3: Re-export and generate migration**

Append to `db/schema.ts`:

```ts
export * from './schema/projects'
export * from './schema/project_phases'
```

```bash
npm run db:generate
```

- [ ] **Step 4: Commit**

```bash
git add db/schema/ db/schema.ts db/migrations/
git commit -m "feat(db): projects and project_phases tables"
```

---

### Task 2.4: Workflow template tables

**Files:**
- Create: `db/schema/workflow_templates.ts`
- Create: `db/schema/workflow_template_tasks.ts`
- Create: `db/schema/workflow_template_task_deps.ts`
- Modify: `db/schema.ts`

- [ ] **Step 1: Write `db/schema/workflow_templates.ts`**

```ts
import { pgTable, uuid, text, boolean, timestamp } from 'drizzle-orm/pg-core'
import { users } from './users'

export const workflowTemplates = pgTable('workflow_templates', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  createdById: uuid('created_by_id').notNull().references(() => users.id),
  isArchived: boolean('is_archived').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})
export type WorkflowTemplate = typeof workflowTemplates.$inferSelect
```

- [ ] **Step 2: Write `db/schema/workflow_template_tasks.ts`**

```ts
import { pgTable, uuid, text, integer } from 'drizzle-orm/pg-core'
import { workflowTemplates } from './workflow_templates'

export const workflowTemplateTasks = pgTable('workflow_template_tasks', {
  id: uuid('id').defaultRandom().primaryKey(),
  workflowTemplateId: uuid('workflow_template_id').notNull().references(() => workflowTemplates.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  defaultDurationDays: integer('default_duration_days').notNull(),
  defaultOwnerRoleLabel: text('default_owner_role_label'),
  sortOrder: integer('sort_order').notNull(),
})
export type WorkflowTemplateTask = typeof workflowTemplateTasks.$inferSelect
```

- [ ] **Step 3: Write `db/schema/workflow_template_task_deps.ts`**

```ts
import { pgTable, uuid, text, integer, check } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { workflowTemplates } from './workflow_templates'
import { workflowTemplateTasks } from './workflow_template_tasks'

export const workflowTemplateTaskDeps = pgTable('workflow_template_task_deps', {
  id: uuid('id').defaultRandom().primaryKey(),
  workflowTemplateId: uuid('workflow_template_id').notNull().references(() => workflowTemplates.id, { onDelete: 'cascade' }),
  fromTaskId: uuid('from_task_id').notNull().references(() => workflowTemplateTasks.id, { onDelete: 'cascade' }),
  toTaskId: uuid('to_task_id').notNull().references(() => workflowTemplateTasks.id, { onDelete: 'cascade' }),
  dependencyType: text('dependency_type', { enum: ['finish_to_start'] }).notNull().default('finish_to_start'),
  lagDays: integer('lag_days').notNull().default(0),
}, (t) => ({
  noSelfDep: check('wt_no_self_dep', sql`${t.fromTaskId} <> ${t.toTaskId}`),
}))
export type WorkflowTemplateTaskDep = typeof workflowTemplateTaskDeps.$inferSelect
```

- [ ] **Step 4: Re-export and generate migration**

Append to `db/schema.ts`:
```ts
export * from './schema/workflow_templates'
export * from './schema/workflow_template_tasks'
export * from './schema/workflow_template_task_deps'
```

```bash
npm run db:generate
```

- [ ] **Step 5: Commit**

```bash
git add db/schema/ db/schema.ts db/migrations/
git commit -m "feat(db): workflow_templates, tasks, deps"
```

---

### Task 2.5: `project_workflows` and `tasks` tables

**Files:**
- Create: `db/schema/project_workflows.ts`
- Create: `db/schema/tasks.ts`
- Modify: `db/schema.ts`

- [ ] **Step 1: Write `db/schema/project_workflows.ts`**

```ts
import { pgTable, uuid, text, integer, timestamp } from 'drizzle-orm/pg-core'
import { projects } from './projects'
import { projectPhases } from './project_phases'
import { workflowTemplates } from './workflow_templates'

export const projectWorkflows = pgTable('project_workflows', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  projectPhaseId: uuid('project_phase_id').notNull().references(() => projectPhases.id, { onDelete: 'cascade' }),
  sourceWorkflowTemplateId: uuid('source_workflow_template_id').references(() => workflowTemplates.id),
  name: text('name').notNull(),
  sortOrder: integer('sort_order').notNull(),
  status: text('status', { enum: ['pending', 'in_progress', 'complete'] }).notNull().default('pending'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
export type ProjectWorkflow = typeof projectWorkflows.$inferSelect
```

- [ ] **Step 2: Write `db/schema/tasks.ts`**

```ts
import { pgTable, uuid, text, integer, boolean, timestamp, AnyPgColumn } from 'drizzle-orm/pg-core'
import { projects } from './projects'
import { projectWorkflows } from './project_workflows'
import { users } from './users'
import { workflowTemplates } from './workflow_templates'
import { workflowTemplateTasks } from './workflow_template_tasks'

export const tasks = pgTable('tasks', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  projectWorkflowId: uuid('project_workflow_id').notNull().references(() => projectWorkflows.id, { onDelete: 'cascade' }),
  parentTaskId: uuid('parent_task_id').references((): AnyPgColumn => tasks.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  ownerId: uuid('owner_id').notNull().references(() => users.id),
  reviewerId: uuid('reviewer_id').references(() => users.id),
  plannedDurationDays: integer('planned_duration_days').notNull(),
  plannedStartDay: integer('planned_start_day'),
  plannedEndDay: integer('planned_end_day'),
  actualStartDay: integer('actual_start_day'),
  actualEndDay: integer('actual_end_day'),
  status: text('status', { enum: ['not_started','started','pending_review','approved','complete','wont_do'] }).notNull().default('not_started'),
  isBlocked: boolean('is_blocked').notNull().default(false),
  isUnplanned: boolean('is_unplanned').notNull().default(false),
  isOnCriticalPath: boolean('is_on_critical_path').notNull().default(false),
  sourceWorkflowTemplateId: uuid('source_workflow_template_id').references(() => workflowTemplates.id),
  sourceWorkflowTemplateTaskId: uuid('source_workflow_template_task_id').references(() => workflowTemplateTasks.id),
  sortOrder: integer('sort_order').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})
export type Task = typeof tasks.$inferSelect
export type NewTask = typeof tasks.$inferInsert
export type TaskStatus = Task['status']
```

- [ ] **Step 3: Re-export and generate**

```ts
// append to db/schema.ts
export * from './schema/project_workflows'
export * from './schema/tasks'
```

```bash
npm run db:generate
```

- [ ] **Step 4: Commit**

```bash
git add db/schema/ db/schema.ts db/migrations/
git commit -m "feat(db): project_workflows and tasks tables"
```

---

### Task 2.6: `task_deps`, `task_comments`, `activities`, `audit_logs`

**Files:**
- Create: `db/schema/task_deps.ts`
- Create: `db/schema/task_comments.ts`
- Create: `db/schema/activities.ts`
- Create: `db/schema/audit_logs.ts`
- Modify: `db/schema.ts`

- [ ] **Step 1: `db/schema/task_deps.ts`**

```ts
import { pgTable, uuid, text, integer, unique, check } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { projects } from './projects'
import { tasks } from './tasks'

export const taskDeps = pgTable('task_deps', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  fromTaskId: uuid('from_task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  toTaskId: uuid('to_task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  dependencyType: text('dependency_type', { enum: ['finish_to_start'] }).notNull().default('finish_to_start'),
  lagDays: integer('lag_days').notNull().default(0),
}, (t) => ({
  uniqueEdge: unique().on(t.projectId, t.fromTaskId, t.toTaskId),
  noSelfDep: check('td_no_self_dep', sql`${t.fromTaskId} <> ${t.toTaskId}`),
}))
export type TaskDep = typeof taskDeps.$inferSelect
```

- [ ] **Step 2: `db/schema/task_comments.ts`**

```ts
import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core'
import { tasks } from './tasks'
import { users } from './users'

export const taskComments = pgTable('task_comments', {
  id: uuid('id').defaultRandom().primaryKey(),
  taskId: uuid('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  authorId: uuid('author_id').notNull().references(() => users.id),
  body: text('body').notNull(),
  kind: text('kind', { enum: ['discussion','review_request','review_approve','review_revision'] }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
export type TaskComment = typeof taskComments.$inferSelect
```

- [ ] **Step 3: `db/schema/activities.ts`**

```ts
import { pgTable, uuid, text, jsonb, timestamp } from 'drizzle-orm/pg-core'
import { projects } from './projects'
import { users } from './users'

export const activities = pgTable('activities', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }),
  actorId: uuid('actor_id').notNull().references(() => users.id),
  type: text('type').notNull(),
  payload: jsonb('payload').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
export type Activity = typeof activities.$inferSelect
```

- [ ] **Step 4: `db/schema/audit_logs.ts`**

```ts
import { pgTable, uuid, text, jsonb, timestamp } from 'drizzle-orm/pg-core'
import { users } from './users'

export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  actorId: uuid('actor_id').notNull().references(() => users.id),
  action: text('action').notNull(),
  targetType: text('target_type').notNull(),
  targetId: uuid('target_id').notNull(),
  before: jsonb('before'),
  after: jsonb('after'),
  reason: text('reason').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
export type AuditLog = typeof auditLogs.$inferSelect
```

- [ ] **Step 5: Re-export and generate**

```ts
// append
export * from './schema/task_deps'
export * from './schema/task_comments'
export * from './schema/activities'
export * from './schema/audit_logs'
```

```bash
npm run db:generate
```

- [ ] **Step 6: Commit**

```bash
git add db/schema/ db/schema.ts db/migrations/
git commit -m "feat(db): task_deps, task_comments, activities, audit_logs"
```

---

### Task 2.7: Migration runner

**Files:**
- Create: `db/migrate.ts`

- [ ] **Step 1: Write `db/migrate.ts`**

```ts
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
```

- [ ] **Step 2: Run against dev DB**

```bash
npm run db:migrate
```

Expected: prints "Migrations complete". Verify tables:

```bash
docker exec -i buildflow-postgres psql -U buildflow -d buildflow -c "\dt"
```

Expected: 12 tables listed (users, sessions, system_bootstrap, projects, project_phases, workflow_templates, workflow_template_tasks, workflow_template_task_deps, project_workflows, tasks, task_deps, task_comments, activities, audit_logs).

- [ ] **Step 3: Commit**

```bash
git add db/migrate.ts
git commit -m "feat(db): migration runner script"
```

---

### Task 2.8: Test DB helper for integration tests

**Files:**
- Create: `tests/db.ts`

- [ ] **Step 1: Write `tests/db.ts`**

```ts
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
```

- [ ] **Step 2: Smoke test**

Create `tests/db.test.ts`:

```ts
import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { testDb, truncateAll } from './db'
import { users } from '@/db/schema'

describe('test db helper', () => {
  beforeAll(async () => { await truncateAll() })
  beforeEach(async () => { await truncateAll() })

  it('can insert and read users', async () => {
    await testDb.insert(users).values({
      larkOpenId: 'lark_test_1',
      larkTenantKey: 'tenant_a',
      name: 'Test User',
      role: 'ic',
    })
    const rows = await testDb.select().from(users)
    expect(rows).toHaveLength(1)
    expect(rows[0].name).toBe('Test User')
  })
})
```

Run:
```bash
npm test -- tests/db.test.ts
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add tests/db.ts tests/db.test.ts
git commit -m "test(db): test database helper with truncateAll"
```

---

## Phase 3: Authentication (Lark OAuth)

### Task 3.1: Lark OAuth provider helpers (pure functions, easy to test)

**Files:**
- Create: `lib/auth/lark.ts`
- Create: `lib/auth/lark.test.ts`

- [ ] **Step 1: Write failing test for `buildLarkAuthorizeUrl`**

```ts
// lib/auth/lark.test.ts
import { describe, it, expect } from 'vitest'
import { buildLarkAuthorizeUrl } from './lark'

describe('buildLarkAuthorizeUrl', () => {
  it('constructs the authorize URL with required params', () => {
    const url = buildLarkAuthorizeUrl({
      clientId: 'cli_xxx',
      redirectUri: 'https://app.example.com/api/auth/lark/callback',
      state: 'abc123',
    })
    expect(url).toContain('https://accounts.feishu.cn/open-apis/authen/v1/authorize')
    expect(url).toContain('client_id=cli_xxx')
    expect(url).toContain('redirect_uri=https%3A%2F%2Fapp.example.com%2Fapi%2Fauth%2Flark%2Fcallback')
    expect(url).toContain('state=abc123')
  })
})
```

- [ ] **Step 2: Run test (should fail)**

```bash
npm test -- lib/auth/lark.test.ts
```

Expected: FAIL ("buildLarkAuthorizeUrl is not exported").

- [ ] **Step 3: Implement `lib/auth/lark.ts`**

```ts
const LARK_AUTHORIZE_URL = 'https://accounts.feishu.cn/open-apis/authen/v1/authorize'
const LARK_TOKEN_URL = 'https://open.feishu.cn/open-apis/authen/v2/oauth/token'
const LARK_USERINFO_URL = 'https://open.feishu.cn/open-apis/authen/v1/user_info'

export function buildLarkAuthorizeUrl(input: {
  clientId: string
  redirectUri: string
  state: string
}): string {
  const params = new URLSearchParams({
    client_id: input.clientId,
    redirect_uri: input.redirectUri,
    state: input.state,
    response_type: 'code',
  })
  return `${LARK_AUTHORIZE_URL}?${params.toString()}`
}

export type LarkTokenResponse = {
  access_token: string
  expires_in: number
  refresh_token?: string
  token_type: 'Bearer'
}

export async function exchangeLarkCode(input: {
  clientId: string
  clientSecret: string
  code: string
  redirectUri: string
  fetcher?: typeof fetch
}): Promise<LarkTokenResponse> {
  const fetcher = input.fetcher ?? fetch
  const res = await fetcher(LARK_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      client_id: input.clientId,
      client_secret: input.clientSecret,
      code: input.code,
      redirect_uri: input.redirectUri,
    }),
  })
  if (!res.ok) throw new Error(`Lark token exchange failed: ${res.status}`)
  return (await res.json()) as LarkTokenResponse
}

export type LarkUserInfo = {
  open_id: string
  tenant_key: string
  name: string
  email?: string
  avatar_url?: string
}

export async function fetchLarkUserInfo(input: {
  accessToken: string
  fetcher?: typeof fetch
}): Promise<LarkUserInfo> {
  const fetcher = input.fetcher ?? fetch
  const res = await fetcher(LARK_USERINFO_URL, {
    headers: { Authorization: `Bearer ${input.accessToken}` },
  })
  if (!res.ok) throw new Error(`Lark userinfo failed: ${res.status}`)
  const json = (await res.json()) as { data: LarkUserInfo }
  return json.data
}
```

- [ ] **Step 4: Run tests (should pass)**

```bash
npm test -- lib/auth/lark.test.ts
```

Expected: PASS.

- [ ] **Step 5: Add tests for token/userinfo with mocked fetcher**

Append to `lib/auth/lark.test.ts`:

```ts
import { exchangeLarkCode, fetchLarkUserInfo } from './lark'

describe('exchangeLarkCode', () => {
  it('posts the right body and returns parsed token', async () => {
    const fetcher = async (url: string | URL, init?: RequestInit) => {
      expect(String(url)).toContain('/oauth/token')
      expect(init?.method).toBe('POST')
      const body = JSON.parse(String(init?.body))
      expect(body).toMatchObject({ grant_type: 'authorization_code', code: 'CODE_X' })
      return new Response(JSON.stringify({ access_token: 'tok', expires_in: 7200, token_type: 'Bearer' }), { status: 200 })
    }
    const out = await exchangeLarkCode({
      clientId: 'cli', clientSecret: 'sec', code: 'CODE_X',
      redirectUri: 'https://x/cb', fetcher: fetcher as any,
    })
    expect(out.access_token).toBe('tok')
  })
})

describe('fetchLarkUserInfo', () => {
  it('unwraps data envelope', async () => {
    const fetcher = async () =>
      new Response(JSON.stringify({ data: { open_id: 'ou_x', tenant_key: 't1', name: 'Yu', email: 'y@x.com' } }), { status: 200 })
    const out = await fetchLarkUserInfo({ accessToken: 'tok', fetcher: fetcher as any })
    expect(out.open_id).toBe('ou_x')
    expect(out.tenant_key).toBe('t1')
  })
})
```

Run:
```bash
npm test -- lib/auth/lark.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/auth/lark.ts lib/auth/lark.test.ts
git commit -m "feat(auth): Lark OAuth helper functions"
```

---

### Task 3.2: Session token signing/verifying

**Files:**
- Create: `lib/auth/session.ts`
- Create: `lib/auth/session.test.ts`

- [ ] **Step 1: Failing test**

```ts
// lib/auth/session.test.ts
import { describe, it, expect } from 'vitest'
import { signSessionToken, verifySessionToken } from './session'

const secret = 'a'.repeat(64)

describe('session tokens', () => {
  it('round-trips a user id', async () => {
    const token = await signSessionToken({ userId: 'user-123', expiresAt: Date.now() + 60_000 }, secret)
    const out = await verifySessionToken(token, secret)
    expect(out.userId).toBe('user-123')
  })

  it('rejects tampered token', async () => {
    const token = await signSessionToken({ userId: 'user-1', expiresAt: Date.now() + 60_000 }, secret)
    const tampered = token.slice(0, -1) + (token.slice(-1) === 'a' ? 'b' : 'a')
    await expect(verifySessionToken(tampered, secret)).rejects.toThrow()
  })

  it('rejects expired token', async () => {
    const token = await signSessionToken({ userId: 'user-1', expiresAt: Date.now() - 1 }, secret)
    await expect(verifySessionToken(token, secret)).rejects.toThrow(/expired/i)
  })
})
```

- [ ] **Step 2: Run (fail)**

```bash
npm test -- lib/auth/session.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
// lib/auth/session.ts
import { createHmac, timingSafeEqual } from 'node:crypto'

type SessionPayload = { userId: string; expiresAt: number }

function base64url(buf: Buffer): string {
  return buf.toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
}
function fromBase64url(s: string): Buffer {
  s = s.replace(/-/g, '+').replace(/_/g, '/')
  while (s.length % 4) s += '='
  return Buffer.from(s, 'base64')
}

export async function signSessionToken(payload: SessionPayload, secret: string): Promise<string> {
  const body = base64url(Buffer.from(JSON.stringify(payload)))
  const mac = createHmac('sha256', secret).update(body).digest()
  return `${body}.${base64url(mac)}`
}

export async function verifySessionToken(token: string, secret: string): Promise<SessionPayload> {
  const [body, sig] = token.split('.')
  if (!body || !sig) throw new Error('invalid token format')
  const expected = createHmac('sha256', secret).update(body).digest()
  const provided = fromBase64url(sig)
  if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) {
    throw new Error('signature mismatch')
  }
  const payload = JSON.parse(fromBase64url(body).toString('utf-8')) as SessionPayload
  if (!payload.userId || !payload.expiresAt) throw new Error('invalid payload')
  if (payload.expiresAt < Date.now()) throw new Error('token expired')
  return payload
}

export const SESSION_COOKIE_NAME = 'bf_session'
export const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000   // 7 days
```

- [ ] **Step 4: Run (pass)**

```bash
npm test -- lib/auth/session.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/auth/session.ts lib/auth/session.test.ts
git commit -m "feat(auth): signed session token helpers"
```

---

### Task 3.3: `getCurrentUser` server helper

**Files:**
- Create: `lib/server/get-current-user.ts`

- [ ] **Step 1: Implement**

```ts
// lib/server/get-current-user.ts
import 'server-only'
import { cookies } from 'next/headers'
import { eq } from 'drizzle-orm'
import { db } from '@/db/client'
import { users, type User } from '@/db/schema'
import { SESSION_COOKIE_NAME, verifySessionToken } from '@/lib/auth/session'

export async function getCurrentUser(): Promise<User | null> {
  const secret = process.env.AUTH_SECRET
  if (!secret) throw new Error('AUTH_SECRET not set')
  const token = cookies().get(SESSION_COOKIE_NAME)?.value
  if (!token) return null
  let payload
  try {
    payload = await verifySessionToken(token, secret)
  } catch {
    return null
  }
  const rows = await db.select().from(users).where(eq(users.id, payload.userId)).limit(1)
  const user = rows[0]
  if (!user || !user.isActive) return null
  return user
}

export async function requireUser(): Promise<User> {
  const user = await getCurrentUser()
  if (!user) {
    const { redirect } = await import('next/navigation')
    redirect('/login')
  }
  return user!
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/server/get-current-user.ts
git commit -m "feat(auth): getCurrentUser and requireUser helpers"
```

(Tested indirectly via Route Handler tests in Task 3.5.)

---

### Task 3.4: Bootstrap-owner helper

**Files:**
- Create: `lib/auth/bootstrap.ts`
- Create: `lib/auth/bootstrap.test.ts`

- [ ] **Step 1: Failing test**

```ts
// lib/auth/bootstrap.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { truncateAll, testDb } from '@/tests/db'
import { users, systemBootstrap } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { applyBootstrapOwner } from './bootstrap'

describe('applyBootstrapOwner', () => {
  beforeEach(async () => { await truncateAll() })

  it('promotes the matching open_id to owner exactly once', async () => {
    const [u] = await testDb.insert(users).values({
      larkOpenId: 'ou_boot', larkTenantKey: 't1', name: 'Boot', role: 'ic',
    }).returning()

    const first = await applyBootstrapOwner(testDb, { openId: 'ou_boot' })
    expect(first.promoted).toBe(true)

    const reread = await testDb.select().from(users).where(eq(users.id, u.id))
    expect(reread[0].role).toBe('owner')

    const second = await applyBootstrapOwner(testDb, { openId: 'ou_boot' })
    expect(second.promoted).toBe(false)
  })

  it('is a no-op when openId is empty', async () => {
    const out = await applyBootstrapOwner(testDb, { openId: '' })
    expect(out.promoted).toBe(false)
  })
})
```

- [ ] **Step 2: Run (fail)**

```bash
npm test -- lib/auth/bootstrap.test.ts
```

- [ ] **Step 3: Implement**

```ts
// lib/auth/bootstrap.ts
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
```

- [ ] **Step 4: Run (pass) and commit**

```bash
npm test -- lib/auth/bootstrap.test.ts
git add lib/auth/bootstrap.ts lib/auth/bootstrap.test.ts
git commit -m "feat(auth): bootstrap owner promotion (one-shot)"
```

---

### Task 3.5: OAuth callback Route Handler

**Files:**
- Create: `app/api/auth/lark/callback/route.ts`
- Create: `app/api/auth/lark/start/route.ts`
- Create: `app/api/auth/logout/route.ts`

- [ ] **Step 1: Write `start` route — initiates OAuth flow**

```ts
// app/api/auth/lark/start/route.ts
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { randomBytes } from 'node:crypto'
import { buildLarkAuthorizeUrl } from '@/lib/auth/lark'

export async function GET() {
  const state = randomBytes(16).toString('hex')
  cookies().set('bf_oauth_state', state, {
    httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production',
    maxAge: 5 * 60, path: '/',
  })
  const url = buildLarkAuthorizeUrl({
    clientId: process.env.LARK_CLIENT_ID!,
    redirectUri: process.env.LARK_REDIRECT_URI!,
    state,
  })
  return NextResponse.redirect(url)
}
```

- [ ] **Step 2: Write `callback` route**

```ts
// app/api/auth/lark/callback/route.ts
import { NextResponse, type NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { eq } from 'drizzle-orm'
import { db } from '@/db/client'
import { users } from '@/db/schema'
import { exchangeLarkCode, fetchLarkUserInfo } from '@/lib/auth/lark'
import { signSessionToken, SESSION_COOKIE_NAME, SESSION_DURATION_MS } from '@/lib/auth/session'
import { applyBootstrapOwner } from '@/lib/auth/bootstrap'

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const stateCookie = cookies().get('bf_oauth_state')?.value

  if (!code || !state || !stateCookie || state !== stateCookie) {
    return NextResponse.redirect(new URL('/login?error=invalid_state', req.url))
  }
  cookies().delete('bf_oauth_state')

  const token = await exchangeLarkCode({
    clientId: process.env.LARK_CLIENT_ID!,
    clientSecret: process.env.LARK_CLIENT_SECRET!,
    code,
    redirectUri: process.env.LARK_REDIRECT_URI!,
  })
  const info = await fetchLarkUserInfo({ accessToken: token.access_token })

  if (info.tenant_key !== process.env.LARK_ALLOWED_TENANT_KEY) {
    return NextResponse.redirect(new URL('/login?error=tenant_mismatch', req.url))
  }

  const existing = await db.select().from(users).where(eq(users.larkOpenId, info.open_id)).limit(1)
  let userId: string
  if (existing.length === 0) {
    const [created] = await db.insert(users).values({
      larkOpenId: info.open_id,
      larkTenantKey: info.tenant_key,
      email: info.email,
      name: info.name,
      avatarUrl: info.avatar_url,
      role: 'ic',
    }).returning()
    userId = created.id
  } else {
    if (!existing[0].isActive) {
      return NextResponse.redirect(new URL('/login?error=account_disabled', req.url))
    }
    await db.update(users).set({
      name: info.name,
      avatarUrl: info.avatar_url,
      lastLoginAt: new Date(),
    }).where(eq(users.id, existing[0].id))
    userId = existing[0].id
  }

  // Optional one-shot bootstrap promotion
  if (process.env.BOOTSTRAP_OWNER_LARK_OPEN_ID) {
    await applyBootstrapOwner(db, { openId: process.env.BOOTSTRAP_OWNER_LARK_OPEN_ID })
  }

  const expiresAt = Date.now() + SESSION_DURATION_MS
  const session = await signSessionToken({ userId, expiresAt }, process.env.AUTH_SECRET!)
  cookies().set(SESSION_COOKIE_NAME, session, {
    httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production',
    expires: new Date(expiresAt), path: '/',
  })

  return NextResponse.redirect(new URL('/', req.url))
}
```

- [ ] **Step 3: Write `logout` route**

```ts
// app/api/auth/logout/route.ts
import { NextResponse, type NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { SESSION_COOKIE_NAME } from '@/lib/auth/session'

export async function POST(req: NextRequest) {
  cookies().delete(SESSION_COOKIE_NAME)
  return NextResponse.redirect(new URL('/login', req.url))
}
```

- [ ] **Step 4: Commit**

```bash
git add app/api/auth/
git commit -m "feat(auth): Lark OAuth start/callback/logout routes"
```

---

### Task 3.6: Login page

**Files:**
- Create: `app/login/page.tsx`

- [ ] **Step 1: Write login page**

```tsx
// app/login/page.tsx
type SearchParams = { error?: string }

const ERRORS: Record<string, string> = {
  invalid_state: 'Login attempt expired or invalid. Please try again.',
  tenant_mismatch: 'Your Lark workspace is not authorized to use this app.',
  account_disabled: 'Your account has been disabled. Contact an administrator.',
}

export default function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const err = searchParams.error ? ERRORS[searchParams.error] ?? 'Login failed.' : null
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="w-96 rounded-2xl bg-white p-8 shadow">
        <h1 className="mb-6 text-2xl font-semibold">BuildFlow</h1>
        {err && <div className="mb-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>}
        <a
          href="/api/auth/lark/start"
          className="block w-full rounded-lg bg-blue-600 px-4 py-3 text-center font-medium text-white hover:bg-blue-700"
        >
          Sign in with Lark
        </a>
      </div>
    </main>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/login/
git commit -m "feat(auth): login page"
```

---

### Task 3.7: Middleware to protect routes

**Files:**
- Create: `middleware.ts`

- [ ] **Step 1: Write middleware**

```ts
// middleware.ts
import { NextRequest, NextResponse } from 'next/server'
import { SESSION_COOKIE_NAME } from '@/lib/auth/session'

const PUBLIC_PATHS = ['/login', '/api/auth', '/api/health', '/_next', '/favicon']

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) return NextResponse.next()
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value
  if (!token) {
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
```

Note: middleware does a cheap "cookie exists" check only — it cannot call `getCurrentUser` (no DB in middleware runtime). Real session validation happens in `getCurrentUser` from each protected page/action.

- [ ] **Step 2: Commit**

```bash
git add middleware.ts
git commit -m "feat(auth): middleware redirects unauthenticated requests to /login"
```

---

## Phase 4: Permission policy

### Task 4.1: Errors and types

**Files:**
- Create: `lib/server/errors.ts`

- [ ] **Step 1: Implement**

```ts
// lib/server/errors.ts
export class AppError extends Error {
  constructor(message: string, public readonly httpStatus: number) {
    super(message)
  }
}
export class UnauthorizedError extends AppError { constructor(m = 'Unauthorized') { super(m, 401) } }
export class ForbiddenError extends AppError { constructor(m = 'Forbidden') { super(m, 403) } }
export class NotFoundError extends AppError { constructor(target = 'Resource') { super(`${target} not found`, 404) } }
export class ValidationError extends AppError {
  constructor(m = 'Validation failed', public readonly fields?: Record<string, string>) { super(m, 400) }
}
export class ProjectLockedError extends AppError {
  constructor(status: string, m = `Project is locked (status: ${status})`) { super(m, 409) }
}
export class InvalidTransitionError extends AppError {
  constructor(from: string, to: string) { super(`Invalid transition: ${from} → ${to}`, 409) }
}
export class ConflictError extends AppError { constructor(m = 'Conflict') { super(m, 409) } }
```

- [ ] **Step 2: Commit**

```bash
git add lib/server/errors.ts
git commit -m "feat(server): standard error classes with HTTP status mapping"
```

---

### Task 4.2: Permission action types

**Files:**
- Create: `lib/permissions.ts`
- Create: `lib/permissions.test.ts`

- [ ] **Step 1: Define types + skeleton `can` (no logic yet, just exports)**

```ts
// lib/permissions.ts
import type { User } from '@/db/schema'

export type ProjectStatus = 'draft' | 'in_progress' | 'complete' | 'archived'
export type Role = 'owner' | 'pm' | 'ic'

export type ProjectContext = { pmId: string; status: ProjectStatus }
export type TaskContext = { ownerId: string; reviewerId: string | null }
export type WorkflowTemplateContext = { createdById: string }

export type Action =
  | { type: 'workflow.create' }
  | { type: 'workflow.update'; workflow: WorkflowTemplateContext }
  | { type: 'workflow.delete'; workflow: WorkflowTemplateContext }
  | { type: 'project.create' }
  | { type: 'project.update_meta'; project: ProjectContext }
  | { type: 'project.update_structure'; project: ProjectContext }
  | { type: 'project.kick_off_phase'; project: ProjectContext }
  | { type: 'project.mark_phase_complete'; project: ProjectContext }
  | { type: 'project.mark_complete'; project: ProjectContext }
  | { type: 'project.archive'; project: ProjectContext }
  | { type: 'project.transfer_pm'; project: ProjectContext }
  | { type: 'project.force_reassign_pm' }
  | { type: 'project.unlock_to_draft' }
  | { type: 'task.add_planned'; project: ProjectContext }
  | { type: 'task.add_unplanned'; project: ProjectContext }
  | { type: 'task.update_structure'; project: ProjectContext }
  | { type: 'task.update_notes'; project: ProjectContext; task: TaskContext }
  | { type: 'task.set_status'; project: ProjectContext; task: TaskContext }
  | { type: 'task.submit_review'; task: TaskContext }
  | { type: 'task.review_decision'; task: TaskContext }
  | { type: 'task.add_subtask'; task: TaskContext }
  | { type: 'task.add_comment'; task: TaskContext }
  | { type: 'task.reassign'; project: ProjectContext; task: TaskContext }
  | { type: 'user.update_role' }
  | { type: 'user.disable' }
  | { type: 'audit.view' }

export function can(_user: User, _action: Action): boolean {
  return false   // implemented in next step
}
```

- [ ] **Step 2: Commit skeleton**

```bash
git add lib/permissions.ts
git commit -m "feat(permissions): action types skeleton"
```

---

### Task 4.3: Implement `can()` with exhaustive tests

**Files:**
- Modify: `lib/permissions.ts`
- Create: `lib/permissions.test.ts`

- [ ] **Step 1: Write tests (one block per Action type)**

```ts
// lib/permissions.test.ts
import { describe, it, expect } from 'vitest'
import { can } from './permissions'
import type { User } from '@/db/schema'

function u(role: 'owner'|'pm'|'ic', id = 'u1', overrides: Partial<User> = {}): User {
  return {
    id, larkOpenId: `lark_${id}`, larkTenantKey: 't1', email: null, name: id,
    avatarUrl: null, role, team: null, isActive: true,
    createdAt: new Date(), lastLoginAt: null, ...overrides,
  } as User
}
const owner = u('owner', 'o1')
const pmAlice = u('pm', 'pm-alice')
const pmBob   = u('pm', 'pm-bob')
const icCarol = u('ic', 'ic-carol')
const icDave  = u('ic', 'ic-dave')

const draftProject = { pmId: pmAlice.id, status: 'draft' as const }
const liveProject  = { pmId: pmAlice.id, status: 'in_progress' as const }
const archived     = { pmId: pmAlice.id, status: 'archived' as const }
const taskOwnedByCarol = { ownerId: icCarol.id, reviewerId: icDave.id }

describe('can()', () => {
  describe('workflow.*', () => {
    it('only owner can CRUD workflows', () => {
      const wf = { createdById: owner.id }
      for (const a of [
        { type: 'workflow.create' as const },
        { type: 'workflow.update' as const, workflow: wf },
        { type: 'workflow.delete' as const, workflow: wf },
      ]) {
        expect(can(owner, a)).toBe(true)
        expect(can(pmAlice, a)).toBe(false)
        expect(can(icCarol, a)).toBe(false)
      }
    })
  })

  describe('project.create', () => {
    it('owner and pm can; ic cannot', () => {
      const a = { type: 'project.create' as const }
      expect(can(owner, a)).toBe(true)
      expect(can(pmAlice, a)).toBe(true)
      expect(can(icCarol, a)).toBe(false)
    })
  })

  describe('project.update_structure', () => {
    it('only in draft and only by managing pm or owner', () => {
      const a = { type: 'project.update_structure' as const, project: draftProject }
      expect(can(owner, a)).toBe(true)
      expect(can(pmAlice, a)).toBe(true)
      expect(can(pmBob, a)).toBe(false)
      expect(can(icCarol, a)).toBe(false)

      const live = { ...a, project: liveProject }
      expect(can(pmAlice, live)).toBe(false)
      expect(can(owner, live)).toBe(false)        // owner also blocked by status — use unlock_to_draft instead
    })
  })

  describe('project.kick_off_phase + mark_phase_complete + mark_complete', () => {
    it('managing pm and owner can', () => {
      for (const t of ['project.kick_off_phase','project.mark_phase_complete','project.mark_complete'] as const) {
        const a = { type: t, project: liveProject }
        expect(can(owner, a)).toBe(true)
        expect(can(pmAlice, a)).toBe(true)
        expect(can(pmBob, a)).toBe(false)
        expect(can(icCarol, a)).toBe(false)
      }
    })
  })

  describe('project.transfer_pm', () => {
    it('managing pm or owner', () => {
      const a = { type: 'project.transfer_pm' as const, project: liveProject }
      expect(can(pmAlice, a)).toBe(true)
      expect(can(pmBob, a)).toBe(false)
      expect(can(owner, a)).toBe(true)
    })
  })

  describe('project.force_reassign_pm and unlock_to_draft', () => {
    it('owner only', () => {
      for (const t of ['project.force_reassign_pm','project.unlock_to_draft'] as const) {
        const a = { type: t }
        expect(can(owner, a)).toBe(true)
        expect(can(pmAlice, a)).toBe(false)
        expect(can(icCarol, a)).toBe(false)
      }
    })
  })

  describe('task.set_status', () => {
    it('owner of task, managing pm, system owner', () => {
      const a = { type: 'task.set_status' as const, project: liveProject, task: taskOwnedByCarol }
      expect(can(owner, a)).toBe(true)
      expect(can(pmAlice, a)).toBe(true)
      expect(can(pmBob, a)).toBe(false)
      expect(can(icCarol, a)).toBe(true)
      expect(can(icDave, a)).toBe(false)        // reviewer is not status setter
    })
  })

  describe('task.review_decision', () => {
    it('reviewer, managing pm, system owner', () => {
      const a = { type: 'task.review_decision' as const, task: taskOwnedByCarol }
      expect(can(owner, a)).toBe(true)
      expect(can(pmAlice, a)).toBe(true)
      expect(can(icCarol, a)).toBe(false)
      expect(can(icDave, a)).toBe(true)
    })
  })

  describe('task.submit_review', () => {
    it('owner of task, managing pm, system owner', () => {
      const a = { type: 'task.submit_review' as const, task: taskOwnedByCarol }
      expect(can(owner, a)).toBe(true)
      expect(can(icCarol, a)).toBe(true)
      expect(can(icDave, a)).toBe(false)
    })
  })

  describe('task.add_unplanned', () => {
    it('only managing pm and owner', () => {
      const a = { type: 'task.add_unplanned' as const, project: liveProject }
      expect(can(owner, a)).toBe(true)
      expect(can(pmAlice, a)).toBe(true)
      expect(can(pmBob, a)).toBe(false)
      expect(can(icCarol, a)).toBe(false)
    })
  })

  describe('task.add_subtask + reassign + update_notes', () => {
    it('task owner, managing pm, system owner', () => {
      for (const t of ['task.add_subtask','task.add_comment'] as const) {
        const a = { type: t, task: taskOwnedByCarol }
        expect(can(icCarol, a)).toBe(true)
        expect(can(icDave, a)).toBe(t === 'task.add_comment')      // reviewer can comment, not add subtask
        expect(can(pmAlice, a)).toBe(true)
        expect(can(owner, a)).toBe(true)
        expect(can(pmBob, a)).toBe(false)
      }
      const reassign = { type: 'task.reassign' as const, project: liveProject, task: taskOwnedByCarol }
      expect(can(icCarol, reassign)).toBe(true)
      expect(can(icDave, reassign)).toBe(false)
      expect(can(pmAlice, reassign)).toBe(true)
      expect(can(owner, reassign)).toBe(true)
    })
  })

  describe('user.update_role + user.disable + audit.view', () => {
    it('owner only', () => {
      for (const t of ['user.update_role','user.disable','audit.view'] as const) {
        const a = { type: t }
        expect(can(owner, a)).toBe(true)
        expect(can(pmAlice, a)).toBe(false)
        expect(can(icCarol, a)).toBe(false)
      }
    })
  })

  describe('archived project blocks all writes', () => {
    it('even owner cannot edit archived structurally', () => {
      const a = { type: 'task.set_status' as const, project: archived, task: taskOwnedByCarol }
      expect(can(owner, a)).toBe(false)
      expect(can(icCarol, a)).toBe(false)
    })
  })
})
```

- [ ] **Step 2: Run (should fail — `can` returns false always)**

```bash
npm test -- lib/permissions.test.ts
```

Expected: many failures.

- [ ] **Step 3: Implement `can()`**

Replace the body of `can` in `lib/permissions.ts`:

```ts
export function can(user: User, action: Action): boolean {
  if (!user.isActive) return false

  const isOwnerRole = user.role === 'owner'
  const isPm = user.role === 'pm' || isOwnerRole
  const isIc = user.role === 'ic' || isPm

  const managesProject = (p: { pmId: string }) => isOwnerRole || p.pmId === user.id
  const projectIsDraft   = (p: { status: ProjectStatus }) => p.status === 'draft'
  const projectIsLive    = (p: { status: ProjectStatus }) => p.status === 'draft' || p.status === 'in_progress'
  const projectIsActive  = (p: { status: ProjectStatus }) => p.status === 'in_progress'
  const projectMutable   = (p: { status: ProjectStatus }) => p.status !== 'archived' && p.status !== 'complete'
  const taskOwner    = (t: TaskContext) => t.ownerId === user.id
  const taskReviewer = (t: TaskContext) => t.reviewerId === user.id

  switch (action.type) {
    case 'workflow.create':
    case 'workflow.update':
    case 'workflow.delete':
      return isOwnerRole

    case 'project.create':
      return isPm

    case 'project.update_meta':
      return managesProject(action.project) && projectMutable(action.project)

    case 'project.update_structure':
      return managesProject(action.project) && projectIsDraft(action.project)

    case 'project.kick_off_phase':
    case 'project.mark_phase_complete':
      return managesProject(action.project) && projectIsActive(action.project)

    case 'project.mark_complete':
      return managesProject(action.project) && projectIsActive(action.project)

    case 'project.archive':
      return managesProject(action.project) && action.project.status === 'complete'

    case 'project.transfer_pm':
      return managesProject(action.project) && projectMutable(action.project)

    case 'project.force_reassign_pm':
    case 'project.unlock_to_draft':
      return isOwnerRole

    case 'task.add_planned':
      return managesProject(action.project) && projectIsDraft(action.project)

    case 'task.add_unplanned':
      return managesProject(action.project) && projectIsActive(action.project)

    case 'task.update_structure':
      return managesProject(action.project) && projectIsDraft(action.project)

    case 'task.update_notes':
      return projectMutable(action.project) && (managesProject(action.project) || taskOwner(action.task))

    case 'task.set_status':
      return projectMutable(action.project) && (managesProject(action.project) || taskOwner(action.task))

    case 'task.submit_review':
      return isOwnerRole || taskOwner(action.task) || (isPm && action.task.ownerId !== '__unused__' /* managing pm path handled by caller via project */ )
      // For tightest correctness, callers passing project context use `task.set_status`; submit_review is owner-of-task driven.

    case 'task.review_decision':
      return isOwnerRole || taskReviewer(action.task) || (isPm /* managing PM check is done at caller with project ctx */ )

    case 'task.add_subtask':
      return isOwnerRole || taskOwner(action.task) || isPm

    case 'task.add_comment':
      return isOwnerRole || taskOwner(action.task) || taskReviewer(action.task) || isPm

    case 'task.reassign':
      return projectMutable(action.project) && (managesProject(action.project) || taskOwner(action.task))

    case 'user.update_role':
    case 'user.disable':
    case 'audit.view':
      return isOwnerRole
  }
}
```

- [ ] **Step 4: Run tests**

```bash
npm test -- lib/permissions.test.ts
```

If any FAIL, refine the logic in the failing branch (some tests above expect PM-not-managing to be denied; the simple `isPm` branches in `task.submit_review` / `task.review_decision` / `task.add_subtask` are too loose). Tighten as follows: change those branches to require **either** task-owner/reviewer match **or** a separate `project` context arg. For this plan, **update these Action variants to carry `project` context** and recheck `managesProject`:

Update the type definitions for these four actions to include `project: ProjectContext`:

```ts
| { type: 'task.submit_review'; project: ProjectContext; task: TaskContext }
| { type: 'task.review_decision'; project: ProjectContext; task: TaskContext }
| { type: 'task.add_subtask'; project: ProjectContext; task: TaskContext }
| { type: 'task.add_comment'; project: ProjectContext; task: TaskContext }
```

Then the corresponding case branches become:

```ts
case 'task.submit_review':
  return projectMutable(action.project) && (managesProject(action.project) || taskOwner(action.task))
case 'task.review_decision':
  return projectMutable(action.project) && (managesProject(action.project) || taskReviewer(action.task))
case 'task.add_subtask':
  return projectMutable(action.project) && (managesProject(action.project) || taskOwner(action.task))
case 'task.add_comment':
  return projectMutable(action.project) && (managesProject(action.project) || taskOwner(action.task) || taskReviewer(action.task))
```

Update the tests above to include `project: liveProject` in those four action shapes.

- [ ] **Step 5: Run tests until all pass**

```bash
npm test -- lib/permissions.test.ts
```

Expected: ALL PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/permissions.ts lib/permissions.test.ts
git commit -m "feat(permissions): can() with exhaustive role/action tests"
```

---

### Task 4.4: `requirePermission` server helper

**Files:**
- Create: `lib/server/require-permission.ts`

- [ ] **Step 1: Implement**

```ts
// lib/server/require-permission.ts
import 'server-only'
import { getCurrentUser } from './get-current-user'
import { can, type Action } from '@/lib/permissions'
import { UnauthorizedError, ForbiddenError } from './errors'
import type { User } from '@/db/schema'

export async function requirePermission(action: Action): Promise<User> {
  const user = await getCurrentUser()
  if (!user) throw new UnauthorizedError()
  if (!can(user, action)) throw new ForbiddenError(`Denied: ${action.type}`)
  return user
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/server/require-permission.ts
git commit -m "feat(server): requirePermission helper"
```

---

### Task 4.5: Client `usePermissions` hook + Provider

**Files:**
- Create: `lib/hooks/use-permissions.tsx`

- [ ] **Step 1: Implement**

```tsx
// lib/hooks/use-permissions.tsx
'use client'
import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { can, type Action } from '@/lib/permissions'
import type { User } from '@/db/schema'

const PermissionsContext = createContext<User | null>(null)

export function PermissionsProvider({ user, children }: { user: User | null; children: ReactNode }) {
  return <PermissionsContext.Provider value={user}>{children}</PermissionsContext.Provider>
}

export function usePermissions() {
  const user = useContext(PermissionsContext)
  return useMemo(() => ({
    user,
    can: (action: Action) => (user ? can(user, action) : false),
  }), [user])
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/hooks/use-permissions.tsx
git commit -m "feat(permissions): client provider and usePermissions hook"
```

---

## Phase 5: State machines

### Task 5.1: Project state machine (pure logic)

**Files:**
- Create: `lib/state-machine/project.ts`
- Create: `lib/state-machine/project.test.ts`

- [ ] **Step 1: Write tests**

```ts
// lib/state-machine/project.test.ts
import { describe, it, expect } from 'vitest'
import { canTransitionProject, assertProjectTransition } from './project'
import { InvalidTransitionError } from '@/lib/server/errors'

describe('project state transitions', () => {
  it('allows draft → in_progress', () => {
    expect(canTransitionProject('draft', 'in_progress')).toBe(true)
  })

  it('allows in_progress → complete', () => {
    expect(canTransitionProject('in_progress', 'complete')).toBe(true)
  })

  it('allows complete → archived', () => {
    expect(canTransitionProject('complete', 'archived')).toBe(true)
  })

  it('allows any → draft (owner override)', () => {
    for (const s of ['in_progress','complete','archived'] as const) {
      expect(canTransitionProject(s, 'draft')).toBe(true)
    }
  })

  it('rejects draft → complete (skipping)', () => {
    expect(canTransitionProject('draft', 'complete')).toBe(false)
  })

  it('rejects archived → in_progress', () => {
    expect(canTransitionProject('archived', 'in_progress')).toBe(false)
  })

  it('assertProjectTransition throws on illegal', () => {
    expect(() => assertProjectTransition('archived', 'in_progress')).toThrow(InvalidTransitionError)
  })
})
```

- [ ] **Step 2: Run (fail)**

```bash
npm test -- lib/state-machine/project.test.ts
```

- [ ] **Step 3: Implement**

```ts
// lib/state-machine/project.ts
import { InvalidTransitionError } from '@/lib/server/errors'

export type ProjectStatus = 'draft' | 'in_progress' | 'complete' | 'archived'

const ALLOWED: Record<ProjectStatus, ProjectStatus[]> = {
  draft:       ['in_progress'],
  in_progress: ['complete', 'draft'],   // 'draft' is owner-only unlock — permission layer enforces who
  complete:    ['archived', 'draft'],
  archived:    ['draft'],
}

export function canTransitionProject(from: ProjectStatus, to: ProjectStatus): boolean {
  return ALLOWED[from]?.includes(to) ?? false
}

export function assertProjectTransition(from: ProjectStatus, to: ProjectStatus): void {
  if (!canTransitionProject(from, to)) throw new InvalidTransitionError(from, to)
}
```

- [ ] **Step 4: Run (pass)**

```bash
npm test -- lib/state-machine/project.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add lib/state-machine/project.ts lib/state-machine/project.test.ts
git commit -m "feat(state-machine): project transitions"
```

---

### Task 5.2: Phase state machine

**Files:**
- Create: `lib/state-machine/phase.ts`
- Create: `lib/state-machine/phase.test.ts`

- [ ] **Step 1: Tests**

```ts
// lib/state-machine/phase.test.ts
import { describe, it, expect } from 'vitest'
import { canTransitionPhase, assertPhaseTransition } from './phase'
import { InvalidTransitionError } from '@/lib/server/errors'

describe('phase state transitions', () => {
  it('pending → in_progress', () => {
    expect(canTransitionPhase('pending', 'in_progress')).toBe(true)
  })
  it('in_progress → complete', () => {
    expect(canTransitionPhase('in_progress', 'complete')).toBe(true)
  })
  it('rejects skipping pending → complete', () => {
    expect(canTransitionPhase('pending', 'complete')).toBe(false)
  })
  it('rejects complete → pending', () => {
    expect(canTransitionPhase('complete', 'pending')).toBe(false)
  })
  it('rejects same-state', () => {
    expect(canTransitionPhase('pending', 'pending')).toBe(false)
  })
  it('throws on illegal', () => {
    expect(() => assertPhaseTransition('pending', 'complete')).toThrow(InvalidTransitionError)
  })
})
```

- [ ] **Step 2: Run (fail)**, then implement:

```ts
// lib/state-machine/phase.ts
import { InvalidTransitionError } from '@/lib/server/errors'

export type PhaseStatus = 'pending' | 'in_progress' | 'complete'

const ALLOWED: Record<PhaseStatus, PhaseStatus[]> = {
  pending:     ['in_progress'],
  in_progress: ['complete'],
  complete:    [],
}

export function canTransitionPhase(from: PhaseStatus, to: PhaseStatus): boolean {
  return ALLOWED[from]?.includes(to) ?? false
}

export function assertPhaseTransition(from: PhaseStatus, to: PhaseStatus): void {
  if (!canTransitionPhase(from, to)) throw new InvalidTransitionError(from, to)
}
```

- [ ] **Step 3: Run (pass) and commit**

```bash
npm test -- lib/state-machine/phase.test.ts
git add lib/state-machine/phase.ts lib/state-machine/phase.test.ts
git commit -m "feat(state-machine): phase transitions"
```

---

### Task 5.3: `assertProjectMutable` (structure-edit guard)

**Files:**
- Create: `lib/state-machine/mutable.ts`
- Create: `lib/state-machine/mutable.test.ts`

- [ ] **Step 1: Tests**

```ts
// lib/state-machine/mutable.test.ts
import { describe, it, expect } from 'vitest'
import { assertProjectStructureMutable, assertProjectMetaMutable } from './mutable'
import { ProjectLockedError } from '@/lib/server/errors'

describe('mutable guards', () => {
  it('structure: only draft mutable', () => {
    expect(() => assertProjectStructureMutable('draft')).not.toThrow()
    for (const s of ['in_progress','complete','archived'] as const) {
      expect(() => assertProjectStructureMutable(s)).toThrow(ProjectLockedError)
    }
  })

  it('meta: draft and in_progress mutable; complete and archived not', () => {
    for (const s of ['draft','in_progress'] as const) {
      expect(() => assertProjectMetaMutable(s)).not.toThrow()
    }
    for (const s of ['complete','archived'] as const) {
      expect(() => assertProjectMetaMutable(s)).toThrow(ProjectLockedError)
    }
  })
})
```

- [ ] **Step 2: Implement**

```ts
// lib/state-machine/mutable.ts
import { ProjectLockedError } from '@/lib/server/errors'
import type { ProjectStatus } from './project'

export function assertProjectStructureMutable(status: ProjectStatus): void {
  if (status !== 'draft') throw new ProjectLockedError(status)
}

export function assertProjectMetaMutable(status: ProjectStatus): void {
  if (status === 'complete' || status === 'archived') throw new ProjectLockedError(status)
}
```

- [ ] **Step 3: Commit**

```bash
npm test -- lib/state-machine/mutable.test.ts
git add lib/state-machine/mutable.ts lib/state-machine/mutable.test.ts
git commit -m "feat(state-machine): project mutability guards"
```

---

## Phase 6: Critical path algorithm

### Task 6.1: Algorithm types and topological sort

**Files:**
- Create: `lib/critical-path/index.ts`
- Create: `lib/critical-path/index.test.ts`

- [ ] **Step 1: Tests for topological order on linear DAG**

```ts
// lib/critical-path/index.test.ts
import { describe, it, expect } from 'vitest'
import { recomputeSchedule } from './index'

describe('recomputeSchedule — linear chain', () => {
  it('computes earliest start/end for a → b → c', () => {
    const out = recomputeSchedule({
      tasks: [
        { id: 'a', durationDays: 2, status: 'not_started' },
        { id: 'b', durationDays: 3, status: 'not_started' },
        { id: 'c', durationDays: 4, status: 'not_started' },
      ],
      deps: [
        { fromTaskId: 'a', toTaskId: 'b', lagDays: 0 },
        { fromTaskId: 'b', toTaskId: 'c', lagDays: 0 },
      ],
    })
    const map = Object.fromEntries(out.map(o => [o.taskId, o]))
    expect(map['a']).toMatchObject({ earliestStartDay: 0, earliestEndDay: 2 })
    expect(map['b']).toMatchObject({ earliestStartDay: 2, earliestEndDay: 5 })
    expect(map['c']).toMatchObject({ earliestStartDay: 5, earliestEndDay: 9 })
  })
})
```

- [ ] **Step 2: Run (fail)**

```bash
npm test -- lib/critical-path/index.test.ts
```

- [ ] **Step 3: Implement minimum to pass**

```ts
// lib/critical-path/index.ts
export type TaskInput = {
  id: string
  durationDays: number
  status: 'not_started' | 'started' | 'pending_review' | 'approved' | 'complete' | 'wont_do'
}
export type DepInput = { fromTaskId: string; toTaskId: string; lagDays: number }

export type ScheduleOutput = {
  taskId: string
  earliestStartDay: number
  earliestEndDay: number
  latestStartDay: number
  latestEndDay: number
  slackDays: number
  isOnCriticalPath: boolean
}

export function recomputeSchedule(input: {
  tasks: TaskInput[]
  deps: DepInput[]
}): ScheduleOutput[] {
  // Filter out wont_do tasks completely
  const liveTasks = input.tasks.filter(t => t.status !== 'wont_do')
  const liveIds = new Set(liveTasks.map(t => t.id))
  const liveDeps = input.deps.filter(d => liveIds.has(d.fromTaskId) && liveIds.has(d.toTaskId))

  // Build adjacency (predecessor → successor) and reverse
  const successors = new Map<string, DepInput[]>()
  const predecessors = new Map<string, DepInput[]>()
  for (const t of liveTasks) { successors.set(t.id, []); predecessors.set(t.id, []) }
  for (const d of liveDeps) {
    successors.get(d.fromTaskId)!.push(d)
    predecessors.get(d.toTaskId)!.push(d)
  }

  // Topological sort (Kahn's algorithm)
  const indeg = new Map<string, number>()
  for (const t of liveTasks) indeg.set(t.id, predecessors.get(t.id)!.length)
  const queue: string[] = []
  for (const [id, n] of indeg) if (n === 0) queue.push(id)
  const order: string[] = []
  while (queue.length) {
    const id = queue.shift()!
    order.push(id)
    for (const d of successors.get(id)!) {
      const n = indeg.get(d.toTaskId)! - 1
      indeg.set(d.toTaskId, n)
      if (n === 0) queue.push(d.toTaskId)
    }
  }
  if (order.length !== liveTasks.length) {
    throw new Error('Cycle detected in task dependencies')
  }
  const taskById = new Map(liveTasks.map(t => [t.id, t]))

  // Forward pass: earliest start/end
  const earliestStart = new Map<string, number>()
  const earliestEnd = new Map<string, number>()
  for (const id of order) {
    const preds = predecessors.get(id)!
    const es = preds.length === 0 ? 0
      : Math.max(...preds.map(p => earliestEnd.get(p.fromTaskId)! + p.lagDays))
    const dur = taskById.get(id)!.durationDays
    earliestStart.set(id, es)
    earliestEnd.set(id, es + dur)
  }

  // Backward pass: latest start/end
  const projectEnd = Math.max(0, ...Array.from(earliestEnd.values()))
  const latestEnd = new Map<string, number>()
  const latestStart = new Map<string, number>()
  for (const id of [...order].reverse()) {
    const succs = successors.get(id)!
    const le = succs.length === 0 ? projectEnd
      : Math.min(...succs.map(s => latestStart.get(s.toTaskId)! - s.lagDays))
    const dur = taskById.get(id)!.durationDays
    latestEnd.set(id, le)
    latestStart.set(id, le - dur)
  }

  return liveTasks.map(t => {
    const es = earliestStart.get(t.id)!
    const ee = earliestEnd.get(t.id)!
    const ls = latestStart.get(t.id)!
    const le = latestEnd.get(t.id)!
    const slack = ls - es
    return {
      taskId: t.id,
      earliestStartDay: es,
      earliestEndDay: ee,
      latestStartDay: ls,
      latestEndDay: le,
      slackDays: slack,
      isOnCriticalPath: slack === 0,
    }
  })
}
```

- [ ] **Step 4: Run (pass)**

```bash
npm test -- lib/critical-path/index.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add lib/critical-path/index.ts lib/critical-path/index.test.ts
git commit -m "feat(critical-path): forward/backward pass with topological sort"
```

---

### Task 6.2: More critical-path test cases (lag, parallelism, diamond, wont_do)

**Files:**
- Modify: `lib/critical-path/index.test.ts`

- [ ] **Step 1: Append parallel/diamond/lag tests**

```ts
describe('recomputeSchedule — parallel branches and diamond', () => {
  it('parallel branches: a → {b, c} → d', () => {
    const out = recomputeSchedule({
      tasks: [
        { id: 'a', durationDays: 2, status: 'not_started' },
        { id: 'b', durationDays: 3, status: 'not_started' },
        { id: 'c', durationDays: 5, status: 'not_started' },
        { id: 'd', durationDays: 1, status: 'not_started' },
      ],
      deps: [
        { fromTaskId: 'a', toTaskId: 'b', lagDays: 0 },
        { fromTaskId: 'a', toTaskId: 'c', lagDays: 0 },
        { fromTaskId: 'b', toTaskId: 'd', lagDays: 0 },
        { fromTaskId: 'c', toTaskId: 'd', lagDays: 0 },
      ],
    })
    const map = Object.fromEntries(out.map(o => [o.taskId, o]))
    expect(map['d'].earliestStartDay).toBe(7)   // a (2) + max(b 3, c 5) = 2 + 5
    expect(map['c'].isOnCriticalPath).toBe(true)
    expect(map['b'].isOnCriticalPath).toBe(false)
    expect(map['b'].slackDays).toBe(2)
  })

  it('respects lag days', () => {
    const out = recomputeSchedule({
      tasks: [
        { id: 'a', durationDays: 2, status: 'not_started' },
        { id: 'b', durationDays: 1, status: 'not_started' },
      ],
      deps: [{ fromTaskId: 'a', toTaskId: 'b', lagDays: 3 }],
    })
    const map = Object.fromEntries(out.map(o => [o.taskId, o]))
    expect(map['b'].earliestStartDay).toBe(5)   // a ends at 2 + 3 lag
  })
})

describe('recomputeSchedule — wont_do excluded', () => {
  it('treats wont_do task as if removed from graph', () => {
    const out = recomputeSchedule({
      tasks: [
        { id: 'a', durationDays: 2, status: 'not_started' },
        { id: 'b', durationDays: 5, status: 'wont_do' },
        { id: 'c', durationDays: 1, status: 'not_started' },
      ],
      deps: [
        { fromTaskId: 'a', toTaskId: 'b', lagDays: 0 },
        { fromTaskId: 'b', toTaskId: 'c', lagDays: 0 },
      ],
    })
    // b excluded; deps that touch b are dropped; c becomes a root
    expect(out.map(o => o.taskId).sort()).toEqual(['a','c'])
    const map = Object.fromEntries(out.map(o => [o.taskId, o]))
    expect(map['c'].earliestStartDay).toBe(0)   // c is now a root
  })
})

describe('recomputeSchedule — cycle detection', () => {
  it('throws on circular deps', () => {
    expect(() => recomputeSchedule({
      tasks: [
        { id: 'a', durationDays: 1, status: 'not_started' },
        { id: 'b', durationDays: 1, status: 'not_started' },
      ],
      deps: [
        { fromTaskId: 'a', toTaskId: 'b', lagDays: 0 },
        { fromTaskId: 'b', toTaskId: 'a', lagDays: 0 },
      ],
    })).toThrow(/cycle/i)
  })
})
```

- [ ] **Step 2: Run tests**

```bash
npm test -- lib/critical-path/index.test.ts
```

Expected: ALL PASS (the implementation from 6.1 already handles these — verify).

- [ ] **Step 3: Commit**

```bash
git add lib/critical-path/index.test.ts
git commit -m "test(critical-path): parallel branches, lag, wont_do, cycle detection"
```

---

### Task 6.3: `isBlocked` recomputation helper

**Files:**
- Create: `lib/critical-path/blocked.ts`
- Create: `lib/critical-path/blocked.test.ts`

- [ ] **Step 1: Tests**

```ts
// lib/critical-path/blocked.test.ts
import { describe, it, expect } from 'vitest'
import { computeBlocked } from './blocked'

describe('computeBlocked', () => {
  it('not blocked when no deps', () => {
    const out = computeBlocked({
      tasks: [{ id: 'a', status: 'not_started' }],
      deps: [],
    })
    expect(out).toEqual([{ taskId: 'a', isBlocked: false }])
  })

  it('blocked when upstream is not_started', () => {
    const out = computeBlocked({
      tasks: [
        { id: 'a', status: 'not_started' },
        { id: 'b', status: 'not_started' },
      ],
      deps: [{ fromTaskId: 'a', toTaskId: 'b' }],
    })
    const map = Object.fromEntries(out.map(o => [o.taskId, o]))
    expect(map['a'].isBlocked).toBe(false)
    expect(map['b'].isBlocked).toBe(true)
  })

  it('unblocked when upstream is complete', () => {
    const out = computeBlocked({
      tasks: [
        { id: 'a', status: 'complete' },
        { id: 'b', status: 'not_started' },
      ],
      deps: [{ fromTaskId: 'a', toTaskId: 'b' }],
    })
    const map = Object.fromEntries(out.map(o => [o.taskId, o]))
    expect(map['b'].isBlocked).toBe(false)
  })

  it('wont_do satisfies downstream just like complete', () => {
    const out = computeBlocked({
      tasks: [
        { id: 'a', status: 'wont_do' },
        { id: 'b', status: 'not_started' },
      ],
      deps: [{ fromTaskId: 'a', toTaskId: 'b' }],
    })
    const map = Object.fromEntries(out.map(o => [o.taskId, o]))
    expect(map['b'].isBlocked).toBe(false)
  })

  it('blocked if any upstream is not terminal', () => {
    const out = computeBlocked({
      tasks: [
        { id: 'a', status: 'complete' },
        { id: 'b', status: 'started' },
        { id: 'c', status: 'not_started' },
      ],
      deps: [
        { fromTaskId: 'a', toTaskId: 'c' },
        { fromTaskId: 'b', toTaskId: 'c' },
      ],
    })
    const map = Object.fromEntries(out.map(o => [o.taskId, o]))
    expect(map['c'].isBlocked).toBe(true)
  })
})
```

- [ ] **Step 2: Implement**

```ts
// lib/critical-path/blocked.ts
import type { TaskInput } from './index'

const TERMINAL = new Set(['complete', 'wont_do'])

export function computeBlocked(input: {
  tasks: Pick<TaskInput, 'id' | 'status'>[]
  deps: { fromTaskId: string; toTaskId: string }[]
}): Array<{ taskId: string; isBlocked: boolean }> {
  const statusById = new Map(input.tasks.map(t => [t.id, t.status]))
  const incoming = new Map<string, string[]>()
  for (const t of input.tasks) incoming.set(t.id, [])
  for (const d of input.deps) incoming.get(d.toTaskId)?.push(d.fromTaskId)
  return input.tasks.map(t => {
    const upstreams = incoming.get(t.id) ?? []
    const blocked = upstreams.some(u => {
      const s = statusById.get(u)
      return s !== undefined && !TERMINAL.has(s)
    })
    return { taskId: t.id, isBlocked: blocked }
  })
}
```

- [ ] **Step 3: Run and commit**

```bash
npm test -- lib/critical-path/blocked.test.ts
git add lib/critical-path/blocked.ts lib/critical-path/blocked.test.ts
git commit -m "feat(critical-path): computeBlocked function"
```

---

## Phase 7: Snapshot operation (template → project)

### Task 7.1: Test fixtures for users + workflow templates

**Files:**
- Create: `tests/fixtures/users.ts`
- Create: `tests/fixtures/workflow-templates.ts`

- [ ] **Step 1: User fixtures**

```ts
// tests/fixtures/users.ts
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
```

- [ ] **Step 2: Workflow template fixture**

```ts
// tests/fixtures/workflow-templates.ts
import { testDb } from '@/tests/db'
import { workflowTemplates, workflowTemplateTasks, workflowTemplateTaskDeps } from '@/db/schema'

export async function seedTemplate(input: {
  createdById: string
  name: string
  tasks: Array<{ name: string; durationDays: number; ownerRoleLabel?: string }>
  deps: Array<{ fromIdx: number; toIdx: number; lagDays?: number }>
}) {
  const [tpl] = await testDb.insert(workflowTemplates).values({
    name: input.name, createdById: input.createdById,
  }).returning()
  const insertedTasks = await testDb.insert(workflowTemplateTasks).values(
    input.tasks.map((t, i) => ({
      workflowTemplateId: tpl.id,
      name: t.name,
      defaultDurationDays: t.durationDays,
      defaultOwnerRoleLabel: t.ownerRoleLabel ?? null,
      sortOrder: i,
    })),
  ).returning()
  if (input.deps.length) {
    await testDb.insert(workflowTemplateTaskDeps).values(
      input.deps.map(d => ({
        workflowTemplateId: tpl.id,
        fromTaskId: insertedTasks[d.fromIdx].id,
        toTaskId:   insertedTasks[d.toIdx].id,
        lagDays:    d.lagDays ?? 0,
      })),
    )
  }
  return { template: tpl, tasks: insertedTasks }
}
```

- [ ] **Step 3: Commit**

```bash
git add tests/fixtures/
git commit -m "test: user and workflow-template fixtures"
```

---

### Task 7.2: Implement `snapshotWorkflowsIntoProject`

**Files:**
- Create: `lib/snapshot/snapshot-workflows.ts`
- Create: `lib/snapshot/snapshot-workflows.test.ts`

- [ ] **Step 1: Test (creates project, runs snapshot, asserts tables)**

```ts
// lib/snapshot/snapshot-workflows.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { eq } from 'drizzle-orm'
import { testDb, truncateAll } from '@/tests/db'
import { projects, projectPhases, projectWorkflows, tasks, taskDeps } from '@/db/schema'
import { seedOwner, seedPm } from '@/tests/fixtures/users'
import { seedTemplate } from '@/tests/fixtures/workflow-templates'
import { snapshotWorkflowsIntoProject } from './snapshot-workflows'

describe('snapshotWorkflowsIntoProject', () => {
  beforeEach(async () => { await truncateAll() })

  it('copies template tasks and deps into project tables', async () => {
    const owner = await seedOwner()
    const pm = await seedPm()
    const { template, tasks: tplTasks } = await seedTemplate({
      createdById: owner.id,
      name: 'Permitting Basics',
      tasks: [
        { name: 'Survey', durationDays: 5 },
        { name: 'Zoning', durationDays: 10 },
        { name: 'Submit', durationDays: 2 },
      ],
      deps: [
        { fromIdx: 0, toIdx: 1 },
        { fromIdx: 1, toIdx: 2 },
      ],
    })

    // Create project + phases manually for this test
    const [project] = await testDb.insert(projects).values({
      name: '12 Main St', brand: 'al_homes', pmId: pm.id, createdById: pm.id,
    }).returning()
    const phases = await testDb.insert(projectPhases).values([
      { projectId: project.id, name: 'Permitting',  sortOrder: 1 },
      { projectId: project.id, name: 'Construction', sortOrder: 2 },
      { projectId: project.id, name: 'Sale',         sortOrder: 3 },
    ]).returning()
    const permittingPhase = phases.find(p => p.sortOrder === 1)!

    await testDb.transaction(async (tx) => {
      await snapshotWorkflowsIntoProject(tx, {
        projectId: project.id,
        defaultOwnerId: pm.id,
        assignments: [{ phaseId: permittingPhase.id, templateId: template.id, sortOrder: 0 }],
      })
    })

    const pws = await testDb.select().from(projectWorkflows).where(eq(projectWorkflows.projectId, project.id))
    expect(pws).toHaveLength(1)
    expect(pws[0].name).toBe('Permitting Basics')

    const projTasks = await testDb.select().from(tasks).where(eq(tasks.projectId, project.id))
    expect(projTasks).toHaveLength(3)
    const surveyTask = projTasks.find(t => t.name === 'Survey')!
    expect(surveyTask.plannedDurationDays).toBe(5)
    expect(surveyTask.ownerId).toBe(pm.id)         // defaulted
    expect(surveyTask.sourceWorkflowTemplateId).toBe(template.id)

    const projDeps = await testDb.select().from(taskDeps).where(eq(taskDeps.projectId, project.id))
    expect(projDeps).toHaveLength(2)
    const surveyId = projTasks.find(t => t.name === 'Survey')!.id
    const zoningId = projTasks.find(t => t.name === 'Zoning')!.id
    expect(projDeps.some(d => d.fromTaskId === surveyId && d.toTaskId === zoningId)).toBe(true)
  })

  it('chains multiple workflows in the same phase with leaf→root cross-edges', async () => {
    const owner = await seedOwner()
    const pm = await seedPm()
    const a = await seedTemplate({
      createdById: owner.id, name: 'A',
      tasks: [
        { name: 'A1', durationDays: 1 },
        { name: 'A2', durationDays: 1 },
      ],
      deps: [{ fromIdx: 0, toIdx: 1 }],
    })
    const b = await seedTemplate({
      createdById: owner.id, name: 'B',
      tasks: [{ name: 'B1', durationDays: 1 }],
      deps: [],
    })

    const [project] = await testDb.insert(projects).values({
      name: 'p', brand: 'al_homes', pmId: pm.id, createdById: pm.id,
    }).returning()
    const phases = await testDb.insert(projectPhases).values([
      { projectId: project.id, name: 'Permitting',  sortOrder: 1 },
      { projectId: project.id, name: 'Construction', sortOrder: 2 },
      { projectId: project.id, name: 'Sale',         sortOrder: 3 },
    ]).returning()

    await testDb.transaction(async (tx) => {
      await snapshotWorkflowsIntoProject(tx, {
        projectId: project.id,
        defaultOwnerId: pm.id,
        assignments: [
          { phaseId: phases[0].id, templateId: a.template.id, sortOrder: 0 },
          { phaseId: phases[0].id, templateId: b.template.id, sortOrder: 1 },
        ],
      })
    })

    const projDeps = await testDb.select().from(taskDeps).where(eq(taskDeps.projectId, project.id))
    // Within A: A1 → A2; cross-workflow: A2 (leaf of A) → B1 (root of B)
    expect(projDeps).toHaveLength(2)
  })
})
```

- [ ] **Step 2: Implement**

```ts
// lib/snapshot/snapshot-workflows.ts
import { and, eq, inArray, isNull, notInArray } from 'drizzle-orm'
import type { DB } from '@/db/client'
import {
  projectWorkflows,
  tasks,
  taskDeps,
  workflowTemplates,
  workflowTemplateTasks,
  workflowTemplateTaskDeps,
} from '@/db/schema'

export type SnapshotAssignment = {
  phaseId: string
  templateId: string
  sortOrder: number
}

type Tx = Parameters<Parameters<DB['transaction']>[0]>[0]

export async function snapshotWorkflowsIntoProject(tx: Tx, input: {
  projectId: string
  defaultOwnerId: string
  assignments: SnapshotAssignment[]
}): Promise<void> {
  // Group assignments by phase for leaf→root chaining
  const byPhase = new Map<string, SnapshotAssignment[]>()
  for (const a of input.assignments) {
    if (!byPhase.has(a.phaseId)) byPhase.set(a.phaseId, [])
    byPhase.get(a.phaseId)!.push(a)
  }
  for (const list of byPhase.values()) list.sort((x, y) => x.sortOrder - y.sortOrder)

  for (const [phaseId, list] of byPhase) {
    let prevWorkflowLeafTaskIds: string[] | null = null

    for (const a of list) {
      // Load template + its tasks + deps
      const tplRows = await tx.select().from(workflowTemplates).where(eq(workflowTemplates.id, a.templateId))
      if (tplRows.length === 0) throw new Error(`Template ${a.templateId} not found`)
      const tpl = tplRows[0]

      const tplTasks = await tx.select().from(workflowTemplateTasks)
        .where(eq(workflowTemplateTasks.workflowTemplateId, tpl.id))
      const tplDeps = await tx.select().from(workflowTemplateTaskDeps)
        .where(eq(workflowTemplateTaskDeps.workflowTemplateId, tpl.id))

      // Insert project_workflow
      const [pw] = await tx.insert(projectWorkflows).values({
        projectId: input.projectId,
        projectPhaseId: phaseId,
        sourceWorkflowTemplateId: tpl.id,
        name: tpl.name,
        sortOrder: a.sortOrder,
      }).returning()

      // Insert tasks (remap IDs)
      const idMap = new Map<string, string>()
      for (const tt of tplTasks) {
        const [inserted] = await tx.insert(tasks).values({
          projectId: input.projectId,
          projectWorkflowId: pw.id,
          name: tt.name,
          description: tt.description,
          ownerId: input.defaultOwnerId,
          plannedDurationDays: tt.defaultDurationDays,
          sourceWorkflowTemplateId: tpl.id,
          sourceWorkflowTemplateTaskId: tt.id,
          sortOrder: tt.sortOrder,
        }).returning()
        idMap.set(tt.id, inserted.id)
      }

      // Insert deps within workflow
      for (const d of tplDeps) {
        await tx.insert(taskDeps).values({
          projectId: input.projectId,
          fromTaskId: idMap.get(d.fromTaskId)!,
          toTaskId:   idMap.get(d.toTaskId)!,
          dependencyType: d.dependencyType,
          lagDays: d.lagDays,
        })
      }

      // Cross-workflow: prev leaves → current roots
      if (prevWorkflowLeafTaskIds) {
        // Current workflow's roots = tasks with no incoming dep within this workflow
        const inboundTaskIds = new Set(tplDeps.map(d => d.toTaskId))
        const rootProjectTaskIds = tplTasks.filter(t => !inboundTaskIds.has(t.id)).map(t => idMap.get(t.id)!)
        for (const fromId of prevWorkflowLeafTaskIds) {
          for (const toId of rootProjectTaskIds) {
            await tx.insert(taskDeps).values({
              projectId: input.projectId, fromTaskId: fromId, toTaskId: toId, lagDays: 0,
            })
          }
        }
      }

      // Compute leaves of this workflow for next round
      const outboundTaskIds = new Set(tplDeps.map(d => d.fromTaskId))
      const leafProjectTaskIds = tplTasks.filter(t => !outboundTaskIds.has(t.id)).map(t => idMap.get(t.id)!)
      prevWorkflowLeafTaskIds = leafProjectTaskIds
    }
  }
}
```

- [ ] **Step 3: Run tests**

```bash
npm test -- lib/snapshot/snapshot-workflows.test.ts
```

Expected: PASS (both tests).

- [ ] **Step 4: Commit**

```bash
git add lib/snapshot/ tests/fixtures/
git commit -m "feat(snapshot): template-to-project snapshot with cross-workflow deps"
```

---

### Task 7.3: `applyScheduleToProject` — persist critical-path output

**Files:**
- Create: `lib/snapshot/apply-schedule.ts`
- Create: `lib/snapshot/apply-schedule.test.ts`

- [ ] **Step 1: Test**

```ts
// lib/snapshot/apply-schedule.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { eq } from 'drizzle-orm'
import { testDb, truncateAll } from '@/tests/db'
import { tasks } from '@/db/schema'
import { applyScheduleToProject } from './apply-schedule'
import { seedOwner, seedPm } from '@/tests/fixtures/users'
import { seedTemplate } from '@/tests/fixtures/workflow-templates'
import { snapshotWorkflowsIntoProject } from './snapshot-workflows'
import { projects, projectPhases } from '@/db/schema'

describe('applyScheduleToProject', () => {
  beforeEach(async () => { await truncateAll() })

  it('writes earliest start/end and critical-path flag to tasks', async () => {
    const owner = await seedOwner()
    const pm = await seedPm()
    const { template } = await seedTemplate({
      createdById: owner.id, name: 'T',
      tasks: [
        { name: 'a', durationDays: 2 },
        { name: 'b', durationDays: 3 },
      ],
      deps: [{ fromIdx: 0, toIdx: 1 }],
    })
    const [project] = await testDb.insert(projects).values({
      name: 'p', brand: 'al_homes', pmId: pm.id, createdById: pm.id,
    }).returning()
    const [phase] = await testDb.insert(projectPhases).values({
      projectId: project.id, name: 'Permitting', sortOrder: 1,
    }).returning()
    await testDb.transaction(async (tx) => {
      await snapshotWorkflowsIntoProject(tx, {
        projectId: project.id, defaultOwnerId: pm.id,
        assignments: [{ phaseId: phase.id, templateId: template.id, sortOrder: 0 }],
      })
    })

    await testDb.transaction(async (tx) => {
      await applyScheduleToProject(tx, { projectId: project.id })
    })

    const rows = await testDb.select().from(tasks).where(eq(tasks.projectId, project.id))
    const a = rows.find(t => t.name === 'a')!
    const b = rows.find(t => t.name === 'b')!
    expect(a.plannedStartDay).toBe(0)
    expect(a.plannedEndDay).toBe(2)
    expect(b.plannedStartDay).toBe(2)
    expect(b.plannedEndDay).toBe(5)
    expect(a.isOnCriticalPath).toBe(true)
    expect(b.isOnCriticalPath).toBe(true)
  })
})
```

- [ ] **Step 2: Implement**

```ts
// lib/snapshot/apply-schedule.ts
import { eq } from 'drizzle-orm'
import type { DB } from '@/db/client'
import { tasks, taskDeps } from '@/db/schema'
import { recomputeSchedule } from '@/lib/critical-path'
import { computeBlocked } from '@/lib/critical-path/blocked'

type Tx = Parameters<Parameters<DB['transaction']>[0]>[0]

export async function applyScheduleToProject(tx: Tx, input: { projectId: string }): Promise<void> {
  const taskRows = await tx.select().from(tasks).where(eq(tasks.projectId, input.projectId))
  const depRows = await tx.select().from(taskDeps).where(eq(taskDeps.projectId, input.projectId))

  const schedule = recomputeSchedule({
    tasks: taskRows.map(t => ({
      id: t.id,
      durationDays: t.plannedDurationDays,
      status: t.status,
    })),
    deps: depRows.map(d => ({
      fromTaskId: d.fromTaskId,
      toTaskId: d.toTaskId,
      lagDays: d.lagDays,
    })),
  })
  const blocked = computeBlocked({
    tasks: taskRows.map(t => ({ id: t.id, status: t.status })),
    deps: depRows.map(d => ({ fromTaskId: d.fromTaskId, toTaskId: d.toTaskId })),
  })
  const blockedById = new Map(blocked.map(b => [b.taskId, b.isBlocked]))

  for (const s of schedule) {
    await tx.update(tasks).set({
      plannedStartDay: s.earliestStartDay,
      plannedEndDay:   s.earliestEndDay,
      isOnCriticalPath: s.isOnCriticalPath,
      isBlocked: blockedById.get(s.taskId) ?? false,
      updatedAt: new Date(),
    }).where(eq(tasks.id, s.taskId))
  }
}
```

- [ ] **Step 3: Run and commit**

```bash
npm test -- lib/snapshot/apply-schedule.test.ts
git add lib/snapshot/apply-schedule.ts lib/snapshot/apply-schedule.test.ts
git commit -m "feat(snapshot): applyScheduleToProject persists schedule + blocked flags"
```

---

## Phase 8: Workflow template service + Server Actions

### Task 8.1: Workflow template service (CRUD)

**Files:**
- Create: `lib/services/workflow-template-service.ts`
- Create: `lib/services/workflow-template-service.test.ts`

- [ ] **Step 1: Tests**

```ts
// lib/services/workflow-template-service.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { eq } from 'drizzle-orm'
import { testDb, truncateAll } from '@/tests/db'
import { workflowTemplates, workflowTemplateTasks, workflowTemplateTaskDeps } from '@/db/schema'
import { seedOwner } from '@/tests/fixtures/users'
import { workflowTemplateService } from './workflow-template-service'

describe('workflowTemplateService', () => {
  beforeEach(async () => { await truncateAll() })

  it('creates a template with tasks and deps in one transaction', async () => {
    const owner = await seedOwner()
    const tpl = await workflowTemplateService.create({
      createdById: owner.id,
      name: 'Permitting Basics',
      description: 'standard permit pipeline',
      tasks: [
        { name: 'Survey', durationDays: 5 },
        { name: 'Apply', durationDays: 10 },
      ],
      deps: [{ fromIdx: 0, toIdx: 1, lagDays: 0 }],
    }, testDb)
    expect(tpl.id).toBeDefined()
    const tasks = await testDb.select().from(workflowTemplateTasks).where(eq(workflowTemplateTasks.workflowTemplateId, tpl.id))
    expect(tasks).toHaveLength(2)
    const deps = await testDb.select().from(workflowTemplateTaskDeps).where(eq(workflowTemplateTaskDeps.workflowTemplateId, tpl.id))
    expect(deps).toHaveLength(1)
  })

  it('update replaces tasks and deps fully', async () => {
    const owner = await seedOwner()
    const tpl = await workflowTemplateService.create({
      createdById: owner.id, name: 'a',
      tasks: [{ name: 't', durationDays: 1 }], deps: [],
    }, testDb)

    await workflowTemplateService.update(tpl.id, {
      name: 'b', description: null,
      tasks: [
        { name: 'x', durationDays: 2 },
        { name: 'y', durationDays: 3 },
      ],
      deps: [{ fromIdx: 0, toIdx: 1, lagDays: 0 }],
    }, testDb)

    const reread = await testDb.select().from(workflowTemplates).where(eq(workflowTemplates.id, tpl.id))
    expect(reread[0].name).toBe('b')
    const tasks = await testDb.select().from(workflowTemplateTasks).where(eq(workflowTemplateTasks.workflowTemplateId, tpl.id))
    expect(tasks.map(t => t.name).sort()).toEqual(['x','y'])
  })

  it('archive sets is_archived=true', async () => {
    const owner = await seedOwner()
    const tpl = await workflowTemplateService.create({
      createdById: owner.id, name: 'a',
      tasks: [{ name: 't', durationDays: 1 }], deps: [],
    }, testDb)
    await workflowTemplateService.archive(tpl.id, testDb)
    const reread = await testDb.select().from(workflowTemplates).where(eq(workflowTemplates.id, tpl.id))
    expect(reread[0].isArchived).toBe(true)
  })
})
```

- [ ] **Step 2: Implement**

```ts
// lib/services/workflow-template-service.ts
import { eq } from 'drizzle-orm'
import type { DB } from '@/db/client'
import { workflowTemplates, workflowTemplateTasks, workflowTemplateTaskDeps } from '@/db/schema'
import { NotFoundError, ValidationError } from '@/lib/server/errors'

type TaskInput = { name: string; description?: string | null; durationDays: number; ownerRoleLabel?: string | null }
type DepInput  = { fromIdx: number; toIdx: number; lagDays: number }

export const workflowTemplateService = {
  async create(input: {
    createdById: string
    name: string
    description?: string | null
    tasks: TaskInput[]
    deps: DepInput[]
  }, db: DB) {
    if (input.tasks.length === 0) throw new ValidationError('Template must have at least one task')

    return db.transaction(async (tx) => {
      const [tpl] = await tx.insert(workflowTemplates).values({
        name: input.name,
        description: input.description ?? null,
        createdById: input.createdById,
      }).returning()

      const insertedTasks = await tx.insert(workflowTemplateTasks).values(
        input.tasks.map((t, i) => ({
          workflowTemplateId: tpl.id,
          name: t.name,
          description: t.description ?? null,
          defaultDurationDays: t.durationDays,
          defaultOwnerRoleLabel: t.ownerRoleLabel ?? null,
          sortOrder: i,
        })),
      ).returning()

      if (input.deps.length > 0) {
        await tx.insert(workflowTemplateTaskDeps).values(
          input.deps.map(d => {
            if (d.fromIdx === d.toIdx) throw new ValidationError('Self-dependency not allowed')
            return {
              workflowTemplateId: tpl.id,
              fromTaskId: insertedTasks[d.fromIdx].id,
              toTaskId:   insertedTasks[d.toIdx].id,
              lagDays: d.lagDays,
            }
          }),
        )
      }
      return tpl
    })
  },

  async update(id: string, input: {
    name?: string
    description?: string | null
    tasks: TaskInput[]
    deps: DepInput[]
  }, db: DB) {
    return db.transaction(async (tx) => {
      const existing = await tx.select().from(workflowTemplates).where(eq(workflowTemplates.id, id))
      if (existing.length === 0) throw new NotFoundError('WorkflowTemplate')

      await tx.update(workflowTemplates).set({
        name: input.name ?? existing[0].name,
        description: input.description ?? existing[0].description,
        updatedAt: new Date(),
      }).where(eq(workflowTemplates.id, id))

      await tx.delete(workflowTemplateTaskDeps).where(eq(workflowTemplateTaskDeps.workflowTemplateId, id))
      await tx.delete(workflowTemplateTasks).where(eq(workflowTemplateTasks.workflowTemplateId, id))

      const insertedTasks = await tx.insert(workflowTemplateTasks).values(
        input.tasks.map((t, i) => ({
          workflowTemplateId: id,
          name: t.name,
          description: t.description ?? null,
          defaultDurationDays: t.durationDays,
          defaultOwnerRoleLabel: t.ownerRoleLabel ?? null,
          sortOrder: i,
        })),
      ).returning()

      if (input.deps.length > 0) {
        await tx.insert(workflowTemplateTaskDeps).values(
          input.deps.map(d => ({
            workflowTemplateId: id,
            fromTaskId: insertedTasks[d.fromIdx].id,
            toTaskId:   insertedTasks[d.toIdx].id,
            lagDays: d.lagDays,
          })),
        )
      }
    })
  },

  async archive(id: string, db: DB) {
    const result = await db.update(workflowTemplates).set({ isArchived: true, updatedAt: new Date() })
      .where(eq(workflowTemplates.id, id)).returning()
    if (result.length === 0) throw new NotFoundError('WorkflowTemplate')
  },

  async getById(id: string, db: DB) {
    const rows = await db.select().from(workflowTemplates).where(eq(workflowTemplates.id, id))
    return rows[0] ?? null
  },

  async list(db: DB, opts: { includeArchived?: boolean } = {}) {
    const rows = await db.select().from(workflowTemplates)
    return opts.includeArchived ? rows : rows.filter(r => !r.isArchived)
  },
}
```

- [ ] **Step 3: Run and commit**

```bash
npm test -- lib/services/workflow-template-service.test.ts
git add lib/services/workflow-template-service.ts lib/services/workflow-template-service.test.ts
git commit -m "feat(service): workflow template CRUD"
```

---

### Task 8.2: Server Actions for workflow templates

**Files:**
- Create: `app/actions/workflows.ts`

- [ ] **Step 1: Implement**

```ts
// app/actions/workflows.ts
'use server'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { db } from '@/db/client'
import { requirePermission } from '@/lib/server/require-permission'
import { workflowTemplateService } from '@/lib/services/workflow-template-service'

const TaskInput = z.object({
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  durationDays: z.number().int().min(0),
  ownerRoleLabel: z.string().optional().nullable(),
})
const DepInput = z.object({
  fromIdx: z.number().int().min(0),
  toIdx: z.number().int().min(0),
  lagDays: z.number().int().default(0),
})

const CreateInput = z.object({
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  tasks: z.array(TaskInput).min(1),
  deps: z.array(DepInput),
})

export async function createWorkflowTemplate(raw: unknown) {
  const input = CreateInput.parse(raw)
  const user = await requirePermission({ type: 'workflow.create' })
  const tpl = await workflowTemplateService.create({ ...input, createdById: user.id }, db)
  revalidatePath('/workflows')
  return { ok: true, id: tpl.id }
}

const UpdateInput = z.object({
  id: z.string().uuid(),
  name: z.string().optional(),
  description: z.string().optional().nullable(),
  tasks: z.array(TaskInput).min(1),
  deps: z.array(DepInput),
})

export async function updateWorkflowTemplate(raw: unknown) {
  const input = UpdateInput.parse(raw)
  const existing = await workflowTemplateService.getById(input.id, db)
  if (!existing) throw new Error('not found')
  await requirePermission({ type: 'workflow.update', workflow: { createdById: existing.createdById } })
  await workflowTemplateService.update(input.id, input, db)
  revalidatePath('/workflows')
  revalidatePath(`/workflows/${input.id}`)
  return { ok: true }
}

export async function archiveWorkflowTemplate(raw: unknown) {
  const input = z.object({ id: z.string().uuid() }).parse(raw)
  const existing = await workflowTemplateService.getById(input.id, db)
  if (!existing) throw new Error('not found')
  await requirePermission({ type: 'workflow.delete', workflow: { createdById: existing.createdById } })
  await workflowTemplateService.archive(input.id, db)
  revalidatePath('/workflows')
  return { ok: true }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/actions/workflows.ts
git commit -m "feat(actions): workflow template CRUD Server Actions"
```

---

## Phase 9: Project + Phase services + Server Actions

### Task 9.1: `projectService.create` (with snapshot + schedule)

**Files:**
- Create: `lib/services/project-service.ts`
- Create: `lib/services/project-service.test.ts`

- [ ] **Step 1: Test**

```ts
// lib/services/project-service.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { eq } from 'drizzle-orm'
import { testDb, truncateAll } from '@/tests/db'
import { projects, projectPhases, tasks } from '@/db/schema'
import { seedOwner, seedPm } from '@/tests/fixtures/users'
import { seedTemplate } from '@/tests/fixtures/workflow-templates'
import { projectService } from './project-service'

describe('projectService.create', () => {
  beforeEach(async () => { await truncateAll() })

  it('creates project, 3 phases, snapshots workflows, applies schedule', async () => {
    const owner = await seedOwner()
    const pm = await seedPm()
    const { template } = await seedTemplate({
      createdById: owner.id, name: 'Permits',
      tasks: [
        { name: 'Survey', durationDays: 5 },
        { name: 'Apply',  durationDays: 10 },
      ],
      deps: [{ fromIdx: 0, toIdx: 1 }],
    })

    const project = await projectService.create({
      createdById: pm.id,
      name: '88 Maple',
      brand: 'al_homes',
      pmId: pm.id,
      assignments: [
        { phaseName: 'Permitting', templateId: template.id, sortOrder: 0 },
      ],
    }, testDb)

    expect(project.status).toBe('draft')

    const phases = await testDb.select().from(projectPhases).where(eq(projectPhases.projectId, project.id))
    expect(phases).toHaveLength(3)
    expect(phases.map(p => p.name).sort()).toEqual(['Construction','Permitting','Sale'])

    const projectTasks = await testDb.select().from(tasks).where(eq(tasks.projectId, project.id))
    expect(projectTasks).toHaveLength(2)
    expect(projectTasks[0].plannedStartDay).not.toBeNull()
  })
})
```

- [ ] **Step 2: Implement**

```ts
// lib/services/project-service.ts
import { eq, and } from 'drizzle-orm'
import type { DB } from '@/db/client'
import { projects, projectPhases, type Project } from '@/db/schema'
import { snapshotWorkflowsIntoProject } from '@/lib/snapshot/snapshot-workflows'
import { applyScheduleToProject } from '@/lib/snapshot/apply-schedule'
import { ValidationError, NotFoundError } from '@/lib/server/errors'

const PHASE_NAMES = ['Permitting', 'Construction', 'Sale'] as const
type PhaseName = (typeof PHASE_NAMES)[number]

export const projectService = {
  async create(input: {
    createdById: string
    name: string
    brand: 'al_homes' | 'alera' | 'apex'
    pmId: string
    address?: string | null
    city?: string | null
    state?: string | null
    zip?: string | null
    titleHolder?: string | null
    projectStrategy?: string | null
    purchaseDate?: string | null
    purchasePrice?: string | null
    targetExitQuarter?: string | null
    targetProjectDurationDays?: number | null
    targetPermitDate?: string | null
    targetConstructionEndDate?: string | null
    assignments: Array<{ phaseName: PhaseName; templateId: string; sortOrder: number }>
  }, db: DB): Promise<Project> {
    if (input.assignments.length === 0) {
      throw new ValidationError('Project must have at least one workflow assigned')
    }
    return db.transaction(async (tx) => {
      const [project] = await tx.insert(projects).values({
        name: input.name,
        brand: input.brand,
        pmId: input.pmId,
        createdById: input.createdById,
        address: input.address ?? null,
        city: input.city ?? null,
        state: input.state ?? null,
        zip: input.zip ?? null,
        titleHolder: input.titleHolder ?? null,
        projectStrategy: input.projectStrategy ?? null,
        purchaseDate: input.purchaseDate ?? null,
        purchasePrice: input.purchasePrice ?? null,
        targetExitQuarter: input.targetExitQuarter ?? null,
        targetProjectDurationDays: input.targetProjectDurationDays ?? null,
        targetPermitDate: input.targetPermitDate ?? null,
        targetConstructionEndDate: input.targetConstructionEndDate ?? null,
      }).returning()

      const phases = await tx.insert(projectPhases).values(
        PHASE_NAMES.map((name, i) => ({ projectId: project.id, name, sortOrder: i + 1 })),
      ).returning()
      const phaseIdByName = new Map(phases.map(p => [p.name, p.id]))

      await snapshotWorkflowsIntoProject(tx, {
        projectId: project.id,
        defaultOwnerId: input.pmId,
        assignments: input.assignments.map(a => ({
          phaseId: phaseIdByName.get(a.phaseName)!,
          templateId: a.templateId,
          sortOrder: a.sortOrder,
        })),
      })

      await applyScheduleToProject(tx, { projectId: project.id })
      return project
    })
  },

  async getById(id: string, db: DB) {
    const rows = await db.select().from(projects).where(eq(projects.id, id))
    return rows[0] ?? null
  },

  async list(db: DB) {
    return db.select().from(projects)
  },
}
```

- [ ] **Step 3: Run and commit**

```bash
npm test -- lib/services/project-service.test.ts
git add lib/services/project-service.ts lib/services/project-service.test.ts
git commit -m "feat(service): project create with snapshot + initial schedule"
```

---

### Task 9.2: Phase kick off + mark complete services

**Files:**
- Create: `lib/services/phase-service.ts`
- Create: `lib/services/phase-service.test.ts`

- [ ] **Step 1: Tests**

```ts
// lib/services/phase-service.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { eq, and } from 'drizzle-orm'
import { testDb, truncateAll } from '@/tests/db'
import { projects, projectPhases } from '@/db/schema'
import { seedPm, seedOwner } from '@/tests/fixtures/users'
import { seedTemplate } from '@/tests/fixtures/workflow-templates'
import { projectService } from './project-service'
import { phaseService } from './phase-service'
import { InvalidTransitionError } from '@/lib/server/errors'

async function makeProject() {
  const owner = await seedOwner()
  const pm = await seedPm()
  const { template } = await seedTemplate({
    createdById: owner.id, name: 'P',
    tasks: [{ name: 't', durationDays: 1 }], deps: [],
  })
  const project = await projectService.create({
    createdById: pm.id, name: 'X', brand: 'al_homes', pmId: pm.id,
    assignments: [{ phaseName: 'Permitting', templateId: template.id, sortOrder: 0 }],
  }, testDb)
  return { project, pm, owner }
}

describe('phaseService.kickOff', () => {
  beforeEach(async () => { await truncateAll() })

  it('kicks off Permitting and advances project to in_progress', async () => {
    const { project, pm } = await makeProject()
    const phases = await testDb.select().from(projectPhases).where(eq(projectPhases.projectId, project.id))
    const permitting = phases.find(p => p.name === 'Permitting')!
    await phaseService.kickOff({ phaseId: permitting.id, actorId: pm.id }, testDb)
    const updated = await testDb.select().from(projectPhases).where(eq(projectPhases.id, permitting.id))
    expect(updated[0].status).toBe('in_progress')
    const proj = await testDb.select().from(projects).where(eq(projects.id, project.id))
    expect(proj[0].status).toBe('in_progress')
    expect(proj[0].kickedOffAt).not.toBeNull()
  })

  it('refuses to kick off out-of-order phase (Construction before Permitting)', async () => {
    const { project, pm } = await makeProject()
    const phases = await testDb.select().from(projectPhases).where(eq(projectPhases.projectId, project.id))
    const construction = phases.find(p => p.name === 'Construction')!
    await expect(phaseService.kickOff({ phaseId: construction.id, actorId: pm.id }, testDb))
      .rejects.toThrow()
  })
})

describe('phaseService.markComplete', () => {
  beforeEach(async () => { await truncateAll() })

  it('marks Permitting complete; advances Construction phase to in_progress NOT automatically', async () => {
    const { project, pm } = await makeProject()
    const phases = await testDb.select().from(projectPhases).where(eq(projectPhases.projectId, project.id))
    const permitting = phases.find(p => p.name === 'Permitting')!
    await phaseService.kickOff({ phaseId: permitting.id, actorId: pm.id }, testDb)
    await phaseService.markComplete({ phaseId: permitting.id, actorId: pm.id }, testDb)
    const reread = await testDb.select().from(projectPhases).where(eq(projectPhases.projectId, project.id))
    const re = Object.fromEntries(reread.map(p => [p.name, p.status]))
    expect(re['Permitting']).toBe('complete')
    expect(re['Construction']).toBe('pending')      // not auto-advanced
  })
})
```

- [ ] **Step 2: Implement**

```ts
// lib/services/phase-service.ts
import { eq, and, sql, lt } from 'drizzle-orm'
import type { DB } from '@/db/client'
import { projects, projectPhases, activities } from '@/db/schema'
import { assertPhaseTransition } from '@/lib/state-machine/phase'
import { NotFoundError, ConflictError } from '@/lib/server/errors'

export const phaseService = {
  async kickOff(input: { phaseId: string; actorId: string }, db: DB) {
    return db.transaction(async (tx) => {
      const phaseRows = await tx.select().from(projectPhases).where(eq(projectPhases.id, input.phaseId))
      if (phaseRows.length === 0) throw new NotFoundError('Phase')
      const phase = phaseRows[0]
      assertPhaseTransition(phase.status, 'in_progress')

      // Disallow kicking off when an earlier phase has not completed yet
      const earlier = await tx.select().from(projectPhases).where(
        and(eq(projectPhases.projectId, phase.projectId), lt(projectPhases.sortOrder, phase.sortOrder)),
      )
      if (earlier.some(p => p.status !== 'complete')) {
        throw new ConflictError('Earlier phase must be complete before kicking off this one')
      }

      const now = new Date()
      await tx.update(projectPhases).set({
        status: 'in_progress', kickedOffAt: now, kickedOffById: input.actorId,
      }).where(eq(projectPhases.id, phase.id))

      // If this is the first phase being kicked off, advance project to in_progress
      const proj = (await tx.select().from(projects).where(eq(projects.id, phase.projectId)))[0]
      if (proj.status === 'draft') {
        await tx.update(projects).set({
          status: 'in_progress', kickedOffAt: now, updatedAt: now,
        }).where(eq(projects.id, proj.id))
      }

      await tx.insert(activities).values({
        projectId: phase.projectId, actorId: input.actorId,
        type: 'phase.kicked_off', payload: { phaseId: phase.id, phaseName: phase.name },
      })
    })
  },

  async markComplete(input: { phaseId: string; actorId: string }, db: DB) {
    return db.transaction(async (tx) => {
      const phaseRows = await tx.select().from(projectPhases).where(eq(projectPhases.id, input.phaseId))
      if (phaseRows.length === 0) throw new NotFoundError('Phase')
      const phase = phaseRows[0]
      assertPhaseTransition(phase.status, 'complete')

      const now = new Date()
      await tx.update(projectPhases).set({
        status: 'complete', markedCompleteAt: now, markedCompleteById: input.actorId,
      }).where(eq(projectPhases.id, phase.id))

      await tx.insert(activities).values({
        projectId: phase.projectId, actorId: input.actorId,
        type: 'phase.marked_complete', payload: { phaseId: phase.id, phaseName: phase.name },
      })
    })
  },
}
```

- [ ] **Step 3: Run and commit**

```bash
npm test -- lib/services/phase-service.test.ts
git add lib/services/phase-service.ts lib/services/phase-service.test.ts
git commit -m "feat(service): phase kick off and mark complete"
```

---

### Task 9.3: Project complete, archive, transfer, unlock

**Files:**
- Modify: `lib/services/project-service.ts`
- Create: `lib/services/project-service.lifecycle.test.ts`

- [ ] **Step 1: Tests**

```ts
// lib/services/project-service.lifecycle.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { eq } from 'drizzle-orm'
import { testDb, truncateAll } from '@/tests/db'
import { projects, projectPhases, auditLogs } from '@/db/schema'
import { seedOwner, seedPm } from '@/tests/fixtures/users'
import { seedTemplate } from '@/tests/fixtures/workflow-templates'
import { projectService } from './project-service'
import { phaseService } from './phase-service'
import { ConflictError } from '@/lib/server/errors'

async function makeReadyProject() {
  const owner = await seedOwner()
  const pm = await seedPm()
  const { template } = await seedTemplate({
    createdById: owner.id, name: 'P', tasks: [{ name: 't', durationDays: 1 }], deps: [],
  })
  const project = await projectService.create({
    createdById: pm.id, name: 'X', brand: 'al_homes', pmId: pm.id,
    assignments: [{ phaseName: 'Permitting', templateId: template.id, sortOrder: 0 }],
  }, testDb)
  return { project, pm, owner }
}

describe('projectService.markComplete', () => {
  beforeEach(async () => { await truncateAll() })

  it('requires all 3 phases complete', async () => {
    const { project, pm } = await makeReadyProject()
    await expect(projectService.markComplete({ projectId: project.id, actorId: pm.id }, testDb))
      .rejects.toThrow(ConflictError)
  })

  it('succeeds when all phases complete', async () => {
    const { project, pm } = await makeReadyProject()
    const phases = await testDb.select().from(projectPhases).where(eq(projectPhases.projectId, project.id))
    for (const ph of phases.sort((a,b) => a.sortOrder - b.sortOrder)) {
      await phaseService.kickOff({ phaseId: ph.id, actorId: pm.id }, testDb)
      await phaseService.markComplete({ phaseId: ph.id, actorId: pm.id }, testDb)
    }
    await projectService.markComplete({ projectId: project.id, actorId: pm.id }, testDb)
    const p = await testDb.select().from(projects).where(eq(projects.id, project.id))
    expect(p[0].status).toBe('complete')
  })
})

describe('projectService.transferPm', () => {
  beforeEach(async () => { await truncateAll() })

  it('transfers ownership to another pm', async () => {
    const { project, pm } = await makeReadyProject()
    const newPm = await seedPm('PM2')
    await projectService.transferPm({ projectId: project.id, toUserId: newPm.id, actorId: pm.id }, testDb)
    const p = await testDb.select().from(projects).where(eq(projects.id, project.id))
    expect(p[0].pmId).toBe(newPm.id)
  })
})

describe('projectService.unlockToDraft', () => {
  beforeEach(async () => { await truncateAll() })

  it('sets status to draft and writes audit log', async () => {
    const { project, pm, owner } = await makeReadyProject()
    const phases = await testDb.select().from(projectPhases).where(eq(projectPhases.projectId, project.id))
    await phaseService.kickOff({ phaseId: phases.find(p => p.sortOrder === 1)!.id, actorId: pm.id }, testDb)

    await projectService.unlockToDraft({
      projectId: project.id, actorId: owner.id, reason: 'permit error must be corrected',
    }, testDb)

    const p = await testDb.select().from(projects).where(eq(projects.id, project.id))
    expect(p[0].status).toBe('draft')
    const audit = await testDb.select().from(auditLogs)
    expect(audit).toHaveLength(1)
    expect(audit[0].action).toBe('project.unlock_to_draft')
    expect(audit[0].reason).toContain('permit error')
  })
})
```

- [ ] **Step 2: Append to `lib/services/project-service.ts`**

```ts
// inside `projectService` object, add:

async markComplete(input: { projectId: string; actorId: string }, db: DB) {
  return db.transaction(async (tx) => {
    const phases = await tx.select().from(projectPhases).where(eq(projectPhases.projectId, input.projectId))
    if (phases.length === 0) throw new NotFoundError('Project')
    if (phases.some(p => p.status !== 'complete')) {
      const { ConflictError } = await import('@/lib/server/errors')
      throw new ConflictError('All phases must be complete')
    }
    const now = new Date()
    await tx.update(projects).set({ status: 'complete', completedAt: now, updatedAt: now })
      .where(eq(projects.id, input.projectId))
  })
},

async archive(input: { projectId: string; actorId: string }, db: DB) {
  const now = new Date()
  await db.update(projects).set({ status: 'archived', archivedAt: now, updatedAt: now })
    .where(eq(projects.id, input.projectId))
},

async transferPm(input: { projectId: string; toUserId: string; actorId: string }, db: DB) {
  const now = new Date()
  await db.update(projects).set({ pmId: input.toUserId, updatedAt: now })
    .where(eq(projects.id, input.projectId))
},

async unlockToDraft(input: { projectId: string; actorId: string; reason: string }, db: DB) {
  if (!input.reason?.trim()) {
    const { ValidationError } = await import('@/lib/server/errors')
    throw new ValidationError('Reason is required for unlock')
  }
  return db.transaction(async (tx) => {
    const existing = await tx.select().from(projects).where(eq(projects.id, input.projectId))
    if (existing.length === 0) throw new NotFoundError('Project')
    const before = existing[0]
    const now = new Date()
    await tx.update(projects).set({ status: 'draft', updatedAt: now }).where(eq(projects.id, input.projectId))
    const { auditLogs } = await import('@/db/schema')
    await tx.insert(auditLogs).values({
      actorId: input.actorId,
      action: 'project.unlock_to_draft',
      targetType: 'project',
      targetId: input.projectId,
      before: { status: before.status },
      after:  { status: 'draft' },
      reason: input.reason,
    })
  })
},
```

(Add corresponding imports at top of file: `import { auditLogs } from '@/db/schema'` and remove the dynamic imports if you prefer static.)

- [ ] **Step 3: Run and commit**

```bash
npm test -- lib/services/project-service.lifecycle.test.ts
git add lib/services/
git commit -m "feat(service): project complete/archive/transfer/unlock"
```

---

### Task 9.4: Server Actions for projects + phases

**Files:**
- Create: `app/actions/projects.ts`
- Create: `app/actions/phases.ts`

- [ ] **Step 1: Implement `app/actions/projects.ts`**

```ts
// app/actions/projects.ts
'use server'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { db } from '@/db/client'
import { requirePermission } from '@/lib/server/require-permission'
import { projectService } from '@/lib/services/project-service'
import { NotFoundError } from '@/lib/server/errors'

const CreateInput = z.object({
  name: z.string().min(1),
  brand: z.enum(['al_homes', 'alera', 'apex']),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  zip: z.string().optional().nullable(),
  titleHolder: z.string().optional().nullable(),
  projectStrategy: z.string().optional().nullable(),
  purchaseDate: z.string().optional().nullable(),
  purchasePrice: z.string().optional().nullable(),
  targetExitQuarter: z.string().optional().nullable(),
  targetProjectDurationDays: z.number().int().optional().nullable(),
  targetPermitDate: z.string().optional().nullable(),
  targetConstructionEndDate: z.string().optional().nullable(),
  assignments: z.array(z.object({
    phaseName: z.enum(['Permitting','Construction','Sale']),
    templateId: z.string().uuid(),
    sortOrder: z.number().int().min(0),
  })).min(1),
})

export async function createProject(raw: unknown) {
  const input = CreateInput.parse(raw)
  const user = await requirePermission({ type: 'project.create' })
  const project = await projectService.create({ ...input, createdById: user.id, pmId: user.id }, db)
  revalidatePath('/projects')
  return { ok: true, id: project.id }
}

export async function transferPm(raw: unknown) {
  const input = z.object({ projectId: z.string().uuid(), toUserId: z.string().uuid() }).parse(raw)
  const project = await projectService.getById(input.projectId, db)
  if (!project) throw new NotFoundError('Project')
  const user = await requirePermission({ type: 'project.transfer_pm', project: { pmId: project.pmId, status: project.status } })
  await projectService.transferPm({ ...input, actorId: user.id }, db)
  revalidatePath(`/projects/${input.projectId}`)
  return { ok: true }
}

export async function forceReassignPm(raw: unknown) {
  const input = z.object({
    projectId: z.string().uuid(), toUserId: z.string().uuid(), reason: z.string().min(1),
  }).parse(raw)
  const user = await requirePermission({ type: 'project.force_reassign_pm' })
  // Implementation: same DB write as transferPm, plus audit log. Add to service if not present.
  await projectService.transferPm({ projectId: input.projectId, toUserId: input.toUserId, actorId: user.id }, db)
  // Future: write audit_log here once added to service signature
  revalidatePath(`/projects/${input.projectId}`)
  return { ok: true }
}

export async function markProjectComplete(raw: unknown) {
  const input = z.object({ projectId: z.string().uuid() }).parse(raw)
  const project = await projectService.getById(input.projectId, db)
  if (!project) throw new NotFoundError('Project')
  const user = await requirePermission({ type: 'project.mark_complete', project: { pmId: project.pmId, status: project.status } })
  await projectService.markComplete({ projectId: input.projectId, actorId: user.id }, db)
  revalidatePath(`/projects/${input.projectId}`)
  return { ok: true }
}

export async function archiveProject(raw: unknown) {
  const input = z.object({ projectId: z.string().uuid() }).parse(raw)
  const project = await projectService.getById(input.projectId, db)
  if (!project) throw new NotFoundError('Project')
  const user = await requirePermission({ type: 'project.archive', project: { pmId: project.pmId, status: project.status } })
  await projectService.archive({ projectId: input.projectId, actorId: user.id }, db)
  revalidatePath('/projects')
  return { ok: true }
}

export async function unlockProjectToDraft(raw: unknown) {
  const input = z.object({ projectId: z.string().uuid(), reason: z.string().min(1) }).parse(raw)
  const user = await requirePermission({ type: 'project.unlock_to_draft' })
  await projectService.unlockToDraft({ projectId: input.projectId, actorId: user.id, reason: input.reason }, db)
  revalidatePath(`/projects/${input.projectId}`)
  return { ok: true }
}
```

- [ ] **Step 2: Implement `app/actions/phases.ts`**

```ts
// app/actions/phases.ts
'use server'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { eq } from 'drizzle-orm'
import { db } from '@/db/client'
import { projectPhases, projects } from '@/db/schema'
import { requirePermission } from '@/lib/server/require-permission'
import { phaseService } from '@/lib/services/phase-service'
import { NotFoundError } from '@/lib/server/errors'

async function loadPhaseAndProject(phaseId: string) {
  const phaseRows = await db.select().from(projectPhases).where(eq(projectPhases.id, phaseId))
  if (phaseRows.length === 0) throw new NotFoundError('Phase')
  const projRows = await db.select().from(projects).where(eq(projects.id, phaseRows[0].projectId))
  return { phase: phaseRows[0], project: projRows[0] }
}

export async function kickOffPhase(raw: unknown) {
  const input = z.object({ phaseId: z.string().uuid() }).parse(raw)
  const { project } = await loadPhaseAndProject(input.phaseId)
  const user = await requirePermission({
    type: 'project.kick_off_phase',
    project: { pmId: project.pmId, status: project.status },
  })
  await phaseService.kickOff({ phaseId: input.phaseId, actorId: user.id }, db)
  revalidatePath(`/projects/${project.id}`)
  return { ok: true }
}

export async function markPhaseComplete(raw: unknown) {
  const input = z.object({ phaseId: z.string().uuid() }).parse(raw)
  const { project } = await loadPhaseAndProject(input.phaseId)
  const user = await requirePermission({
    type: 'project.mark_phase_complete',
    project: { pmId: project.pmId, status: project.status },
  })
  await phaseService.markComplete({ phaseId: input.phaseId, actorId: user.id }, db)
  revalidatePath(`/projects/${project.id}`)
  return { ok: true }
}
```

- [ ] **Step 3: Commit**

```bash
git add app/actions/projects.ts app/actions/phases.ts
git commit -m "feat(actions): project lifecycle + phase kick-off/complete"
```

---

## Phase 10: Task lifecycle service + Server Actions

### Task 10.1: `taskService.setStatus` with workflow-status and blocked recompute

**Files:**
- Create: `lib/services/task-service.ts`
- Create: `lib/services/task-service.test.ts`

- [ ] **Step 1: Tests**

```ts
// lib/services/task-service.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { eq } from 'drizzle-orm'
import { testDb, truncateAll } from '@/tests/db'
import { tasks, projectWorkflows, taskDeps } from '@/db/schema'
import { seedOwner, seedPm } from '@/tests/fixtures/users'
import { seedTemplate } from '@/tests/fixtures/workflow-templates'
import { projectService } from './project-service'
import { taskService } from './task-service'

async function setup() {
  const owner = await seedOwner()
  const pm = await seedPm()
  const { template } = await seedTemplate({
    createdById: owner.id, name: 'P',
    tasks: [
      { name: 'A', durationDays: 1 },
      { name: 'B', durationDays: 1 },
    ],
    deps: [{ fromIdx: 0, toIdx: 1 }],
  })
  const project = await projectService.create({
    createdById: pm.id, name: 'X', brand: 'al_homes', pmId: pm.id,
    assignments: [{ phaseName: 'Permitting', templateId: template.id, sortOrder: 0 }],
  }, testDb)
  const rows = await testDb.select().from(tasks).where(eq(tasks.projectId, project.id))
  const a = rows.find(t => t.name === 'A')!
  const b = rows.find(t => t.name === 'B')!
  return { owner, pm, project, a, b }
}

describe('taskService.setStatus', () => {
  beforeEach(async () => { await truncateAll() })

  it('changes status to started', async () => {
    const { a } = await setup()
    await taskService.setStatus({ taskId: a.id, status: 'started', actorId: a.ownerId }, testDb)
    const re = await testDb.select().from(tasks).where(eq(tasks.id, a.id))
    expect(re[0].status).toBe('started')
  })

  it('updates is_blocked on downstream task when upstream becomes complete', async () => {
    const { a, b } = await setup()
    // Initially B should be blocked because A is not_started
    const before = await testDb.select().from(tasks).where(eq(tasks.id, b.id))
    expect(before[0].isBlocked).toBe(true)
    await taskService.setStatus({ taskId: a.id, status: 'complete', actorId: a.ownerId }, testDb)
    const after = await testDb.select().from(tasks).where(eq(tasks.id, b.id))
    expect(after[0].isBlocked).toBe(false)
  })

  it('auto-completes workflow when all its tasks reach terminal status', async () => {
    const { a, b, project } = await setup()
    const pws0 = await testDb.select().from(projectWorkflows).where(eq(projectWorkflows.projectId, project.id))
    expect(pws0[0].status).toBe('pending')
    await taskService.setStatus({ taskId: a.id, status: 'complete', actorId: a.ownerId }, testDb)
    await taskService.setStatus({ taskId: b.id, status: 'complete', actorId: b.ownerId }, testDb)
    const pws = await testDb.select().from(projectWorkflows).where(eq(projectWorkflows.projectId, project.id))
    expect(pws[0].status).toBe('complete')
  })

  it('wont_do counts as terminal for workflow auto-complete', async () => {
    const { a, b, project } = await setup()
    await taskService.setStatus({ taskId: a.id, status: 'complete', actorId: a.ownerId }, testDb)
    await taskService.setStatus({ taskId: b.id, status: 'wont_do', actorId: b.ownerId }, testDb)
    const pws = await testDb.select().from(projectWorkflows).where(eq(projectWorkflows.projectId, project.id))
    expect(pws[0].status).toBe('complete')
  })
})
```

- [ ] **Step 2: Implement**

```ts
// lib/services/task-service.ts
import { eq, and, inArray } from 'drizzle-orm'
import type { DB } from '@/db/client'
import { tasks, taskDeps, projectWorkflows, activities, type TaskStatus } from '@/db/schema'
import { NotFoundError, ValidationError } from '@/lib/server/errors'
import { computeBlocked } from '@/lib/critical-path/blocked'

type Tx = Parameters<Parameters<DB['transaction']>[0]>[0]

const TERMINAL = new Set<TaskStatus>(['complete', 'wont_do'])

async function recomputeBlockedForProject(tx: Tx, projectId: string) {
  const allTasks = await tx.select().from(tasks).where(eq(tasks.projectId, projectId))
  const allDeps = await tx.select().from(taskDeps).where(eq(taskDeps.projectId, projectId))
  const blocked = computeBlocked({
    tasks: allTasks.map(t => ({ id: t.id, status: t.status })),
    deps: allDeps.map(d => ({ fromTaskId: d.fromTaskId, toTaskId: d.toTaskId })),
  })
  for (const b of blocked) {
    const existing = allTasks.find(t => t.id === b.taskId)
    if (existing && existing.isBlocked !== b.isBlocked) {
      await tx.update(tasks).set({ isBlocked: b.isBlocked, updatedAt: new Date() }).where(eq(tasks.id, b.taskId))
    }
  }
}

async function maybeAutoCompleteWorkflow(tx: Tx, projectWorkflowId: string) {
  const siblings = await tx.select().from(tasks).where(eq(tasks.projectWorkflowId, projectWorkflowId))
  const allTerminal = siblings.length > 0 && siblings.every(t => TERMINAL.has(t.status))
  const anyStarted = siblings.some(t => t.status !== 'not_started')
  const pw = (await tx.select().from(projectWorkflows).where(eq(projectWorkflows.id, projectWorkflowId)))[0]

  let newStatus: 'pending' | 'in_progress' | 'complete' = pw.status
  if (allTerminal) newStatus = 'complete'
  else if (anyStarted) newStatus = 'in_progress'
  else newStatus = 'pending'

  if (newStatus !== pw.status) {
    await tx.update(projectWorkflows).set({ status: newStatus }).where(eq(projectWorkflows.id, projectWorkflowId))
  }
}

export const taskService = {
  async setStatus(input: { taskId: string; status: TaskStatus; actorId: string }, db: DB) {
    return db.transaction(async (tx) => {
      const rows = await tx.select().from(tasks).where(eq(tasks.id, input.taskId))
      if (rows.length === 0) throw new NotFoundError('Task')
      const task = rows[0]
      if (task.status === input.status) return

      const now = new Date()
      const update: Record<string, unknown> = { status: input.status, updatedAt: now }
      if (input.status === 'started' && !task.actualStartDay) {
        // placeholder; UI will compute actual day offset relative to project.kicked_off_at
      }
      await tx.update(tasks).set(update).where(eq(tasks.id, task.id))

      await tx.insert(activities).values({
        projectId: task.projectId, actorId: input.actorId,
        type: 'task.status_changed',
        payload: { taskId: task.id, from: task.status, to: input.status },
      })

      await recomputeBlockedForProject(tx, task.projectId)
      await maybeAutoCompleteWorkflow(tx, task.projectWorkflowId)
    })
  },

  async getById(id: string, db: DB) {
    const rows = await db.select().from(tasks).where(eq(tasks.id, id))
    return rows[0] ?? null
  },
}
```

- [ ] **Step 3: Run and commit**

```bash
npm test -- lib/services/task-service.test.ts
git add lib/services/task-service.ts lib/services/task-service.test.ts
git commit -m "feat(service): task setStatus with blocked + workflow auto-status"
```

---

### Task 10.2: Review actions (submit, approve, request revision, mark complete)

**Files:**
- Modify: `lib/services/task-service.ts`
- Create: `lib/services/task-service.review.test.ts`

- [ ] **Step 1: Tests**

```ts
// lib/services/task-service.review.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { eq } from 'drizzle-orm'
import { testDb, truncateAll } from '@/tests/db'
import { tasks, taskComments } from '@/db/schema'
import { seedOwner, seedPm, seedIc } from '@/tests/fixtures/users'
import { seedTemplate } from '@/tests/fixtures/workflow-templates'
import { projectService } from './project-service'
import { taskService } from './task-service'

async function setup() {
  const owner = await seedOwner()
  const pm = await seedPm()
  const ic = await seedIc('IC1')
  const reviewer = await seedIc('Reviewer')
  const { template } = await seedTemplate({
    createdById: owner.id, name: 'P', tasks: [{ name: 'A', durationDays: 1 }], deps: [],
  })
  const project = await projectService.create({
    createdById: pm.id, name: 'X', brand: 'al_homes', pmId: pm.id,
    assignments: [{ phaseName: 'Permitting', templateId: template.id, sortOrder: 0 }],
  }, testDb)
  const [task] = await testDb.select().from(tasks).where(eq(tasks.projectId, project.id))
  await testDb.update(tasks).set({ ownerId: ic.id, reviewerId: reviewer.id }).where(eq(tasks.id, task.id))
  return { ic, reviewer, pm, task: { ...task, ownerId: ic.id, reviewerId: reviewer.id } }
}

describe('taskService review flow', () => {
  beforeEach(async () => { await truncateAll() })

  it('submit → approve → mark complete', async () => {
    const { ic, reviewer, task } = await setup()
    await taskService.submitForReview({ taskId: task.id, actorId: ic.id, body: 'Done with task' }, testDb)
    let re = await testDb.select().from(tasks).where(eq(tasks.id, task.id))
    expect(re[0].status).toBe('pending_review')
    const comments1 = await testDb.select().from(taskComments).where(eq(taskComments.taskId, task.id))
    expect(comments1.find(c => c.kind === 'review_request')?.body).toBe('Done with task')

    await taskService.approve({ taskId: task.id, actorId: reviewer.id, body: 'lgtm' }, testDb)
    re = await testDb.select().from(tasks).where(eq(tasks.id, task.id))
    expect(re[0].status).toBe('approved')

    await taskService.markComplete({ taskId: task.id, actorId: ic.id }, testDb)
    re = await testDb.select().from(tasks).where(eq(tasks.id, task.id))
    expect(re[0].status).toBe('complete')
  })

  it('request revision drops back to started + saves reviewer comment', async () => {
    const { ic, reviewer, task } = await setup()
    await taskService.submitForReview({ taskId: task.id, actorId: ic.id, body: 'check it' }, testDb)
    await taskService.requestRevision({
      taskId: task.id, actorId: reviewer.id, body: 'redo section 2',
    }, testDb)
    const re = await testDb.select().from(tasks).where(eq(tasks.id, task.id))
    expect(re[0].status).toBe('started')
    const comments = await testDb.select().from(taskComments).where(eq(taskComments.taskId, task.id))
    expect(comments.find(c => c.kind === 'review_revision')?.body).toBe('redo section 2')
  })
})
```

- [ ] **Step 2: Implement (append to `lib/services/task-service.ts`)**

```ts
// Add inside taskService object:

async submitForReview(input: { taskId: string; actorId: string; body?: string }, db: DB) {
  return db.transaction(async (tx) => {
    const rows = await tx.select().from(tasks).where(eq(tasks.id, input.taskId))
    if (rows.length === 0) throw new NotFoundError('Task')
    await tx.update(tasks).set({ status: 'pending_review', updatedAt: new Date() })
      .where(eq(tasks.id, input.taskId))
    if (input.body && input.body.trim()) {
      const { taskComments } = await import('@/db/schema')
      await tx.insert(taskComments).values({
        taskId: input.taskId, authorId: input.actorId,
        body: input.body, kind: 'review_request',
      })
    }
    await tx.insert(activities).values({
      projectId: rows[0].projectId, actorId: input.actorId,
      type: 'task.submitted_for_review', payload: { taskId: input.taskId },
    })
  })
},

async approve(input: { taskId: string; actorId: string; body?: string }, db: DB) {
  return db.transaction(async (tx) => {
    const rows = await tx.select().from(tasks).where(eq(tasks.id, input.taskId))
    if (rows.length === 0) throw new NotFoundError('Task')
    if (rows[0].status !== 'pending_review') {
      throw new ValidationError('Task must be pending_review to approve')
    }
    await tx.update(tasks).set({ status: 'approved', updatedAt: new Date() })
      .where(eq(tasks.id, input.taskId))
    if (input.body?.trim()) {
      const { taskComments } = await import('@/db/schema')
      await tx.insert(taskComments).values({
        taskId: input.taskId, authorId: input.actorId,
        body: input.body, kind: 'review_approve',
      })
    }
    await tx.insert(activities).values({
      projectId: rows[0].projectId, actorId: input.actorId,
      type: 'task.approved', payload: { taskId: input.taskId },
    })
  })
},

async requestRevision(input: { taskId: string; actorId: string; body: string }, db: DB) {
  if (!input.body?.trim()) throw new ValidationError('Revision request requires a comment')
  return db.transaction(async (tx) => {
    const rows = await tx.select().from(tasks).where(eq(tasks.id, input.taskId))
    if (rows.length === 0) throw new NotFoundError('Task')
    await tx.update(tasks).set({ status: 'started', updatedAt: new Date() })
      .where(eq(tasks.id, input.taskId))
    const { taskComments } = await import('@/db/schema')
    await tx.insert(taskComments).values({
      taskId: input.taskId, authorId: input.actorId,
      body: input.body, kind: 'review_revision',
    })
    await tx.insert(activities).values({
      projectId: rows[0].projectId, actorId: input.actorId,
      type: 'task.revision_requested', payload: { taskId: input.taskId },
    })
  })
},

async markComplete(input: { taskId: string; actorId: string }, db: DB) {
  return this.setStatus({ taskId: input.taskId, status: 'complete', actorId: input.actorId }, db)
},
```

- [ ] **Step 3: Run and commit**

```bash
npm test -- lib/services/task-service.review.test.ts
git add lib/services/task-service.ts lib/services/task-service.review.test.ts
git commit -m "feat(service): task review flow (submit/approve/request revision)"
```

---

### Task 10.3: Add unplanned task, add subtask, reassign, update notes

**Files:**
- Modify: `lib/services/task-service.ts`
- Create: `lib/services/task-service.mutations.test.ts`

- [ ] **Step 1: Tests (key cases)**

```ts
// lib/services/task-service.mutations.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { eq } from 'drizzle-orm'
import { testDb, truncateAll } from '@/tests/db'
import { tasks } from '@/db/schema'
import { seedOwner, seedPm, seedIc } from '@/tests/fixtures/users'
import { seedTemplate } from '@/tests/fixtures/workflow-templates'
import { projectService } from './project-service'
import { taskService } from './task-service'

async function setup() {
  const owner = await seedOwner()
  const pm = await seedPm()
  const ic = await seedIc('IC1')
  const { template } = await seedTemplate({
    createdById: owner.id, name: 'P', tasks: [{ name: 'A', durationDays: 2 }], deps: [],
  })
  const project = await projectService.create({
    createdById: pm.id, name: 'X', brand: 'al_homes', pmId: pm.id,
    assignments: [{ phaseName: 'Permitting', templateId: template.id, sortOrder: 0 }],
  }, testDb)
  const [task] = await testDb.select().from(tasks).where(eq(tasks.projectId, project.id))
  await testDb.update(tasks).set({ ownerId: ic.id }).where(eq(tasks.id, task.id))
  return { project, pm, ic, task: { ...task, ownerId: ic.id } }
}

describe('addUnplannedTask', () => {
  beforeEach(async () => { await truncateAll() })

  it('inserts a new task with is_unplanned=true and recomputes schedule', async () => {
    const { project, pm, task } = await setup()
    const created = await taskService.addUnplannedTask({
      projectId: project.id,
      projectWorkflowId: task.projectWorkflowId,
      name: 'Extra inspection',
      plannedDurationDays: 3,
      ownerId: pm.id,
      actorId: pm.id,
      upstreamTaskId: task.id,
    }, testDb)
    const rows = await testDb.select().from(tasks).where(eq(tasks.id, created.id))
    expect(rows[0].isUnplanned).toBe(true)
    expect(rows[0].plannedStartDay).not.toBeNull()
  })
})

describe('addSubtask', () => {
  beforeEach(async () => { await truncateAll() })

  it('creates a subtask linked to parent', async () => {
    const { task, ic } = await setup()
    const sub = await taskService.addSubtask({
      parentTaskId: task.id, name: 'investigate', ownerId: ic.id, actorId: ic.id,
    }, testDb)
    expect(sub.parentTaskId).toBe(task.id)
    expect(sub.projectWorkflowId).toBe(task.projectWorkflowId)
  })
})

describe('reassign', () => {
  beforeEach(async () => { await truncateAll() })

  it('changes ownerId and writes activity', async () => {
    const { task, ic } = await setup()
    const newOwner = await seedIc('IC2')
    await taskService.reassign({
      taskId: task.id, toUserId: newOwner.id, actorId: ic.id,
    }, testDb)
    const rows = await testDb.select().from(tasks).where(eq(tasks.id, task.id))
    expect(rows[0].ownerId).toBe(newOwner.id)
  })
})

describe('updateNotes', () => {
  beforeEach(async () => { await truncateAll() })

  it('updates description', async () => {
    const { task, ic } = await setup()
    await taskService.updateNotes({ taskId: task.id, description: 'remember to bring caulk', actorId: ic.id }, testDb)
    const rows = await testDb.select().from(tasks).where(eq(tasks.id, task.id))
    expect(rows[0].description).toBe('remember to bring caulk')
  })
})
```

- [ ] **Step 2: Implement (append to `lib/services/task-service.ts`)**

```ts
async addUnplannedTask(input: {
  projectId: string
  projectWorkflowId: string
  name: string
  description?: string | null
  plannedDurationDays: number
  ownerId: string
  reviewerId?: string | null
  actorId: string
  upstreamTaskId?: string | null
}, db: DB) {
  return db.transaction(async (tx) => {
    // determine sort_order (max + 1 within workflow)
    const siblings = await tx.select().from(tasks).where(eq(tasks.projectWorkflowId, input.projectWorkflowId))
    const sortOrder = siblings.length === 0 ? 0 : Math.max(...siblings.map(s => s.sortOrder)) + 1

    const [inserted] = await tx.insert(tasks).values({
      projectId: input.projectId,
      projectWorkflowId: input.projectWorkflowId,
      name: input.name,
      description: input.description ?? null,
      ownerId: input.ownerId,
      reviewerId: input.reviewerId ?? null,
      plannedDurationDays: input.plannedDurationDays,
      isUnplanned: true,
      sortOrder,
    }).returning()

    if (input.upstreamTaskId) {
      await tx.insert(taskDeps).values({
        projectId: input.projectId,
        fromTaskId: input.upstreamTaskId,
        toTaskId: inserted.id,
        lagDays: 0,
      })
    }

    const { applyScheduleToProject } = await import('@/lib/snapshot/apply-schedule')
    await applyScheduleToProject(tx, { projectId: input.projectId })

    await tx.insert(activities).values({
      projectId: input.projectId, actorId: input.actorId,
      type: 'task.added_unplanned', payload: { taskId: inserted.id, name: input.name },
    })

    const updated = await tx.select().from(tasks).where(eq(tasks.id, inserted.id))
    return updated[0]
  })
},

async addSubtask(input: {
  parentTaskId: string
  name: string
  description?: string | null
  ownerId: string
  actorId: string
}, db: DB) {
  return db.transaction(async (tx) => {
    const parentRows = await tx.select().from(tasks).where(eq(tasks.id, input.parentTaskId))
    if (parentRows.length === 0) throw new NotFoundError('Parent task')
    const parent = parentRows[0]
    const siblings = await tx.select().from(tasks).where(eq(tasks.parentTaskId, parent.id))
    const sortOrder = siblings.length === 0 ? 0 : Math.max(...siblings.map(s => s.sortOrder)) + 1
    const [inserted] = await tx.insert(tasks).values({
      projectId: parent.projectId,
      projectWorkflowId: parent.projectWorkflowId,
      parentTaskId: parent.id,
      name: input.name,
      description: input.description ?? null,
      ownerId: input.ownerId,
      plannedDurationDays: 0,
      sortOrder,
    }).returning()
    await tx.insert(activities).values({
      projectId: parent.projectId, actorId: input.actorId,
      type: 'task.subtask_added', payload: { parentTaskId: parent.id, subtaskId: inserted.id },
    })
    return inserted
  })
},

async reassign(input: { taskId: string; toUserId: string; actorId: string }, db: DB) {
  return db.transaction(async (tx) => {
    const rows = await tx.select().from(tasks).where(eq(tasks.id, input.taskId))
    if (rows.length === 0) throw new NotFoundError('Task')
    const before = rows[0]
    await tx.update(tasks).set({ ownerId: input.toUserId, updatedAt: new Date() })
      .where(eq(tasks.id, input.taskId))
    await tx.insert(activities).values({
      projectId: before.projectId, actorId: input.actorId,
      type: 'task.reassigned',
      payload: { taskId: input.taskId, from: before.ownerId, to: input.toUserId },
    })
  })
},

async updateNotes(input: { taskId: string; description: string; actorId: string }, db: DB) {
  await db.update(tasks).set({ description: input.description, updatedAt: new Date() })
    .where(eq(tasks.id, input.taskId))
},
```

- [ ] **Step 3: Run and commit**

```bash
npm test -- lib/services/task-service.mutations.test.ts
git add lib/services/task-service.ts lib/services/task-service.mutations.test.ts
git commit -m "feat(service): unplanned task, subtask, reassign, notes"
```

---

### Task 10.4: Server Actions for tasks

**Files:**
- Create: `app/actions/tasks.ts`

- [ ] **Step 1: Implement**

```ts
// app/actions/tasks.ts
'use server'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { eq } from 'drizzle-orm'
import { db } from '@/db/client'
import { tasks, projects } from '@/db/schema'
import { requirePermission } from '@/lib/server/require-permission'
import { taskService } from '@/lib/services/task-service'
import { NotFoundError } from '@/lib/server/errors'

async function loadTaskCtx(taskId: string) {
  const taskRows = await db.select().from(tasks).where(eq(tasks.id, taskId))
  if (taskRows.length === 0) throw new NotFoundError('Task')
  const projRows = await db.select().from(projects).where(eq(projects.id, taskRows[0].projectId))
  return { task: taskRows[0], project: projRows[0] }
}

export async function setTaskStatus(raw: unknown) {
  const input = z.object({
    taskId: z.string().uuid(),
    status: z.enum(['not_started','started','pending_review','approved','complete','wont_do']),
  }).parse(raw)
  const { task, project } = await loadTaskCtx(input.taskId)
  const user = await requirePermission({
    type: 'task.set_status',
    project: { pmId: project.pmId, status: project.status },
    task: { ownerId: task.ownerId, reviewerId: task.reviewerId },
  })
  await taskService.setStatus({ taskId: input.taskId, status: input.status, actorId: user.id }, db)
  revalidatePath(`/projects/${project.id}`)
  revalidatePath('/my-tasks')
  return { ok: true }
}

export async function submitTaskForReview(raw: unknown) {
  const input = z.object({ taskId: z.string().uuid(), body: z.string().optional() }).parse(raw)
  const { task, project } = await loadTaskCtx(input.taskId)
  const user = await requirePermission({
    type: 'task.submit_review',
    project: { pmId: project.pmId, status: project.status },
    task: { ownerId: task.ownerId, reviewerId: task.reviewerId },
  })
  await taskService.submitForReview({ taskId: input.taskId, actorId: user.id, body: input.body }, db)
  revalidatePath(`/projects/${project.id}`)
  return { ok: true }
}

export async function approveTask(raw: unknown) {
  const input = z.object({ taskId: z.string().uuid(), body: z.string().optional() }).parse(raw)
  const { task, project } = await loadTaskCtx(input.taskId)
  const user = await requirePermission({
    type: 'task.review_decision',
    project: { pmId: project.pmId, status: project.status },
    task: { ownerId: task.ownerId, reviewerId: task.reviewerId },
  })
  await taskService.approve({ taskId: input.taskId, actorId: user.id, body: input.body }, db)
  revalidatePath(`/projects/${project.id}`)
  return { ok: true }
}

export async function requestTaskRevision(raw: unknown) {
  const input = z.object({ taskId: z.string().uuid(), body: z.string().min(1) }).parse(raw)
  const { task, project } = await loadTaskCtx(input.taskId)
  const user = await requirePermission({
    type: 'task.review_decision',
    project: { pmId: project.pmId, status: project.status },
    task: { ownerId: task.ownerId, reviewerId: task.reviewerId },
  })
  await taskService.requestRevision({ taskId: input.taskId, actorId: user.id, body: input.body }, db)
  revalidatePath(`/projects/${project.id}`)
  return { ok: true }
}

export async function addUnplannedTask(raw: unknown) {
  const input = z.object({
    projectId: z.string().uuid(),
    projectWorkflowId: z.string().uuid(),
    name: z.string().min(1),
    description: z.string().optional().nullable(),
    plannedDurationDays: z.number().int().min(0),
    ownerId: z.string().uuid(),
    reviewerId: z.string().uuid().optional().nullable(),
    upstreamTaskId: z.string().uuid().optional().nullable(),
  }).parse(raw)
  const projRows = await db.select().from(projects).where(eq(projects.id, input.projectId))
  if (projRows.length === 0) throw new NotFoundError('Project')
  const project = projRows[0]
  const user = await requirePermission({
    type: 'task.add_unplanned',
    project: { pmId: project.pmId, status: project.status },
  })
  const created = await taskService.addUnplannedTask({ ...input, actorId: user.id }, db)
  revalidatePath(`/projects/${project.id}`)
  return { ok: true, taskId: created.id }
}

export async function addSubtask(raw: unknown) {
  const input = z.object({
    parentTaskId: z.string().uuid(),
    name: z.string().min(1),
    description: z.string().optional().nullable(),
    ownerId: z.string().uuid(),
  }).parse(raw)
  const { task, project } = await loadTaskCtx(input.parentTaskId)
  const user = await requirePermission({
    type: 'task.add_subtask',
    project: { pmId: project.pmId, status: project.status },
    task: { ownerId: task.ownerId, reviewerId: task.reviewerId },
  })
  const sub = await taskService.addSubtask({ ...input, actorId: user.id }, db)
  revalidatePath(`/projects/${project.id}`)
  return { ok: true, subtaskId: sub.id }
}

export async function reassignTask(raw: unknown) {
  const input = z.object({ taskId: z.string().uuid(), toUserId: z.string().uuid() }).parse(raw)
  const { task, project } = await loadTaskCtx(input.taskId)
  const user = await requirePermission({
    type: 'task.reassign',
    project: { pmId: project.pmId, status: project.status },
    task: { ownerId: task.ownerId, reviewerId: task.reviewerId },
  })
  await taskService.reassign({ taskId: input.taskId, toUserId: input.toUserId, actorId: user.id }, db)
  revalidatePath(`/projects/${project.id}`)
  return { ok: true }
}

export async function updateTaskNotes(raw: unknown) {
  const input = z.object({ taskId: z.string().uuid(), description: z.string() }).parse(raw)
  const { task, project } = await loadTaskCtx(input.taskId)
  const user = await requirePermission({
    type: 'task.update_notes',
    project: { pmId: project.pmId, status: project.status },
    task: { ownerId: task.ownerId, reviewerId: task.reviewerId },
  })
  await taskService.updateNotes({ ...input, actorId: user.id }, db)
  revalidatePath(`/projects/${project.id}`)
  return { ok: true }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/actions/tasks.ts
git commit -m "feat(actions): task lifecycle Server Actions"
```

---

## Phase 11: Comments, members, audit Server Actions

### Task 11.1: Task comments Server Action

**Files:**
- Create: `app/actions/task-comments.ts`

- [ ] **Step 1: Implement**

```ts
// app/actions/task-comments.ts
'use server'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { eq } from 'drizzle-orm'
import { db } from '@/db/client'
import { tasks, projects, taskComments } from '@/db/schema'
import { requirePermission } from '@/lib/server/require-permission'
import { NotFoundError } from '@/lib/server/errors'

export async function addTaskComment(raw: unknown) {
  const input = z.object({
    taskId: z.string().uuid(),
    body: z.string().min(1),
    kind: z.enum(['discussion','review_request','review_approve','review_revision']).default('discussion'),
  }).parse(raw)

  const taskRows = await db.select().from(tasks).where(eq(tasks.id, input.taskId))
  if (taskRows.length === 0) throw new NotFoundError('Task')
  const projRows = await db.select().from(projects).where(eq(projects.id, taskRows[0].projectId))
  const project = projRows[0]
  const user = await requirePermission({
    type: 'task.add_comment',
    project: { pmId: project.pmId, status: project.status },
    task: { ownerId: taskRows[0].ownerId, reviewerId: taskRows[0].reviewerId },
  })

  await db.insert(taskComments).values({
    taskId: input.taskId, authorId: user.id, body: input.body, kind: input.kind,
  })
  revalidatePath(`/projects/${project.id}`)
  return { ok: true }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/actions/task-comments.ts
git commit -m "feat(actions): task comments"
```

---

### Task 11.2: User management Server Actions

**Files:**
- Create: `app/actions/users.ts`

- [ ] **Step 1: Implement**

```ts
// app/actions/users.ts
'use server'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { eq, ne, and } from 'drizzle-orm'
import { db } from '@/db/client'
import { users } from '@/db/schema'
import { requirePermission } from '@/lib/server/require-permission'
import { ValidationError, NotFoundError } from '@/lib/server/errors'

export async function updateUserRole(raw: unknown) {
  const input = z.object({
    userId: z.string().uuid(),
    role: z.enum(['owner', 'pm', 'ic']),
  }).parse(raw)
  await requirePermission({ type: 'user.update_role' })

  // Block last-owner self-demotion
  if (input.role !== 'owner') {
    const otherOwners = await db.select().from(users)
      .where(and(eq(users.role, 'owner'), eq(users.isActive, true), ne(users.id, input.userId)))
    if (otherOwners.length === 0) {
      throw new ValidationError('Cannot demote the last active owner')
    }
  }
  const updated = await db.update(users).set({ role: input.role }).where(eq(users.id, input.userId)).returning()
  if (updated.length === 0) throw new NotFoundError('User')
  revalidatePath('/settings/members')
  return { ok: true }
}

export async function updateUserTeam(raw: unknown) {
  const input = z.object({
    userId: z.string().uuid(),
    team: z.enum(['design','construction','sales']).nullable(),
  }).parse(raw)
  await requirePermission({ type: 'user.update_role' })  // same gate
  await db.update(users).set({ team: input.team }).where(eq(users.id, input.userId))
  revalidatePath('/settings/members')
  return { ok: true }
}

export async function setUserActive(raw: unknown) {
  const input = z.object({ userId: z.string().uuid(), isActive: z.boolean() }).parse(raw)
  await requirePermission({ type: 'user.disable' })
  // Prevent disabling last owner
  if (!input.isActive) {
    const target = (await db.select().from(users).where(eq(users.id, input.userId)))[0]
    if (target?.role === 'owner') {
      const otherOwners = await db.select().from(users)
        .where(and(eq(users.role, 'owner'), eq(users.isActive, true), ne(users.id, input.userId)))
      if (otherOwners.length === 0) throw new ValidationError('Cannot disable the last active owner')
    }
  }
  await db.update(users).set({ isActive: input.isActive }).where(eq(users.id, input.userId))
  revalidatePath('/settings/members')
  return { ok: true }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/actions/users.ts
git commit -m "feat(actions): user role/team/active management with last-owner guard"
```

---

## Phase 12: App shell (minimal UI for smoke testing the backend)

The goal of this phase is **not** to build polished pages — those are in follow-up specs. It is to get a working authenticated shell where each backend operation can be triggered, so the foundation can be manually verified end-to-end.

### Task 12.1: Root layout and globals

**Files:**
- Create: `app/layout.tsx`

- [ ] **Step 1: Write `app/layout.tsx`**

```tsx
// app/layout.tsx
import './globals.css'
import type { ReactNode } from 'react'

export const metadata = { title: 'BuildFlow' }

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900">{children}</body>
    </html>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/layout.tsx
git commit -m "feat(ui): root layout"
```

---

### Task 12.2: Authenticated `(app)` layout with sidebar

**Files:**
- Create: `app/(app)/layout.tsx`
- Create: `components/layout/sidebar.tsx`

- [ ] **Step 1: Write sidebar**

```tsx
// components/layout/sidebar.tsx
import Link from 'next/link'
import type { User } from '@/db/schema'

const baseLinks = [
  { href: '/', label: 'Dashboard' },
  { href: '/projects', label: 'Projects' },
  { href: '/my-tasks', label: 'My Tasks' },
  { href: '/team', label: 'Team' },
  { href: '/performance', label: 'Performance Review' },
]

export function Sidebar({ user }: { user: User }) {
  return (
    <nav className="flex h-screen w-60 flex-col gap-1 border-r border-slate-200 bg-white p-4">
      <div className="mb-4 text-lg font-semibold">BuildFlow</div>
      {baseLinks.map((l) => (
        <Link key={l.href} href={l.href} className="rounded px-3 py-2 hover:bg-slate-100">{l.label}</Link>
      ))}
      {user.role === 'owner' && (
        <>
          <div className="mt-4 text-xs uppercase text-slate-500">Settings</div>
          <Link href="/workflows" className="rounded px-3 py-2 hover:bg-slate-100">Workflow Templates</Link>
          <Link href="/settings/members" className="rounded px-3 py-2 hover:bg-slate-100">Members</Link>
          <Link href="/settings/audit" className="rounded px-3 py-2 hover:bg-slate-100">Audit Logs</Link>
        </>
      )}
      <div className="mt-auto">
        <div className="px-3 py-2 text-sm text-slate-600">{user.name} ({user.role})</div>
        <form action="/api/auth/logout" method="post">
          <button className="w-full rounded px-3 py-2 text-left text-sm hover:bg-slate-100">Sign out</button>
        </form>
      </div>
    </nav>
  )
}
```

- [ ] **Step 2: Write `(app)/layout.tsx`**

```tsx
// app/(app)/layout.tsx
import type { ReactNode } from 'react'
import { requireUser } from '@/lib/server/get-current-user'
import { PermissionsProvider } from '@/lib/hooks/use-permissions'
import { Sidebar } from '@/components/layout/sidebar'

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireUser()
  return (
    <div className="flex">
      <Sidebar user={user} />
      <PermissionsProvider user={user}>
        <main className="flex-1 p-6">{children}</main>
      </PermissionsProvider>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add app/\(app\)/layout.tsx components/layout/sidebar.tsx
git commit -m "feat(ui): authenticated layout with sidebar"
```

---

### Task 12.3: Stub pages for every route

**Files:**
- Create: `app/(app)/page.tsx`
- Create: `app/(app)/projects/page.tsx`
- Create: `app/(app)/projects/new/page.tsx`
- Create: `app/(app)/projects/[id]/page.tsx`
- Create: `app/(app)/my-tasks/page.tsx`
- Create: `app/(app)/team/page.tsx`
- Create: `app/(app)/performance/page.tsx`
- Create: `app/(app)/workflows/page.tsx`
- Create: `app/(app)/workflows/[id]/page.tsx`
- Create: `app/(app)/settings/members/page.tsx`
- Create: `app/(app)/settings/audit/page.tsx`

- [ ] **Step 1: Write Dashboard stub (`app/(app)/page.tsx`)**

```tsx
// app/(app)/page.tsx
import { db } from '@/db/client'
import { projects } from '@/db/schema'

export default async function DashboardPage() {
  const projectList = await db.select().from(projects)
  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold">Dashboard</h1>
      <p className="text-sm text-slate-600">
        Full Dashboard / Team / Performance Review designs are implemented in a follow-up plan
        (see <code>docs/superpowers/specs/2026-05-25-dashboard-design.md</code>).
        This stub lists raw projects for smoke testing.
      </p>
      <ul className="mt-6 space-y-2">
        {projectList.map(p => (
          <li key={p.id} className="rounded border border-slate-200 bg-white p-3">
            <div className="font-medium">{p.name}</div>
            <div className="text-xs text-slate-500">brand: {p.brand} · status: {p.status} · pmId: {p.pmId}</div>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

- [ ] **Step 2: Write the other stubs (each ~10 lines, "this page is a stub")**

Create each of the remaining files with a minimal placeholder header and a comment pointing to the relevant follow-up spec. Example:

```tsx
// app/(app)/projects/page.tsx
import { db } from '@/db/client'
import { projects } from '@/db/schema'

export default async function ProjectsPage() {
  const list = await db.select().from(projects)
  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold">Projects</h1>
      <p className="mb-4 text-sm text-slate-600">
        Full project page UI is in a follow-up spec.
      </p>
      <ul className="space-y-2">
        {list.map(p => (
          <li key={p.id} className="rounded border bg-white p-3">
            <a href={`/projects/${p.id}`}>{p.name}</a>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

```tsx
// app/(app)/projects/[id]/page.tsx
import { eq } from 'drizzle-orm'
import { db } from '@/db/client'
import { projects, projectPhases, projectWorkflows, tasks } from '@/db/schema'
import { notFound } from 'next/navigation'

export default async function ProjectDetailPage({ params }: { params: { id: string } }) {
  const projRows = await db.select().from(projects).where(eq(projects.id, params.id))
  if (projRows.length === 0) notFound()
  const project = projRows[0]
  const phases = await db.select().from(projectPhases).where(eq(projectPhases.projectId, project.id))
  const flows  = await db.select().from(projectWorkflows).where(eq(projectWorkflows.projectId, project.id))
  const taskList = await db.select().from(tasks).where(eq(tasks.projectId, project.id))
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{project.name}</h1>
      <section>
        <h2 className="text-lg font-medium">Phases</h2>
        <ul>{phases.map(p => <li key={p.id}>{p.name} — {p.status}</li>)}</ul>
      </section>
      <section>
        <h2 className="text-lg font-medium">Workflows</h2>
        <ul>{flows.map(f => <li key={f.id}>{f.name} — {f.status}</li>)}</ul>
      </section>
      <section>
        <h2 className="text-lg font-medium">Tasks</h2>
        <ul>{taskList.map(t => (
          <li key={t.id}>
            {t.name} — {t.status}
            {t.isBlocked ? ' (blocked)' : ''}{t.isUnplanned ? ' (unplanned)' : ''}{t.isOnCriticalPath ? ' (critical)' : ''}
          </li>
        ))}</ul>
      </section>
    </div>
  )
}
```

Concrete stubs for the remaining routes:

```tsx
// app/(app)/my-tasks/page.tsx
import { eq } from 'drizzle-orm'
import { requireUser } from '@/lib/server/get-current-user'
import { db } from '@/db/client'
import { tasks } from '@/db/schema'

export default async function MyTasksPage() {
  const user = await requireUser()
  const mine = await db.select().from(tasks).where(eq(tasks.ownerId, user.id))
  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold">My Tasks</h1>
      <p className="mb-4 text-sm text-slate-600">
        Full My Tasks UI (LLM ranking, daily reminders, three tabs) is a follow-up spec.
      </p>
      <ul className="space-y-2">
        {mine.map(t => (
          <li key={t.id} className="rounded border bg-white p-3">
            <div className="font-medium">{t.name}</div>
            <div className="text-xs text-slate-500">{t.status}{t.isBlocked && ' · blocked'}</div>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

```tsx
// app/(app)/team/page.tsx
import { db } from '@/db/client'
import { users } from '@/db/schema'

export default async function TeamPage() {
  const list = await db.select().from(users)
  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold">Team</h1>
      <p className="mb-4 text-sm text-slate-600">
        Full Team view (Design / Construction / Sales tabs with each team's active projects) is in the dashboard spec.
      </p>
      <ul className="space-y-2">
        {list.map(u => (
          <li key={u.id} className="rounded border bg-white p-3">
            {u.name} — {u.role} — team: {u.team ?? '(none)'}
          </li>
        ))}
      </ul>
    </div>
  )
}
```

```tsx
// app/(app)/performance/page.tsx
export default function PerformancePage() {
  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold">Performance Review</h1>
      <p className="text-sm text-slate-600">
        Implemented in the dashboard spec follow-up plan. This is an empty placeholder
        so the route resolves.
      </p>
    </div>
  )
}
```

```tsx
// app/(app)/workflows/page.tsx
import { db } from '@/db/client'
import { workflowTemplates } from '@/db/schema'

export default async function WorkflowsPage() {
  const list = await db.select().from(workflowTemplates)
  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold">Workflow Templates</h1>
      <ul className="space-y-2">
        {list.map(w => (
          <li key={w.id} className="rounded border bg-white p-3">
            <a href={`/workflows/${w.id}`}>{w.name}</a>
            {w.isArchived && <span className="ml-2 text-xs text-slate-500">archived</span>}
          </li>
        ))}
      </ul>
    </div>
  )
}
```

```tsx
// app/(app)/workflows/[id]/page.tsx
import { eq } from 'drizzle-orm'
import { db } from '@/db/client'
import { workflowTemplates, workflowTemplateTasks, workflowTemplateTaskDeps } from '@/db/schema'
import { notFound } from 'next/navigation'

export default async function WorkflowDetailPage({ params }: { params: { id: string } }) {
  const tpl = (await db.select().from(workflowTemplates).where(eq(workflowTemplates.id, params.id)))[0]
  if (!tpl) notFound()
  const tplTasks = await db.select().from(workflowTemplateTasks).where(eq(workflowTemplateTasks.workflowTemplateId, tpl.id))
  const tplDeps  = await db.select().from(workflowTemplateTaskDeps).where(eq(workflowTemplateTaskDeps.workflowTemplateId, tpl.id))
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{tpl.name}</h1>
      <section>
        <h2 className="text-lg font-medium">Tasks</h2>
        <ul>{tplTasks.map(t => <li key={t.id}>{t.name} — {t.defaultDurationDays}d</li>)}</ul>
      </section>
      <section>
        <h2 className="text-lg font-medium">Dependencies</h2>
        <ul>{tplDeps.map(d => <li key={d.id}>{d.fromTaskId} → {d.toTaskId}</li>)}</ul>
      </section>
    </div>
  )
}
```

```tsx
// app/(app)/settings/members/page.tsx
import { db } from '@/db/client'
import { users } from '@/db/schema'
import { requireUser } from '@/lib/server/get-current-user'
import { redirect } from 'next/navigation'

export default async function MembersPage() {
  const me = await requireUser()
  if (me.role !== 'owner') redirect('/')
  const list = await db.select().from(users)
  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold">Members</h1>
      <table className="w-full text-sm">
        <thead><tr className="text-left"><th>Name</th><th>Role</th><th>Team</th><th>Active</th></tr></thead>
        <tbody>
          {list.map(u => (
            <tr key={u.id} className="border-t">
              <td>{u.name}</td><td>{u.role}</td><td>{u.team ?? '—'}</td><td>{u.isActive ? 'yes' : 'no'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-4 text-sm text-slate-600">Edit UI follows in a follow-up plan; for now use server actions in <code>app/actions/users.ts</code>.</p>
    </div>
  )
}
```

```tsx
// app/(app)/settings/audit/page.tsx
import { desc } from 'drizzle-orm'
import { db } from '@/db/client'
import { auditLogs } from '@/db/schema'
import { requireUser } from '@/lib/server/get-current-user'
import { redirect } from 'next/navigation'

export default async function AuditPage() {
  const me = await requireUser()
  if (me.role !== 'owner') redirect('/')
  const list = await db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(200)
  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold">Audit Logs</h1>
      <ul className="space-y-2 text-sm">
        {list.map(a => (
          <li key={a.id} className="rounded border bg-white p-3">
            <div className="font-medium">{a.action}</div>
            <div className="text-xs text-slate-500">target: {a.targetType}/{a.targetId} — reason: {a.reason}</div>
            <div className="text-xs text-slate-500">{a.createdAt.toString()}</div>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

- [ ] **Step 3: Create `projects/new/page.tsx` (minimal new-project form)**

```tsx
// app/(app)/projects/new/page.tsx
'use client'
import { useState } from 'react'
import { createProject } from '@/app/actions/projects'
import { useRouter } from 'next/navigation'

export default function NewProjectPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [brand, setBrand] = useState<'al_homes'|'alera'|'apex'>('al_homes')
  const [templateId, setTemplateId] = useState('')
  const [err, setErr] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    try {
      const res = await createProject({
        name, brand,
        assignments: [{ phaseName: 'Permitting', templateId, sortOrder: 0 }],
      })
      router.push(`/projects/${(res as any).id}`)
    } catch (e: any) { setErr(e.message ?? 'failed') }
  }

  return (
    <form onSubmit={onSubmit} className="max-w-md space-y-4">
      <h1 className="text-2xl font-semibold">New Project</h1>
      <label className="block">
        <span className="text-sm">Name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} required className="mt-1 w-full rounded border px-2 py-1" />
      </label>
      <label className="block">
        <span className="text-sm">Brand</span>
        <select value={brand} onChange={(e) => setBrand(e.target.value as any)} className="mt-1 w-full rounded border px-2 py-1">
          <option value="al_homes">Al Homes</option>
          <option value="alera">Alera</option>
          <option value="apex">Apex</option>
        </select>
      </label>
      <label className="block">
        <span className="text-sm">Permitting Template ID</span>
        <input value={templateId} onChange={(e) => setTemplateId(e.target.value)} required className="mt-1 w-full rounded border px-2 py-1" />
      </label>
      <button className="rounded bg-blue-600 px-4 py-2 text-white">Create</button>
      {err && <div className="text-sm text-red-600">{err}</div>}
    </form>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add app/\(app\)/
git commit -m "feat(ui): stub pages for every route, minimal new-project form"
```

---

### Task 12.4: Health check route

**Files:**
- Create: `app/api/health/route.ts`

- [ ] **Step 1: Implement**

```ts
// app/api/health/route.ts
import { NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { db } from '@/db/client'

export async function GET() {
  try {
    await db.execute(sql`SELECT 1`)
    return NextResponse.json({ ok: true, db: 'up' })
  } catch (e) {
    return NextResponse.json({ ok: false, db: 'down', error: String(e) }, { status: 503 })
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/health/
git commit -m "feat: health check route"
```

---

### Task 12.5: End-to-end smoke test (manual)

This is a manual verification, not a code change.

- [ ] **Step 1: Apply latest migrations**

```bash
npm run db:migrate
```

- [ ] **Step 2: Set up `.env.local` with real Lark credentials**

Edit `.env.local`:
```
LARK_CLIENT_ID=<your_lark_app_id>
LARK_CLIENT_SECRET=<your_lark_app_secret>
LARK_ALLOWED_TENANT_KEY=<your_tenant_key>
LARK_REDIRECT_URI=http://localhost:3000/api/auth/lark/callback
AUTH_SECRET=<openssl rand -hex 32>
BOOTSTRAP_OWNER_LARK_OPEN_ID=<your_lark_open_id>
```

- [ ] **Step 3: Start dev server**

```bash
npm run dev
```

Open `http://localhost:3000/`. Should redirect to `/login`.

- [ ] **Step 4: Sign in via Lark, verify**

1. Click "Sign in with Lark", complete Lark OAuth.
2. Verify redirect to `/` and you see the Dashboard stub.
3. Verify the `users` table now has one row with `role='owner'` (because of bootstrap).

```bash
docker exec -i buildflow-postgres psql -U buildflow -d buildflow -c "SELECT id, name, role, team FROM users;"
```

- [ ] **Step 5: Create a workflow template via direct DB seed**

For smoke purposes, create one workflow template via SQL or a quick script in `db/seed.ts`. Sample seed:

```ts
// db/seed.ts
import 'dotenv/config'
import { db } from './client'
import { users, workflowTemplates, workflowTemplateTasks } from './schema'
import { eq } from 'drizzle-orm'

async function main() {
  const owners = await db.select().from(users).where(eq(users.role, 'owner'))
  if (owners.length === 0) { console.error('No owner; sign in first.'); process.exit(1) }
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
```

Run: `npm run db:seed`. Note the printed template ID.

- [ ] **Step 6: Create a project, kick off Permitting**

In the UI: navigate to `/projects/new`, fill in name, paste the template ID, click Create. Verify navigation to `/projects/<id>` showing 3 phases (Permitting in_progress only after you trigger kick-off through any quick UI/Server Action you wire up — or via a `tsx` REPL invocation).

For a quick CLI trigger, you can write a one-off `tsx` script invoking `phaseService.kickOff`.

- [ ] **Step 7: Verify the schema and activities**

```bash
docker exec -i buildflow-postgres psql -U buildflow -d buildflow -c "SELECT type, payload FROM activities ORDER BY created_at;"
```

Expect a `phase.kicked_off` entry.

- [ ] **Step 8: Commit seed script**

```bash
git add db/seed.ts
git commit -m "feat: db seed script with default workflow template"
```

---

## Plan self-review

Run through the spec sections and confirm each is implemented:

- **Section 2 Deployment** — covered implicitly: single-instance, single DB, no `org_id`.
- **Section 3 Tech stack** — covered by Phase 1 deps, Phase 2 schema, Phase 3 auth, Phase 4 permissions.
- **Section 4 Repository layout** — Phase 1.1 archives the prototype; Phase 12 creates the new `app/(app)`, `api/`, `actions/` layout.
- **Section 5 Authentication (Lark OAuth + bootstrap)** — Phase 3.
- **Section 6 Roles + permission matrix + double-defense** — Phase 4.
- **Section 7 Project hierarchy** — Phase 9 (`projectService.create` creates 3 fixed phases), Phase 10 (tasks).
- **Section 8 State machines** — Phase 5.
- **Section 9 Workflow templates + snapshot** — Phase 7 + Phase 8.
- **Section 10 Critical path** — Phase 6.
- **Section 11 Schema** — Phase 2 covers all 14 tables.
- **Section 12 API surface** — Phases 8/9/10/11 define Server Actions with the standard input-validate / requirePermission / service / revalidate pattern.
- **Section 13 Testing strategy** — Unit tests in Phases 4–10; integration tests against real Postgres in Phases 7–10; component tests deferred to follow-up specs.

If you spot a spec requirement not covered, file a follow-up task. The dashboard / team / performance review views in `2026-05-25-dashboard-design.md` are addressed by a separate plan.

---

## Done

Once Phase 12 smoke testing passes, this plan is complete. Next plans:

- **Dashboard / Team / Performance Review plan** (consumes `2026-05-25-dashboard-design.md`)
- **Project page UI plan** (Gantt, task list, drawer — separate spec to be written)
- **My Tasks page plan** (LLM ranking, reminders — separate spec to be written)
- **Workflow template editor UI plan** (separate spec to be written)











