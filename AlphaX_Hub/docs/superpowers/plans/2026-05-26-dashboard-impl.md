# BuildFlow Dashboard / Team / Performance Review — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the three top-level views defined in `docs/superpowers/specs/2026-05-25-dashboard-design.md`: Dashboard (operational view of projects by brand/phase/quarter, with at-risk highlighting and search), Team (three per-team tabs), and Performance Review (read-only metrics per team).

**Architecture:** Pure-function logic (at-risk rules, current-state derivation, KPI math) sits in `lib/dashboard/` with exhaustive unit tests. Data queries live in `db/queries/dashboard.ts`, called from React Server Components. Three new top-level routes (`/`, `/team/[team]`, `/performance/[team]`) replace the Phase-12 stubs from the foundation. The brand switcher and search box are Client Components inside each Server Component layout. All three views are read-only — no new Server Actions.

**Tech Stack:** Same as foundation — Next.js 14 App Router, TypeScript, Drizzle ORM, Postgres, Vitest. The plan builds on the foundation merged at `22f2db2`.

---

## Phase 1: Pure-function helpers

### Task 1.1: At-risk detection

**Files:**
- Create: `lib/dashboard/at-risk.ts`
- Create: `lib/dashboard/at-risk.test.ts`

- [ ] **Step 1: Write tests (TDD)**

```ts
// lib/dashboard/at-risk.test.ts
import { describe, it, expect } from 'vitest'
import { evaluateAtRisk } from './at-risk'

const today = new Date('2026-06-01')

describe('evaluateAtRisk', () => {
  it('not at risk when no targets set', () => {
    const out = evaluateAtRisk({}, today)
    expect(out.atRisk).toBe(false)
    expect(out.severity).toBe(null)
  })

  it('permit overdue when target_permit_date is in the past and actual_permit_date is null', () => {
    const out = evaluateAtRisk({ targetPermitDate: '2026-05-01', actualPermitDate: null }, today)
    expect(out.atRisk).toBe(true)
    expect(out.severity).toBe('permit_overdue')
    expect(out.daysBehind).toBe(31)
  })

  it('not overdue when actual_permit_date is set, even if late', () => {
    const out = evaluateAtRisk({
      targetPermitDate: '2026-05-01', actualPermitDate: '2026-05-15',
    }, today)
    expect(out.atRisk).toBe(false)
  })

  it('construction overdue when target_construction_end_date is past and actual null', () => {
    const out = evaluateAtRisk({
      targetConstructionEndDate: '2026-04-01', actualConstructionEndDate: null,
    }, today)
    expect(out.atRisk).toBe(true)
    expect(out.severity).toBe('construction_overdue')
  })

  it('exit-quarter overdue when current date past end-of-quarter and sold is false', () => {
    const out = evaluateAtRisk({ targetExitQuarter: '2026-Q1', sold: false }, new Date('2026-06-15'))
    expect(out.atRisk).toBe(true)
    expect(out.severity).toBe('exit_overdue')
  })

  it('exit-quarter NOT overdue when sold is true', () => {
    const out = evaluateAtRisk({ targetExitQuarter: '2026-Q1', sold: true }, new Date('2026-06-15'))
    expect(out.atRisk).toBe(false)
  })

  it('picks highest severity when multiple triggers fire', () => {
    const out = evaluateAtRisk({
      targetPermitDate: '2026-04-01', actualPermitDate: null,
      targetConstructionEndDate: '2026-05-01', actualConstructionEndDate: null,
      targetExitQuarter: '2026-Q1', sold: false,
    }, today)
    expect(out.atRisk).toBe(true)
    expect(out.severity).toBe('exit_overdue')   // highest
  })
})
```

- [ ] **Step 2: Run, expect fail**

```bash
npm test -- lib/dashboard/at-risk.test.ts
```

- [ ] **Step 3: Implement**

```ts
// lib/dashboard/at-risk.ts
export type AtRiskInput = {
  targetPermitDate?: string | null
  actualPermitDate?: string | null
  targetConstructionEndDate?: string | null
  actualConstructionEndDate?: string | null
  targetExitQuarter?: string | null
  sold?: boolean
}

export type AtRiskSeverity = 'permit_overdue' | 'construction_overdue' | 'exit_overdue'

export type AtRiskResult = {
  atRisk: boolean
  severity: AtRiskSeverity | null
  daysBehind: number
}

function parseDate(s: string | null | undefined): Date | null {
  if (!s) return null
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? null : d
}

function endOfQuarter(quarterLabel: string | null | undefined): Date | null {
  if (!quarterLabel) return null
  const m = quarterLabel.match(/^(\d{4})-Q([1-4])$/)
  if (!m) return null
  const year = Number(m[1])
  const q = Number(m[2])
  const endMonth = q * 3       // 3, 6, 9, 12
  return new Date(year, endMonth, 0)   // last day of endMonth
}

function daysBetween(a: Date, b: Date): number {
  return Math.floor((a.getTime() - b.getTime()) / (24 * 60 * 60 * 1000))
}

const SEVERITY_RANK: Record<AtRiskSeverity, number> = {
  permit_overdue: 1,
  construction_overdue: 2,
  exit_overdue: 3,
}

export function evaluateAtRisk(input: AtRiskInput, today: Date): AtRiskResult {
  const triggers: Array<{ severity: AtRiskSeverity; daysBehind: number }> = []

  const tpd = parseDate(input.targetPermitDate)
  if (tpd && tpd < today && !input.actualPermitDate) {
    triggers.push({ severity: 'permit_overdue', daysBehind: daysBetween(today, tpd) })
  }
  const tced = parseDate(input.targetConstructionEndDate)
  if (tced && tced < today && !input.actualConstructionEndDate) {
    triggers.push({ severity: 'construction_overdue', daysBehind: daysBetween(today, tced) })
  }
  const tqe = endOfQuarter(input.targetExitQuarter ?? null)
  if (tqe && tqe < today && !input.sold) {
    triggers.push({ severity: 'exit_overdue', daysBehind: daysBetween(today, tqe) })
  }
  if (triggers.length === 0) return { atRisk: false, severity: null, daysBehind: 0 }

  const worst = triggers.reduce((a, b) => SEVERITY_RANK[a.severity] >= SEVERITY_RANK[b.severity] ? a : b)
  return { atRisk: true, severity: worst.severity, daysBehind: worst.daysBehind }
}
```

- [ ] **Step 4: Run, expect pass**

