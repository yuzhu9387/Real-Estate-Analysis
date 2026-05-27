# BuildFlow Foundation — Design

**Date**: 2026-05-22
**Status**: Draft
**Scope**: Foundational rewrite of the BuildFlow platform. Establishes tech stack, data model, authentication, authorization, project hierarchy, state machines, and API conventions. UI design for individual pages (project page sections, My Tasks page, LLM ranking) is **out of scope** and will follow as separate specs.

---

## 1. Overview

BuildFlow is a project management platform for residential construction builders. It manages each house build as a `Project`, composed of three fixed phases (Permitting → Construction → Sale), with each phase containing one or more snapshotted `Workflows`, each containing `Tasks` with dependencies.

This document defines the **foundation**: the runtime architecture, schema, auth, and authorization model that all subsequent features (project page UI, My Tasks ranking, etc.) will sit on top of.

### Non-goals (handled in later specs)

- Project page UI layout (overview / Gantt / task list)
- My Tasks page UI and LLM-based daily ranking
- Workflow template editor UI
- Notification delivery (Lark messages, email)
- Pipeline meeting view
- Analytics / reporting

### Existing code

The current `builder-demo` is a frontend-only prototype with hardcoded data and no backend. The foundation is a **from-scratch rewrite** in the same repository. Existing demo code moves to `legacy/` and is treated as reference material, not extended.

---

## 2. Deployment context

- **Single-instance self-deploy**: one installation per builder company. No multi-tenancy in the schema.
- **Publicly reachable**: site is on the internet, not behind a VPN. DDoS / security mitigations required.
- **Operator profile**: small construction company, ~10–50 users total.

---

## 3. Tech stack

| Layer | Choice | Rationale |
|---|---|---|
| Framework | **Next.js 14+ (App Router)** | Existing demo is Next.js; full-stack TS; Server Actions cover most "light backend" needs |
| Language | **TypeScript** | Already in use; required across stack |
| Database | **Postgres** | Standard relational DB; supports JSONB for activity payloads |
| ORM | **Drizzle** | Lightweight, SQL-shaped, TS-native, no separate query engine binary; self-deploy friendly |
| Auth | **`better-auth`** + custom Lark OAuth2 provider | TS-first auth library with Drizzle adapter; Lark not a built-in provider but trivially added via custom OIDC adapter |
| UI primitives | Existing **Radix UI + Tailwind + lucide-react** | Continue from builder-demo; mature component foundation |
| Forms / validation | **`zod`** | Single schema for input validation across Server Actions, Route Handlers, and client forms |
| Testing | **Vitest** (unit, integration), **React Testing Library** (component), **Playwright** (E2E) | Vitest already configured in builder-demo |
| Edge network | **Cloudflare** (Free tier minimum) | DDoS, WAF, IP-based rate limiting at the edge |

API surface:

- **Server Actions** (`app/actions/*.ts`) for all UI-driven writes
- **Route Handlers** (`app/api/*`) only for: Lark OAuth callback, webhooks, health check, future cron entries

---

## 4. Repository layout

The rewrite occupies the main `app/` path. Old demo moves to `legacy/`.

```
builder-demo/
├── app/
│   ├── (auth)/login/page.tsx
│   ├── (app)/
│   │   ├── layout.tsx                     # sidebar + topbar + PermissionsProvider
│   │   ├── projects/
│   │   │   ├── page.tsx                   # project list
│   │   │   ├── new/page.tsx               # create project wizard
│   │   │   └── [id]/page.tsx              # project detail
│   │   ├── my-tasks/page.tsx
│   │   ├── workflows/                     # owner-only
│   │   │   ├── page.tsx
│   │   │   └── [id]/page.tsx
│   │   └── settings/
│   │       ├── members/page.tsx
│   │       └── audit/page.tsx
│   ├── api/
│   │   ├── auth/lark/callback/route.ts
│   │   ├── webhooks/                      # placeholder
│   │   └── health/route.ts
│   └── actions/                           # Server Actions by domain
│       ├── projects.ts
│       ├── phases.ts
│       ├── workflows.ts                   # owner CRUD on templates
│       ├── project-workflows.ts           # PM in-project workflow snapshot ops
│       ├── tasks.ts
│       ├── task-comments.ts
│       └── users.ts
├── components/
│   ├── ui/                                # Radix-based primitives
│   ├── project/
│   ├── workflow/
│   ├── my-tasks/
│   └── layout/
├── lib/
│   ├── permissions.ts                     # single source of truth for can(user, action)
│   ├── auth/                              # better-auth + Lark provider config
│   ├── services/                          # business logic, pure where possible
│   │   ├── project-service.ts
│   │   ├── phase-service.ts
│   │   ├── workflow-template-service.ts
│   │   ├── project-workflow-service.ts
│   │   └── task-service.ts
│   ├── critical-path/                     # pure DAG algorithm
│   ├── state-machine/
│   │   ├── project.ts
│   │   └── phase.ts
│   ├── snapshot/                          # template → project snapshot
│   ├── server/
│   │   ├── require-permission.ts
│   │   ├── errors.ts
│   │   └── get-current-user.ts
│   └── hooks/
│       └── use-permissions.ts             # client-side permission hook
├── db/
│   ├── schema.ts                          # all Drizzle tables
│   ├── queries/                           # reusable query helpers
│   └── migrations/                        # drizzle-kit output
├── tests/
│   └── fixtures/                          # test data factories
├── docs/superpowers/
│   ├── specs/
│   └── plans/
└── legacy/                                # old prototype, no imports allowed
```

