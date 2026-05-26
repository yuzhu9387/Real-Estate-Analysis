'use client'
import { useState } from 'react'
import { createProject } from '@/app/actions/projects'
import { useRouter } from 'next/navigation'

export default function NewProjectPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [brand, setBrand] = useState<'al_homes'|'alera'|'apex'>('al_homes')
  const [templateId, setTemplateId] = useState('')
  const [err, setErr] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    try {
      const res = await createProject({
        name, brand,
        assignments: [{ phaseName: 'Permitting', templateId, sortOrder: 0 }],
      })
      router.push(`/projects/${(res as { id: string }).id}`)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'failed')
    }
  }

  return (
    <form onSubmit={onSubmit} className="max-w-md space-y-4">
      <h1 className="text-2xl font-semibold">New Project</h1>
      <label className="block">
        <span className="text-sm">Name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} required className="mt-1 w-full rounded border px-2 py-1" />
      </label>
      <label className="block">
        <span className="text-sm">Brand</span>
        <select value={brand} onChange={(e) => setBrand(e.target.value as 'al_homes'|'alera'|'apex')} className="mt-1 w-full rounded border px-2 py-1">
          <option value="al_homes">Al Homes</option>
          <option value="alera">Alera</option>
          <option value="apex">Apex</option>
        </select>
      </label>
      <label className="block">
        <span className="text-sm">Permitting Template ID</span>
        <input value={templateId} onChange={(e) => setTemplateId(e.target.value)} required className="mt-1 w-full rounded border px-2 py-1" />
      </label>
      <button className="rounded bg-blue-600 px-4 py-2 text-white">Create</button>
      {err && <div className="text-sm text-red-600">{err}</div>}
    </form>
  )
}
