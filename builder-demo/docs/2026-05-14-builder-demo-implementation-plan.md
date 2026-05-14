# Builder Demo Frontend — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a click-through Next.js demo at `~/Desktop/Real-Estate-Analysis/builder-demo/` showing Dashboard, Project Page (9 Greenwood Pl), and My Tasks (Jenny Wang), using the SFH–With Planning Review template from the AED report.

**Architecture:** Static-exported Next.js 14 (App Router) + Tailwind + shadcn/ui. Pure logic in `lib/` (TDD with Vitest). Zustand store with `localStorage` persistence. Custom SVG Gantt. Light theme, 12 permit colors, status conveyed by fill style + border + icon.

**Tech Stack:** Next.js 14, TypeScript, Tailwind CSS, shadcn/ui, Zustand, Framer Motion, lucide-react, Recharts, Vitest, Inter font.

**Reference spec:** `~/Desktop/Real-Estate-Analysis/builder-demo/docs/2026-05-14-builder-demo-design.md` — consult for visual rules, status overlay table, full 28-task list, and KPI definitions.

**Working directory throughout this plan:** `/Users/guoyuzhu/Desktop/Real-Estate-Analysis/builder-demo`

---

## Phase A — Scaffolding (3 tasks)

### Task 1: Initialize Next.js project

**Files:**
- Create: `~/Desktop/Real-Estate-Analysis/builder-demo/` (entire project)

- [ ] **Step 1: Run create-next-app non-interactively**

```bash
cd /Users/guoyuzhu/Desktop/Real-Estate-Analysis
npx create-next-app@14 builder-demo --typescript --tailwind --app --src-dir=false --import-alias="@/*" --eslint --use-npm --no-turbopack
```

Expected: scaffolds `builder-demo/` with `app/`, `package.json`, `tailwind.config.ts`, `tsconfig.json`. The `docs/` folder we created earlier is preserved (create-next-app does not delete existing files in non-empty dirs only if the dir is empty — if it errors, see Step 1a).

- [ ] **Step 1a (only if Step 1 errors on non-empty dir):**

```bash
cd /Users/guoyuzhu/Desktop/Real-Estate-Analysis
mv builder-demo builder-demo-docs-backup
npx create-next-app@14 builder-demo --typescript --tailwind --app --src-dir=false --import-alias="@/*" --eslint --use-npm --no-turbopack
mv builder-demo-docs-backup/docs builder-demo/docs
rmdir builder-demo-docs-backup
```

- [ ] **Step 2: Configure static export and basePath**

Replace `builder-demo/next.config.js` with:

```js
/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === 'production';
const nextConfig = {
  output: 'export',
  basePath: isProd ? '/Real-Estate-Analysis/builder-demo-site' : '',
  assetPrefix: isProd ? '/Real-Estate-Analysis/builder-demo-site/' : '',
  images: { unoptimized: true },
  trailingSlash: true,
};
module.exports = nextConfig;
```

- [ ] **Step 3: Verify scaffold builds**

```bash
cd /Users/guoyuzhu/Desktop/Real-Estate-Analysis/builder-demo
npm run build
```

Expected: build succeeds, produces `out/` directory.

- [ ] **Step 4: Initialize .gitignore additions**

Append to `builder-demo/.gitignore`:

```
# Build output committed only when publishing
/out
```

- [ ] **Step 5: Commit**

```bash
cd /Users/guoyuzhu/Desktop/Real-Estate-Analysis
git add builder-demo/
git commit -m "feat(builder-demo): scaffold Next.js 14 project with static export"
```

---

### Task 2: Install shadcn/ui + runtime dependencies

**Files:**
- Modify: `builder-demo/package.json`
- Create: `builder-demo/components.json`, `builder-demo/lib/utils.ts`, `builder-demo/components/ui/*`

- [ ] **Step 1: Install runtime libs**

```bash
cd /Users/guoyuzhu/Desktop/Real-Estate-Analysis/builder-demo
npm install zustand framer-motion lucide-react recharts date-fns clsx tailwind-merge class-variance-authority @radix-ui/react-slot
```

- [ ] **Step 2: Init shadcn (non-interactive via flags)**

```bash
npx shadcn@latest init -d
```

This creates `components.json`, `lib/utils.ts` (with `cn()`), and adds CSS variables to `app/globals.css`.

- [ ] **Step 3: Add primitives we need**

```bash
npx shadcn@latest add button card badge sheet dialog tabs tooltip toast dropdown-menu separator scroll-area popover avatar progress
```

Expected: files appear in `components/ui/`.

- [ ] **Step 4: Verify it still builds**

```bash
npm run build
```

Expected: success.

- [ ] **Step 5: Commit**

```bash
git add builder-demo/
git commit -m "feat(builder-demo): install shadcn/ui primitives and runtime deps"
```

---

### Task 3: Install Vitest + configure base theme/fonts

**Files:**
- Modify: `builder-demo/package.json`, `builder-demo/app/globals.css`, `builder-demo/app/layout.tsx`, `builder-demo/tailwind.config.ts`
- Create: `builder-demo/vitest.config.ts`, `builder-demo/vitest.setup.ts`

- [ ] **Step 1: Install Vitest**

```bash
npm install -D vitest @vitejs/plugin-react vite-tsconfig-paths jsdom
```

- [ ] **Step 2: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
  },
});
```

- [ ] **Step 3: Create `vitest.setup.ts`**

```ts
import '@testing-library/jest-dom/vitest';
```

Then: `npm install -D @testing-library/jest-dom`

- [ ] **Step 4: Add test script to `package.json`**

In the `"scripts"` block, add:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 5: Add Inter font in `app/layout.tsx`**

Replace `app/layout.tsx` with:

```tsx
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'Builder Demo · Project Orchestration',
  description: 'Frontend demo for the Builder Project Orchestration PRD.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans antialiased bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 6: Tailwind theme tokens — append to `tailwind.config.ts` theme.extend**

Add inside `extend: { ... }`:

```ts
fontFamily: {
  sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
},
```

- [ ] **Step 7: Add permit color variables to `app/globals.css`**

Append at the bottom of `globals.css`:

```css
:root {
  --permit-demo: 13 75% 62%;        /* #E76F51 */
  --permit-tree: 173 58% 39%;       /* #2A9D8F */
  --permit-planning: 244 76% 59%;   /* #4F46E5 */
  --permit-public-hearing: 271 81% 56%;  /* #9333EA */
  --permit-building: 217 91% 60%;   /* #2563EB */
  --permit-utility: 32 95% 44%;     /* #D97706 */
  --permit-grading: 27 81% 31%;     /* #92400E */
  --permit-encroach: 192 92% 36%;   /* #0891B2 */
  --permit-design: 333 79% 50%;     /* #DB2777 */
  --permit-approval: 161 94% 30%;   /* #059669 */
  --permit-post: 215 19% 35%;       /* #475569 */
  --permit-issuance: 45 93% 41%;    /* #CA8A04 */
}
```

- [ ] **Step 8: Run a smoke test**

```bash
npm run test
```

Expected: 0 tests run, exits 0 (no tests yet).

```bash
npm run build
```

Expected: build succeeds.

- [ ] **Step 9: Commit**

```bash
git add builder-demo/
git commit -m "feat(builder-demo): configure Vitest, Inter font, and permit color tokens"
```

---

## Phase B — Domain & state (7 tasks, TDD)

### Task 4: Type definitions

**Files:**
- Create: `builder-demo/lib/types.ts`

- [ ] **Step 1: Write `lib/types.ts`**

```ts
export type UserId = string;
export type TaskId = string;
export type ProjectId = string;

export type PermitKey =
  | 'demo' | 'tree' | 'planning' | 'public-hearing' | 'building'
  | 'utility' | 'grading' | 'encroach' | 'design' | 'approval'
  | 'post' | 'issuance';

export type DepartmentKey =
  | 'Utility' | 'Permit' | 'Planning' | 'Design' | 'Civil'
  | 'Interior Design' | 'Landscape' | 'Visualization' | 'Sales';

export type TaskStatus =
  | 'Not Started' | 'Ready' | 'In Progress' | 'Submitted for Review'
  | 'Needs Revision' | 'Approved' | 'Done' | 'Delayed' | 'Blocked' | 'Cancelled';

export type Priority = 'Low' | 'Medium' | 'High' | 'Critical';

export interface User {
  id: UserId;
  name: string;
  role: string;
  departments: DepartmentKey[];
  initials: string;
  avatarColor: string;
}

export interface Project {
  id: ProjectId;
  name: string;
  address: string;
  permitType: string;
  purchaseDate: string;        // ISO
  purchaseCost: number;
  ownerId: UserId;
  baselineStart: string;       // ISO; Day 1
  baselineEnd: string;         // ISO
  forecastEnd: string;         // ISO
  health: 'On Track' | 'At Risk' | 'Delayed';
  currentPhase: PermitKey;
}

export interface Task {
  id: TaskId;
  projectId: ProjectId;
  title: string;
  phase: PermitKey;
  department: DepartmentKey;
  ownerId: UserId;
  reviewerId: UserId | null;
  status: TaskStatus;
  priority: Priority;
  source: 'template' | 'unplanned';
  reviewComment?: string;
  // Day offsets from project Day 1
  plannedStartDay: number;
  plannedDueDay: number;
  forecastStartDay: number;
  forecastDueDay: number;
  actualStartDay: number | null;
  actualEndDay: number | null;
  dependencyIds: TaskId[];     // predecessors (Finish-to-Start)
  isCriticalPath: boolean;
}

export interface ActivityEvent {
  id: string;
  timestamp: string;           // ISO
  actorId: UserId;
  action: string;              // sentence
  taskId?: TaskId;
  comment?: string;
}
```

- [ ] **Step 2: Verify types compile**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add builder-demo/lib/types.ts
git commit -m "feat(builder-demo): add domain type definitions"
```

---

### Task 5: Permit metadata + tests

**Files:**
- Create: `builder-demo/lib/permits.ts`, `builder-demo/lib/permits.test.ts`

- [ ] **Step 1: Write failing test `lib/permits.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { PERMITS, getPermit, permitFromPhaseName } from './permits';

describe('permits', () => {
  it('has 12 permit definitions', () => {
    expect(Object.keys(PERMITS)).toHaveLength(12);
  });

  it('every permit has a label and hex color', () => {
    for (const p of Object.values(PERMITS)) {
      expect(p.label).toMatch(/^[A-Z]/);
      expect(p.hex).toMatch(/^#[0-9A-F]{6}$/i);
    }
  });

  it('getPermit returns the right entry', () => {
    expect(getPermit('planning').label).toBe('Planning Review');
  });

  it('permitFromPhaseName maps AED template phase strings to keys', () => {
    expect(permitFromPhaseName('Planning Review')).toBe('planning');
    expect(permitFromPhaseName('Demo Permit')).toBe('demo');
    expect(permitFromPhaseName('Public Hearing')).toBe('public-hearing');
    expect(permitFromPhaseName('Post Permit')).toBe('post');
    expect(permitFromPhaseName('Design + Sales')).toBe('design');
  });
});
```

- [ ] **Step 2: Run test to verify fail**

```bash
npm run test -- lib/permits.test
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write `lib/permits.ts`**

```ts
import type { PermitKey } from './types';

export interface PermitMeta {
  key: PermitKey;
  label: string;
  hex: string;
  cssVar: string;   // e.g. 'var(--permit-planning)'
}

export const PERMITS: Record<PermitKey, PermitMeta> = {
  demo:            { key: 'demo',            label: 'Demo Permit',         hex: '#E76F51', cssVar: 'var(--permit-demo)' },
  tree:            { key: 'tree',            label: 'Tree Permit',         hex: '#2A9D8F', cssVar: 'var(--permit-tree)' },
  planning:        { key: 'planning',        label: 'Planning Review',     hex: '#4F46E5', cssVar: 'var(--permit-planning)' },
  'public-hearing':{ key: 'public-hearing',  label: 'Public Hearing',      hex: '#9333EA', cssVar: 'var(--permit-public-hearing)' },
  building:        { key: 'building',        label: 'Building Permit',     hex: '#2563EB', cssVar: 'var(--permit-building)' },
  utility:         { key: 'utility',         label: 'Utility',             hex: '#D97706', cssVar: 'var(--permit-utility)' },
  grading:         { key: 'grading',         label: 'Grading Permit',      hex: '#92400E', cssVar: 'var(--permit-grading)' },
  encroach:        { key: 'encroach',        label: 'Encroachment Permit', hex: '#0891B2', cssVar: 'var(--permit-encroach)' },
  design:          { key: 'design',          label: 'Design + Sales',      hex: '#DB2777', cssVar: 'var(--permit-design)' },
  approval:        { key: 'approval',        label: 'Permit Approval',     hex: '#059669', cssVar: 'var(--permit-approval)' },
  post:            { key: 'post',            label: 'Post Permit',         hex: '#475569', cssVar: 'var(--permit-post)' },
  issuance:        { key: 'issuance',        label: 'Permit Issuance',     hex: '#CA8A04', cssVar: 'var(--permit-issuance)' },
};

export const PHASE_ORDER: PermitKey[] = [
  'demo', 'tree', 'planning', 'public-hearing', 'building',
  'utility', 'grading', 'encroach', 'design', 'approval', 'post', 'issuance',
];

export function getPermit(key: PermitKey): PermitMeta {
  return PERMITS[key];
}

const PHASE_NAME_MAP: Record<string, PermitKey> = {
  'Demo Permit': 'demo',
  'Tree Permit': 'tree',
  'Planning Review': 'planning',
  'Public Hearing': 'public-hearing',
  'Building Permit': 'building',
  'Utility': 'utility',
  'Grading Permit': 'grading',
  'Encroachment Permit': 'encroach',
  'Design + Sales': 'design',
  'Permit Approval': 'approval',
  'Post Permit': 'post',
  'Permit Issuance': 'issuance',
};

export function permitFromPhaseName(name: string): PermitKey {
  const k = PHASE_NAME_MAP[name];
  if (!k) throw new Error(`Unknown phase name: ${name}`);
  return k;
}
```

- [ ] **Step 4: Run test to verify pass**

```bash
npm run test -- lib/permits.test
```

Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add builder-demo/lib/
git commit -m "feat(builder-demo): permit color palette and phase-name mapping"
```

---

### Task 6: Date helpers + tests

**Files:**
- Create: `builder-demo/lib/dates.ts`, `builder-demo/lib/dates.test.ts`

- [ ] **Step 1: Write failing tests `lib/dates.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { PROJECT_DAY_ONE, TODAY_DAY, dayToDate, dateToDay, dayDelta, today } from './dates';

describe('dates', () => {
  it('PROJECT_DAY_ONE is 2026-03-06', () => {
    expect(PROJECT_DAY_ONE).toBe('2026-03-06');
  });

  it('TODAY_DAY is 70', () => {
    expect(TODAY_DAY).toBe(70);
  });

  it('today() returns 2026-05-14', () => {
    expect(today()).toBe('2026-05-14');
  });

  it('dayToDate(1) = 2026-03-06', () => {
    expect(dayToDate(1)).toBe('2026-03-06');
  });

  it('dayToDate(70) = 2026-05-14', () => {
    expect(dayToDate(70)).toBe('2026-05-14');
  });

  it('dayToDate(180) = 2026-09-02', () => {
    expect(dayToDate(180)).toBe('2026-09-02');
  });

  it('dateToDay round trips', () => {
    expect(dateToDay('2026-05-14')).toBe(70);
    expect(dateToDay('2026-03-06')).toBe(1);
  });

  it('dayDelta returns negative for past days', () => {
    expect(dayDelta(65)).toBe(-5);  // 5 days overdue
    expect(dayDelta(70)).toBe(0);
    expect(dayDelta(75)).toBe(5);
  });
});
```

- [ ] **Step 2: Run to verify fail**

```bash
npm run test -- lib/dates.test
```

Expected: FAIL.

- [ ] **Step 3: Write `lib/dates.ts`**

```ts
import { addDays, differenceInCalendarDays, format, parseISO } from 'date-fns';

export const PROJECT_DAY_ONE = '2026-03-06';
export const TODAY_DAY = 70;

const dayOneDate = parseISO(PROJECT_DAY_ONE);

export function today(): string {
  return dayToDate(TODAY_DAY);
}

export function dayToDate(day: number): string {
  // Day 1 = PROJECT_DAY_ONE, Day 2 = +1 calendar day, etc.
  return format(addDays(dayOneDate, day - 1), 'yyyy-MM-dd');
}

export function dateToDay(iso: string): number {
  return differenceInCalendarDays(parseISO(iso), dayOneDate) + 1;
}

export function dayDelta(targetDay: number): number {
  return targetDay - TODAY_DAY;
}

export function formatDateShort(iso: string): string {
  return format(parseISO(iso), 'MMM d');
}

export function formatDateLong(iso: string): string {
  return format(parseISO(iso), 'MMM d, yyyy');
}
```

- [ ] **Step 4: Run test to verify pass**

```bash
npm run test -- lib/dates.test
```

Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add builder-demo/lib/
git commit -m "feat(builder-demo): date helpers with Day 1 = 2026-03-06"
```

---

### Task 7: AED template parser + tests

**Files:**
- Create: `builder-demo/lib/aed-template.ts`, `builder-demo/lib/aed-template.test.ts`

The parser takes the AED template's raw shape `{s, e, d, p, m, dept}` and produces typed `TemplateTask[]`. We hardcode the SFH–With Planning Review subset in this file (not re-fetched at runtime) — see the spec §4 for the full 28-task table.

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect } from 'vitest';
import { SFH_WITH_PLANNING_REVIEW, TEMPLATE_TASKS } from './aed-template';

