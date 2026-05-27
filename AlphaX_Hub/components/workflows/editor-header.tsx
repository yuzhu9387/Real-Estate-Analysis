'use client'
import Link from 'next/link'

export function EditorHeader({
  mode, isArchived, isDirty, isSaving, errorBanner,
  onSave, onCancel, onArchive, onRestore,
}: {
  mode: 'new' | 'edit'
  isArchived: boolean
  isDirty: boolean
  isSaving: boolean
  errorBanner: string | null
  onSave: () => void
  onCancel: () => void
  onArchive: () => void
  onRestore: () => void
}) {
  return (
    <div>
      <div className="flex items-center mb-3">
        <Link href="/workflows" className="text-blue-600 text-sm hover:underline">← Back to list</Link>
        <div className="ml-auto flex gap-2">
          <button onClick={onCancel}
            className="px-3 py-1.5 border border-zinc-300 rounded text-sm hover:bg-zinc-50">
            Cancel
          </button>
          {mode === 'edit' && !isArchived && (
            <button onClick={onArchive}
              className="px-3 py-1.5 border border-red-200 text-red-700 rounded text-sm hover:bg-red-50">
              Archive
            </button>
          )}
          {mode === 'edit' && isArchived && (
            <button onClick={onRestore}
              className="px-3 py-1.5 border border-zinc-300 text-zinc-700 rounded text-sm hover:bg-zinc-50">
              Restore
            </button>
          )}
          <button onClick={onSave}
            disabled={isSaving || !isDirty}
            className="px-4 py-1.5 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded text-sm hover:opacity-90 disabled:opacity-50">
            {isSaving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
      {errorBanner && (
        <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm px-3 py-2 mb-3">
          {errorBanner}
        </div>
      )}
    </div>
  )
}
