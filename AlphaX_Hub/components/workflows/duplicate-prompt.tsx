'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { duplicateWorkflowTemplate } from '@/app/actions/workflows'

export function DuplicatePrompt({ sourceId, sourceName }: { sourceId: string; sourceName: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(`Copy of ${sourceName}`)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="px-3 py-1.5 border border-zinc-300 rounded text-sm hover:bg-zinc-50">
        Duplicate
      </button>
    )
  }

  async function submit() {
    if (!name.trim()) { setErr('Name required'); return }
    setBusy(true); setErr(null)
    try {
      const res = await duplicateWorkflowTemplate({ sourceId, newName: name }) as { ok: true; id: string }
      router.push(`/workflows/${res.id}/edit`)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed')
    } finally { setBusy(false) }
  }

  return (
    <div className="flex items-center gap-1">
      <input value={name} onChange={(e) => setName(e.target.value)}
        autoFocus className="border border-zinc-300 rounded px-2 py-1 text-sm" />
      <button onClick={submit} disabled={busy}
        className="px-3 py-1.5 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded text-sm hover:opacity-90 disabled:opacity-50">
        Duplicate
      </button>
      <button onClick={() => setOpen(false)}
        className="px-2 py-1 text-sm text-zinc-600 hover:text-zinc-900">cancel</button>
      {err && <span className="text-red-600 text-xs ml-2">{err}</span>}
    </div>
  )
}
