export function hasCycle(input: {
  tasks: Array<{ id: string }>
  deps: Array<{ fromId: string; toId: string }>
}): boolean {
  const ids = new Set(input.tasks.map(t => t.id))
  if (input.deps.some(d => d.fromId === d.toId && ids.has(d.fromId))) return true

  const indegree = new Map<string, number>()
  const adj = new Map<string, string[]>()
  for (const t of input.tasks) {
    indegree.set(t.id, 0)
    adj.set(t.id, [])
  }
  for (const d of input.deps) {
    if (!ids.has(d.fromId) || !ids.has(d.toId)) continue
    adj.get(d.fromId)!.push(d.toId)
    indegree.set(d.toId, (indegree.get(d.toId) ?? 0) + 1)
  }

  const queue: string[] = []
  for (const [id, n] of indegree) if (n === 0) queue.push(id)
  let visited = 0
  while (queue.length > 0) {
    const id = queue.shift()!
    visited++
    for (const next of adj.get(id)!) {
      const n = (indegree.get(next) ?? 0) - 1
      indegree.set(next, n)
      if (n === 0) queue.push(next)
    }
  }
  return visited < input.tasks.length
}
