'use client'
import * as Dialog from '@radix-ui/react-dialog'
import { useState, type ReactNode } from 'react'
import { usePermissions } from '@/lib/hooks/use-permissions'
import { updateProjectMetadata, unlockProjectToDraft } from '@/app/actions/projects'
import type { Project } from '@/db/schema'

export function EditMetadataDialog({ project, onClose }: { project: Project; onClose: () => void }) {
  const [form, setForm] = useState({
    name: project.name,
    brand: project.brand,
    address: project.address ?? '',
    city: project.city ?? '',
    state: project.state ?? '',
    zip: project.zip ?? '',
    titleHolder: project.titleHolder ?? '',
    projectStrategy: project.projectStrategy ?? '',
    purchaseDate: project.purchaseDate ?? '',
    purchasePrice: project.purchasePrice ?? '',
    targetExitQuarter: project.targetExitQuarter ?? '',
    targetProjectDurationDays: project.targetProjectDurationDays ?? '',
    targetPermitDate: project.targetPermitDate ?? '',
    targetConstructionEndDate: project.targetConstructionEndDate ?? '',
  })
  const [err, setErr] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const { user } = usePermissions()

  const isDraft = project.status === 'draft'
  const draftOnlyDisabled = !isDraft

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    setSubmitting(true)
    try {
      const patch: Record<string, unknown> = {
        name: form.name, brand: form.brand,
        address: form.address || null, city: form.city || null,
        state: form.state || null, zip: form.zip || null,
      }
      if (isDraft) {
        patch.titleHolder = form.titleHolder || null
        patch.projectStrategy = form.projectStrategy || null
        patch.purchaseDate = form.purchaseDate || null
        patch.purchasePrice = form.purchasePrice || null
        patch.targetExitQuarter = form.targetExitQuarter || null
        patch.targetProjectDurationDays = form.targetProjectDurationDays === '' ? null : Number(form.targetProjectDurationDays)
        patch.targetPermitDate = form.targetPermitDate || null
        patch.targetConstructionEndDate = form.targetConstructionEndDate || null
      }
      await updateProjectMetadata({ projectId: project.id, patch })
      onClose()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Update failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog.Root open onOpenChange={(o) => { if (!o) onClose() }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/30 z-40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] max-h-[90vh] overflow-y-auto bg-white rounded-lg p-6 shadow-xl z-50">
          <Dialog.Title className="text-lg font-semibold">Edit project</Dialog.Title>
          <form onSubmit={onSubmit} className="mt-4 space-y-3">
            <Field label="Name"><input value={form.name} onChange={(e) => setForm(s => ({ ...s, name: e.target.value }))} className="w-full border rounded px-2 py-1 text-sm" required /></Field>
            <Field label="Brand">
              <select value={form.brand} onChange={(e) => setForm(s => ({ ...s, brand: e.target.value as Project['brand'] }))} className="w-full border rounded px-2 py-1 text-sm">
                <option value="al_homes">Al Homes</option>
                <option value="alera">Alera</option>
                <option value="apex">Apex</option>
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Address"><input value={form.address} onChange={(e) => setForm(s => ({ ...s, address: e.target.value }))} className="w-full border rounded px-2 py-1 text-sm" /></Field>
              <Field label="City"><input value={form.city} onChange={(e) => setForm(s => ({ ...s, city: e.target.value }))} className="w-full border rounded px-2 py-1 text-sm" /></Field>
              <Field label="State"><input value={form.state} onChange={(e) => setForm(s => ({ ...s, state: e.target.value }))} className="w-full border rounded px-2 py-1 text-sm" /></Field>
              <Field label="Zip"><input value={form.zip} onChange={(e) => setForm(s => ({ ...s, zip: e.target.value }))} className="w-full border rounded px-2 py-1 text-sm" /></Field>
            </div>

            <h3 className="text-sm font-medium pt-3">Targets {!isDraft && <span className="text-xs text-zinc-500 font-normal">(locked after kick-off)</span>}</h3>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Title holder"><input disabled={draftOnlyDisabled} value={form.titleHolder} onChange={(e) => setForm(s => ({ ...s, titleHolder: e.target.value }))} className="w-full border rounded px-2 py-1 text-sm disabled:bg-zinc-100" /></Field>
              <Field label="Strategy"><input disabled={draftOnlyDisabled} value={form.projectStrategy} onChange={(e) => setForm(s => ({ ...s, projectStrategy: e.target.value }))} className="w-full border rounded px-2 py-1 text-sm disabled:bg-zinc-100" /></Field>
              <Field label="Purchase date"><input type="date" disabled={draftOnlyDisabled} value={form.purchaseDate} onChange={(e) => setForm(s => ({ ...s, purchaseDate: e.target.value }))} className="w-full border rounded px-2 py-1 text-sm disabled:bg-zinc-100" /></Field>
              <Field label="Purchase price ($)"><input disabled={draftOnlyDisabled} value={form.purchasePrice} onChange={(e) => setForm(s => ({ ...s, purchasePrice: e.target.value }))} className="w-full border rounded px-2 py-1 text-sm disabled:bg-zinc-100" /></Field>
              <Field label="Target exit quarter (YYYY-Qn)"><input disabled={draftOnlyDisabled} value={form.targetExitQuarter} onChange={(e) => setForm(s => ({ ...s, targetExitQuarter: e.target.value }))} placeholder="2026-Q3" className="w-full border rounded px-2 py-1 text-sm disabled:bg-zinc-100" /></Field>
              <Field label="Target duration (days)"><input type="number" disabled={draftOnlyDisabled} value={form.targetProjectDurationDays} onChange={(e) => setForm(s => ({ ...s, targetProjectDurationDays: e.target.value }))} className="w-full border rounded px-2 py-1 text-sm disabled:bg-zinc-100" /></Field>
              <Field label="Target permit date"><input type="date" disabled={draftOnlyDisabled} value={form.targetPermitDate} onChange={(e) => setForm(s => ({ ...s, targetPermitDate: e.target.value }))} className="w-full border rounded px-2 py-1 text-sm disabled:bg-zinc-100" /></Field>
              <Field label="Target construction end"><input type="date" disabled={draftOnlyDisabled} value={form.targetConstructionEndDate} onChange={(e) => setForm(s => ({ ...s, targetConstructionEndDate: e.target.value }))} className="w-full border rounded px-2 py-1 text-sm disabled:bg-zinc-100" /></Field>
            </div>

            {err && <div className="text-red-600 text-sm">{err}</div>}

            <div className="flex gap-2 pt-3">
              <button type="button" onClick={onClose} className="px-3 py-1.5 border rounded text-sm">Cancel</button>
              <button type="submit" disabled={submitting} className="ml-auto px-4 py-1.5 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded text-sm hover:opacity-90 disabled:opacity-50">Save</button>
            </div>
          </form>

          {user?.role === 'owner' && <OwnerOverrides project={project} onClose={onClose} />}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="text-xs text-zinc-600">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  )
}

function OwnerOverrides({ project, onClose }: { project: Project; onClose: () => void }) {
  const [unlockReason, setUnlockReason] = useState('')
  const [err, setErr] = useState<string | null>(null)

  async function doUnlock() {
    setErr(null)
    if (!unlockReason.trim()) { setErr('Reason required'); return }
    try {
      await unlockProjectToDraft({ projectId: project.id, reason: unlockReason })
      onClose()
    } catch (e) { setErr(e instanceof Error ? e.message : 'failed') }
  }

  return (
    <div className="mt-6 pt-4 border-t-2 border-red-200">
      <div className="text-xs font-semibold text-red-700 uppercase">Owner overrides</div>
      <div className="mt-2 text-sm">
        <div className="text-xs text-zinc-600">Unlock to Draft (requires reason)</div>
        <textarea value={unlockReason} onChange={(e) => setUnlockReason(e.target.value)} className="w-full border rounded px-2 py-1 text-sm mt-1" rows={2} />
        <button onClick={doUnlock} className="mt-2 px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700">Unlock to Draft</button>
        {err && <div className="text-red-600 text-xs mt-1">{err}</div>}
      </div>
    </div>
  )
}