```bash
npm test -- lib/dashboard/at-risk.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add lib/dashboard/at-risk.ts lib/dashboard/at-risk.test.ts
git commit -m "feat(dashboard): at-risk evaluation by target/actual dates"
```

---

### Task 1.2: Current-state derivation

**Files:**
- Create: `lib/dashboard/current-state.ts`
- Create: `lib/dashboard/current-state.test.ts`

- [ ] **Step 1: Write tests**

```ts
// lib/dashboard/current-state.test.ts
import { describe, it, expect } from 'vitest'
import { deriveCurrentState } from './current-state'

describe('deriveCurrentState', () => {
  it('Sold trumps everything when sold=true', () => {
    expect(deriveCurrentState({
      status: 'in_progress', sold: true, listingDate: '2026-04-01',
      phases: [{ name: 'Permitting', status: 'complete', sortOrder: 1 }],
    })).toBe('Sold')
  })

  it('Listed when listing_date set but not sold', () => {
    expect(deriveCurrentState({
      status: 'in_progress', sold: false, listingDate: '2026-05-01',
      phases: [{ name: 'Sale', status: 'in_progress', sortOrder: 3 }],
    })).toBe('Listed')
  })

  it('Presale Phase 3 / 2 / 1', () => {
    expect(deriveCurrentState({
      status: 'in_progress', sold: false,
      presalePhase3Date: '2026-04-01',
      phases: [{ name: 'Sale', status: 'in_progress', sortOrder: 3 }],
    })).toBe('Presale Phase 3')
    expect(deriveCurrentState({
      status: 'in_progress', sold: false,
      presalePhase2Date: '2026-04-01',
      phases: [{ name: 'Sale', status: 'in_progress', sortOrder: 3 }],
    })).toBe('Presale Phase 2')
    expect(deriveCurrentState({
      status: 'in_progress', sold: false,
      presalePhase1Date: '2026-04-01',
      phases: [{ name: 'Sale', status: 'in_progress', sortOrder: 3 }],
    })).toBe('Presale Phase 1')
  })

  it('Under Construction when Construction phase in_progress', () => {
    expect(deriveCurrentState({
      status: 'in_progress', sold: false,
      phases: [
        { name: 'Permitting', status: 'complete', sortOrder: 1 },
        { name: 'Construction', status: 'in_progress', sortOrder: 2 },
      ],
    })).toBe('Under Construction')
  })

  it('Under Permitting when only Permitting in_progress', () => {
    expect(deriveCurrentState({
      status: 'in_progress', sold: false,
      phases: [{ name: 'Permitting', status: 'in_progress', sortOrder: 1 }],
    })).toBe('Under Permitting')
  })

  it('Draft / Complete / Archived from project.status', () => {
    expect(deriveCurrentState({ status: 'draft', sold: false, phases: [] })).toBe('Draft')
    expect(deriveCurrentState({ status: 'complete', sold: false, phases: [] })).toBe('Complete')
    expect(deriveCurrentState({ status: 'archived', sold: false, phases: [] })).toBe('Archived')
  })
})
```

- [ ] **Step 2: Implement**

```ts
// lib/dashboard/current-state.ts
export type ProjectStatus = 'draft' | 'in_progress' | 'complete' | 'archived'

export type CurrentStateInput = {
  status: ProjectStatus
  sold: boolean
  listingDate?: string | null
  presalePhase1Date?: string | null
  presalePhase2Date?: string | null
  presalePhase3Date?: string | null
  phases: Array<{ name: 'Permitting' | 'Construction' | 'Sale'; status: 'pending' | 'in_progress' | 'complete'; sortOrder: number }>
}

export type CurrentStateLabel =
  | 'Draft' | 'Under Permitting' | 'Under Construction'
  | 'Presale Phase 1' | 'Presale Phase 2' | 'Presale Phase 3'
  | 'Listed' | 'Sold' | 'Complete' | 'Archived'

export function deriveCurrentState(input: CurrentStateInput): CurrentStateLabel {
  if (input.status === 'archived') return 'Archived'
  if (input.status === 'complete') return 'Complete'
  if (input.status === 'draft') return 'Draft'

  if (input.sold) return 'Sold'
  if (input.listingDate) return 'Listed'
  if (input.presalePhase3Date) return 'Presale Phase 3'
  if (input.presalePhase2Date) return 'Presale Phase 2'
  if (input.presalePhase1Date) return 'Presale Phase 1'

  const construction = input.phases.find(p => p.name === 'Construction')
  if (construction?.status === 'in_progress') return 'Under Construction'
  const permitting = input.phases.find(p => p.name === 'Permitting')
  if (permitting?.status === 'in_progress') return 'Under Permitting'
  return 'Draft'
}
```

- [ ] **Step 3: Run, expect pass**

```bash
npm test -- lib/dashboard/current-state.test.ts
```

- [ ] **Step 4: Commit**

```bash
git add lib/dashboard/current-state.ts lib/dashboard/current-state.test.ts
git commit -m "feat(dashboard): current-state label derivation"
```

---

### Task 1.3: Quarter parsing and ordering

**Files:**
- Create: `lib/dashboard/quarter.ts`
- Create: `lib/dashboard/quarter.test.ts`

- [ ] **Step 1: Tests**

```ts
// lib/dashboard/quarter.test.ts
import { describe, it, expect } from 'vitest'
import { compareQuarters, parseQuarter, formatQuarterLabel } from './quarter'

describe('quarter helpers', () => {
  it('parseQuarter returns { year, q } for valid strings', () => {
    expect(parseQuarter('2026-Q3')).toEqual({ year: 2026, q: 3 })
    expect(parseQuarter('2027-Q1')).toEqual({ year: 2027, q: 1 })
    expect(parseQuarter('bogus')).toBe(null)
    expect(parseQuarter(null)).toBe(null)
    expect(parseQuarter('2026-Q5')).toBe(null)
  })

  it('compareQuarters orders ascending by year then quarter', () => {
    expect(compareQuarters('2026-Q1', '2026-Q3')).toBeLessThan(0)
    expect(compareQuarters('2027-Q1', '2026-Q4')).toBeGreaterThan(0)
    expect(compareQuarters('2026-Q3', '2026-Q3')).toBe(0)
    expect(compareQuarters(null, '2026-Q3')).toBeGreaterThan(0)   // nulls last
    expect(compareQuarters('2026-Q3', null)).toBeLessThan(0)
    expect(compareQuarters(null, null)).toBe(0)
  })

  it('formatQuarterLabel handles unknown', () => {
    expect(formatQuarterLabel('2026-Q3')).toBe('2026 Q3')
    expect(formatQuarterLabel(null)).toBe('Unscheduled')
    expect(formatQuarterLabel('garbage')).toBe('Unscheduled')
  })
})
```

