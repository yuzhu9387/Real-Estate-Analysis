import { and, eq, asc, ne } from 'drizzle-orm'
import type { DB } from '@/db/client'
import { projects, users, type User } from '@/db/schema'

export type QuickAddProject = {
  id: string
  name: string
  brand: string
  status: 'draft' | 'in_progress' | 'complete' | 'archived'
  kickedOffAt: Date | null
  /** True when the user is allowed to quick-add to this project (in_progress + kicked off). */
  eligible: boolean
  /** Human-readable reason this project isn't pickable (null when eligible). */
  ineligibleReason: string | null
}

/**
 * All projects the current user manages and could pick from in the My Tasks "Quick add" picker.
 *
 * The picker shows every project the user manages (so people can see their work) and marks
 * each one's eligibility: tasks can only be quick-added to projects that are in_progress AND
 * have been kicked off (we need the kickoff date to materialize calendar target dates).
 *
 *   - Non-archived projects only (drafts + in_progress shown; complete + archived hidden).
 *   - Owners see every project; non-owners see only ones where they are PM.
 */
export async function listQuickAddProjects(db: DB, user: User): Promise<QuickAddProject[]> {
  const whereClauses = [ne(projects.status, 'archived'), ne(projects.status, 'complete')]
  if (user.role !== 'owner') {
    whereClauses.push(eq(projects.pmId, user.id))
  }

  const rows = await db
    .select({
      id: projects.id,
      name: projects.name,
      brand: projects.brand,
      status: projects.status,
      kickedOffAt: projects.kickedOffAt,
    })
    .from(projects)
    .where(and(...whereClauses))
    .orderBy(asc(projects.name))

  return rows.map((r) => {
    let eligible = true
    let reason: string | null = null
    if (r.status !== 'in_progress') {
      eligible = false
      reason = 'Project is still in draft — kick it off to enable quick add.'
    } else if (!r.kickedOffAt) {
      eligible = false
      reason = 'Project has no kickoff date yet.'
    }
    return {
      id: r.id,
      name: r.name,
      brand: r.brand,
      status: r.status,
      kickedOffAt: r.kickedOffAt,
      eligible,
      ineligibleReason: reason,
    }
  })
}

/** Active users available as the assignee on a quick-add task. (Reserved for future use.) */
export async function listAssignableUsers(db: DB): Promise<Array<Pick<User, 'id' | 'name' | 'role' | 'team' | 'avatarUrl'>>> {
  return db
    .select({
      id: users.id, name: users.name, role: users.role, team: users.team, avatarUrl: users.avatarUrl,
    })
    .from(users)
    .where(eq(users.isActive, true))
    .orderBy(asc(users.name))
}
