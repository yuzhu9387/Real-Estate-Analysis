import { and, eq, inArray, notInArray, desc, asc, sql, or } from 'drizzle-orm'
import type { DB } from '@/db/client'
import {
  tasks, projects, projectPhases, projectWorkflows, users,
  type Task, type Project, type ProjectPhase, type TaskStatus,
} from '@/db/schema'
import { rankMyOpenTasks } from '@/lib/my-tasks/ranking'

export type TaskWithContext = {
  task: Task
  /** Null for personal tasks (task.projectId IS NULL). */
  project: Pick<Project, 'id' | 'name' | 'status' | 'brand' | 'kickedOffAt'> | null
  /** Null for personal tasks. */
  phase: Pick<ProjectPhase, 'id' | 'name'> | null
}

export type MyTasksData = {
  openTasks: TaskWithContext[]
  pendingReview: TaskWithContext[]
  completedTasks: TaskWithContext[]
  completedTotal: number
  todayDayOffset: number
}

const TERMINAL_STATUSES: TaskStatus[] = ['complete', 'wont_do']

async function withContext(db: DB, rows: Task[]): Promise<TaskWithContext[]> {
  if (rows.length === 0) return []
  const projectIds = Array.from(
    new Set(rows.map(r => r.projectId).filter((id): id is string => id !== null)),
  )
  const workflowIds = Array.from(
    new Set(rows.map(r => r.projectWorkflowId).filter((id): id is string => id !== null)),
  )

  const [projectRows, workflowRows, phaseRows] = await Promise.all([
    projectIds.length === 0
      ? Promise.resolve([])
      : db.select({
          id: projects.id, name: projects.name, status: projects.status,
          brand: projects.brand, kickedOffAt: projects.kickedOffAt,
        }).from(projects).where(inArray(projects.id, projectIds)),
    workflowIds.length === 0
      ? Promise.resolve([])
      : db.select({
          id: projectWorkflows.id, projectPhaseId: projectWorkflows.projectPhaseId,
        }).from(projectWorkflows).where(inArray(projectWorkflows.id, workflowIds)),
    projectIds.length === 0
      ? Promise.resolve([])
      : db.select({
          id: projectPhases.id, name: projectPhases.name,
        }).from(projectPhases).where(inArray(projectPhases.projectId, projectIds)),
  ])

  const projectById = new Map(projectRows.map(p => [p.id, p]))
  const workflowToPhase = new Map(workflowRows.map(w => [w.id, w.projectPhaseId]))
  const phaseById = new Map(phaseRows.map(p => [p.id, p]))

  return rows.map(t => {
    const project = t.projectId ? projectById.get(t.projectId) ?? null : null
    const phaseId = t.projectWorkflowId ? workflowToPhase.get(t.projectWorkflowId) : undefined
    const phase = phaseId ? phaseById.get(phaseId) ?? null : null
    return { task: t, project, phase }
  })
}

export async function getMyTasks(
  db: DB,
  userId: string,
  opts: { completedOffset?: number; completedLimit?: number } = {},
): Promise<MyTasksData> {
  const completedLimit = opts.completedLimit ?? 100
  const completedOffset = opts.completedOffset ?? 0

  // Open tasks: any non-terminal task owned by the user.
  //   - If the task belongs to a project, restrict to draft + in_progress projects.
  //   - Personal tasks (project_id IS NULL) are always included.
  const openRows = await db.select().from(tasks)
    .leftJoin(projects, eq(tasks.projectId, projects.id))
    .where(and(
      eq(tasks.ownerId, userId),
      notInArray(tasks.status, TERMINAL_STATUSES),
      or(
        sql`${tasks.projectId} IS NULL`,
        inArray(projects.status, ['draft', 'in_progress']),
      ),
    ))
  const openTaskRows = openRows.map(r => r.tasks)
  const openWithCtx = await withContext(db, openTaskRows)

  const todayMs = Date.now()
  const kickoffDates = openRows
    .map(r => r.projects?.kickedOffAt ?? null)
    .filter((d): d is Date => d !== null)
  const earliestKickoff = kickoffDates.length === 0 ? null
    : kickoffDates.reduce((a, b) => a.getTime() < b.getTime() ? a : b)
  const todayDayOffset = earliestKickoff
    ? Math.max(0, Math.floor((todayMs - earliestKickoff.getTime()) / (24 * 60 * 60 * 1000)))
    : 0

  const rankedTasks = rankMyOpenTasks(
    openTaskRows.map(t => ({
      id: t.id, isBlocked: t.isBlocked, plannedEndDay: t.plannedEndDay,
      isOnCriticalPath: t.isOnCriticalPath, priority: t.priority,
    })),
    todayDayOffset,
  )
  const ctxById = new Map(openWithCtx.map(x => [x.task.id, x]))
  const openTasks = rankedTasks.map(r => ctxById.get(r.id)!).filter(Boolean)

  // "Under Review" surface: every pending_review task I'm involved in — either I'm the
  // reviewer (action needed) or I'm the owner (waiting for someone else's review).
  // Include both draft and in_progress projects, matching the Open tab's project filter.
  const pendingRows = await db.select().from(tasks)
    .innerJoin(projects, eq(tasks.projectId, projects.id))
    .where(and(
      or(eq(tasks.reviewerId, userId), eq(tasks.ownerId, userId)),
      eq(tasks.status, 'pending_review'),
      inArray(projects.status, ['draft', 'in_progress']),
    ))
    .orderBy(asc(tasks.updatedAt))
  const pendingReview = await withContext(db, pendingRows.map(r => r.tasks))

  // Completed: include personal tasks too (LEFT JOIN); no project-status filter.
  const completedRows = await db.select().from(tasks)
    .leftJoin(projects, eq(tasks.projectId, projects.id))
    .where(and(
      eq(tasks.ownerId, userId),
      inArray(tasks.status, TERMINAL_STATUSES),
    ))
    .orderBy(desc(tasks.updatedAt))
    .limit(completedLimit)
    .offset(completedOffset)
  const completedTasks = await withContext(db, completedRows.map(r => r.tasks))

  const completedCountRow = await db.select({ c: sql<number>`count(*)::int` })
    .from(tasks)
    .where(and(
      eq(tasks.ownerId, userId),
      inArray(tasks.status, TERMINAL_STATUSES),
    ))
  const completedTotal = completedCountRow[0]?.c ?? 0

  return { openTasks, pendingReview, completedTasks, completedTotal, todayDayOffset }
}

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
    if (!u.larkOpenId) continue

    const ownedOpen = await db.select({
      plannedEndDay: tasks.plannedEndDay,
      kickedOffAt: projects.kickedOffAt,
    }).from(tasks)
      .innerJoin(projects, eq(tasks.projectId, projects.id))
      .where(and(
        eq(tasks.ownerId, u.id),
        notInArray(tasks.status, TERMINAL_STATUSES),
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
