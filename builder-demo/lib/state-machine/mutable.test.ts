import { describe, it, expect } from 'vitest'
import { assertProjectStructureMutable, assertProjectMetaMutable } from './mutable'
import { ProjectLockedError } from '@/lib/server/errors'

describe('mutable guards', () => {
  it('structure: only draft mutable', () => {
    expect(() => assertProjectStructureMutable('draft')).not.toThrow()
    for (const s of ['in_progress','complete','archived'] as const) {
      expect(() => assertProjectStructureMutable(s)).toThrow(ProjectLockedError)
    }
  })

  it('meta: draft and in_progress mutable; complete and archived not', () => {
    for (const s of ['draft','in_progress'] as const) {
      expect(() => assertProjectMetaMutable(s)).not.toThrow()
    }
    for (const s of ['complete','archived'] as const) {
      expect(() => assertProjectMetaMutable(s)).toThrow(ProjectLockedError)
    }
  })
})
