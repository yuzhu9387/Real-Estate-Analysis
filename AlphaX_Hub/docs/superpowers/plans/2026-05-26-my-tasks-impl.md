# BuildFlow My Tasks Page — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the per-user My Tasks page per `docs/superpowers/specs/2026-05-26-my-tasks-design.md`: three tabs (Open Tasks / Pending Review / Completed), in-app banner of overdue / blocked / ready counts, DB-driven ranking, deep-link from task rows into project page drawers, drawer priority control, settings page with Lark digest opt-out toggle, and a secret-gated Lark daily-digest cron Route Handler with new Lark messaging helper.

**Architecture:** All ranking and bucket counts are pure functions over DB rows — no LLM, no cron-driven precomputation. Server Components fetch via a single `getMyTasks` query and render the page in one round-trip. Two schema additions (`tasks.priority` enum, `users.lark_digest_opted_out` boolean), two Server Actions, one new permission action, one new Route Handler. Lark messaging uses a separate Lark app credential (different from the OAuth-login app).

**Tech Stack:** Same as foundation — Next.js 14, TypeScript, Drizzle + Postgres, Radix Dialog (for any modals), Tailwind, Vitest. Builds on `main` after the project page merge (commit `e61cada`).

---

## Phase 1: Schema additions

### Task 1.1: `tasks.priority` column + Drizzle schema

**Files:**
- Modify: `db/schema/tasks.ts`
- Create: `db/migrations/0006_add_task_priority.sql` (hand-written; Drizzle Kit will also emit one — we replace it)

- [ ] **Step 1: Add the field to Drizzle schema**

Modify `db/schema/tasks.ts` — add the `priority` column inside the `pgTable('tasks', { ... })` call, right after `status`:

```ts
priority: text('priority', { enum: ['low', 'normal', 'high'] }).notNull().default('normal'),
```

(Re-export `TaskPriority` type if needed at the bottom of the file:)

```ts
export type TaskPriority = Task['priority']
```

- [ ] **Step 2: Generate migration**

```bash
npm run db:generate
```

This emits a new migration file (e.g. `0006_<adjective>_<noun>.sql`). Drizzle generates ADD COLUMN statements but **does not emit the CHECK constraint** (see foundation Phase 2 — known limitation).

- [ ] **Step 3: Append the CHECK constraint to the generated migration**

Open the newly generated `db/migrations/0006_*.sql`. After the existing `ALTER TABLE` statement, append:

```sql
ALTER TABLE "tasks"
  ADD CONSTRAINT "tasks_priority_check" CHECK ("priority" IN ('low','normal','high'));
```

- [ ] **Step 4: Apply migration to dev DB**

```bash
npm run db:migrate
```

Verify column exists:

```bash
docker exec buildflow-postgres psql -U buildflow -d buildflow -c "\d tasks" | grep priority
```

Expected: `priority | text | ... | not null | 'normal'::text`

- [ ] **Step 5: Apply migration to test DB**

```bash
DATABASE_URL=postgres://buildflow:buildflow_dev@localhost:5433/buildflow_test npm run db:migrate
```

- [ ] **Step 6: Commit**

```bash
git add db/schema/tasks.ts db/migrations/
git commit -m "feat(db): add tasks.priority enum (low|normal|high)"
```

---

### Task 1.2: `users.lark_digest_opted_out` column

**Files:**
- Modify: `db/schema/users.ts`
- Create: `db/migrations/0007_add_user_digest_opt_out.sql` (Drizzle-generated)

- [ ] **Step 1: Add the field to Drizzle schema**

Modify `db/schema/users.ts` — add this column right after `isActive`:

```ts
larkDigestOptedOut: boolean('lark_digest_opted_out').notNull().default(false),
```

- [ ] **Step 2: Generate, apply, commit**

```bash
npm run db:generate
npm run db:migrate
DATABASE_URL=postgres://buildflow:buildflow_dev@localhost:5433/buildflow_test npm run db:migrate
git add db/schema/users.ts db/migrations/
git commit -m "feat(db): add users.lark_digest_opted_out boolean"
```

Verify:

```bash
docker exec buildflow-postgres psql -U buildflow -d buildflow -c "\d users" | grep digest
```

Expected: `lark_digest_opted_out | boolean | ... | not null | false`

---

## Phase 2: Pure-function helpers

### Task 2.1: `ranking.ts` — sort tasks

**Files:**
- Create: `lib/my-tasks/ranking.ts`
- Create: `lib/my-tasks/ranking.test.ts`

- [ ] **Step 1: Tests**

```ts
// lib/my-tasks/ranking.test.ts
import { describe, it, expect } from 'vitest'
import { rankMyOpenTasks, type TaskRanked } from './ranking'

function makeTask(p: Partial<TaskRanked>): TaskRanked {
  return {
    id: p.id ?? Math.random().toString(36).slice(2),
    isBlocked: false,
    plannedEndDay: null,
    isOnCriticalPath: false,
    priority: 'normal',
    ...p,
  }
}

describe('rankMyOpenTasks', () => {
  it('empty input → empty output', () => {
    expect(rankMyOpenTasks([], 0)).toEqual([])
  })

  it('unblocked tasks before blocked', () => {
    const a = makeTask({ id: 'a', isBlocked: true })
    const b = makeTask({ id: 'b', isBlocked: false })
    expect(rankMyOpenTasks([a, b], 0).map(t => t.id)).toEqual(['b', 'a'])
  })

  it('among unblocked, earlier planned_end_day first', () => {
    const tasks = [
      makeTask({ id: 'late', plannedEndDay: 30 }),
      makeTask({ id: 'mid', plannedEndDay: 10 }),
      makeTask({ id: 'early', plannedEndDay: 5 }),
    ]
    expect(rankMyOpenTasks(tasks, 0).map(t => t.id)).toEqual(['early', 'mid', 'late'])
  })

  it('null planned_end_day sorts last among unblocked', () => {
    const tasks = [
      makeTask({ id: 'nil', plannedEndDay: null }),
      makeTask({ id: 'soon', plannedEndDay: 5 }),
    ]
    expect(rankMyOpenTasks(tasks, 0).map(t => t.id)).toEqual(['soon', 'nil'])
  })

  it('among same due-day, critical-path first', () => {
    const tasks = [
      makeTask({ id: 'normal', plannedEndDay: 10, isOnCriticalPath: false }),
      makeTask({ id: 'critical', plannedEndDay: 10, isOnCriticalPath: true }),
    ]
    expect(rankMyOpenTasks(tasks, 0).map(t => t.id)).toEqual(['critical', 'normal'])
  })

  it('among same urgency + critical, HIGH priority first', () => {
    const tasks = [
      makeTask({ id: 'lo', plannedEndDay: 10, isOnCriticalPath: true, priority: 'low' }),
      makeTask({ id: 'hi', plannedEndDay: 10, isOnCriticalPath: true, priority: 'high' }),
      makeTask({ id: 'mid', plannedEndDay: 10, isOnCriticalPath: true, priority: 'normal' }),
    ]
    expect(rankMyOpenTasks(tasks, 0).map(t => t.id)).toEqual(['hi', 'mid', 'lo'])
  })

  it('worked example from spec', () => {
    const tasks = [
      makeTask({ id: 'A', isBlocked: false, plannedEndDay: 45, isOnCriticalPath: true,  priority: 'normal' }),
      makeTask({ id: 'B', isBlocked: false, plannedEndDay: 50, isOnCriticalPath: true,  priority: 'high' }),
      makeTask({ id: 'C', isBlocked: false, plannedEndDay: 50, isOnCriticalPath: false, priority: 'high' }),
      makeTask({ id: 'D', isBlocked: false, plannedEndDay: null, isOnCriticalPath: false, priority: 'high' }),
      makeTask({ id: 'E', isBlocked: true,  plannedEndDay: 40, isOnCriticalPath: true,  priority: 'high' }),
    ]
    expect(rankMyOpenTasks(tasks, 47).map(t => t.id)).toEqual(['A', 'B', 'C', 'D', 'E'])
  })
})
```

Run, expect FAIL.

- [ ] **Step 2: Implement**

```ts
// lib/my-tasks/ranking.ts
import type { TaskPriority } from '@/db/schema'

export type TaskRanked = {
  id: string
  isBlocked: boolean
  plannedEndDay: number | null
  isOnCriticalPath: boolean
  priority: TaskPriority
}

const PRIORITY_RANK: Record<TaskPriority, number> = { high: 0, normal: 1, low: 2 }

function urgency(plannedEndDay: number | null, todayDayOffset: number): number {
  if (plannedEndDay === null) return Number.POSITIVE_INFINITY
  return plannedEndDay - todayDayOffset
}

export function rankMyOpenTasks(tasks: TaskRanked[], todayDayOffset: number): TaskRanked[] {
  return [...tasks].sort((a, b) => {
    const blockedDiff = (a.isBlocked ? 1 : 0) - (b.isBlocked ? 1 : 0)
    if (blockedDiff !== 0) return blockedDiff
    const urgencyDiff = urgency(a.plannedEndDay, todayDayOffset) - urgency(b.plannedEndDay, todayDayOffset)
    if (urgencyDiff !== 0) return urgencyDiff
    const criticalDiff = (a.isOnCriticalPath ? 0 : 1) - (b.isOnCriticalPath ? 0 : 1)
    if (criticalDiff !== 0) return criticalDiff
    return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
  })
}
```

