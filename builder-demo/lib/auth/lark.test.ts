import { describe, it, expect } from 'vitest'
import { buildLarkAuthorizeUrl, exchangeLarkCode, fetchLarkUserInfo } from './lark'

describe('buildLarkAuthorizeUrl', () => {
  it('constructs the authorize URL with required params', () => {
    const url = buildLarkAuthorizeUrl({
      clientId: 'cli_xxx',
      redirectUri: 'https://app.example.com/api/auth/lark/callback',
      state: 'abc123',
    })
    expect(url).toContain('https://accounts.feishu.cn/open-apis/authen/v1/authorize')
    expect(url).toContain('client_id=cli_xxx')
    expect(url).toContain('redirect_uri=https%3A%2F%2Fapp.example.com%2Fapi%2Fauth%2Flark%2Fcallback')
    expect(url).toContain('state=abc123')
  })
})

describe('exchangeLarkCode', () => {
  it('posts the right body and returns parsed token', async () => {
    const fetcher = async (url: string | URL, init?: RequestInit) => {
      expect(String(url)).toContain('/oauth/token')
      expect(init?.method).toBe('POST')
      const body = JSON.parse(String(init?.body))
      expect(body).toMatchObject({ grant_type: 'authorization_code', code: 'CODE_X' })
      return new Response(JSON.stringify({ access_token: 'tok', expires_in: 7200, token_type: 'Bearer' }), { status: 200 })
    }
    const out = await exchangeLarkCode({
      clientId: 'cli', clientSecret: 'sec', code: 'CODE_X',
      redirectUri: 'https://x/cb', fetcher: fetcher as any,
    })
    expect(out.access_token).toBe('tok')
  })
})

describe('fetchLarkUserInfo', () => {
  it('unwraps data envelope', async () => {
    const fetcher = async () =>
      new Response(JSON.stringify({ data: { open_id: 'ou_x', tenant_key: 't1', name: 'Yu', email: 'y@x.com' } }), { status: 200 })
    const out = await fetchLarkUserInfo({ accessToken: 'tok', fetcher: fetcher as any })
    expect(out.open_id).toBe('ou_x')
    expect(out.tenant_key).toBe('t1')
  })
})