- [ ] **Step 2: Implement**

```ts
// lib/dashboard/quarter.ts
export function parseQuarter(s: string | null | undefined): { year: number; q: number } | null {
  if (!s) return null
  const m = s.match(/^(\d{4})-Q([1-4])$/)
  if (!m) return null
  return { year: Number(m[1]), q: Number(m[2]) }
}

export function compareQuarters(a: string | null | undefined, b: string | null | undefined): number {
  const pa = parseQuarter(a)
  const pb = parseQuarter(b)
  if (!pa && !pb) return 0
  if (!pa) return 1
  if (!pb) return -1
  if (pa.year !== pb.year) return pa.year - pb.year
  return pa.q - pb.q
}

export function formatQuarterLabel(s: string | null | undefined): string {
  const p = parseQuarter(s)
  return p ? `${p.year} Q${p.q}` : 'Unscheduled'
}
```

- [ ] **Step 3: Run and commit**

```bash
npm test -- lib/dashboard/quarter.test.ts
git add lib/dashboard/quarter.ts lib/dashboard/quarter.test.ts
git commit -m "feat(dashboard): quarter parsing and comparison helpers"
```

---

## Phase 2: Data query helpers

### Task 2.1: Project list query with phases

**Files:**
- Create: `db/queries/dashboard.ts`
- Create: `db/queries/dashboard.test.ts`

- [ ] **Step 1: Test**

```ts
// db/queries/dashboard.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { testDb, truncateAll } from '@/tests/db'
import { seedOwner, seedPm } from '@/tests/fixtures/users'
import { seedTemplate } from '@/tests/fixtures/workflow-templates'
import { projectService } from '@/lib/services/project-service'
import { listProjectsForDashboard } from './dashboard'

describe('listProjectsForDashboard', () => {
  beforeEach(async () => { await truncateAll() })

  it('returns all non-archived projects with their phases', async () => {
    const owner = await seedOwner()
    const pm = await seedPm()
    const { template } = await seedTemplate({
      createdById: owner.id, name: 't', tasks: [{ name: 'a', durationDays: 1 }], deps: [],
    })
    await projectService.create({
      createdById: pm.id, name: '1 Main', brand: 'al_homes', pmId: pm.id,
      assignments: [{ phaseName: 'Permitting', templateId: template.id, sortOrder: 0 }],
    }, testDb)
    await projectService.create({
      createdById: pm.id, name: '2 Oak', brand: 'alera', pmId: pm.id,
      assignments: [{ phaseName: 'Permitting', templateId: template.id, sortOrder: 0 }],
    }, testDb)

    const rows = await listProjectsForDashboard(testDb)
    expect(rows).toHaveLength(2)
    expect(rows[0].phases).toHaveLength(3)
    expect(rows[0].phases.map(p => p.name).sort()).toEqual(['Construction','Permitting','Sale'])
  })

  it('filters by brand', async () => {
    const owner = await seedOwner()
    const pm = await seedPm()
    const { template } = await seedTemplate({
      createdById: owner.id, name: 't', tasks: [{ name: 'a', durationDays: 1 }], deps: [],
    })
    await projectService.create({
      createdById: pm.id, name: '1', brand: 'al_homes', pmId: pm.id,
      assignments: [{ phaseName: 'Permitting', templateId: template.id, sortOrder: 0 }],
    }, testDb)
    await projectService.create({
      createdById: pm.id, name: '2', brand: 'alera', pmId: pm.id,
      assignments: [{ phaseName: 'Permitting', templateId: template.id, sortOrder: 0 }],
    }, testDb)

    const filtered = await listProjectsForDashboard(testDb, { brand: 'al_homes' })
    expect(filtered).toHaveLength(1)
    expect(filtered[0].name).toBe('1')
  })
})
```

- [ ] **Step 2: Implement**

```ts
// db/queries/dashboard.ts
import { eq, ne, and, inArray } from 'drizzle-orm'
import type { DB } from '@/db/client'
import { projects, projectPhases, type Project, type ProjectPhase } from '@/db/schema'

export type DashboardProject = Project & {
  phases: ProjectPhase[]
}

export async function listProjectsForDashboard(
  db: DB,
  opts: { brand?: 'al_homes' | 'alera' | 'apex' } = {},
): Promise<DashboardProject[]> {
  const whereClauses = [ne(projects.status, 'archived')]
  if (opts.brand) whereClauses.push(eq(projects.brand, opts.brand))

  const projectRows = await db.select().from(projects).where(and(...whereClauses))
  if (projectRows.length === 0) return []
  const phaseRows = await db.select().from(projectPhases)
    .where(inArray(projectPhases.projectId, projectRows.map(p => p.id)))

  const phasesByProject = new Map<string, ProjectPhase[]>()
  for (const p of phaseRows) {
    if (!phasesByProject.has(p.projectId)) phasesByProject.set(p.projectId, [])
    phasesByProject.get(p.projectId)!.push(p)
  }
  return projectRows.map(p => ({ ...p, phases: phasesByProject.get(p.id) ?? [] }))
}

export async function searchProjects(db: DB, q: string): Promise<Project[]> {
  if (!q.trim()) return []
  const like = `%${q.trim().toLowerCase()}%`
  const sql = await import('drizzle-orm').then(m => m.sql)
  return db.select().from(projects).where(sql.raw(
    `lower(name) LIKE '${like.replace(/'/g, "''")}' ` +
    `OR lower(coalesce(address,'')) LIKE '${like.replace(/'/g, "''")}' ` +
    `OR lower(coalesce(city,'')) LIKE '${like.replace(/'/g, "''")}' ` +
    `OR lower(coalesce(zip,'')) LIKE '${like.replace(/'/g, "''")}' ` +
    `OR lower(coalesce(title_holder,'')) LIKE '${like.replace(/'/g, "''")}'`
  ))
}
```

**Security note:** the search query escapes single quotes by doubling them. If you'd rather use parameterized values, swap to Drizzle's `like()` operator with `or()` — it's slightly more verbose but parameterized end-to-end. The version above is safe against quote injection because it only inserts already-escaped strings into LIKE positions; it does NOT take SQL fragments.

- [ ] **Step 3: Run and commit**

```bash
npm test -- db/queries/dashboard.test.ts
git add db/queries/dashboard.ts db/queries/dashboard.test.ts
git commit -m "feat(db): dashboard list and search queries"
```

---

### Task 2.2: Counter aggregates and team active projects

**Files:**
- Modify: `db/queries/dashboard.ts`
- Modify: `db/queries/dashboard.test.ts`

- [ ] **Step 1: Append test**

```ts
// db/queries/dashboard.test.ts — append at end