**Layer boundaries** (enforced by convention, lint rule, or manual review):

- `components/` may not import from `db/` or `lib/services/`. Data flows in via RSC props or Server Action calls.
- `lib/services/` may not import from `app/` or `components/`. Services are platform-agnostic.
- `db/queries/` is the only direct caller of Drizzle. Services and actions go through queries.

---

## 5. Authentication

### Lark OAuth flow

1. User visits `/login` and clicks **Sign in with Lark**
2. Browser redirected to Lark authorize endpoint with `client_id`, `state`, `redirect_uri`
3. User approves on Lark
4. Lark calls back to `/api/auth/lark/callback?code=…&state=…`
5. Server exchanges `code` for `access_token`
6. Server fetches user info: `{ open_id, name, email, avatar, tenant_key }`
7. Server validates `tenant_key === LARK_ALLOWED_TENANT_KEY`. If not, reject with `?error=tenant_mismatch`
8. Upsert into `users`:
   - If `lark_open_id` exists: update `last_login_at`, `name`, `avatar_url`
   - If new: create with `role='ic'`, `is_active=true`
   - If existing but `is_active=false`: reject login
9. Create `better-auth` session, write `httpOnly` `sameSite=lax` `secure` cookie (7-day rolling expiry)
10. Redirect to `/`

### Bootstrap (first deploy)

The first time the configured `BOOTSTRAP_OWNER_LARK_OPEN_ID` logs in, that user is assigned `role='owner'`. The env var is consumed once (a marker row in `system_bootstrap` table tracks this; subsequent values are ignored). All other users start as `ic` and must be promoted by an existing `owner`.

### Edge cases

- **Last owner self-demotion**: blocked at the service layer. `userService.updateRole` rejects if it would result in zero active owners. UI hides the demote button for the sole owner.
- **Disabled user with active session**: `getCurrentUser` checks `is_active` on every request. Disabled users are signed out immediately.

### Required env vars

```
LARK_CLIENT_ID
LARK_CLIENT_SECRET
LARK_ALLOWED_TENANT_KEY
LARK_REDIRECT_URI
AUTH_SECRET
DATABASE_URL
BOOTSTRAP_OWNER_LARK_OPEN_ID   # one-time, ignored after first use
```

### Security

| Concern | Mitigation |
|---|---|
| DDoS / volumetric attacks | Cloudflare in front (Free tier sufficient initially) |
| Auth endpoint brute force | Cloudflare rate limiting + app-layer per-IP and per-`lark_open_id` rate limit on `/api/auth/lark/callback` |
| OAuth CSRF | `state` parameter validated against signed cookie; `better-auth` built-in |
| Session theft | `httpOnly`, `secure`, `sameSite=lax` cookies; short-ish 7-day expiry with rolling renewal |
| Injection | Drizzle parameterized queries throughout; no raw SQL strings |
| XSS | React auto-escaping; CSP headers in `next.config` |

---

## 6. Roles and authorization

### Role enum

```ts
type Role = 'owner' | 'pm' | 'ic'
```

- **`owner`**: company admin. Full read/write everything. Force-reassign PMs, unlock locked projects (with audit log + reason), CRUD workflow templates, manage members.
- **`pm`**: can be assigned as Project Manager of projects. Full write on projects they manage. Read everything.
- **`ic`**: individual contributor. Write only on their own tasks (where they are `owner_id` or `reviewer_id`) and their own subtasks. Read everything.

### Project Manager (project-level)

Each project has exactly one **Project Manager** (`projects.pm_id`, FK to `users`).

- Must be a user with `role IN ('pm', 'owner')`
- Creator is automatically PM on project creation
- Current PM can transfer to any other `pm`/`owner` user (no system-owner approval required)
- System `owner` role can **force-reassign** any project's PM (e.g. when current PM leaves). This writes an `audit_logs` row.

`ic` users cannot create projects.

### Permission matrix (full)

