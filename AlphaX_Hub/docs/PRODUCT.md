# AlphaX Hub — Product Documentation

A residential construction project management platform. Owners author reusable workflow templates; PMs assemble them into projects across three fixed phases (Permitting → Construction → Sale); ICs execute the tasks. Critical path scheduling, role-based permissions, and per-user daily digests via Lark keep the team aligned.

---

## 1. Product functions

### 1.1 Authentication
- **Two ways to sign in:** Lark OAuth (existing org SSO) or email + password (open registration, lands as `ic` role).
- **Owner-only admin reset password** under `/settings/members` — no email delivery, owner shares the new password manually.
- **DEV_AUTH_BYPASS env flag** for local dev: auto-signs in as "Dev Owner" without Lark or password.

### 1.2 Workflow templates (`/workflows`)
Owner-only authoring of reusable workflow definitions.
- Create / edit name, description, task list (name + duration + owner-role label) + finish-to-start dependencies.
- Drag-reorder tasks; drag-handle dependency picker shows only valid upstream candidates.
- **Live schedule preview**: as you edit durations + deps, each row shows `day N–M` (computed start/end) or `cycle` if deps form a cycle.
- Duplicate / archive / restore templates.
- Draft auto-saved to localStorage; unsaved-changes warning on navigation.
- Cycle detection both client-side (live) and server-side (on save).

### 1.3 New project wizard (`/projects/new`)
PM-only flow for spinning up a project.
- Three sections: Basics (name/brand/city/state), Targets (year + quarter dropdown for target exit), Workflows (assign templates to each phase).
- Permitting requires ≥1 template; Construction and Sale are optional.
- Drag-reorder workflow chips within a phase.
- On submit, runs the **snapshot operation**: copies the template's tasks + deps into the project so future template edits don't affect this project.

### 1.4 Project page (`/projects/[id]`)
The central per-project workspace.
- **Header** — name, brand chip, PM avatar, target exit quarter, project status badge.
- **Phase action bar** — Kick Off / Mark Phase Complete with confirmation modal for incomplete tasks. State machine enforces earlier phase must be complete before the next phase can kick off.
- **4 tabs:** Overview · Gantt · Tasks · Activity.
- **Gantt** — planned bars (light blue), actual overlay (darker), unplanned tasks (red border), critical-path tasks (highlighted), today line, FS dependency arrows, Week / Month / Quarter zoom.
- **Task list** — color-coded by status (green / amber / red), grouped by workflow. In draft, each row has an × delete button.
- **Task drawer** — opens via URL `?task=<id>`; status stepper, owner/reviewer, comments thread, subtasks, approve/request-revision review actions.
- **Activity feed** — humanized event log (who did what when).
- Edit task status, reassign, submit for review, approve/request-revision; add unplanned tasks once kicked off.

### 1.5 My tasks (`/my-tasks`)
Per-user cross-project landing page.
- **3 tabs:** Open Tasks · Pending Review · Completed (last 90d).
- **Smart ranking** of open tasks: blocked → urgency (days to deadline) → critical-path bias → priority.
- **Banner** with quick counts of overdue / blocked / ready.
- **Priority** field on each task (low / normal / high) — owner/PM/task-owner can set.
- **Daily Lark digest** DMs each opted-in user a summary of overdue + due-this-week + pending-my-review counts. Trigger via `POST /api/cron/lark-digest`.
- Opt out under `/settings/me`.

### 1.6 Dashboard (`/`, `/team`, `/performance`)
- **Dashboard:** all active projects, filtered by brand, grouped by target exit quarter; mechanical at-risk detection (permit overdue → construction overdue → exit overdue).
- **Team view (`/team/[team]`):** projects active for a specific team (design/construction/sales) + workload table.
- **Performance Review (`/performance/[team]`):** on-time delivery rate, avg phase duration, tasks completed, first-pass approval rate, review-loop turnaround over a default 90-day window.

### 1.7 Permissions
Single source of truth: `lib/permissions.ts`. Server-side enforced on every write; client-side mirrored for UX gating only.

| Role | Read | Write |
|---|---|---|
| `owner` | everything | full system; workflow CRUD; force-reassign PM (audited); unlock projects (audited); admin password reset; manage members |
| `pm` | everything | projects they manage: kick-off / mark-complete / edit-structure-in-draft / add-tasks / transfer-PM; create projects |
| `ic` | everything | own tasks: set status, edit notes, add subtasks, reassign; as reviewer: approve / request revision |

---

## 2. Code structure

