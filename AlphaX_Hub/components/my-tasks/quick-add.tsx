'use client'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { quickAddTask } from '@/app/actions/tasks'

export function QuickAdd({ currentUserId }: { currentUserId: string }) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const today = useMemo(() => {
    const d = new Date()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${d.getFullYear()}-${m}-${day}`
  }, [])

  async function onAdd() {
    setError(null)
    if (!name.trim()) return setError('Task name is required')
    if (!dueDate) return setError('Due date is required')

    setBusy(true)
    try {
      const res = (await quickAddTask({
        name: name.trim(),
        ownerId: currentUserId,
        startDate: today,
        endDate: dueDate,
      })) as { ok: true }
      if (res.ok) {
        setName('')
        setDueDate('')
        router.refresh()
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add task')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-xl border border-outline-variant/30 bg-white shadow-sm overflow-hidden">
      <header className="flex items-center gap-sm px-md py-sm border-b border-outline-variant/30 bg-surface-container-low/40">
        <span className="material-symbols-outlined text-primary text-[18px]">add_task</span>
        <span className="text-label-caps font-label-caps text-on-surface tracking-widest">
          Quick Add Task
        </span>
      </header>

      <div className="p-md flex flex-wrap items-center gap-sm">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="What needs to be done?"
          className="flex-1 min-w-[200px] h-10 rounded-lg border border-outline-variant/40 bg-white px-sm text-body-sm text-on-surface focus:outline-none focus:border-primary transition-colors placeholder:text-outline/60"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !busy) onAdd()
          }}
        />

        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          min={today}
          aria-label="Due date"
          className="h-10 rounded-lg border border-outline-variant/40 bg-white px-sm text-body-sm text-on-surface focus:outline-none focus:border-primary transition-colors w-[160px]"
        />

        <button
          type="button"
          onClick={onAdd}
          disabled={busy}
          className="h-10 rounded-lg bg-primary px-md text-body-sm font-bold text-white shadow-sm shadow-primary/10 hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {busy ? 'Adding…' : 'Add'}
        </button>
      </div>

      {error && (
        <div className="mx-md mb-md flex items-center gap-xs rounded-lg border border-error/20 bg-error/5 px-sm py-xs text-body-sm text-error">
          <span className="material-symbols-outlined text-[16px]">error</span>
          {error}
        </div>
      )}
    </section>
  )
}