| Action | `owner` | `pm` (managing) | `pm` (other) | `ic` (task owner/reviewer) | `ic` (unrelated) |
|---|:---:|:---:|:---:|:---:|:---:|
| View any project / workflow / member | ✅ | ✅ | ✅ | ✅ | ✅ |
| CRUD workflow templates | ✅ | ❌ | ❌ | ❌ | ❌ |
| Create project | ✅ | ✅ | ✅ | ❌ | ❌ |
| Edit project name / address | ✅ | ✅ | ❌ | ❌ | ❌ |
| Edit project structure (workflows, tasks, deps) — `draft` only | ✅ | ✅ | ❌ | ❌ | ❌ |
| Kick Off a phase | ✅ | ✅ | ❌ | ❌ | ❌ |
| Mark Phase Complete | ✅ | ✅ | ❌ | ❌ | ❌ |
| Mark Project Complete | ✅ | ✅ | ❌ | ❌ | ❌ |
| Add `unplanned` task (post-kick-off) | ✅ | ✅ | ❌ | ❌ | ❌ |
| Edit task planned fields (duration, owner, reviewer, deps) — `draft` only | ✅ | ✅ | ❌ | ❌ | ❌ |
| Set task status (`started`, …, `complete`, `wont_do`) | ✅ | ✅ | ❌ | ✅ (task owner) | ❌ |
| Submit task for review | ✅ | ✅ | ❌ | ✅ (task owner) | ❌ |
| Approve / request revision | ✅ | ✅ | ❌ | ✅ (reviewer) | ❌ |
| Mark task complete | ✅ | ✅ | ❌ | ✅ (task owner) | ❌ |
| Edit task notes / description | ✅ | ✅ | ❌ | ✅ (task owner) | ❌ |
| Add subtask under own task | ✅ | ✅ | ❌ | ✅ (task owner) | ❌ |
| Reassign own task to another user | ✅ | ✅ | ❌ | ✅ (task owner) | ❌ |
| Add task comment | ✅ | ✅ | ❌ | ✅ (owner or reviewer) | ❌ |
| Transfer PM (current → another) | ✅ | ✅ | ❌ | ❌ | ❌ |
| Force-reassign PM | ✅ | ❌ | ❌ | ❌ | ❌ |
| Unlock project to `draft` (with audit) | ✅ | ❌ | ❌ | ❌ | ❌ |
| Manage members (promote / demote / disable) | ✅ | ❌ | ❌ | ❌ | ❌ |
| View audit logs | ✅ | ❌ | ❌ | ❌ | ❌ |
| Archive project | ✅ | ✅ | ❌ | ❌ | ❌ |

### Enforcement architecture

**Single source of truth**: `lib/permissions.ts` exports a pure function `can(user, action): boolean`. The function takes an `Action` discriminated-union value carrying all needed context (`projectContext`, `taskContext`, etc.).

**Server-side enforcement** (mandatory, cannot be bypassed):

```ts
// lib/server/require-permission.ts
export async function requirePermission(action: Action): Promise<User> {
  const user = await getCurrentUser()
  if (!user) throw new UnauthorizedError()
  if (!can(user, action)) throw new ForbiddenError(action.type)
  return user
}
```

Every Server Action and every Route Handler that performs a write calls `requirePermission` at the top, before touching the database.

**Client-side mirror** (UX only — never security):

```tsx
// app/(app)/layout.tsx — server component
const user = await getCurrentUser()
return <PermissionsProvider user={user}>{children}</PermissionsProvider>

// client components
const { can } = usePermissions()
<Button disabled={!can({ type: 'task.submit_review', task })}>Submit</Button>
```

Both sides import the same `can()` function. UI and server can never disagree.

### Owner override audit

When `owner` performs an action a `pm` could not (force-reassign, unlock-to-draft), the service writes an `audit_logs` row with `actor_id`, `action`, `target_type`, `target_id`, `before`/`after` JSONB snapshots, and a required `reason` string. UI for these actions includes a mandatory "Reason" text field.

---

## 7. Project hierarchy

```
Project
├── Phase 1: "Permitting"   ◄── PM manually Kicks Off + Marks Complete
│    ├── Workflow A (snapshot of template)   ◄── status auto-derived
│    │    ├── Task 1
│    │    ├── Task 2
│    │    └── ...
│    ├── Workflow B
│    └── ...
├── Phase 2: "Construction" ◄── PM manually Kicks Off + Marks Complete
│    └── ...
└── Phase 3: "Sale"         ◄── PM manually Kicks Off + Marks Complete
     └── ...
```

### Fixed phases

Every project has exactly three phases, named **Permitting**, **Construction**, **Sale**, in that order. Names are hardcoded; not customizable per project.

### Phase ↔ team mapping (informational)

Each phase has a conventional owning team. This mapping powers default views in the dashboard but **does not constrain task assignment** — a PM may assign any task to any user regardless of team.

