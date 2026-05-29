export function EmptyState({
  message,
  icon = 'task_alt',
}: {
  message: string
  icon?: string
}) {
  return (
    <div className="rounded-xl border border-dashed border-outline-variant/40 bg-white/60 p-xl text-center">
      <div className="grid place-items-center mx-auto w-12 h-12 rounded-full bg-primary/5 text-primary mb-sm">
        <span className="material-symbols-outlined">{icon}</span>
      </div>
      <p className="text-body-sm text-on-surface-variant">{message}</p>
    </div>
  )
}
