# Builder Project Orchestration — Frontend Demo · Design Spec

**Date:** 2026-05-14
**Author:** Yu Zhu (PM)
**Status:** Draft for review
**Purpose:** Visible frontend prototype to share with manager and team. Demonstrates the PRD's core concepts (baseline/forecast/actual timeline, task lifecycle with review, dependency propagation, role-specific views) using a single sample project, with no backend.

---

## 1. Goals & non-goals

### Goals
- Produce a click-through web demo a manager can open in a browser and explore in 5 minutes.
- Show three core pages from the PRD: **Dashboard**, **Project Page**, **My Tasks**.
- Use real data structure from the existing AED Project Timeline Report — specifically the **SFH – With Planning Review** template (180 days, 28 tasks across 12 phases).
- Land the PRD's "Baseline vs Actual vs Forecast" three-layer time model visually.
- Be deployable to GitHub Pages so the manager can be sent a link.

### Non-goals
- No backend, no authentication, no real persistence beyond browser `localStorage`.
- No drag-to-edit Gantt bars, no real dependency editor, no actual review workflow.
- No multi-project portfolio: a single sample project (9 Greenwood Pl) is enough to land every concept.
- No analytics / performance metrics page (PRD §12) in this demo — would be the next milestone.
- No native mobile layout — desktop ≥1280px target; responsive ≥768px is acceptable but not optimized.

---

## 2. Tech stack & deployment

| Concern | Choice |
|---|---|
| Framework | Next.js 14 (App Router) with TypeScript |
| Styling | Tailwind CSS |
| Components | shadcn/ui (zinc base palette) |
| Icons | lucide-react (ships with shadcn) |
| State | Zustand + `persist` middleware (writes to `localStorage`) |
| Gantt | Custom SVG/CSS — no external Gantt library |
| Charts (KPI sparklines, workload bars) | Recharts |
| Animations | Framer Motion (task completion fade/shrink, drawer slide) |
| Build | `next build` with `output: 'export'` for static hosting |
| Hosting | GitHub Pages at `yuzhu9387.github.io/Real-Estate-Analysis/builder-demo/` |

`next.config.js` will set `basePath: '/Real-Estate-Analysis/builder-demo-site'` and `output: 'export'`. Local dev runs at `localhost:3000` without basePath via env detection.

---

## 3. File layout

Project lives under `~/Desktop/Real-Estate-Analysis/builder-demo/`. Existing HTML reports in the repo root are not touched.

```
~/Desktop/Real-Estate-Analysis/
├── AED_Project_Timeline_Report.html         (unchanged)
├── TJ_Homes_Dashboard_v2.html               (unchanged)
├── sales-training-funnel-*.html             (unchanged)
├── README.md
└── builder-demo/                            ← new
    ├── app/
    │   ├── layout.tsx                       (root: theme, sidebar shell, role switcher)
    │   ├── page.tsx                         (Dashboard at /)
    │   ├── projects/[id]/page.tsx           (Project Page)
    │   └── my-tasks/page.tsx                (My Tasks)
    ├── components/
    │   ├── ui/                              (shadcn primitives)
    │   ├── layout/
    │   │   ├── sidebar.tsx
    │   │   ├── topbar.tsx
    │   │   └── role-switcher.tsx
    │   ├── dashboard/
    │   │   ├── kpi-card.tsx
    │   │   ├── project-status-row.tsx
    │   │   ├── permit-stage-stepper.tsx
    │   │   ├── team-workload.tsx
    │   │   └── upcoming-deadlines.tsx
    │   ├── project/
    │   │   ├── project-summary.tsx
    │   │   ├── gantt-chart.tsx
    │   │   ├── gantt-bar.tsx
    │   │   ├── gantt-toolbar.tsx
    │   │   ├── task-table.tsx
    │   │   ├── task-drawer.tsx
    │   │   ├── activity-feed.tsx
    │   │   └── add-unplanned-task-dialog.tsx
    │   ├── my-tasks/
    │   │   ├── focus-banner.tsx
    │   │   ├── task-card.tsx
    │   │   ├── review-card.tsx
    │   │   ├── calendar-view.tsx
    │   │   └── history-list.tsx
    │   └── shared/
    │       ├── status-badge.tsx
    │       ├── permit-chip.tsx
    │       ├── priority-dot.tsx
    │       ├── avatar.tsx
    │       ├── three-layer-dates.tsx
    │       └── completion-toast.tsx
    ├── lib/
    │   ├── types.ts                         (TS types: Project, Permit, Task, User, …)
    │   ├── aed-template.ts                  (parses SFH–With Planning Review template)
    │   ├── sample-data.ts                   (instantiates 9 Greenwood Pl + status overlay + unplanned task)
    │   ├── permits.ts                       (12 permit colors + metadata)
    │   ├── store.ts                         (Zustand store + persist)
    │   ├── dates.ts                         (day-offset ↔ date helpers, today=Day 70)
    │   └── critical-path.ts                 (forward pass over dependencies)
    ├── public/
    │   └── (favicon, OG image)
    ├── docs/
    │   └── 2026-05-14-builder-demo-design.md  ← this file
    ├── next.config.js
    ├── tailwind.config.ts
    ├── tsconfig.json
    └── package.json
```

