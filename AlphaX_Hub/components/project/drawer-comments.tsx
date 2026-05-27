'use client'
import { useEffect, useState } from 'react'
import { addTaskComment } from '@/app/actions/task-comments'
import { usePermissions } from '@/lib/hooks/use-permissions'
import { Avatar } from '@/components/shared/avatar'
import type { TaskComment, User } from '@/db/schema'

function timeAgo(when: Date): string {
  const diff = Date.now() - when.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return when.toLocaleDateString()
}

export function DrawerComments({ taskId }: { taskId: string }) {
  const [comments, setComments] = useState<TaskComment[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const { user } = usePermissions()

  async function load() {
    const res = await fetch(`/api/tasks/${taskId}/comments`)
    if (res.ok) {
      const data = await res.json()
      setComments(data.comments)
      setUsers(data.users)
    }
  }

  useEffect(() => { load() }, [taskId])

  async function post() {
    if (!body.trim()) return
    setBusy(true)
    try {
      await addTaskComment({ taskId, body, kind: 'discussion' })
      setBody('')
      await load()
    } finally { setBusy(false) }
  }

  const userById = new Map(users.map(u => [u.id, u]))

  return (
    <div className="mt-4 pt-3 border-t border-zinc-200">
      <div className="text-[10px] uppercase text-zinc-500">Comments</div>
      <div className="mt-2 space-y-2">
        {comments.length === 0 && <div className="text-xs text-zinc-500">No comments yet.</div>}
        {comments.map(c => {
          const author = userById.get(c.authorId)
          return (
            <div key={c.id} className="bg-zinc-50 rounded p-2 text-xs">
              <div className="flex items-center gap-2">
                {author && <Avatar user={author} size="xs" />}
                <strong>{author?.name ?? 'Unknown'}</strong>
                <span className="text-zinc-500">{timeAgo(new Date(c.createdAt))}</span>
                <span className="ml-1 text-[10px] bg-zinc-200 px-1 py-0.5 rounded">{c.kind}</span>
              </div>
              <div className="mt-1 whitespace-pre-wrap">{c.body}</div>
            </div>
          )
        })}
      </div>
      <div className="mt-2">
        <textarea value={body} onChange={(e) => setBody(e.target.value)}
          placeholder={`Write a comment as ${user?.name ?? 'you'}…`}
          className="w-full border rounded px-2 py-1 text-xs" rows={2} />
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[10px] text-zinc-500">Posts as discussion (review comments are attached automatically)</span>
          <button onClick={post} disabled={busy} className="ml-auto bg-blue-600 text-white text-xs px-3 py-1 rounded disabled:opacity-50">Post</button>
        </div>
      </div>
    </div>
  )
}