describe('aed-template SFH–With Planning Review', () => {
  it('totalDays is 180', () => {
    expect(SFH_WITH_PLANNING_REVIEW.totalDays).toBe(180);
  });
  it('has 28 tasks', () => {
    expect(TEMPLATE_TASKS).toHaveLength(28);
  });
  it('every task has start, end, department, phase', () => {
    for (const t of TEMPLATE_TASKS) {
      expect(t.startDay).toBeGreaterThanOrEqual(0);
      expect(t.endDay).toBeGreaterThan(t.startDay);
      expect(t.department).toBeTruthy();
      expect(t.phase).toBeTruthy();
      expect(t.title).toBeTruthy();
    }
  });
  it('first task is Utility Cutoff + Asbestos + J Number, day 7→15', () => {
    const first = TEMPLATE_TASKS[0];
    expect(first.title).toBe('Utility Cutoff + Asbestos + J Number');
    expect(first.startDay).toBe(7);
    expect(first.endDay).toBe(15);
    expect(first.phase).toBe('demo');
  });
});
```

- [ ] **Step 2: Run to verify fail**

```bash
npm run test -- lib/aed-template.test
```

- [ ] **Step 3: Write `lib/aed-template.ts`**

```ts
import type { DepartmentKey, PermitKey } from './types';

export interface TemplateTask {
  startDay: number;
  endDay: number;
  duration: number;     // endDay - startDay
  phase: PermitKey;
  department: DepartmentKey;
  title: string;
}

export const SFH_WITH_PLANNING_REVIEW = {
  name: 'SFH – With Planning Review',
  type: 'SFH – w/ Planning Review',
  bizLine: 'AL Homes',
  totalDays: 180,
  totalMonths: '6 months',
};

// Source: AED_Project_Timeline_Report.html → DATA["AL Homes"][1]
// 28 tasks, 12 phases. Day offsets are from project Day 1.
export const TEMPLATE_TASKS: TemplateTask[] = [
  // Demo Permit (5)
  { startDay:  7, endDay:  15, duration:  8, phase: 'demo',    department: 'Utility',         title: 'Utility Cutoff + Asbestos + J Number' },
  { startDay: 15, endDay:  45, duration: 30, phase: 'demo',    department: 'Permit',          title: 'Demo Permit Review' },
  { startDay: 45, endDay:  75, duration: 30, phase: 'demo',    department: 'Permit',          title: 'Demo Corrections / Resubmission' },
  { startDay: 75, endDay:  95, duration: 20, phase: 'demo',    department: 'Permit',          title: 'Demo Approval' },
  { startDay: 95, endDay: 110, duration: 15, phase: 'demo',    department: 'Permit',          title: 'Demo Permit Issuance' },
  // Tree Permit (1)
  { startDay: 15, endDay:  55, duration: 40, phase: 'tree',    department: 'Design',          title: 'Tree Removal Permit' },
  // Planning Review (3)
  { startDay: 20, endDay:  50, duration: 30, phase: 'planning',department: 'Planning',        title: 'Planning 1st Review' },
  { startDay: 50, endDay:  65, duration: 15, phase: 'planning',department: 'Planning',        title: 'Planning Corrections / Resubmission' },
  { startDay: 65, endDay:  80, duration: 15, phase: 'planning',department: 'Planning',        title: 'Planning Approval' },
  // Public Hearing (1)
  { startDay: 80, endDay:  95, duration: 15, phase: 'public-hearing', department: 'Planning', title: 'Planning Commission / Historic Review' },
  // Building Permit (2)
  { startDay: 100, endDay: 130, duration: 30, phase: 'building', department: 'Design',        title: '1st Submission → Comments' },
  { startDay: 130, endDay: 145, duration: 15, phase: 'building', department: 'Design',        title: 'Resubmission' },
  // Utility (3)
  { startDay: 100, endDay: 105, duration:  5, phase: 'utility',  department: 'Utility',       title: 'PG&E Will Serve' },
  { startDay: 100, endDay: 107, duration:  7, phase: 'utility',  department: 'Utility',       title: 'Water Will Serve' },
  { startDay: 100, endDay: 160, duration: 60, phase: 'utility',  department: 'Utility',       title: 'Sewer Will Serve' },
  // Grading Permit (1)
  { startDay: 100, endDay: 165, duration: 65, phase: 'grading',  department: 'Civil',         title: 'Grading Permit' },
  // Encroachment Permit (1)
  { startDay: 100, endDay: 160, duration: 60, phase: 'encroach', department: 'Civil',         title: 'Encroachment Permit' },
  // Design + Sales (4)
  { startDay: 145, endDay: 166, duration: 21, phase: 'design',   department: 'Interior Design', title: 'Interior Design Package' },
  { startDay: 145, endDay: 159, duration: 14, phase: 'design',   department: 'Landscape',       title: 'Landscape Design Package' },
  { startDay: 145, endDay: 159, duration: 14, phase: 'design',   department: 'Visualization',   title: 'Rendering / Exterior Package' },
  { startDay: 145, endDay: 166, duration: 21, phase: 'design',   department: 'Sales',           title: 'Sales Package' },
  // Permit Approval (1)
  { startDay: 145, endDay: 160, duration: 15, phase: 'approval', department: 'Design',         title: 'Final Approval' },
  // Post Permit (5)
  { startDay: 160, endDay: 205, duration:  45, phase: 'post',     department: 'Design',        title: 'Solar Permit' },
  { startDay: 160, endDay: 220, duration:  60, phase: 'post',     department: 'Design',        title: 'Fire Sprinkler Permit' },
  { startDay: 160, endDay: 340, duration: 180, phase: 'post',     department: 'Utility',       title: 'Electrical New Service' },
  { startDay: 160, endDay: 280, duration: 120, phase: 'post',     department: 'Utility',       title: 'Water New Service' },
  { startDay: 160, endDay: 220, duration:  60, phase: 'post',     department: 'Utility',       title: 'Sewer New Service' },
  // Permit Issuance (1)
  { startDay: 160, endDay: 180, duration:  20, phase: 'issuance', department: 'Design',        title: 'Final Permit Issuance' },
];
```

- [ ] **Step 4: Run test to verify pass**

```bash
npm run test -- lib/aed-template.test
```

Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add builder-demo/lib/
git commit -m "feat(builder-demo): encode SFH–With Planning Review template (28 tasks)"
```

---

### Task 8: Sample data builder + tests

Generates `Project`, `User[]`, and `Task[]` for 9 Greenwood Pl by instantiating the template plus status overlay (per spec §4).

**Files:**
- Create: `builder-demo/lib/sample-data.ts`, `builder-demo/lib/sample-data.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, it, expect } from 'vitest';
import { PROJECT, USERS, TASKS, JENNY_ID } from './sample-data';

describe('sample-data', () => {
  it('project is 9 Greenwood Pl', () => {
    expect(PROJECT.address).toContain('9 Greenwood Pl');
    expect(PROJECT.permitType).toBe('SFH – With Planning Review');
    expect(PROJECT.baselineStart).toBe('2026-03-06');
    expect(PROJECT.baselineEnd).toBe('2026-09-02');
    expect(PROJECT.health).toBe('At Risk');
  });

  it('has 8 users including Jenny', () => {
    expect(USERS).toHaveLength(8);
    expect(USERS.find(u => u.id === JENNY_ID)?.name).toBe('Jenny Wang');
  });

  it('has 29 tasks (28 template + 1 unplanned)', () => {
    expect(TASKS).toHaveLength(29);
    expect(TASKS.filter(t => t.source === 'unplanned')).toHaveLength(1);
  });

  it('Demo Corrections (task #3) is Needs Revision and owned by Jenny', () => {
    const t = TASKS.find(t => t.title === 'Demo Corrections / Resubmission')!;
    expect(t.status).toBe('Needs Revision');
    expect(t.ownerId).toBe(JENNY_ID);
    expect(t.reviewComment).toContain('asbestos');
  });

  it('Planning Corrections (task #8) is Delayed', () => {
    const t = TASKS.find(t => t.title === 'Planning Corrections / Resubmission')!;
    expect(t.status).toBe('Delayed');
    expect(t.plannedDueDay).toBe(65);
    expect(t.forecastDueDay).toBe(75);
  });

  it('tasks before today with end ≤ 50 are Done', () => {
    const tree = TASKS.find(t => t.title === 'Tree Removal Permit')!;
    expect(tree.status).toBe('Done');
    const planning1 = TASKS.find(t => t.title === 'Planning 1st Review')!;
    expect(planning1.status).toBe('Done');
  });

  it('tasks starting > Day 70 are Not Started or Blocked', () => {
    const issuance = TASKS.find(t => t.title === 'Final Permit Issuance')!;
    expect(['Not Started', 'Blocked']).toContain(issuance.status);
  });

  it('every task has an owner', () => {
    for (const t of TASKS) expect(t.ownerId).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run to verify fail**

```bash
npm run test -- lib/sample-data.test
```

- [ ] **Step 3: Write `lib/sample-data.ts`**

```ts
import type { Project, Task, User, UserId, DepartmentKey, TaskStatus, PermitKey } from './types';
import { TEMPLATE_TASKS } from './aed-template';
import { TODAY_DAY } from './dates';

export const SARAH_ID: UserId = 'user-sarah';
export const MIKE_ID: UserId = 'user-mike';
export const JENNY_ID: UserId = 'user-jenny';
export const DAVID_ID: UserId = 'user-david';
export const LISA_ID: UserId = 'user-lisa';
export const TOM_ID: UserId = 'user-tom';
export const EMMA_ID: UserId = 'user-emma';
export const ALEX_ID: UserId = 'user-alex';

export const USERS: User[] = [
  { id: SARAH_ID, name: 'Sarah Chen',      role: 'Project Manager',        departments: [],                                                             initials: 'SC', avatarColor: '#4F46E5' },
  { id: MIKE_ID,  name: 'Mike Rodriguez',  role: 'Design Team Lead',       departments: ['Design'],                                                     initials: 'MR', avatarColor: '#2563EB' },
  { id: JENNY_ID, name: 'Jenny Wang',      role: 'Permit Specialist',      departments: ['Permit'],                                                     initials: 'JW', avatarColor: '#E76F51' },
  { id: DAVID_ID, name: 'David Park',      role: 'Planning Specialist',    departments: ['Planning'],                                                   initials: 'DP', avatarColor: '#9333EA' },
  { id: LISA_ID,  name: 'Lisa Thompson',   role: 'Civil Engineer',         departments: ['Civil'],                                                      initials: 'LT', avatarColor: '#0891B2' },
  { id: TOM_ID,   name: 'Tom Williams',    role: 'Utility Coordinator',    departments: ['Utility'],                                                    initials: 'TW', avatarColor: '#D97706' },
  { id: EMMA_ID,  name: 'Emma Liu',        role: 'Designer',               departments: ['Interior Design', 'Landscape', 'Visualization', 'Sales'],     initials: 'EL', avatarColor: '#DB2777' },
  { id: ALEX_ID,  name: 'Alex Kumar',      role: 'Executive',              departments: [],                                                             initials: 'AK', avatarColor: '#475569' },
];

const DEPT_OWNER: Record<DepartmentKey, UserId> = {
  Design: MIKE_ID,
  Permit: JENNY_ID,
  Planning: DAVID_ID,
  Civil: LISA_ID,
  Utility: TOM_ID,
  'Interior Design': EMMA_ID,
  Landscape: EMMA_ID,
  Visualization: EMMA_ID,
  Sales: EMMA_ID,
};

// Default reviewer rules per spec §4
function reviewerFor(department: DepartmentKey): UserId | null {
  switch (department) {
    case 'Permit':   return SARAH_ID;
    case 'Planning': return MIKE_ID;
    case 'Design':   return SARAH_ID;
    default:         return SARAH_ID;  // PM signs off on cross-team work
  }
}

export const PROJECT: Project = {
  id: 'prj-9-greenwood-pl',
  name: '9 Greenwood Pl',
  address: '9 Greenwood Pl, Newton, MA',
  permitType: 'SFH – With Planning Review',
  purchaseDate: '2025-09-15',
  purchaseCost: 850000,
  ownerId: SARAH_ID,
  baselineStart: '2026-03-06',
  baselineEnd: '2026-09-02',
  forecastEnd: '2026-09-12',
  health: 'At Risk',
  currentPhase: 'planning',
};

function computeStatus(plannedEnd: number, plannedStart: number): TaskStatus {
  if (plannedEnd <= TODAY_DAY) return 'Done';
  if (plannedStart > TODAY_DAY) return 'Not Started';
  return 'In Progress';
}

interface StatusOverride {
  index: number;             // 0-based into TEMPLATE_TASKS
  status: TaskStatus;
  forecastDueDay?: number;
  reviewComment?: string;
  priority?: Task['priority'];
}

const OVERRIDES: StatusOverride[] = [
  { index: 2,  status: 'Needs Revision', forecastDueDay: 78,
    reviewComment: 'Missing asbestos clearance attachment. Please resubmit with cert.', priority: 'High' },
  { index: 3,  status: 'Blocked' },                            // Demo Approval
  { index: 4,  status: 'Blocked' },                            // Demo Permit Issuance
  { index: 7,  status: 'Delayed', forecastDueDay: 75, priority: 'Critical' },  // Planning Corrections
  { index: 8,  status: 'Blocked' },                            // Planning Approval
  { index: 9,  status: 'Blocked' },                            // Public Hearing
];

