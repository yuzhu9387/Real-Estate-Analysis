import Link from 'next/link'

export default function TaskDetailStub({ params }: { params: { id: string; taskId: string } }) {
  return (
    <div className="space-y-4">
      <Link href={`/projects/${params.id}`} className="text-blue-600 text-sm hover:underline">
        ← Back to project
      </Link>
      <div className="rounded-lg border border-zinc-200 bg-white p-6">
        <h1 className="text-xl font-semibold">Task detail page</h1>
        <p className="text-sm text-zinc-600 mt-2">
          Full task detail UI is covered by a separate spec. For now use the drawer on the project page —
          it has the same status actions, subtasks, and comments.
        </p>
        <p className="text-xs text-zinc-500 mt-4">
          taskId: <code>{params.taskId}</code>
        </p>
      </div>
    </div>
  )
}
