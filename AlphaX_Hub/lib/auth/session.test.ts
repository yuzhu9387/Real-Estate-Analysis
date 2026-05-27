import { describe, it, expect } from 'vitest'
import { signSessionToken, verifySessionToken } from './session'

const secret = 'a'.repeat(64)

describe('session tokens', () => {
  it('round-trips a user id', async () => {
    const token = await signSessionToken({ userId: 'user-123', expiresAt: Date.now() + 60_000 }, secret)
    const out = await verifySessionToken(token, secret)
    expect(out.userId).toBe('user-123')
  })

  it('rejects tampered token', async () => {
    const token = await signSessionToken({ userId: 'user-1', expiresAt: Date.now() + 60_000 }, secret)
    const tampered = token.slice(0, -1) + (token.slice(-1) === 'a' ? 'b' : 'a')
    await expect(verifySessionToken(tampered, secret)).rejects.toThrow()
  })

  it('rejects expired token', async () => {
    const token = await signSessionToken({ userId: 'user-1', expiresAt: Date.now() - 1 }, secret)
    await expect(verifySessionToken(token, secret)).rejects.toThrow(/expired/i)
  })
})
