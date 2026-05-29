import { describe, it, expect, beforeEach } from 'vitest'
import { draftKey, saveDraft, loadDraft, clearDraft, type Draft } from './draft-storage'

class MemStorage {
  private m = new Map<string, string>()
  getItem(k: string) { return this.m.get(k) ?? null }
  setItem(k: string, v: string) { this.m.set(k, v) }
  removeItem(k: string) { this.m.delete(k) }
}
const storage = new MemStorage()

const SAMPLE: Draft = {
  name: 'P',
  description: '',
  productType: 'adu_pre_approved_program',
  tasks: [{ id: 't1', name: 'A', description: '', startDay: 1, endDay: 2, ownerRoleLabel: 'design', sortOrder: 0 }],
  deps: [],
  savedAt: '2026-05-27T10:00:00.000Z',
}

describe('draft storage', () => {
  beforeEach(() => { storage.removeItem(draftKey('x')); storage.removeItem(draftKey('__new__')) })

  it('saves and loads a draft', () => {
    saveDraft('x', SAMPLE, storage as unknown as Storage)
    const loaded = loadDraft('x', storage as unknown as Storage)
    expect(loaded?.name).toBe('P')
    expect(loaded?.tasks).toHaveLength(1)
  })

  it('returns null when nothing stored', () => {
    expect(loadDraft('x', storage as unknown as Storage)).toBe(null)
  })

  it('returns null and silently discards corrupt JSON', () => {
    storage.setItem(draftKey('x'), '{not valid')
    expect(loadDraft('x', storage as unknown as Storage)).toBe(null)
  })

  it('clearDraft removes the key', () => {
    saveDraft('x', SAMPLE, storage as unknown as Storage)
    clearDraft('x', storage as unknown as Storage)
    expect(loadDraft('x', storage as unknown as Storage)).toBe(null)
  })

  it('namespaces new-mode and edit-mode drafts separately', () => {
    saveDraft('__new__', SAMPLE, storage as unknown as Storage)
    saveDraft('id-1', { ...SAMPLE, name: 'X' }, storage as unknown as Storage)
    expect(loadDraft('__new__', storage as unknown as Storage)?.name).toBe('P')
    expect(loadDraft('id-1', storage as unknown as Storage)?.name).toBe('X')
  })

  it('discards pre-change drafts that have durationDays instead of startDay/endDay', () => {
    const memStorage = new MemStorage()
    memStorage.setItem('workflow-draft-foo', JSON.stringify({
      name: 'old', description: '', tasks: [
        { id: 't1', name: 'A', description: '', durationDays: 1, ownerRoleLabel: '', sortOrder: 0 },
      ], deps: [], savedAt: new Date().toISOString(),
    }))
    expect(loadDraft('foo', memStorage as unknown as Storage)).toBeNull()
  })
})
