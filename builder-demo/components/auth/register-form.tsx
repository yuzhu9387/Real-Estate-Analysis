'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { registerWithPassword } from '@/app/actions/auth'

export function RegisterForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [banner, setBanner] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setBanner(null)
    setFieldErrors({})

    if (password.length < 8) {
      setFieldErrors({ password: 'Password must be at least 8 characters' })
      return
    }
    if (password !== confirm) {
      setFieldErrors({ confirm: 'Passwords do not match' })
      return
    }

    setBusy(true)
    try {
      const res = await registerWithPassword({ email, name, password })
      if (res.ok) {
        router.push('/')
        router.refresh()
      } else {
        if (res.field) {
          setFieldErrors({ [res.field]: res.message })
        } else {
          setBanner(res.message)
        }
      }
    } catch (e) {
      setBanner(e instanceof Error ? e.message : 'Sign-up failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      {banner && (
        <div className="rounded border border-red-200 bg-red-50 text-red-700 text-sm px-3 py-2">{banner}</div>
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
        {fieldErrors.email && <span className="text-xs text-red-600">{fieldErrors.email}</span>}
      </label>
      <label className="block">
        <span className="text-xs text-zinc-600">Name</span>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          required
          autoComplete="name"
          className="mt-1 w-full border border-zinc-300 rounded px-2 py-1 text-sm"
        />
        {fieldErrors.name && <span className="text-xs text-red-600">{fieldErrors.name}</span>}
      </label>
      <label className="block">
        <span className="text-xs text-zinc-600">Password</span>
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          autoComplete="new-password"
          className="mt-1 w-full border border-zinc-300 rounded px-2 py-1 text-sm"
        />
        {fieldErrors.password && <span className="text-xs text-red-600">{fieldErrors.password}</span>}
      </label>
      <label className="block">
        <span className="text-xs text-zinc-600">Confirm Password</span>
        <input
          type="password"
          value={confirm}
          onChange={e => setConfirm(e.target.value)}
          required
          autoComplete="new-password"
          className="mt-1 w-full border border-zinc-300 rounded px-2 py-1 text-sm"
        />
        {fieldErrors.confirm && <span className="text-xs text-red-600">{fieldErrors.confirm}</span>}
      </label>
      <button
        type="submit"
        disabled={busy}
        className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded px-4 py-2 text-sm hover:opacity-90 disabled:opacity-50">
        {busy ? 'Creating account…' : 'Create Account'}
      </button>
    </form>
  )
}