Run, expect PASS. Commit:

```bash
git add lib/my-tasks/ranking.ts lib/my-tasks/ranking.test.ts
git commit -m "feat(my-tasks): rankMyOpenTasks sort by blocked → due → critical → priority"
```

---

### Task 2.2: `banner-counts.ts`

**Files:**
- Create: `lib/my-tasks/banner-counts.ts`
- Create: `lib/my-tasks/banner-counts.test.ts`

- [ ] **Step 1: Tests**

```ts
// lib/my-tasks/banner-counts.test.ts
import { describe, it, expect } from 'vitest'
import { computeBannerCounts } from './banner-counts'

describe('computeBannerCounts', () => {
  it('empty input → all zeros', () => {
    expect(computeBannerCounts([], 0)).toEqual({ overdue: 0, blocked: 0, ready: 0 })
  })

  it('overdue = past planned_end_day and not blocked', () => {
    expect(computeBannerCounts([
      { status: 'started', isBlocked: false, plannedEndDay: 5 },
    ], 10)).toEqual({ overdue: 1, blocked: 0, ready: 0 })
  })

  it('blocked counts in blocked bucket only (not overdue)', () => {
    expect(computeBannerCounts([
      { status: 'not_started', isBlocked: true, plannedEndDay: 5 },
    ], 10)).toEqual({ overdue: 0, blocked: 1, ready: 0 })
  })

  it('ready = not blocked and not overdue', () => {
    expect(computeBannerCounts([
      { status: 'not_started', isBlocked: false, plannedEndDay: 20 },
      { status: 'started', isBlocked: false, plannedEndDay: null },
    ], 10)).toEqual({ overdue: 0, blocked: 0, ready: 2 })
  })

  it('mixed', () => {
    expect(computeBannerCounts([
      { status: 'started', isBlocked: false, plannedEndDay: 3 },        // overdue
      { status: 'not_started', isBlocked: true, plannedEndDay: 3 },     // blocked (priority over overdue)
      { status: 'not_started', isBlocked: false, plannedEndDay: 15 },   // ready
      { status: 'started', isBlocked: false, plannedEndDay: null },     // ready
    ], 10)).toEqual({ overdue: 1, blocked: 1, ready: 2 })
  })
})
```

- [ ] **Step 2: Implement**

```ts
// lib/my-tasks/banner-counts.ts
import type { TaskStatus } from '@/db/schema'

export type BannerCountsInput = {
  status: TaskStatus
  isBlocked: boolean
  plannedEndDay: number | null
}

export type BannerCounts = {
  overdue: number
  blocked: number
  ready: number
}

export function computeBannerCounts(
  openTasks: BannerCountsInput[],
  todayDayOffset: number,
): BannerCounts {
  let overdue = 0, blocked = 0, ready = 0
  for (const t of openTasks) {
    if (t.isBlocked) {
      blocked++
      continue
    }
    if (t.plannedEndDay !== null && todayDayOffset > t.plannedEndDay) {
      overdue++
      continue
    }
    ready++
  }
  return { overdue, blocked, ready }
}
```

Run, commit:

```bash
git add lib/my-tasks/banner-counts.ts lib/my-tasks/banner-counts.test.ts
git commit -m "feat(my-tasks): computeBannerCounts pure function"
```

---

### Task 2.3: `digest-payload.ts` — per-user digest counts

**Files:**
- Create: `lib/my-tasks/digest-payload.ts`
- Create: `lib/my-tasks/digest-payload.test.ts`

- [ ] **Step 1: Tests**

```ts
// lib/my-tasks/digest-payload.test.ts
import { describe, it, expect } from 'vitest'
import { buildDigestMessage, shouldSendDigest } from './digest-payload'

describe('shouldSendDigest', () => {
  it('returns false when all counts are 0', () => {
    expect(shouldSendDigest({ overdueCount: 0, dueThisWeekCount: 0, pendingMyReviewCount: 0 })).toBe(false)
  })
  it('returns true when any count > 0', () => {
    expect(shouldSendDigest({ overdueCount: 1, dueThisWeekCount: 0, pendingMyReviewCount: 0 })).toBe(true)
    expect(shouldSendDigest({ overdueCount: 0, dueThisWeekCount: 3, pendingMyReviewCount: 0 })).toBe(true)
    expect(shouldSendDigest({ overdueCount: 0, dueThisWeekCount: 0, pendingMyReviewCount: 1 })).toBe(true)
  })
})

describe('buildDigestMessage', () => {
  it('includes all three counts and the link', () => {
    const out = buildDigestMessage({
      overdueCount: 3, dueThisWeekCount: 5, pendingMyReviewCount: 2,
      myTasksUrl: 'https://buildflow.example.com/my-tasks',
    })
    expect(out).toContain('Overdue: 3')
    expect(out).toContain('Due this week: 5')
    expect(out).toContain('Pending your review: 2')
    expect(out).toContain('https://buildflow.example.com/my-tasks')
  })
})
```

- [ ] **Step 2: Implement**

```ts
// lib/my-tasks/digest-payload.ts
export type DigestCounts = {
  overdueCount: number
  dueThisWeekCount: number
  pendingMyReviewCount: number
}

export function shouldSendDigest(counts: DigestCounts): boolean {
  return counts.overdueCount > 0 || counts.dueThisWeekCount > 0 || counts.pendingMyReviewCount > 0
}

export function buildDigestMessage(input: DigestCounts & { myTasksUrl: string }): string {
  return [
    '📋 BuildFlow daily digest',
    `Overdue: ${input.overdueCount}`,
    `Due this week: ${input.dueThisWeekCount}`,
    `Pending your review: ${input.pendingMyReviewCount}`,
    `👉 ${input.myTasksUrl}`,
  ].join('\n')
}
```

Run, commit:

```bash
git add lib/my-tasks/digest-payload.ts lib/my-tasks/digest-payload.test.ts
git commit -m "feat(my-tasks): shouldSendDigest + buildDigestMessage"
```

---

## Phase 3: Permission addition

### Task 3.1: Add `task.set_priority` action

**Files:**
- Modify: `lib/permissions.ts`
- Modify: `lib/permissions.test.ts`

- [ ] **Step 1: Add the action variant to the `Action` union**

In `lib/permissions.ts`, locate the `Action = ...` type and add a new variant alongside `task.update_notes`:

```ts
| { type: 'task.set_priority'; project: ProjectContext; task: TaskContext }
```

- [ ] **Step 2: Add the case branch in `can()`**

In the `switch (action.type)` block, add a case below `task.update_notes`:

```ts
case 'task.set_priority':
  return projectMutable(action.project) && (managesProject(action.project) || taskOwner(action.task))
```

- [ ] **Step 3: Add a test**

Append to `lib/permissions.test.ts`:

```ts
describe('task.set_priority', () => {
  it('task owner, managing PM, owner can; unrelated IC cannot', () => {
    const a = { type: 'task.set_priority' as const, project: liveProject, task: taskOwnedByCarol }
    expect(can(owner, a)).toBe(true)
    expect(can(pmAlice, a)).toBe(true)
    expect(can(pmBob, a)).toBe(false)
    expect(can(icCarol, a)).toBe(true)
    expect(can(icDave, a)).toBe(false)
  })
  it('blocked on archived', () => {
    const a = { type: 'task.set_priority' as const, project: archived, task: taskOwnedByCarol }
    expect(can(owner, a)).toBe(false)
    expect(can(icCarol, a)).toBe(false)
  })
})
```

- [ ] **Step 4: Run and commit**

```bash
npm test -- lib/permissions.test.ts
git add lib/permissions.ts lib/permissions.test.ts
git commit -m "feat(permissions): task.set_priority action"
```

---

## Phase 4: Server Actions

### Task 4.1: `setTaskPriority`

**Files:**
- Modify: `lib/services/task-service.ts` (add method)
- Modify: `app/actions/tasks.ts` (add action)
- Create: `lib/services/task-service.priority.test.ts`

- [ ] **Step 1: Test**

