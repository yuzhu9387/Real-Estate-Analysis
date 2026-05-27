'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { duplicateWorkflowTemplate } from '@/app/actions/workflows'

export function DuplicatePicker({
  templates,
}: { templates: Array<{ id: string; name: string }> }) {
  const router = useRouter()
  const [sourceId, setSourceId] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function submit() {
    if (!sourceId) { setErr('Pick a template'); return }
    if (!name.trim()) { setErr('Name required'); return }
    setBusy(true); setErr(null)
    try {
      const res = await duplicateWorkflowTemplate({ sourceId, newName: name }) as { ok: true; id: string }
      router.push(`/workflows/${res.id}/edit`)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed')
    } finally { setBusy(false) }
  }

  function onSourceChange(id: string) {
    setSourceId(id)
    if (!name) {
      const tpl = templates.find(t => t.id === id)
      if (tpl) setName(`Copy of ${tpl.name}`)
    }
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 space-y-3">
      <h2 className="font-medium">Duplicate from existing</h2>
      <label className="block text-sm">
        <span className="text-xs text-zinc-600">Source template</span>
        <select value={sourceId} onChange={(e) => onSourceChange(e.target.value)}
          className="mt-1 w-full border border-zinc-200 rounded px-2 py-1">
          <option value="">— pick one —</option>
          {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </label>
      <label className="block text-sm">
        <span className="text-xs text-zinc-600">New name</span>
        <input value={name} onChange={(e) => setName(e.target.value)}
          className="mt-1 w-full border border-zinc-200 rounded px-2 py-1" />
      </label>
      {err && <div className="text-red-600 text-xs">{err}</div>}
      <button onClick={submit} disabled={busy}
        className="px-4 py-1.5 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded text-sm hover:opacity-90 disabled:opacity-50">
        Duplicate
      </button>
    </div>
  )
}
