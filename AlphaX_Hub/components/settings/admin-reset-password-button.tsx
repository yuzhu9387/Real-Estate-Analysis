'use client'
import { useState } from 'react'
import { adminResetPassword } from '@/app/actions/auth'

export function AdminResetPasswordButton({ userId, userName }: { userId: string; userName: string }) {
  const [open, setOpen] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    setBusy(true)
    try {
      await adminResetPassword({ userId, newPassword })
      setDone(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Reset failed')
    } finally {
      setBusy(false)
    }
  }

  function close() {
    setOpen(false)
    setNewPassword('')
    setError(null)
    setDone(false)
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="text-xs text-blue-600 hover:underline">
        Reset Password
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="w-96 rounded-lg bg-white p-6 shadow">
            {done ? (
              <>
                <h2 className="mb-2 text-lg font-semibold">Password reset</h2>
                <p className="text-sm text-zinc-700">
                  Share the new password with {userName} yourself (no email is sent).
                </p>
                <div className="mt-4 flex justify-end">
                  <button onClick={close} className="rounded bg-zinc-900 text-white px-4 py-2 text-sm">Done</button>
                </div>
              </>
            ) : (
              <form onSubmit={onSubmit}>
                <h2 className="mb-2 text-lg font-semibold">Reset password for {userName}</h2>
                {error && <div className="mb-2 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
                <label className="block">
                  <span className="text-xs text-zinc-600">New password (≥ 8 chars)</span>
                  <input
                    type="text"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    autoFocus
                    className="mt-1 w-full border border-zinc-300 rounded px-2 py-1 text-sm"
                  />
                </label>
                <div className="mt-4 flex justify-end gap-2">
                  <button type="button" onClick={close} className="rounded border border-zinc-300 px-4 py-2 text-sm">Cancel</button>
                  <button type="submit" disabled={busy} className="rounded bg-zinc-900 text-white px-4 py-2 text-sm disabled:opacity-50">
                    {busy ? 'Resetting…' : 'Reset'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  )
}