import { computeDashboardCounters, listActiveProjectsForTeam } from './dashboard'
import { tasks } from '@/db/schema'

describe('computeDashboardCounters', () => {
  beforeEach(async () => { await truncateAll() })

  it('counts active, under_permitting, under_construction', async () => {
    const owner = await seedOwner()
    const pm = await seedPm()
    const { template } = await seedTemplate({
      createdById: owner.id, name: 't', tasks: [{ name: 'a', durationDays: 1 }], deps: [],
    })
    const projectsList = [
      await projectService.create({ createdById: pm.id, name: 'A', brand: 'al_homes', pmId: pm.id,
        assignments: [{ phaseName: 'Permitting', templateId: template.id, sortOrder: 0 }] }, testDb),
      await projectService.create({ createdById: pm.id, name: 'B', brand: 'al_homes', pmId: pm.id,
        assignments: [{ phaseName: 'Permitting', templateId: template.id, sortOrder: 0 }] }, testDb),
    ]
    const counts = await computeDashboardCounters(testDb, { brand: 'al_homes' }, new Date('2026-06-01'))
    expect(counts.active).toBe(0)         // both are draft
    expect(counts.atRisk).toBe(0)
    expect(counts.underPermitting).toBe(0)
    expect(counts.underConstruction).toBe(0)
  })
})

describe('listActiveProjectsForTeam', () => {
  beforeEach(async () => { await truncateAll() })

  it('returns projects where the team owns ≥1 non-terminal task', async () => {
    const owner = await seedOwner()
    const pm = await seedPm()
    const designIc = await (await import('@/tests/fixtures/users')).seedIc('IC-design', 'design')
    const { template } = await seedTemplate({
      createdById: owner.id, name: 't',
      tasks: [{ name: 'a', durationDays: 1 }, { name: 'b', durationDays: 1 }],
      deps: [],
    })
    const project = await projectService.create({
      createdById: pm.id, name: 'P', brand: 'al_homes', pmId: pm.id,
      assignments: [{ phaseName: 'Permitting', templateId: template.id, sortOrder: 0 }],
    }, testDb)
    // Reassign one task to a design-team user
    const allTasks = await testDb.select().from(tasks)
    await testDb.update(tasks).set({ ownerId: designIc.id }).where(eq(tasks.id, allTasks[0].id))

    const designProjects = await listActiveProjectsForTeam(testDb, { team: 'design' })
    expect(designProjects).toHaveLength(1)
    expect(designProjects[0].id).toBe(project.id)
  })
})
```

- [ ] **Step 2: Append implementation to `db/queries/dashboard.ts`**

```ts
import { evaluateAtRisk } from '@/lib/dashboard/at-risk'
import { tasks, users } from '@/db/schema'

export type DashboardCounters = {
  active: number
  atRisk: number
  underPermitting: number
  underConstruction: number
}

export async function computeDashboardCounters(
  db: DB,
  opts: { brand?: 'al_homes' | 'alera' | 'apex' },
  today: Date,
): Promise<DashboardCounters> {
  const rows = await listProjectsForDashboard(db, opts)
  let active = 0, atRisk = 0, underPermitting = 0, underConstruction = 0
  for (const p of rows) {
    if (p.status === 'in_progress') {
      active++
      const risk = evaluateAtRisk({
        targetPermitDate: p.targetPermitDate,
        actualPermitDate: p.actualPermitDate,
        targetConstructionEndDate: p.targetConstructionEndDate,
        actualConstructionEndDate: p.actualConstructionEndDate,
        targetExitQuarter: p.targetExitQuarter,
        sold: p.sold,
      }, today)
      if (risk.atRisk) atRisk++
      const perm = p.phases.find(ph => ph.name === 'Permitting')
      if (perm?.status === 'in_progress') underPermitting++
      const constr = p.phases.find(ph => ph.name === 'Construction')
      if (constr?.status === 'in_progress') underConstruction++
    }
  }
  return { active, atRisk, underPermitting, underConstruction }
}

export async function listActiveProjectsForTeam(
  db: DB,
  opts: { team: 'design' | 'construction' | 'sales' },
): Promise<DashboardProject[]> {
  // Find non-terminal tasks where owner is on the given team
  const teamUsers = await db.select({ id: users.id }).from(users).where(eq(users.team, opts.team))
  if (teamUsers.length === 0) return []
  const teamUserIds = teamUsers.map(u => u.id)

  const NON_TERMINAL = ['not_started', 'started', 'pending_review', 'approved'] as const
  const candidateTasks = await db.select({ projectId: tasks.projectId })
    .from(tasks)
    .where(and(
      inArray(tasks.ownerId, teamUserIds),
      inArray(tasks.status, NON_TERMINAL as unknown as string[]),
    ))
  const projectIds = Array.from(new Set(candidateTasks.map(t => t.projectId)))
  if (projectIds.length === 0) return []

  const projectRows = await db.select().from(projects)
    .where(and(inArray(projects.id, projectIds), eq(projects.status, 'in_progress')))
  const phaseRows = await db.select().from(projectPhases)
    .where(inArray(projectPhases.projectId, projectRows.map(p => p.id)))
  const phasesByProject = new Map<string, ProjectPhase[]>()
  for (const ph of phaseRows) {
    if (!phasesByProject.has(ph.projectId)) phasesByProject.set(ph.projectId, [])
    phasesByProject.get(ph.projectId)!.push(ph)
  }
  return projectRows.map(p => ({ ...p, phases: phasesByProject.get(p.id) ?? [] }))
}
```

- [ ] **Step 3: Run and commit**

```bash
npm test -- db/queries/dashboard.test.ts
git add db/queries/dashboard.ts db/queries/dashboard.test.ts
git commit -m "feat(db): dashboard counters and team-active queries"
```

---

### Task 2.3: Performance review metrics query

**Files:**
- Create: `db/queries/performance.ts`
- Create: `db/queries/performance.test.ts`

- [ ] **Step 1: Test**

```ts
// db/queries/performance.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { eq } from 'drizzle-orm'
import { testDb, truncateAll } from '@/tests/db'
import { tasks, taskComments } from '@/db/schema'
import { seedOwner, seedPm, seedIc } from '@/tests/fixtures/users'
import { seedTemplate } from '@/tests/fixtures/workflow-templates'
import { projectService } from '@/lib/services/project-service'
import { taskService } from '@/lib/services/task-service'
import { computeTeamPerformance } from './performance'

