import { eq, ne, and, inArray, or, sql } from 'drizzle-orm'
import type { DB } from '@/db/client'
import { projects, projectPhases, tasks, users, type Project, type ProjectPhase, type TaskStatus } from '@/db/schema'
import { evaluateAtRisk } from '@/lib/dashboard/at-risk'

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
  const pattern = `%${q.trim().toLowerCase()}%`
  return db.select().from(projects).where(
    or(
      sql`lower(${projects.name}) LIKE ${pattern}`,
      sql`lower(coalesce(${projects.address}, '')) LIKE ${pattern}`,
      sql`lower(coalesce(${projects.city}, '')) LIKE ${pattern}`,
      sql`lower(coalesce(${projects.zip}, '')) LIKE ${pattern}`,
      sql`lower(coalesce(${projects.titleHolder}, '')) LIKE ${pattern}`,
    ),
  )
}

export type DashboardCounters = {
  active: number
  atRisk: number
  underPermitting: number
  underConstruction: number
  onSale: number
}

export async function computeDashboardCounters(
  db: DB,
  opts: { brand?: 'al_homes' | 'alera' | 'apex' },
  today: Date,
): Promise<DashboardCounters> {
  const rows = await listProjectsForDashboard(db, opts)
  let active = 0, atRisk = 0, underPermitting = 0, underConstruction = 0, onSale = 0
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
      if (p.listingDate && !p.sold) onSale++
    }
  }
  return { active, atRisk, underPermitting, underConstruction, onSale }
}

export async function listActiveProjectsForTeam(
  db: DB,
  opts: { team: 'design' | 'construction' | 'sales' },
): Promise<DashboardProject[]> {
  const teamUsers = await db.select({ id: users.id }).from(users).where(eq(users.team, opts.team))
  if (teamUsers.length === 0) return []
  const teamUserIds = teamUsers.map(u => u.id)

  const NON_TERMINAL: TaskStatus[] = ['not_started', 'started', 'pending_review', 'approved']
  const candidateTasks = await db.select({ projectId: tasks.projectId })
    .from(tasks)
    .where(and(
      inArray(tasks.ownerId, teamUserIds),
      inArray(tasks.status, NON_TERMINAL),
    ))
  const projectIds = Array.from(new Set(candidateTasks.map(t => t.projectId)))
  if (projectIds.length === 0) return []

  const projectRows = await db.select().from(projects)
    .where(and(inArray(projects.id, projectIds), eq(projects.status, 'in_progress')))
  if (projectRows.length === 0) return []
  const phaseRows = await db.select().from(projectPhases)
    .where(inArray(projectPhases.projectId, projectRows.map(p => p.id)))
  const phasesByProject = new Map<string, ProjectPhase[]>()
  for (const ph of phaseRows) {
    if (!phasesByProject.has(ph.projectId)) phasesByProject.set(ph.projectId, [])
    phasesByProject.get(ph.projectId)!.push(ph)
  }
  return projectRows.map(p => ({ ...p, phases: phasesByProject.get(p.id) ?? [] }))
}