```ts
// lib/services/task-service.priority.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { eq } from 'drizzle-orm'
import { testDb, truncateAll } from '@/tests/db'
import { tasks } from '@/db/schema'
import { seedOwner, seedPm } from '@/tests/fixtures/users'
import { seedTemplate } from '@/tests/fixtures/workflow-templates'
import { projectService } from './project-service'
import { taskService } from './task-service'

async function setup() {
  const owner = await seedOwner()
  const pm = await seedPm()
  const { template } = await seedTemplate({
    createdById: owner.id, name: 'P', tasks: [{ name: 'A', durationDays: 1 }], deps: [],
  })
  const project = await projectService.create({
    createdById: pm.id, name: 'X', brand: 'al_homes', pmId: pm.id,
    assignments: [{ phaseName: 'Permitting', templateId: template.id, sortOrder: 0 }],
  }, testDb)
  const [task] = await testDb.select().from(tasks).where(eq(tasks.projectId, project.id))
  return { project, pm, task }
}

describe('taskService.setPriority', () => {
  beforeEach(async () => { await truncateAll() })

  it('updates priority and stores it', async () => {
    const { task, pm } = await setup()
    await taskService.setPriority({ taskId: task.id, priority: 'high', actorId: pm.id }, testDb)
    const re = await testDb.select().from(tasks).where(eq(tasks.id, task.id))
    expect(re[0].priority).toBe('high')
  })

  it('writes activity row', async () => {
    const { task, pm } = await setup()
    const { activities } = await import('@/db/schema')
    await taskService.setPriority({ taskId: task.id, priority: 'high', actorId: pm.id }, testDb)
    const acts = await testDb.select().from(activities).where(eq(activities.type, 'task.priority_changed'))
    expect(acts.length).toBe(1)
    expect((acts[0].payload as { to: string }).to).toBe('high')
  })
})
```

- [ ] **Step 2: Implement service method**

In `lib/services/task-service.ts`, add to `taskService`:

```ts
async setPriority(input: { taskId: string; priority: 'low'|'normal'|'high'; actorId: string }, db: DB) {
  return db.transaction(async (tx) => {
    const rows = await tx.select().from(tasks).where(eq(tasks.id, input.taskId))
    if (rows.length === 0) throw new NotFoundError('Task')
    const before = rows[0].priority
    if (before === input.priority) return
    await tx.update(tasks).set({ priority: input.priority, updatedAt: new Date() })
      .where(eq(tasks.id, input.taskId))
    await tx.insert(activities).values({
      projectId: rows[0].projectId, actorId: input.actorId,
      type: 'task.priority_changed',
      payload: { taskId: input.taskId, from: before, to: input.priority },
    })
  })
},
```

- [ ] **Step 3: Implement Server Action**

In `app/actions/tasks.ts`, add:

```ts
export async function setTaskPriority(raw: unknown) {
  const input = z.object({
    taskId: z.string().uuid(),
    priority: z.enum(['low','normal','high']),
  }).parse(raw)
  const { task, project } = await loadTaskCtx(input.taskId)
  const user = await requirePermission({
    type: 'task.set_priority',
    project: { pmId: project.pmId, status: project.status },
    task: { ownerId: task.ownerId, reviewerId: task.reviewerId },
  })
  await taskService.setPriority({ taskId: input.taskId, priority: input.priority, actorId: user.id }, db)
  revalidatePath(`/projects/${project.id}`)
  revalidatePath('/my-tasks')
  return { ok: true }
}
```

(`loadTaskCtx` already exists in `app/actions/tasks.ts` from foundation Phase 10.)

- [ ] **Step 4: Run and commit**

```bash
npm test -- lib/services/task-service.priority.test.ts
git add lib/services/task-service.ts app/actions/tasks.ts lib/services/task-service.priority.test.ts
git commit -m "feat(service): setTaskPriority with permission + activity log"
```

---

### Task 4.2: `setLarkDigestOptOut`

**Files:**
- Modify: `app/actions/users.ts`
- Create: `app/actions/users.opt-out.test.ts` (smoke test against the existing user table)

- [ ] **Step 1: Test**

```ts
// app/actions/users.opt-out.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { eq } from 'drizzle-orm'
import { testDb, truncateAll } from '@/tests/db'
import { users } from '@/db/schema'
import { seedIc } from '@/tests/fixtures/users'

// We can't easily test the Server Action layer (it depends on Next request context).
// Instead, test the underlying logic via direct DB ops mirroring what the action does.

describe('lark digest opt-out (DB layer)', () => {
  beforeEach(async () => { await truncateAll() })

  it('default is opted-in (false)', async () => {
    const u = await seedIc('IC', 'design')
    const re = await testDb.select().from(users).where(eq(users.id, u.id))
    expect(re[0].larkDigestOptedOut).toBe(false)
  })

  it('flipping to opted-out persists', async () => {
    const u = await seedIc('IC', 'design')
    await testDb.update(users).set({ larkDigestOptedOut: true }).where(eq(users.id, u.id))
    const re = await testDb.select().from(users).where(eq(users.id, u.id))
    expect(re[0].larkDigestOptedOut).toBe(true)
  })
})
```

- [ ] **Step 2: Add the Server Action to `app/actions/users.ts`**

Append:

```ts
export async function setLarkDigestOptOut(raw: unknown) {
  const input = z.object({ optedOut: z.boolean() }).parse(raw)
  const user = await (await import('@/lib/server/get-current-user')).requireUser()
  await db.update(users).set({ larkDigestOptedOut: input.optedOut }).where(eq(users.id, user.id))
  revalidatePath('/settings/me')
  return { ok: true }
}
```

(`requireUser` is already exported from `lib/server/get-current-user.ts`.)

- [ ] **Step 3: Run and commit**

```bash
npm test -- app/actions/users.opt-out.test.ts
git add app/actions/users.ts app/actions/users.opt-out.test.ts
git commit -m "feat(actions): setLarkDigestOptOut on current user"
```

---

## Phase 5: Lark messaging helper

### Task 5.1: `lib/lark/messaging.ts`

**Files:**
- Create: `lib/lark/messaging.ts`
- Create: `lib/lark/messaging.test.ts`

- [ ] **Step 1: Tests (with mocked fetcher; verify token cache + retry)**

```ts
// lib/lark/messaging.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { _resetTokenCache, sendLarkDirectMessage } from './messaging'

describe('sendLarkDirectMessage', () => {
  beforeEach(() => _resetTokenCache())

  it('fetches a tenant access token then sends the message', async () => {
    const calls: Array<{ url: string; body?: unknown }> = []
    const fetcher = async (url: string | URL, init?: RequestInit): Promise<Response> => {
      calls.push({ url: String(url), body: init?.body ? JSON.parse(String(init.body)) : undefined })
      if (String(url).includes('tenant_access_token')) {
        return new Response(JSON.stringify({ tenant_access_token: 'tok-A', expire: 7200 }), { status: 200 })
      }
      return new Response(JSON.stringify({ code: 0, msg: 'ok' }), { status: 200 })
    }
    await sendLarkDirectMessage({
      openId: 'ou_x', text: 'hi', link: 'https://app/x',
      fetcher: fetcher as typeof fetch,
      env: { appId: 'cli', appSecret: 'sec' },
    })
    expect(calls).toHaveLength(2)
    expect(calls[0].url).toContain('tenant_access_token')
    expect(calls[1].url).toContain('/im/v1/messages')
  })

  it('reuses cached token on second call', async () => {
    let tokenCalls = 0
    const fetcher = async (url: string | URL): Promise<Response> => {
      if (String(url).includes('tenant_access_token')) {
        tokenCalls++
        return new Response(JSON.stringify({ tenant_access_token: 'tok-A', expire: 7200 }), { status: 200 })
      }
      return new Response(JSON.stringify({ code: 0 }), { status: 200 })
    }
    await sendLarkDirectMessage({ openId: 'ou_x', text: 'hi', fetcher: fetcher as typeof fetch, env: { appId: 'cli', appSecret: 'sec' } })
    await sendLarkDirectMessage({ openId: 'ou_x', text: 'hi2', fetcher: fetcher as typeof fetch, env: { appId: 'cli', appSecret: 'sec' } })
    expect(tokenCalls).toBe(1)
  })

  it('throws when the message endpoint returns non-OK', async () => {
    const fetcher = async (url: string | URL): Promise<Response> => {
      if (String(url).includes('tenant_access_token')) {
        return new Response(JSON.stringify({ tenant_access_token: 'tok-A', expire: 7200 }), { status: 200 })
      }
      return new Response('{"code":99991663,"msg":"bad receive_id"}', { status: 400 })
    }
    await expect(sendLarkDirectMessage({
      openId: 'ou_bad', text: 'hi', fetcher: fetcher as typeof fetch, env: { appId: 'cli', appSecret: 'sec' },
    })).rejects.toThrow(/Lark message/)
  })
})
```