---

## 4. Sample data: 9 Greenwood Pl

### Project record
| Field | Value |
|---|---|
| `id` | `prj-9-greenwood-pl` |
| `address` | 9 Greenwood Pl, Newton, MA |
| `permit_type` | SFH – With Planning Review |
| `purchase_date` | 2025-09-15 |
| `purchase_cost` | $850,000 |
| `project_owner_id` | user-sarah |
| `baseline_start` | 2026-03-06 (Project Day 1) |
| `baseline_end` | 2026-09-02 (Day 180) |
| `forecast_end` | 2026-09-12 (Day 190 — slipped 10d from Planning Corrections delay + unplanned task) |
| `current_phase` | Planning Review |
| `health` | At Risk |
| `today` | 2026-05-14 (Day 70) |

### Team (8 users)
| `id` | Name | Role | Departments owned |
|---|---|---|---|
| user-sarah | Sarah Chen | Project Manager | (PM only) |
| user-mike | Mike Rodriguez | Design Team Lead | Design Team |
| **user-jenny** | **Jenny Wang** | Permit Specialist — Permit Team | Permit Team **(current "me")** |
| user-david | David Park | Permit Specialist — Planning | Planning Team |
| user-lisa | Lisa Thompson | Civil Engineer | Civil Team |
| user-tom | Tom Williams | Utility Coordinator | Utility Team |
| user-emma | Emma Liu | Designer | Interior / Landscape / Visualization / Sales |
| user-alex | Alex Kumar | Executive | (read-only) |

### 12 phases / 28 tasks (from AED template, exactly)
Day offsets are from Project Day 1. Departments determine `owner_id` via the table above.

| # | Phase | Day s→e | Dept | Title |
|---|---|---|---|---|
| 1 | Demo Permit | 7→15 | Utility | Utility Cutoff + Asbestos + J Number |
| 2 | Demo Permit | 15→45 | Permit | Demo Permit Review |
| 3 | Demo Permit | 45→75 | Permit | Demo Corrections / Resubmission |
| 4 | Demo Permit | 75→95 | Permit | Demo Approval |
| 5 | Demo Permit | 95→110 | Permit | Demo Permit Issuance |
| 6 | Tree Permit | 15→55 | Design | Tree Removal Permit |
| 7 | Planning Review | 20→50 | Planning | Planning 1st Review |
| 8 | Planning Review | 50→65 | Planning | Planning Corrections / Resubmission |
| 9 | Planning Review | 65→80 | Planning | Planning Approval |
| 10 | Public Hearing | 80→95 | Planning | Planning Commission / Historic Review |
| 11 | Building Permit | 100→130 | Design | 1st Submission → Comments |
| 12 | Building Permit | 130→145 | Design | Resubmission |
| 13 | Utility | 100→105 | Utility | PG&E Will Serve |
| 14 | Utility | 100→107 | Utility | Water Will Serve |
| 15 | Utility | 100→160 | Utility | Sewer Will Serve |
| 16 | Grading Permit | 100→165 | Civil | Grading Permit |
| 17 | Encroachment Permit | 100→160 | Civil | Encroachment Permit |
| 18 | Design + Sales | 145→166 | Interior Design | Interior Design Package |
| 19 | Design + Sales | 145→159 | Landscape | Landscape Design Package |
| 20 | Design + Sales | 145→159 | Visualization | Rendering / Exterior Package |
| 21 | Design + Sales | 145→166 | Sales | Sales Package |
| 22 | Permit Approval | 145→160 | Design | Final Approval |
| 23 | Post Permit | 160→205 | Design | Solar Permit |
| 24 | Post Permit | 160→220 | Design | Fire Sprinkler Permit |
| 25 | Post Permit | 160→340 | Utility | Electrical New Service |
| 26 | Post Permit | 160→280 | Utility | Water New Service |
| 27 | Post Permit | 160→220 | Utility | Sewer New Service |
| 28 | Permit Issuance | 160→180 | Design | Final Permit Issuance |

