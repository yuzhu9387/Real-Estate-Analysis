import { describe, it, expect } from 'vitest'
import { pickDefaultAvatar } from './default-avatar'

describe('pickDefaultAvatar', () => {
  it('returns a number 1..6', () => {
    for (const id of ['user-1', 'user-2', 'user-3', 'abc']) {
      const n = pickDefaultAvatar(id)
      expect(n).toBeGreaterThanOrEqual(1)
      expect(n).toBeLessThanOrEqual(6)
    }
  })

  it('is deterministic — same id → same avatar', () => {
    const a = pickDefaultAvatar('11111111-2222-3333-4444-555555555555')
    const b = pickDefaultAvatar('11111111-2222-3333-4444-555555555555')
    expect(a).toBe(b)
  })

  it('distributes across the 6 buckets reasonably', () => {
    const counts = [0, 0, 0, 0, 0, 0, 0]
    for (let i = 0; i < 600; i++) counts[pickDefaultAvatar(`user-${i}`)]++
    for (let i = 1; i <= 6; i++) expect(counts[i]).toBeGreaterThan(40)
  })

  it('handles empty string without throwing', () => {
    expect(() => pickDefaultAvatar('')).not.toThrow()
  })
})
