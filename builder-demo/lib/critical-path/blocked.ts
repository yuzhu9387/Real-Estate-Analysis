import type { TaskInput } from './index'

const TERMINAL = new Set(['complete', 'wont_do'])

export function computeBlocked(input: {
  tasks: Pick<TaskInput, 'id' | 'status'>[]
  deps: { fromTaskId: string; toTaskId: string }[]
}): Array<{ taskId: string; isBlocked: boolean }> {
  const statusById = new Map(input.tasks.map(t => [t.id, t.status]))
  const incoming = new Map<string, string[]>()
  for (const t of input.tasks) incoming.set(t.id, [])
  for (const d of input.deps) incoming.get(d.toTaskId)?.push(d.fromTaskId)
  return input.tasks.map(t => {
    const upstreams = incoming.get(t.id) ?? []
    const blocked = upstreams.some(u => {
      const s = statusById.get(u)
      return s !== undefined && !TERMINAL.has(s)
    })
    return { taskId: t.id, isBlocked: blocked }
  })
}
