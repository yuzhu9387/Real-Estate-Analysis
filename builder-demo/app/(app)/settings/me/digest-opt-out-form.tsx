'use client'
import { useState } from 'react'
import { setLarkDigestOptOut } from '@/app/actions/users'

export function DigestOptOutForm({ initialOptedOut }: { initialOptedOut: boolean }) {
  const [optedOut, setOptedOut] = useState(initialOptedOut)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function toggle() {
    setBusy(true); setErr(null)
    const next = !optedOut
    try {
      await setLarkDigestOptOut({ optedOut: next })
      setOptedOut(next)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to update')
    } finally { setBusy(false) }
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-medium">Daily Lark digest</div>
          <div className="text-xs text-zinc-600">A summary of your overdue / due-soon / pending-review tasks at 8 AM.</div>
        </div>
        <button onClick={toggle} disabled={busy}
          className={[
            'px-3 py-1.5 rounded text-sm border',
            optedOut ? 'bg-white text-zinc-700 border-zinc-300' : 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white border-transparent',
          ].join(' ')}>
          {optedOut ? 'Off (turn on)' : 'On (turn off)'}
        </button>
      </div>
      {err && <div className="text-red-600 text-xs">{err}</div>}
    </div>
  )
}
