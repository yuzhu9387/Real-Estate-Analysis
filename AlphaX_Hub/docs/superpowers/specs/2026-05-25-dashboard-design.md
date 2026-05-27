# BuildFlow Dashboard, Team, and Performance Review Views — Design

**Date**: 2026-05-25
**Status**: Draft
**Scope**: UI design for the three top-level navigation areas: **Dashboard**, **Team**, and **Performance Review**. All three are read-only views that visualize data already in the schema established by the foundation spec; they introduce no new entities or mutations.
**Depends on**: `2026-05-22-foundation-design.md` (post-update — includes `users.team`, `projects.brand`, and the extended set of project target/actual milestone fields).

---

## 1. Overview

The signed-in app is divided into three top-level navigation sections:

1. **Dashboard** — operational view of all active projects, with brand and phase filters, quarter grouping, and at-risk highlighting.
2. **Team** — three tabs (one per team: Design, Construction, Sales) showing each team's actively-worked projects.
3. **Performance Review** — three tabs (one per team) of read-only visualizations: target-vs-actual on-time rate, task throughput, completion quality. Strictly visualizes data already in the database.

All three views are accessible to every authenticated user (`owner`, `pm`, `ic`). They display the same data to all viewers; permissions only affect what the user can do on the **project detail** page they navigate to, not what they can see in dashboards.

### Non-goals

- Editing projects, tasks, or team membership from these views (mutations happen only on the project detail / settings pages defined in foundation spec + future project-page spec)
- Cross-team Performance Review (aggregating across teams) — handled later if needed
- Export to CSV / PDF — deferred
- Real-time updates / push (data refreshes on page load and on Server Action revalidation)

---

## 2. Navigation structure

Left sidebar lists three sections in order:

```
┌──────────────────────────┐
│  BuildFlow               │
├──────────────────────────┤
│  📊 Dashboard            │  ← / (default landing)
│  👥 Team                 │  ← /team
│  📈 Performance Review   │  ← /performance
├──────────────────────────┤
│  Settings (owner only)   │
│  ↳ Members               │
│  ↳ Audit logs            │
│  ↳ Workflow Templates    │
└──────────────────────────┘
```

- Default landing after login = Dashboard
- Sidebar collapsible; on mobile, hamburger menu

---

## 3. Dashboard view

### 3.1 Layout

