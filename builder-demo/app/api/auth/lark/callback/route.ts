import { NextResponse, type NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { eq } from 'drizzle-orm'
import { db } from '@/db/client'
import { users } from '@/db/schema'
import { exchangeLarkCode, fetchLarkUserInfo } from '@/lib/auth/lark'
import { signSessionToken, SESSION_COOKIE_NAME, SESSION_DURATION_MS } from '@/lib/auth/session'
import { applyBootstrapOwner } from '@/lib/auth/bootstrap'

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const stateCookie = cookies().get('bf_oauth_state')?.value

  if (!code || !state || !stateCookie || state !== stateCookie) {
    return NextResponse.redirect(new URL('/login?error=invalid_state', req.url))
  }
  cookies().delete('bf_oauth_state')

  const token = await exchangeLarkCode({
    clientId: process.env.LARK_CLIENT_ID!,
    clientSecret: process.env.LARK_CLIENT_SECRET!,
    code,
    redirectUri: process.env.LARK_REDIRECT_URI!,
  })
  const info = await fetchLarkUserInfo({ accessToken: token.access_token })

  if (info.tenant_key !== process.env.LARK_ALLOWED_TENANT_KEY) {
    return NextResponse.redirect(new URL('/login?error=tenant_mismatch', req.url))
  }

  const existing = await db.select().from(users).where(eq(users.larkOpenId, info.open_id)).limit(1)
  let userId: string
  if (existing.length === 0) {
    const [created] = await db.insert(users).values({
      larkOpenId: info.open_id,
      larkTenantKey: info.tenant_key,
      email: info.email,
      name: info.name,
      avatarUrl: info.avatar_url,
      role: 'ic',
    }).returning()
    userId = created.id
  } else {
    if (!existing[0].isActive) {
      return NextResponse.redirect(new URL('/login?error=account_disabled', req.url))
    }
    await db.update(users).set({
      name: info.name,
      avatarUrl: info.avatar_url,
      lastLoginAt: new Date(),
    }).where(eq(users.id, existing[0].id))
    userId = existing[0].id
  }

  if (process.env.BOOTSTRAP_OWNER_LARK_OPEN_ID) {
    await applyBootstrapOwner(db, { openId: process.env.BOOTSTRAP_OWNER_LARK_OPEN_ID })
  }

  const expiresAt = Date.now() + SESSION_DURATION_MS
  const session = await signSessionToken({ userId, expiresAt }, process.env.AUTH_SECRET!)
  cookies().set(SESSION_COOKIE_NAME, session, {
    httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production',
    expires: new Date(expiresAt), path: '/',
  })

  return NextResponse.redirect(new URL('/', req.url))
}
