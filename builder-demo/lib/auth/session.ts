import { createHmac, timingSafeEqual } from 'node:crypto'
import { cookies } from 'next/headers'
import { SESSION_COOKIE_NAME, SESSION_DURATION_MS } from './session-constants'
export { SESSION_COOKIE_NAME, SESSION_DURATION_MS } from './session-constants'

type SessionPayload = { userId: string; expiresAt: number }

function base64url(buf: Buffer): string {
  return buf.toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
}
function fromBase64url(s: string): Buffer {
  s = s.replace(/-/g, '+').replace(/_/g, '/')
  while (s.length % 4) s += '='
  return Buffer.from(s, 'base64')
}

export async function signSessionToken(payload: SessionPayload, secret: string): Promise<string> {
  const body = base64url(Buffer.from(JSON.stringify(payload)))
  const mac = createHmac('sha256', secret).update(body).digest()
  return `${body}.${base64url(mac)}`
}

export async function verifySessionToken(token: string, secret: string): Promise<SessionPayload> {
  const [body, sig] = token.split('.')
  if (!body || !sig) throw new Error('invalid token format')
  const expected = createHmac('sha256', secret).update(body).digest()
  const provided = fromBase64url(sig)
  if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) {
    throw new Error('signature mismatch')
  }
  const payload = JSON.parse(fromBase64url(body).toString('utf-8')) as SessionPayload
  if (!payload.userId || !payload.expiresAt) throw new Error('invalid payload')
  if (payload.expiresAt < Date.now()) throw new Error('token expired')
  return payload
}

export async function issueSession(userId: string): Promise<void> {
  const secret = process.env.AUTH_SECRET
  if (!secret) throw new Error('AUTH_SECRET not set')
  const expiresAt = Date.now() + SESSION_DURATION_MS
  const token = await signSessionToken({ userId, expiresAt }, secret)
  cookies().set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    expires: new Date(expiresAt),
    path: '/',
  })
}