```
AlphaX_Hub/
├── app/
│   ├── (app)/               ← signed-in app shell (sidebar + topbar layout)
│   │   ├── page.tsx                Dashboard
│   │   ├── my-tasks/page.tsx       My Tasks
│   │   ├── projects/[id]/page.tsx  Project page
│   │   ├── projects/new/page.tsx   New project wizard
│   │   ├── workflows/...           Workflow template list + editor
│   │   ├── team/[team]/...         Team view
│   │   ├── performance/[team]/...  Performance review
│   │   └── settings/...            /me + /members + /audit
│   ├── login/page.tsx              Login (Lark button + email form)
│   ├── register/page.tsx           Registration
│   ├── actions/                    Server Actions (mutations)
│   │   ├── projects.ts  phases.ts  tasks.ts  task-comments.ts
│   │   ├── workflows.ts  users.ts  auth.ts
│   └── api/                        Route handlers
│       ├── auth/lark/{start,callback}/route.ts
│       ├── auth/logout/route.ts
│       └── cron/lark-digest/route.ts
│
├── components/
│   ├── auth/                login-form + register-form
│   ├── layout/              sidebar
│   ├── project/             project page chrome (header, tabs, gantt, drawer, ...)
│   ├── projects/            new project wizard form + chips
│   ├── workflows/           template editor shell + task list/row
│   ├── my-tasks/            tabs + banner + task row
│   ├── dashboard/           filters + chips
│   ├── settings/            admin-reset-password modal
│   └── shared/              avatar
│
├── lib/
│   ├── auth/                lark.ts, session.ts, password.ts, bootstrap.ts
│   ├── critical-path/       index.ts (DAG schedule) + blocked.ts (derived flag)
│   ├── snapshot/            apply-schedule.ts, snapshot-workflows.ts (template → project copy)
│   ├── services/            project, phase, task, workflow-template (write side)
│   ├── permissions.ts       single-file role/action matrix
│   ├── server/              get-current-user, require-permission, errors
│   ├── state-machine/       phase + project status transition rules
│   ├── workflow-editor/     draft-storage (localStorage) + has-cycle + leave-prompt hook
│   ├── new-project-wizard/  validate (pure)
│   ├── project-page/        derived display helpers (status, action enablement)
│   ├── my-tasks/            ranking, banner-counts, digest-payload
│   ├── dashboard/           at-risk, quarter, current-state
│   ├── lark/                messaging.ts (tenant access token + send DM)
│   ├── avatar/              deterministic default avatar by user ID hash
│   └── hooks/               use-permissions
│
├── db/
│   ├── client.ts            Drizzle Postgres client
│   ├── migrate.ts           Hand-rolled migration runner
│   ├── schema/              14 tables (one file each)
│   ├── migrations/          Hand-written .sql files + drizzle-kit journal
│   ├── queries/             Read-side queries grouped by feature
│   └── seed.ts              Dev-only template seed
│
├── tests/                   Vitest setup, real-Postgres fixtures
├── docs/
│   ├── PRODUCT.md           ← this file
│   └── superpowers/         specs/ + plans/ (history of each feature)
├── middleware.ts            Cookie-based gate + DEV_AUTH_BYPASS
├── docker-compose.yml       Dev + test Postgres containers
└── package.json
```

### Conventions
- **Read vs write:** read queries live under `db/queries/*` (called from RSCs); write logic lives under `lib/services/*` (called from Server Actions in `app/actions/*`).
- **Service signature:** `serviceName.method(input, db)` — `db` is injected for testability (so tests can pass `testDb`).
- **Permission check:** every Server Action starts with `await requirePermission({type: '...', ...})` before touching state.
- **One schema file per table.** Re-exported through `db/schema.ts`.
- **No raw SQL** except hand-written migrations.
- **TDD by default.** Pure helpers go through a Vitest red→green cycle; service tests run against the real Postgres test DB.

---

## 3. Tech stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 14 (App Router) | RSC + Server Actions = no separate API to maintain |
| Language | TypeScript (strict) | Whole-stack typing via Drizzle inferred types |
| Database | Postgres 16 | CHECK constraints, case-insensitive indexes, transactions |
| ORM | Drizzle ORM | Type-safe queries, no codegen, predictable SQL |
| Migrations | drizzle-kit + hand-written `.sql` | Some constraints drizzle can't express; hand-write those |
| UI | Tailwind CSS | Utility-first; no design-system overhead |
| Drag & drop | @dnd-kit/core + @dnd-kit/sortable | Workflow editor + new project wizard chips |
| Modals | @radix-ui/react-dialog | Accessibility + behavior out of the box |
| Auth | Cookie session (HMAC-signed) + bcryptjs | Custom, lightweight; no external session store |
| Password hashing | bcryptjs (cost 10) | Pure JS, portable |
| Validation | zod | Same schema validates Server Action input + form |
| Testing | Vitest (+ real Postgres) | One test runner for units + integration |
| Notifications | Lark messaging API | Daily task digest DMs |

