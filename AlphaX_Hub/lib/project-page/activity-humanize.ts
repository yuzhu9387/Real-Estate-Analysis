type Actor = { id: string; name: string }
type Args = {
  type: string
  payload: Record<string, unknown>
  actor: Actor
  taskById: Map<string, string>
}

export type HumanizedActivity = {
  text: string
  taskId: string | null
}

function taskName(payload: Record<string, unknown>, taskById: Map<string, string>): string {
  const id = typeof payload.taskId === 'string' ? payload.taskId : null
  const name = id ? taskById.get(id) : null
  if (typeof payload.name === 'string') return payload.name
  return name ?? '(unknown task)'
}

export function humanizeActivity(args: Args): HumanizedActivity {
  const { type, payload, actor, taskById } = args
  const tid = typeof payload.taskId === 'string' ? payload.taskId : null
  switch (type) {
    case 'phase.kicked_off':
      return { text: `${actor.name} kicked off the ${payload.phaseName} phase`, taskId: null }
    case 'phase.marked_complete':
      return { text: `${actor.name} marked the ${payload.phaseName} phase complete`, taskId: null }
    case 'task.status_changed':
      return { text: `${actor.name} moved "${taskName(payload, taskById)}" from ${payload.from} to ${payload.to}`, taskId: tid }
    case 'task.submitted_for_review':
      return { text: `${actor.name} submitted "${taskName(payload, taskById)}" for review`, taskId: tid }
    case 'task.approved':
      return { text: `${actor.name} approved "${taskName(payload, taskById)}"`, taskId: tid }
    case 'task.revision_requested':
      return { text: `${actor.name} requested revision on "${taskName(payload, taskById)}"`, taskId: tid }
    case 'task.added_unplanned':
      return { text: `${actor.name} added unplanned task "${taskName(payload, taskById)}"`, taskId: tid }
    case 'task.subtask_added':
      return { text: `${actor.name} added a subtask under "${taskName(payload, taskById)}"`, taskId: tid }
    case 'task.reassigned':
      return { text: `${actor.name} reassigned "${taskName(payload, taskById)}"`, taskId: tid }
    default:
      return { text: `${actor.name}: ${type}`, taskId: tid }
  }
}