| Phase | Owning team (default) |
|---|---|
| Permitting | `design` |
| Construction | `construction` |
| Sale | `sales` |

A future `development` team is planned, parallel to `design` (handling larger-scale projects with the same Permitting-phase responsibilities). When introduced, the mapping for Permitting may become `design` OR `development` depending on the project — selectable at project creation. Out of scope for the foundation; see the dashboard spec for current team-view design.

### Workflows within a phase

A phase contains zero or more workflow snapshots (e.g., the Permitting phase may have 5 workflows: Survey, Zoning Application, Design Review, Building Permit, Conservation Permit). PMs assign workflows to phases when assembling the project in `draft`.

### Status semantics

- **Task status** (6 values): `not_started`, `started`, `pending_review`, `approved`, `complete`, `wont_do`. Set by users via specific actions. `wont_do` is a terminal state meaning the task was decided not to be executed (distinct from `delete`, which removes the task entirely). Any task may transition to `wont_do` from any other status; reverting from `wont_do` returns it to `not_started`. Permitted setters follow the standard "Set task status" matrix row — task owner (including IC), PM (managing), and owner can all set or revert `wont_do` on the relevant tasks.
- **Task `is_blocked`** (derived boolean): `true` iff any upstream-dependency task has `status NOT IN ('complete', 'wont_do')`. `wont_do` tasks satisfy downstream dependencies the same way `complete` tasks do. Recomputed automatically on any upstream status change or dep change. Orthogonal to `status` — a task can be `not_started` and `blocked` (waiting on deps) or `not_started` and not blocked (ready to begin).
- **Workflow status** (derived): `pending` until any of its tasks moves out of `not_started`; `in_progress` while any task is in a non-terminal status; `complete` when every task is in a terminal status (`complete` or `wont_do`). **Auto-computed by the service layer on every task status change.** Workflows themselves do not have a `wont_do` status — only tasks do.
- **Phase status** (PM-controlled): `pending` until PM clicks Kick Off; `in_progress` after kick-off; `complete` after PM clicks Mark Phase Complete. The transition to `complete` does **not** require all workflows in the phase to be complete — UI shows a confirmation modal if any are incomplete, but PM may proceed.
- **Project status**: `draft` → `in_progress` → `complete` → `archived`. See state machine below.

---

## 8. State machines

### Project state machine

```
draft ──Kick Off Phase 1──► in_progress ──Mark Project Complete──► complete ──archive──► archived
                                  ▲
                                  └──── (owner only, unlock-to-draft, with audit + reason)
```

Transitions:

| From | To | Trigger | Who | Preconditions |
|---|---|---|---|---|
| `draft` | `in_progress` | Kick Off of Phase 1 | PM, owner | Project has ≥1 workflow assigned across phases |
| `in_progress` | `complete` | Mark Project Complete | PM, owner | All 3 phases `complete` |
| `complete` | `archived` | Archive | PM, owner | — |
| any | `draft` | Unlock | owner only | `reason` provided; writes audit_log |

When project is **not in `draft`**, the following are locked at the service layer (Server Actions throw `ProjectLockedError`):

- Adding/removing/reordering workflows
- Adding/deleting `planned` tasks (Unplanned tasks remain allowed)
- Editing task `planned_duration_days`, dependencies, default owner/reviewer assignments
- Editing the planned schedule (forward-pass output is frozen)

What remains writable in `in_progress`:

- Task `status` changes (by appropriate role)
- Adding `unplanned` tasks (PM)
- Adding subtasks (task owner)
- Editing task `description` / notes (task owner, PM, owner)
- Reassigning a task to another user (task owner, PM, owner)
- Adding comments (task owner, reviewer, PM, owner)

### Phase state machine

```
pending ──Kick Off Phase──► in_progress ──Mark Phase Complete──► complete
```

Independent per phase. No automatic transitions between phases — PM manually kicks off Phase 2 after Phase 1 is complete, and Phase 3 after Phase 2.

**Special rule**: When Phase 1 (`Permitting`) is `kicked off` from `draft`, the project's status moves `draft → in_progress`. Subsequent phase kick-offs do not change project status.

`Mark Phase Complete` triggers a confirmation modal if any contained workflow is not `complete`, but proceeds on confirmation.

### Workflow status (auto, no transitions to validate)

Computed in `lib/services/project-workflow-service.ts` after every task status change in that workflow. Pure derivation, no manual control.

---

## 9. Workflow templates

Workflow templates are reusable definitions of "a phase's worth of work" — a set of tasks with dependencies and default durations, owned by company `owner`.

### Lifecycle

