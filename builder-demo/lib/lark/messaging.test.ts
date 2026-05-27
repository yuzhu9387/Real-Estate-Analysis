import { describe, it, expect, beforeEach } from 'vitest'
import { _resetTokenCache, sendLarkDirectMessage } from './messaging'

describe('sendLarkDirectMessage', () => {
  beforeEach(() => _resetTokenCache())

  it('fetches a tenant access token then sends the message', async () => {
    const calls: Array<{ url: string; body?: unknown }> = []
    const fetcher = async (url: string | URL, init?: RequestInit): Promise<Response> => {
      calls.push({ url: String(url), body: init?.body ? JSON.parse(String(init.body)) : undefined })
      if (String(url).includes('tenant_access_token')) {
        return new Response(JSON.stringify({ tenant_access_token: 'tok-A', expire: 7200 }), { status: 200 })
      }
      return new Response(JSON.stringify({ code: 0, msg: 'ok' }), { status: 200 })
    }
    await sendLarkDirectMessage({
      openId: 'ou_x', text: 'hi', link: 'https://app/x',
      fetcher: fetcher as typeof fetch,
      env: { appId: 'cli', appSecret: 'sec' },
    })
    expect(calls).toHaveLength(2)
    expect(calls[0].url).toContain('tenant_access_token')
    expect(calls[1].url).toContain('/im/v1/messages')
  })

  it('reuses cached token on second call', async () => {
    let tokenCalls = 0
    const fetcher = async (url: string | URL): Promise<Response> => {
      if (String(url).includes('tenant_access_token')) {
        tokenCalls++
        return new Response(JSON.stringify({ tenant_access_token: 'tok-A', expire: 7200 }), { status: 200 })
      }
      return new Response(JSON.stringify({ code: 0 }), { status: 200 })
    }
    await sendLarkDirectMessage({ openId: 'ou_x', text: 'hi', fetcher: fetcher as typeof fetch, env: { appId: 'cli', appSecret: 'sec' } })
    await sendLarkDirectMessage({ openId: 'ou_x', text: 'hi2', fetcher: fetcher as typeof fetch, env: { appId: 'cli', appSecret: 'sec' } })
    expect(tokenCalls).toBe(1)
  })

  it('throws when the message endpoint returns non-OK', async () => {
    const fetcher = async (url: string | URL): Promise<Response> => {
      if (String(url).includes('tenant_access_token')) {
        return new Response(JSON.stringify({ tenant_access_token: 'tok-A', expire: 7200 }), { status: 200 })
      }
      return new Response('{"code":99991663,"msg":"bad receive_id"}', { status: 400 })
    }
    await expect(sendLarkDirectMessage({
      openId: 'ou_bad', text: 'hi', fetcher: fetcher as typeof fetch, env: { appId: 'cli', appSecret: 'sec' },
    })).rejects.toThrow(/Lark message/)
  })
})