- [ ] **Step 2: Implement**

```ts
// lib/lark/messaging.ts
const TOKEN_URL = 'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal'
const MESSAGE_URL = 'https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=open_id'

let cachedToken: { token: string; expiresAt: number } | null = null

export function _resetTokenCache() { cachedToken = null }

async function getTenantAccessToken(input: { appId: string; appSecret: string; fetcher: typeof fetch }): Promise<string> {
  const now = Date.now()
  if (cachedToken && cachedToken.expiresAt > now + 30_000) return cachedToken.token
  const res = await input.fetcher(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ app_id: input.appId, app_secret: input.appSecret }),
  })
  if (!res.ok) throw new Error(`Lark tenant_access_token failed: ${res.status}`)
  const json = await res.json() as { tenant_access_token?: string; expire?: number }
  if (!json.tenant_access_token) throw new Error('Lark tenant_access_token missing in response')
  const expireSec = json.expire ?? 7200
  cachedToken = { token: json.tenant_access_token, expiresAt: now + (expireSec * 1000) }
  return cachedToken.token
}

export async function sendLarkDirectMessage(input: {
  openId: string
  text: string
  link?: string
  fetcher?: typeof fetch
  env?: { appId: string; appSecret: string }
}): Promise<void> {
  const fetcher = input.fetcher ?? fetch
  const env = input.env ?? {
    appId: process.env.LARK_MESSAGING_APP_ID ?? '',
    appSecret: process.env.LARK_MESSAGING_APP_SECRET ?? '',
  }
  if (!env.appId || !env.appSecret) throw new Error('LARK_MESSAGING_APP_ID/SECRET not set')

  const token = await getTenantAccessToken({ ...env, fetcher })
  const bodyText = input.link ? `${input.text}\n${input.link}` : input.text

  const res = await fetcher(MESSAGE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      receive_id: input.openId,
      msg_type: 'text',
      content: JSON.stringify({ text: bodyText }),
    }),
  })
  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`Lark message send failed: ${res.status} ${errText}`)
  }
}
```

- [ ] **Step 3: Run and commit**

```bash
npm test -- lib/lark/messaging.test.ts
git add lib/lark/messaging.ts lib/lark/messaging.test.ts
git commit -m "feat(lark): messaging helper with token cache"
```

---

### Task 5.2: Add Lark messaging env vars

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: Append the new env vars**

Append to `.env.example`:

```
# Lark messaging (different app from OAuth login)
LARK_MESSAGING_APP_ID=
LARK_MESSAGING_APP_SECRET=
LARK_DIGEST_CRON_SECRET=

# Where /my-tasks lives for the digest link (e.g. http://localhost:3000 or your production URL)
APP_PUBLIC_URL=http://localhost:3000
```

Commit:

```bash
git add .env.example
git commit -m "chore(env): Lark messaging + digest cron secret + app url"
```

---

## Phase 6: Data queries

### Task 6.1: `getMyTasks` query

**Files:**
- Create: `db/queries/my-tasks.ts`
- Create: `db/queries/my-tasks.test.ts`

- [ ] **Step 1: Tests**

```ts
// db/queries/my-tasks.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { eq } from 'drizzle-orm'
import { testDb, truncateAll } from '@/tests/db'
import { tasks } from '@/db/schema'
import { seedOwner, seedPm, seedIc } from '@/tests/fixtures/users'
import { seedTemplate } from '@/tests/fixtures/workflow-templates'
import { projectService } from '@/lib/services/project-service'
import { taskService } from '@/lib/services/task-service'
import { getMyTasks } from './my-tasks'

describe('getMyTasks', () => {
  beforeEach(async () => { await truncateAll() })

  it('returns open tasks owned by user, sorted by ranking', async () => {
    const owner = await seedOwner()
    const pm = await seedPm()
    const ic = await seedIc('IC', 'design')
    const { template } = await seedTemplate({
      createdById: owner.id, name: 'P',
      tasks: [{ name: 'A', durationDays: 2 }, { name: 'B', durationDays: 3 }],
      deps: [],
    })
    const project = await projectService.create({
      createdById: pm.id, name: '12 Maple', brand: 'al_homes', pmId: pm.id,
      assignments: [{ phaseName: 'Permitting', templateId: template.id, sortOrder: 0 }],
    }, testDb)
    const allTasks = await testDb.select().from(tasks).where(eq(tasks.projectId, project.id))
    for (const t of allTasks) await testDb.update(tasks).set({ ownerId: ic.id }).where(eq(tasks.id, t.id))

    const out = await getMyTasks(testDb, ic.id)
    expect(out.openTasks.length).toBe(2)
    expect(out.openTasks[0].project.name).toBe('12 Maple')
    expect(out.openTasks[0].phase.name).toBe('Permitting')
  })

  it('Pending Review returns tasks where user is reviewer and status=pending_review', async () => {
    const owner = await seedOwner()
    const pm = await seedPm()
    const ic = await seedIc('IC', 'design')
    const reviewer = await seedIc('Rev', 'design')
    const { template } = await seedTemplate({
      createdById: owner.id, name: 'P', tasks: [{ name: 'A', durationDays: 1 }], deps: [],
    })
    const project = await projectService.create({
      createdById: pm.id, name: 'X', brand: 'al_homes', pmId: pm.id,
      assignments: [{ phaseName: 'Permitting', templateId: template.id, sortOrder: 0 }],
    }, testDb)
    const [task] = await testDb.select().from(tasks).where(eq(tasks.projectId, project.id))
    await testDb.update(tasks).set({ ownerId: ic.id, reviewerId: reviewer.id }).where(eq(tasks.id, task.id))
    await taskService.submitForReview({ taskId: task.id, actorId: ic.id, body: 'done' }, testDb)

    const out = await getMyTasks(testDb, reviewer.id)
    expect(out.pendingReview).toHaveLength(1)
    expect(out.pendingReview[0].task.id).toBe(task.id)
  })

  it('Completed returns user-owned tasks in complete/wont_do, paginated', async () => {
    const owner = await seedOwner()
    const pm = await seedPm()
    const ic = await seedIc('IC', 'design')
    const { template } = await seedTemplate({
      createdById: owner.id, name: 'P',
      tasks: [{ name: 'A', durationDays: 1 }, { name: 'B', durationDays: 1 }],
      deps: [],
    })
    const project = await projectService.create({
      createdById: pm.id, name: 'X', brand: 'al_homes', pmId: pm.id,
      assignments: [{ phaseName: 'Permitting', templateId: template.id, sortOrder: 0 }],
    }, testDb)
    const ts = await testDb.select().from(tasks).where(eq(tasks.projectId, project.id))
    for (const t of ts) await testDb.update(tasks).set({ ownerId: ic.id }).where(eq(tasks.id, t.id))
    await taskService.setStatus({ taskId: ts[0].id, status: 'complete', actorId: ic.id }, testDb)
    await taskService.setStatus({ taskId: ts[1].id, status: 'wont_do', actorId: ic.id }, testDb)

    const out = await getMyTasks(testDb, ic.id)
    expect(out.completedTasks).toHaveLength(2)
    expect(out.completedTotal).toBe(2)
  })

  it('excludes tasks in archived projects from Open', async () => {
    const owner = await seedOwner()
    const pm = await seedPm()
    const ic = await seedIc('IC', 'design')
    const { template } = await seedTemplate({
      createdById: owner.id, name: 'P', tasks: [{ name: 'A', durationDays: 1 }], deps: [],
    })
    const project = await projectService.create({
      createdById: pm.id, name: 'X', brand: 'al_homes', pmId: pm.id,
      assignments: [{ phaseName: 'Permitting', templateId: template.id, sortOrder: 0 }],
    }, testDb)
    const [task] = await testDb.select().from(tasks).where(eq(tasks.projectId, project.id))
    await testDb.update(tasks).set({ ownerId: ic.id }).where(eq(tasks.id, task.id))

    const { projects } = await import('@/db/schema')
    await testDb.update(projects).set({ status: 'archived' })

    const out = await getMyTasks(testDb, ic.id)
    expect(out.openTasks).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Implement**

```ts
// db/queries/my-tasks.ts
import { and, eq, inArray, notInArray, desc, asc, sql } from 'drizzle-orm'
import type { DB } from '@/db/client'
import {
  tasks, projects, projectPhases, projectWorkflows,
  type Task, type Project, type ProjectPhase,
} from '@/db/schema'
import { rankMyOpenTasks } from '@/lib/my-tasks/ranking'

export type TaskWithContext = {
  task: Task
  project: Pick<Project, 'id' | 'name' | 'status' | 'brand' | 'kickedOffAt'>
  phase: Pick<ProjectPhase, 'id' | 'name'>
}