- **CRUD**: only `owner` role. Other roles can view templates (e.g., when PMs pick them during project assembly).
- **Soft delete**: `workflow_templates.is_archived = true`. Archived templates still exist in DB (because in-flight projects reference them for audit) but don't appear in the picker.
- **Snapshot relationship**: when a project is created, the selected templates are **fully copied** into project-scoped tables (`project_workflows`, `tasks`, `task_deps`). Subsequent edits to templates have **zero effect** on existing projects.

### Snapshot operation (project creation)

1. Create `projects` row (status = `draft`).
2. Create 3 `project_phases` rows (Permitting, Construction, Sale, sort_order 1/2/3, status `pending`).
3. PM has assigned each chosen workflow template to a phase. For each:
   - Insert `project_workflows` row with `source_workflow_template_id`, `phase_id`, `sort_order`.
   - Insert `tasks` rows (one per `workflow_template_tasks`), with original task fields plus `source_workflow_template_task_id`, `project_workflow_id`, `project_id`.
   - Insert `task_deps` rows (remap `workflow_template_task_deps` from template task IDs to newly-created task IDs).
4. For each ordered pair of workflows within the same phase (workflow `i` and `i+1`), add a default cross-workflow dep: every leaf task of workflow `i` → every root task of workflow `i+1`. PM can edit these in `draft`.
5. Run forward-pass critical-path algorithm:
   - Compute `earliest_start_day` and `earliest_end_day` per task.
   - Compute `latest_start_day` and `latest_end_day` (backward pass).
   - Mark `is_on_critical_path = (slack === 0)`.
6. Persist computed schedule and critical-path flags to `tasks` columns.

All of step 1–6 runs in one DB transaction. Rolled back on any error.

### Cross-phase dependency rule

**Default**: no implicit dependency between the last workflow of Phase 1 and the first workflow of Phase 2. Phases are advanced manually by PM, so dependency relationships across phases are not enforced by the schedule. PM may manually add cross-phase deps in `draft` if needed.

---

## 10. Critical path

A pure function in `lib/critical-path/`:

```ts
export function recomputeSchedule(input: {
  tasks: Array<{ id: string; durationDays: number; isUnplanned: boolean }>
  deps:  Array<{ fromTaskId: string; toTaskId: string; lagDays: number }>
}): Array<{
  taskId: string
  earliestStartDay: number
  earliestEndDay: number
  latestStartDay: number
  latestEndDay: number
  slackDays: number
  isOnCriticalPath: boolean
}>
```

### When it runs

- During snapshot (project creation)
- When PM edits task duration / dependency / structure in `draft`
- When an `unplanned` task is added in `in_progress` and has dependencies — downstream tasks' `planned_start_day` / `planned_end_day` are pushed accordingly
- **Not** triggered by `actual_start_day` / `actual_end_day` updates (those are observed reality, not planned schedule)
- Triggered when any task transitions in or out of `wont_do` status (downstream schedule may shorten or recover)

### Handling of `wont_do` tasks

Tasks with `status='wont_do'` are excluded from the schedule input. For the forward pass, their outbound dependency edges are treated as satisfied (downstream tasks may proceed as if the `wont_do` task had completed at day 0). For the backward pass, they are skipped. Their `planned_start_day` / `planned_end_day` / `is_on_critical_path` values are preserved at their last-computed pre-`wont_do` values for display, but they do not constrain other tasks.

### Days vs absolute dates

All schedule fields are **integer day offsets from the project's `kicked_off_at`** (or, before kick-off, from a hypothetical day-0). Absolute dates are computed in the UI by adding the offset to `kicked_off_at`. This keeps the algorithm fully integer-based and deterministic.

---

## 11. Database schema

All Drizzle tables defined in `db/schema.ts`. UUIDs are server-generated unless noted.

### `users`

```ts
{
  id: uuid primary key,
  lark_open_id: text unique not null,
  lark_tenant_key: text not null,
  email: text,
  name: text not null,
  avatar_url: text,
  role: text not null check (role in ('owner','pm','ic')),
  team: text check (team in ('design','construction','sales')),  -- nullable; owner role may omit
  is_active: boolean not null default true,
  created_at: timestamptz not null default now(),
  last_login_at: timestamptz,
}
```

The `team` field is an organizational label, not a permission gate — task assignment is **not** restricted by team (a Construction team member can be assigned a task in the Permitting phase). It exists to power the Team and Performance Review dashboards (see `2026-05-25-dashboard-design.md`). The enum is intentionally small; a future `'development'` value is planned (parallel to `'design'`, handling larger projects) and will be added by adjusting the CHECK constraint via migration when introduced.

### `sessions` (managed by `better-auth`)

Schema follows the better-auth Drizzle adapter spec.

### `system_bootstrap`

```ts
{
  id: text primary key,            // 'bootstrap_owner'
  consumed_at: timestamptz not null
}
```

One-shot guard for `BOOTSTRAP_OWNER_LARK_OPEN_ID`.