describe('computeTeamPerformance', () => {
  beforeEach(async () => { await truncateAll() })

  it('counts tasks completed in window for team', async () => {
    const owner = await seedOwner()
    const pm = await seedPm()
    const ic = await seedIc('IC-design', 'design')
    const { template } = await seedTemplate({
      createdById: owner.id, name: 't',
      tasks: [{ name: 'A', durationDays: 1 }, { name: 'B', durationDays: 1 }],
      deps: [],
    })
    const project = await projectService.create({
      createdById: pm.id, name: 'P', brand: 'al_homes', pmId: pm.id,
      assignments: [{ phaseName: 'Permitting', templateId: template.id, sortOrder: 0 }],
    }, testDb)
    const allTasks = await testDb.select().from(tasks).where(eq(tasks.projectId, project.id))
    for (const t of allTasks) {
      await testDb.update(tasks).set({ ownerId: ic.id }).where(eq(tasks.id, t.id))
    }
    await taskService.setStatus({ taskId: allTasks[0].id, status: 'complete', actorId: ic.id }, testDb)

    const result = await computeTeamPerformance(testDb, {
      team: 'design',
      since: new Date('2020-01-01'),
      until: new Date('2030-01-01'),
    })
    expect(result.tasksCompleted).toBe(1)
    expect(result.wontDoCount).toBe(0)
    expect(result.perPerson.find(p => p.userId === ic.id)?.tasksCompleted).toBe(1)
  })

  it('counts revision rate from task_comments review_revision', async () => {
    const owner = await seedOwner()
    const pm = await seedPm()
    const ic = await seedIc('IC-design', 'design')
    const reviewer = await seedIc('Reviewer', 'design')
    const { template } = await seedTemplate({
      createdById: owner.id, name: 't', tasks: [{ name: 'A', durationDays: 1 }], deps: [],
    })
    const project = await projectService.create({
      createdById: pm.id, name: 'P', brand: 'al_homes', pmId: pm.id,
      assignments: [{ phaseName: 'Permitting', templateId: template.id, sortOrder: 0 }],
    }, testDb)
    const [task] = await testDb.select().from(tasks).where(eq(tasks.projectId, project.id))
    await testDb.update(tasks).set({ ownerId: ic.id, reviewerId: reviewer.id }).where(eq(tasks.id, task.id))
    await taskService.submitForReview({ taskId: task.id, actorId: ic.id, body: 'done' }, testDb)
    await taskService.requestRevision({ taskId: task.id, actorId: reviewer.id, body: 'fix' }, testDb)
    await taskService.submitForReview({ taskId: task.id, actorId: ic.id, body: 'fixed' }, testDb)
    await taskService.approve({ taskId: task.id, actorId: reviewer.id }, testDb)
    await taskService.markComplete({ taskId: task.id, actorId: ic.id }, testDb)

    const result = await computeTeamPerformance(testDb, {
      team: 'design', since: new Date('2020-01-01'), until: new Date('2030-01-01'),
    })
    expect(result.firstPassApprovalRate).toBe(0)   // had a revision
  })
})
```

- [ ] **Step 2: Implement**

```ts
// db/queries/performance.ts
import { and, eq, gte, lte, inArray } from 'drizzle-orm'
import type { DB } from '@/db/client'
import { tasks, users, taskComments } from '@/db/schema'

export type TeamPerformance = {
  tasksCompleted: number
  wontDoCount: number
  firstPassApprovalRate: number    // 0..1, 1 = always first-pass
  revisionRate: number             // 1 - firstPassApprovalRate
  perPerson: Array<{
    userId: string
    name: string
    tasksCompleted: number
    firstPassApprovalRate: number
  }>
}

export async function computeTeamPerformance(
  db: DB,
  opts: { team: 'design' | 'construction' | 'sales'; since: Date; until: Date },
): Promise<TeamPerformance> {
  const teamUsers = await db.select().from(users).where(eq(users.team, opts.team))
  if (teamUsers.length === 0) {
    return { tasksCompleted: 0, wontDoCount: 0, firstPassApprovalRate: 1, revisionRate: 0, perPerson: [] }
  }
  const teamUserIds = teamUsers.map(u => u.id)

  const ownedTasks = await db.select().from(tasks).where(inArray(tasks.ownerId, teamUserIds))
  const inWindow = ownedTasks.filter(t =>
    t.updatedAt >= opts.since && t.updatedAt <= opts.until,
  )
  const completed = inWindow.filter(t => t.status === 'complete')
  const wontDo = inWindow.filter(t => t.status === 'wont_do')

  // Revision counts: for each completed task, count its review_revision comments
  const completedTaskIds = completed.map(t => t.id)
  const revisionComments = completedTaskIds.length === 0 ? [] : await db.select()
    .from(taskComments)
    .where(and(
      inArray(taskComments.taskId, completedTaskIds),
      eq(taskComments.kind, 'review_revision'),
    ))
  const revisionedTaskIds = new Set(revisionComments.map(c => c.taskId))
  const firstPass = completed.filter(t => !revisionedTaskIds.has(t.id)).length
  const firstPassRate = completed.length === 0 ? 1 : firstPass / completed.length

  const perPerson = teamUsers.map(u => {
    const userCompleted = completed.filter(t => t.ownerId === u.id)
    const userFirstPass = userCompleted.filter(t => !revisionedTaskIds.has(t.id)).length
    return {
      userId: u.id,
      name: u.name,
      tasksCompleted: userCompleted.length,
      firstPassApprovalRate: userCompleted.length === 0 ? 1 : userFirstPass / userCompleted.length,
    }
  })

  return {
    tasksCompleted: completed.length,
    wontDoCount: wontDo.length,
    firstPassApprovalRate: firstPassRate,
    revisionRate: 1 - firstPassRate,
    perPerson,
  }
}
```

- [ ] **Step 3: Run and commit**

```bash
npm test -- db/queries/performance.test.ts
git add db/queries/performance.ts db/queries/performance.test.ts
git commit -m "feat(db): team performance metrics query"
```

---

## Phase 3: Dashboard view

### Task 3.1: Brand switcher + filter chip Client Components

**Files:**
- Create: `components/dashboard/brand-switcher.tsx`
- Create: `components/dashboard/counter-chip.tsx`
- Create: `components/dashboard/search-box.tsx`

- [ ] **Step 1: Write `components/dashboard/brand-switcher.tsx`**

```tsx
'use client'
import { useRouter, useSearchParams } from 'next/navigation'

