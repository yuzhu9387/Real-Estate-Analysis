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