### Status overlay at Day 70 (today)
Status is computed from `(day_offset, today_day=70)` plus explicit overrides for storytelling:

| Task # | Status | Notes |
|---|---|---|
| 1, 2 | Done | end ≤ 70 |
| 3 | **Needs Revision** | Demo Corrections — Sarah (reviewer) rejected first submission with comment "missing asbestos clearance attachment". Owner Jenny; surfaced on her My Tasks with reviewer comment. Forecast end Day 78. |
| 4, 5 | Blocked | dep on #3 |
| 6 | Done | Tree Removal, end Day 55 |
| 7 | Done | Planning 1st Review, end Day 50 |
| 8 | **Delayed** | Planning Corrections, planned end Day 65, today is Day 70 — **5 days overdue**, **on critical path**, blocks #9, #10, and the entire downstream chain. Forecast end Day 75. Owner David. |
| 9 | Blocked | dep on #8 |
| 10 | Blocked | dep on #9 |
| 11–28 | Not Started | all start ≥ Day 100 |

**Reviewer assignments:** Sarah reviews Permit Team output (Jenny's submissions); Mike reviews Planning Team work (David's submissions); Sarah also reviews Design Team output.

**Jenny's review queue (2 items)** — for demo realism, two cross-team review-handoff items are added directly to the activity stream rather than tied to specific template tasks: one from David (a sub-step of #8 Planning Corrections asking Permit Team to validate setback math) and one from Mike (Tree Permit closeout doc). Both visible only on Jenny's **My Reviews** tab.

**One Unplanned task** (`source: "unplanned"`): added by Sarah on Day 65 — "Respond to neighbor zoning objection re: setback", owner David, planned Day 65→70, status In Progress. Listed in Activity Feed as a project event; appears on Gantt outside the template; pushes Planning Approval forecast +3d.

