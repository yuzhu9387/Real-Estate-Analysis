import type { Task, PermitKey } from '@/lib/types';

export interface GanttRow {
  task: Task;
  rowIndex: number;
}

export interface PhaseGroup {
  phase: PermitKey;
  rows: GanttRow[];
  startIndex: number;
  endIndex: number;
}

export function groupByPhase(tasks: Task[]): PhaseGroup[] {
  const order = ['demo','tree','planning','public-hearing','building','utility','grading','encroach','design','approval','post','issuance'] as PermitKey[];
  const groups: PhaseGroup[] = [];
  let cursor = 0;
  for (const phase of order) {
    const phaseTasks = tasks.filter(t => t.phase === phase);
    if (phaseTasks.length === 0) continue;
    const rows = phaseTasks.map((task, i) => ({ task, rowIndex: cursor + i }));
    groups.push({ phase, rows, startIndex: cursor, endIndex: cursor + rows.length - 1 });
    cursor += rows.length;
  }
  return groups;
}
