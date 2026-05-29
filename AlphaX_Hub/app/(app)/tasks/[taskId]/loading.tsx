export default function Loading() {
  return (
    <div className="p-6 space-y-4">
      <div className="h-6 w-32 bg-surface-container-low rounded animate-pulse" />
      <div className="h-10 w-2/3 bg-surface-container-low rounded animate-pulse" />
      <div className="glacier-panel rounded-xl h-32 animate-pulse" />
      <div className="glacier-panel rounded-xl h-64 animate-pulse" />
      <div className="glacier-panel rounded-xl h-48 animate-pulse" />
      <div className="glacier-panel rounded-xl h-40 animate-pulse" />
    </div>
  )
}