### Dependencies
Default rule: tasks within a phase run sequentially (Demo: 1→2→3→4→5; Planning: 7→8→9; Public Hearing: 9→10; Building Permit: 11→12). Cross-phase: Planning Approval (#9) → Building Permit 1st Sub (#11); Demo Permit Issuance (#5) → Building Permit start; Final Approval (#22) → Permit Issuance (#28). The forward-pass `lib/critical-path.ts` identifies the critical path:

**Critical path:** #7 → #8 → #9 → #10 → #11 → #12 → #22 → #28 (Planning Review → Public Hearing → Building Permit → Approval → Issuance). This is the longest path through the project; Building Permit cannot start until Public Hearing closes (Day 95 + 5d lag = Day 100). Task #8 sits on this path and is currently 5 days overdue — so the demo's headline narrative ("one delayed task on the critical path shifts the entire forecast") is grounded in the data. Highlighted amber on Gantt.

---

## 5. Visual system

### Theme
Light only for v1 (dark toggle deferred).
- Background `#ffffff`
- Surface `#f8fafc` (cards)
- Border `#e2e8f0`
- Text primary `#0f172a`
- Text muted `#64748b`
- Accent `#4F46E5` (matches Planning Review hue — primary brand for the demo)

### Typography
Inter via `next/font/google`. Weights 400/500/600/700. Headings tight tracking (-0.01em); body 14px base.

### Permit color palette (`lib/permits.ts`)
| Phase | Hex |
|---|---|
| Demo Permit | `#E76F51` |
| Tree Permit | `#2A9D8F` |
| Planning Review | `#4F46E5` |
| Public Hearing | `#9333EA` |
| Building Permit | `#2563EB` |
| Utility | `#D97706` |
| Grading Permit | `#92400E` |
| Encroachment Permit | `#0891B2` |
| Design + Sales | `#DB2777` |
| Permit Approval | `#059669` |
| Post Permit | `#475569` |
| Permit Issuance | `#CA8A04` |

Each color also has a `tint` (≈15% opacity) and `border` (full saturation) variant for the Gantt bar fill/outline rules below.

### Status overlay rules
Color = permit. Status conveyed by fill style + border + icon.

| Status | Visual rule |
|---|---|
| Not Started | dashed border in permit color, transparent fill |
| Ready | dashed border, 15% tint fill |
| In Progress | solid 100% fill |
| Submitted for Review | solid fill + diagonal hatch overlay |
| Needs Revision | solid fill + amber `#F59E0B` border 2px + ⚠ icon |
| Delayed | solid fill + red `#EF4444` border 2px + 🕒 icon |
| Blocked | 40% opacity fill + 🔒 icon |
| Approved / Done | solid fill + ✓ check |
| Cancelled | gray `#94A3B8` fill, strike-through label |

### Three-layer time rendering on Gantt
- **Baseline:** dashed outline rectangle, no fill, permit-color stroke.
- **Forecast:** tinted fill (15% permit color), drawn when `forecast_due > planned_due`.
- **Actual:** solid permit-color fill, drawn from `actual_start` to `actual_end` (or `today` for In Progress).

Bars are stacked: baseline outline at full row height; forecast and actual nested inside at 70% height with vertical centering. Owner avatar circle sits at the left edge of the actual bar.

---

## 6. Page specs

### 6.1 Dashboard (`/`)
- **6 KPI cards (row):** Active Projects (1) · At Risk (1) · Overdue Tasks (1) · Needs Revision (1) · Critical-path Overdue (1) · Next-7d Deadlines (4).
- **Project Status table** (1 row, since single project): permit-type chip, phase chip, progress bar (computed Done/Total = 3/28 plus partial Delayed), forecast variance "+10d", delayed count "2", owner avatar, next milestone "Planning Approval (Day 65→80)", health badge "At Risk". Row click → `/projects/prj-9-greenwood-pl`.
- **Permit Stage stepper** (horizontal, 12 chips, colored by permit palette): Demo Permit · Tree · **Planning Review (current)** · Public Hearing · Building · Utility · Grading · Encroach · Design+Sales · Approval · Post Permit · Issuance. Current step has solid fill; past steps have ✓; future are outline. Hover shows task count + completion %.
- **Team Workload:** 8 rows (one per user). Each row: avatar, name, role, then 3 stacked horizontal bars: active (count), overdue (count, red if >0), review-queue (count). Sorted by overdue desc.
- **Upcoming Deadlines (next 7 days):** vertical list, day-grouped, each item shows: date, task title, project, owner avatar, permit chip, priority dot.

### 6.2 Project Page (`/projects/[id]`)
**Header:** address, 320×200 photo placeholder (gray with house icon), 4 chips (phase · health · baseline-end · forecast-end with red delta), purchase date/cost, owner avatar pill.

**Sub-tab nav (sticky):** Overview · Timeline · Tasks · Activity.

**Overview tab:**
- Mini summary cards: Days Elapsed (70 / 180) · % Complete (~12%) · Delayed Tasks (2) · Review Backlog (2)
- Last 5 activity items
- Critical path summary card listing the 8 critical tasks with their statuses

**Timeline tab (Gantt — the centerpiece):**
- Header toolbar: Zoom (Week / Month / Quarter), Filters (Phase / Owner / Status / Permit), Dependency arrows toggle, "Today" jump button.
- Row grouping: by phase, each phase row collapsible with a colored chevron and task count.
- Each task row: left label column (avatar + truncated title + status icon) | bar area (baseline outline + forecast tint + actual fill, per §5).
- Dependency arrows: SVG paths between bars, FS-default; muted gray, amber if on critical path.
- Today marker: vertical dashed line at Day 70.
- Tooltip on hover: full title, planned start/due, forecast start/due, actual start/end (if any), owner, reviewer, status.
- Click bar → opens Task Drawer (right Sheet).

**Tasks tab:**
- Table: Title · Permit (chip) · Owner (avatar+name) · Reviewer · Status · Planned Due · Forecast Due · Δ days · Priority.
- Sortable columns, multi-filter, inline status pill click cycles status (demo only).
- "+ Add Unplanned Task" button → dialog with title, phase, dates, owner, dependency, **Impact Preview** showing "forecast end +3d, X tasks shifted". Apply commits to store.

**Activity tab:**
- Reverse-chronological list of ~12 events: review submissions, revisions, dependency shifts, unplanned-task adds, status changes. Each entry: actor avatar, timestamp, action sentence, optional comment block.

**Task Drawer (right Sheet, ~480px wide):**
- Title + status badge + permit chip
- Three-layer dates as `ThreeLayerDates` component (planned · forecast · actual)
- Owner + Reviewer rows with avatars
- Dependencies (predecessors / successors) as chip lists
- Checklist (3–5 static items) with checkboxes
- Comments thread (2–3 mocked messages)
- Action footer (state-aware): Start · Submit for Review · Approve · Request Revision · Mark Done · Reopen

### 6.3 My Tasks (`/my-tasks`)
**Persona:** Jenny Wang.

- **Focus banner:** 3 chips — "5 active tasks", "1 needs revision (urgent)", "2 to review".
- **Tabs:** My Tasks · My Reviews · Calendar · History.
  - **My Tasks:** card grid (5 cards, Jenny's Demo Permit tasks). Each card: 4px permit color stripe, title, project link, deadline pill (red if overdue), priority dot, status badge, primary action button (Start / Continue / Submit for Review / Resubmit).
  - **My Reviews:** 2 cards of work submitted to Jenny. Title, submitter avatar, submitted-at, time-waiting, Approve + Request Revision buttons.
  - **Calendar:** month grid (May 2026). Each cell shows dots colored by permit. Click dot → opens task drawer.
  - **History:** 6–8 completed tasks list, with on-time badge, completion timestamp, review turnaround time, Reopened flag where applicable.
- **Completion animation:** clicking Mark Done or Approve triggers a 300ms scale-down + fade on the card, slide to History tab. A `Toast` with "Marked done · Undo" lingers 8s. `prefers-reduced-motion: reduce` swaps the animation for an instant disappearance.
- **Empty state** (when no tasks match filter): centered "All clear ✓" with a small project-progress nudge.

---

## 7. State management

Single Zustand store with `persist` middleware (`localStorage` key: `builder-demo-state`).

```ts
interface DemoState {
  currentUserId: UserId           // "View as" switcher
  tasks: Record<TaskId, Task>     // mutable copy of sample-data, with status changes saved
  activity: ActivityEvent[]       // appended on any state mutation
  unplannedTasks: Task[]          // added via Add-Unplanned-Task dialog
  setStatus(taskId, status): void
  submitForReview(taskId): void
  approve(taskId): void
  requestRevision(taskId, comment): void
  markDone(taskId): void
  reopen(taskId, reason): void
  addUnplanned(task): void
  resetDemo(): void               // exposed via topbar gear menu
}
```

A small "Reset demo" button in the topbar gear menu wipes localStorage and reloads — so you can rehearse the demo cleanly.

---

## 8. Computed / derived values

Pure functions in `lib/`:
- `dates.dayToDate(day_offset, project_start)` and inverse.
- `dates.today()` returns `2026-05-14` (Day 70). For demo determinism this is **fixed** regardless of real wall clock — so the spec doesn't drift over time. Wall clock can be enabled via `?live=1` query param.
- `critical-path.compute(tasks, deps)` returns the set of `task_id`s on the critical path.
- `forecast.cascade(tasks, deps, sourceDelay)` recomputes downstream forecast dates when a task slips.
- KPI aggregators (overdue count, review backlog, next-7d deadlines) are simple `filter().length`.

---

## 9. Routing & deployment

- Local dev: `npm run dev` → `http://localhost:3000/`.
- Static build: `npm run build` → produces `out/`.
- GitHub Pages publishing flow: `npm run build` outputs static files into `builder-demo/out/`. The contents of `out/` are then copied up into a sibling folder `Real-Estate-Analysis/builder-demo-site/` (or any path of choice) and committed; GitHub Pages serves it at `yuzhu9387.github.io/Real-Estate-Analysis/builder-demo-site/`. Keeping source (`builder-demo/`) and built output (`builder-demo-site/`) as siblings avoids committing `node_modules` or `.next` to the Pages-served path.
- `next.config.js` sets `basePath` from `NEXT_PUBLIC_BASE_PATH` env, defaulting to `''` in dev and `/Real-Estate-Analysis/builder-demo-site` in production builds.
- A `.nojekyll` file is included to prevent GitHub Pages from stripping underscored Next.js asset folders.

---

## 10. Out of scope (future iterations)

- Real backend (Postgres + API), auth, multi-tenant.
- Analytics / performance metrics page (PRD §12).
- Live editing of Gantt bars (drag to reschedule).
- Multi-project portfolio with real filters.
- Mobile-optimized layout.
- Audit log viewer (just shown in Activity feed for now).

---

## 11. Risks & open questions

1. **Static export quirks**: shadcn/ui's some components rely on `next/link` defaults that may need adjustment for static export under a `basePath`. Mitigation: smoke-test deploy early in implementation.
2. **Custom Gantt complexity**: rendering 28 task bars + dependency arrows + three-layer dates + critical-path highlight is the biggest single component. Mitigation: build the simplest version first (bars only), layer features.
3. **Color accessibility**: 12 permit hues need to stay distinguishable for colorblind viewers. The status overlay (icons, borders) ensures status is never *only* color-encoded. The permit chip always includes the permit name in text — color is supplementary. WCAG AA contrast verified for badge text on white.
4. **Today is fixed at 2026-05-14**: if the demo is given months later the dates will look stale. Acceptable for v1; a "shift today" dev toggle can be added later.
