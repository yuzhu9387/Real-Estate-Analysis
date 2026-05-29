'use client'
import { useState } from 'react'
import { addTaskComment } from '@/app/actions/task-comments'
import { Avatar } from '@/components/shared/avatar'
import type { TaskDetail } from '@/db/queries/task-detail'

export function CommentsSection({ detail }: { detail: TaskDetail }) {
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function post() {
    if (!body.trim()) return
    setBusy(true); setErr(null)
    try {
      await addTaskComment({ taskId: detail.task.id, body: body.trim(), kind: 'discussion' })
      setBody('')
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Post failed')
    } finally { setBusy(false) }
  }

  return (
    <section className="glacier-panel rounded-xl mb-4">
      <h2 className="px-5 pt-5 font-headline-md text-on-background">3. Comments / Notes</h2>
      <div className="px-5 pb-6 pt-4">
        <div className="space-y-4 mb-4">
          {detail.comments.length === 0 && (
            <div className="text-body-muted font-body-sm">No comments yet.</div>
          )}
          {detail.comments.map(c => (
            <div key={c.id} className="grid grid-cols-[34px_1fr] gap-3 pb-3 border-b border-outline-variant last:border-b-0">
              <Avatar user={{ id: c.authorId, name: c.authorName }} size="sm" />
              <div>
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="font-body-sm font-semibold text-on-background">{c.authorName}</span>
                  <span className="text-body-muted text-[12px]">
                    {new Date(c.createdAt).toLocaleString(undefined, {
                      year: 'numeric', month: 'short', day: 'numeric',
                      hour: 'numeric', minute: '2-digit',
                    })}
                  </span>
                </div>
                <div className="font-body-sm text-on-surface-variant whitespace-pre-wrap">{c.body}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-[1fr_auto] gap-3 items-center">
          <input
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') post() }}
            placeholder="Write a comment..."
            className="h-11 border border-outline-variant rounded-lg px-4 font-body-sm"
          />
          <button
            onClick={post}
            disabled={busy || !body.trim()}
            className="h-11 px-5 rounded-lg bg-tertiary text-on-primary font-body-sm font-semibold disabled:opacity-50"
          >
            Post
          </button>
        </div>
        {err && <div className="text-error text-body-sm mt-2">{err}</div>}
      </div>
    </section>
  )
}
