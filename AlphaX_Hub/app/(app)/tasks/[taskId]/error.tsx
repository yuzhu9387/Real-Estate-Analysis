'use client'
export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="p-6">
      <h1 className="font-headline-md text-on-background">Something went wrong</h1>
      <p className="mt-2 text-body-sm text-body-muted">{error.message}</p>
      <button
        onClick={reset}
        className="mt-4 px-4 py-2 rounded-lg bg-primary text-on-primary font-body-sm"
      >
        Try again
      </button>
    </div>
  )
}
