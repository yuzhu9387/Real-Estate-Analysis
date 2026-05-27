'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { loginWithPassword } from '@/app/actions/auth'

export function LoginForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const res = await loginWithPassword({ email, password })
      if (res.ok) {
        router.push('/')
        router.refresh()
      } else {
        setError(res.message)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign-in failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      {error && (
        <div className="rounded border border-red-200 bg-red-50 text-red-700 text-sm px-3 py-2">{error}</div>
      )}
      <label className="block">
        <span className="text-xs text-zinc-600">Email</span>
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          autoComplete="email"
          className="mt-1 w-full border border-zinc-300 rounded px-2 py-1 text-sm"
        />
      </label>
      <label className="block">
        <span className="text-xs text-zinc-600">Password</span>
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          autoComplete="current-password"
          className="mt-1 w-full border border-zinc-300 rounded px-2 py-1 text-sm"
        />
      </label>
      <button
        type="submit"
        disabled={busy}
        className="w-full bg-zinc-900 text-white rounded px-4 py-2 text-sm hover:bg-zinc-800 disabled:opacity-50">
        {busy ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  )
}