### `projects`

```ts
{
  id: uuid primary key,

  -- identification
  name: text not null,
  brand: text not null check (brand in ('al_homes','alera','apex')),

  -- location
  address: text,
  city: text,
  state: text,                                   -- 2-letter abbreviation (e.g., 'MA')
  zip: text,

  -- ownership / commercial context
  pm_id: uuid not null references users(id),
  title_holder: text,
  project_strategy: text,                        -- free-form label, e.g., 'spec build', 'flip', 'buy-and-hold'

  -- acquisition
  purchase_date: date,
  purchase_price: numeric(14,2),                 -- USD with cents

  -- targets (set in draft; frozen by service layer once project leaves draft)
  target_exit_quarter: text,                     -- format 'YYYY-Qn', e.g., '2026-Q3'
  target_project_duration_days: integer,
  target_permit_date: date,
  target_construction_end_date: date,

  -- actuals (filled in as project progresses)
  actual_permit_date: date,
  actual_construction_end_date: date,
  actual_duration_days: integer,                 -- denormalized; computed by service when listing_date or sold_at is set
  presale_phase1_date: date,
  presale_phase2_date: date,
  presale_phase3_date: date,
  listing_date: date,
  sold: boolean not null default false,
  sold_price: numeric(14,2),

  -- lifecycle
  status: text not null check (status in ('draft','in_progress','complete','archived')) default 'draft',
  created_by_id: uuid not null references users(id),
  kicked_off_at: timestamptz,
  completed_at: timestamptz,
  archived_at: timestamptz,
  created_at: timestamptz not null default now(),
  updated_at: timestamptz not null default now(),
}
```

Field notes:

- **`brand`** is hardcoded as a 3-value enum. Adding a brand requires a migration. No `brands` table.
- **`target_*` fields** are part of the immutable plan and follow the same lock rule as task structure: editable in `draft`, frozen once the project transitions to `in_progress`. Enforced at the service layer; UI hides edit controls accordingly.
- **`presale_phase1_date`, `presale_phase2_date`, `presale_phase3_date`, `listing_date`, `sold`, `sold_price`** are project-level milestones, **not** modeled as separate phases. The project's three-phase model (Permitting / Construction / Sale) is unchanged; these are dates recorded against the project as the Sale phase progresses.
- **`actual_duration_days`** is a denormalized integer (days between `purchase_date` and `listing_date` or `sold` date, depending on definition — TBD in the dashboard spec). Stored rather than computed at query time to avoid joins in dashboard list views.
- **`target_exit_quarter`** uses a `'YYYY-Qn'` text format. A CHECK regex constraint may be added; for now the validation lives in zod at the action layer.

### `project_phases`

Exactly 3 rows per project, inserted at project creation. `name` is hardcoded by `sort_order`.

```ts
{
  id: uuid primary key,
  project_id: uuid not null references projects(id) on delete cascade,
  name: text not null check (name in ('Permitting','Construction','Sale')),
  sort_order: integer not null check (sort_order in (1,2,3)),
  status: text not null check (status in ('pending','in_progress','complete')) default 'pending',
  kicked_off_at: timestamptz,
  kicked_off_by_id: uuid references users(id),
  marked_complete_at: timestamptz,
  marked_complete_by_id: uuid references users(id),
  unique (project_id, sort_order)
}
```

### `workflow_templates`

```ts
{
  id: uuid primary key,
  name: text not null,
  description: text,
  created_by_id: uuid not null references users(id),
  is_archived: boolean not null default false,
  created_at: timestamptz not null default now(),
  updated_at: timestamptz not null default now(),
}
```

### `workflow_template_tasks`

```ts
{
  id: uuid primary key,
  workflow_template_id: uuid not null references workflow_templates(id) on delete cascade,
  name: text not null,
  description: text,
  default_duration_days: integer not null check (default_duration_days >= 0),
  default_owner_role_label: text,                  // e.g., "Permit Specialist"
  sort_order: integer not null,
}
```

### `workflow_template_task_deps`

```ts
{
  id: uuid primary key,
  workflow_template_id: uuid not null references workflow_templates(id) on delete cascade,
  from_task_id: uuid not null references workflow_template_tasks(id) on delete cascade,
  to_task_id:   uuid not null references workflow_template_tasks(id) on delete cascade,
  dependency_type: text not null check (dependency_type in ('finish_to_start')) default 'finish_to_start',
  lag_days: integer not null default 0,
  check (from_task_id <> to_task_id)
}
```

### `project_workflows`

```ts
{
  id: uuid primary key,
  project_id: uuid not null references projects(id) on delete cascade,
  project_phase_id: uuid not null references project_phases(id) on delete cascade,
  source_workflow_template_id: uuid references workflow_templates(id),   // nullable: template may be later archived
  name: text not null,
  sort_order: integer not null,
  status: text not null check (status in ('pending','in_progress','complete')) default 'pending',
  created_at: timestamptz not null default now(),
}
```

