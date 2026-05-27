export default function Loading() {
  return (
    <div className="space-y-3">
      <div className="h-8 w-48 bg-zinc-100 rounded animate-pulse" />
      <div className="h-10 bg-white border border-zinc-200 rounded animate-pulse" />
      <div className="h-10 border-b border-zinc-200" />
      <div className="h-32 bg-white border border-zinc-200 rounded animate-pulse" />
    </div>
  )
}
