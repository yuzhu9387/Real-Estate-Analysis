'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { duplicateWorkflowTemplate } from '@/app/actions/workflows'

export function DuplicatePrompt({
  sourceId,
  sourceName,
}: {
  sourceId: string
  sourceName: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(`Copy of ${sourceName}`)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-9 items-center gap-xs rounded-lg border border-outline-variant/40 bg-white px-sm text-body-sm font-semibold text-on-surface-variant hover:border-primary hover:text-primary transition-colors"
      >
        <span className="material-symbols-outlined text-[16px]">content_copy</span>
        Duplicate
      </button>
    )
  }

  async function submit() {
    if (!name.trim()) {
      setErr('Name is required')
      return
    }
    setBusy(true)
    setErr(null)
    try {
      const res = (await duplicateWorkflowTemplate({ sourceId, newName: name })) as {
        ok: true
        id: string
      }
      router.push(`/workflows/${res.id}/edit`)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex items-center gap-xs">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        autoFocus
        className="h-9 rounded-lg border border-outline-variant/40 bg-white px-sm text-body-sm focus:outline-none focus:border-primary transition-colors"
      />
      <button
        type="button"
        onClick={submit}
        disabled={busy}
        className="inline-flex h-9 items-center gap-xs rounded-lg bg-primary px-sm text-body-sm font-bold text-white shadow-sm shadow-primary/10 hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {busy ? 'Duplicating…' : 'Duplicate'}
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="px-xs text-body-sm text-on-surface-variant hover:text-on-surface"
      >
        cancel
      </button>
      {err && <span className="ml-xs text-body-sm text-error">{err}</span>}
    </div>
  )
}