**Why no separate backend:** everything runs in the Next.js process. Mutations are Server Actions called like functions from client components (no `fetch('/api/...')`). Page data fetching is done in RSCs. The only HTTP endpoints are Lark OAuth callback, logout, and the cron digest trigger.

---

## 4. Developer instructions

### 4.1 Prerequisites
- Node 20.19+ or 22.13+ (current `package.json` is happy on 20.x)
- Docker (for the two local Postgres instances)
- `npm` (the project uses npm; no yarn/pnpm scripts)

### 4.2 First-time setup
```bash
# 1. Start local Postgres (dev on :5434, test on :5433)
docker compose up -d

# 2. Install deps
npm install

# 3. Configure environment
cp .env.example .env.local
# Edit .env.local — minimum:
#   AUTH_SECRET                     → `openssl rand -hex 32`
#   DEV_AUTH_BYPASS=true            → skip Lark for local dev
# Optional (only if testing Lark or digest):
#   LARK_CLIENT_ID / LARK_CLIENT_SECRET / LARK_ALLOWED_TENANT_KEY
#   BOOTSTRAP_OWNER_LARK_OPEN_ID    → promotes you to owner on first Lark sign-in
#   LARK_MESSAGING_APP_ID / SECRET / LARK_DIGEST_CRON_SECRET

# 4. Apply migrations to both DBs
npm run db:migrate
DATABASE_URL=postgres://buildflow:buildflow_dev@localhost:5433/buildflow_test npm run db:migrate
```

### 4.3 Daily commands
```bash
npm run dev          # Next dev server (defaults to http://localhost:3000)
npm test             # Full Vitest suite (needs both Postgres containers up)
npm run typecheck    # tsc --noEmit
npm run build        # Production build
npm run db:studio    # Drizzle Studio for browsing the DB
npm run db:seed      # Insert a "Permitting Basics" template (needs an owner to exist)
```

### 4.4 First-time data flow
With `DEV_AUTH_BYPASS=true`:
1. `npm run dev` → open the URL printed
2. You're auto-signed-in as "Dev Owner" (created on first request if DB is empty)
3. Go to `/workflows` and create a template (or `npm run db:seed` for one ready-made)
4. Go to `/projects/new`, fill in basics, attach at least one Permitting template, Create
5. Open the new project, customize tasks, click **Kick Off** on Permitting → project transitions to in-progress
6. Promote teammates via `/settings/members`

To test the Lark + password flow instead, flip `DEV_AUTH_BYPASS=false` and restart.

### 4.5 Accessing the DB
```bash
# GUI:
npm run db:studio   # opens https://local.drizzle.studio

# psql via docker:
docker exec -it buildflow-postgres psql -U buildflow -d buildflow

# psql via host (if you have psql installed):
psql postgres://buildflow:buildflow_dev@localhost:5434/buildflow
```

Dev DB: port `5434` / database `buildflow`. Test DB: port `5433` / database `buildflow_test`. User/password: `buildflow` / `buildflow_dev`.

### 4.6 Writing a new feature
The repo follows a strict spec → plan → implement → review flow under `docs/superpowers/`:

1. **Brainstorm** → write a spec in `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md`
2. **Write plan** → bite-sized TDD tasks in `docs/superpowers/plans/YYYY-MM-DD-<topic>-impl.md`
3. **Implement** → one task at a time, commit per step
4. **Merge** → fast-forward into `main`

See any existing `docs/superpowers/plans/*.md` for the format.

### 4.7 Adding a migration
1. Edit the relevant `db/schema/*.ts` file
2. Hand-write `db/migrations/00NN_<name>.sql` (next number after the highest existing)
3. Append a new entry to `db/migrations/meta/_journal.json` (idx, version `"7"`, when = current epoch ms, tag = filename without `.sql`, breakpoints `true`)
4. `npm run db:migrate` then re-run against test DB

### 4.8 Running just one test file
```bash
npm test -- lib/auth/password.test.ts
```

### 4.9 Common gotchas
- **Migrations must be applied to both DBs** (dev port 5434 + test port 5433). Tests will silently use stale schemas otherwise.
- **`server-only` import** in `lib/server/*` will throw in jsdom test envs. Mock it via `vi.mock` (see `app/actions/auth.test.ts` for the pattern).
- **Drizzle's `text({ enum })` doesn't emit DB-level CHECK constraints.** Add them in a hand-written migration (see `0005_add_check_constraints.sql`).
- **Middleware runs Edge runtime** — do not import anything that touches `node:crypto` from `middleware.ts`. Use `lib/auth/session-constants.ts` for shared cookie name + duration.
- **Session cookie is set inside Server Actions** via `issueSession(userId)`. Don't manually call `cookies().set(...)` — go through the helper so cookie attributes stay consistent.
