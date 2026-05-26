const LARK_AUTHORIZE_URL = 'https://accounts.feishu.cn/open-apis/authen/v1/authorize'
const LARK_TOKEN_URL = 'https://open.feishu.cn/open-apis/authen/v2/oauth/token'
const LARK_USERINFO_URL = 'https://open.feishu.cn/open-apis/authen/v1/user_info'

export function buildLarkAuthorizeUrl(input: {
  clientId: string
  redirectUri: string
  state: string
}): string {
  const params = new URLSearchParams({
    client_id: input.clientId,
    redirect_uri: input.redirectUri,
    state: input.state,
    response_type: 'code',
  })
  return `${LARK_AUTHORIZE_URL}?${params.toString()}`
}

export type LarkTokenResponse = {
  access_token: string
  expires_in: number
  refresh_token?: string
  token_type: 'Bearer'
}

export async function exchangeLarkCode(input: {
  clientId: string
  clientSecret: string
  code: string
  redirectUri: string
  fetcher?: typeof fetch
}): Promise<LarkTokenResponse> {
  const fetcher = input.fetcher ?? fetch
  const res = await fetcher(LARK_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      client_id: input.clientId,
      client_secret: input.clientSecret,
      code: input.code,
      redirect_uri: input.redirectUri,
    }),
  })
  if (!res.ok) throw new Error(`Lark token exchange failed: ${res.status}`)
  return (await res.json()) as LarkTokenResponse
}

export type LarkUserInfo = {
  open_id: string
  tenant_key: string
  name: string
  email?: string
  avatar_url?: string
}

export async function fetchLarkUserInfo(input: {
  accessToken: string
  fetcher?: typeof fetch
}): Promise<LarkUserInfo> {
  const fetcher = input.fetcher ?? fetch
  const res = await fetcher(LARK_USERINFO_URL, {
    headers: { Authorization: `Bearer ${input.accessToken}` },
  })
  if (!res.ok) throw new Error(`Lark userinfo failed: ${res.status}`)
  const json = (await res.json()) as { data: LarkUserInfo }
  return json.data
}
