import type { Task } from './types';
import { TODAY_DAY } from './dates';

export function computeKpis(tasks: Task[]) {
  const overdue = tasks.filter(t => t.plannedDueDay < TODAY_DAY && t.status !== 'Done' && t.status !== 'Approved').length;
  const needsRevision = tasks.filter(t => t.status === 'Needs Revision').length;
  const criticalOverdue = tasks.filter(t => t.isCriticalPath && t.status === 'Delayed').length;
  const upcoming7d = tasks.filter(t => t.plannedDueDay >= TODAY_DAY && t.plannedDueDay <= TODAY_DAY + 7).length;
  return {
    activeProjects: 1,
    atRisk: 1,
    overdue,
    needsRevision,
    criticalOverdue,
    upcoming7d,
  };
}