// Sequential within-phase dependencies; cross-phase per spec §4.
function buildDependencies(tasks: Task[]): void {
  // Demo Permit sequential
  for (let i = 1; i <= 4; i++) tasks[i].dependencyIds = [tasks[i - 1].id];
  // Planning Review sequential
  tasks[7].dependencyIds = [tasks[6].id];
  tasks[8].dependencyIds = [tasks[7].id];
  // Public Hearing depends on Planning Approval
  tasks[9].dependencyIds = [tasks[8].id];
  // Building Permit depends on Public Hearing (cross-phase)
  tasks[10].dependencyIds = [tasks[9].id];
  tasks[11].dependencyIds = [tasks[10].id];
  // Design + Sales depend on Building Permit Resubmission
  for (let i = 17; i <= 20; i++) tasks[i].dependencyIds = [tasks[11].id];
  // Permit Approval depends on Building Resubmission + Design+Sales
  tasks[21].dependencyIds = [tasks[11].id, ...tasks.slice(17, 21).map(t => t.id)];
  // Final Permit Issuance depends on Final Approval
  tasks[27].dependencyIds = [tasks[21].id];
}

const CRITICAL_PATH_INDEXES = new Set([6, 7, 8, 9, 10, 11, 21, 27]);

export const TASKS: Task[] = (() => {
  const tasks: Task[] = TEMPLATE_TASKS.map((t, i) => {
    const ownerId = DEPT_OWNER[t.department];
    const reviewerId = reviewerFor(t.department);
    let status: TaskStatus = computeStatus(t.endDay, t.startDay);
    if (status === 'In Progress' && t.startDay > TODAY_DAY) status = 'Not Started';
    return {
      id: `task-${String(i + 1).padStart(2, '0')}`,
      projectId: PROJECT.id,
      title: t.title,
      phase: t.phase,
      department: t.department,
      ownerId,
      reviewerId,
      status,
      priority: 'Medium',
      source: 'template',
      plannedStartDay: t.startDay,
      plannedDueDay: t.endDay,
      forecastStartDay: t.startDay,
      forecastDueDay: t.endDay,
      actualStartDay: status === 'Done' ? t.startDay : null,
      actualEndDay: status === 'Done' ? t.endDay : null,
      dependencyIds: [],
      isCriticalPath: CRITICAL_PATH_INDEXES.has(i),
    };
  });

  buildDependencies(tasks);

  for (const o of OVERRIDES) {
    const t = tasks[o.index];
    t.status = o.status;
    if (o.forecastDueDay !== undefined) t.forecastDueDay = o.forecastDueDay;
    if (o.reviewComment !== undefined) t.reviewComment = o.reviewComment;
    if (o.priority !== undefined) t.priority = o.priority;
    if (o.status === 'Needs Revision' || o.status === 'Delayed') {
      t.actualStartDay = t.plannedStartDay;
      t.actualEndDay = null;
    }
  }

  // Unplanned task (29th)
  tasks.push({
    id: 'task-29',
    projectId: PROJECT.id,
    title: 'Respond to neighbor zoning objection re: setback',
    phase: 'planning',
    department: 'Planning',
    ownerId: DAVID_ID,
    reviewerId: SARAH_ID,
    status: 'In Progress',
    priority: 'High',
    source: 'unplanned',
    plannedStartDay: 65,
    plannedDueDay: 70,
    forecastStartDay: 65,
    forecastDueDay: 73,
    actualStartDay: 65,
    actualEndDay: null,
    dependencyIds: [],
    isCriticalPath: false,
  });

  return tasks;
})();
```

- [ ] **Step 4: Run test to verify pass**

```bash
npm run test -- lib/sample-data.test
```

Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add builder-demo/lib/
git commit -m "feat(builder-demo): sample data for 9 Greenwood Pl with Day 70 status overlay"
```

---

### Task 9: Critical path computation + tests

Computes the critical path using forward + backward pass on day offsets and dependencies. We already hardcode `isCriticalPath` in sample-data, but this validates and supplies a reusable function the Gantt uses for highlighting.

**Files:**
- Create: `builder-demo/lib/critical-path.ts`, `builder-demo/lib/critical-path.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect } from 'vitest';
import { computeCriticalPath } from './critical-path';
import { TASKS } from './sample-data';

describe('critical-path', () => {
  it('includes Planning Review → Public Hearing → Building → Approval → Issuance', () => {
    const cp = computeCriticalPath(TASKS);
    const titles = TASKS.filter(t => cp.has(t.id)).map(t => t.title);
    expect(titles).toContain('Planning 1st Review');
    expect(titles).toContain('Planning Corrections / Resubmission');
    expect(titles).toContain('Planning Approval');
    expect(titles).toContain('Planning Commission / Historic Review');
    expect(titles).toContain('1st Submission → Comments');
    expect(titles).toContain('Resubmission');
    expect(titles).toContain('Final Approval');
    expect(titles).toContain('Final Permit Issuance');
  });
});
```

- [ ] **Step 2: Run to verify fail**

```bash
npm run test -- lib/critical-path.test
```

- [ ] **Step 3: Write `lib/critical-path.ts`**

```ts
import type { Task, TaskId } from './types';

// CPM forward + backward pass. We use forecastDueDay - forecastStartDay as duration
// to keep behavior consistent with downstream forecast shifts.
export function computeCriticalPath(tasks: Task[]): Set<TaskId> {
  const byId = new Map(tasks.map(t => [t.id, t]));
  const earliestFinish = new Map<TaskId, number>();
  const latestFinish = new Map<TaskId, number>();

  // Topological order via DFS
  const order: TaskId[] = [];
  const seen = new Set<TaskId>();
  function visit(id: TaskId) {
    if (seen.has(id)) return;
    seen.add(id);
    for (const dep of byId.get(id)?.dependencyIds ?? []) visit(dep);
    order.push(id);
  }
  for (const t of tasks) visit(t.id);

  // Forward pass
  for (const id of order) {
    const t = byId.get(id)!;
    const dur = t.forecastDueDay - t.forecastStartDay;
    const startConstraint = t.dependencyIds.length === 0
      ? t.forecastStartDay
      : Math.max(...t.dependencyIds.map(d => earliestFinish.get(d) ?? t.forecastStartDay));
    earliestFinish.set(id, startConstraint + dur);
  }

  const projectFinish = Math.max(...Array.from(earliestFinish.values()));

  // Backward pass: who blocks the project finish?
  for (const t of tasks) latestFinish.set(t.id, projectFinish);
  for (const id of [...order].reverse()) {
    const t = byId.get(id)!;
    // successors are tasks that list this id as a dependency
    const successors = tasks.filter(s => s.dependencyIds.includes(id));
    if (successors.length > 0) {
      const dur = t.forecastDueDay - t.forecastStartDay;
      const lf = Math.min(...successors.map(s => (latestFinish.get(s.id) ?? projectFinish) - (s.forecastDueDay - s.forecastStartDay)));
      latestFinish.set(id, lf);
    }
  }

  // Critical = zero slack
  const cp = new Set<TaskId>();
  for (const t of tasks) {
    const slack = (latestFinish.get(t.id) ?? 0) - (earliestFinish.get(t.id) ?? 0);
    if (slack === 0 && (earliestFinish.get(t.id) ?? 0) === projectFinish) {
      // walk back chain marking critical
      let cur: Task | undefined = t;
      while (cur) {
        cp.add(cur.id);
        const dep = cur.dependencyIds
          .map(id => byId.get(id))
          .filter((d): d is Task => !!d)
          .sort((a, b) => (earliestFinish.get(b.id) ?? 0) - (earliestFinish.get(a.id) ?? 0))[0];
        cur = dep;
      }
    }
  }
  return cp;
}
```

- [ ] **Step 4: Run test to verify pass**

```bash
npm run test -- lib/critical-path.test
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add builder-demo/lib/
git commit -m "feat(builder-demo): critical path computation with CPM forward/backward pass"
```

---

### Task 10: Zustand store + tests

**Files:**
- Create: `builder-demo/lib/store.ts`, `builder-demo/lib/store.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useDemoStore } from './store';
import { JENNY_ID, SARAH_ID } from './sample-data';

describe('store', () => {
  beforeEach(() => {
    useDemoStore.getState().resetDemo();
  });

  it('initial currentUserId is Jenny', () => {
    expect(useDemoStore.getState().currentUserId).toBe(JENNY_ID);
  });

  it('setCurrentUser switches role', () => {
    useDemoStore.getState().setCurrentUser(SARAH_ID);
    expect(useDemoStore.getState().currentUserId).toBe(SARAH_ID);
  });

  it('setStatus mutates a task', () => {
    const tasks = useDemoStore.getState().tasks;
    const someId = Object.keys(tasks)[0];
    useDemoStore.getState().setStatus(someId, 'Done');
    expect(useDemoStore.getState().tasks[someId].status).toBe('Done');
  });

  it('logs an ActivityEvent on status change', () => {
    const before = useDemoStore.getState().activity.length;
    const someId = Object.keys(useDemoStore.getState().tasks)[0];
    useDemoStore.getState().setStatus(someId, 'In Progress');
    expect(useDemoStore.getState().activity.length).toBe(before + 1);
  });
});
```

- [ ] **Step 2: Run to verify fail**

```bash
npm run test -- lib/store.test
```

- [ ] **Step 3: Write `lib/store.ts`**

```ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Task, TaskId, UserId, ActivityEvent, TaskStatus } from './types';
import { PROJECT, TASKS, USERS, JENNY_ID } from './sample-data';
import { today } from './dates';

interface DemoState {
  currentUserId: UserId;
  tasks: Record<TaskId, Task>;
  activity: ActivityEvent[];
  setCurrentUser: (id: UserId) => void;
  setStatus: (id: TaskId, status: TaskStatus, comment?: string) => void;
  submitForReview: (id: TaskId) => void;
  approve: (id: TaskId) => void;
  requestRevision: (id: TaskId, comment: string) => void;
  markDone: (id: TaskId) => void;
  reopen: (id: TaskId, reason: string) => void;
  addUnplanned: (task: Task) => void;
  resetDemo: () => void;
}

function initialTasksMap(): Record<TaskId, Task> {
  return Object.fromEntries(TASKS.map(t => [t.id, { ...t }]));
}

function pushActivity(state: DemoState, action: string, taskId?: TaskId, comment?: string): DemoState {
  return {
    ...state,
    activity: [
      ...state.activity,
      {
        id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        timestamp: today(),
        actorId: state.currentUserId,
        action,
        taskId,
        comment,
      },
    ],
  };
}

export const useDemoStore = create<DemoState>()(
  persist(
    (set, get) => ({
      currentUserId: JENNY_ID,
      tasks: initialTasksMap(),
      activity: [],

      setCurrentUser: (id) => set({ currentUserId: id }),

      setStatus: (id, status, comment) =>
        set((s) => pushActivity(
          { ...s, tasks: { ...s.tasks, [id]: { ...s.tasks[id], status, ...(comment && { reviewComment: comment }) } } },
          `changed status of "${s.tasks[id].title}" to ${status}`,
          id,
          comment,
        )),

      submitForReview: (id) =>
        set((s) => pushActivity(
          { ...s, tasks: { ...s.tasks, [id]: { ...s.tasks[id], status: 'Submitted for Review' } } },
          `submitted "${s.tasks[id].title}" for review`,
          id,
        )),

      approve: (id) =>
        set((s) => pushActivity(
          { ...s, tasks: { ...s.tasks, [id]: { ...s.tasks[id], status: 'Approved' } } },
          `approved "${s.tasks[id].title}"`,
          id,
        )),

      requestRevision: (id, comment) =>
        set((s) => pushActivity(
          { ...s, tasks: { ...s.tasks, [id]: { ...s.tasks[id], status: 'Needs Revision', reviewComment: comment } } },
          `requested revision on "${s.tasks[id].title}"`,
          id,
          comment,
        )),

      markDone: (id) =>
        set((s) => pushActivity(
          {
            ...s,
            tasks: { ...s.tasks, [id]: { ...s.tasks[id], status: 'Done', actualEndDay: 70 } },
          },
          `marked "${s.tasks[id].title}" done`,
          id,
        )),

      reopen: (id, reason) =>
        set((s) => pushActivity(
          { ...s, tasks: { ...s.tasks, [id]: { ...s.tasks[id], status: 'In Progress' } } },
          `reopened "${s.tasks[id].title}": ${reason}`,
          id,
          reason,
        )),

      addUnplanned: (task) =>
        set((s) => pushActivity(
          { ...s, tasks: { ...s.tasks, [task.id]: task } },
          `added unplanned task "${task.title}"`,
          task.id,
        )),

      resetDemo: () =>
        set({
          currentUserId: JENNY_ID,
          tasks: initialTasksMap(),
          activity: [],
        }),
    }),
    {
      name: 'builder-demo-state',
      // SSR-safe: skip hydration on server
      skipHydration: typeof window === 'undefined',
    },
  ),
);

// Static re-exports for convenience
export { PROJECT, USERS };
```

- [ ] **Step 4: Run test to verify pass**

```bash
npm run test -- lib/store.test
```

Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add builder-demo/lib/
git commit -m "feat(builder-demo): Zustand store with persist and activity logging"
```

---

## Phase C — Shared UI (3 tasks)

### Task 11: Shared atoms (badges, chips, avatar, priority dot)

**Files:**
- Create: `builder-demo/components/shared/status-badge.tsx`, `permit-chip.tsx`, `priority-dot.tsx`, `avatar.tsx`, `three-layer-dates.tsx`

- [ ] **Step 1: `components/shared/permit-chip.tsx`**

```tsx
import { getPermit } from '@/lib/permits';
import type { PermitKey } from '@/lib/types';

