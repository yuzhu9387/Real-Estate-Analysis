import { LoginForm } from '@/components/auth/login-form'
import Link from 'next/link'

type SearchParams = { error?: string }

const ERRORS: Record<string, string> = {
  invalid_state: 'Login attempt expired or invalid. Please try again.',
  tenant_mismatch: 'Your Lark workspace is not authorized to use this app.',
  account_disabled: 'Your account has been disabled. Contact an administrator.',
}

export default function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const err = searchParams.error ? ERRORS[searchParams.error] ?? 'Login failed.' : null
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50">
      <div className="w-96 rounded-2xl bg-white p-8 shadow space-y-4">
        <h1 className="text-2xl font-semibold">AlphaX Hub</h1>
        {err && <div className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>}

        <a
          href="/api/auth/lark/start"
          className="block w-full rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 px-4 py-3 text-center font-medium text-white hover:opacity-90"
        >
          Sign in with Lark
        </a>

        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <span className="flex-1 border-t border-zinc-200" />
          <span>or</span>
          <span className="flex-1 border-t border-zinc-200" />
        </div>

        <LoginForm />

        <p className="text-center text-xs text-zinc-600">
          Don&rsquo;t have an account?{' '}
          <Link href="/register" className="text-blue-600 hover:underline">Register</Link>
        </p>
      </div>
    </main>
  )
}