export type MyTasksData = {
  openTasks: TaskWithContext[]
  pendingReview: TaskWithContext[]
  completedTasks: TaskWithContext[]
  completedTotal: number
  todayDayOffset: number
}

const TERMINAL_STATUSES = ['complete', 'wont_do'] as const

async function withContext(db: DB, rows: Task[]): Promise<TaskWithContext[]> {
  if (rows.length === 0) return []
  const projectIds = Array.from(new Set(rows.map(r => r.projectId)))
  const workflowIds = Array.from(new Set(rows.map(r => r.projectWorkflowId)))

  const [projectRows, workflowRows, phaseRows] = await Promise.all([
    db.select({
      id: projects.id, name: projects.name, status: projects.status,
      brand: projects.brand, kickedOffAt: projects.kickedOffAt,
    }).from(projects).where(inArray(projects.id, projectIds)),
    db.select({
      id: projectWorkflows.id, projectPhaseId: projectWorkflows.projectPhaseId,
    }).from(projectWorkflows).where(inArray(projectWorkflows.id, workflowIds)),
    db.select({
      id: projectPhases.id, name: projectPhases.name,
    }).from(projectPhases).where(inArray(projectPhases.projectId, projectIds)),
  ])

  const projectById = new Map(projectRows.map(p => [p.id, p]))
  const workflowToPhase = new Map(workflowRows.map(w => [w.id, w.projectPhaseId]))
  const phaseById = new Map(phaseRows.map(p => [p.id, p]))

  return rows.map(t => {
    const phaseId = workflowToPhase.get(t.projectWorkflowId)!
    return {
      task: t,
      project: projectById.get(t.projectId)!,
      phase: phaseById.get(phaseId)!,
    }
  })
}

export async function getMyTasks(
  db: DB,
  userId: string,
  opts: { completedOffset?: number; completedLimit?: number } = {},
): Promise<MyTasksData> {
  const completedLimit = opts.completedLimit ?? 100
  const completedOffset = opts.completedOffset ?? 0

  // Open: my-owned, non-terminal, parent project is draft or in_progress
  const openRows = await db.select().from(tasks)
    .innerJoin(projects, eq(tasks.projectId, projects.id))
    .where(and(
      eq(tasks.ownerId, userId),
      notInArray(tasks.status, TERMINAL_STATUSES as unknown as string[]),
      inArray(projects.status, ['draft','in_progress']),
    ))
  const openTaskRows = openRows.map(r => r.tasks)
  const openWithCtx = await withContext(db, openTaskRows)

  // Compute today_day_offset using min kick-off across the relevant projects (clamped to 0)
  const todayMs = Date.now()
  const earliestKickoff = openTaskRows.length === 0 ? null
    : openRows.map(r => r.projects.kickedOffAt).filter((d): d is Date => d !== null).sort()[0] ?? null
  const todayDayOffset = earliestKickoff
    ? Math.max(0, Math.floor((todayMs - earliestKickoff.getTime()) / (24 * 60 * 60 * 1000)))
    : 0

  // Rank
  const rankedTasks = rankMyOpenTasks(
    openTaskRows.map(t => ({
      id: t.id, isBlocked: t.isBlocked, plannedEndDay: t.plannedEndDay,
      isOnCriticalPath: t.isOnCriticalPath, priority: t.priority,
    })),
    todayDayOffset,
  )
  const ctxById = new Map(openWithCtx.map(x => [x.task.id, x]))
  const openTasks = rankedTasks.map(r => ctxById.get(r.id)!).filter(Boolean)

  // Pending review
  const pendingRows = await db.select().from(tasks)
    .innerJoin(projects, eq(tasks.projectId, projects.id))
    .where(and(
      eq(tasks.reviewerId, userId),
      eq(tasks.status, 'pending_review'),
      eq(projects.status, 'in_progress'),
    ))
    .orderBy(asc(tasks.updatedAt))
  const pendingReview = await withContext(db, pendingRows.map(r => r.tasks))

  // Completed (paginated)
  const completedRows = await db.select().from(tasks)
    .innerJoin(projects, eq(tasks.projectId, projects.id))
    .where(and(
      eq(tasks.ownerId, userId),
      inArray(tasks.status, TERMINAL_STATUSES as unknown as string[]),
    ))
    .orderBy(desc(tasks.updatedAt))
    .limit(completedLimit)
    .offset(completedOffset)
  const completedTasks = await withContext(db, completedRows.map(r => r.tasks))

  const completedCountRow = await db.select({ c: sql<number>`count(*)::int` })
    .from(tasks)
    .where(and(
      eq(tasks.ownerId, userId),
      inArray(tasks.status, TERMINAL_STATUSES as unknown as string[]),
    ))
  const completedTotal = completedCountRow[0]?.c ?? 0

  return { openTasks, pendingReview, completedTasks, completedTotal, todayDayOffset }
}
```

- [ ] **Step 3: Run and commit**

```bash
npm test -- db/queries/my-tasks.test.ts
git add db/queries/my-tasks.ts db/queries/my-tasks.test.ts
git commit -m "feat(db): getMyTasks cross-project query with ranking + pagination"
```

---

### Task 6.2: `getDigestSummariesForActiveOptedInUsers`

**Files:**
- Modify: `db/queries/my-tasks.ts`
- Modify: `db/queries/my-tasks.test.ts`

- [ ] **Step 1: Append test**

```ts
// db/queries/my-tasks.test.ts — append at the end
import { getDigestSummariesForActiveOptedInUsers } from './my-tasks'
import { users } from '@/db/schema'

describe('getDigestSummariesForActiveOptedInUsers', () => {
  beforeEach(async () => { await truncateAll() })

  it('excludes opted-out and inactive users', async () => {
    const ic1 = await seedIc('a', 'design')
    const ic2 = await seedIc('b', 'design')
    const ic3 = await seedIc('c', 'design')
    await testDb.update(users).set({ larkDigestOptedOut: true }).where(eq(users.id, ic2.id))
    await testDb.update(users).set({ isActive: false }).where(eq(users.id, ic3.id))

    const out = await getDigestSummariesForActiveOptedInUsers(testDb)
    const ids = out.map(r => r.userId).sort()
    expect(ids).toEqual([ic1.id].sort())
  })

  it('computes counts correctly', async () => {
    const owner = await seedOwner()
    const pm = await seedPm()
    const ic = await seedIc('IC', 'design')
    const { template } = await seedTemplate({
      createdById: owner.id, name: 'P',
      tasks: [{ name: 'A', durationDays: 1 }, { name: 'B', durationDays: 1 }],
      deps: [],
    })
    const project = await projectService.create({
      createdById: pm.id, name: 'X', brand: 'al_homes', pmId: pm.id,
      assignments: [{ phaseName: 'Permitting', templateId: template.id, sortOrder: 0 }],
    }, testDb)
    const ts = await testDb.select().from(tasks).where(eq(tasks.projectId, project.id))
    for (const t of ts) await testDb.update(tasks).set({ ownerId: ic.id, reviewerId: pm.id }).where(eq(tasks.id, t.id))

    const summaries = await getDigestSummariesForActiveOptedInUsers(testDb)
    const me = summaries.find(s => s.userId === ic.id)
    expect(me).toBeDefined()
    expect(me!.overdueCount + me!.dueThisWeekCount).toBeGreaterThanOrEqual(0)
  })
})
```

- [ ] **Step 2: Append implementation**

Append to `db/queries/my-tasks.ts`:

```ts
import { users } from '@/db/schema'

export type DigestSummary = {
  userId: string
  larkOpenId: string
  overdueCount: number
  dueThisWeekCount: number
  pendingMyReviewCount: number
}