export function PermitChip({ permit, size = 'sm' }: { permit: PermitKey; size?: 'sm' | 'md' }) {
  const p = getPermit(permit);
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium ${size === 'md' ? 'text-sm px-2.5 py-1' : ''}`}
      style={{ backgroundColor: `${p.hex}1A`, color: p.hex }}
    >
      <span className="size-1.5 rounded-full" style={{ backgroundColor: p.hex }} />
      {p.label}
    </span>
  );
}
```

- [ ] **Step 2: `components/shared/status-badge.tsx`**

```tsx
import type { TaskStatus } from '@/lib/types';
import { CheckCircle2, Clock, AlertTriangle, Lock, CircleDot, Loader2, Check, XCircle, Hourglass } from 'lucide-react';

const STATUS_STYLE: Record<TaskStatus, { color: string; bg: string; Icon: typeof CheckCircle2 }> = {
  'Not Started':           { color: '#64748B', bg: '#F1F5F9', Icon: CircleDot },
  'Ready':                 { color: '#0F766E', bg: '#CCFBF1', Icon: CircleDot },
  'In Progress':           { color: '#1D4ED8', bg: '#DBEAFE', Icon: Loader2 },
  'Submitted for Review':  { color: '#7E22CE', bg: '#F3E8FF', Icon: Hourglass },
  'Needs Revision':        { color: '#B45309', bg: '#FEF3C7', Icon: AlertTriangle },
  'Approved':              { color: '#047857', bg: '#D1FAE5', Icon: Check },
  'Done':                  { color: '#047857', bg: '#D1FAE5', Icon: CheckCircle2 },
  'Delayed':               { color: '#B91C1C', bg: '#FEE2E2', Icon: Clock },
  'Blocked':               { color: '#475569', bg: '#E2E8F0', Icon: Lock },
  'Cancelled':             { color: '#94A3B8', bg: '#F8FAFC', Icon: XCircle },
};

export function StatusBadge({ status }: { status: TaskStatus }) {
  const s = STATUS_STYLE[status];
  return (
    <span
      className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium"
      style={{ color: s.color, backgroundColor: s.bg }}
    >
      <s.Icon className="size-3" />
      {status}
    </span>
  );
}
```

- [ ] **Step 3: `components/shared/priority-dot.tsx`**

```tsx
import type { Priority } from '@/lib/types';

const COLORS: Record<Priority, string> = {
  Low: '#94A3B8',
  Medium: '#3B82F6',
  High: '#F59E0B',
  Critical: '#EF4444',
};

export function PriorityDot({ priority }: { priority: Priority }) {
  return (
    <span
      title={`Priority: ${priority}`}
      className="inline-block size-2 rounded-full"
      style={{ backgroundColor: COLORS[priority] }}
    />
  );
}
```

- [ ] **Step 4: `components/shared/avatar.tsx`**

```tsx
import type { User } from '@/lib/types';

export function Avatar({ user, size = 24 }: { user: User; size?: number }) {
  return (
    <span
      title={user.name}
      className="inline-flex items-center justify-center rounded-full text-white text-[10px] font-semibold"
      style={{ width: size, height: size, backgroundColor: user.avatarColor, fontSize: size * 0.4 }}
    >
      {user.initials}
    </span>
  );
}
```

- [ ] **Step 5: `components/shared/three-layer-dates.tsx`**

```tsx
import { dayToDate, formatDateShort } from '@/lib/dates';

export function ThreeLayerDates({
  plannedStart, plannedDue, forecastStart, forecastDue, actualStart, actualEnd,
}: {
  plannedStart: number; plannedDue: number;
  forecastStart: number; forecastDue: number;
  actualStart: number | null; actualEnd: number | null;
}) {
  return (
    <div className="grid grid-cols-3 gap-3 text-xs">
      <div>
        <div className="text-muted-foreground uppercase tracking-wide">Baseline</div>
        <div className="font-medium">{formatDateShort(dayToDate(plannedStart))} → {formatDateShort(dayToDate(plannedDue))}</div>
      </div>
      <div>
        <div className="text-muted-foreground uppercase tracking-wide">Forecast</div>
        <div className="font-medium">{formatDateShort(dayToDate(forecastStart))} → {formatDateShort(dayToDate(forecastDue))}</div>
      </div>
      <div>
        <div className="text-muted-foreground uppercase tracking-wide">Actual</div>
        <div className="font-medium">
          {actualStart ? formatDateShort(dayToDate(actualStart)) : '—'} → {actualEnd ? formatDateShort(dayToDate(actualEnd)) : '—'}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Verify build**

```bash
npm run build
```

Expected: success (no UI uses these yet, but they compile).

- [ ] **Step 7: Commit**

```bash
git add builder-demo/components/shared/
git commit -m "feat(builder-demo): shared atoms (status badge, permit chip, avatar, etc.)"
```

---

### Task 12: Layout shell — sidebar, topbar, role switcher

**Files:**
- Create: `builder-demo/components/layout/sidebar.tsx`, `topbar.tsx`, `role-switcher.tsx`, `app-shell.tsx`
- Modify: `builder-demo/app/layout.tsx`

- [ ] **Step 1: `components/layout/sidebar.tsx`**

```tsx
'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, FolderKanban, ListChecks, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV = [
  { href: '/',                       label: 'Dashboard',    icon: LayoutDashboard },
  { href: '/projects/prj-9-greenwood-pl', label: '9 Greenwood Pl', icon: FolderKanban },
  { href: '/my-tasks',               label: 'My Tasks',     icon: ListChecks },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="w-60 shrink-0 border-r border-border bg-card flex flex-col">
      <div className="h-16 flex items-center gap-2 px-5 border-b border-border">
        <Building2 className="size-5 text-primary" />
        <span className="font-semibold text-sm tracking-tight">BuildFlow</span>
        <span className="text-[10px] text-muted-foreground ml-auto">Demo</span>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== '/' && pathname.startsWith(href));
          return (
            <Link key={href} href={href}
              className={cn(
                'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors',
                active ? 'bg-accent text-accent-foreground font-medium' : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
              )}>
              <Icon className="size-4" />
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
```

- [ ] **Step 2: `components/layout/role-switcher.tsx`**

```tsx
'use client';
import { useDemoStore } from '@/lib/store';
import { USERS } from '@/lib/sample-data';
import { Avatar } from '@/components/shared/avatar';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChevronDown } from 'lucide-react';

export function RoleSwitcher() {
  const currentUserId = useDemoStore((s) => s.currentUserId);
  const setCurrentUser = useDemoStore((s) => s.setCurrentUser);
  const current = USERS.find((u) => u.id === currentUserId)!;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 rounded-md border border-border bg-card px-2.5 py-1.5 text-sm hover:bg-accent">
        <Avatar user={current} size={20} />
        <span className="font-medium">{current.name}</span>
        <span className="text-xs text-muted-foreground">· {current.role}</span>
        <ChevronDown className="size-3.5 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>View as</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {USERS.map((u) => (
          <DropdownMenuItem key={u.id} onClick={() => setCurrentUser(u.id)}>
            <Avatar user={u} size={20} />
            <div className="ml-2 flex flex-col">
              <span className="text-sm">{u.name}</span>
              <span className="text-xs text-muted-foreground">{u.role}</span>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

- [ ] **Step 3: `components/layout/topbar.tsx`**

```tsx
'use client';
import { useDemoStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { RoleSwitcher } from './role-switcher';
import { RotateCcw } from 'lucide-react';

export function Topbar({ title }: { title: string }) {
  const reset = useDemoStore((s) => s.resetDemo);
  return (
    <header className="h-16 shrink-0 border-b border-border bg-background flex items-center justify-between px-6">
      <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={reset} title="Reset demo state">
          <RotateCcw className="size-3.5 mr-1.5" /> Reset
        </Button>
        <RoleSwitcher />
      </div>
    </header>
  );
}
```

- [ ] **Step 4: `components/layout/app-shell.tsx`**

```tsx
import { Sidebar } from './sidebar';
import { Topbar } from './topbar';

export function AppShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Topbar title={title} />
        <main className="flex-1 overflow-y-auto p-6 bg-muted/30">
          {children}
        </main>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Replace `app/page.tsx` with a stub using AppShell**

```tsx
import { AppShell } from '@/components/layout/app-shell';

export default function DashboardPage() {
  return (
    <AppShell title="Dashboard">
      <div className="text-muted-foreground">Dashboard content coming soon.</div>
    </AppShell>
  );
}
```

- [ ] **Step 6: Verify dev**

```bash
npm run dev
```

Then in another shell:

```bash
curl -s http://localhost:3000/ | grep -o "BuildFlow" | head -1
```

Expected: prints `BuildFlow`. Stop the dev server.

- [ ] **Step 7: Commit**

```bash
git add builder-demo/
git commit -m "feat(builder-demo): app shell with sidebar, topbar, role switcher"
```

---

### Task 13: Completion toast + animation primitives

**Files:**
- Create: `builder-demo/components/shared/completion-toast.tsx`, `builder-demo/components/providers.tsx`
- Modify: `builder-demo/app/layout.tsx`

- [ ] **Step 1: `components/providers.tsx`**

```tsx
'use client';
import { Toaster } from '@/components/ui/toast';
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Toaster />
    </>
  );
}
```

If shadcn's toast install gave you `sonner` instead of `toast`, use:

```tsx
'use client';
import { Toaster } from 'sonner';
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Toaster position="bottom-right" richColors />
    </>
  );
}
```

- [ ] **Step 2: `components/shared/completion-toast.tsx`**

```tsx
'use client';
import { toast } from 'sonner';
import type { Task } from '@/lib/types';
import { useDemoStore } from '@/lib/store';

export function showCompletionToast(task: Task, previousStatus: Task['status']) {
  toast.success(`Marked "${task.title}" done`, {
    description: 'It moved to History.',
    action: {
      label: 'Undo',
      onClick: () => useDemoStore.getState().setStatus(task.id, previousStatus),
    },
    duration: 8000,
  });
}
```

If you went the shadcn `toast` (non-sonner) route, install sonner now:

```bash
npm install sonner
```

And keep the same import.

- [ ] **Step 3: Wire `Providers` in `app/layout.tsx`**

In the body of `RootLayout`, wrap `{children}` with `<Providers>`:

```tsx
import { Providers } from '@/components/providers';
// ...
<body className="font-sans antialiased bg-background text-foreground">
  <Providers>{children}</Providers>
</body>
```

- [ ] **Step 4: Verify build**

```bash
npm run build
```

- [ ] **Step 5: Commit**

```bash
git add builder-demo/
git commit -m "feat(builder-demo): completion toast primitive with undo"
```

---

## Phase D — Dashboard (2 tasks)

### Task 14: Dashboard KPI cards + permit stage stepper

**Files:**
- Create: `builder-demo/components/dashboard/kpi-card.tsx`, `permit-stage-stepper.tsx`, `dashboard-kpis.ts`

- [ ] **Step 1: `lib/dashboard-kpis.ts`**

```ts
import type { Task } from './types';
import { TODAY_DAY } from './dates';

export function computeKpis(tasks: Task[]) {
  const overdue = tasks.filter(t => t.plannedDueDay < TODAY_DAY && t.status !== 'Done' && t.status !== 'Approved').length;
  const needsRevision = tasks.filter(t => t.status === 'Needs Revision').length;
  const criticalOverdue = tasks.filter(t => t.isCriticalPath && t.status === 'Delayed').length;
  const upcoming7d = tasks.filter(t => t.plannedDueDay >= TODAY_DAY && t.plannedDueDay <= TODAY_DAY + 7).length;
  return {
    activeProjects: 1,
    atRisk: 1,
    overdue,
    needsRevision,
    criticalOverdue,
    upcoming7d,
  };
}
```

- [ ] **Step 2: `components/dashboard/kpi-card.tsx`**

```tsx
import { cn } from '@/lib/utils';

export function KpiCard({ label, value, tone = 'default' }: {
  label: string; value: number | string;
  tone?: 'default' | 'warn' | 'danger' | 'success';
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={cn(
        'text-2xl font-semibold mt-1',
        tone === 'warn'    && 'text-amber-600',
        tone === 'danger'  && 'text-red-600',
        tone === 'success' && 'text-emerald-600',
      )}>{value}</div>
    </div>
  );
}
```

- [ ] **Step 3: `components/dashboard/permit-stage-stepper.tsx`**

```tsx
import { PHASE_ORDER, PERMITS } from '@/lib/permits';
import type { PermitKey } from '@/lib/types';
import { Check } from 'lucide-react';

