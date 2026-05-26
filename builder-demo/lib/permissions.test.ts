import { describe, it, expect } from 'vitest'
import { can } from './permissions'
import type { User } from '@/db/schema'

function u(role: 'owner'|'pm'|'ic', id = 'u1', overrides: Partial<User> = {}): User {
  return {
    id, larkOpenId: `lark_${id}`, larkTenantKey: 't1', email: null, name: id,
    avatarUrl: null, role, team: null, isActive: true,
    createdAt: new Date(), lastLoginAt: null, ...overrides,
  } as User
}
const owner = u('owner', 'o1')
const pmAlice = u('pm', 'pm-alice')
const pmBob   = u('pm', 'pm-bob')
const icCarol = u('ic', 'ic-carol')
const icDave  = u('ic', 'ic-dave')

const draftProject = { pmId: pmAlice.id, status: 'draft' as const }
const liveProject  = { pmId: pmAlice.id, status: 'in_progress' as const }
const archived     = { pmId: pmAlice.id, status: 'archived' as const }
const taskOwnedByCarol = { ownerId: icCarol.id, reviewerId: icDave.id }

describe('can()', () => {
  describe('workflow.*', () => {
    it('only owner can CRUD workflows', () => {
      const wf = { createdById: owner.id }
      for (const a of [
        { type: 'workflow.create' as const },
        { type: 'workflow.update' as const, workflow: wf },
        { type: 'workflow.delete' as const, workflow: wf },
      ]) {
        expect(can(owner, a)).toBe(true)
        expect(can(pmAlice, a)).toBe(false)
        expect(can(icCarol, a)).toBe(false)
      }
    })
  })

  describe('project.create', () => {
    it('owner and pm can; ic cannot', () => {
      const a = { type: 'project.create' as const }
      expect(can(owner, a)).toBe(true)
      expect(can(pmAlice, a)).toBe(true)
      expect(can(icCarol, a)).toBe(false)
    })
  })

  describe('project.update_structure', () => {
    it('only in draft and only by managing pm or owner', () => {
      const a = { type: 'project.update_structure' as const, project: draftProject }
      expect(can(owner, a)).toBe(true)
      expect(can(pmAlice, a)).toBe(true)
      expect(can(pmBob, a)).toBe(false)
      expect(can(icCarol, a)).toBe(false)

      const live = { ...a, project: liveProject }
      expect(can(pmAlice, live)).toBe(false)
      expect(can(owner, live)).toBe(false)
    })
  })

  describe('project.kick_off_phase + mark_phase_complete + mark_complete', () => {
    it('managing pm and owner can in in_progress', () => {
      for (const t of ['project.kick_off_phase','project.mark_phase_complete','project.mark_complete'] as const) {
        const a = { type: t, project: liveProject }
        expect(can(owner, a)).toBe(true)
        expect(can(pmAlice, a)).toBe(true)
        expect(can(pmBob, a)).toBe(false)
        expect(can(icCarol, a)).toBe(false)
      }
    })
  })

  describe('project.transfer_pm', () => {
    it('managing pm or owner', () => {
      const a = { type: 'project.transfer_pm' as const, project: liveProject }
      expect(can(pmAlice, a)).toBe(true)
      expect(can(pmBob, a)).toBe(false)
      expect(can(owner, a)).toBe(true)
    })
  })

  describe('project.force_reassign_pm and unlock_to_draft', () => {
    it('owner only', () => {
      for (const t of ['project.force_reassign_pm','project.unlock_to_draft'] as const) {
        const a = { type: t }
        expect(can(owner, a)).toBe(true)
        expect(can(pmAlice, a)).toBe(false)
        expect(can(icCarol, a)).toBe(false)
      }
    })
  })

  describe('task.set_status', () => {
    it('owner of task, managing pm, system owner', () => {
      const a = { type: 'task.set_status' as const, project: liveProject, task: taskOwnedByCarol }
      expect(can(owner, a)).toBe(true)
      expect(can(pmAlice, a)).toBe(true)
      expect(can(pmBob, a)).toBe(false)
      expect(can(icCarol, a)).toBe(true)
      expect(can(icDave, a)).toBe(false)
    })
  })

  describe('task.review_decision', () => {
    it('reviewer, managing pm, system owner', () => {
      const a = { type: 'task.review_decision' as const, project: liveProject, task: taskOwnedByCarol }
      expect(can(owner, a)).toBe(true)
      expect(can(pmAlice, a)).toBe(true)
      expect(can(icCarol, a)).toBe(false)
      expect(can(icDave, a)).toBe(true)
    })
  })

  describe('task.submit_review', () => {
    it('owner of task, managing pm, system owner', () => {
      const a = { type: 'task.submit_review' as const, project: liveProject, task: taskOwnedByCarol }
      expect(can(owner, a)).toBe(true)
      expect(can(icCarol, a)).toBe(true)
      expect(can(icDave, a)).toBe(false)
    })
  })

  describe('task.add_unplanned', () => {
    it('only managing pm and owner', () => {
      const a = { type: 'task.add_unplanned' as const, project: liveProject }
      expect(can(owner, a)).toBe(true)
      expect(can(pmAlice, a)).toBe(true)
      expect(can(pmBob, a)).toBe(false)
      expect(can(icCarol, a)).toBe(false)
    })
  })

  describe('task.add_subtask + reassign + add_comment', () => {
    it('task owner, managing pm, system owner', () => {
      for (const t of ['task.add_subtask','task.add_comment'] as const) {
        const a = { type: t, project: liveProject, task: taskOwnedByCarol }
        expect(can(icCarol, a)).toBe(true)
        expect(can(icDave, a)).toBe(t === 'task.add_comment')   // reviewer can comment, not add subtask
        expect(can(pmAlice, a)).toBe(true)
        expect(can(owner, a)).toBe(true)
        expect(can(pmBob, a)).toBe(false)
      }
      const reassign = { type: 'task.reassign' as const, project: liveProject, task: taskOwnedByCarol }
      expect(can(icCarol, reassign)).toBe(true)
      expect(can(icDave, reassign)).toBe(false)
      expect(can(pmAlice, reassign)).toBe(true)
      expect(can(owner, reassign)).toBe(true)
    })
  })

  describe('user.update_role + user.disable + audit.view', () => {
    it('owner only', () => {
      for (const t of ['user.update_role','user.disable','audit.view'] as const) {
        const a = { type: t }
        expect(can(owner, a)).toBe(true)
        expect(can(pmAlice, a)).toBe(false)
        expect(can(icCarol, a)).toBe(false)
      }
    })
  })

  describe('archived project blocks all writes', () => {
    it('even owner cannot edit archived structurally', () => {
      const a = { type: 'task.set_status' as const, project: archived, task: taskOwnedByCarol }
      expect(can(owner, a)).toBe(false)
      expect(can(icCarol, a)).toBe(false)
    })
  })
})
