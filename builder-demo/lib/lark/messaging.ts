const TOKEN_URL = 'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal'
const MESSAGE_URL = 'https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=open_id'

let cachedToken: { token: string; expiresAt: number } | null = null

export function _resetTokenCache() { cachedToken = null }

async function getTenantAccessToken(input: { appId: string; appSecret: string; fetcher: typeof fetch }): Promise<string> {
  const now = Date.now()
  if (cachedToken && cachedToken.expiresAt > now + 30_000) return cachedToken.token
  const res = await input.fetcher(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ app_id: input.appId, app_secret: input.appSecret }),
  })
  if (!res.ok) throw new Error(`Lark tenant_access_token failed: ${res.status}`)
  const json = await res.json() as { tenant_access_token?: string; expire?: number }
  if (!json.tenant_access_token) throw new Error('Lark tenant_access_token missing in response')
  const expireSec = json.expire ?? 7200
  cachedToken = { token: json.tenant_access_token, expiresAt: now + (expireSec * 1000) }
  return cachedToken.token
}

export async function sendLarkDirectMessage(input: {
  openId: string
  text: string
  link?: string
  fetcher?: typeof fetch
  env?: { appId: string; appSecret: string }
}): Promise<void> {
  const fetcher = input.fetcher ?? fetch
  const env = input.env ?? {
    appId: process.env.LARK_MESSAGING_APP_ID ?? '',
    appSecret: process.env.LARK_MESSAGING_APP_SECRET ?? '',
  }
  if (!env.appId || !env.appSecret) throw new Error('LARK_MESSAGING_APP_ID/SECRET not set')

  const token = await getTenantAccessToken({ ...env, fetcher })
  const bodyText = input.link ? `${input.text}\n${input.link}` : input.text

  const res = await fetcher(MESSAGE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      receive_id: input.openId,
      msg_type: 'text',
      content: JSON.stringify({ text: bodyText }),
    }),
  })
  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`Lark message send failed: ${res.status} ${errText}`)
  }
}
