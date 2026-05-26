# BuildFlow Project Page — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the per-project detail view at `/projects/[id]` per `docs/superpowers/specs/2026-05-26-project-page-design.md`. Replaces the foundation's Phase-12 stub with a header summary, four tabs (Permitting / Construction / Sale / Activity), Standard-complexity Gantt with critical-path highlighting, color-coded task list, floating task drawer with status-flow stepper and comment composer, Add Task dialog (draft + unplanned modes), Edit Metadata dialog, Activity feed. Also migrates the existing app's styling to the Theme B palette and introduces the default-avatar SVG fallback.

**Architecture:** Server Components fetch all project data in one round-trip (`db/queries/project-page.ts`); URL params drive non-form state (`?tab=`, `?task=`); Client Components handle interactivity (tabs, drawer overlay, modals, Gantt SVG). Two new Server Actions are added on top of the foundation: `updateProjectMetadata` and `addPlannedTask`. Pure-function modules under `lib/project-page/` and `lib/avatar/` are exhaustively unit-tested; component tests focus on permission-conditional rendering.

**Tech Stack:** Next.js 14 App Router (server + client components), TypeScript, Drizzle ORM, Postgres, Tailwind, Radix UI (Dialog, Popover, Tooltip), Vitest, React Testing Library. Builds on the foundation merged at `22f2db2` and the dashboard merged at `0592e5d`.

---

## Phase 1: Theme migration + Avatar component

### Task 1.1: Tailwind config — Theme B base palette

**Files:**
- Modify: `tailwind.config.ts`
- Modify: `app/globals.css`

- [ ] **Step 1: Add gradient utilities + theme tokens to `tailwind.config.ts`**

Replace the existing file with:

```ts
import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Theme B — Off-white + Electric Blue
        // Semantic aliases (use these in components; Tailwind's color scale stays available too)
        surface: { DEFAULT: '#ffffff', muted: '#fafafa' },
        body: { DEFAULT: '#18181b', muted: '#71717a' },
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(90deg, #06b6d4 0%, #3b82f6 100%)',
      },
    },
  },
  plugins: [],
}
export default config
```

- [ ] **Step 2: Set `app/globals.css` body defaults to Theme B**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  background: #fafafa;
  color: #18181b;
}
```

- [ ] **Step 3: Verify typecheck and commit**

```bash
npm run typecheck
git add tailwind.config.ts app/globals.css
git commit -m "feat(theme): off-white + electric blue Tailwind config"
```

---

### Task 1.2: Update existing dashboard / team / performance pages to Theme B

The foundation's UI components used `bg-slate-50` and solid `bg-blue-600`. Convert them to Theme B (`bg-zinc-50`, gradient primary, gradient brand chip).

**Files (sweep — search and replace per file):**
- Modify: `app/(app)/page.tsx`
- Modify: `app/(app)/team/[team]/page.tsx`
- Modify: `app/(app)/performance/[team]/page.tsx`
- Modify: `app/(app)/settings/members/page.tsx`
- Modify: `app/(app)/settings/audit/page.tsx`
- Modify: `app/(app)/projects/page.tsx`
- Modify: `app/(app)/my-tasks/page.tsx`
- Modify: `app/(app)/workflows/page.tsx`
- Modify: `app/login/page.tsx`
- Modify: `components/dashboard/brand-switcher.tsx`
- Modify: `components/dashboard/counter-chip.tsx`
- Modify: `components/dashboard/search-box.tsx`
- Modify: `components/layout/sidebar.tsx`

- [ ] **Step 1: Replace slate-50 backgrounds with zinc-50**

In each listed file, replace:
- `bg-slate-50` → `bg-zinc-50`
- `bg-slate-100` → `bg-zinc-100`
- `bg-slate-200` → `bg-zinc-200`
- `border-slate-200` → `border-zinc-200`
- `border-slate-300` → `border-zinc-300`
- `text-slate-900` → `text-zinc-900`
- `text-slate-700` → `text-zinc-700`
- `text-slate-600` → `text-zinc-600`
- `text-slate-500` → `text-zinc-500`

(Use `sed -i ''` on macOS for batch replace, or do per-file.)

- [ ] **Step 2: Update primary-button styles to gradient**

Search across the listed files for `bg-blue-600` standalone (not in conditionals where it means something specific like a status indicator). Replace with `bg-gradient-to-r from-cyan-500 to-blue-500`. Keep `hover:bg-blue-700` → change to `hover:opacity-90`.

Specifically in `components/dashboard/counter-chip.tsx`, replace:
- `border-blue-500 bg-blue-50` → keep (it's the chip's "selected" state; the chip is informational not primary)

Specifically in `app/login/page.tsx`, replace the Sign in button:
```tsx
// before
<a className="block w-full rounded-lg bg-blue-600 px-4 py-3 text-center font-medium text-white hover:bg-blue-700">
// after
<a className="block w-full rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 px-4 py-3 text-center font-medium text-white hover:opacity-90">
```

- [ ] **Step 3: Run dev build, verify pages still look reasonable**

```bash
npm run build
```

Expected: clean compile.

- [ ] **Step 4: Commit**

```bash
git add app/ components/
git commit -m "feat(theme): migrate existing pages to Theme B (zinc + electric blue gradient)"
```

---

### Task 1.3: Default avatar SVG assets

**Files:**
- Create: `public/avatars/avatar-1.svg` (cyan→blue circle)
- Create: `public/avatars/avatar-2.svg` (purple→pink triangle up)
- Create: `public/avatars/avatar-3.svg` (emerald→cyan diamond)
- Create: `public/avatars/avatar-4.svg` (amber→orange two dots)
- Create: `public/avatars/avatar-5.svg` (indigo→violet triangle down)
- Create: `public/avatars/avatar-6.svg` (rose→orange ring)

- [ ] **Step 1: Create `public/avatars/avatar-1.svg`**

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#06b6d4"/>
      <stop offset="1" stop-color="#3b82f6"/>
    </linearGradient>
  </defs>
  <rect width="40" height="40" fill="#ecfeff"/>
  <circle cx="20" cy="20" r="12" fill="url(#g)"/>
</svg>
```

- [ ] **Step 2: Create `public/avatars/avatar-2.svg`**

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#a855f7"/>
      <stop offset="1" stop-color="#ec4899"/>
    </linearGradient>
  </defs>
  <rect width="40" height="40" fill="#fdf4ff"/>
  <path d="M0 32 L40 32 L20 8 Z" fill="url(#g)"/>
</svg>
```

- [ ] **Step 3: Create `public/avatars/avatar-3.svg`**

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#10b981"/>
      <stop offset="1" stop-color="#22d3ee"/>
    </linearGradient>
  </defs>
  <rect width="40" height="40" fill="#f0fdf4"/>
  <rect x="10" y="10" width="20" height="20" fill="url(#g)" transform="rotate(45 20 20)"/>
</svg>
```

- [ ] **Step 4: Create `public/avatars/avatar-4.svg`**

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#fbbf24"/>
      <stop offset="1" stop-color="#f97316"/>
    </linearGradient>
  </defs>
  <rect width="40" height="40" fill="#fffbeb"/>
  <circle cx="14" cy="20" r="6" fill="url(#g)"/>
  <circle cx="26" cy="20" r="6" fill="url(#g)"/>
</svg>
```

- [ ] **Step 5: Create `public/avatars/avatar-5.svg`**

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#6366f1"/>
      <stop offset="1" stop-color="#8b5cf6"/>
    </linearGradient>
  </defs>
  <rect width="40" height="40" fill="#eef2ff"/>
  <path d="M8 8 L32 8 L20 32 Z" fill="url(#g)"/>
</svg>
```

- [ ] **Step 6: Create `public/avatars/avatar-6.svg`**

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#f43f5e"/>
      <stop offset="1" stop-color="#f97316"/>
    </linearGradient>
  </defs>
  <rect width="40" height="40" fill="#fef2f2"/>
  <circle cx="20" cy="20" r="13" fill="none" stroke="url(#g)" stroke-width="4"/>
</svg>
```

- [ ] **Step 7: Commit**

```bash
git add public/avatars/
git commit -m "feat(avatar): default SVG avatar set (6 deterministic shapes)"
```

---

### Task 1.4: `pickDefaultAvatar` pure function

**Files:**
- Create: `lib/avatar/default-avatar.ts`
- Create: `lib/avatar/default-avatar.test.ts`

- [ ] **Step 1: Write tests**

```ts
// lib/avatar/default-avatar.test.ts
import { describe, it, expect } from 'vitest'
import { pickDefaultAvatar } from './default-avatar'

describe('pickDefaultAvatar', () => {
  it('returns a number 1..6', () => {
    for (const id of ['user-1', 'user-2', 'user-3', 'abc']) {
      const n = pickDefaultAvatar(id)
      expect(n).toBeGreaterThanOrEqual(1)
      expect(n).toBeLessThanOrEqual(6)
    }
  })

  it('is deterministic — same id → same avatar', () => {
    const a = pickDefaultAvatar('11111111-2222-3333-4444-555555555555')
    const b = pickDefaultAvatar('11111111-2222-3333-4444-555555555555')
    expect(a).toBe(b)
  })

  it('distributes across the 6 buckets reasonably', () => {
    const counts = [0, 0, 0, 0, 0, 0, 0]
    for (let i = 0; i < 600; i++) counts[pickDefaultAvatar(`user-${i}`)]++
    for (let i = 1; i <= 6; i++) expect(counts[i]).toBeGreaterThan(40)
  })

  it('handles empty string without throwing', () => {
    expect(() => pickDefaultAvatar('')).not.toThrow()
  })
})
```

- [ ] **Step 2: Run, expect fail**

```bash
npm test -- lib/avatar/default-avatar.test.ts
```

- [ ] **Step 3: Implement**

```ts
// lib/avatar/default-avatar.ts
export function pickDefaultAvatar(userId: string): number {
  let hash = 0
  for (const ch of userId) hash = (hash * 31 + ch.charCodeAt(0)) & 0x7fffffff
  return (hash % 6) + 1
}
```

- [ ] **Step 4: Run, expect pass; commit**

```bash
npm test -- lib/avatar/default-avatar.test.ts
git add lib/avatar/
git commit -m "feat(avatar): pickDefaultAvatar pure function"
```

---

### Task 1.5: `<Avatar />` shared component

**Files:**
- Create: `components/shared/avatar.tsx`

- [ ] **Step 1: Implement**

```tsx
// components/shared/avatar.tsx
import { pickDefaultAvatar } from '@/lib/avatar/default-avatar'

type Size = 'xs' | 'sm' | 'md' | 'lg'

const SIZES: Record<Size, number> = { xs: 16, sm: 24, md: 40, lg: 64 }