### `tasks`

```ts
{
  id: uuid primary key,
  project_id: uuid not null references projects(id) on delete cascade,          -- denormalized for fast filter
  project_workflow_id: uuid not null references project_workflows(id) on delete cascade,
  parent_task_id: uuid references tasks(id) on delete cascade,                  -- null for top-level; set for subtasks
  name: text not null,
  description: text,
  owner_id: uuid not null references users(id),
  reviewer_id: uuid references users(id),
  planned_duration_days: integer not null check (planned_duration_days >= 0),
  planned_start_day: integer,           -- computed by critical path, integer offset from kicked_off_at
  planned_end_day: integer,
  actual_start_day: integer,
  actual_end_day: integer,
  status: text not null check (status in ('not_started','started','pending_review','approved','complete','wont_do')) default 'not_started',
  is_blocked: boolean not null default false,
  is_unplanned: boolean not null default false,
  is_on_critical_path: boolean not null default false,
  source_workflow_template_id: uuid references workflow_templates(id),
  source_workflow_template_task_id: uuid references workflow_template_tasks(id),
  sort_order: integer not null,
  created_at: timestamptz not null default now(),
  updated_at: timestamptz not null default now(),
}
```

### `task_deps`

```ts
{
  id: uuid primary key,
  project_id: uuid not null references projects(id) on delete cascade,
  from_task_id: uuid not null references tasks(id) on delete cascade,
  to_task_id:   uuid not null references tasks(id) on delete cascade,
  dependency_type: text not null check (dependency_type in ('finish_to_start')) default 'finish_to_start',
  lag_days: integer not null default 0,
  check (from_task_id <> to_task_id),
  unique (project_id, from_task_id, to_task_id)
}
```

### `task_comments`

```ts
{
  id: uuid primary key,
  task_id: uuid not null references tasks(id) on delete cascade,
  author_id: uuid not null references users(id),
  body: text not null,
  kind: text not null check (kind in ('discussion','review_request','review_approve','review_revision')),
  created_at: timestamptz not null default now(),
}
```

Replaces the legacy single `reviewComment` field. Reviewers can finally type a real reply when requesting revisions.

### `activities`

```ts
{
  id: uuid primary key,
  project_id: uuid references projects(id) on delete cascade,
  actor_id: uuid not null references users(id),
  type: text not null,                  -- e.g., 'task.status_changed', 'phase.kicked_off', 'task.reassigned'
  payload: jsonb not null,              -- structured event details
  created_at: timestamptz not null default now(),
}
```

Used for the Activity feed on project pages. Structured rather than free-text strings.

### `audit_logs`

```ts
{
  id: uuid primary key,
  actor_id: uuid not null references users(id),
  action: text not null,                -- e.g., 'project.force_reassign_pm', 'project.unlock_to_draft'
  target_type: text not null,
  target_id: uuid not null,
  before: jsonb,
  after: jsonb,
  reason: text not null,
  created_at: timestamptz not null default now(),
}
```

Owner-only override actions are required to write here, with a user-provided reason.

---

## 12. API surface

### Server Action standard form

```ts
'use server'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { requirePermission } from '@/lib/server/require-permission'
import { taskService } from '@/lib/services/task-service'

const SetStatusInput = z.object({
  taskId: z.string().uuid(),
  status: z.enum(['not_started','started','pending_review','approved','complete','wont_do']),
})

export async function setTaskStatus(rawInput: unknown) {
  const input = SetStatusInput.parse(rawInput)

  const task    = await taskService.getById(input.taskId)
  if (!task) throw new NotFoundError('Task')
  const project = await projectService.getById(task.projectId)

  const user = await requirePermission({
    type: 'task.set_status',
    project: { pmId: project.pmId, status: project.status },
    task:    { ownerId: task.ownerId, reviewerId: task.reviewerId },
  })

  assertProjectMutable(project, 'task.status_change')

  const result = await taskService.setStatus({ task, newStatus: input.status, actor: user })

  revalidatePath(`/projects/${project.id}`)
  revalidatePath('/my-tasks')
  return { ok: true, task: result.task }
}
```

Every Server Action:

1. Parses input with `zod` (throws `ValidationError` on shape mismatch).
2. Loads context (entities needed for permission decision).
3. Calls `requirePermission` (throws `UnauthorizedError`/`ForbiddenError`).
4. Calls `assertProjectMutable` or state-machine validators where applicable (throws `ProjectLockedError`/`InvalidTransitionError`).
5. Delegates to a service for business logic and DB writes (in a transaction where multi-step).
6. Calls `revalidatePath` for affected routes.
7. Returns plain serializable object.