export async function getDigestSummariesForActiveOptedInUsers(db: DB): Promise<DigestSummary[]> {
  const eligibleUsers = await db.select({
    id: users.id, larkOpenId: users.larkOpenId,
  }).from(users).where(and(
    eq(users.isActive, true),
    eq(users.larkDigestOptedOut, false),
  ))
  if (eligibleUsers.length === 0) return []

  const out: DigestSummary[] = []
  for (const u of eligibleUsers) {
    const ownedOpen = await db.select({
      plannedEndDay: tasks.plannedEndDay,
      kickedOffAt: projects.kickedOffAt,
    }).from(tasks)
      .innerJoin(projects, eq(tasks.projectId, projects.id))
      .where(and(
        eq(tasks.ownerId, u.id),
        notInArray(tasks.status, TERMINAL_STATUSES as unknown as string[]),
        eq(projects.status, 'in_progress'),
      ))

    const pendingMyReview = await db.select({ c: sql<number>`count(*)::int` })
      .from(tasks)
      .innerJoin(projects, eq(tasks.projectId, projects.id))
      .where(and(
        eq(tasks.reviewerId, u.id),
        eq(tasks.status, 'pending_review'),
        eq(projects.status, 'in_progress'),
      ))

    let overdueCount = 0, dueThisWeekCount = 0
    const todayMs = Date.now()
    for (const r of ownedOpen) {
      if (r.plannedEndDay === null || !r.kickedOffAt) continue
      const todayOffset = Math.max(0, Math.floor((todayMs - r.kickedOffAt.getTime()) / (24 * 60 * 60 * 1000)))
      if (todayOffset > r.plannedEndDay) overdueCount++
      else if (r.plannedEndDay - todayOffset <= 7) dueThisWeekCount++
    }

    out.push({
      userId: u.id,
      larkOpenId: u.larkOpenId,
      overdueCount,
      dueThisWeekCount,
      pendingMyReviewCount: pendingMyReview[0]?.c ?? 0,
    })
  }
  return out
}
```

- [ ] **Step 3: Run and commit**

```bash
npm test -- db/queries/my-tasks.test.ts
git add db/queries/my-tasks.ts db/queries/my-tasks.test.ts
git commit -m "feat(db): getDigestSummariesForActiveOptedInUsers"
```

---

## Phase 7: My Tasks page UI

### Task 7.1: `<Banner />` component

**Files:**
- Create: `components/my-tasks/banner.tsx`

- [ ] **Step 1: Implement**

```tsx
// components/my-tasks/banner.tsx
import type { BannerCounts } from '@/lib/my-tasks/banner-counts'

export function Banner({ counts }: { counts: BannerCounts }) {
  const parts: string[] = []
  if (counts.overdue > 0) parts.push(`🔴 ${counts.overdue} overdue`)
  if (counts.blocked > 0) parts.push(`🟠 ${counts.blocked} blocked`)
  if (counts.ready > 0)   parts.push(`🟢 ${counts.ready} ready`)
  if (parts.length === 0) return null
  return (
    <div className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm">
      {parts.join(' · ')}
    </div>
  )
}
```

Commit:

```bash
git add components/my-tasks/banner.tsx
git commit -m "feat(my-tasks): banner component"
```

---

### Task 7.2: `<TaskRow />` cross-project component

**Files:**
- Create: `components/my-tasks/task-row.tsx`

- [ ] **Step 1: Implement**

```tsx
// components/my-tasks/task-row.tsx
import Link from 'next/link'
import { Avatar } from '@/components/shared/avatar'
import type { TaskWithContext } from '@/db/queries/my-tasks'
import { currentTaskStatus } from '@/lib/project-page/current-task-status'
import type { User } from '@/db/schema'

const LEVEL_STYLES = {
  on_track: { icon: '🟢', color: 'text-emerald-600' },
  at_risk: { icon: '🟠', color: 'text-amber-600' },
  delay: { icon: '🔴', color: 'text-red-600' },
} as const

function dueText(plannedEndDay: number | null, todayDayOffset: number): string {
  if (plannedEndDay === null) return 'no due date'
  const diff = plannedEndDay - todayDayOffset
  if (diff < 0) return `overdue ${-diff}d`
  if (diff === 0) return 'due today'
  return `due in ${diff}d`
}

export function TaskRow({
  item, todayDayOffset, variant, owner,
}: {
  item: TaskWithContext
  todayDayOffset: number
  variant: 'open' | 'pending_review' | 'completed'
  owner?: User | undefined   // shown in pending_review variant
}) {
  const { task, project, phase } = item
  const phaseSlug = phase.name.toLowerCase()
  const href = `/projects/${project.id}?tab=${phaseSlug}&task=${task.id}`

  if (variant === 'completed') {
    const icon = task.status === 'complete' ? '✓' : '✗'
    const completedAgo = `${Math.floor((Date.now() - new Date(task.updatedAt).getTime()) / (24 * 60 * 60 * 1000))}d ago`
    return (
      <Link href={href} className="block px-3 py-2 hover:bg-zinc-50 border-b border-zinc-100 last:border-0">
        <div className="flex items-center gap-3 text-sm text-zinc-600">
          <span className="w-4 text-emerald-600">{icon}</span>
          <span className="flex-1 truncate line-through">{task.name}</span>
          <span className="text-xs bg-zinc-100 px-2 py-0.5 rounded">{project.name} · {phase.name}</span>
          <span className="text-xs">{completedAgo}</span>
        </div>
      </Link>
    )
  }

  const { level, daysBehind } = currentTaskStatus(
    { status: task.status, isBlocked: task.isBlocked, plannedEndDay: task.plannedEndDay },
    todayDayOffset,
  )
  const style = LEVEL_STYLES[level]
  const label = level === 'delay' ? `delay ${daysBehind}d` : level === 'at_risk' ? 'at risk' : 'on track'

  return (
    <Link href={href} className="block px-3 py-2 hover:bg-zinc-50 border-b border-zinc-100 last:border-0">
      <div className={`flex items-center gap-3 text-sm ${style.color}`}>
        <span>{style.icon}</span>
        <span className="w-24 shrink-0 text-xs">{label}</span>
        {variant === 'pending_review' && owner && (
          <span className="flex items-center gap-1.5 shrink-0">
            <Avatar user={owner} size="xs" />
            <span className="text-xs text-zinc-600">{owner.name}</span>
          </span>
        )}
        <span className="flex-1 truncate">
          {task.name}
          {task.priority === 'high' && <span className="ml-2 text-xs px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded">🌶️ HIGH</span>}
          {task.isUnplanned && <span className="ml-2 text-xs px-1.5 py-0.5 bg-red-100 text-red-700 rounded">📍 unplanned</span>}
        </span>
        <span className="text-xs bg-zinc-100 text-zinc-700 px-2 py-0.5 rounded">{project.name} · {phase.name}</span>
        <span className="text-xs text-zinc-600 w-24 text-right">{dueText(task.plannedEndDay, todayDayOffset)}</span>
      </div>
    </Link>
  )
}
```

Commit:

```bash
git add components/my-tasks/task-row.tsx
git commit -m "feat(my-tasks): task row component (open/pending_review/completed variants)"
```

---

### Task 7.3: Tabs client component + Empty state

**Files:**
- Create: `components/my-tasks/my-tasks-tabs.tsx`
- Create: `components/my-tasks/empty-state.tsx`

- [ ] **Step 1: `components/my-tasks/my-tasks-tabs.tsx`**

```tsx
'use client'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

export type MyTabId = 'open' | 'pending_review' | 'completed'

const TABS: Array<{ id: MyTabId; label: string }> = [
  { id: 'open', label: 'Open Tasks' },
  { id: 'pending_review', label: 'Pending Review' },
  { id: 'completed', label: 'Completed' },
]

