'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { duplicateWorkflowTemplate } from '@/app/actions/workflows'

export function DuplicatePicker({
  templates,
}: {
  templates: Array<{ id: string; name: string }>
}) {
  const router = useRouter()
  const [sourceId, setSourceId] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function submit() {
    if (!sourceId) {
      setErr('Pick a source template')
      return
    }
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

  function onSourceChange(id: string) {
    setSourceId(id)
    if (!name) {
      const tpl = templates.find((t) => t.id === id)
      if (tpl) setName(`Copy of ${tpl.name}`)
    }
  }

  return (
    <div className="rounded-xl border border-outline-variant/30 bg-white p-lg shadow-sm space-y-md">
      <div className="flex items-start gap-md">
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-secondary/10 text-secondary">
          <span className="material-symbols-outlined">content_copy</span>
        </div>
        <div className="flex-1">
          <h2 className="font-headline-md text-headline-md text-on-surface">
            Duplicate from existing
          </h2>
          <p className="mt-xs text-body-sm text-on-surface-variant">
            Copy an existing template and customize the new version.
          </p>
        </div>
      </div>

      <div className="space-y-md">
        <Field label="Source template">
          <select
            value={sourceId}
            onChange={(e) => onSourceChange(e.target.value)}
            className="glacier-select h-10 w-full rounded-lg border border-outline-variant/40 bg-white px-sm text-body-sm focus:outline-none focus:border-primary transition-colors"
          >
            <option value="">— pick one —</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="New name">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Copy of Standard Permit"
            className="h-10 w-full rounded-lg border border-outline-variant/40 bg-white px-sm text-body-sm focus:outline-none focus:border-primary transition-colors"
          />
        </Field>
      </div>

      {err && (
        <div className="flex items-center gap-xs rounded-lg border border-error/20 bg-error/5 px-sm py-xs text-body-sm text-error">
          <span className="material-symbols-outlined text-[16px]">error</span>
          {err}
        </div>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={busy}
        className="inline-flex items-center gap-xs rounded-lg bg-primary px-md py-sm text-body-sm font-bold text-white shadow-sm shadow-primary/10 hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span className="material-symbols-outlined text-[18px]">content_copy</span>
        {busy ? 'Duplicating…' : 'Duplicate template'}
      </button>
    </div>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="block mb-xs text-label-caps font-label-caps text-outline tracking-widest">
        {label}
      </span>
      {children}
    </label>
  )
}
