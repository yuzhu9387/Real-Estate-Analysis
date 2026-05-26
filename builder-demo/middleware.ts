import { NextRequest, NextResponse } from 'next/server'
import { SESSION_COOKIE_NAME } from '@/lib/auth/session'

const PUBLIC_PATHS = ['/login', '/api/auth', '/api/health', '/_next', '/favicon']

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) return NextResponse.next()
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value
  if (!token) {
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
