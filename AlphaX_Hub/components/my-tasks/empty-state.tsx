export function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-dashed border-zinc-200 bg-white p-12 text-center text-zinc-500 text-sm">
      {message}
    </div>
  )
}