```
┌──────────────────────────────────────────────────────────────────────────┐
│ [Brand: ▼ Al Homes]    [🔍 Search projects...]              [User avatar]│
├──────────────────────────────────────────────────────────────────────────┤
│  ┌────────────┐ ┌────────────┐ ┌──────────────┐ ┌──────────────┐         │
│  │ Active     │ │ At Risk    │ │ Under        │ │ Under        │         │
│  │   42       │ │   7  🔴    │ │ Permitting   │ │ Construction │         │
│  │ projects   │ │ projects   │ │   18         │ │   16         │         │
│  └────────────┘ └────────────┘ └──────────────┘ └──────────────┘         │
│  (clickable filter chips — selecting one filters the list below)         │
├──────────────────────────────────────────────────────────────────────────┤
│  2026 Q3 — Target Exit (12 projects, 3 at risk)                          │
│  ────────────────────────────────────────                                │
│  🔴 9 Greenwood Pl — Newton, MA — Under Construction — 14d behind        │
│  🔴 22 Oak St — Newton, MA — Presale Phase 2 — listing date overdue      │
│  🔴 1 Elm Rd  — Cambridge — Under Permitting — permit overdue 8d         │
│  ⚪ 14 Pine Ln  — Belmont — Under Construction — on track                 │
│  ⚪ ...                                                                   │
│                                                                          │
│  2026 Q4 — Target Exit (15 projects, 2 at risk)                          │
│  ────────────────────────────────────────                                │
│  🔴 ...                                                                  │
│  ⚪ ...                                                                  │
│                                                                          │
│  2027 Q1 — Target Exit (10 projects, 2 at risk)                          │
│  ...                                                                     │
└──────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Brand switcher (top-left)

- Dropdown with options: **Al Homes**, **Alera**, **Apex**, **All Brands** (default = All Brands)
- Selection filters every project list on the page and updates the counter buttons
- Persisted in URL query string (`?brand=al_homes`) so links are shareable

### 3.3 Search box (top-right)

- Live filter: matches against project `name`, `address`, `city`, `zip`, `pm.name`, `title_holder`
- Results replace the grouped list with a flat ranked match list
- Clearing the search restores the grouped/filtered view
- Debounced 200ms; queries via Server Action returning ranked matches

### 3.4 Counter chips

Four clickable counters at the top:

| Chip | Filter |
|---|---|
| **Active** | All non-`archived` projects with `status='in_progress'` |
| **At Risk** | All Active projects matching the at-risk rules (§3.7) |
| **Under Permitting** | Active projects whose Phase 1 `Permitting` is `in_progress` |
| **Under Construction** | Active projects whose Phase 2 `Construction` is `in_progress` |

- Each chip displays the count
- Clicking a chip toggles its filter; multiple chips can be active (intersection)
- Counts update reactively when brand switcher / search changes

A **Presale** chip is implied (Phase 3 `Sale` `in_progress`) — if user later confirms they want it, add a 5th chip. **Open question** (§7).

### 3.5 List grouping

Projects are grouped by **`target_exit_quarter`**, ascending. Each group header shows:

- Quarter label (`2026 Q3 — Target Exit`)
- Count of projects in that quarter, with at-risk subcount

Within each group, projects are sorted:

1. **At-risk first** (descending by severity — see §3.7)
2. Then by ascending `target_exit_quarter` date (already implied by grouping, but stable within group)
3. Then by `target_permit_date` ascending (earlier targets first)

### 3.6 Project row content

Each row shows (compact, one-line where possible):

- Risk indicator: 🔴 (at-risk) or ⚪ (on-track)
- Project name + city/state
- Current state label: derived from project + phases (e.g., "Under Permitting", "Presale Phase 2", "Listed")
- Lateness summary: `X days behind` if at-risk, `on track` otherwise
- Brand tag (small chip)
- Clicking the row navigates to `/projects/[id]`

Current-state derivation (computed at query time):

```
if sold = true                                       → "Sold"
elif listing_date is set                             → "Listed"
elif presale_phase3_date is set                      → "Presale Phase 3"
elif presale_phase2_date is set                      → "Presale Phase 2"
elif presale_phase1_date is set                      → "Presale Phase 1"
elif phase 'Construction' in_progress                → "Under Construction"
elif phase 'Permitting'   in_progress                → "Under Permitting"
elif project.status = 'draft'                        → "Draft"
elif project.status = 'complete'                     → "Complete"
elif project.status = 'archived'                     → "Archived"
```

### 3.7 At-risk definition

A project is **at risk** if any of the following is true and the corresponding actual is not yet set:

| Trigger | Condition |
|---|---|
| Permit overdue | `today > target_permit_date` AND `actual_permit_date IS NULL` |
| Construction overdue | `today > target_construction_end_date` AND `actual_construction_end_date IS NULL` |
| Exit-quarter overdue | `today > end-of-target_exit_quarter` AND `sold = false` |

Severity (used for sort order within group):

1. Exit-quarter overdue → highest severity
2. Construction overdue
3. Permit overdue

A project triggering multiple conditions is ranked at the highest matching severity.

**Rationale**: deliberately mechanical — uses only fields already in the schema, no judgement calls. Can be refined later (e.g., projecting "soft risk" by % of construction tasks slipping) without touching foundation.

---

## 4. Team view

### 4.1 Layout

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Team                                                                    │
├──────────────────────────────────────────────────────────────────────────┤
│  [ Design ] [ Construction ] [ Sales ]                                   │
│  ─────────                                                               │
│  Design team — active projects                                           │
│  ────────────────────                                                    │
│  9 Greenwood Pl — Newton — Under Permitting — 4 active tasks, 1 at risk  │
│  1 Elm Rd — Cambridge — Under Permitting — 6 active tasks                │
│  ...                                                                     │
└──────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Tabs

Three tabs, one per team:

- **Design** — `users.team = 'design'`
- **Construction** — `users.team = 'construction'`
- **Sales** — `users.team = 'sales'`

The active tab is reflected in the URL (`/team/design`, `/team/construction`, `/team/sales`). Default = first tab the user belongs to (or **Design** if user has no team or `role='owner'` with no team).

### 4.3 What "active project" means per team

A project shows in a team's tab when **any task** in the relevant phase has `owner.team = <tab's team>` AND the task is in a non-terminal status (`not_started`, `started`, `pending_review`, `approved`) AND the project is `in_progress`. Specifically:

- **Design tab**: active projects with ≥1 non-terminal task in **Permitting** phase owned by a Design-team user
- **Construction tab**: active projects with ≥1 non-terminal task in **Construction** phase owned by a Construction-team user
- **Sales tab**: active projects with ≥1 non-terminal task in **Sale** phase owned by a Sales-team user

This intentionally **uses task-owner team, not project phase alone** — because assignment is not enforced by team (per foundation spec), a Sales team member could be assigned a Permitting task; that task surfaces on the Sales tab as well, drawing attention to cross-team assignments.

### 4.4 Row content

Each project row shows:

- Project name + city
- Current state label (same derivation as §3.6)
- Count of active tasks owned by this team
- Count of at-risk tasks (a task is at-risk if it has slipped past its `planned_end_day` — same logic as builder-demo)

