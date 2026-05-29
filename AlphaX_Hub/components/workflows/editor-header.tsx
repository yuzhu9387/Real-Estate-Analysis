'use client'
import Link from 'next/link'

export function EditorHeader({
  mode,
  isArchived,
  isDirty,
  isSaving,
  errorBanner,
  onSave,
  onCancel,
  onArchive,
  onRestore,
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
      <div className="flex flex-col gap-sm md:flex-row md:items-center mb-md">
        <Link
          href="/workflows"
          className="inline-flex items-center gap-xs text-body-sm font-semibold text-primary hover:underline"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          Back to Workflow Templates
        </Link>
        <div className="md:ml-auto flex flex-wrap items-center gap-xs">
          {isDirty && (
            <span className="inline-flex items-center gap-xs text-body-sm text-on-surface-variant">
              <span className="w-1.5 h-1.5 rounded-full bg-secondary" />
              Unsaved changes
            </span>
          )}
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex h-9 items-center gap-xs rounded-lg border border-outline-variant/40 bg-white px-sm text-body-sm font-semibold text-on-surface-variant hover:border-primary hover:text-primary transition-colors"
          >
            Cancel
          </button>
          {mode === 'edit' && !isArchived && (
            <button
              type="button"
              onClick={onArchive}
              className="inline-flex h-9 items-center gap-xs rounded-lg border border-error/30 bg-white px-sm text-body-sm font-semibold text-error hover:bg-error/5 transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">archive</span>
              Archive
            </button>
          )}
          {mode === 'edit' && isArchived && (
            <button
              type="button"
              onClick={onRestore}
              className="inline-flex h-9 items-center gap-xs rounded-lg border border-outline-variant/40 bg-white px-sm text-body-sm font-semibold text-on-surface hover:border-primary hover:text-primary transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">restore</span>
              Restore
            </button>
          )}
          <button
            type="button"
            onClick={onSave}
            disabled={isSaving}
            className="inline-flex h-9 items-center gap-xs rounded-lg bg-primary px-md text-body-sm font-bold text-white shadow-sm shadow-primary/10 hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="material-symbols-outlined text-[16px]">save</span>
            {isSaving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
      {errorBanner && (
        <div className="flex items-center gap-xs rounded-lg border border-error/20 bg-error/5 px-md py-sm text-body-sm text-error mb-md">
          <span className="material-symbols-outlined text-[18px]">error</span>
          {errorBanner}
        </div>
      )}
    </div>
  )
}