### Standard errors

In `lib/server/errors.ts`:

| Class | HTTP equivalent | Use |
|---|---|---|
| `UnauthorizedError` | 401 | not logged in |
| `ForbiddenError` | 403 | role/scope insufficient |
| `NotFoundError` | 404 | target row missing |
| `ValidationError` | 400 | zod failure or business validation |
| `ProjectLockedError` | 409 | structural edit attempted in non-`draft` state |
| `InvalidTransitionError` | 409 | illegal state-machine move |
| `ConflictError` | 409 | catch-all conflict |

UI client wraps Action calls with a shared `try`/`catch` adapter that maps these to toasts and form-field highlights.

### Reads

Page-level RSCs (`app/(app)/.../page.tsx`) load data by calling services directly (`projectService.getById`, etc.). No Server Action for reads. Authentication is enforced in the `(app)` layout via `getCurrentUser`; finer-grained read restrictions are not needed because all users can read all data (per role matrix).

### Route Handlers (limited use)

| Path | Purpose |
|---|---|
| `app/api/auth/lark/callback/route.ts` | Lark OAuth code-for-token exchange and session creation |
| `app/api/health/route.ts` | Liveness probe |
| `app/api/webhooks/...` | Reserved for future external integrations |

---

## 13. Testing strategy

Test pyramid emphasizing pure-function unit tests with integration tests using a real test Postgres (no DB mocks).

### Unit (`vitest`, ~90% coverage of `lib/`)

- `lib/permissions.ts`: exhaustive `role × action` matrix tests. Required to prevent permission regressions.
- `lib/critical-path/`: standard DAG, parallel branches, lag, unplanned-task insertion mid-execution.
- `lib/state-machine/project.ts` and `lib/state-machine/phase.ts`: all valid transitions, all invalid transitions throw, all preconditions checked.
- `lib/snapshot/`: template-to-project copy correctness; dep ID remapping; cross-workflow default dep generation.

### Integration (`vitest` + Postgres container, ~70% coverage of services and actions)

Each Server Action gets minimum 3 cases:

- Happy path
- Forbidden case (wrong role / scope)
- Locked / invalid state case

Test setup uses a real Postgres (docker-compose locally, container service in CI). Each `describe` block truncates tables and seeds via `tests/fixtures/` factories. Factories call Drizzle directly, **not** product services (avoids self-referential tests).

### Component (`vitest` + RTL, selective)

Only test components with **permission-conditional rendering**. Render with a `PermissionsProvider` wrapping different mock users; assert presence/absence of action buttons. Pure-rendering components (Gantt, table cells) are validated visually, not in tests.

### E2E (`playwright`, 2–3 flows)

- PM creates project → assigns workflows to phases → Kicks Off Permitting (with mocked Lark login)
- IC marks task started → submits for review → reviewer approves → IC marks complete
- Owner unlocks an in-progress project to draft with a reason (audit row created)

### CI

GitHub Actions on every PR:

1. Lint (`eslint`)
2. Typecheck (`tsc --noEmit`)
3. Unit tests
4. Integration tests (Postgres service container)
5. Component tests
6. On merge to main: `next build`
7. Nightly / manual: Playwright E2E

### Explicitly not doing

- No coverage thresholds beyond what's listed above; chasing 100% wastes time.
- No DB mocks. Drizzle types depend on the real schema.
- No UI snapshot tests; high maintenance cost, low signal.
- No React component tests in the unit layer; that's the component-test layer's job.

---

## 14. Out of scope (future specs)

The foundation enables but does not deliver:

- **Dashboard / Team / Performance Review views**: covered in `2026-05-25-dashboard-design.md` (drafted alongside this update; consumes the schema defined here)
- **Project page UI**: Overview / Gantt / Task List sections, layout, interactions
- **My Tasks page UI**: tabs (My Tasks, Pending Review, Complete), LLM-based daily ranking, daily reminders
- **Workflow template editor UI**: dependency-graph editor for owner
- **Notifications**: Lark group / DM delivery, in-app toast/badge system
- **Pipeline meeting view**: aggregated cross-project dashboard
- **Mobile / external API**: deferred; B-track allows adding Route Handlers later

Each of these is a separate spec building on this foundation.

---

## 15. Open implementation questions

These are not blockers for the foundation spec, but should be resolved when planning implementation:

1. **Rate-limit storage**: in-memory `lru-cache` is fine for a single instance, but if multiple Next.js processes run on one host (e.g., behind a load balancer), use Upstash Redis. Decision deferred to deployment plan.
2. **Logging / observability**: choose between Pino + log file, Pino + Logflare/Better Stack, or OpenTelemetry. Decision deferred.
3. **Backup strategy**: outside the scope of this spec. Deployment runbook will specify pg_dump cadence and retention.