export function PermitStageStepper({ current, completed }: { current: PermitKey; completed: Set<PermitKey> }) {
  const currentIdx = PHASE_ORDER.indexOf(current);
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="text-sm font-medium mb-3">Permit stage</div>
      <ol className="flex items-center gap-2 overflow-x-auto pb-1">
        {PHASE_ORDER.map((key, i) => {
          const p = PERMITS[key];
          const isDone = completed.has(key) || i < currentIdx;
          const isCurrent = i === currentIdx;
          return (
            <li key={key} className="flex items-center gap-2 shrink-0">
              <span
                className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium border"
                style={{
                  borderColor: isCurrent ? p.hex : '#E2E8F0',
                  backgroundColor: isCurrent ? `${p.hex}1A` : isDone ? '#F1F5F9' : 'transparent',
                  color: isCurrent ? p.hex : isDone ? '#64748B' : '#94A3B8',
                }}
              >
                {isDone && <Check className="size-3" />}
                {p.label}
              </span>
              {i < PHASE_ORDER.length - 1 && <span className="text-muted-foreground/40">→</span>}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
```

- [ ] **Step 4: Verify build**

```bash
npm run build
```

- [ ] **Step 5: Commit**

```bash
git add builder-demo/
git commit -m "feat(builder-demo): dashboard KPI cards and permit stage stepper"
```

---

### Task 15: Dashboard remaining widgets + page wiring

**Files:**
- Create: `builder-demo/components/dashboard/project-status-table.tsx`, `team-workload.tsx`, `upcoming-deadlines.tsx`
- Modify: `builder-demo/app/page.tsx`

- [ ] **Step 1: `components/dashboard/project-status-table.tsx`**

```tsx
'use client';
import Link from 'next/link';
import { PROJECT, USERS } from '@/lib/sample-data';
import { PermitChip } from '@/components/shared/permit-chip';
import { Avatar } from '@/components/shared/avatar';
import { formatDateShort } from '@/lib/dates';
import { differenceInCalendarDays, parseISO } from 'date-fns';

export function ProjectStatusTable() {
  const owner = USERS.find(u => u.id === PROJECT.ownerId)!;
  const variance = differenceInCalendarDays(parseISO(PROJECT.forecastEnd), parseISO(PROJECT.baselineEnd));
  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border text-sm font-medium">Projects</div>
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="text-left px-4 py-2 font-medium">Project</th>
            <th className="text-left px-4 py-2 font-medium">Phase</th>
            <th className="text-left px-4 py-2 font-medium">Forecast End</th>
            <th className="text-left px-4 py-2 font-medium">Variance</th>
            <th className="text-left px-4 py-2 font-medium">Owner</th>
            <th className="text-left px-4 py-2 font-medium">Health</th>
          </tr>
        </thead>
        <tbody>
          <tr className="hover:bg-accent/50">
            <td className="px-4 py-3">
              <Link href={`/projects/${PROJECT.id}`} className="font-medium hover:underline">
                {PROJECT.name}
              </Link>
              <div className="text-xs text-muted-foreground">{PROJECT.address}</div>
            </td>
            <td className="px-4 py-3"><PermitChip permit={PROJECT.currentPhase} /></td>
            <td className="px-4 py-3">{formatDateShort(PROJECT.forecastEnd)}</td>
            <td className="px-4 py-3 text-red-600 font-medium">+{variance}d</td>
            <td className="px-4 py-3"><div className="flex items-center gap-2"><Avatar user={owner} /> {owner.name}</div></td>
            <td className="px-4 py-3"><span className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-800">{PROJECT.health}</span></td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 2: `components/dashboard/team-workload.tsx`**

```tsx
import { USERS } from '@/lib/sample-data';
import { useDemoStore } from '@/lib/store';
import { Avatar } from '@/components/shared/avatar';
import { TODAY_DAY } from '@/lib/dates';

export function TeamWorkload() {
  const tasks = useDemoStore((s) => Object.values(s.tasks));
  const rows = USERS.map(u => {
    const owned = tasks.filter(t => t.ownerId === u.id && t.status !== 'Done' && t.status !== 'Approved');
    const overdue = owned.filter(t => t.plannedDueDay < TODAY_DAY).length;
    const reviewQueue = tasks.filter(t => t.reviewerId === u.id && t.status === 'Submitted for Review').length;
    return { user: u, active: owned.length, overdue, reviewQueue };
  }).sort((a, b) => b.overdue - a.overdue);

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="text-sm font-medium mb-3">Team workload</div>
      <div className="space-y-2">
        {rows.map(r => (
          <div key={r.user.id} className="flex items-center gap-3 text-sm">
            <Avatar user={r.user} />
            <div className="flex-1">
              <div className="font-medium">{r.user.name}</div>
              <div className="text-xs text-muted-foreground">{r.user.role}</div>
            </div>
            <span className="text-xs text-muted-foreground">Active</span><span className="font-medium tabular-nums">{r.active}</span>
            <span className="text-xs text-muted-foreground">Overdue</span>
            <span className={`font-medium tabular-nums ${r.overdue > 0 ? 'text-red-600' : ''}`}>{r.overdue}</span>
            <span className="text-xs text-muted-foreground">Review</span><span className="font-medium tabular-nums">{r.reviewQueue}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: `components/dashboard/upcoming-deadlines.tsx`**

```tsx
'use client';
import { useDemoStore } from '@/lib/store';
import { USERS } from '@/lib/sample-data';
import { TODAY_DAY, dayToDate, formatDateShort } from '@/lib/dates';
import { PermitChip } from '@/components/shared/permit-chip';
import { Avatar } from '@/components/shared/avatar';

export function UpcomingDeadlines() {
  const tasks = useDemoStore((s) => Object.values(s.tasks));
  const userById = new Map(USERS.map(u => [u.id, u]));
  const upcoming = tasks
    .filter(t => t.plannedDueDay >= TODAY_DAY && t.plannedDueDay <= TODAY_DAY + 14 && t.status !== 'Done')
    .sort((a, b) => a.plannedDueDay - b.plannedDueDay)
    .slice(0, 8);

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="text-sm font-medium mb-3">Upcoming deadlines (next 14 days)</div>
      <ul className="space-y-2">
        {upcoming.map(t => (
          <li key={t.id} className="flex items-center gap-3 text-sm py-1">
            <span className="text-xs text-muted-foreground tabular-nums w-16">{formatDateShort(dayToDate(t.plannedDueDay))}</span>
            <span className="flex-1 truncate">{t.title}</span>
            <PermitChip permit={t.phase} />
            <Avatar user={userById.get(t.ownerId)!} />
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 4: Wire `app/page.tsx`**

```tsx
'use client';
import { AppShell } from '@/components/layout/app-shell';
import { KpiCard } from '@/components/dashboard/kpi-card';
import { PermitStageStepper } from '@/components/dashboard/permit-stage-stepper';
import { ProjectStatusTable } from '@/components/dashboard/project-status-table';
import { TeamWorkload } from '@/components/dashboard/team-workload';
import { UpcomingDeadlines } from '@/components/dashboard/upcoming-deadlines';
import { useDemoStore } from '@/lib/store';
import { computeKpis } from '@/lib/dashboard-kpis';
import { PROJECT } from '@/lib/sample-data';
import type { PermitKey } from '@/lib/types';

export default function DashboardPage() {
  const tasks = useDemoStore((s) => Object.values(s.tasks));
  const kpi = computeKpis(tasks);
  const completedPhases = new Set<PermitKey>(['tree']);  // demo: only Tree fully done
  return (
    <AppShell title="Dashboard">
      <div className="space-y-4 max-w-screen-2xl">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <KpiCard label="Active projects" value={kpi.activeProjects} />
          <KpiCard label="At risk" value={kpi.atRisk} tone="warn" />
          <KpiCard label="Overdue" value={kpi.overdue} tone="danger" />
          <KpiCard label="Needs revision" value={kpi.needsRevision} tone="warn" />
          <KpiCard label="Critical-path overdue" value={kpi.criticalOverdue} tone="danger" />
          <KpiCard label="Due ≤ 7 days" value={kpi.upcoming7d} />
        </div>

        <ProjectStatusTable />
        <PermitStageStepper current={PROJECT.currentPhase} completed={completedPhases} />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <TeamWorkload />
          <UpcomingDeadlines />
        </div>
      </div>
    </AppShell>
  );
}
```

- [ ] **Step 5: Smoke test in browser**

```bash
npm run dev
```

Open `http://localhost:3000/`. Expected: dashboard renders with 6 KPI cards, 1 project row, 12-step stepper, team workload (Jenny has 1 overdue), upcoming deadlines list. Stop dev server.

- [ ] **Step 6: Commit**

```bash
git add builder-demo/
git commit -m "feat(builder-demo): dashboard page wired with KPIs, status table, workload, deadlines"
```

---

## Phase E — Project Page (5 tasks)

### Task 16: Project page route, summary header, sub-tab nav, Overview tab

**Files:**
- Create: `builder-demo/app/projects/[id]/page.tsx`, `components/project/project-summary.tsx`, `overview-tab.tsx`

- [ ] **Step 1: `components/project/project-summary.tsx`**

```tsx
import { PROJECT, USERS } from '@/lib/sample-data';
import { Avatar } from '@/components/shared/avatar';
import { PermitChip } from '@/components/shared/permit-chip';
import { formatDateLong } from '@/lib/dates';
import { Home, Calendar, DollarSign } from 'lucide-react';
import { differenceInCalendarDays, parseISO } from 'date-fns';

export function ProjectSummary() {
  const owner = USERS.find(u => u.id === PROJECT.ownerId)!;
  const slip = differenceInCalendarDays(parseISO(PROJECT.forecastEnd), parseISO(PROJECT.baselineEnd));
  return (
    <div className="rounded-lg border border-border bg-card p-5 flex gap-5">
      <div className="size-32 rounded-md bg-muted flex items-center justify-center text-muted-foreground shrink-0">
        <Home className="size-10" />
      </div>
      <div className="flex-1 space-y-2">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold tracking-tight">{PROJECT.name}</h2>
          <PermitChip permit={PROJECT.currentPhase} />
          <span className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-800">{PROJECT.health}</span>
        </div>
        <div className="text-sm text-muted-foreground">{PROJECT.address} · {PROJECT.permitType}</div>
        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground pt-2">
          <span className="inline-flex items-center gap-1.5"><Calendar className="size-3.5" /> Purchased {formatDateLong(PROJECT.purchaseDate)}</span>
          <span className="inline-flex items-center gap-1.5"><DollarSign className="size-3.5" /> ${PROJECT.purchaseCost.toLocaleString()}</span>
          <span>Baseline end: {formatDateLong(PROJECT.baselineEnd)}</span>
          <span className="text-red-600 font-medium">Forecast end: {formatDateLong(PROJECT.forecastEnd)} (+{slip}d)</span>
        </div>
        <div className="flex items-center gap-2 text-xs pt-1">
          <span className="text-muted-foreground">Project owner</span>
          <Avatar user={owner} /><span className="font-medium">{owner.name}</span>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: `components/project/overview-tab.tsx`**

```tsx
'use client';
import { useDemoStore } from '@/lib/store';
import { TODAY_DAY } from '@/lib/dates';
import { computeKpis } from '@/lib/dashboard-kpis';
import { KpiCard } from '@/components/dashboard/kpi-card';

export function OverviewTab() {
  const tasks = useDemoStore((s) => Object.values(s.tasks));
  const kpi = computeKpis(tasks);
  const done = tasks.filter(t => t.status === 'Done').length;
  const pct = Math.round((done / tasks.length) * 100);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Day elapsed" value={`${TODAY_DAY} / 180`} />
        <KpiCard label="% complete" value={`${pct}%`} />
        <KpiCard label="Delayed" value={tasks.filter(t => t.status === 'Delayed').length} tone="danger" />
        <KpiCard label="Needs revision" value={kpi.needsRevision} tone="warn" />
      </div>
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="text-sm font-medium mb-2">Critical path</div>
        <div className="text-xs text-muted-foreground">
          Planning Corrections is 5 days overdue and sits on the critical path. Its slip propagates through Public Hearing, Building Permit, Final Approval, and Permit Issuance — pushing forecast end by +10 days.
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: `app/projects/[id]/page.tsx`**

```tsx
'use client';
import { AppShell } from '@/components/layout/app-shell';
import { ProjectSummary } from '@/components/project/project-summary';
import { OverviewTab } from '@/components/project/overview-tab';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function ProjectPage() {
  return (
    <AppShell title="9 Greenwood Pl">
      <div className="space-y-4 max-w-screen-2xl">
        <ProjectSummary />
        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
            <TabsTrigger value="tasks">Tasks</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
          </TabsList>
          <TabsContent value="overview" className="mt-4"><OverviewTab /></TabsContent>
          <TabsContent value="timeline" className="mt-4">Gantt — see Task 17.</TabsContent>
          <TabsContent value="tasks" className="mt-4">Task table — see Task 20.</TabsContent>
          <TabsContent value="activity" className="mt-4">Activity — see Task 21.</TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
```

The dynamic route uses `[id]` but the demo only has one project — for static export we need `generateStaticParams`. Add to the same file:

```tsx
export function generateStaticParams() {
  return [{ id: 'prj-9-greenwood-pl' }];
}
```

But since the page is `'use client'`, `generateStaticParams` must be in a separate server component. Easier path: split into a server wrapper.

Restructure as **two files**:

`app/projects/[id]/page.tsx` (server):
```tsx
import { ProjectPageClient } from './project-page-client';
export function generateStaticParams() {
  return [{ id: 'prj-9-greenwood-pl' }];
}
export default function Page() {
  return <ProjectPageClient />;
}
```

`app/projects/[id]/project-page-client.tsx` (client) — put the previously-shown `'use client'` page body here, renamed to `export function ProjectPageClient()`.

- [ ] **Step 4: Smoke test**

```bash
npm run dev
```

Visit `http://localhost:3000/projects/prj-9-greenwood-pl/`. Expected: summary header + tabs with Overview populated.

- [ ] **Step 5: Commit**

```bash
git add builder-demo/
git commit -m "feat(builder-demo): project page route with summary header and Overview tab"
```

---

### Task 17: Gantt chart — bars and axes only

This is the centerpiece. We build it in 3 incremental tasks: (17) bars + axes, (18) three-layer rendering + status overlay + today line, (19) toolbar + dependency arrows + drawer integration.

**Files:**
- Create: `builder-demo/components/project/gantt-chart.tsx`, `gantt-bar.tsx`, `gantt-types.ts`

- [ ] **Step 1: `components/project/gantt-types.ts`**

```ts
import type { Task, PermitKey } from '@/lib/types';

export interface GanttRow {
  task: Task;
  rowIndex: number;
}

export interface PhaseGroup {
  phase: PermitKey;
  rows: GanttRow[];
  startIndex: number;
  endIndex: number;
}

export function groupByPhase(tasks: Task[]): PhaseGroup[] {
  const order = ['demo','tree','planning','public-hearing','building','utility','grading','encroach','design','approval','post','issuance'] as PermitKey[];
  const groups: PhaseGroup[] = [];
  let cursor = 0;
  for (const phase of order) {
    const phaseTasks = tasks.filter(t => t.phase === phase);
    if (phaseTasks.length === 0) continue;
    const rows = phaseTasks.map((task, i) => ({ task, rowIndex: cursor + i }));
    groups.push({ phase, rows, startIndex: cursor, endIndex: cursor + rows.length - 1 });
    cursor += rows.length;
  }
  return groups;
}
```

- [ ] **Step 2: `components/project/gantt-bar.tsx`**

```tsx
import type { Task } from '@/lib/types';
import { getPermit } from '@/lib/permits';

const STATUS_OVERLAY: Record<Task['status'], { fillOpacity: number; stroke?: string; strokeDasharray?: string; pattern?: boolean }> = {
  'Not Started':           { fillOpacity: 0,    strokeDasharray: '4 4' },
  'Ready':                 { fillOpacity: 0.15, strokeDasharray: '4 4' },
  'In Progress':           { fillOpacity: 1 },
  'Submitted for Review':  { fillOpacity: 1, pattern: true },
  'Needs Revision':        { fillOpacity: 1, stroke: '#F59E0B' },
  'Approved':              { fillOpacity: 1 },
  'Done':                  { fillOpacity: 1 },
  'Delayed':               { fillOpacity: 1, stroke: '#EF4444' },
  'Blocked':               { fillOpacity: 0.4 },
  'Cancelled':             { fillOpacity: 0.2 },
};

export function GanttBar({
  task, x, y, baselineWidth, forecastWidth, rowHeight, dayToX,
}: {
  task: Task;
  x: number;            // baseline left
  y: number;            // top of row
  baselineWidth: number;
  forecastWidth: number;   // 0 if no forecast extension
  rowHeight: number;
  dayToX: (day: number) => number;
}) {
  const p = getPermit(task.phase);
  const overlay = STATUS_OVERLAY[task.status];
  const barH = rowHeight * 0.55;
  const barY = y + (rowHeight - barH) / 2;
  const baselineColor = p.hex;

  const actualX = task.actualStartDay !== null ? dayToX(task.actualStartDay) : null;
  const actualEnd = task.actualEndDay ?? (task.status === 'In Progress' || task.status === 'Delayed' || task.status === 'Needs Revision' ? null : null);
  const actualWidth = actualX !== null ? (actualEnd !== null ? dayToX(actualEnd) - actualX : 0) : 0;

  return (
    <g>
      {/* Baseline outline */}
      <rect
        x={x} y={barY} width={baselineWidth} height={barH}
        fill="none" stroke={baselineColor} strokeWidth={1.5} strokeDasharray="3 3"
        rx={3}
      />
      {/* Forecast tint */}
      {forecastWidth > baselineWidth && (
        <rect
          x={x + baselineWidth} y={barY} width={forecastWidth - baselineWidth} height={barH}
          fill={baselineColor} fillOpacity={0.18} rx={2}
        />
      )}
      {/* Actual fill (or hatch for review) */}
      {overlay.fillOpacity > 0 && (
        <rect
          x={x} y={barY} width={Math.max(actualWidth, baselineWidth)} height={barH}
          fill={baselineColor} fillOpacity={overlay.fillOpacity}
          stroke={overlay.stroke ?? 'none'} strokeWidth={overlay.stroke ? 2 : 0}
          rx={3}
        />
      )}
      {/* Critical path glow */}
      {task.isCriticalPath && (
        <rect
          x={x - 1} y={barY - 1} width={Math.max(baselineWidth, forecastWidth) + 2} height={barH + 2}
          fill="none" stroke="#F59E0B" strokeWidth={1} strokeOpacity={0.5} rx={4}
        />
      )}
    </g>
  );
}
```

- [ ] **Step 3: `components/project/gantt-chart.tsx`**

```tsx
'use client';
import { useDemoStore } from '@/lib/store';
import { groupByPhase } from './gantt-types';
import { GanttBar } from './gantt-bar';
import { getPermit } from '@/lib/permits';
import { TODAY_DAY } from '@/lib/dates';

const ROW_H = 28;
const HEADER_H = 32;
const LABEL_W = 280;
const DAY_W = 6;          // pixels per day
const PROJECT_DAYS = 200; // include some Post Permit overflow

function dayToX(day: number): number {
  return LABEL_W + day * DAY_W;
}

export function GanttChart() {
  const tasks = useDemoStore((s) => Object.values(s.tasks));
  const groups = groupByPhase(tasks);
  const totalRows = groups.reduce((n, g) => n + g.rows.length, 0);
  const totalHeight = HEADER_H + totalRows * ROW_H + 16;
  const totalWidth = LABEL_W + PROJECT_DAYS * DAY_W;

  return (
    <div className="rounded-lg border border-border bg-card overflow-auto">
      <svg width={totalWidth} height={totalHeight}>
        {/* Header: month labels every 30 days */}
        {[0, 30, 60, 90, 120, 150, 180].map(d => (
          <g key={d}>
            <line x1={dayToX(d)} x2={dayToX(d)} y1={HEADER_H} y2={totalHeight - 16} stroke="#E2E8F0" strokeDasharray="2 4" />
            <text x={dayToX(d) + 4} y={20} fontSize={11} fill="#64748B">Day {d}</text>
          </g>
        ))}
        {/* Today marker */}
        <line x1={dayToX(TODAY_DAY)} x2={dayToX(TODAY_DAY)} y1={HEADER_H - 6} y2={totalHeight - 16} stroke="#0F172A" strokeWidth={1.5} />
        <text x={dayToX(TODAY_DAY) + 4} y={20} fontSize={11} fill="#0F172A" fontWeight={600}>Today (Day {TODAY_DAY})</text>

        {/* Rows */}
        {groups.flatMap(group => group.rows).map(({ task, rowIndex }) => {
          const y = HEADER_H + rowIndex * ROW_H;
          const p = getPermit(task.phase);
          const x0 = dayToX(task.plannedStartDay);
          const baseW = (task.plannedDueDay - task.plannedStartDay) * DAY_W;
          const foreW = (task.forecastDueDay - task.plannedStartDay) * DAY_W;
          return (
            <g key={task.id}>
              {/* Row label */}
              <foreignObject x={0} y={y} width={LABEL_W - 8} height={ROW_H}>
                <div className="h-full flex items-center pl-3 gap-2 text-xs">
                  <span className="size-1.5 rounded-full shrink-0" style={{ backgroundColor: p.hex }} />
                  <span className="truncate">{task.title}</span>
                </div>
              </foreignObject>
              <GanttBar
                task={task}
                x={x0} y={y}
                baselineWidth={baseW}
                forecastWidth={foreW}
                rowHeight={ROW_H}
                dayToX={dayToX}
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
}
```

- [ ] **Step 4: Wire into project page Timeline tab**

In `project-page-client.tsx` replace the Timeline tab placeholder:

```tsx
import { GanttChart } from '@/components/project/gantt-chart';
// ...
<TabsContent value="timeline" className="mt-4"><GanttChart /></TabsContent>
```

- [ ] **Step 5: Smoke test**

```bash
npm run dev
```

Visit project page → Timeline tab. Expected: 28 baseline-dashed bars colored by phase, today line at Day 70, Planning Corrections shows a red border + forecast extension, Needs Revision shows amber border.

- [ ] **Step 6: Commit**

```bash
git add builder-demo/
git commit -m "feat(builder-demo): Gantt chart with three-layer bars, status overlay, today line"
```

---

### Task 18: Gantt toolbar — zoom, filters, dependency arrows toggle

**Files:**
- Modify: `builder-demo/components/project/gantt-chart.tsx`
- Create: `builder-demo/components/project/gantt-toolbar.tsx`

- [ ] **Step 1: Pull state out of `GanttChart` into props**

Refactor `GanttChart` to accept:

```ts
interface GanttChartProps {
  zoom: 'week' | 'month' | 'quarter';     // controls DAY_W
  filterPhase: PermitKey | 'all';
  filterStatus: TaskStatus | 'all';
  filterOwner: UserId | 'all';
  showDependencies: boolean;
}
```

Replace `const DAY_W = 6` with derived value:

```ts
const DAY_W = zoom === 'week' ? 12 : zoom === 'month' ? 6 : 3;
```

Filter `tasks` before calling `groupByPhase`:

```ts
const filtered = tasks.filter(t =>
  (filterPhase === 'all' || t.phase === filterPhase) &&
  (filterStatus === 'all' || t.status === filterStatus) &&
  (filterOwner === 'all' || t.ownerId === filterOwner)
);
const groups = groupByPhase(filtered);
```

- [ ] **Step 2: Add dependency arrows when enabled**

Inside `<svg>`, after the rows, add:

```tsx
{showDependencies && groups.flatMap(g => g.rows).flatMap(({ task, rowIndex }) =>
  task.dependencyIds.map(depId => {
    const dep = tasks.find(t => t.id === depId);
    if (!dep) return null;
    const depRow = groups.flatMap(g => g.rows).find(r => r.task.id === depId);
    if (!depRow) return null;
    const x1 = dayToX(dep.forecastDueDay);
    const y1 = HEADER_H + depRow.rowIndex * ROW_H + ROW_H / 2;
    const x2 = dayToX(task.forecastStartDay);
    const y2 = HEADER_H + rowIndex * ROW_H + ROW_H / 2;
    const onCritical = task.isCriticalPath && dep.isCriticalPath;
    return (
      <path
        key={`${depId}-${task.id}`}
        d={`M${x1} ${y1} L${x1 + 6} ${y1} L${x1 + 6} ${y2} L${x2 - 2} ${y2}`}
        stroke={onCritical ? '#F59E0B' : '#CBD5E1'}
        strokeWidth={onCritical ? 1.5 : 1}
        fill="none"
        markerEnd="url(#arrow)"
      />
    );
  })
)}
<defs>
  <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
    <path d="M 0 0 L 10 5 L 0 10 z" fill="#94A3B8" />
  </marker>
</defs>
```

- [ ] **Step 3: `components/project/gantt-toolbar.tsx`**

```tsx
'use client';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PHASE_ORDER, PERMITS } from '@/lib/permits';
import type { PermitKey, TaskStatus, UserId } from '@/lib/types';
import { USERS } from '@/lib/sample-data';

const STATUSES: (TaskStatus | 'all')[] = ['all','Not Started','In Progress','Submitted for Review','Needs Revision','Delayed','Blocked','Done'];

export function GanttToolbar({
  zoom, setZoom,
  filterPhase, setFilterPhase,
  filterStatus, setFilterStatus,
  filterOwner, setFilterOwner,
  showDependencies, setShowDependencies,
}: {
  zoom: 'week' | 'month' | 'quarter';
  setZoom: (z: 'week' | 'month' | 'quarter') => void;
  filterPhase: PermitKey | 'all'; setFilterPhase: (p: PermitKey | 'all') => void;
  filterStatus: TaskStatus | 'all'; setFilterStatus: (s: TaskStatus | 'all') => void;
  filterOwner: UserId | 'all'; setFilterOwner: (o: UserId | 'all') => void;
  showDependencies: boolean; setShowDependencies: (b: boolean) => void;
}) {
  // Note: needing `Select` from shadcn — if not installed, run:
  //   npx shadcn@latest add select
  return (
    <div className="flex flex-wrap items-center gap-2 mb-2">
      <div className="flex border border-border rounded-md overflow-hidden">
        {(['week','month','quarter'] as const).map(z => (
          <button key={z}
            onClick={() => setZoom(z)}
            className={`px-3 py-1 text-xs ${zoom === z ? 'bg-accent font-medium' : 'hover:bg-accent/50'}`}>
            {z[0].toUpperCase() + z.slice(1)}
          </button>
        ))}
      </div>
      <Select value={filterPhase} onValueChange={(v) => setFilterPhase(v as any)}>
        <SelectTrigger className="h-8 w-40 text-xs"><SelectValue placeholder="Phase" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All phases</SelectItem>
          {PHASE_ORDER.map(k => <SelectItem key={k} value={k}>{PERMITS[k].label}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as any)}>
        <SelectTrigger className="h-8 w-40 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
        <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{s === 'all' ? 'All statuses' : s}</SelectItem>)}</SelectContent>
      </Select>
      <Select value={filterOwner} onValueChange={(v) => setFilterOwner(v as any)}>
        <SelectTrigger className="h-8 w-40 text-xs"><SelectValue placeholder="Owner" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All owners</SelectItem>
          {USERS.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
        </SelectContent>
      </Select>
      <Button variant={showDependencies ? 'default' : 'outline'} size="sm" onClick={() => setShowDependencies(!showDependencies)}>
        {showDependencies ? 'Hide' : 'Show'} dependencies
      </Button>
    </div>
  );
}
```

If the Select primitive isn't installed yet, run:

```bash
npx shadcn@latest add select
```

- [ ] **Step 4: Wire toolbar + state into a wrapper**

In `project-page-client.tsx`, replace the Timeline tab content with a small wrapper:

```tsx
'use client';
import { useState } from 'react';
import { GanttChart } from '@/components/project/gantt-chart';
import { GanttToolbar } from '@/components/project/gantt-toolbar';
import type { PermitKey, TaskStatus, UserId } from '@/lib/types';

function TimelineSection() {
  const [zoom, setZoom] = useState<'week'|'month'|'quarter'>('month');
  const [filterPhase, setFilterPhase] = useState<PermitKey | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<TaskStatus | 'all'>('all');
  const [filterOwner, setFilterOwner] = useState<UserId | 'all'>('all');
  const [showDependencies, setShowDependencies] = useState(true);
  return (
    <>
      <GanttToolbar {...{zoom,setZoom,filterPhase,setFilterPhase,filterStatus,setFilterStatus,filterOwner,setFilterOwner,showDependencies,setShowDependencies}} />
      <GanttChart {...{zoom,filterPhase,filterStatus,filterOwner,showDependencies}} />
    </>
  );
}
```

Then use `<TimelineSection />` inside the timeline `<TabsContent>`.

- [ ] **Step 5: Smoke test**

```bash
npm run dev
```

On Timeline tab: switch zoom, filter by phase=Planning Review (only 3 bars), toggle dependencies (arrows hide/show).

- [ ] **Step 6: Commit**

```bash
git add builder-demo/
git commit -m "feat(builder-demo): Gantt toolbar with zoom, filters, dependency arrows"
```

---

### Task 19: Task drawer (right Sheet) + bar click

**Files:**
- Create: `builder-demo/components/project/task-drawer.tsx`
- Modify: `gantt-chart.tsx` (add onClick handler on bars)

- [ ] **Step 1: `components/project/task-drawer.tsx`**

```tsx
'use client';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { useDemoStore } from '@/lib/store';
import { USERS } from '@/lib/sample-data';
import { StatusBadge } from '@/components/shared/status-badge';
import { PermitChip } from '@/components/shared/permit-chip';
import { Avatar } from '@/components/shared/avatar';
import { ThreeLayerDates } from '@/components/shared/three-layer-dates';
import type { TaskId } from '@/lib/types';
import { showCompletionToast } from '@/components/shared/completion-toast';

export function TaskDrawer({ taskId, onClose }: { taskId: TaskId | null; onClose: () => void }) {
  const task = useDemoStore((s) => (taskId ? s.tasks[taskId] : null));
  const { submitForReview, approve, requestRevision, markDone, setStatus } = useDemoStore();
  if (!task) return null;
  const owner = USERS.find(u => u.id === task.ownerId)!;
  const reviewer = task.reviewerId ? USERS.find(u => u.id === task.reviewerId)! : null;

  return (
    <Sheet open={!!taskId} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent className="w-[480px] sm:max-w-[480px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-start gap-2 pr-6">
            <span className="flex-1">{task.title}</span>
          </SheetTitle>
          <div className="flex items-center gap-2 pt-2">
            <PermitChip permit={task.phase} />
            <StatusBadge status={task.status} />
            {task.isCriticalPath && <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">Critical path</span>}
          </div>
        </SheetHeader>

        <div className="mt-5 space-y-5">
          <ThreeLayerDates
            plannedStart={task.plannedStartDay} plannedDue={task.plannedDueDay}
            forecastStart={task.forecastStartDay} forecastDue={task.forecastDueDay}
            actualStart={task.actualStartDay} actualEnd={task.actualEndDay}
          />

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-wide">Owner</div>
              <div className="flex items-center gap-2 mt-1"><Avatar user={owner} /> {owner.name}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-wide">Reviewer</div>
              <div className="flex items-center gap-2 mt-1">
                {reviewer ? <><Avatar user={reviewer} /> {reviewer.name}</> : <span className="text-muted-foreground">—</span>}
              </div>
            </div>
          </div>

          {task.reviewComment && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              <div className="font-medium mb-1">Review comment</div>
              {task.reviewComment}
            </div>
          )}

          <div className="space-y-2">
            <div className="text-xs text-muted-foreground uppercase tracking-wide">Actions</div>
            <div className="flex flex-wrap gap-2">
              {task.status === 'In Progress' && <Button size="sm" onClick={() => submitForReview(task.id)}>Submit for review</Button>}
              {task.status === 'Submitted for Review' && reviewer && (
                <>
                  <Button size="sm" onClick={() => approve(task.id)}>Approve</Button>
                  <Button size="sm" variant="outline" onClick={() => requestRevision(task.id, 'Please address comments and resubmit.')}>Request revision</Button>
                </>
              )}
              {(task.status === 'Approved' || task.status === 'In Progress' || task.status === 'Needs Revision') &&
                <Button size="sm" variant="outline" onClick={() => { const prev = task.status; markDone(task.id); showCompletionToast(task, prev); }}>Mark done</Button>}
              {task.status === 'Not Started' && <Button size="sm" onClick={() => setStatus(task.id, 'In Progress')}>Start</Button>}
              {task.status === 'Needs Revision' && <Button size="sm" onClick={() => submitForReview(task.id)}>Resubmit for review</Button>}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 2: Add click handler to bars in `gantt-chart.tsx`**

Accept a `onTaskClick` prop and wrap each bar row in a `<g onClick={() => onTaskClick(task.id)} style={{ cursor: 'pointer' }}>`. Bubble through `TimelineSection`.

In `TimelineSection`:

```tsx
const [openTaskId, setOpenTaskId] = useState<TaskId | null>(null);
// ...
<GanttChart {...props} onTaskClick={setOpenTaskId} />
<TaskDrawer taskId={openTaskId} onClose={() => setOpenTaskId(null)} />
```

- [ ] **Step 3: Smoke test**

```bash
npm run dev
```

Click any bar → drawer opens with full task detail and state-aware actions. Approve → task status changes; close drawer; bar updates color/icon.

- [ ] **Step 4: Commit**

```bash
git add builder-demo/
git commit -m "feat(builder-demo): task drawer with three-layer dates and state-aware actions"
```

---

### Task 20: Task table tab

**Files:**
- Create: `builder-demo/components/project/task-table.tsx`
- Modify: `project-page-client.tsx`

- [ ] **Step 1: `components/project/task-table.tsx`**

```tsx
'use client';
import { useState } from 'react';
import { useDemoStore } from '@/lib/store';
import { USERS } from '@/lib/sample-data';
import { TODAY_DAY, dayToDate, formatDateShort } from '@/lib/dates';
import { StatusBadge } from '@/components/shared/status-badge';
import { PermitChip } from '@/components/shared/permit-chip';
import { Avatar } from '@/components/shared/avatar';
import { PriorityDot } from '@/components/shared/priority-dot';
import { TaskDrawer } from './task-drawer';
import type { TaskId } from '@/lib/types';

export function TaskTable() {
  const tasks = useDemoStore((s) => Object.values(s.tasks));
  const userById = new Map(USERS.map(u => [u.id, u]));
  const [openId, setOpenId] = useState<TaskId | null>(null);

  return (
    <>
      <div className="rounded-lg border border-border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="text-left px-3 py-2 font-medium">Task</th>
              <th className="text-left px-3 py-2 font-medium">Phase</th>
              <th className="text-left px-3 py-2 font-medium">Status</th>
              <th className="text-left px-3 py-2 font-medium">Owner</th>
              <th className="text-left px-3 py-2 font-medium">Reviewer</th>
              <th className="text-left px-3 py-2 font-medium">Planned</th>
              <th className="text-left px-3 py-2 font-medium">Forecast</th>
              <th className="text-left px-3 py-2 font-medium">Δ</th>
              <th className="text-left px-3 py-2 font-medium">Pri</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map(t => {
              const slip = t.forecastDueDay - t.plannedDueDay;
              return (
                <tr key={t.id} className="border-t border-border hover:bg-accent/30 cursor-pointer" onClick={() => setOpenId(t.id)}>
                  <td className="px-3 py-2"><span className="font-medium">{t.title}</span>{t.source === 'unplanned' && <span className="ml-2 text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">Unplanned</span>}</td>
                  <td className="px-3 py-2"><PermitChip permit={t.phase} /></td>
                  <td className="px-3 py-2"><StatusBadge status={t.status} /></td>
                  <td className="px-3 py-2"><div className="flex items-center gap-1.5"><Avatar user={userById.get(t.ownerId)!} size={18} /><span className="text-xs">{userById.get(t.ownerId)!.name}</span></div></td>
                  <td className="px-3 py-2">{t.reviewerId ? <Avatar user={userById.get(t.reviewerId)!} size={18} /> : <span className="text-muted-foreground">—</span>}</td>
                  <td className="px-3 py-2 tabular-nums">{formatDateShort(dayToDate(t.plannedDueDay))}</td>
                  <td className="px-3 py-2 tabular-nums">{formatDateShort(dayToDate(t.forecastDueDay))}</td>
                  <td className={`px-3 py-2 tabular-nums ${slip > 0 ? 'text-red-600 font-medium' : ''}`}>{slip > 0 ? `+${slip}d` : '—'}</td>
                  <td className="px-3 py-2"><PriorityDot priority={t.priority} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <TaskDrawer taskId={openId} onClose={() => setOpenId(null)} />
    </>
  );
}
```

- [ ] **Step 2: Wire into Tasks tab**

```tsx
import { TaskTable } from '@/components/project/task-table';
// ...
<TabsContent value="tasks" className="mt-4"><TaskTable /></TabsContent>
```

- [ ] **Step 3: Smoke test**

```bash
npm run dev
```

Tasks tab: table of 29 rows, click any row → drawer opens. Unplanned task is tagged.

- [ ] **Step 4: Commit**

```bash
git add builder-demo/
git commit -m "feat(builder-demo): task table with click-to-drawer"
```

---

### Task 21: Activity feed + add-unplanned-task dialog

**Files:**
- Create: `builder-demo/components/project/activity-feed.tsx`, `add-unplanned-task-dialog.tsx`
- Modify: `project-page-client.tsx`

- [ ] **Step 1: Seed the activity feed in `lib/sample-data.ts`** — add an exported `SAMPLE_ACTIVITY` array.

In `sample-data.ts`, after `TASKS`, add:

```ts
import type { ActivityEvent } from './types';
export const SAMPLE_ACTIVITY: ActivityEvent[] = [
  { id: 'a1',  timestamp: '2026-05-09', actorId: SARAH_ID, action: 'rejected "Demo Permit Review" — missing asbestos clearance attachment', taskId: 'task-02', comment: 'Please attach asbestos cert and resubmit.' },
  { id: 'a2',  timestamp: '2026-05-09', actorId: JENNY_ID, action: 'began revising "Demo Corrections / Resubmission"', taskId: 'task-03' },
  { id: 'a3',  timestamp: '2026-05-08', actorId: DAVID_ID, action: 'flagged "Planning Corrections / Resubmission" at risk of slipping past Day 65', taskId: 'task-08' },
  { id: 'a4',  timestamp: '2026-05-10', actorId: SARAH_ID, action: 'added unplanned task "Respond to neighbor zoning objection re: setback"', taskId: 'task-29' },
  { id: 'a5',  timestamp: '2026-05-12', actorId: DAVID_ID, action: 'started "Respond to neighbor zoning objection re: setback"', taskId: 'task-29' },
  { id: 'a6',  timestamp: '2026-05-13', actorId: SARAH_ID, action: 'updated project forecast end from 2026-09-02 to 2026-09-12 (+10d)' },
  { id: 'a7',  timestamp: '2026-04-25', actorId: MIKE_ID,  action: 'closed "Tree Removal Permit"', taskId: 'task-06' },
  { id: 'a8',  timestamp: '2026-04-21', actorId: MIKE_ID,  action: 'approved "Planning 1st Review"', taskId: 'task-07' },
  { id: 'a9',  timestamp: '2026-04-18', actorId: DAVID_ID, action: 'submitted "Planning 1st Review" for review', taskId: 'task-07' },
  { id: 'a10', timestamp: '2026-04-15', actorId: JENNY_ID, action: 'closed "Utility Cutoff + Asbestos + J Number"', taskId: 'task-01' },
];
```

- [ ] **Step 2: Bring SAMPLE_ACTIVITY into the store's initial state**

In `lib/store.ts`, import `SAMPLE_ACTIVITY` and replace the initial `activity: []` with `activity: [...SAMPLE_ACTIVITY]`. Also update `resetDemo` to seed it back.

- [ ] **Step 3: `components/project/activity-feed.tsx`**

```tsx
'use client';
import { useDemoStore } from '@/lib/store';
import { USERS } from '@/lib/sample-data';
import { Avatar } from '@/components/shared/avatar';
import { formatDateLong } from '@/lib/dates';

export function ActivityFeed() {
  const activity = useDemoStore((s) => s.activity);
  const userById = new Map(USERS.map(u => [u.id, u]));
  const sorted = [...activity].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  return (
    <ul className="rounded-lg border border-border bg-card divide-y divide-border">
      {sorted.map(ev => {
        const actor = userById.get(ev.actorId)!;
        return (
          <li key={ev.id} className="flex gap-3 p-3">
            <Avatar user={actor} size={28} />
            <div className="flex-1">
              <div className="text-sm">
                <span className="font-medium">{actor.name}</span> <span className="text-muted-foreground">{ev.action}</span>
              </div>
              {ev.comment && <div className="mt-1 text-xs text-muted-foreground border-l-2 border-border pl-2">{ev.comment}</div>}
              <div className="text-[10px] text-muted-foreground mt-1">{formatDateLong(ev.timestamp)}</div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
```

- [ ] **Step 4: `components/project/add-unplanned-task-dialog.tsx`**

```tsx
'use client';
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useDemoStore } from '@/lib/store';
import { USERS, PROJECT } from '@/lib/sample-data';
import { PHASE_ORDER, PERMITS } from '@/lib/permits';
import { TODAY_DAY } from '@/lib/dates';
import type { PermitKey, UserId, Task } from '@/lib/types';
import { Plus } from 'lucide-react';

export function AddUnplannedTaskDialog() {
  const addUnplanned = useDemoStore((s) => s.addUnplanned);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [phase, setPhase] = useState<PermitKey>('planning');
  const [owner, setOwner] = useState<UserId>(USERS[0].id);
  const [days, setDays] = useState(3);

  function submit() {
    if (!title.trim()) return;
    const task: Task = {
      id: `task-unplanned-${Date.now()}`,
      projectId: PROJECT.id,
      title: title.trim(),
      phase,
      department: 'Permit',
      ownerId: owner,
      reviewerId: USERS[0].id,
      status: 'In Progress',
      priority: 'High',
      source: 'unplanned',
      plannedStartDay: TODAY_DAY,
      plannedDueDay: TODAY_DAY + days,
      forecastStartDay: TODAY_DAY,
      forecastDueDay: TODAY_DAY + days,
      actualStartDay: TODAY_DAY,
      actualEndDay: null,
      dependencyIds: [],
      isCriticalPath: false,
    };
    addUnplanned(task);
    setOpen(false);
    setTitle('');
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline"><Plus className="size-3.5 mr-1" />Add unplanned task</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Add unplanned task</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground">Title</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What needs to happen?" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Phase</label>
              <Select value={phase} onValueChange={(v) => setPhase(v as PermitKey)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PHASE_ORDER.map(k => <SelectItem key={k} value={k}>{PERMITS[k].label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Owner</label>
              <Select value={owner} onValueChange={(v) => setOwner(v as UserId)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{USERS.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Duration (days)</label>
            <Input type="number" min={1} value={days} onChange={(e) => setDays(parseInt(e.target.value || '1'))} />
          </div>
          <div className="rounded-md bg-muted/50 p-3 text-xs">
            <strong>Impact preview:</strong> Will start at Day {TODAY_DAY} and end at Day {TODAY_DAY + days}. No downstream tasks shifted (no dependency selected).
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={!title.trim()}>Add task</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

If `input` primitive isn't installed: `npx shadcn@latest add input`.

- [ ] **Step 5: Wire into Activity tab and Tasks tab**

In `project-page-client.tsx`, add `<AddUnplannedTaskDialog />` above `<TaskTable />` and use `<ActivityFeed />` for the activity tab.

- [ ] **Step 6: Smoke test**

```bash
npm run dev
```

Activity tab: lists 10 seeded events. Click Add unplanned task → fill in form → new task appears in Tasks table and Gantt.

- [ ] **Step 7: Commit**

```bash
git add builder-demo/
git commit -m "feat(builder-demo): activity feed and add-unplanned-task dialog"
```

---

## Phase F — My Tasks (3 tasks)

### Task 22: My Tasks page — focus banner + tabs shell + My Tasks card grid

**Files:**
- Create: `builder-demo/app/my-tasks/page.tsx`, `components/my-tasks/focus-banner.tsx`, `task-card.tsx`

- [ ] **Step 1: `components/my-tasks/task-card.tsx`**

```tsx
'use client';
import type { Task } from '@/lib/types';
import { useDemoStore } from '@/lib/store';
import { USERS } from '@/lib/sample-data';
import { PermitChip } from '@/components/shared/permit-chip';
import { StatusBadge } from '@/components/shared/status-badge';
import { Avatar } from '@/components/shared/avatar';
import { PriorityDot } from '@/components/shared/priority-dot';
import { Button } from '@/components/ui/button';
import { getPermit } from '@/lib/permits';
import { TODAY_DAY, dayToDate, formatDateShort } from '@/lib/dates';
import { motion } from 'framer-motion';
import { showCompletionToast } from '@/components/shared/completion-toast';

export function TaskCard({ task, onClick }: { task: Task; onClick?: () => void }) {
  const reviewer = task.reviewerId ? USERS.find(u => u.id === task.reviewerId) : null;
  const p = getPermit(task.phase);
  const overdue = task.plannedDueDay < TODAY_DAY && task.status !== 'Done' && task.status !== 'Approved';
  const { submitForReview, setStatus, markDone } = useDemoStore();

  function primaryAction() {
    if (task.status === 'In Progress')         return <Button size="sm" onClick={(e) => { e.stopPropagation(); submitForReview(task.id); }}>Submit for review</Button>;
    if (task.status === 'Needs Revision')      return <Button size="sm" onClick={(e) => { e.stopPropagation(); submitForReview(task.id); }}>Resubmit</Button>;
    if (task.status === 'Submitted for Review')return <span className="text-xs text-muted-foreground">Awaiting review</span>;
    if (task.status === 'Not Started' || task.status === 'Ready')
      return <Button size="sm" onClick={(e) => { e.stopPropagation(); setStatus(task.id, 'In Progress'); }}>Start</Button>;
    if (task.status === 'Delayed')             return <Button size="sm" variant="destructive" onClick={(e) => { e.stopPropagation(); submitForReview(task.id); }}>Submit for review</Button>;
    return <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); const prev = task.status; markDone(task.id); showCompletionToast(task, prev); }}>Mark done</Button>;
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 1 }} exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.25 }}
      onClick={onClick}
      className="cursor-pointer rounded-lg border border-border bg-card p-4 flex flex-col gap-2 hover:shadow-sm"
      style={{ borderLeftWidth: 4, borderLeftColor: p.hex }}
    >
      <div className="flex items-start justify-between">
        <div className="font-medium text-sm leading-snug pr-2">{task.title}</div>
        <PriorityDot priority={task.priority} />
      </div>
      <div className="text-xs text-muted-foreground">9 Greenwood Pl</div>
      <div className="flex items-center gap-2 flex-wrap">
        <PermitChip permit={task.phase} />
        <StatusBadge status={task.status} />
        <span className={`text-xs ${overdue ? 'text-red-600 font-medium' : 'text-muted-foreground'}`}>
          Due {formatDateShort(dayToDate(task.plannedDueDay))}{overdue && ' · overdue'}
        </span>
      </div>
      {task.reviewComment && (
        <div className="text-xs bg-amber-50 text-amber-900 border border-amber-200 rounded px-2 py-1.5">
          ⚠ {task.reviewComment}
        </div>
      )}
      <div className="flex items-center justify-between pt-1">
        {reviewer ? <span className="text-xs text-muted-foreground flex items-center gap-1">Reviewer <Avatar user={reviewer} size={16} /> {reviewer.name}</span> : <span />}
        {primaryAction()}
      </div>
    </motion.div>
  );
}
```

- [ ] **Step 2: `components/my-tasks/focus-banner.tsx`**

```tsx
'use client';
import { useDemoStore } from '@/lib/store';

export function FocusBanner() {
  const currentUserId = useDemoStore((s) => s.currentUserId);
  const tasks = useDemoStore((s) => Object.values(s.tasks));
  const mine = tasks.filter(t => t.ownerId === currentUserId);
  const active = mine.filter(t => t.status !== 'Done' && t.status !== 'Approved').length;
  const revision = mine.filter(t => t.status === 'Needs Revision').length;
  const reviewing = tasks.filter(t => t.reviewerId === currentUserId && t.status === 'Submitted for Review').length;
  return (
    <div className="rounded-lg border border-border bg-card p-4 flex items-center gap-4">
      <Chip label="Active" value={active} />
      <Chip label="Needs revision (urgent)" value={revision} tone={revision > 0 ? 'warn' : 'default'} />
      <Chip label="To review" value={reviewing} />
    </div>
  );
}

function Chip({ label, value, tone = 'default' }: { label: string; value: number; tone?: 'default' | 'warn' }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className={`text-xl font-semibold ${tone === 'warn' ? 'text-amber-600' : ''}`}>{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}
```

- [ ] **Step 3: `app/my-tasks/page.tsx`**

```tsx
'use client';
import { useState } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { FocusBanner } from '@/components/my-tasks/focus-banner';
import { TaskCard } from '@/components/my-tasks/task-card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useDemoStore } from '@/lib/store';
import { TaskDrawer } from '@/components/project/task-drawer';
import type { TaskId } from '@/lib/types';
import { AnimatePresence } from 'framer-motion';

export default function MyTasksPage() {
  const currentUserId = useDemoStore((s) => s.currentUserId);
  const tasks = useDemoStore((s) => Object.values(s.tasks));
  const [openId, setOpenId] = useState<TaskId | null>(null);
  const mine = tasks
    .filter(t => t.ownerId === currentUserId && t.status !== 'Done' && t.status !== 'Approved')
    .sort((a, b) => a.plannedDueDay - b.plannedDueDay);

  return (
    <AppShell title="My Tasks">
      <div className="space-y-4 max-w-screen-xl">
        <FocusBanner />
        <Tabs defaultValue="tasks">
          <TabsList>
            <TabsTrigger value="tasks">My Tasks</TabsTrigger>
            <TabsTrigger value="reviews">My Reviews</TabsTrigger>
            <TabsTrigger value="calendar">Calendar</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>
          <TabsContent value="tasks" className="mt-4">
            {mine.length === 0
              ? <div className="rounded-lg border border-border bg-card p-12 text-center text-muted-foreground">All clear ✓ — no active tasks for you.</div>
              : <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  <AnimatePresence>
                    {mine.map(t => <TaskCard key={t.id} task={t} onClick={() => setOpenId(t.id)} />)}
                  </AnimatePresence>
                </div>}
          </TabsContent>
          <TabsContent value="reviews">Reviews — see Task 23.</TabsContent>
          <TabsContent value="calendar">Calendar — see Task 23.</TabsContent>
          <TabsContent value="history">History — see Task 23.</TabsContent>
        </Tabs>
      </div>
      <TaskDrawer taskId={openId} onClose={() => setOpenId(null)} />
    </AppShell>
  );
}
```

- [ ] **Step 4: Smoke test**

```bash
npm run dev
```

`/my-tasks/` should show Jenny's task cards (Demo Permit phase). Switch role to David via topbar → cards change. Click Start / Submit-for-Review → card visibly updates.

- [ ] **Step 5: Commit**

```bash
git add builder-demo/
git commit -m "feat(builder-demo): My Tasks page with focus banner and task cards"
```

---

### Task 23: My Reviews + Calendar + History tabs

**Files:**
- Create: `builder-demo/components/my-tasks/review-card.tsx`, `calendar-view.tsx`, `history-list.tsx`
- Modify: `app/my-tasks/page.tsx`

- [ ] **Step 1: `components/my-tasks/review-card.tsx`**

```tsx
'use client';
import { useDemoStore } from '@/lib/store';
import { USERS } from '@/lib/sample-data';
import { Avatar } from '@/components/shared/avatar';
import { PermitChip } from '@/components/shared/permit-chip';
import { Button } from '@/components/ui/button';
import { getPermit } from '@/lib/permits';
import type { Task } from '@/lib/types';

export function ReviewCard({ task }: { task: Task }) {
  const owner = USERS.find(u => u.id === task.ownerId)!;
  const p = getPermit(task.phase);
  const { approve, requestRevision } = useDemoStore();
  return (
    <div
      className="rounded-lg border border-border bg-card p-4 space-y-2"
      style={{ borderLeftWidth: 4, borderLeftColor: p.hex }}
    >
      <div className="font-medium text-sm">{task.title}</div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <PermitChip permit={task.phase} /> · submitted by <Avatar user={owner} size={16} /> {owner.name}
      </div>
      <div className="flex gap-2 pt-1">
        <Button size="sm" onClick={() => approve(task.id)}>Approve</Button>
        <Button size="sm" variant="outline" onClick={() => requestRevision(task.id, 'Please clarify the section in question.')}>Request revision</Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Seed two review-handoff items into store on init**

Add to `lib/sample-data.ts`:

```ts
// Synthetic review-handoff entries (not present in template) — used to populate
// Jenny's My Reviews tab. They are tasks tagged source 'unplanned' but flagged
// for cross-team review.
export function buildReviewHandoffs(): Task[] {
  return [
    {
      id: 'task-rh-1',
      projectId: PROJECT.id,
      title: 'Verify setback math for Planning Corrections',
      phase: 'planning',
      department: 'Permit',
      ownerId: DAVID_ID,
      reviewerId: JENNY_ID,
      status: 'Submitted for Review',
      priority: 'High',
      source: 'unplanned',
      plannedStartDay: 65,
      plannedDueDay: 72,
      forecastStartDay: 65,
      forecastDueDay: 72,
      actualStartDay: 65,
      actualEndDay: null,
      dependencyIds: [],
      isCriticalPath: false,
    },
    {
      id: 'task-rh-2',
      projectId: PROJECT.id,
      title: 'Tree Permit closeout — verify final docs',
      phase: 'tree',
      department: 'Permit',
      ownerId: MIKE_ID,
      reviewerId: JENNY_ID,
      status: 'Submitted for Review',
      priority: 'Medium',
      source: 'unplanned',
      plannedStartDay: 55,
      plannedDueDay: 60,
      forecastStartDay: 55,
      forecastDueDay: 60,
      actualStartDay: 55,
      actualEndDay: null,
      dependencyIds: [],
      isCriticalPath: false,
    },
  ];
}
```

Then in `lib/store.ts`, in `initialTasksMap`, merge handoffs:

```ts
import { buildReviewHandoffs } from './sample-data';
function initialTasksMap(): Record<TaskId, Task> {
  return Object.fromEntries([...TASKS, ...buildReviewHandoffs()].map(t => [t.id, { ...t }]));
}
```

- [ ] **Step 3: `components/my-tasks/calendar-view.tsx`**

```tsx
'use client';
import { useDemoStore } from '@/lib/store';
import { TODAY_DAY, dayToDate } from '@/lib/dates';
import { getPermit } from '@/lib/permits';
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth } from 'date-fns';

export function CalendarView() {
  const currentUserId = useDemoStore((s) => s.currentUserId);
  const tasks = useDemoStore((s) => Object.values(s.tasks)).filter(t => t.ownerId === currentUserId);
  const today = parseISO(dayToDate(TODAY_DAY));
  const monthStart = startOfMonth(today);
  const monthEnd = endOfMonth(today);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="text-sm font-medium mb-3">{format(today, 'MMMM yyyy')}</div>
      <div className="grid grid-cols-7 gap-1 text-xs">
        {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => <div key={d} className="text-muted-foreground text-center py-1">{d}</div>)}
        {days.map(day => {
          const due = tasks.filter(t => isSameDay(parseISO(dayToDate(t.plannedDueDay)), day));
          const isToday = isSameDay(day, today);
          return (
            <div key={day.toISOString()} className={`min-h-16 border border-border rounded p-1 ${!isSameMonth(day, today) ? 'opacity-40' : ''} ${isToday ? 'bg-accent/50' : ''}`}>
              <div className="text-[10px] text-muted-foreground">{format(day, 'd')}</div>
              <div className="flex flex-wrap gap-0.5 mt-1">
                {due.map(t => (
                  <span key={t.id} title={t.title} className="size-1.5 rounded-full" style={{ backgroundColor: getPermit(t.phase).hex }} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: `components/my-tasks/history-list.tsx`**

```tsx
'use client';
import { useDemoStore } from '@/lib/store';
import { PermitChip } from '@/components/shared/permit-chip';
import { dayToDate, formatDateShort } from '@/lib/dates';
import { Check } from 'lucide-react';

export function HistoryList() {
  const currentUserId = useDemoStore((s) => s.currentUserId);
  const tasks = useDemoStore((s) => Object.values(s.tasks))
    .filter(t => t.ownerId === currentUserId && (t.status === 'Done' || t.status === 'Approved'))
    .sort((a, b) => (b.actualEndDay ?? 0) - (a.actualEndDay ?? 0));
  if (tasks.length === 0) return <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">No completed tasks yet.</div>;
  return (
    <ul className="rounded-lg border border-border bg-card divide-y divide-border">
      {tasks.map(t => (
        <li key={t.id} className="flex items-center gap-3 p-3 text-sm">
          <span className="text-emerald-600"><Check className="size-4" /></span>
          <span className="flex-1">{t.title}</span>
          <PermitChip permit={t.phase} />
          <span className="text-xs text-muted-foreground tabular-nums">Completed {t.actualEndDay ? formatDateShort(dayToDate(t.actualEndDay)) : '—'}</span>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 5: Wire all three tabs in `app/my-tasks/page.tsx`**

```tsx
import { ReviewCard } from '@/components/my-tasks/review-card';
import { CalendarView } from '@/components/my-tasks/calendar-view';
import { HistoryList } from '@/components/my-tasks/history-list';

// inside the page component:
const myReviews = tasks.filter(t => t.reviewerId === currentUserId && t.status === 'Submitted for Review');

<TabsContent value="reviews" className="mt-4">
  {myReviews.length === 0
    ? <div className="rounded-lg border border-border bg-card p-12 text-center text-muted-foreground">Inbox zero ✓</div>
    : <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{myReviews.map(t => <ReviewCard key={t.id} task={t} />)}</div>}
</TabsContent>
<TabsContent value="calendar" className="mt-4"><CalendarView /></TabsContent>
<TabsContent value="history" className="mt-4"><HistoryList /></TabsContent>
```

- [ ] **Step 6: Smoke test**

```bash
npm run dev
```

Visit `/my-tasks/`. Jenny sees 2 review cards. Calendar shows May 2026 with permit dots. History is empty until you mark one done — then it appears.

- [ ] **Step 7: Commit**

```bash
git add builder-demo/
git commit -m "feat(builder-demo): My Reviews, Calendar, and History tabs"
```

---

### Task 24: Polish completion animation across pages

**Files:**
- Modify: `builder-demo/components/my-tasks/task-card.tsx`, `app/my-tasks/page.tsx`, `app/globals.css`

- [ ] **Step 1: Add `prefers-reduced-motion` handling in `globals.css`**

Append:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 0.001ms !important; transition-duration: 0.001ms !important; }
}
```

- [ ] **Step 2: Wrap My Tasks grid with `<AnimatePresence>`**

Already done in Task 22. Verify by clicking Mark done — the card should fade+shrink before disappearing.

- [ ] **Step 3: Smoke test**

```bash
npm run dev
```

Mark a task done from a card → card animates away → toast appears with Undo. Click Undo → card returns.

- [ ] **Step 4: Commit**

```bash
git add builder-demo/
git commit -m "feat(builder-demo): completion animation with reduced-motion fallback"
```

---

## Phase G — Polish & deploy (2 tasks)

### Task 25: Static export smoke test + `.nojekyll`

**Files:**
- Create: `builder-demo/public/.nojekyll`, `builder-demo/README.md`

- [ ] **Step 1: Create `.nojekyll`**

```bash
touch /Users/guoyuzhu/Desktop/Real-Estate-Analysis/builder-demo/public/.nojekyll
```

- [ ] **Step 2: Build**

```bash
cd /Users/guoyuzhu/Desktop/Real-Estate-Analysis/builder-demo
npm run build
```

Expected: builds to `out/`. Inspect:

```bash
ls out/
```

Expected: `index.html`, `_next/`, `projects/`, `my-tasks/` (because `trailingSlash: true`).

- [ ] **Step 3: Serve and visually verify**

```bash
npx serve out -l 4040
```

Open `http://localhost:4040/` — the entire demo loads. Test each page and the role switcher.

Stop the server. Note: links work locally without the basePath because the env var resolved to dev defaults; for GitHub Pages testing, set `NODE_ENV=production npm run build`.

- [ ] **Step 4: Create `builder-demo/README.md`**

```md
# Builder Demo

Frontend prototype for the Builder Project Orchestration PRD.

## Quick start

```bash
cd builder-demo
npm install
npm run dev
```

Open http://localhost:3000.

## Build for GitHub Pages

```bash
npm run build
# Output is in builder-demo/out/
# Copy contents of out/ into Real-Estate-Analysis/builder-demo-site/ and commit.
```

## Sample project

- Project: 9 Greenwood Pl, Newton, MA
- Permit type: SFH – With Planning Review
- Template source: ../AED_Project_Timeline_Report.html
- "Today" is fixed at 2026-05-14 (Project Day 70)
- Current user (My Tasks): Jenny Wang (switch via topbar)
```

- [ ] **Step 5: Commit**

```bash
git add builder-demo/
git commit -m "feat(builder-demo): static export config and README"
```

---

### Task 26: Final pass — typecheck, test, commit

**Files:** none new

- [ ] **Step 1: Type check**

```bash
cd /Users/guoyuzhu/Desktop/Real-Estate-Analysis/builder-demo
npx tsc --noEmit
```

Expected: 0 errors. Fix any that surface.

- [ ] **Step 2: Run all tests**

```bash
npm run test
```

Expected: all tests pass.

- [ ] **Step 3: Production build**

```bash
NODE_ENV=production npm run build
```

Expected: clean build into `out/`.

- [ ] **Step 4: Manual smoke test (golden path)**

```bash
npx serve out -l 4040
```

- Visit `/` — Dashboard renders.
- Click 9 Greenwood Pl row → Project Page Summary visible.
- Switch to Timeline tab → Gantt with today line, dependency arrows on, critical path glowing amber.
- Click a Gantt bar → drawer opens with three-layer dates.
- Approve task in drawer → bar color updates.
- Add unplanned task → appears in Tasks table and Gantt.
- Visit My Tasks → Jenny's cards visible, mark one done → animation + toast → Undo works.
- Switch role to David via topbar → My Tasks list changes.

- [ ] **Step 5: Final commit if anything fixed during smoke test**

```bash
git add builder-demo/
git commit -m "chore(builder-demo): final type/test pass and smoke verification"
```

---

## Manual demo script (for the manager meeting)

1. Open `/` — point at KPI strip ("At Risk · Overdue · Needs Revision · Critical-path Overdue").
2. Click 9 Greenwood Pl row → on Project Page, scroll the permit stage stepper, then click **Timeline**.
3. On the Gantt: point at the today line at Day 70, the critical path glow, the red-bordered Planning Corrections bar with forecast tint, the dashed baseline outlines on future tasks.
4. Toggle dependencies on/off; filter by Planning Review.
5. Click Planning Corrections → drawer shows three-layer dates, request revision flow.
6. Go to **Tasks** tab → click `+ Add unplanned task`, add one, show how it appears in Gantt.
7. Use topbar **View as** → switch to Jenny.
8. Open **My Tasks** → point at the Needs Revision card with the amber comment. Click Resubmit.
9. Open **My Reviews** → approve one item.
10. Reset demo via topbar gear if you want a clean run.

---

## Deliberate simplifications vs. spec

- **`forecast.cascade()`** (spec §8): the sample data hardcodes forecast dates for the Day-70 snapshot, and the Add-Unplanned-Task dialog uses a static impact-preview string. A live dependency-shift cascade is not needed for the demo to land its narrative. If you want to add it later, it would replace the static preview in `add-unplanned-task-dialog.tsx`.
- **Drag-to-reschedule on the Gantt** is excluded per spec §10 (out of scope).
- **Department workload bars** on the dashboard are rendered as inline numbers rather than horizontal bar charts; the count is what tells the story.

---

## Self-review checklist (engineer-side)

When you finish, verify all of these:

- [ ] Dashboard shows 6 KPI cards with the values from `computeKpis(tasks)`.
- [ ] Permit Stage stepper highlights Planning Review as current.
- [ ] Project Page summary lists 9 Greenwood Pl with health "At Risk" and forecast slip badge.
- [ ] Gantt renders 28 template tasks + 1 unplanned, grouped by 12 phases, baseline-dashed, forecast-tinted, status overlay correct.
- [ ] Today vertical line is at Day 70.
- [ ] Critical path of 8 tasks (Planning 1st Review → Planning Corrections → Planning Approval → Public Hearing → Building 1st → Resubmission → Final Approval → Final Permit Issuance) is amber-outlined.
- [ ] Click on bar opens drawer.
- [ ] Task drawer shows three-layer dates.
- [ ] Add unplanned task dialog produces a new task on Gantt + table.
- [ ] My Tasks shows Jenny's 5 Demo Permit tasks + Reviews queue of 2.
- [ ] Role switcher swaps user globally and updates My Tasks immediately.
- [ ] `npm run test` reports all tests green.
- [ ] `NODE_ENV=production npm run build` produces `out/` without errors.
- [ ] Static `out/` opens and works under `npx serve`.
