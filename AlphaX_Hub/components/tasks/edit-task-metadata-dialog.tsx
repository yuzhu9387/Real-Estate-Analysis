'use client'
import * as Dialog from '@radix-ui/react-dialog'
import { useState } from 'react'
import { updateTaskMetadata } from '@/app/actions/tasks'
import type { TaskDetail } from '@/db/queries/task-detail'

export function EditTaskMetadataDialog({
  detail, onClose,
}: { detail: TaskDetail; onClose: () => void }) {
  const { task } = detail
  const [name, setName] = useState(task.name)
  const [startDate, setStartDate] = useState(task.targetStartDate ?? '')
  const [endDate, setEndDate] = useState(task.targetEndDate ?? '')
  const [reviewerId, setReviewerId] = useState<string>(task.reviewerId ?? '')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null); setBusy(true)
    try {
      const patch: Record<string, unknown> = {
        taskId: task.id,
        name: name.trim() || undefined,
        reviewerId: reviewerId === '' ? null : reviewerId,
      }
      if (startDate) patch.targetStartDate = startDate
      if (endDate) patch.targetEndDate = endDate
      await updateTaskMetadata(patch)
      onClose()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Update failed')
    } finally { setBusy(false) }
  }

  return (
    <Dialog.Root open onOpenChange={(o) => { if (!o) onClose() }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/30 z-40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[480px] max-w-[90vw] bg-white rounded-xl p-6 shadow-xl z-50">
          <Dialog.Title className="font-headline-md text-on-background">Edit task</Dialog.Title>
          <form onSubmit={submit} className="mt-4 space-y-4">
            <label className="block text-body-sm">
              <span className="font-label-caps text-body-muted">Name</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full border border-outline-variant rounded-lg px-3 py-2 font-body-sm"
                required
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-body-sm">
                <span className="font-label-caps text-body-muted">Target start</span>
                <input
                  type="date" value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="mt-1 w-full border border-outline-variant rounded-lg px-3 py-2 font-body-sm"
                />
              </label>
              <label className="block text-body-sm">
                <span className="font-label-caps text-body-muted">Target end</span>
                <input
                  type="date" value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="mt-1 w-full border border-outline-variant rounded-lg px-3 py-2 font-body-sm"
                />
              </label>
            </div>
            <label className="block text-body-sm">
              <span className="font-label-caps text-body-muted">Reviewer (user UUID; blank = none)</span>
              <input
                value={reviewerId}
                onChange={(e) => setReviewerId(e.target.value)}
                placeholder="00000000-0000-0000-0000-000000000000"
                className="mt-1 w-full border border-outline-variant rounded-lg px-3 py-2 font-body-sm"
              />
            </label>

            {err && <div className="text-error text-body-sm">{err}</div>}

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button" onClick={onClose}
                className="px-3 h-9 rounded-lg border border-outline-variant text-body-sm font-semibold"
              >Cancel</button>
              <button
                type="submit" disabled={busy}
                className="ml-auto px-4 h-9 rounded-lg bg-primary text-on-primary text-body-sm font-semibold disabled:opacity-50"
              >Save</button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
