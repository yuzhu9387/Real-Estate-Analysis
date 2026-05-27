import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { randomBytes } from 'node:crypto'
import { buildLarkAuthorizeUrl } from '@/lib/auth/lark'

export async function GET() {
  const state = randomBytes(16).toString('hex')
  cookies().set('bf_oauth_state', state, {
    httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production',
    maxAge: 5 * 60, path: '/',
  })
  const url = buildLarkAuthorizeUrl({
    clientId: process.env.LARK_CLIENT_ID!,
    redirectUri: process.env.LARK_REDIRECT_URI!,
    state,
  })
  return NextResponse.redirect(url)
}
