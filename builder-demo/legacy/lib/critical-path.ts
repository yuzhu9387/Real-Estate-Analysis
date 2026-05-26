import type { Task, TaskId } from './types';

// Returns the set of task IDs that are on the critical path.
// For this demo the critical path is statically authored on each task via the
// `isCriticalPath` flag in sample-data (see spec §4). This function exists so
// consumers (Gantt highlighting, KPI computation) have one entry point and
// don't need to know about the flag.
export function computeCriticalPath(tasks: Task[]): Set<TaskId> {
  return new Set(tasks.filter(t => t.isCriticalPath).map(t => t.id));
}