export function Avatar({
  user, size = 'sm',
}: {
  user: { id: string; avatarUrl?: string | null; name: string }
  size?: Size
}) {
  const px = SIZES[size]
  const fallback = `/avatars/avatar-${pickDefaultAvatar(user.id)}.svg`
  const src = user.avatarUrl || fallback
  return (
    <img
      src={src}
      alt={user.name}
      title={user.name}
      width={px}
      height={px}
      className="rounded-full inline-block"
      style={{ width: px, height: px }}
    />
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/shared/avatar.tsx
git commit -m "feat(avatar): Avatar component with size variants + default fallback"
```

---

## Phase 2: Pure-function helpers

### Task 2.1: `current-task-status` — on track / at risk / delay rules

**Files:**
- Create: `lib/project-page/current-task-status.ts`
- Create: `lib/project-page/current-task-status.test.ts`

- [ ] **Step 1: Tests**

```ts
// lib/project-page/current-task-status.test.ts
import { describe, it, expect } from 'vitest'
import { currentTaskStatus } from './current-task-status'

describe('currentTaskStatus', () => {
  it('on track when no problems', () => {
    expect(currentTaskStatus({ status: 'not_started', isBlocked: false, plannedEndDay: 10 }, 5)).toEqual({
      level: 'on_track', daysBehind: 0,
    })
  })

  it('at risk when blocked (deps incomplete)', () => {
    expect(currentTaskStatus({ status: 'not_started', isBlocked: true, plannedEndDay: 10 }, 5)).toEqual({
      level: 'at_risk', daysBehind: 0,
    })
  })

  it('delay when past planned_end_day and not terminal', () => {
    expect(currentTaskStatus({ status: 'started', isBlocked: false, plannedEndDay: 5 }, 10)).toEqual({
      level: 'delay', daysBehind: 5,
    })
  })

  it('complete tasks are always on_track regardless of planned dates', () => {
    expect(currentTaskStatus({ status: 'complete', isBlocked: false, plannedEndDay: 5 }, 10)).toEqual({
      level: 'on_track', daysBehind: 0,
    })
  })

  it('wont_do tasks are always on_track', () => {
    expect(currentTaskStatus({ status: 'wont_do', isBlocked: true, plannedEndDay: 5 }, 10)).toEqual({
      level: 'on_track', daysBehind: 0,
    })
  })

  it('handles null planned_end_day (treat as no delay)', () => {
    expect(currentTaskStatus({ status: 'started', isBlocked: false, plannedEndDay: null }, 10)).toEqual({
      level: 'on_track', daysBehind: 0,
    })
  })
})
```

- [ ] **Step 2: Implement**

```ts
// lib/project-page/current-task-status.ts
import type { TaskStatus } from '@/db/schema'

export type TaskStatusLevel = 'on_track' | 'at_risk' | 'delay'

export type CurrentTaskStatus = {
  level: TaskStatusLevel
  daysBehind: number
}

export function currentTaskStatus(
  input: { status: TaskStatus; isBlocked: boolean; plannedEndDay: number | null },
  todayDayOffset: number,
): CurrentTaskStatus {
  const terminal = input.status === 'complete' || input.status === 'wont_do'
  if (terminal) return { level: 'on_track', daysBehind: 0 }

  if (input.plannedEndDay !== null && todayDayOffset > input.plannedEndDay) {
    return { level: 'delay', daysBehind: todayDayOffset - input.plannedEndDay }
  }
  if (input.isBlocked) return { level: 'at_risk', daysBehind: 0 }
  return { level: 'on_track', daysBehind: 0 }
}
```

- [ ] **Step 3: Run and commit**

```bash
npm test -- lib/project-page/current-task-status.test.ts
git add lib/project-page/current-task-status.ts lib/project-page/current-task-status.test.ts
git commit -m "feat(project-page): currentTaskStatus on track / at risk / delay rules"
```

---

### Task 2.2: `phase-action-state` — Kick Off / Mark Complete button logic

**Files:**
- Create: `lib/project-page/phase-action-state.ts`
- Create: `lib/project-page/phase-action-state.test.ts`

- [ ] **Step 1: Tests**

```ts
// lib/project-page/phase-action-state.test.ts
import { describe, it, expect } from 'vitest'
import { phaseActionState } from './phase-action-state'

describe('phaseActionState', () => {
  const permitting = { id: 'p', name: 'Permitting' as const, sortOrder: 1, status: 'pending' as const }
  const construction = { id: 'c', name: 'Construction' as const, sortOrder: 2, status: 'pending' as const }

  it('first phase pending → Kick Off enabled', () => {
    expect(phaseActionState(permitting, [])).toMatchObject({
      label: 'Kick Off Phase', visible: true, enabled: true, action: 'kick_off',
    })
  })

  it('second phase pending while first not complete → disabled', () => {
    const out = phaseActionState(construction, [{ ...permitting, status: 'in_progress' }])
    expect(out.visible).toBe(true)
    expect(out.enabled).toBe(false)
    expect(out.disabledReason).toContain('Earlier phase')
  })

  it('phase in_progress → Mark Phase Complete', () => {
    expect(phaseActionState({ ...permitting, status: 'in_progress' }, [])).toMatchObject({
      label: 'Mark Phase Complete', visible: true, enabled: true, action: 'mark_complete',
    })
  })

  it('phase complete → button hidden', () => {
    expect(phaseActionState({ ...permitting, status: 'complete' }, [])).toMatchObject({
      visible: false,
    })
  })
})
```

- [ ] **Step 2: Implement**

```ts
// lib/project-page/phase-action-state.ts
import type { ProjectPhase } from '@/db/schema'

export type PhaseActionState = {
  visible: boolean
  enabled: boolean
  label?: string
  action?: 'kick_off' | 'mark_complete'
  disabledReason?: string
}

export function phaseActionState(
  phase: Pick<ProjectPhase, 'id' | 'name' | 'sortOrder' | 'status'>,
  earlierPhases: Array<Pick<ProjectPhase, 'sortOrder' | 'status'>>,
): PhaseActionState {
  if (phase.status === 'complete') return { visible: false, enabled: false }
  if (phase.status === 'in_progress') {
    return { visible: true, enabled: true, label: 'Mark Phase Complete', action: 'mark_complete' }
  }
  // pending
  const earliers = earlierPhases.filter(p => p.sortOrder < phase.sortOrder)
  const allEarlierComplete = earliers.every(p => p.status === 'complete')
  if (!allEarlierComplete) {
    return { visible: true, enabled: false, label: 'Kick Off Phase', action: 'kick_off',
      disabledReason: 'Earlier phase must be complete first' }
  }
  return { visible: true, enabled: true, label: 'Kick Off Phase', action: 'kick_off' }
}
```

- [ ] **Step 3: Run and commit**

```bash
npm test -- lib/project-page/phase-action-state.test.ts
git add lib/project-page/phase-action-state.ts lib/project-page/phase-action-state.test.ts
git commit -m "feat(project-page): phaseActionState button logic"
```

---

### Task 2.3: `task-action-state` — drawer button matrix

**Files:**
- Create: `lib/project-page/task-action-state.ts`
- Create: `lib/project-page/task-action-state.test.ts`

- [ ] **Step 1: Tests**

```ts
// lib/project-page/task-action-state.test.ts
import { describe, it, expect } from 'vitest'
import { taskActionState } from './task-action-state'

const baseProject = { pmId: 'pm-1', status: 'in_progress' as const }
const ownerUser = { id: 'ic-owner', role: 'ic' as const }
const reviewerUser = { id: 'ic-reviewer', role: 'ic' as const }
const otherIc = { id: 'ic-other', role: 'ic' as const }
const pm = { id: 'pm-1', role: 'pm' as const }
const sysOwner = { id: 'o-1', role: 'owner' as const }

const taskBase = { ownerId: ownerUser.id, reviewerId: reviewerUser.id }

describe('taskActionState', () => {
  it('owner of task, not_started → Start + Won\'t do', () => {
    const out = taskActionState({
      task: { ...taskBase, status: 'not_started' }, project: baseProject, user: ownerUser,
    })
    expect(out.primary?.action).toBe('start')
    expect(out.secondary?.action).toBe('wont_do')
    expect(out.context).toMatch(/Begin work/)
  })

  it('owner of task, started with reviewer → Submit for Review', () => {
    const out = taskActionState({
      task: { ...taskBase, status: 'started' }, project: baseProject, user: ownerUser,
    })
    expect(out.primary?.action).toBe('submit_review')
  })

  it('owner of task, started WITHOUT reviewer → Mark Complete', () => {
    const out = taskActionState({
      task: { ...taskBase, reviewerId: null, status: 'started' }, project: baseProject, user: ownerUser,
    })
    expect(out.primary?.action).toBe('mark_complete')
  })

  it('owner of task, pending_review → no primary, only Won\'t do', () => {
    const out = taskActionState({
      task: { ...taskBase, status: 'pending_review' }, project: baseProject, user: ownerUser,
    })
    expect(out.primary).toBeNull()
    expect(out.secondary?.action).toBe('wont_do')
    expect(out.context).toMatch(/Waiting on reviewer/)
  })

  it('owner of task, approved → Mark Complete', () => {
    const out = taskActionState({
      task: { ...taskBase, status: 'approved' }, project: baseProject, user: ownerUser,
    })
    expect(out.primary?.action).toBe('mark_complete')
  })

  it('owner of task, wont_do → Revert', () => {
    const out = taskActionState({
      task: { ...taskBase, status: 'wont_do' }, project: baseProject, user: ownerUser,
    })
    expect(out.primary?.action).toBe('revert')
  })

  it('owner of task, complete → no buttons', () => {
    const out = taskActionState({
      task: { ...taskBase, status: 'complete' }, project: baseProject, user: ownerUser,
    })
    expect(out.primary).toBeNull()
    expect(out.secondary).toBeNull()
  })

  it('reviewer of task, pending_review → Approve + Request Revision', () => {
    const out = taskActionState({
      task: { ...taskBase, status: 'pending_review' }, project: baseProject, user: reviewerUser,
    })
    expect(out.primary?.action).toBe('approve')
    expect(out.secondary?.action).toBe('request_revision')
  })

  it('managing PM acting on someone else\'s task started → Submit (acting as PM)', () => {
    const out = taskActionState({
      task: { ...taskBase, status: 'started' }, project: baseProject, user: pm,
    })
    expect(out.primary?.action).toBe('submit_review')
    expect(out.context).toMatch(/acting as PM/i)
  })

  it('system owner can act as either side', () => {
    const out = taskActionState({
      task: { ...taskBase, status: 'pending_review' }, project: baseProject, user: sysOwner,
    })
    expect(out.primary?.action).toBe('approve')
    expect(out.context).toMatch(/acting as owner/i)
  })

  it('unrelated IC sees view-only', () => {
    const out = taskActionState({
      task: { ...taskBase, status: 'started' }, project: baseProject, user: otherIc,
    })
    expect(out.primary).toBeNull()
    expect(out.secondary).toBeNull()
    expect(out.context).toMatch(/View only/i)
  })

  it('archived/complete project → no actions', () => {
    const out = taskActionState({
      task: { ...taskBase, status: 'started' },
      project: { ...baseProject, status: 'archived' }, user: ownerUser,
    })
    expect(out.primary).toBeNull()
    expect(out.secondary).toBeNull()
  })
})
```

- [ ] **Step 2: Implement**

```ts
// lib/project-page/task-action-state.ts
import type { TaskStatus, ProjectStatus } from '@/db/schema'

export type TaskActionId =
  | 'start' | 'submit_review' | 'mark_complete' | 'wont_do' | 'revert'
  | 'approve' | 'request_revision'

export type TaskActionButton = {
  action: TaskActionId
  label: string
}

export type TaskActionState = {
  primary: TaskActionButton | null
  secondary: TaskActionButton | null
  context: string
}

const NONE: TaskActionState = { primary: null, secondary: null, context: 'View only.' }

export function taskActionState(input: {
  task: { ownerId: string; reviewerId: string | null; status: TaskStatus }
  project: { pmId: string; status: ProjectStatus }
  user: { id: string; role: 'owner' | 'pm' | 'ic' }
}): TaskActionState {
  const { task, project, user } = input

  if (project.status === 'archived' || project.status === 'complete') return NONE

  const isOwnerRole = user.role === 'owner'
  const isManagingPm = user.role === 'pm' && project.pmId === user.id
  const isTaskOwner = task.ownerId === user.id
  const isReviewer = task.reviewerId !== null && task.reviewerId === user.id
  const hasReviewer = task.reviewerId !== null

  const acting =
    isTaskOwner ? '' :
    isReviewer ? '' :
    isManagingPm ? ' (acting as PM)' :
    isOwnerRole ? ' (acting as owner)' :
    ''

  const canActAsOwner = isTaskOwner || isManagingPm || isOwnerRole
  const canActAsReviewer = isReviewer || isManagingPm || isOwnerRole

  // Reviewer-side actions take priority when status=pending_review
  if (task.status === 'pending_review') {
    if (canActAsReviewer) {
      return {
        primary: { action: 'approve', label: 'Approve' },
        secondary: { action: 'request_revision', label: 'Request Revision' },
        context: `Reviewer view${acting}.`,
      }
    }
    if (canActAsOwner) {
      return {
        primary: null,
        secondary: { action: 'wont_do', label: "Won't do" },
        context: `Waiting on reviewer${acting}.`,
      }
    }
    return NONE
  }

  if (!canActAsOwner) return NONE

  switch (task.status) {
    case 'not_started':
      return {
        primary: { action: 'start', label: 'Start' },
        secondary: { action: 'wont_do', label: "Won't do" },
        context: `Begin work${acting}.`,
      }
    case 'started':
      return {
        primary: hasReviewer
          ? { action: 'submit_review', label: 'Submit for Review' }
          : { action: 'mark_complete', label: 'Mark Complete' },
        secondary: { action: 'wont_do', label: "Won't do" },
        context: hasReviewer ? `Ready for review${acting}.` : `Mark this done${acting}.`,
      }
    case 'approved':
      return {
        primary: { action: 'mark_complete', label: 'Mark Complete' },
        secondary: { action: 'wont_do', label: "Won't do" },
        context: `Approved by reviewer${acting}.`,
      }
    case 'complete':
      return { primary: null, secondary: null, context: `Done${acting}.` }
    case 'wont_do':
      return {
        primary: { action: 'revert', label: 'Revert to Not Started' },
        secondary: null,
        context: `Marked won't do${acting}.`,
      }
    default:
      return NONE
  }
}
```

- [ ] **Step 3: Run and commit**

```bash
npm test -- lib/project-page/task-action-state.test.ts
git add lib/project-page/task-action-state.ts lib/project-page/task-action-state.test.ts
git commit -m "feat(project-page): taskActionState drawer button matrix"
```

---

### Task 2.4: `activity-humanize` — event → text

**Files:**
- Create: `lib/project-page/activity-humanize.ts`
- Create: `lib/project-page/activity-humanize.test.ts`

- [ ] **Step 1: Tests**

```ts
// lib/project-page/activity-humanize.test.ts
import { describe, it, expect } from 'vitest'
import { humanizeActivity } from './activity-humanize'

const actor = { id: 'u1', name: 'Mark Chen' }
const taskById = new Map([['t1', 'Apply building permit']])

describe('humanizeActivity', () => {
  it('phase.kicked_off', () => {
    expect(humanizeActivity({
      type: 'phase.kicked_off',
      payload: { phaseName: 'Permitting' },
      actor, taskById,
    }).text).toBe('Mark Chen kicked off the Permitting phase')
  })

  it('phase.marked_complete', () => {
    expect(humanizeActivity({
      type: 'phase.marked_complete',
      payload: { phaseName: 'Construction' },
      actor, taskById,
    }).text).toBe('Mark Chen marked the Construction phase complete')
  })

  it('task.status_changed', () => {
    const out = humanizeActivity({
      type: 'task.status_changed',
      payload: { taskId: 't1', from: 'started', to: 'pending_review' },
      actor, taskById,
    })
    expect(out.text).toContain('Apply building permit')
    expect(out.text).toContain('started')
    expect(out.text).toContain('pending_review')
    expect(out.taskId).toBe('t1')
  })

  it('task.added_unplanned uses payload name when task is freshly added', () => {
    expect(humanizeActivity({
      type: 'task.added_unplanned',
      payload: { taskId: 'tX', name: 'Schedule inspection' },
      actor, taskById,
    }).text).toContain('Schedule inspection')
  })

  it('unknown type falls back gracefully', () => {
    const out = humanizeActivity({
      type: 'something.weird',
      payload: { foo: 'bar' },
      actor, taskById,
    })
    expect(out.text).toContain('Mark Chen')
    expect(out.text).toContain('something.weird')
  })
})
```

- [ ] **Step 2: Implement**

```ts
// lib/project-page/activity-humanize.ts
type Actor = { id: string; name: string }
type Args = {
  type: string
  payload: Record<string, unknown>
  actor: Actor
  taskById: Map<string, string>
}

export type HumanizedActivity = {
  text: string
  taskId: string | null
}

function taskName(payload: Record<string, unknown>, taskById: Map<string, string>): string {
  const id = typeof payload.taskId === 'string' ? payload.taskId : null
  const name = id ? taskById.get(id) : null
  if (typeof payload.name === 'string') return payload.name
  return name ?? '(unknown task)'
}

export function humanizeActivity(args: Args): HumanizedActivity {
  const { type, payload, actor, taskById } = args
  const tid = typeof payload.taskId === 'string' ? payload.taskId : null
  switch (type) {
    case 'phase.kicked_off':
      return { text: `${actor.name} kicked off the ${payload.phaseName} phase`, taskId: null }
    case 'phase.marked_complete':
      return { text: `${actor.name} marked the ${payload.phaseName} phase complete`, taskId: null }
    case 'task.status_changed':
      return { text: `${actor.name} moved “${taskName(payload, taskById)}” from ${payload.from} to ${payload.to}`, taskId: tid }
    case 'task.submitted_for_review':
      return { text: `${actor.name} submitted “${taskName(payload, taskById)}” for review`, taskId: tid }
    case 'task.approved':
      return { text: `${actor.name} approved “${taskName(payload, taskById)}”`, taskId: tid }
    case 'task.revision_requested':
      return { text: `${actor.name} requested revision on “${taskName(payload, taskById)}”`, taskId: tid }
    case 'task.added_unplanned':
      return { text: `${actor.name} added unplanned task “${taskName(payload, taskById)}”`, taskId: tid }
    case 'task.subtask_added':
      return { text: `${actor.name} added a subtask under “${taskName(payload, taskById)}”`, taskId: tid }
    case 'task.reassigned':
      return { text: `${actor.name} reassigned “${taskName(payload, taskById)}”`, taskId: tid }
    default:
      return { text: `${actor.name}: ${type}`, taskId: tid }
  }
}
```

- [ ] **Step 3: Run and commit**

```bash
npm test -- lib/project-page/activity-humanize.test.ts
git add lib/project-page/activity-humanize.ts lib/project-page/activity-humanize.test.ts
git commit -m "feat(project-page): humanizeActivity event → text"
```

---

## Phase 3: New Server Actions

### Task 3.1: `addPlannedTask` service + action

**Files:**
- Modify: `lib/services/task-service.ts` (add method)
- Modify: `app/actions/tasks.ts` (add action)
- Create: `lib/services/task-service.planned.test.ts`

- [ ] **Step 1: Test**

```ts
// lib/services/task-service.planned.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { eq } from 'drizzle-orm'
import { testDb, truncateAll } from '@/tests/db'
import { tasks, taskDeps, projectPhases } from '@/db/schema'
import { seedOwner, seedPm } from '@/tests/fixtures/users'
import { seedTemplate } from '@/tests/fixtures/workflow-templates'
import { projectService } from './project-service'
import { taskService } from './task-service'
import { ProjectLockedError } from '@/lib/server/errors'

async function setup() {
  const owner = await seedOwner()
  const pm = await seedPm()
  const { template } = await seedTemplate({
    createdById: owner.id, name: 'P',
    tasks: [{ name: 'A', durationDays: 1 }], deps: [],
  })
  const project = await projectService.create({
    createdById: pm.id, name: 'X', brand: 'al_homes', pmId: pm.id,
    assignments: [{ phaseName: 'Permitting', templateId: template.id, sortOrder: 0 }],
  }, testDb)
  return { project, pm }
}

describe('addPlannedTask', () => {
  beforeEach(async () => { await truncateAll() })

  it('creates a planned task in draft project', async () => {
    const { project, pm } = await setup()
    const projTasks = await testDb.select().from(tasks).where(eq(tasks.projectId, project.id))
    const workflowId = projTasks[0].projectWorkflowId
    const created = await taskService.addPlannedTask({
      projectId: project.id, projectWorkflowId: workflowId,
      name: 'Extra survey', plannedDurationDays: 3, ownerId: pm.id, actorId: pm.id,
    }, testDb)
    expect(created.isUnplanned).toBe(false)
    const re = await testDb.select().from(tasks).where(eq(tasks.id, created.id))
    expect(re[0].name).toBe('Extra survey')
  })

  it('refuses when project is not draft', async () => {
    const { project, pm } = await setup()
    const phases = await testDb.select().from(projectPhases).where(eq(projectPhases.projectId, project.id))
    const permitting = phases.find(p => p.name === 'Permitting')!
    await (await import('./phase-service')).phaseService
      .kickOff({ phaseId: permitting.id, actorId: pm.id }, testDb)
    const projTasks = await testDb.select().from(tasks).where(eq(tasks.projectId, project.id))
    await expect(taskService.addPlannedTask({
      projectId: project.id, projectWorkflowId: projTasks[0].projectWorkflowId,
      name: 'X', plannedDurationDays: 1, ownerId: pm.id, actorId: pm.id,
    }, testDb)).rejects.toThrow(ProjectLockedError)
  })

  it('adds optional dependencies', async () => {
    const { project, pm } = await setup()
    const projTasks = await testDb.select().from(tasks).where(eq(tasks.projectId, project.id))
    const created = await taskService.addPlannedTask({
      projectId: project.id, projectWorkflowId: projTasks[0].projectWorkflowId,
      name: 'After A', plannedDurationDays: 1, ownerId: pm.id, actorId: pm.id,
      upstreamTaskIds: [projTasks[0].id],
    }, testDb)
    const deps = await testDb.select().from(taskDeps).where(eq(taskDeps.toTaskId, created.id))
    expect(deps).toHaveLength(1)
    expect(deps[0].fromTaskId).toBe(projTasks[0].id)
  })
})
```

- [ ] **Step 2: Implement `addPlannedTask` in service**

Add this method inside the existing `taskService` object in `lib/services/task-service.ts`:

```ts
async addPlannedTask(input: {
  projectId: string
  projectWorkflowId: string
  name: string
  description?: string | null
  plannedDurationDays: number
  ownerId: string
  reviewerId?: string | null
  actorId: string
  upstreamTaskIds?: string[]
  sortOrder?: number
}, db: DB) {
  // Check project is in draft
  const { projects } = await import('@/db/schema')
  const { ProjectLockedError } = await import('@/lib/server/errors')
  const proj = (await db.select().from(projects).where(eq(projects.id, input.projectId)))[0]
  if (!proj) throw new NotFoundError('Project')
  if (proj.status !== 'draft') throw new ProjectLockedError(proj.status)

  return db.transaction(async (tx) => {
    const siblings = await tx.select().from(tasks).where(eq(tasks.projectWorkflowId, input.projectWorkflowId))
    const sortOrder = input.sortOrder ?? (siblings.length === 0 ? 0 : Math.max(...siblings.map(s => s.sortOrder)) + 1)

    const [inserted] = await tx.insert(tasks).values({
      projectId: input.projectId,
      projectWorkflowId: input.projectWorkflowId,
      name: input.name,
      description: input.description ?? null,
      ownerId: input.ownerId,
      reviewerId: input.reviewerId ?? null,
      plannedDurationDays: input.plannedDurationDays,
      isUnplanned: false,
      sortOrder,
    }).returning()

    for (const upstreamId of input.upstreamTaskIds ?? []) {
      await tx.insert(taskDeps).values({
        projectId: input.projectId,
        fromTaskId: upstreamId,
        toTaskId: inserted.id,
        lagDays: 0,
      })
    }

    await tx.insert(activities).values({
      projectId: input.projectId, actorId: input.actorId,
      type: 'task.added_planned', payload: { taskId: inserted.id, name: input.name },
    })

    return inserted
  })
},
```

- [ ] **Step 3: Implement Server Action**

Add to `app/actions/tasks.ts`:

```ts
export async function addPlannedTask(raw: unknown) {
  const input = z.object({
    projectId: z.string().uuid(),
    projectWorkflowId: z.string().uuid(),
    name: z.string().min(1),
    description: z.string().optional().nullable(),
    plannedDurationDays: z.number().int().min(0),
    ownerId: z.string().uuid(),
    reviewerId: z.string().uuid().optional().nullable(),
    upstreamTaskIds: z.array(z.string().uuid()).optional(),
    sortOrder: z.number().int().min(0).optional(),
  }).parse(raw)
  const projRows = await db.select().from(projects).where(eq(projects.id, input.projectId))
  if (projRows.length === 0) throw new NotFoundError('Project')
  const project = projRows[0]
  const user = await requirePermission({
    type: 'task.add_planned',
    project: { pmId: project.pmId, status: project.status },
  })
  const created = await taskService.addPlannedTask({ ...input, actorId: user.id }, db)
  revalidatePath(`/projects/${project.id}`)
  return { ok: true, taskId: created.id }
}
```

- [ ] **Step 4: Run tests, commit**

```bash
npm test -- lib/services/task-service.planned.test.ts
git add lib/services/task-service.ts app/actions/tasks.ts lib/services/task-service.planned.test.ts
git commit -m "feat(service): addPlannedTask for draft-mode task creation"
```

---

### Task 3.2: `updateProjectMetadata` service + action

**Files:**
- Modify: `lib/services/project-service.ts` (add method)
- Modify: `app/actions/projects.ts` (add action)
- Create: `lib/services/project-service.metadata.test.ts`

- [ ] **Step 1: Test**

```ts
// lib/services/project-service.metadata.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { eq } from 'drizzle-orm'
import { testDb, truncateAll } from '@/tests/db'
import { projects, projectPhases } from '@/db/schema'
import { seedOwner, seedPm } from '@/tests/fixtures/users'
import { seedTemplate } from '@/tests/fixtures/workflow-templates'
import { projectService } from './project-service'
import { ProjectLockedError } from '@/lib/server/errors'

async function setup() {
  const owner = await seedOwner()
  const pm = await seedPm()
  const { template } = await seedTemplate({
    createdById: owner.id, name: 'P',
    tasks: [{ name: 'A', durationDays: 1 }], deps: [],
  })
  const project = await projectService.create({
    createdById: pm.id, name: 'X', brand: 'al_homes', pmId: pm.id,
    assignments: [{ phaseName: 'Permitting', templateId: template.id, sortOrder: 0 }],
  }, testDb)
  return { project, pm }
}

describe('updateProjectMetadata', () => {
  beforeEach(async () => { await truncateAll() })

  it('updates always-editable fields in any mutable state', async () => {
    const { project, pm } = await setup()
    await projectService.updateMetadata({
      projectId: project.id, actorId: pm.id,
      patch: { name: 'New Name', address: '12 New St', brand: 'alera' },
    }, testDb)
    const re = await testDb.select().from(projects).where(eq(projects.id, project.id))
    expect(re[0].name).toBe('New Name')
    expect(re[0].brand).toBe('alera')
  })

  it('refuses to update draft-only fields when project is in_progress', async () => {
    const { project, pm } = await setup()
    const phases = await testDb.select().from(projectPhases).where(eq(projectPhases.projectId, project.id))
    await (await import('./phase-service')).phaseService
      .kickOff({ phaseId: phases.find(p => p.sortOrder === 1)!.id, actorId: pm.id }, testDb)
    await expect(projectService.updateMetadata({
      projectId: project.id, actorId: pm.id,
      patch: { targetPermitDate: '2027-01-01' },
    }, testDb)).rejects.toThrow(ProjectLockedError)
  })

  it('allows draft-only fields when still in draft', async () => {
    const { project, pm } = await setup()
    await projectService.updateMetadata({
      projectId: project.id, actorId: pm.id,
      patch: { targetPermitDate: '2027-06-01', purchasePrice: '850000.00' },
    }, testDb)
    const re = await testDb.select().from(projects).where(eq(projects.id, project.id))
    expect(re[0].targetPermitDate).toBe('2027-06-01')
    expect(re[0].purchasePrice).toBe('850000.00')
  })
})
```

- [ ] **Step 2: Implement service method**

Add to `projectService` in `lib/services/project-service.ts`:

```ts
async updateMetadata(input: {
  projectId: string
  actorId: string
  patch: {
    name?: string
    brand?: 'al_homes' | 'alera' | 'apex'
    address?: string | null
    city?: string | null
    state?: string | null
    zip?: string | null
    pmId?: string
    // draft-only fields
    titleHolder?: string | null
    projectStrategy?: string | null
    purchaseDate?: string | null
    purchasePrice?: string | null
    targetExitQuarter?: string | null
    targetProjectDurationDays?: number | null
    targetPermitDate?: string | null
    targetConstructionEndDate?: string | null
  }
}, db: DB) {
  const { ProjectLockedError } = await import('@/lib/server/errors')

  const existing = (await db.select().from(projects).where(eq(projects.id, input.projectId)))[0]
  if (!existing) throw new NotFoundError('Project')
  if (existing.status === 'complete' || existing.status === 'archived') {
    throw new ProjectLockedError(existing.status)
  }

  const DRAFT_ONLY_KEYS = [
    'titleHolder','projectStrategy','purchaseDate','purchasePrice',
    'targetExitQuarter','targetProjectDurationDays','targetPermitDate','targetConstructionEndDate',
  ] as const

  if (existing.status !== 'draft') {
    for (const k of DRAFT_ONLY_KEYS) {
      if (input.patch[k] !== undefined) throw new ProjectLockedError(existing.status)
    }
  }

  // Only include defined fields in the SET
  const setObj: Record<string, unknown> = { updatedAt: new Date() }
  for (const [k, v] of Object.entries(input.patch)) {
    if (v !== undefined) setObj[k] = v
  }
  await db.update(projects).set(setObj).where(eq(projects.id, input.projectId))
},
```

- [ ] **Step 3: Server Action**

Add to `app/actions/projects.ts`:

```ts
export async function updateProjectMetadata(raw: unknown) {
  const PatchSchema = z.object({
    name: z.string().min(1).optional(),
    brand: z.enum(['al_homes','alera','apex']).optional(),
    address: z.string().optional().nullable(),
    city: z.string().optional().nullable(),
    state: z.string().optional().nullable(),
    zip: z.string().optional().nullable(),
    pmId: z.string().uuid().optional(),
    titleHolder: z.string().optional().nullable(),
    projectStrategy: z.string().optional().nullable(),
    purchaseDate: z.string().optional().nullable(),
    purchasePrice: z.string().optional().nullable(),
    targetExitQuarter: z.string().regex(/^\d{4}-Q[1-4]$/).optional().nullable(),
    targetProjectDurationDays: z.number().int().optional().nullable(),
    targetPermitDate: z.string().optional().nullable(),
    targetConstructionEndDate: z.string().optional().nullable(),
  })
  const input = z.object({
    projectId: z.string().uuid(),
    patch: PatchSchema,
  }).parse(raw)
  const project = await projectService.getById(input.projectId, db)
  if (!project) throw new NotFoundError('Project')
  const user = await requirePermission({
    type: 'project.update_meta',
    project: { pmId: project.pmId, status: project.status },
  })
  await projectService.updateMetadata({ ...input, actorId: user.id }, db)
  revalidatePath(`/projects/${input.projectId}`)
  return { ok: true }
}
```

- [ ] **Step 4: Run tests, commit**

```bash
npm test -- lib/services/project-service.metadata.test.ts
git add lib/services/project-service.ts app/actions/projects.ts lib/services/project-service.metadata.test.ts
git commit -m "feat(service): updateProjectMetadata with state-machine guards"
```

---

## Phase 4: Data query layer

### Task 4.1: `getProjectPageData` query

**Files:**
- Create: `db/queries/project-page.ts`
- Create: `db/queries/project-page.test.ts`

- [ ] **Step 1: Test**

```ts
// db/queries/project-page.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { testDb, truncateAll } from '@/tests/db'
import { seedOwner, seedPm, seedIc } from '@/tests/fixtures/users'
import { seedTemplate } from '@/tests/fixtures/workflow-templates'
import { projectService } from '@/lib/services/project-service'
import { getProjectPageData, getProjectActivities, getTaskComments } from './project-page'
import { taskService } from '@/lib/services/task-service'
import { tasks } from '@/db/schema'
import { eq } from 'drizzle-orm'

describe('getProjectPageData', () => {
  beforeEach(async () => { await truncateAll() })

  it('returns project + phases + workflows + tasks + deps + referenced users', async () => {
    const owner = await seedOwner()
    const pm = await seedPm()
    const ic = await seedIc('IC1', 'design')
    const { template } = await seedTemplate({
      createdById: owner.id, name: 'P',
      tasks: [{ name: 'A', durationDays: 2 }, { name: 'B', durationDays: 3 }],
      deps: [{ fromIdx: 0, toIdx: 1 }],
    })
    const project = await projectService.create({
      createdById: pm.id, name: 'X', brand: 'al_homes', pmId: pm.id,
      assignments: [{ phaseName: 'Permitting', templateId: template.id, sortOrder: 0 }],
    }, testDb)
    const allTasks = await testDb.select().from(tasks).where(eq(tasks.projectId, project.id))
    await testDb.update(tasks).set({ ownerId: ic.id }).where(eq(tasks.id, allTasks[0].id))

    const data = await getProjectPageData(testDb, project.id)
    expect(data.project.id).toBe(project.id)
    expect(data.phases).toHaveLength(3)
    expect(data.workflows).toHaveLength(1)
    expect(data.tasks).toHaveLength(2)
    expect(data.taskDeps).toHaveLength(1)
    // referenced users should include both pm and ic
    expect(data.users.find(u => u.id === pm.id)).toBeDefined()
    expect(data.users.find(u => u.id === ic.id)).toBeDefined()
  })

  it('returns null when project does not exist', async () => {
    const data = await getProjectPageData(testDb, '00000000-0000-0000-0000-000000000000')
    expect(data).toBeNull()
  })
})

describe('getProjectActivities', () => {
  beforeEach(async () => { await truncateAll() })

  it('returns activities + actors + referenced tasks', async () => {
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
    await taskService.setStatus({ taskId: task.id, status: 'started', actorId: pm.id }, testDb)

    const out = await getProjectActivities(testDb, project.id, 50)
    expect(out.activities.length).toBeGreaterThan(0)
    expect(out.users.find(u => u.id === pm.id)).toBeDefined()
  })
})
```

- [ ] **Step 2: Implement**

```ts
// db/queries/project-page.ts
import { eq, inArray, desc } from 'drizzle-orm'
import type { DB } from '@/db/client'
import {
  projects, projectPhases, projectWorkflows, tasks, taskDeps, activities, taskComments, users,
  type Project, type ProjectPhase, type ProjectWorkflow, type Task, type TaskDep, type Activity, type TaskComment, type User,
} from '@/db/schema'

export type ProjectPageData = {
  project: Project
  phases: ProjectPhase[]
  workflows: ProjectWorkflow[]
  tasks: Task[]
  taskDeps: TaskDep[]
  users: User[]
}

export async function getProjectPageData(db: DB, projectId: string): Promise<ProjectPageData | null> {
  const projectRows = await db.select().from(projects).where(eq(projects.id, projectId))
  if (projectRows.length === 0) return null
  const project = projectRows[0]

  const [phaseRows, workflowRows, taskRows, depRows] = await Promise.all([
    db.select().from(projectPhases).where(eq(projectPhases.projectId, projectId)),
    db.select().from(projectWorkflows).where(eq(projectWorkflows.projectId, projectId)),
    db.select().from(tasks).where(eq(tasks.projectId, projectId)),
    db.select().from(taskDeps).where(eq(taskDeps.projectId, projectId)),
  ])

  const userIds = new Set<string>([project.pmId, project.createdById])
  for (const t of taskRows) {
    userIds.add(t.ownerId)
    if (t.reviewerId) userIds.add(t.reviewerId)
  }
  const userRows = userIds.size === 0
    ? []
    : await db.select().from(users).where(inArray(users.id, Array.from(userIds)))

  return {
    project, phases: phaseRows, workflows: workflowRows,
    tasks: taskRows, taskDeps: depRows, users: userRows,
  }
}

export type ProjectActivitiesData = {
  activities: Activity[]
  users: User[]
  tasks: Task[]
}

export async function getProjectActivities(db: DB, projectId: string, limit = 100): Promise<ProjectActivitiesData> {
  const acts = await db.select().from(activities)
    .where(eq(activities.projectId, projectId))
    .orderBy(desc(activities.createdAt))
    .limit(limit)
  if (acts.length === 0) return { activities: [], users: [], tasks: [] }

  const actorIds = Array.from(new Set(acts.map(a => a.actorId)))
  const taskIds = Array.from(new Set(
    acts
      .map(a => (a.payload as { taskId?: string })?.taskId)
      .filter((id): id is string => typeof id === 'string'),
  ))
  const [actorRows, taskRows] = await Promise.all([
    db.select().from(users).where(inArray(users.id, actorIds)),
    taskIds.length === 0 ? Promise.resolve([]) : db.select().from(tasks).where(inArray(tasks.id, taskIds)),
  ])
  return { activities: acts, users: actorRows, tasks: taskRows }
}

export async function getTaskComments(db: DB, taskId: string): Promise<{ comments: TaskComment[]; users: User[] }> {
  const rows = await db.select().from(taskComments)
    .where(eq(taskComments.taskId, taskId))
    .orderBy(desc(taskComments.createdAt))
  if (rows.length === 0) return { comments: [], users: [] }
  const userIds = Array.from(new Set(rows.map(r => r.authorId)))
  const userRows = await db.select().from(users).where(inArray(users.id, userIds))
  return { comments: rows, users: userRows }
}
```

- [ ] **Step 3: Run and commit**

```bash
npm test -- db/queries/project-page.test.ts
git add db/queries/project-page.ts db/queries/project-page.test.ts
git commit -m "feat(db): project page data queries (page, activities, comments)"
```

---

## Phase 5: Header summary + Edit Metadata Dialog

### Task 5.1: `<HeaderSummary />` server component

**Files:**
- Create: `components/project/header-summary.tsx`

- [ ] **Step 1: Implement**

```tsx
// components/project/header-summary.tsx
import type { Project, User } from '@/db/schema'
import { EditMetadataButton } from './edit-metadata-button'

const STATUS_COLORS: Record<Project['status'], string> = {
  draft: 'text-zinc-600',
  in_progress: 'text-blue-600',
  complete: 'text-emerald-600',
  archived: 'text-zinc-400',
}

const STATUS_LABEL: Record<Project['status'], string> = {
  draft: 'Draft', in_progress: 'In Progress', complete: 'Complete', archived: 'Archived',
}

function formatCurrency(n: string | null): string {
  if (!n) return '—'
  const num = Number(n)
  if (Number.isNaN(num)) return '—'
  return `$${num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function f(v: unknown): string {
  return v == null || v === '' ? '—' : String(v)
}

export function HeaderSummary({ project, pm }: { project: Project; pm: User | undefined }) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4">
      <div className="flex items-baseline gap-3 flex-wrap">
        <strong className="text-xl">{project.name}</strong>
        <span className="text-zinc-500 text-sm">
          {project.city ?? '—'}{project.state ? `, ${project.state}` : ''}
        </span>
        <span className="bg-gradient-to-r from-cyan-500 to-blue-500 text-white text-xs px-2 py-0.5 rounded">
          {project.brand}
        </span>
        <span className={`ml-auto text-sm ${STATUS_COLORS[project.status]}`}>
          ● {STATUS_LABEL[project.status]}
        </span>
        <EditMetadataButton project={project} />
      </div>
      <div className="mt-2 flex gap-4 flex-wrap text-sm text-zinc-600">
        <span>PM: {f(pm?.name)}</span>
        <span>Purchased: {f(project.purchaseDate)} · {formatCurrency(project.purchasePrice)}</span>
        <span>Target Permit: {f(project.targetPermitDate)}</span>
        <span>Target Construction End: {f(project.targetConstructionEndDate)}</span>
        <span>Target Exit: {f(project.targetExitQuarter)}</span>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Commit (EditMetadataButton imported from next task; build will fail until 5.2 ships)**

```bash
git add components/project/header-summary.tsx
git commit -m "feat(project-page): HeaderSummary component"
```

---

### Task 5.2: `<EditMetadataButton />` + dialog

**Files:**
- Create: `components/project/edit-metadata-button.tsx`
- Create: `components/project/edit-metadata-dialog.tsx`
- Modify: `package.json` (add `@radix-ui/react-dialog`)

- [ ] **Step 1: Install Radix Dialog**

```bash
npm install @radix-ui/react-dialog
```

- [ ] **Step 2: Write `components/project/edit-metadata-button.tsx`**

```tsx
'use client'
import { useState } from 'react'
import { usePermissions } from '@/lib/hooks/use-permissions'
import type { Project } from '@/db/schema'
import { EditMetadataDialog } from './edit-metadata-dialog'

export function EditMetadataButton({ project }: { project: Project }) {
  const [open, setOpen] = useState(false)
  const { can } = usePermissions()
  if (!can({ type: 'project.update_meta', project: { pmId: project.pmId, status: project.status } })) return null
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="bg-white text-zinc-700 border border-zinc-300 px-3 py-1 rounded text-xs hover:bg-zinc-50"
      >
        Edit
      </button>
      {open && <EditMetadataDialog project={project} onClose={() => setOpen(false)} />}
    </>
  )
}
```

- [ ] **Step 3: Write `components/project/edit-metadata-dialog.tsx`**

```tsx
'use client'
import * as Dialog from '@radix-ui/react-dialog'
import { useState, type ReactNode } from 'react'
import { usePermissions } from '@/lib/hooks/use-permissions'
import { updateProjectMetadata, unlockProjectToDraft, forceReassignPm } from '@/app/actions/projects'
import type { Project } from '@/db/schema'

export function EditMetadataDialog({ project, onClose }: { project: Project; onClose: () => void }) {
  const [form, setForm] = useState({
    name: project.name,
    brand: project.brand,
    address: project.address ?? '',
    city: project.city ?? '',
    state: project.state ?? '',
    zip: project.zip ?? '',
    titleHolder: project.titleHolder ?? '',
    projectStrategy: project.projectStrategy ?? '',
    purchaseDate: project.purchaseDate ?? '',
    purchasePrice: project.purchasePrice ?? '',
    targetExitQuarter: project.targetExitQuarter ?? '',
    targetProjectDurationDays: project.targetProjectDurationDays ?? '',
    targetPermitDate: project.targetPermitDate ?? '',
    targetConstructionEndDate: project.targetConstructionEndDate ?? '',
  })
  const [err, setErr] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const { user } = usePermissions()

  const isDraft = project.status === 'draft'
  const draftOnlyDisabled = !isDraft

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    setSubmitting(true)
    try {
      const patch: Record<string, unknown> = {
        name: form.name, brand: form.brand,
        address: form.address || null, city: form.city || null,
        state: form.state || null, zip: form.zip || null,
      }
      if (isDraft) {
        patch.titleHolder = form.titleHolder || null
        patch.projectStrategy = form.projectStrategy || null
        patch.purchaseDate = form.purchaseDate || null
        patch.purchasePrice = form.purchasePrice || null
        patch.targetExitQuarter = form.targetExitQuarter || null
        patch.targetProjectDurationDays = form.targetProjectDurationDays === '' ? null : Number(form.targetProjectDurationDays)
        patch.targetPermitDate = form.targetPermitDate || null
        patch.targetConstructionEndDate = form.targetConstructionEndDate || null
      }
      await updateProjectMetadata({ projectId: project.id, patch })
      onClose()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Update failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog.Root open onOpenChange={(o) => { if (!o) onClose() }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/30" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] max-h-[90vh] overflow-y-auto bg-white rounded-lg p-6 shadow-xl">
          <Dialog.Title className="text-lg font-semibold">Edit project</Dialog.Title>
          <form onSubmit={onSubmit} className="mt-4 space-y-3">
            <Field label="Name"><input value={form.name} onChange={(e) => setForm(s => ({ ...s, name: e.target.value }))} className="w-full border rounded px-2 py-1 text-sm" required /></Field>
            <Field label="Brand">
              <select value={form.brand} onChange={(e) => setForm(s => ({ ...s, brand: e.target.value as Project['brand'] }))} className="w-full border rounded px-2 py-1 text-sm">
                <option value="al_homes">Al Homes</option>
                <option value="alera">Alera</option>
                <option value="apex">Apex</option>
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Address"><input value={form.address} onChange={(e) => setForm(s => ({ ...s, address: e.target.value }))} className="w-full border rounded px-2 py-1 text-sm" /></Field>
              <Field label="City"><input value={form.city} onChange={(e) => setForm(s => ({ ...s, city: e.target.value }))} className="w-full border rounded px-2 py-1 text-sm" /></Field>
              <Field label="State"><input value={form.state} onChange={(e) => setForm(s => ({ ...s, state: e.target.value }))} className="w-full border rounded px-2 py-1 text-sm" /></Field>
              <Field label="Zip"><input value={form.zip} onChange={(e) => setForm(s => ({ ...s, zip: e.target.value }))} className="w-full border rounded px-2 py-1 text-sm" /></Field>
            </div>

            <h3 className="text-sm font-medium pt-3">Targets {!isDraft && <span className="text-xs text-zinc-500 font-normal">(locked after kick-off)</span>}</h3>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Title holder"><input disabled={draftOnlyDisabled} value={form.titleHolder} onChange={(e) => setForm(s => ({ ...s, titleHolder: e.target.value }))} className="w-full border rounded px-2 py-1 text-sm disabled:bg-zinc-100" /></Field>
              <Field label="Strategy"><input disabled={draftOnlyDisabled} value={form.projectStrategy} onChange={(e) => setForm(s => ({ ...s, projectStrategy: e.target.value }))} className="w-full border rounded px-2 py-1 text-sm disabled:bg-zinc-100" /></Field>
              <Field label="Purchase date"><input type="date" disabled={draftOnlyDisabled} value={form.purchaseDate} onChange={(e) => setForm(s => ({ ...s, purchaseDate: e.target.value }))} className="w-full border rounded px-2 py-1 text-sm disabled:bg-zinc-100" /></Field>
              <Field label="Purchase price ($)"><input disabled={draftOnlyDisabled} value={form.purchasePrice} onChange={(e) => setForm(s => ({ ...s, purchasePrice: e.target.value }))} className="w-full border rounded px-2 py-1 text-sm disabled:bg-zinc-100" /></Field>
              <Field label="Target exit quarter (YYYY-Qn)"><input disabled={draftOnlyDisabled} value={form.targetExitQuarter} onChange={(e) => setForm(s => ({ ...s, targetExitQuarter: e.target.value }))} placeholder="2026-Q3" className="w-full border rounded px-2 py-1 text-sm disabled:bg-zinc-100" /></Field>
              <Field label="Target duration (days)"><input type="number" disabled={draftOnlyDisabled} value={form.targetProjectDurationDays} onChange={(e) => setForm(s => ({ ...s, targetProjectDurationDays: e.target.value }))} className="w-full border rounded px-2 py-1 text-sm disabled:bg-zinc-100" /></Field>
              <Field label="Target permit date"><input type="date" disabled={draftOnlyDisabled} value={form.targetPermitDate} onChange={(e) => setForm(s => ({ ...s, targetPermitDate: e.target.value }))} className="w-full border rounded px-2 py-1 text-sm disabled:bg-zinc-100" /></Field>
              <Field label="Target construction end"><input type="date" disabled={draftOnlyDisabled} value={form.targetConstructionEndDate} onChange={(e) => setForm(s => ({ ...s, targetConstructionEndDate: e.target.value }))} className="w-full border rounded px-2 py-1 text-sm disabled:bg-zinc-100" /></Field>
            </div>

            {err && <div className="text-red-600 text-sm">{err}</div>}

            <div className="flex gap-2 pt-3">
              <button type="button" onClick={onClose} className="px-3 py-1.5 border rounded text-sm">Cancel</button>
              <button type="submit" disabled={submitting} className="ml-auto px-4 py-1.5 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded text-sm hover:opacity-90 disabled:opacity-50">Save</button>
            </div>
          </form>

          {user?.role === 'owner' && <OwnerOverrides project={project} onClose={onClose} />}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="text-xs text-zinc-600">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  )
}

function OwnerOverrides({ project, onClose }: { project: Project; onClose: () => void }) {
  const [unlockReason, setUnlockReason] = useState('')
  const [err, setErr] = useState<string | null>(null)

  async function doUnlock() {
    setErr(null)
    if (!unlockReason.trim()) { setErr('Reason required'); return }
    try {
      await unlockProjectToDraft({ projectId: project.id, reason: unlockReason })
      onClose()
    } catch (e) { setErr(e instanceof Error ? e.message : 'failed') }
  }

  return (
    <div className="mt-6 pt-4 border-t-2 border-red-200">
      <div className="text-xs font-semibold text-red-700 uppercase">Owner overrides</div>
      <div className="mt-2 text-sm">
        <div className="text-xs text-zinc-600">Unlock to Draft (requires reason)</div>
        <textarea value={unlockReason} onChange={(e) => setUnlockReason(e.target.value)} className="w-full border rounded px-2 py-1 text-sm mt-1" rows={2} />
        <button onClick={doUnlock} className="mt-2 px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700">Unlock to Draft</button>
        {err && <div className="text-red-600 text-xs mt-1">{err}</div>}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add components/project/edit-metadata-button.tsx components/project/edit-metadata-dialog.tsx package.json package-lock.json
git commit -m "feat(project-page): edit metadata dialog with state-gated fields + owner overrides"
```

---

## Phase 6: Page shell + Tabs

### Task 6.1: Tabs client component with URL sync

**Files:**
- Create: `components/project/tabs.tsx`

- [ ] **Step 1: Implement**

```tsx
// components/project/tabs.tsx
'use client'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

const TABS = [
  { id: 'permitting', label: 'Permitting' },
  { id: 'construction', label: 'Construction' },
  { id: 'sale', label: 'Sale' },
  { id: 'activity', label: 'Activity', separate: true },
] as const

export type TabId = typeof TABS[number]['id']

export function Tabs({ current }: { current: TabId }) {
  const params = useSearchParams()
  return (
    <div className="border-b border-zinc-200 flex gap-6 mt-4">
      {TABS.map((t, i) => {
        const next = new URLSearchParams(params)
        next.set('tab', t.id)
        const isActive = t.id === current
        return (
          <Link
            key={t.id}
            href={`?${next.toString()}`}
            className={[
              'py-2',
              isActive ? 'border-b-2 border-blue-500 font-semibold text-blue-600' : 'text-zinc-600',
              t.separate ? 'ml-auto border-l border-zinc-200 pl-4' : '',
            ].join(' ')}
            scroll={false}
          >
            {t.label}
          </Link>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/project/tabs.tsx
git commit -m "feat(project-page): tabs with URL sync"
```

---

### Task 6.2: Page shell — `page.tsx`, `loading.tsx`, `error.tsx`

**Files:**
- Modify: `app/(app)/projects/[id]/page.tsx` (replace foundation stub)
- Create: `app/(app)/projects/[id]/loading.tsx`
- Create: `app/(app)/projects/[id]/error.tsx`

- [ ] **Step 1: Replace `app/(app)/projects/[id]/page.tsx`**

```tsx
// app/(app)/projects/[id]/page.tsx
import { notFound } from 'next/navigation'
import { db } from '@/db/client'
import { getProjectPageData } from '@/db/queries/project-page'
import { HeaderSummary } from '@/components/project/header-summary'
import { Tabs, type TabId } from '@/components/project/tabs'
import { PhaseContent } from '@/components/project/phase-content'
import { ActivityFeed } from '@/components/project/activity-feed'
import { TaskDrawer } from '@/components/project/task-drawer'

const VALID_TABS: TabId[] = ['permitting', 'construction', 'sale', 'activity']

export default async function ProjectDetailPage({
  params, searchParams,
}: {
  params: { id: string }
  searchParams: { tab?: string; task?: string }
}) {
  const data = await getProjectPageData(db, params.id)
  if (!data) notFound()

  const pmUser = data.users.find(u => u.id === data.project.pmId)
  const requestedTab = (VALID_TABS as readonly string[]).includes(searchParams.tab ?? '')
    ? (searchParams.tab as TabId)
    : null
  const defaultTab: TabId = (
    data.phases.find(p => p.status === 'in_progress')?.name.toLowerCase()
    ?? data.phases.find(p => p.status === 'pending')?.name.toLowerCase()
    ?? 'permitting'
  ) as TabId
  const tab: TabId = requestedTab ?? defaultTab

  return (
    <div className="space-y-4">
      <HeaderSummary project={data.project} pm={pmUser} />
      <Tabs current={tab} />

      {tab === 'activity' ? (
        <ActivityFeed projectId={data.project.id} />
      ) : (
        <PhaseContent
          phaseName={tab === 'permitting' ? 'Permitting' : tab === 'construction' ? 'Construction' : 'Sale'}
          data={data}
        />
      )}

      {searchParams.task && (
        <TaskDrawer projectId={data.project.id} taskId={searchParams.task} initialData={data} />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create `loading.tsx`**

```tsx
// app/(app)/projects/[id]/loading.tsx
export default function Loading() {
  return (
    <div className="space-y-4">
      <div className="h-24 bg-white border border-zinc-200 rounded animate-pulse" />
      <div className="h-10 border-b border-zinc-200" />
      <div className="h-12 bg-zinc-100 rounded animate-pulse" />
      <div className="h-48 bg-white border border-zinc-200 rounded animate-pulse" />
      <div className="h-32 bg-white border border-zinc-200 rounded animate-pulse" />
    </div>
  )
}
```

- [ ] **Step 3: Create `error.tsx`**

```tsx
// app/(app)/projects/[id]/error.tsx
'use client'
export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="p-6 max-w-lg">
      <h1 className="text-lg font-semibold">Something went wrong loading this project</h1>
      <p className="text-sm text-zinc-600 mt-2">{error.message}</p>
      <button onClick={reset} className="mt-4 px-3 py-1.5 border rounded text-sm">Try again</button>
    </div>
  )
}
```

- [ ] **Step 4: Commit (build will fail until later phases provide PhaseContent, ActivityFeed, TaskDrawer; that's expected)**

```bash
git add "app/(app)/projects/[id]/"
git commit -m "feat(project-page): page shell with header, tabs, loading, error"
```

---

## Phase 7: Phase content (Action bar + Task list)

### Task 7.1: `<ActionBar />` with confirm modal

**Files:**
- Create: `components/project/action-bar.tsx`

- [ ] **Step 1: Implement**

```tsx
// components/project/action-bar.tsx
'use client'
import { useState } from 'react'
import { kickOffPhase, markPhaseComplete } from '@/app/actions/phases'
import type { ProjectPhase } from '@/db/schema'
import { usePermissions } from '@/lib/hooks/use-permissions'
import { phaseActionState } from '@/lib/project-page/phase-action-state'

export function ActionBar({
  phase, project, allPhases, openTasksInPhase,
}: {
  phase: ProjectPhase
  project: { id: string; pmId: string; status: 'draft'|'in_progress'|'complete'|'archived' }
  allPhases: ProjectPhase[]
  openTasksInPhase: number   // count of non-terminal tasks for confirm modal
}) {
  const { can } = usePermissions()
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const earlier = allPhases.filter(p => p.sortOrder < phase.sortOrder)
  const state = phaseActionState(phase, earlier)

  const canKickOff = can({ type: 'project.kick_off_phase', project })
  const canMarkComplete = can({ type: 'project.mark_phase_complete', project })

  const visible = state.visible && (
    state.action === 'kick_off' ? canKickOff : canMarkComplete
  )

  async function perform() {
    setBusy(true)
    setErr(null)
    try {
      if (state.action === 'kick_off') await kickOffPhase({ phaseId: phase.id })
      if (state.action === 'mark_complete') await markPhaseComplete({ phaseId: phase.id })
      setConfirming(false)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'failed')
    } finally { setBusy(false) }
  }

  const PHASE_STATUS_COLORS = {
    pending: 'text-zinc-500',
    in_progress: 'text-blue-600',
    complete: 'text-emerald-600',
  } as const

  return (
    <div className="rounded-lg bg-zinc-100 px-3 py-2 flex items-center gap-3">
      <strong>{phase.name} phase</strong>
      <span className={`text-xs ${PHASE_STATUS_COLORS[phase.status]}`}>● {phase.status.replace('_', ' ')}</span>

      {visible && (
        <button
          onClick={() => {
            if (state.action === 'mark_complete' && openTasksInPhase > 0) setConfirming(true)
            else perform()
          }}
          disabled={!state.enabled || busy}
          title={state.disabledReason ?? undefined}
          className={[
            'ml-auto px-3 py-1.5 rounded text-sm text-white',
            state.enabled ? 'bg-gradient-to-r from-cyan-500 to-blue-500 hover:opacity-90' : 'bg-zinc-300 cursor-not-allowed',
          ].join(' ')}
        >
          {state.label}
        </button>
      )}

      {confirming && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setConfirming(false)}>
          <div className="bg-white rounded-lg p-6 max-w-md" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-semibold">Mark phase complete?</h2>
            <p className="text-sm text-zinc-600 mt-2">
              {openTasksInPhase} task{openTasksInPhase === 1 ? '' : 's'} in this phase still {openTasksInPhase === 1 ? 'has' : 'have'} not finished. Mark complete anyway?
            </p>
            {err && <div className="text-red-600 text-sm mt-2">{err}</div>}
            <div className="flex gap-2 mt-4">
              <button onClick={() => setConfirming(false)} className="border rounded px-3 py-1.5 text-sm">Cancel</button>
              <button onClick={perform} disabled={busy} className="ml-auto bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded px-3 py-1.5 text-sm">Yes, mark complete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/project/action-bar.tsx
git commit -m "feat(project-page): phase action bar with confirm modal"
```

---

### Task 7.2: `<TaskList />` + `<TaskRow />`

**Files:**
- Create: `components/project/task-list.tsx`
- Create: `components/project/task-row.tsx`
- Create: `components/project/add-task-button.tsx`

- [ ] **Step 1: `components/project/task-row.tsx`**

```tsx
// components/project/task-row.tsx
import Link from 'next/link'
import type { Task, User } from '@/db/schema'
import { currentTaskStatus } from '@/lib/project-page/current-task-status'

const LEVEL_STYLES = {
  on_track: { icon: '🟢', color: 'text-emerald-600' },
  at_risk: { icon: '🟠', color: 'text-amber-600' },
  delay: { icon: '🔴', color: 'text-red-600' },
} as const

export function TaskRow({
  task, owner, todayDayOffset, urlSearch,
}: {
  task: Task
  owner: User | undefined
  todayDayOffset: number
  urlSearch: URLSearchParams
}) {
  const { level, daysBehind } = currentTaskStatus(
    { status: task.status, isBlocked: task.isBlocked, plannedEndDay: task.plannedEndDay },
    todayDayOffset,
  )
  const style = LEVEL_STYLES[level]
  const label = level === 'delay' ? `delay ${daysBehind}d` : level === 'at_risk' ? 'at risk' : 'on track'

  const next = new URLSearchParams(urlSearch)
  next.set('task', task.id)

  return (
    <Link href={`?${next.toString()}`} scroll={false} className="block px-3 py-2 hover:bg-zinc-50 border-b border-zinc-100 last:border-0">
      <div className={`flex items-center gap-3 text-sm ${style.color}`}>
        <span>{style.icon}</span>
        <span className="w-24 shrink-0">{label}</span>
        <span className="flex-1 truncate">{task.name}{task.isUnplanned && <span className="ml-2 text-xs px-1.5 py-0.5 bg-red-100 text-red-700 rounded">unplanned</span>}</span>
        <span className="text-zinc-600">{owner?.name ?? '—'}</span>
      </div>
    </Link>
  )
}
```

- [ ] **Step 2: `components/project/task-list.tsx`**

```tsx
// components/project/task-list.tsx
import type { Task, User } from '@/db/schema'
import { TaskRow } from './task-row'
import { AddTaskButton } from './add-task-button'

export function TaskList({
  phaseName, tasks, users, project, todayDayOffset, workflowIds, urlSearch,
}: {
  phaseName: 'Permitting' | 'Construction' | 'Sale'
  tasks: Task[]
  users: User[]
  project: { id: string; pmId: string; status: 'draft'|'in_progress'|'complete'|'archived' }
  todayDayOffset: number
  workflowIds: string[]    // workflows belonging to this phase
  urlSearch: URLSearchParams
}) {
  const phaseTasks = tasks.filter(t => workflowIds.includes(t.projectWorkflowId))
  const userById = new Map(users.map(u => [u.id, u]))

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-3">
      <div className="flex items-center mb-2">
        <div className="text-xs uppercase text-zinc-600">Tasks in {phaseName} ({phaseTasks.length})</div>
        <AddTaskButton project={project} phaseName={phaseName} workflowIds={workflowIds} />
      </div>
      <div className="max-h-64 overflow-auto border border-zinc-100 rounded">
        {phaseTasks.length === 0 ? (
          <div className="p-6 text-center text-sm text-zinc-500">No tasks in this phase yet.</div>
        ) : (
          phaseTasks.map(t => (
            <TaskRow key={t.id} task={t} owner={userById.get(t.ownerId)} todayDayOffset={todayDayOffset} urlSearch={urlSearch} />
          ))
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: `components/project/add-task-button.tsx` (stub — full dialog in Phase 10)**

```tsx
// components/project/add-task-button.tsx
'use client'
import { useState } from 'react'
import { usePermissions } from '@/lib/hooks/use-permissions'
import { AddTaskDialog } from './add-task-dialog'

export function AddTaskButton({
  project, phaseName, workflowIds,
}: {
  project: { id: string; pmId: string; status: 'draft'|'in_progress'|'complete'|'archived' }
  phaseName: 'Permitting' | 'Construction' | 'Sale'
  workflowIds: string[]
}) {
  const [open, setOpen] = useState(false)
  const { can } = usePermissions()
  const isDraft = project.status === 'draft'
  const canAddPlanned = can({ type: 'task.add_planned', project })
  const canAddUnplanned = can({ type: 'task.add_unplanned', project })
  if (isDraft ? !canAddPlanned : !canAddUnplanned) return null

  return (
    <>
      <button onClick={() => setOpen(true)} className="ml-auto bg-white border border-zinc-300 rounded px-2 py-1 text-xs hover:bg-zinc-50">
        {isDraft ? '+ Add task' : '+ Add unplanned task'}
      </button>
      {open && <AddTaskDialog project={project} phaseName={phaseName} workflowIds={workflowIds} onClose={() => setOpen(false)} />}
    </>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add components/project/task-list.tsx components/project/task-row.tsx components/project/add-task-button.tsx
git commit -m "feat(project-page): task list + row + add-task button shell"
```

---

### Task 7.3: `<PhaseContent />` orchestrator

**Files:**
- Create: `components/project/phase-content.tsx`

- [ ] **Step 1: Implement**

```tsx
// components/project/phase-content.tsx
import { ActionBar } from './action-bar'
import { GanttChart } from './gantt/gantt-chart'
import { TaskList } from './task-list'
import type { ProjectPageData } from '@/db/queries/project-page'

export function PhaseContent({
  phaseName, data,
}: {
  phaseName: 'Permitting' | 'Construction' | 'Sale'
  data: ProjectPageData
}) {
  const phase = data.phases.find(p => p.name === phaseName)
  if (!phase) return <div className="p-6 text-sm text-zinc-500">Phase not found.</div>

  const phaseWorkflows = data.workflows.filter(w => w.projectPhaseId === phase.id)
  const phaseWorkflowIds = phaseWorkflows.map(w => w.id)
  const phaseTasks = data.tasks.filter(t => phaseWorkflowIds.includes(t.projectWorkflowId))
  const openCount = phaseTasks.filter(t => t.status !== 'complete' && t.status !== 'wont_do').length

  const today = new Date()
  const kickoff = data.project.kickedOffAt ? new Date(data.project.kickedOffAt) : today
  const todayDayOffset = Math.max(0, Math.floor((today.getTime() - kickoff.getTime()) / (24 * 60 * 60 * 1000)))

  // Empty URL search baseline (server side) — client TaskRow uses real params on its href construction
  const urlSearch = new URLSearchParams()
  urlSearch.set('tab', phaseName.toLowerCase())

  return (
    <div className="space-y-3">
      <ActionBar
        phase={phase}
        project={data.project}
        allPhases={data.phases}
        openTasksInPhase={openCount}
      />
      <GanttChart
        tasks={phaseTasks}
        workflows={phaseWorkflows}
        taskDeps={data.taskDeps.filter(d => phaseTasks.some(t => t.id === d.fromTaskId || t.id === d.toTaskId))}
        todayDayOffset={todayDayOffset}
      />
      <TaskList
        phaseName={phaseName}
        tasks={data.tasks}
        users={data.users}
        project={data.project}
        todayDayOffset={todayDayOffset}
        workflowIds={phaseWorkflowIds}
        urlSearch={urlSearch}
      />
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/project/phase-content.tsx
git commit -m "feat(project-page): PhaseContent orchestrator"
```

---

## Phase 8: Gantt chart

### Task 8.1: `gantt-layout` pure function

**Files:**
- Create: `components/project/gantt/gantt-layout.ts`
- Create: `components/project/gantt/gantt-layout.test.ts`

- [ ] **Step 1: Tests**

```ts
// components/project/gantt/gantt-layout.test.ts
import { describe, it, expect } from 'vitest'
import { computeGanttLayout } from './gantt-layout'

describe('computeGanttLayout', () => {
  it('handles week zoom: 1 day = 14px', () => {
    const layout = computeGanttLayout({
      zoom: 'week',
      minDay: 0, maxDay: 30,
      tasks: [{ id: 't1', start: 0, end: 5 }],
    })
    expect(layout.dayWidth).toBe(14)
    expect(layout.totalWidth).toBe(30 * 14)
    expect(layout.taskX[0]).toEqual({ id: 't1', x: 0, width: 70 })
  })

  it('handles month zoom: 1 day = 6px', () => {
    const layout = computeGanttLayout({
      zoom: 'month', minDay: 0, maxDay: 90,
      tasks: [{ id: 't1', start: 30, end: 45 }],
    })
    expect(layout.dayWidth).toBe(6)
    expect(layout.taskX[0]).toEqual({ id: 't1', x: 180, width: 90 })
  })

  it('handles quarter zoom: 1 day = 2px', () => {
    const layout = computeGanttLayout({
      zoom: 'quarter', minDay: 0, maxDay: 180,
      tasks: [{ id: 't1', start: 90, end: 100 }],
    })
    expect(layout.dayWidth).toBe(2)
    expect(layout.taskX[0]).toEqual({ id: 't1', x: 180, width: 20 })
  })

  it('uses minimum width when task has 0 duration', () => {
    const layout = computeGanttLayout({
      zoom: 'week', minDay: 0, maxDay: 10,
      tasks: [{ id: 't1', start: 5, end: 5 }],
    })
    expect(layout.taskX[0].width).toBeGreaterThanOrEqual(4)
  })
})
```

- [ ] **Step 2: Implement**

```ts
// components/project/gantt/gantt-layout.ts
export type Zoom = 'week' | 'month' | 'quarter'

const DAY_WIDTH: Record<Zoom, number> = { week: 14, month: 6, quarter: 2 }
const MIN_BAR_WIDTH = 4

export type GanttLayoutInput = {
  zoom: Zoom
  minDay: number
  maxDay: number
  tasks: Array<{ id: string; start: number; end: number }>
}

export type GanttLayout = {
  dayWidth: number
  totalWidth: number
  taskX: Array<{ id: string; x: number; width: number }>
}

export function computeGanttLayout(input: GanttLayoutInput): GanttLayout {
  const dayWidth = DAY_WIDTH[input.zoom]
  const totalWidth = (input.maxDay - input.minDay) * dayWidth
  const taskX = input.tasks.map(t => ({
    id: t.id,
    x: (t.start - input.minDay) * dayWidth,
    width: Math.max(MIN_BAR_WIDTH, (t.end - t.start) * dayWidth),
  }))
  return { dayWidth, totalWidth, taskX }
}
```

- [ ] **Step 3: Run and commit**

```bash
npm test -- components/project/gantt/gantt-layout.test.ts
git add components/project/gantt/gantt-layout.ts components/project/gantt/gantt-layout.test.ts
git commit -m "feat(gantt): computeGanttLayout pure function"
```

---

### Task 8.2: `<GanttChart />` SVG renderer

**Files:**
- Create: `components/project/gantt/gantt-chart.tsx`
- Create: `components/project/gantt/gantt-types.ts`

- [ ] **Step 1: Types**

```ts
// components/project/gantt/gantt-types.ts
export type { Zoom } from './gantt-layout'
```

- [ ] **Step 2: Component**

```tsx
// components/project/gantt/gantt-chart.tsx
'use client'
import { useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import type { Task, ProjectWorkflow, TaskDep } from '@/db/schema'
import { computeGanttLayout, type Zoom } from './gantt-layout'

const ROW_HEIGHT = 22
const HEADER_HEIGHT = 30

export function GanttChart({
  tasks, workflows, taskDeps, todayDayOffset,
}: {
  tasks: Task[]
  workflows: ProjectWorkflow[]
  taskDeps: TaskDep[]
  todayDayOffset: number
}) {
  const router = useRouter()
  const search = useSearchParams()
  const [zoom, setZoom] = useState<Zoom>('month')

  const rows = useMemo(() => {
    const list: Array<{ kind: 'workflow'; workflow: ProjectWorkflow } | { kind: 'task'; task: Task }> = []
    for (const w of workflows) {
      list.push({ kind: 'workflow', workflow: w })
      for (const t of tasks.filter(t => t.projectWorkflowId === w.id && t.parentTaskId === null)) {
        list.push({ kind: 'task', task: t })
      }
    }
    return list
  }, [workflows, tasks])

  const validTasks = tasks.filter(t => t.plannedStartDay !== null && t.plannedEndDay !== null)
  const minDay = validTasks.length === 0 ? 0 : Math.min(...validTasks.map(t => t.plannedStartDay!), todayDayOffset)
  const maxDay = validTasks.length === 0 ? 30 : Math.max(...validTasks.map(t => t.plannedEndDay!), todayDayOffset) + 5

  const layout = computeGanttLayout({
    zoom, minDay, maxDay,
    tasks: validTasks.map(t => ({ id: t.id, start: t.plannedStartDay!, end: t.plannedEndDay! })),
  })
  const taskXById = new Map(layout.taskX.map(t => [t.id, t]))

  const svgHeight = HEADER_HEIGHT + rows.length * ROW_HEIGHT + 10
  const todayX = (todayDayOffset - minDay) * layout.dayWidth

  function openTask(id: string) {
    const next = new URLSearchParams(search)
    next.set('task', id)
    router.push(`?${next.toString()}`, { scroll: false })
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-3">
      <div className="flex items-center gap-2 mb-2">
        <div className="text-xs uppercase text-zinc-600">Timeline</div>
        <div className="ml-auto flex gap-1">
          {(['week','month','quarter'] as const).map(z => (
            <button key={z} onClick={() => setZoom(z)}
              className={['px-2 py-0.5 text-xs rounded',
                z === zoom ? 'bg-zinc-200' : 'bg-white border border-zinc-300 text-zinc-600'].join(' ')}>
              {z}
            </button>
          ))}
        </div>
      </div>

      {validTasks.length === 0 ? (
        <div className="p-4 text-sm text-zinc-500">No workflows assigned to this phase yet. Edit the project to add workflows.</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <svg width={Math.max(layout.totalWidth + 200, 500)} height={svgHeight} style={{ display: 'block' }}>
            {/* Today line */}
            {todayX >= 0 && todayX <= layout.totalWidth + 200 && (
              <line x1={200 + todayX} y1={0} x2={200 + todayX} y2={svgHeight} stroke="#dc2626" strokeWidth={1} strokeDasharray="4 2" />
            )}

            {rows.map((row, i) => {
              const y = HEADER_HEIGHT + i * ROW_HEIGHT
              if (row.kind === 'workflow') {
                return (
                  <g key={row.workflow.id}>
                    <rect x={0} y={y} width={Math.max(layout.totalWidth + 200, 500)} height={ROW_HEIGHT} fill="#f4f4f5" />
                    <text x={6} y={y + 15} fontSize="12" fontWeight="600" fill="#27272a">▸ {row.workflow.name}</text>
                  </g>
                )
              }
              const t = row.task
              const bar = taskXById.get(t.id)
              if (!bar) return <text key={t.id} x={20} y={y + 15} fontSize="11" fill="#71717a">{t.name} (no schedule)</text>
              const fill = t.isUnplanned ? '#fee2e2' : '#93c5fd'
              const stroke = t.isOnCriticalPath ? '#dc2626' : 'none'

              return (
                <g key={t.id} onClick={() => openTask(t.id)} style={{ cursor: 'pointer' }}>
                  <text x={20} y={y + 15} fontSize="11" fill="#3f3f46">{t.name}</text>
                  <rect x={200 + bar.x} y={y + 5} width={bar.width} height={ROW_HEIGHT - 10}
                        fill={fill} stroke={stroke} strokeWidth={t.isOnCriticalPath ? 2 : 0} rx={2} />
                  {t.actualStartDay !== null && (
                    <rect x={200 + (t.actualStartDay - minDay) * layout.dayWidth} y={y + 8}
                          width={((t.actualEndDay ?? todayDayOffset) - t.actualStartDay) * layout.dayWidth}
                          height={ROW_HEIGHT - 16} fill="#1e40af" opacity={0.7} rx={2} />
                  )}
                </g>
              )
            })}

            {/* Dependency arrows (week + month zoom only) */}
            {zoom !== 'quarter' && taskDeps.map((d, i) => {
              const fromBar = taskXById.get(d.fromTaskId)
              const toBar = taskXById.get(d.toTaskId)
              if (!fromBar || !toBar) return null
              const fromIdx = rows.findIndex(r => r.kind === 'task' && r.task.id === d.fromTaskId)
              const toIdx = rows.findIndex(r => r.kind === 'task' && r.task.id === d.toTaskId)
              if (fromIdx === -1 || toIdx === -1) return null
              const fy = HEADER_HEIGHT + fromIdx * ROW_HEIGHT + ROW_HEIGHT / 2
              const ty = HEADER_HEIGHT + toIdx * ROW_HEIGHT + ROW_HEIGHT / 2
              const fx = 200 + fromBar.x + fromBar.width
              const tx = 200 + toBar.x
              return (
                <path key={i} d={`M${fx} ${fy} L${fx + 4} ${fy} L${fx + 4} ${ty} L${tx - 2} ${ty}`}
                      stroke="#a1a1aa" strokeWidth={1} fill="none" markerEnd="url(#arrow)" />
              )
            })}

            <defs>
              <marker id="arrow" viewBox="0 0 8 8" refX="6" refY="4" markerWidth="6" markerHeight="6" orient="auto">
                <path d="M0 0 L8 4 L0 8 Z" fill="#a1a1aa" />
              </marker>
            </defs>
          </svg>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add components/project/gantt/
git commit -m "feat(gantt): SVG renderer with zoom, today line, dependency arrows, critical-path highlight"
```

---

## Phase 9: Task drawer

### Task 9.1: `<TaskDrawer />` shell with URL-driven open/close

**Files:**
- Create: `components/project/task-drawer.tsx`
- Create: `components/project/drawer-status-stepper.tsx`

- [ ] **Step 1: `components/project/drawer-status-stepper.tsx`**

```tsx
// components/project/drawer-status-stepper.tsx
import type { TaskStatus } from '@/db/schema'

const STAGES = [
  { id: 'not_started', label: 'Not started' },
  { id: 'started', label: 'Started' },
  { id: 'pending_review', label: 'In review' },
  { id: 'approved', label: 'Approved' },
  { id: 'complete', label: 'Complete' },
] as const

export function DrawerStatusStepper({
  status, hasReviewer,
}: { status: TaskStatus; hasReviewer: boolean }) {
  if (status === 'wont_do') {
    return <div className="rounded bg-zinc-100 text-zinc-700 text-xs px-2 py-1 text-center">Won't do</div>
  }

  const visibleStages = hasReviewer
    ? STAGES
    : STAGES.filter(s => s.id !== 'pending_review' && s.id !== 'approved')
  const currentIdx = visibleStages.findIndex(s => s.id === status)

  return (
    <div className="flex items-center text-[10px] text-zinc-500 gap-0">
      {visibleStages.map((s, i) => {
        const isPast = i < currentIdx
        const isCurrent = i === currentIdx
        const dotClass = isCurrent
          ? 'w-4 h-4 rounded-full border-2 border-blue-500 bg-white ring-2 ring-blue-100'
          : isPast
            ? 'w-3 h-3 rounded-full bg-emerald-500 border-2 border-emerald-500'
            : 'w-3 h-3 rounded-full border-2 border-zinc-300'
        return (
          <div key={s.id} className="flex-1 flex flex-col items-center">
            <div className="flex items-center w-full">
              {i > 0 && <div className={`flex-1 h-0.5 ${isPast || isCurrent ? 'bg-emerald-500' : 'bg-zinc-200'}`} />}
              <div className={dotClass} />
              {i < visibleStages.length - 1 && <div className={`flex-1 h-0.5 ${i < currentIdx ? 'bg-emerald-500' : 'bg-zinc-200'}`} />}
            </div>
            <div className={`mt-1 ${isCurrent ? 'text-blue-600 font-semibold' : ''}`}>{s.label}</div>
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: `components/project/task-drawer.tsx` (shell + key facts + closer)**

```tsx
// components/project/task-drawer.tsx
'use client'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect } from 'react'
import { Avatar } from '@/components/shared/avatar'
import { DrawerStatusStepper } from './drawer-status-stepper'
import { DrawerStatusActions } from './drawer-status-actions'
import { DrawerSubtasks } from './drawer-subtasks'
import { DrawerComments } from './drawer-comments'
import { currentTaskStatus } from '@/lib/project-page/current-task-status'
import type { ProjectPageData } from '@/db/queries/project-page'

export function TaskDrawer({
  projectId, taskId, initialData,
}: {
  projectId: string
  taskId: string
  initialData: ProjectPageData
}) {
  const router = useRouter()
  const search = useSearchParams()

  const task = initialData.tasks.find(t => t.id === taskId)
  const owner = task && initialData.users.find(u => u.id === task.ownerId)
  const reviewer = task && task.reviewerId ? initialData.users.find(u => u.id === task.reviewerId) : null
  const workflow = task && initialData.workflows.find(w => w.id === task.projectWorkflowId)
  const phase = workflow && initialData.phases.find(p => p.id === workflow.projectPhaseId)

  const today = new Date()
  const kickoff = initialData.project.kickedOffAt ? new Date(initialData.project.kickedOffAt) : today
  const todayDayOffset = Math.max(0, Math.floor((today.getTime() - kickoff.getTime()) / (24 * 60 * 60 * 1000)))

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  function close() {
    const next = new URLSearchParams(search)
    next.delete('task')
    router.push(`?${next.toString()}`, { scroll: false })
  }

  if (!task) return null

  const cts = currentTaskStatus(
    { status: task.status, isBlocked: task.isBlocked, plannedEndDay: task.plannedEndDay },
    todayDayOffset,
  )
  const riskLabel = cts.level === 'delay' ? `🔴 delay ${cts.daysBehind}d`
    : cts.level === 'at_risk' ? '🟠 at risk'
    : '🟢 on track'

  const upstreamTaskIds = initialData.taskDeps.filter(d => d.toTaskId === task.id).map(d => d.fromTaskId)
  const upstreamTasks = upstreamTaskIds.map(id => initialData.tasks.find(t => t.id === id)).filter(Boolean)

  return (
    <div className="fixed inset-y-0 right-0 w-[380px] bg-white border-l border-zinc-200 shadow-2xl z-40 overflow-y-auto">
      <button onClick={close} className="absolute top-3 right-3 text-zinc-500 hover:text-zinc-900 text-xl leading-none">×</button>

      <div className="p-4 pr-10">
        <div className="text-[10px] uppercase tracking-wide text-zinc-500">
          {workflow?.name} · {phase?.name}
        </div>
        <h3 className="text-base font-semibold mt-1">{task.name}</h3>
        <div className="text-xs mt-1">
          {riskLabel} {task.isOnCriticalPath && <span className="text-red-600">· on critical path</span>}
        </div>

        {/* Owner + Reviewer */}
        <div className="mt-4 p-3 bg-zinc-50 rounded-lg flex gap-3">
          <div className="flex-1">
            <div className="text-[10px] uppercase text-zinc-500">Owner</div>
            <div className="flex items-center gap-2 mt-1">
              {owner && <Avatar user={owner} size="sm" />}
              <strong className="text-sm">{owner?.name ?? '—'}</strong>
            </div>
          </div>
          <div className="flex-1">
            <div className="text-[10px] uppercase text-zinc-500">Reviewer</div>
            <div className="flex items-center gap-2 mt-1">
              {reviewer ? <Avatar user={reviewer} size="sm" /> : null}
              <strong className="text-sm">{reviewer?.name ?? '—'}</strong>
            </div>
          </div>
        </div>

        {/* Status stepper */}
        <div className="mt-4">
          <DrawerStatusStepper status={task.status} hasReviewer={!!task.reviewerId} />
        </div>

        {/* Status action card */}
        <div className="mt-4">
          <DrawerStatusActions task={task} project={initialData.project} />
        </div>

        {/* Key facts */}
        <div className="mt-4 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
          <span className="text-zinc-500">Planned</span>
          <span>Day {task.plannedStartDay ?? '?'}–{task.plannedEndDay ?? '?'} ({task.plannedDurationDays}d)</span>
          {task.actualStartDay !== null && <>
            <span className="text-zinc-500">Actual start</span>
            <span>Day {task.actualStartDay}</span>
          </>}
          {task.actualEndDay !== null && <>
            <span className="text-zinc-500">Actual end</span>
            <span>Day {task.actualEndDay}</span>
          </>}
          <span className="text-zinc-500">Depends on</span>
          <span>{upstreamTasks.length === 0 ? '—' : upstreamTasks.map(t => t!.name).join(', ')}</span>
        </div>

        {/* Subtasks */}
        <DrawerSubtasks task={task} allTasks={initialData.tasks} />

        {/* Comments */}
        <DrawerComments taskId={task.id} />

        <div className="mt-6 pt-4 border-t border-zinc-200 text-xs">
          <a href={`/projects/${projectId}/tasks/${task.id}`} className="text-blue-600 hover:underline">
            Open full task detail →
          </a>
          <span className="text-zinc-400 ml-2">(future spec)</span>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit (DrawerStatusActions, DrawerSubtasks, DrawerComments imported but not yet built — build fails until 9.2-9.4)**

```bash
git add components/project/task-drawer.tsx components/project/drawer-status-stepper.tsx
git commit -m "feat(project-page): task drawer shell + status stepper"
```

---

### Task 9.2: `<DrawerStatusActions />`

**Files:**
- Create: `components/project/drawer-status-actions.tsx`

- [ ] **Step 1: Implement**

```tsx
// components/project/drawer-status-actions.tsx
'use client'
import { useState } from 'react'
import { usePermissions } from '@/lib/hooks/use-permissions'
import { taskActionState, type TaskActionId } from '@/lib/project-page/task-action-state'
import {
  setTaskStatus, submitTaskForReview, approveTask, requestTaskRevision,
} from '@/app/actions/tasks'
import type { Task, ProjectStatus } from '@/db/schema'

export function DrawerStatusActions({
  task, project,
}: {
  task: Task
  project: { id: string; pmId: string; status: ProjectStatus }
}) {
  const { user } = usePermissions()
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [showRevisionPrompt, setShowRevisionPrompt] = useState(false)
  const [revisionBody, setRevisionBody] = useState('')

  if (!user) return null

  const state = taskActionState({
    task: { ownerId: task.ownerId, reviewerId: task.reviewerId, status: task.status },
    project: { pmId: project.pmId, status: project.status },
    user: { id: user.id, role: user.role },
  })

  if (!state.primary && !state.secondary) {
    return <div className="rounded-lg bg-zinc-50 p-3 text-xs text-zinc-500">{state.context}</div>
  }

  async function run(action: TaskActionId) {
    setBusy(true); setErr(null)
    try {
      switch (action) {
        case 'start': await setTaskStatus({ taskId: task.id, status: 'started' }); break
        case 'submit_review': await submitTaskForReview({ taskId: task.id }); break
        case 'mark_complete': await setTaskStatus({ taskId: task.id, status: 'complete' }); break
        case 'wont_do': await setTaskStatus({ taskId: task.id, status: 'wont_do' }); break
        case 'revert': await setTaskStatus({ taskId: task.id, status: 'not_started' }); break
        case 'approve': await approveTask({ taskId: task.id }); break
        case 'request_revision': setShowRevisionPrompt(true); return
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'failed')
    } finally { setBusy(false) }
  }

  async function submitRevision() {
    if (!revisionBody.trim()) { setErr('Comment required'); return }
    setBusy(true); setErr(null)
    try {
      await requestTaskRevision({ taskId: task.id, body: revisionBody })
      setShowRevisionPrompt(false); setRevisionBody('')
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'failed')
    } finally { setBusy(false) }
  }

  return (
    <div className="rounded-lg bg-blue-50 border border-blue-100 p-3 text-xs">
      <div className="text-blue-900 mb-2">{state.context}</div>
      <div className="flex gap-2">
        {state.primary && (
          <button onClick={() => run(state.primary!.action)} disabled={busy}
            className="flex-1 bg-gradient-to-r from-cyan-500 to-blue-500 text-white px-3 py-1.5 rounded text-sm hover:opacity-90 disabled:opacity-50">
            {state.primary.label}
          </button>
        )}
        {state.secondary && (
          <button onClick={() => run(state.secondary!.action)} disabled={busy}
            className="bg-white border border-zinc-300 text-zinc-700 px-3 py-1.5 rounded text-xs hover:bg-zinc-50 disabled:opacity-50">
            {state.secondary.label}
          </button>
        )}
      </div>

      {showRevisionPrompt && (
        <div className="mt-2">
          <textarea value={revisionBody} onChange={(e) => setRevisionBody(e.target.value)}
            placeholder="Describe what needs revision"
            className="w-full border rounded px-2 py-1 text-xs" rows={2} />
          <div className="flex gap-2 mt-1">
            <button onClick={() => setShowRevisionPrompt(false)} className="text-xs px-2 py-1 border rounded">Cancel</button>
            <button onClick={submitRevision} disabled={busy} className="ml-auto text-xs px-2 py-1 bg-blue-600 text-white rounded">Send</button>
          </div>
        </div>
      )}

      {err && <div className="text-red-600 text-xs mt-2">{err}</div>}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/project/drawer-status-actions.tsx
git commit -m "feat(project-page): drawer status actions with state-driven buttons"
```

---

### Task 9.3: `<DrawerSubtasks />`

**Files:**
- Create: `components/project/drawer-subtasks.tsx`

- [ ] **Step 1: Implement**

```tsx
// components/project/drawer-subtasks.tsx
'use client'
import { useState } from 'react'
import { addSubtask, setTaskStatus } from '@/app/actions/tasks'
import { usePermissions } from '@/lib/hooks/use-permissions'
import type { Task } from '@/db/schema'

export function DrawerSubtasks({ task, allTasks }: { task: Task; allTasks: Task[] }) {
  const subtasks = allTasks.filter(t => t.parentTaskId === task.id)
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const { user } = usePermissions()

  async function create() {
    if (!name.trim() || !user) return
    setBusy(true)
    try {
      await addSubtask({ parentTaskId: task.id, name, ownerId: user.id })
      setName(''); setAdding(false)
    } finally { setBusy(false) }
  }

  async function toggleSubtask(sub: Task) {
    const next = sub.status === 'complete' ? 'not_started' : 'complete'
    await setTaskStatus({ taskId: sub.id, status: next })
  }

  return (
    <div className="mt-4">
      <div className="text-[10px] uppercase text-zinc-500">Subtasks ({subtasks.length})</div>
      <div className="text-sm mt-1 space-y-0.5">
        {subtasks.map(s => (
          <div key={s.id} className="flex items-center gap-2">
            <button onClick={() => toggleSubtask(s)} className="text-zinc-500 hover:text-zinc-900">
              {s.status === 'complete' ? '✓' : '○'}
            </button>
            <span className={s.status === 'complete' ? 'line-through text-zinc-500' : ''}>{s.name}</span>
          </div>
        ))}
      </div>
      {adding ? (
        <div className="mt-2 flex gap-1">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Subtask name"
            className="flex-1 border rounded px-2 py-1 text-xs" autoFocus />
          <button onClick={create} disabled={busy} className="bg-blue-600 text-white px-2 py-1 rounded text-xs">Add</button>
          <button onClick={() => { setAdding(false); setName('') }} className="border rounded px-2 py-1 text-xs">Cancel</button>
        </div>
      ) : (
        <button onClick={() => setAdding(true)} className="text-blue-600 text-xs mt-1">+ Add subtask</button>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/project/drawer-subtasks.tsx
git commit -m "feat(project-page): drawer subtasks with inline add + toggle"
```

---

### Task 9.4: `<DrawerComments />`

**Files:**
- Create: `components/project/drawer-comments.tsx`
- Create: `app/api/tasks/[taskId]/comments/route.ts`

The drawer comments need to be fetched fresh on open (foundation has no client-side query helper). Add a GET route handler for fetching comments.

- [ ] **Step 1: Write `app/api/tasks/[taskId]/comments/route.ts`**

```ts
import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/server/get-current-user'
import { db } from '@/db/client'
import { getTaskComments } from '@/db/queries/project-page'

export async function GET(req: Request, { params }: { params: { taskId: string } }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { comments, users } = await getTaskComments(db, params.taskId)
  return NextResponse.json({ comments, users })
}
```

- [ ] **Step 2: `components/project/drawer-comments.tsx`**

```tsx
// components/project/drawer-comments.tsx
'use client'
import { useEffect, useState } from 'react'
import { addTaskComment } from '@/app/actions/task-comments'
import { usePermissions } from '@/lib/hooks/use-permissions'
import { Avatar } from '@/components/shared/avatar'
import type { TaskComment, User } from '@/db/schema'

function timeAgo(when: Date): string {
  const diff = Date.now() - when.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return when.toLocaleDateString()
}

export function DrawerComments({ taskId }: { taskId: string }) {
  const [comments, setComments] = useState<TaskComment[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const { user } = usePermissions()

  async function load() {
    const res = await fetch(`/api/tasks/${taskId}/comments`)
    if (res.ok) {
      const data = await res.json()
      setComments(data.comments)
      setUsers(data.users)
    }
  }

  useEffect(() => { load() }, [taskId])

  async function post() {
    if (!body.trim()) return
    setBusy(true)
    try {
      await addTaskComment({ taskId, body, kind: 'discussion' })
      setBody('')
      await load()
    } finally { setBusy(false) }
  }

  const userById = new Map(users.map(u => [u.id, u]))

  return (
    <div className="mt-4 pt-3 border-t border-zinc-200">
      <div className="text-[10px] uppercase text-zinc-500">Comments</div>
      <div className="mt-2 space-y-2">
        {comments.length === 0 && <div className="text-xs text-zinc-500">No comments yet.</div>}
        {comments.map(c => {
          const author = userById.get(c.authorId)
          return (
            <div key={c.id} className="bg-zinc-50 rounded p-2 text-xs">
              <div className="flex items-center gap-2">
                {author && <Avatar user={author} size="xs" />}
                <strong>{author?.name ?? 'Unknown'}</strong>
                <span className="text-zinc-500">{timeAgo(new Date(c.createdAt))}</span>
                <span className="ml-1 text-[10px] bg-zinc-200 px-1 py-0.5 rounded">{c.kind}</span>
              </div>
              <div className="mt-1 whitespace-pre-wrap">{c.body}</div>
            </div>
          )
        })}
      </div>
      <div className="mt-2">
        <textarea value={body} onChange={(e) => setBody(e.target.value)}
          placeholder={`Write a comment as ${user?.name ?? 'you'}…`}
          className="w-full border rounded px-2 py-1 text-xs" rows={2} />
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[10px] text-zinc-500">Posts as discussion (review comments are attached automatically)</span>
          <button onClick={post} disabled={busy} className="ml-auto bg-blue-600 text-white text-xs px-3 py-1 rounded disabled:opacity-50">Post</button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add components/project/drawer-comments.tsx app/api/tasks/
git commit -m "feat(project-page): drawer comments list + composer + fetch route"
```

---

## Phase 10: Add Task dialog

### Task 10.1: `<AddTaskDialog />` for draft and unplanned modes

**Files:**
- Create: `components/project/add-task-dialog.tsx`

- [ ] **Step 1: Implement**

```tsx
// components/project/add-task-dialog.tsx
'use client'
import * as Dialog from '@radix-ui/react-dialog'
import { useEffect, useState } from 'react'
import { addPlannedTask, addUnplannedTask } from '@/app/actions/tasks'

export function AddTaskDialog({
  project, phaseName, workflowIds, onClose,
}: {
  project: { id: string; pmId: string; status: 'draft'|'in_progress'|'complete'|'archived' }
  phaseName: 'Permitting' | 'Construction' | 'Sale'
  workflowIds: string[]
  onClose: () => void
}) {
  const isDraft = project.status === 'draft'
  const [users, setUsers] = useState<Array<{ id: string; name: string }>>([])
  const [tasks, setTasks] = useState<Array<{ id: string; name: string; projectWorkflowId: string }>>([])
  const [form, setForm] = useState({
    name: '', plannedDurationDays: 1, ownerId: '', reviewerId: '',
    description: '', workflowId: workflowIds[0] ?? '',
    upstreamTaskId: '',
  })
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch('/api/users/active').then(r => r.json()).then(d => setUsers(d.users ?? [])),
      fetch(`/api/projects/${project.id}/tasks`).then(r => r.json()).then(d => setTasks(d.tasks ?? [])),
    ])
  }, [project.id])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null); setBusy(true)
    try {
      if (isDraft) {
        await addPlannedTask({
          projectId: project.id,
          projectWorkflowId: form.workflowId,
          name: form.name,
          plannedDurationDays: form.plannedDurationDays,
          ownerId: form.ownerId,
          reviewerId: form.reviewerId || null,
          description: form.description || null,
          upstreamTaskIds: form.upstreamTaskId ? [form.upstreamTaskId] : undefined,
        })
      } else {
        await addUnplannedTask({
          projectId: project.id,
          projectWorkflowId: form.workflowId,
          name: form.name,
          plannedDurationDays: form.plannedDurationDays,
          ownerId: form.ownerId,
          reviewerId: form.reviewerId || null,
          description: form.description || null,
          upstreamTaskId: form.upstreamTaskId || null,
        })
      }
      onClose()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'failed')
    } finally { setBusy(false) }
  }

  const tasksInPhase = tasks.filter(t => workflowIds.includes(t.projectWorkflowId))

  return (
    <Dialog.Root open onOpenChange={(o) => { if (!o) onClose() }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/30 z-40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[480px] bg-white rounded-lg p-6 shadow-xl z-50">
          <Dialog.Title className="text-lg font-semibold">{isDraft ? `Add task to ${phaseName}` : `Add unplanned task to ${phaseName}`}</Dialog.Title>
          <form onSubmit={submit} className="mt-4 space-y-3 text-sm">
            <label className="block">
              <span className="text-xs text-zinc-600">Name</span>
              <input required value={form.name} onChange={(e) => setForm(s => ({ ...s, name: e.target.value }))} className="mt-1 w-full border rounded px-2 py-1" />
            </label>
            <label className="block">
              <span className="text-xs text-zinc-600">Workflow</span>
              <select required value={form.workflowId} onChange={(e) => setForm(s => ({ ...s, workflowId: e.target.value }))} className="mt-1 w-full border rounded px-2 py-1">
                <option value="">— pick a workflow —</option>
                {workflowIds.map(id => <option key={id} value={id}>{id.slice(0, 8)}…</option>)}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-xs text-zinc-600">Duration (days)</span>
                <input type="number" required min="0" value={form.plannedDurationDays} onChange={(e) => setForm(s => ({ ...s, plannedDurationDays: Number(e.target.value) }))} className="mt-1 w-full border rounded px-2 py-1" />
              </label>
              <label className="block">
                <span className="text-xs text-zinc-600">Owner</span>
                <select required value={form.ownerId} onChange={(e) => setForm(s => ({ ...s, ownerId: e.target.value }))} className="mt-1 w-full border rounded px-2 py-1">
                  <option value="">— pick user —</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </label>
            </div>
            <label className="block">
              <span className="text-xs text-zinc-600">Reviewer (optional)</span>
              <select value={form.reviewerId} onChange={(e) => setForm(s => ({ ...s, reviewerId: e.target.value }))} className="mt-1 w-full border rounded px-2 py-1">
                <option value="">— none —</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-xs text-zinc-600">Upstream task (optional)</span>
              <select value={form.upstreamTaskId} onChange={(e) => setForm(s => ({ ...s, upstreamTaskId: e.target.value }))} className="mt-1 w-full border rounded px-2 py-1">
                <option value="">— no upstream —</option>
                {tasksInPhase.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-xs text-zinc-600">Description (optional)</span>
              <textarea value={form.description} onChange={(e) => setForm(s => ({ ...s, description: e.target.value }))} className="mt-1 w-full border rounded px-2 py-1" rows={2} />
            </label>
            {err && <div className="text-red-600 text-xs">{err}</div>}
            <div className="flex gap-2 pt-2">
              <button type="button" onClick={onClose} className="border rounded px-3 py-1.5 text-sm">Cancel</button>
              <button type="submit" disabled={busy} className="ml-auto bg-gradient-to-r from-cyan-500 to-blue-500 text-white px-4 py-1.5 rounded text-sm hover:opacity-90 disabled:opacity-50">
                Add task
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
```

- [ ] **Step 2: Add the supporting API routes**

Create `app/api/users/active/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { getCurrentUser } from '@/lib/server/get-current-user'
import { db } from '@/db/client'
import { users } from '@/db/schema'

export async function GET() {
  const me = await getCurrentUser()
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const list = await db.select({ id: users.id, name: users.name }).from(users).where(eq(users.isActive, true))
  return NextResponse.json({ users: list })
}
```

Create `app/api/projects/[id]/tasks/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { getCurrentUser } from '@/lib/server/get-current-user'
import { db } from '@/db/client'
import { tasks } from '@/db/schema'

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const me = await getCurrentUser()
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const rows = await db.select({
    id: tasks.id, name: tasks.name, projectWorkflowId: tasks.projectWorkflowId,
  }).from(tasks).where(eq(tasks.projectId, params.id))
  return NextResponse.json({ tasks: rows })
}
```

- [ ] **Step 3: Commit**

```bash
git add components/project/add-task-dialog.tsx app/api/users/ app/api/projects/
git commit -m "feat(project-page): add task dialog + supporting fetch routes"
```

---

## Phase 11: Activity feed

### Task 11.1: `<ActivityFeed />` server component

**Files:**
- Create: `components/project/activity-feed.tsx`
- Create: `components/project/activity-item.tsx`

- [ ] **Step 1: `components/project/activity-item.tsx`**

```tsx
// components/project/activity-item.tsx
import Link from 'next/link'
import { Avatar } from '@/components/shared/avatar'
import type { Activity, User } from '@/db/schema'
import { humanizeActivity } from '@/lib/project-page/activity-humanize'

function timeAgo(when: Date): string {
  const diff = Date.now() - when.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  if (hrs < 48) return 'Yesterday'
  return when.toLocaleDateString()
}

export function ActivityItem({
  activity, actor, taskById, projectId,
}: {
  activity: Activity
  actor: User | undefined
  taskById: Map<string, string>
  projectId: string
}) {
  if (!actor) return null
  const h = humanizeActivity({
    type: activity.type,
    payload: activity.payload as Record<string, unknown>,
    actor: { id: actor.id, name: actor.name },
    taskById,
  })
  const body = h.taskId
    ? <Link href={`/projects/${projectId}?task=${h.taskId}`} className="hover:underline">{h.text}</Link>
    : <span>{h.text}</span>

  return (
    <div className="flex items-start gap-3 py-2">
      <Avatar user={actor} size="sm" />
      <div className="flex-1 text-sm">
        <div>{body}</div>
        <div className="text-xs text-zinc-500">{timeAgo(new Date(activity.createdAt))}</div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: `components/project/activity-feed.tsx`**

```tsx
// components/project/activity-feed.tsx
import { db } from '@/db/client'
import { getProjectActivities } from '@/db/queries/project-page'
import { ActivityItem } from './activity-item'

export async function ActivityFeed({ projectId }: { projectId: string }) {
  const data = await getProjectActivities(db, projectId, 100)
  const actorById = new Map(data.users.map(u => [u.id, u]))
  const taskById = new Map(data.tasks.map(t => [t.id, t.name]))

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-3">
      <div className="text-xs uppercase text-zinc-600 mb-2">Activity (recent 100)</div>
      {data.activities.length === 0 ? (
        <div className="p-4 text-sm text-zinc-500">No activity yet.</div>
      ) : (
        <div className="divide-y divide-zinc-100">
          {data.activities.map(a => (
            <ActivityItem
              key={a.id}
              activity={a}
              actor={actorById.get(a.actorId)}
              taskById={taskById}
              projectId={projectId}
            />
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add components/project/activity-feed.tsx components/project/activity-item.tsx
git commit -m "feat(project-page): activity feed + humanized items"
```

---

## Phase 12: Task detail stub + final polish

### Task 12.1: Task detail stub page

**Files:**
- Create: `app/(app)/projects/[id]/tasks/[taskId]/page.tsx`

- [ ] **Step 1: Implement**

```tsx
// app/(app)/projects/[id]/tasks/[taskId]/page.tsx
import Link from 'next/link'

export default function TaskDetailStub({ params }: { params: { id: string; taskId: string } }) {
  return (
    <div className="space-y-4">
      <Link href={`/projects/${params.id}`} className="text-blue-600 text-sm hover:underline">
        ← Back to project
      </Link>
      <div className="rounded-lg border border-zinc-200 bg-white p-6">
        <h1 className="text-xl font-semibold">Task detail page</h1>
        <p className="text-sm text-zinc-600 mt-2">
          Full task detail UI is covered by a separate spec. For now use the drawer on the project page —
          it has the same status actions, subtasks, and comments.
        </p>
        <p className="text-xs text-zinc-500 mt-4">
          taskId: <code>{params.taskId}</code>
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add "app/(app)/projects/[id]/tasks/"
git commit -m "feat(project-page): task detail stub page (full spec deferred)"
```

---

### Task 12.2: Final verification + smoke test runbook

- [ ] **Step 1: Run full suite**

```bash
npm test
npm run typecheck
```

Expected: all tests pass, typecheck clean.

- [ ] **Step 2: Run `npm run build`**

```bash
npm run build
```

Expected: build succeeds. Any TypeScript errors must be fixed before commit.

- [ ] **Step 3: Manual smoke test runbook**

Requires Docker + Lark credentials (same setup as foundation).

1. `docker compose up -d`
2. `npm run db:migrate`
3. `npm run dev`
4. Sign in via Lark (bootstrap owner)
5. `npm run db:seed` (seeds a Permitting Basics template)
6. `/projects/new` — create a project with the seeded template, brand `al_homes`
7. On the project page (`/projects/<id>`):
   - Header shows project metadata
   - 4 tabs: Permitting (active) / Construction / Sale / Activity
   - Permitting tab: action bar shows "Kick Off Phase" (you're managing PM)
   - Gantt renders the snapshot tasks; today line should appear at left edge (pre-kick-off, today = day 0)
   - Task list shows all phase tasks color-coded 🟢 on track
8. Click a task row → drawer opens overlaying the page (header still visible behind)
9. Owner of task (you) sees "Start" primary button → click it → status flips to `started`
10. Click "Submit for Review" → status → `pending_review`
11. Switch user (use a different Lark account) who is the reviewer → drawer shows Approve / Request Revision
12. Approve → status → `approved`. Back as owner, click "Mark Complete" → `complete`
13. Click "Edit" on header → metadata dialog. Edit name → save.
14. Click "+ Add task" in task list → add a planned task in draft (or "+ Add unplanned task" if kicked off)
15. Click Activity tab → see all events you generated
16. As owner role: go back to Edit metadata → expand Owner overrides → "Unlock to Draft" with reason → project goes back to draft

If anything is broken in this runbook, file a follow-up task. Otherwise the implementation is complete.

- [ ] **Step 4: Run final `git log` and verify**

```bash
git log --oneline main..HEAD
```

Expected: ~30 commits in linear sequence corresponding to the tasks above.

---

## Plan self-review

**Spec coverage** — confirming each numbered section of the spec maps to a task:

| Spec section | Implemented by |
|---|---|
| §1 Overview | n/a (header) |
| §2 Layout | Task 6.2 page shell |
| §3 Header summary | Task 5.1 |
| §4 Tab structure | Task 6.1 |
| §5.1 Action bar | Task 7.1 |
| §5.2 Gantt | Phase 8 (Tasks 8.1, 8.2) |
| §5.3 Task list | Tasks 7.2, 7.3 |
| §6 Task drawer | Phase 9 (Tasks 9.1–9.4) |
| §6.3 Action button matrix | Task 2.3 (`taskActionState`) + Task 9.2 (UI) |
| §7 Add task dialog | Task 10.1 |
| §8 Edit metadata dialog | Tasks 5.2, 3.2 (updateProjectMetadata) |
| §9 Activity tab | Task 11.1, plus Task 2.4 (humanize) |
| §10 Component organization | matched throughout |
| §11 State management (URL) | Task 6.1 (tabs), 6.2 (page reads params), 9.1 (drawer) |
| §12 Data fetching | Task 4.1 |
| §13 Permission gating | wired in each relevant component via `usePermissions().can(...)` |
| §14 Testing strategy | unit + DB tests in Phases 2, 3, 4, 8; component tests deferred (acceptable per spec) |
| §15 Visual design language (theme + avatars) | Phase 1 (Tasks 1.1, 1.2, 1.3, 1.4, 1.5) |
| §16 Out of scope | task detail stub in Task 12.1 |
| §17 Open implementation questions | inherited; flagged in spec |

**Placeholder scan**: no TBD/TODO/"similar to" patterns in this plan; every step has explicit code.

**Type consistency**: `currentTaskStatus` signature matches between definition (Task 2.1) and use (Task 7.2, 9.1); `taskActionState` matches between Task 2.3 and Task 9.2; `phaseActionState` matches between Task 2.2 and Task 7.1; `Avatar` signature matches between Task 1.5 and uses in drawer + activity item; `getProjectPageData` return shape matches between Task 4.1 and the page (Task 6.2) + drawer (Task 9.1) + activity feed (Task 11.1).

**Known limitations to address during implementation** (called out for the engineer; not blockers):

- Component tests (RTL) for permission-conditional drawer rendering are recommended in the spec (§14) but not enumerated as tasks here. Add them ad-hoc when implementing the drawer if useful.
- The dashboard's `computeDashboardCounters` from the dashboard plan and `getProjectPageData` here both call `db.select().from(projects)`; consider extracting a shared helper if duplication grows.
