export type TaskInput = {
  id: string
  durationDays: number
  status: 'not_started' | 'started' | 'pending_review' | 'approved' | 'complete' | 'wont_do'
}
export type DepInput = { fromTaskId: string; toTaskId: string; lagDays: number }

export type ScheduleOutput = {
  taskId: string
  earliestStartDay: number
  earliestEndDay: number
  latestStartDay: number
  latestEndDay: number
  slackDays: number
  isOnCriticalPath: boolean
}

export function recomputeSchedule(input: {
  tasks: TaskInput[]
  deps: DepInput[]
}): ScheduleOutput[] {
  const liveTasks = input.tasks.filter(t => t.status !== 'wont_do')
  const liveIds = new Set(liveTasks.map(t => t.id))
  const liveDeps = input.deps.filter(d => liveIds.has(d.fromTaskId) && liveIds.has(d.toTaskId))

  const successors = new Map<string, DepInput[]>()
  const predecessors = new Map<string, DepInput[]>()
  for (const t of liveTasks) { successors.set(t.id, []); predecessors.set(t.id, []) }
  for (const d of liveDeps) {
    successors.get(d.fromTaskId)!.push(d)
    predecessors.get(d.toTaskId)!.push(d)
  }

  const indeg = new Map<string, number>()
  for (const t of liveTasks) indeg.set(t.id, predecessors.get(t.id)!.length)
  const queue: string[] = []
  for (const [id, n] of indeg) if (n === 0) queue.push(id)
  const order: string[] = []
  while (queue.length) {
    const id = queue.shift()!
    order.push(id)
    for (const d of successors.get(id)!) {
      const n = indeg.get(d.toTaskId)! - 1
      indeg.set(d.toTaskId, n)
      if (n === 0) queue.push(d.toTaskId)
    }
  }
  if (order.length !== liveTasks.length) {
    throw new Error('Cycle detected in task dependencies')
  }
  const taskById = new Map(liveTasks.map(t => [t.id, t]))

  const earliestStart = new Map<string, number>()
  const earliestEnd = new Map<string, number>()
  for (const id of order) {
    const preds = predecessors.get(id)!
    const es = preds.length === 0 ? 0
      : Math.max(...preds.map(p => earliestEnd.get(p.fromTaskId)! + p.lagDays))
    const dur = taskById.get(id)!.durationDays
    earliestStart.set(id, es)
    earliestEnd.set(id, es + dur)
  }

  const projectEnd = Math.max(0, ...Array.from(earliestEnd.values()))
  const latestEnd = new Map<string, number>()
  const latestStart = new Map<string, number>()
  for (const id of [...order].reverse()) {
    const succs = successors.get(id)!
    const le = succs.length === 0 ? projectEnd
      : Math.min(...succs.map(s => latestStart.get(s.toTaskId)! - s.lagDays))
    const dur = taskById.get(id)!.durationDays
    latestEnd.set(id, le)
    latestStart.set(id, le - dur)
  }

  return liveTasks.map(t => {
    const es = earliestStart.get(t.id)!
    const ee = earliestEnd.get(t.id)!
    const ls = latestStart.get(t.id)!
    const le = latestEnd.get(t.id)!
    const slack = ls - es
    return {
      taskId: t.id,
      earliestStartDay: es,
      earliestEndDay: ee,
      latestStartDay: ls,
      latestEndDay: le,
      slackDays: slack,
      isOnCriticalPath: slack === 0,
    }
  })
}