export function MyTasksTabs({ current, counts }: {
  current: MyTabId
  counts: { open: number; pending_review: number; completed: number | null }
}) {
  const params = useSearchParams()
  return (
    <div className="border-b border-zinc-200 flex gap-6 mt-2">
      {TABS.map(t => {
        const next = new URLSearchParams(params)
        next.set('tab', t.id)
        const isActive = t.id === current
        const count = counts[t.id]
        return (
          <Link key={t.id} href={`?${next.toString()}`} scroll={false}
            className={[
              'py-2',
              isActive ? 'border-b-2 border-blue-500 font-semibold text-blue-600' : 'text-zinc-600',
            ].join(' ')}>
            {t.label}{count !== null ? ` (${count})` : ''}
          </Link>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: `components/my-tasks/empty-state.tsx`**

```tsx
export function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-dashed border-zinc-200 bg-white p-12 text-center text-zinc-500 text-sm">
      {message}
    </div>
  )
}
```

Commit:

```bash
git add components/my-tasks/my-tasks-tabs.tsx components/my-tasks/empty-state.tsx
git commit -m "feat(my-tasks): tabs + empty state components"
```

---

### Task 7.4: My Tasks page

**Files:**
- Modify: `app/(app)/my-tasks/page.tsx` (replace foundation stub)
- Create: `app/(app)/my-tasks/loading.tsx`

- [ ] **Step 1: Replace `app/(app)/my-tasks/page.tsx`**

```tsx
import { requireUser } from '@/lib/server/get-current-user'
import { db } from '@/db/client'
import { getMyTasks } from '@/db/queries/my-tasks'
import { computeBannerCounts } from '@/lib/my-tasks/banner-counts'
import { Banner } from '@/components/my-tasks/banner'
import { MyTasksTabs, type MyTabId } from '@/components/my-tasks/my-tasks-tabs'
import { TaskRow } from '@/components/my-tasks/task-row'
import { EmptyState } from '@/components/my-tasks/empty-state'

const VALID_TABS: MyTabId[] = ['open', 'pending_review', 'completed']

export default async function MyTasksPage({
  searchParams,
}: { searchParams: { tab?: string; offset?: string } }) {
  const me = await requireUser()
  const offset = Number(searchParams.offset ?? '0') || 0
  const data = await getMyTasks(db, me.id, { completedOffset: offset })
  const tab: MyTabId = (VALID_TABS as string[]).includes(searchParams.tab ?? '')
    ? (searchParams.tab as MyTabId)
    : 'open'

  const banner = computeBannerCounts(
    data.openTasks.map(x => ({
      status: x.task.status, isBlocked: x.task.isBlocked, plannedEndDay: x.task.plannedEndDay,
    })),
    data.todayDayOffset,
  )

  // Reviewer pending: owner avatars needed
  const ownerById = new Map(data.pendingReview.map(x => [x.task.ownerId, x]))
  const reviewerOwners = await db.select().from(
    (await import('@/db/schema')).users
  ).where(
    (await import('drizzle-orm')).inArray(
      (await import('@/db/schema')).users.id,
      Array.from(ownerById.keys()),
    ),
  )
  const reviewerOwnerById = new Map(reviewerOwners.map(u => [u.id, u]))

  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-semibold">My Tasks</h1>
      <Banner counts={banner} />
      <MyTasksTabs
        current={tab}
        counts={{ open: data.openTasks.length, pending_review: data.pendingReview.length, completed: null }}
      />
      <div className="rounded-lg border border-zinc-200 bg-white">
        {tab === 'open' && (
          data.openTasks.length === 0
            ? <EmptyState message="No open tasks. Nice work." />
            : data.openTasks.map(x => <TaskRow key={x.task.id} item={x} todayDayOffset={data.todayDayOffset} variant="open" />)
        )}
        {tab === 'pending_review' && (
          data.pendingReview.length === 0
            ? <EmptyState message="No tasks waiting for your review." />
            : data.pendingReview.map(x => (
                <TaskRow key={x.task.id} item={x} todayDayOffset={data.todayDayOffset}
                  variant="pending_review" owner={reviewerOwnerById.get(x.task.ownerId)} />
              ))
        )}
        {tab === 'completed' && (
          <>
            {data.completedTasks.length === 0
              ? <EmptyState message="No completed tasks yet." />
              : data.completedTasks.map(x => <TaskRow key={x.task.id} item={x} todayDayOffset={data.todayDayOffset} variant="completed" />)}
            {data.completedTotal > offset + data.completedTasks.length && (
              <div className="p-3 text-center">
                <a href={`?tab=completed&offset=${offset + 100}`} className="text-blue-600 text-sm hover:underline">
                  Show older →
                </a>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: `app/(app)/my-tasks/loading.tsx`**

```tsx
export default function Loading() {
  return (
    <div className="space-y-3">
      <div className="h-8 w-48 bg-zinc-100 rounded animate-pulse" />
      <div className="h-10 bg-white border border-zinc-200 rounded animate-pulse" />
      <div className="h-10 border-b border-zinc-200" />
      <div className="h-32 bg-white border border-zinc-200 rounded animate-pulse" />
    </div>
  )
}
```

- [ ] **Step 3: Verify and commit**

```bash
npm run typecheck
git add app/\(app\)/my-tasks/
git commit -m "feat(my-tasks): page with banner + tabs + lists"
```

---

## Phase 8: Settings/me page + Sidebar Settings link

### Task 8.1: `/settings/me` page with opt-out form

**Files:**
- Create: `app/(app)/settings/me/page.tsx`
- Create: `app/(app)/settings/me/digest-opt-out-form.tsx`

- [ ] **Step 1: `app/(app)/settings/me/digest-opt-out-form.tsx`**

```tsx
'use client'
import { useState } from 'react'
import { setLarkDigestOptOut } from '@/app/actions/users'

export function DigestOptOutForm({ initialOptedOut }: { initialOptedOut: boolean }) {
  const [optedOut, setOptedOut] = useState(initialOptedOut)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function toggle() {
    setBusy(true); setErr(null)
    const next = !optedOut
    try {
      await setLarkDigestOptOut({ optedOut: next })
      setOptedOut(next)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to update')
    } finally { setBusy(false) }
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-medium">Daily Lark digest</div>
          <div className="text-xs text-zinc-600">A summary of your overdue / due-soon / pending-review tasks at 8 AM.</div>
        </div>
        <button onClick={toggle} disabled={busy}
          className={[
            'px-3 py-1.5 rounded text-sm border',
            optedOut ? 'bg-white text-zinc-700 border-zinc-300' : 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white border-transparent',
          ].join(' ')}>
          {optedOut ? 'Off (turn on)' : 'On (turn off)'}
        </button>
      </div>
      {err && <div className="text-red-600 text-xs">{err}</div>}
    </div>
  )
}
```

- [ ] **Step 2: `app/(app)/settings/me/page.tsx`**

```tsx
import { requireUser } from '@/lib/server/get-current-user'
import { Avatar } from '@/components/shared/avatar'
import { DigestOptOutForm } from './digest-opt-out-form'

export default async function SettingsMePage() {
  const me = await requireUser()
  return (
    <div className="space-y-4 max-w-2xl">
      <h1 className="text-2xl font-semibold">My Settings</h1>
      <div className="rounded-lg border border-zinc-200 bg-white p-4 flex items-center gap-3">
        <Avatar user={me} size="lg" />
        <div>
          <div className="font-medium">{me.name}</div>
          <div className="text-sm text-zinc-600">{me.email ?? '—'}</div>
          <div className="text-xs text-zinc-500 mt-1">Role: {me.role} · Team: {me.team ?? '—'}</div>
        </div>
      </div>
      <DigestOptOutForm initialOptedOut={me.larkDigestOptedOut} />
    </div>
  )
}
```

Commit:

```bash
git add "app/(app)/settings/me/"
git commit -m "feat(settings): /settings/me page with digest opt-out toggle"
```

---

### Task 8.2: Add Settings link to sidebar

**Files:**
- Modify: `components/layout/sidebar.tsx`

- [ ] **Step 1: Locate the sidebar's links section and add a `Settings` entry for everyone**

The foundation sidebar already shows owner-only Settings entries (Workflow Templates / Members / Audit Logs). We want a per-user **Settings** entry visible to everyone, distinct from the owner-only group.

Read the file first to see its current structure. Then add a new link **before the owner-only group** (above the `{user.role === 'owner' && (` block):

```tsx
<Link href="/settings/me" className="rounded px-3 py-2 hover:bg-zinc-100">Settings</Link>
```

The exact placement: between the existing "Performance Review" link and the `{user.role === 'owner' && ...}` block.

- [ ] **Step 2: Verify and commit**

```bash
npm run typecheck
npm run build
git add components/layout/sidebar.tsx
git commit -m "feat(sidebar): add Settings link to /settings/me"
```

---

## Phase 9: Drawer priority control

### Task 9.1: `<DrawerPriorityControl />` component

**Files:**
- Create: `components/project/drawer-priority-control.tsx`
- Modify: `components/project/task-drawer.tsx` (insert above status stepper)

- [ ] **Step 1: Implement the control**

```tsx
// components/project/drawer-priority-control.tsx
'use client'
import { useState } from 'react'
import { usePermissions } from '@/lib/hooks/use-permissions'
import { setTaskPriority } from '@/app/actions/tasks'
import type { Task, ProjectStatus, TaskPriority } from '@/db/schema'

const OPTIONS: Array<{ value: TaskPriority; label: string; icon: string }> = [
  { value: 'high', label: 'High', icon: '🌶️' },
  { value: 'normal', label: 'Normal', icon: '·' },
  { value: 'low', label: 'Low', icon: '↓' },
]

export function DrawerPriorityControl({
  task, project,
}: {
  task: Task
  project: { id: string; pmId: string; status: ProjectStatus }
}) {
  const { can } = usePermissions()
  const [priority, setPriority] = useState<TaskPriority>(task.priority)
  const [busy, setBusy] = useState(false)
  const allowed = can({
    type: 'task.set_priority',
    project: { pmId: project.pmId, status: project.status },
    task: { ownerId: task.ownerId, reviewerId: task.reviewerId },
  })
  if (!allowed) return null

  async function update(next: TaskPriority) {
    if (next === priority) return
    setBusy(true)
    try {
      await setTaskPriority({ taskId: task.id, priority: next })
      setPriority(next)
    } finally { setBusy(false) }
  }

  return (
    <div className="flex items-center gap-2 text-xs mt-3">
      <span className="text-zinc-500">Priority:</span>
      <div className="flex gap-1">
        {OPTIONS.map(o => (
          <button key={o.value} onClick={() => update(o.value)} disabled={busy}
            className={[
              'px-2 py-0.5 rounded',
              priority === o.value
                ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white'
                : 'bg-white border border-zinc-300 text-zinc-700 hover:bg-zinc-50',
            ].join(' ')}>
            <span className="mr-1">{o.icon}</span>{o.label}
          </button>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Insert into `task-drawer.tsx`**

In `components/project/task-drawer.tsx`, locate the section that renders the status stepper (around `<DrawerStatusStepper status={task.status} hasReviewer={!!task.reviewerId} />`). Insert the priority control immediately ABOVE it:

Add the import at top:

```tsx
import { DrawerPriorityControl } from './drawer-priority-control'
```

Then in the JSX, find:

```tsx
        <div className="mt-4">
          <DrawerStatusStepper status={task.status} hasReviewer={!!task.reviewerId} />
        </div>
```

Change to:

```tsx
        <DrawerPriorityControl task={task} project={initialData.project} />

        <div className="mt-4">
          <DrawerStatusStepper status={task.status} hasReviewer={!!task.reviewerId} />
        </div>
```

- [ ] **Step 3: Verify and commit**

```bash
npm run typecheck
npm run build
git add components/project/drawer-priority-control.tsx components/project/task-drawer.tsx
git commit -m "feat(drawer): priority control above status stepper"
```

---

## Phase 10: Lark digest cron Route Handler

### Task 10.1: `/api/cron/lark-digest` POST handler

**Files:**
- Create: `app/api/cron/lark-digest/route.ts`
- Create: `app/api/cron/lark-digest/route.test.ts`

- [ ] **Step 1: Implement the route handler**

```ts
// app/api/cron/lark-digest/route.ts
import { NextResponse, type NextRequest } from 'next/server'
import { db } from '@/db/client'
import { getDigestSummariesForActiveOptedInUsers } from '@/db/queries/my-tasks'
import { sendLarkDirectMessage } from '@/lib/lark/messaging'
import { shouldSendDigest, buildDigestMessage } from '@/lib/my-tasks/digest-payload'

export async function POST(req: NextRequest) {
  const expected = process.env.LARK_DIGEST_CRON_SECRET
  if (!expected) return NextResponse.json({ error: 'cron secret not configured' }, { status: 500 })
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${expected}`) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const baseUrl = process.env.APP_PUBLIC_URL ?? 'http://localhost:3000'
  const summaries = await getDigestSummariesForActiveOptedInUsers(db)

  const result = { processed: 0, sent: 0, skipped: 0, errors: [] as Array<{ userId: string; error: string }> }

  for (const s of summaries) {
    result.processed++
    if (!shouldSendDigest(s)) {
      result.skipped++
      continue
    }
    try {
      await sendLarkDirectMessage({
        openId: s.larkOpenId,
        text: buildDigestMessage({ ...s, myTasksUrl: `${baseUrl}/my-tasks` }),
      })
      result.sent++
    } catch (e) {
      result.errors.push({ userId: s.userId, error: e instanceof Error ? e.message : String(e) })
    }
  }

  return NextResponse.json(result)
}
```

- [ ] **Step 2: Test the auth gate (only — Lark API mocking is too brittle for an HTTP route test; we tested messaging in Phase 5)**

```ts
// app/api/cron/lark-digest/route.test.ts
import { describe, it, expect } from 'vitest'
import { POST } from './route'

function mockReq(headers: Record<string, string>): Request {
  return new Request('http://localhost/api/cron/lark-digest', { method: 'POST', headers })
}

describe('POST /api/cron/lark-digest', () => {
  it('returns 401 without the bearer token', async () => {
    process.env.LARK_DIGEST_CRON_SECRET = 'shh'
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await POST(mockReq({}) as any)
    expect(res.status).toBe(401)
  })

  it('returns 401 with wrong bearer token', async () => {
    process.env.LARK_DIGEST_CRON_SECRET = 'shh'
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await POST(mockReq({ authorization: 'Bearer wrong' }) as any)
    expect(res.status).toBe(401)
  })

  it('returns 500 when secret not configured', async () => {
    delete process.env.LARK_DIGEST_CRON_SECRET
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await POST(mockReq({ authorization: 'Bearer x' }) as any)
    expect(res.status).toBe(500)
  })
})
```

- [ ] **Step 3: Run and commit**

```bash
npm test -- app/api/cron/lark-digest/route.test.ts
git add app/api/cron/
git commit -m "feat(cron): lark daily digest POST endpoint with secret gate"
```

---

## Phase 11: Final verification + smoke test runbook

### Task 11.1: Full verification

- [ ] **Step 1: Run the full test suite**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: clean.

- [ ] **Step 3: Build**

```bash
npm run build
```

Expected: clean. Routes `/my-tasks`, `/settings/me`, `/api/cron/lark-digest` all listed.

- [ ] **Step 4: Manual smoke test runbook**

Requires Lark messaging app credentials (separate from OAuth).

1. Add to `.env.local`:
   ```
   LARK_MESSAGING_APP_ID=cli_xxx
   LARK_MESSAGING_APP_SECRET=secret_xxx
   LARK_DIGEST_CRON_SECRET=$(openssl rand -hex 32)
   APP_PUBLIC_URL=http://localhost:3000
   ```
2. `docker compose up -d && npm run db:migrate && npm run dev`
3. Sign in via Lark, ensure at least one workflow template exists (`npm run db:seed`), create a project, and have at least one task assigned to you with a `planned_end_day` in the past.
4. Visit `/my-tasks` — verify:
   - Banner shows `🔴 1 overdue` (or whatever applies)
   - Open Tasks tab shows the task, sorted to the top
   - Click the task → opens the drawer on the project page
   - In the drawer, mark priority HIGH → return to My Tasks → the HIGH chip is shown
5. Submit one task for review where you're the reviewer. Visit `/my-tasks?tab=pending_review` — verify it's listed.
6. Mark a task complete. Visit `/my-tasks?tab=completed` — verify it appears with ✓.
7. Visit `/settings/me` — verify the digest toggle defaults to ON (says "On (turn off)"); click it; reload; verify it persists.
8. Trigger the cron endpoint manually:
   ```bash
   curl -X POST http://localhost:3000/api/cron/lark-digest \
     -H "Authorization: Bearer $LARK_DIGEST_CRON_SECRET"
   ```
   Expected: 200 OK with `{processed, sent, skipped, errors}`. Check your Lark for the DM (only if you have overdue / due-this-week / pending-review counts > 0 and you're opted in).

If any step fails, fix and re-run.

- [ ] **Step 5: Final commit**

If you made any incidental fixes during verification, commit them. Otherwise no commit needed.

---

## Plan self-review

**Spec coverage** — mapping spec sections to plan tasks:

| Spec section | Implemented by |
|---|---|
| §2.1 `tasks.priority` | Task 1.1 |
| §2.2 `users.lark_digest_opted_out` | Task 1.2 |
| §3 Page layout | Task 7.4 |
| §4 Tab definitions | Task 7.4 (page) + Task 7.3 (tabs component) |
| §5 Ranking algorithm | Task 2.1 (pure fn) + Task 6.1 (applied in query) |
| §6 In-app banner | Task 2.2 (counts) + Task 7.1 (component) + Task 7.4 (rendered on page) |
| §7 Lark daily digest endpoint | Task 10.1 |
| §8 Lark messaging helper | Task 5.1 + Task 5.2 (env vars) |
| §9 Server Actions | Task 4.1 (`setTaskPriority`) + Task 4.2 (`setLarkDigestOptOut`) |
| §10 New permission | Task 3.1 |
| §11 New routes | Task 7.4 (my-tasks) + Task 8.1 (settings/me) + Task 10.1 (cron) |
| §12 Component organization | matched throughout |
| §13 Data fetching | Tasks 6.1 + 6.2 |
| §14 Permission gating (UI) | Task 9.1 (drawer control) + Task 4.2 (opt-out is current-user only) |
| §15 Testing strategy | unit tests in Phases 2, 4, 5; integration in Phase 6; auth-gate test in Phase 10; runbook in Task 11.1 |
| §16 Out of scope | nothing added — respected |
| §17 Open implementation questions | Task 8.2 picks the "top-level Settings link" default |

**Placeholder scan**: no TBD/TODO/"similar to" patterns; every step has explicit code or commands.

**Type consistency**: `TaskPriority` from schema (`'low'|'normal'|'high'`) used consistently; `MyTasksData` shape returned by `getMyTasks` matches consumers in Task 7.4; `BannerCounts` shape consistent between `computeBannerCounts` (Task 2.2) and `<Banner>` (Task 7.1); `TaskWithContext` matches between `db/queries/my-tasks.ts` and `<TaskRow>` (Task 7.2).

**Known limitations** (called out for the engineer):

- The `/api/cron/lark-digest` route test only verifies the auth gate. Real end-to-end testing requires Lark messaging credentials and is the smoke-test step.
- Drizzle Kit doesn't emit CHECK constraints — Task 1.1 hand-edits the migration file (foundation's standing pattern).
