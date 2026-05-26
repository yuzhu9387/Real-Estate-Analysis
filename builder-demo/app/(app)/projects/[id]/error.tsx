'use client'
export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="p-6 max-w-lg">
      <h1 className="text-lg font-semibold">Something went wrong loading this project</h1>
      <p className="text-sm text-zinc-600 mt-2">{error.message}</p>
      <button onClick={reset} className="mt-4 px-3 py-1.5 border rounded text-sm">Try again</button>
    </div>
  )
}
