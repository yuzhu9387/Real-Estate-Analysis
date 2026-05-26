import { NextResponse, type NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { SESSION_COOKIE_NAME } from '@/lib/auth/session'

export async function POST(req: NextRequest) {
  cookies().delete(SESSION_COOKIE_NAME)
  return NextResponse.redirect(new URL('/login', req.url))
}
