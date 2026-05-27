import { describe, it, expect } from 'vitest'
import { POST } from './route'

function mockReq(headers: Record<string, string>): Request {
  return new Request('http://localhost/api/cron/lark-digest', { method: 'POST', headers })
}

describe('POST /api/cron/lark-digest', () => {
  it('returns 401 without the bearer token', async () => {
    process.env.LARK_DIGEST_CRON_SECRET = 'shh'
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await POST(mockReq({}) as any)
    expect(res.status).toBe(401)
  })

  it('returns 401 with wrong bearer token', async () => {
    process.env.LARK_DIGEST_CRON_SECRET = 'shh'
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await POST(mockReq({ authorization: 'Bearer wrong' }) as any)
    expect(res.status).toBe(401)
  })

  it('returns 500 when secret not configured', async () => {
    delete process.env.LARK_DIGEST_CRON_SECRET
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await POST(mockReq({ authorization: 'Bearer x' }) as any)
    expect(res.status).toBe(500)
  })
})