const OPTIONS = [
  { value: '', label: 'All Brands' },
  { value: 'al_homes', label: 'Al Homes' },
  { value: 'alera', label: 'Alera' },
  { value: 'apex', label: 'Apex' },
] as const

export function BrandSwitcher() {
  const router = useRouter()
  const params = useSearchParams()
  const current = params.get('brand') ?? ''

  return (
    <select
      value={current}
      onChange={(e) => {
        const next = new URLSearchParams(params)
        if (e.target.value) next.set('brand', e.target.value)
        else next.delete('brand')
        router.push(`?${next.toString()}`)
      }}
      className="rounded border border-slate-300 bg-white px-3 py-1 text-sm"
    >
      {OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}
```

- [ ] **Step 2: `components/dashboard/counter-chip.tsx`**

```tsx
'use client'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

export type CounterFilter = 'active' | 'at_risk' | 'under_permitting' | 'under_construction'

export function CounterChip({
  filter, label, count, accent,
}: { filter: CounterFilter; label: string; count: number; accent?: 'red' }) {
  const params = useSearchParams()
  const isActive = params.get('filter') === filter
  const next = new URLSearchParams(params)
  if (isActive) next.delete('filter')
  else next.set('filter', filter)
  return (
    <Link
      href={`?${next.toString()}`}
      className={[
        'flex flex-col rounded-xl border px-4 py-3',
        isActive ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white',
      ].join(' ')}
    >
      <span className={['text-2xl font-semibold', accent === 'red' ? 'text-red-600' : ''].join(' ')}>{count}</span>
      <span className="text-xs text-slate-600">{label}</span>
    </Link>
  )
}
```

- [ ] **Step 3: `components/dashboard/search-box.tsx`**

```tsx
'use client'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'

export function SearchBox() {
  const router = useRouter()
  const params = useSearchParams()
  const [v, setV] = useState(params.get('q') ?? '')

  useEffect(() => {
    const t = setTimeout(() => {
      const next = new URLSearchParams(params)
      if (v) next.set('q', v)
      else next.delete('q')
      router.push(`?${next.toString()}`)
    }, 200)
    return () => clearTimeout(t)
  }, [v])

  return (
    <input
      value={v}
      onChange={(e) => setV(e.target.value)}
      placeholder="Search projects…"
      className="w-64 rounded border border-slate-300 bg-white px-3 py-1 text-sm"
    />
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add components/dashboard/
git commit -m "feat(ui): dashboard interactive components (brand switcher, chips, search)"
```

---

### Task 3.2: Dashboard page

**Files:**
- Modify: `app/(app)/page.tsx` (replace the Phase-12 stub)

- [ ] **Step 1: Implement**

```tsx
// app/(app)/page.tsx
import { db } from '@/db/client'
import {
  listProjectsForDashboard,
  computeDashboardCounters,
  searchProjects,
} from '@/db/queries/dashboard'
import { evaluateAtRisk } from '@/lib/dashboard/at-risk'
import { deriveCurrentState } from '@/lib/dashboard/current-state'
import { compareQuarters, formatQuarterLabel } from '@/lib/dashboard/quarter'
import { BrandSwitcher } from '@/components/dashboard/brand-switcher'
import { CounterChip } from '@/components/dashboard/counter-chip'
import { SearchBox } from '@/components/dashboard/search-box'
import Link from 'next/link'

type SearchParams = { brand?: 'al_homes'|'alera'|'apex'; filter?: 'active'|'at_risk'|'under_permitting'|'under_construction'; q?: string }

const SEVERITY_RANK = { exit_overdue: 3, construction_overdue: 2, permit_overdue: 1, none: 0 }

export default async function DashboardPage({ searchParams }: { searchParams: SearchParams }) {
  const today = new Date()
  const brand = searchParams.brand
  const filter = searchParams.filter
  const q = searchParams.q?.trim() ?? ''

  if (q) {
    const matches = await searchProjects(db, q)
    return (
      <div className="space-y-4">
        <Header brand={brand} />
        <p className="text-sm text-slate-600">Search results for "{q}" — {matches.length} found</p>
        <ul className="space-y-2">
          {matches.map(p => (
            <li key={p.id} className="rounded border bg-white p-3">
              <Link href={`/projects/${p.id}`}>{p.name}</Link>
              <span className="ml-2 text-xs text-slate-500">{p.brand} · {p.status}</span>
            </li>
          ))}
        </ul>
      </div>
    )
  }

  const all = await listProjectsForDashboard(db, brand ? { brand } : {})
  const counts = await computeDashboardCounters(db, brand ? { brand } : {}, today)

  // Decorate with at-risk + current state
  const decorated = all.map(p => {
    const risk = evaluateAtRisk({
      targetPermitDate: p.targetPermitDate,
      actualPermitDate: p.actualPermitDate,
      targetConstructionEndDate: p.targetConstructionEndDate,
      actualConstructionEndDate: p.actualConstructionEndDate,
      targetExitQuarter: p.targetExitQuarter,
      sold: p.sold,
    }, today)
    const currentState = deriveCurrentState({
      status: p.status,
      sold: p.sold,
      listingDate: p.listingDate,
      presalePhase1Date: p.presalePhase1Date,
      presalePhase2Date: p.presalePhase2Date,
      presalePhase3Date: p.presalePhase3Date,
      phases: p.phases.map(ph => ({ name: ph.name, status: ph.status, sortOrder: ph.sortOrder })),
    })
    return { ...p, risk, currentState }
  })

  // Apply chip filter
  const filtered = decorated.filter(p => {
    if (filter === 'active') return p.status === 'in_progress'
    if (filter === 'at_risk') return p.risk.atRisk
    if (filter === 'under_permitting') return p.phases.find(ph => ph.name === 'Permitting')?.status === 'in_progress'
    if (filter === 'under_construction') return p.phases.find(ph => ph.name === 'Construction')?.status === 'in_progress'
    return true
  })

  // Group by quarter, sort within group by risk severity then target_permit_date
  const groups = new Map<string, typeof filtered>()
  for (const p of filtered) {
    const key = p.targetExitQuarter ?? '__none'
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(p)
  }
  const orderedKeys = Array.from(groups.keys()).sort((a, b) =>
    compareQuarters(a === '__none' ? null : a, b === '__none' ? null : b),
  )
  for (const list of groups.values()) {
    list.sort((a, b) => {
      const sa = a.risk.atRisk ? SEVERITY_RANK[a.risk.severity!] : 0
      const sb = b.risk.atRisk ? SEVERITY_RANK[b.risk.severity!] : 0
      if (sa !== sb) return sb - sa
      const da = a.targetPermitDate ?? '9999-12-31'
      const db = b.targetPermitDate ?? '9999-12-31'
      return da.localeCompare(db)
    })
  }

  return (
    <div className="space-y-6">
      <Header brand={brand} />
      <div className="grid grid-cols-4 gap-3">
        <CounterChip filter="active" label="Active" count={counts.active} />
        <CounterChip filter="at_risk" label="At Risk" count={counts.atRisk} accent="red" />
        <CounterChip filter="under_permitting" label="Under Permitting" count={counts.underPermitting} />
        <CounterChip filter="under_construction" label="Under Construction" count={counts.underConstruction} />
      </div>

      {orderedKeys.map(key => {
        const list = groups.get(key)!
        const atRiskInGroup = list.filter(p => p.risk.atRisk).length
        return (
          <section key={key}>
            <h2 className="mb-2 text-lg font-medium">
              {formatQuarterLabel(key === '__none' ? null : key)} — Target Exit
              <span className="ml-2 text-sm text-slate-500">
                ({list.length} project{list.length === 1 ? '' : 's'}{atRiskInGroup > 0 ? `, ${atRiskInGroup} at risk` : ''})
              </span>
            </h2>
            <ul className="space-y-2">
              {list.map(p => (
                <li key={p.id} className="rounded border bg-white p-3">
                  <Link href={`/projects/${p.id}`} className="flex items-center gap-3">
                    <span>{p.risk.atRisk ? '🔴' : '⚪'}</span>
                    <span className="font-medium">{p.name}</span>
                    <span className="text-xs text-slate-500">{p.city ?? '—'}{p.state ? `, ${p.state}` : ''}</span>
                    <span className="text-xs text-slate-600">{p.currentState}</span>
                    {p.risk.atRisk && (
                      <span className="ml-auto text-xs text-red-600">{p.risk.daysBehind}d behind</span>
                    )}
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-xs">{p.brand}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}

function Header({ brand }: { brand?: string }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <BrandSwitcher />
      </div>
      <SearchBox />
    </div>
  )
}
```

- [ ] **Step 2: Verify typecheck and build**

```bash
npm run typecheck
```

- [ ] **Step 3: Commit**

```bash
git add app/\(app\)/page.tsx
git commit -m "feat(ui): dashboard page with brand/filter/quarter grouping"
```

---

## Phase 4: Team view

### Task 4.1: Team view page

**Files:**
- Create: `app/(app)/team/[team]/page.tsx`
- Modify: `app/(app)/team/page.tsx` (redirect to first available team)

- [ ] **Step 1: Replace `app/(app)/team/page.tsx`**

```tsx
import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/server/get-current-user'

export default async function TeamIndexPage() {
  const me = await requireUser()
  const teamRoute = me.team ?? 'design'
  redirect(`/team/${teamRoute}`)
}
```

- [ ] **Step 2: Create `app/(app)/team/[team]/page.tsx`**

```tsx
import Link from 'next/link'
import { eq, and, inArray } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { db } from '@/db/client'
import { tasks } from '@/db/schema'
import { listActiveProjectsForTeam } from '@/db/queries/dashboard'
import { deriveCurrentState } from '@/lib/dashboard/current-state'

const TEAMS = ['design', 'construction', 'sales'] as const
type Team = typeof TEAMS[number]
const LABELS: Record<Team, string> = { design: 'Design', construction: 'Construction', sales: 'Sales' }

export default async function TeamPage({ params }: { params: { team: string } }) {
  if (!(TEAMS as readonly string[]).includes(params.team)) notFound()
  const team = params.team as Team

  const projectsForTeam = await listActiveProjectsForTeam(db, { team })
  // Per project, count team-owned tasks active and at-risk
  const projectIds = projectsForTeam.map(p => p.id)
  const allTeamTasks = projectIds.length === 0 ? [] : await db.select().from(tasks)
    .where(inArray(tasks.projectId, projectIds))

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Team</h1>
      <Tabs current={team} />
      <h2 className="text-lg font-medium">{LABELS[team]} team — active projects</h2>
      <ul className="space-y-2">
        {projectsForTeam.map(p => {
          const teamTasks = allTeamTasks.filter(t => t.projectId === p.id)
          const activeCount = teamTasks.filter(t => t.status !== 'complete' && t.status !== 'wont_do').length
          const blockedCount = teamTasks.filter(t => t.isBlocked).length
          const state = deriveCurrentState({
            status: p.status, sold: p.sold,
            listingDate: p.listingDate,
            presalePhase1Date: p.presalePhase1Date,
            presalePhase2Date: p.presalePhase2Date,
            presalePhase3Date: p.presalePhase3Date,
            phases: p.phases.map(ph => ({ name: ph.name, status: ph.status, sortOrder: ph.sortOrder })),
          })
          return (
            <li key={p.id} className="rounded border bg-white p-3">
              <Link href={`/projects/${p.id}`} className="flex items-center gap-3">
                <span className="font-medium">{p.name}</span>
                <span className="text-xs text-slate-500">{p.city ?? '—'}</span>
                <span className="text-xs text-slate-600">{state}</span>
                <span className="ml-auto text-xs">{activeCount} active task{activeCount === 1 ? '' : 's'}{blockedCount > 0 ? `, ${blockedCount} blocked` : ''}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function Tabs({ current }: { current: Team }) {
  return (
    <div className="flex gap-2 border-b border-slate-200">
      {TEAMS.map(t => (
        <Link key={t} href={`/team/${t}`}
          className={[
            'px-3 py-2 text-sm',
            t === current ? 'border-b-2 border-blue-500 font-medium' : 'text-slate-600',
          ].join(' ')}>
          {LABELS[t]}
        </Link>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Verify and commit**

```bash
npm run typecheck
git add "app/(app)/team/"
git commit -m "feat(ui): team view with per-team tabs and active project list"
```

---

## Phase 5: Performance Review view

### Task 5.1: Performance Review page

**Files:**
- Create: `app/(app)/performance/[team]/page.tsx`
- Modify: `app/(app)/performance/page.tsx`

- [ ] **Step 1: Replace `app/(app)/performance/page.tsx`**

```tsx
import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/server/get-current-user'

export default async function PerformanceIndexPage() {
  const me = await requireUser()
  const teamRoute = me.team ?? 'design'
  redirect(`/performance/${teamRoute}`)
}
```

- [ ] **Step 2: Create `app/(app)/performance/[team]/page.tsx`**

```tsx
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { db } from '@/db/client'
import { computeTeamPerformance } from '@/db/queries/performance'

const TEAMS = ['design', 'construction', 'sales'] as const
type Team = typeof TEAMS[number]
const LABELS: Record<Team, string> = { design: 'Design', construction: 'Construction', sales: 'Sales' }

const RANGES: Record<string, number> = {
  '30':  30 * 24 * 60 * 60 * 1000,
  '90':  90 * 24 * 60 * 60 * 1000,
  '365': 365 * 24 * 60 * 60 * 1000,
}

export default async function PerformancePage({
  params, searchParams,
}: { params: { team: string }; searchParams: { range?: string } }) {
  if (!(TEAMS as readonly string[]).includes(params.team)) notFound()
  const team = params.team as Team
  const rangeKey = searchParams.range && RANGES[searchParams.range] ? searchParams.range : '90'
  const until = new Date()
  const since = new Date(until.getTime() - RANGES[rangeKey])

  const metrics = await computeTeamPerformance(db, { team, since, until })
  const pct = (x: number) => `${Math.round(x * 100)}%`

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Performance Review</h1>
      <Tabs current={team} />
      <RangePicker current={rangeKey} team={team} />

      <h2 className="text-lg font-medium">{LABELS[team]} team — last {rangeKey} days</h2>

      <div className="grid grid-cols-3 gap-3">
        <Card title="Tasks completed" value={String(metrics.tasksCompleted)} />
        <Card title="First-pass approval" value={pct(metrics.firstPassApprovalRate)} />
        <Card title="Revision rate" value={pct(metrics.revisionRate)} />
      </div>

      <p className="text-sm text-slate-600">Won't-do count: {metrics.wontDoCount}</p>

      <h3 className="text-md font-medium pt-4">Per-person breakdown</h3>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            <th className="text-left py-1">Name</th>
            <th className="text-left py-1">Tasks completed</th>
            <th className="text-left py-1">First-pass approval</th>
          </tr>
        </thead>
        <tbody>
          {metrics.perPerson.map(p => (
            <tr key={p.userId} className="border-b">
              <td className="py-1">{p.name}</td>
              <td className="py-1">{p.tasksCompleted}</td>
              <td className="py-1">{pct(p.firstPassApprovalRate)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Tabs({ current }: { current: Team }) {
  return (
    <div className="flex gap-2 border-b border-slate-200">
      {TEAMS.map(t => (
        <Link key={t} href={`/performance/${t}`}
          className={[
            'px-3 py-2 text-sm',
            t === current ? 'border-b-2 border-blue-500 font-medium' : 'text-slate-600',
          ].join(' ')}>
          {LABELS[t]}
        </Link>
      ))}
    </div>
  )
}

function Card({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded border bg-white p-3">
      <div className="text-2xl font-semibold">{value}</div>
      <div className="text-xs text-slate-600">{title}</div>
    </div>
  )
}

function RangePicker({ current, team }: { current: string; team: Team }) {
  return (
    <div className="flex gap-2 text-sm">
      {Object.keys(RANGES).map(k => (
        <Link key={k} href={`/performance/${team}?range=${k}`}
          className={[
            'rounded px-2 py-1',
            k === current ? 'bg-slate-200' : 'text-slate-600 hover:bg-slate-100',
          ].join(' ')}>
          Last {k} days
        </Link>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Verify and commit**

```bash
npm run typecheck
git add "app/(app)/performance/"
git commit -m "feat(ui): performance review with per-team tabs, range picker, KPIs, per-person table"
```

---

## Final verification

- [ ] **Step 1: Full test suite green**

```bash
npm test
```

Expected: All existing 72 tests still pass, plus ~12 new tests added by Phase 1 and 2.

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

- [ ] **Step 3: Manual smoke test (requires Lark setup from foundation plan Task 12.5)**

If you've already done the foundation's Task 12.5 smoke (Lark creds + bootstrap owner), now you can additionally:

1. Visit `/` — see the dashboard with at-risk counters and quarter groups
2. Switch brand in top-left dropdown — projects filter
3. Click a counter chip — list narrows
4. Type in search box — flat list of matches replaces grouped view
5. Visit `/team/design` — see active projects for design team
6. Visit `/performance/design?range=90` — see KPI cards + per-person table

---

## Self-review

**Spec coverage:**
- Section 1 navigation structure ✓ (sidebar links exist from foundation Task 12.2; route handlers route correctly)
- Section 3 Dashboard view ✓ (BrandSwitcher, SearchBox, CounterChip, quarter grouping, at-risk first sort, current-state label)
- Section 4 Team view ✓ (`/team/[team]` with three tabs, per-team active projects)
- Section 5 Performance Review ✓ (`/performance/[team]` with KPIs, range picker, per-person table)
- At-risk definition (§3.7) ✓ (lib/dashboard/at-risk.ts, with tests for all four cases incl. severity)
- Current-state derivation (§3.6) ✓
- Data dependencies (§6) — uses existing schema only, no new tables
- Open questions (§7): handled with sensible defaults (no Presale chip for v1, All Brands default, `tasks.updated_at` used as time anchor for performance metrics)

**Placeholder scan:** none

**Type consistency:** `Team` enum used consistently as `'design'|'construction'|'sales'`; `Brand` consistently `'al_homes'|'alera'|'apex'`; `CurrentStateLabel` consistent across files.

**Out of scope (deferred):**
- Per-person `on-time rate` and `avg review-loop turnaround` columns — defined in spec §5.3 but require activity timestamps that we'd need to extract from `activities` events; deferred to a follow-up performance-v2 spec.
- "All Brands aggregate vs home brand default" — defaulting to All Brands per spec §7 question 4.
- A 5th "Presale" counter chip — spec §7 question 1; deferred.