Clicking a row navigates to `/projects/[id]?focus=team-tasks` (project detail page can scroll/filter to that team's tasks — out of scope for this spec, but the route param is reserved).

---

## 5. Performance Review view

### 5.1 Layout

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Performance Review                                                      │
├──────────────────────────────────────────────────────────────────────────┤
│  [ Design ] [ Construction ] [ Sales ]                                   │
│  ─────────                                                               │
│  Time range: [Last 90 days ▼]   Brand: [All ▼]                           │
│                                                                          │
│  ┌────────────────┐ ┌────────────────┐ ┌────────────────┐               │
│  │ On-time permit │ │ Avg permit dur │ │ Tasks completed│               │
│  │  78%           │ │  62 days       │ │  142           │               │
│  │ (target 90%)   │ │ (target 45)    │ │ (last 90 days) │               │
│  └────────────────┘ └────────────────┘ └────────────────┘               │
│                                                                          │
│  Task quality                                                            │
│  ────────────                                                            │
│  - Tasks approved on first review:      87%                              │
│  - Tasks requiring revision (≥1 round): 13%                              │
│  - Tasks marked won't do:                4                               │
│                                                                          │
│  Per-person breakdown (table, sortable):                                 │
│  Name           | Tasks done | On-time | First-pass | Avg review time   │
│  Jenny Wang     | 38         | 92%     | 95%        | 1.2 days          │
│  Mark Chen      | 31         | 80%     | 88%        | 2.1 days          │
│  ...                                                                     │
└──────────────────────────────────────────────────────────────────────────┘
```

### 5.2 Filters

- **Time range** dropdown: Last 30 days / Last 90 days / Last 365 days / All time (default: Last 90 days)
- **Brand**: same brand filter as Dashboard

### 5.3 Metrics shown per team tab

All computed from existing schema; no new tables required.

**Header KPI cards** (3 cards):

| Metric | Definition (using foundation schema fields) |
|---|---|
| **On-time delivery rate** | For projects with `actual_<phase>_end_date` set: `count(actual_date ≤ target_date) / count(non-null actual_dates)`. Phase per team: Design → permit dates; Construction → construction end dates; Sales → listing/sold-by-target-quarter |
| **Avg phase duration** | Mean of `(actual_<phase>_end_date − phase_start_date)` in days. For Sales tab: mean of `(listing_date − target_exit_quarter_start)` or similar |
| **Tasks completed** | Count of `tasks.status='complete'` where `tasks.owner_id ∈ team users` and `updated_at` falls in the time range |

**Task quality section**:

| Metric | Definition |
|---|---|
| **First-pass approval rate** | `count(tasks completed with zero 'review_revision' comments) / count(completed tasks)` |
| **Revision rate** | `1 − first-pass approval rate` |
| **Won't-do count** | Count of `tasks.status='wont_do'` updated in the time range, owned by team |

**Per-person table**:

Columns: `name`, `tasks completed (count)`, `on-time rate`, `first-pass approval`, `avg review-loop turnaround`.

`avg review-loop turnaround` = mean delta between `task.status` transition to `pending_review` and next transition to `approved` (uses `activities` table — events are already structured per foundation spec).

### 5.4 Computation strategy

- All metrics computed at query time on dashboard load (no precomputation / materialized views).
- Performance budget for v1: ≤ 1s response on 1000 projects, 10000 tasks, single Postgres instance. If exceeded, revisit and add a `team_metrics_daily` materialized table.
- Query helpers live in `db/queries/dashboard-metrics.ts`; consumed by RSC `app/(app)/performance/page.tsx`.

---

## 6. Data dependencies

Every view above can be served by the schema in the updated foundation spec. No new tables or columns required for v1. Specifically:

| View | Reads from |
|---|---|
| Dashboard list | `projects`, `project_phases` (for current-state derivation) |
| Dashboard counters | `projects`, `project_phases` |
| Search | `projects`, `users` |
| Team view | `projects`, `tasks`, `users` (filtered by `users.team`) |
| Performance Review KPIs | `projects`, `tasks`, `task_comments` (for revision count), `activities` (for review-loop turnaround) |

---

## 7. Open questions

1. **Add a "Presale" counter chip?** §3.4 covers Active / At Risk / Under Permitting / Under Construction. A 5th **Presale** chip (Phase 3 `Sale` in_progress) is a likely addition. Confirm before implementation.
2. **Definition of `actual_duration_days`**: total project duration from `purchase_date` to `listing_date`, or to `sold` event? Or selectable? Defaulting to `purchase_date → listing_date` until clarified.
3. **"Tasks completed" time anchor**: use `tasks.updated_at` (the row update timestamp) or the `activities` event timestamp when status moved to `complete`? Defaulting to `activities` row (more accurate) but `updated_at` is faster.
4. **All-brands aggregation default**: should the brand switcher default to **All Brands** or to the user's "home brand"? Currently no concept of home brand; defaulting to **All Brands**.
5. **Performance Review access**: visible to all roles (`ic` can see how everyone is performing)? Or restricted to `owner` and PMs? Currently designed as visible to all; flag if that should change.

---

## 8. Out of scope (this spec)

- Project detail page UI (Overview / Gantt / Task List) — separate spec
- Settings / Workflow Templates editor UI — separate spec
- My Tasks page UI — separate spec
- Mobile-specific layouts — handled when those specs are written; this design assumes desktop-first
- Export / report generation
