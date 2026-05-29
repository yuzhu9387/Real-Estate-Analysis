import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock next/cache BEFORE any imports that transitively use it.
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

// Route the action's db import to the test database so writes are visible
// in testDb queries and get cleaned up by truncateAll().
vi.mock('@/db/client', async () => {
  const { testDb } = await import('@/tests/db')
  return { db: testDb }
})

import type { User } from '@/db/schema'
let __currentUser: User | null = null
function __setCurrentUser(u: User | null) { __currentUser = u }

vi.mock('@/lib/server/get-current-user', () => ({
  getCurrentUser: async () => __currentUser,
  requireUser: async () => {
    if (!__currentUser) throw new Error('Test: no current user set')
    return __currentUser
  },
}))

vi.mock('@/lib/server/require-permission', () => ({
  requirePermission: async (action: { type: string }) => {
    const { UnauthorizedError, ForbiddenError } = await import('@/lib/server/errors')
    if (!__currentUser) throw new UnauthorizedError()
    const { can } = await import('@/lib/permissions')
    if (!can(__currentUser as User, action as Parameters<typeof can>[1])) {
      throw new ForbiddenError(`Denied: ${action.type}`)
    }
    return __currentUser
  },
}))

import { testDb, truncateAll } from '@/tests/db'
import { seedUser } from '@/tests/fixtures/users'
import { seedTemplate } from '@/tests/fixtures/workflow-templates'
import { projectService } from '@/lib/services/project-service'
import { tasks } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { updateTaskMetadata } from '@/app/actions/tasks'

async function seed() {
  const owner = await seedUser({ role: 'owner' })
  const pm = await seedUser({ role: 'pm' })
  const ic = await seedUser({ role: 'ic' })
  const { template } = await seedTemplate({
    createdById: owner.id, name: 'Permitting',
    tasks: [{ name: 'Survey', startDay: 1, endDay: 6 }],
    deps: [],
  })
  const project = await projectService.create({
    name: 'P', brand: 'al_homes', pmId: pm.id,
    createdById: owner.id,
    assignments: [{ phaseName: 'Permitting', templateId: template.id, sortOrder: 0 }],
  }, testDb)
  const [task] = await testDb.select().from(tasks).where(eq(tasks.projectId, project.id))
  return { owner, pm, ic, project, task }
}

describe('updateTaskMetadata action', () => {
  beforeEach(async () => {
    await truncateAll()
    __setCurrentUser(null)
  })

  it('PM can update task metadata', async () => {
    const { pm, task } = await seed()
    __setCurrentUser(pm)
    await updateTaskMetadata({ taskId: task.id, name: 'Updated Name' })
    const [updated] = await testDb.select().from(tasks).where(eq(tasks.id, task.id))
    expect(updated.name).toBe('Updated Name')
  })

  it('IC (non-owner, non-PM) cannot update metadata', async () => {
    const { ic, task } = await seed()
    __setCurrentUser(ic)
    await expect(updateTaskMetadata({ taskId: task.id, name: 'x' })).rejects.toThrow()
  })

  it('rejects targetEndDate < targetStartDate', async () => {
    const { pm, task } = await seed()
    __setCurrentUser(pm)
    await expect(updateTaskMetadata({
      taskId: task.id, targetStartDate: '2026-06-10', targetEndDate: '2026-06-05',
    })).rejects.toThrow()
  })

  it('rejects empty name', async () => {
    const { pm, task } = await seed()
    __setCurrentUser(pm)
    await expect(updateTaskMetadata({ taskId: task.id, name: '' })).rejects.toThrow()
  })
})
