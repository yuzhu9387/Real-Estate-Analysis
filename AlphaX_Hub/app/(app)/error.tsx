'use client'
import { useEffect } from 'react'

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-md">
      <div className="glacier-panel max-w-md rounded-xl p-lg text-center">
        <span className="material-symbols-outlined text-error" style={{ fontSize: 40 }}>
          report_problem
        </span>
        <h2 className="font-headline-md text-headline-md text-on-surface mt-sm">
          Something went wrong
        </h2>
        <p className="mt-xs text-body-sm text-on-surface-variant">
          {error.message || 'An unexpected error occurred.'}
        </p>
        {error.digest && (
          <p className="mt-xs text-[11px] text-outline font-data-display">digest: {error.digest}</p>
        )}
        <button
          type="button"
          onClick={() => reset()}
          className="mt-md inline-flex items-center gap-sm rounded-lg bg-primary px-md py-sm font-semibold text-white transition-all hover:brightness-110 active:scale-[0.98]"
        >
          <span className="material-symbols-outlined text-sm">refresh</span>
          Try again
        </button>
      </div>
    </div>
  )
}
