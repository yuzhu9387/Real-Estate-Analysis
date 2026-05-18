'use client';
import { useDemoStore } from '@/lib/store';
import { groupByPhase } from './gantt-types';
import { GanttBar } from './gantt-bar';
import { getPermit } from '@/lib/permits';
import { TODAY_DAY } from '@/lib/dates';
import type { PermitKey, TaskId, TaskStatus, UserId } from '@/lib/types';

const ROW_H = 28;
const HEADER_H = 32;
const LABEL_W = 280;
const PROJECT_DAYS = 200;

interface GanttChartProps {
  zoom: 'week' | 'month' | 'quarter';
  filterPhase: PermitKey | 'all';
  filterStatus: TaskStatus | 'all';
  filterOwner: UserId | 'all';
  showDependencies: boolean;
  onTaskClick?: (id: TaskId) => void;
}

export function GanttChart({ zoom, filterPhase, filterStatus, filterOwner, showDependencies, onTaskClick }: GanttChartProps) {
  const allTasks = useDemoStore((s) => Object.values(s.tasks));
  const DAY_W = zoom === 'week' ? 12 : zoom === 'month' ? 6 : 3;
  const dayToX = (day: number) => LABEL_W + day * DAY_W;

  const filtered = allTasks.filter(t =>
    (filterPhase === 'all' || t.phase === filterPhase) &&
    (filterStatus === 'all' || t.status === filterStatus) &&
    (filterOwner === 'all' || t.ownerId === filterOwner)
  );
  const groups = groupByPhase(filtered);
  const totalRows = groups.reduce((n, g) => n + g.rows.length, 0);
  const totalHeight = HEADER_H + totalRows * ROW_H + 16;
  const totalWidth = LABEL_W + PROJECT_DAYS * DAY_W;
  const rowsFlat = groups.flatMap(g => g.rows);
  const rowByTaskId = new Map(rowsFlat.map(r => [r.task.id, r.rowIndex]));

  return (
    <div className="rounded-lg border border-border bg-card overflow-auto">
      <svg width={totalWidth} height={totalHeight}>
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#94A3B8" />
          </marker>
        </defs>
        {[0, 30, 60, 90, 120, 150, 180].map(d => (
          <g key={d}>
            <line x1={dayToX(d)} x2={dayToX(d)} y1={HEADER_H} y2={totalHeight - 16} stroke="#E2E8F0" strokeDasharray="2 4" />
            <text x={dayToX(d) + 4} y={20} fontSize={11} fill="#64748B">Day {d}</text>
          </g>
        ))}
        <line x1={dayToX(TODAY_DAY)} x2={dayToX(TODAY_DAY)} y1={HEADER_H - 6} y2={totalHeight - 16} stroke="#0F172A" strokeWidth={1.5} />
        <text x={dayToX(TODAY_DAY) + 4} y={20} fontSize={11} fill="#0F172A" fontWeight={600}>Today (Day {TODAY_DAY})</text>

        {rowsFlat.map(({ task, rowIndex }) => {
          const y = HEADER_H + rowIndex * ROW_H;
          const p = getPermit(task.phase);
          const x0 = dayToX(task.plannedStartDay);
          const baseW = (task.plannedDueDay - task.plannedStartDay) * DAY_W;
          const foreW = (task.forecastDueDay - task.plannedStartDay) * DAY_W;
          return (
            <g key={task.id} onClick={() => onTaskClick?.(task.id)} style={{ cursor: 'pointer' }}>
              <foreignObject x={0} y={y} width={LABEL_W - 8} height={ROW_H}>
                <div className="h-full flex items-center pl-3 gap-2 text-xs">
                  <span className="size-1.5 rounded-full shrink-0" style={{ backgroundColor: p.hex }} />
                  <span className="truncate">{task.title}</span>
                </div>
              </foreignObject>
              <GanttBar
                task={task} x={x0} y={y}
                baselineWidth={baseW} forecastWidth={foreW}
                rowHeight={ROW_H} dayToX={dayToX}
              />
            </g>
          );
        })}

        {showDependencies && rowsFlat.flatMap(({ task, rowIndex }) =>
          task.dependencyIds.map(depId => {
            const dep = allTasks.find(t => t.id === depId);
            if (!dep) return null;
            const depRowIdx = rowByTaskId.get(depId);
            if (depRowIdx === undefined) return null;
            const x1 = dayToX(dep.forecastDueDay);
            const y1 = HEADER_H + depRowIdx * ROW_H + ROW_H / 2;
            const x2 = dayToX(task.forecastStartDay);
            const y2 = HEADER_H + rowIndex * ROW_H + ROW_H / 2;
            const onCritical = task.isCriticalPath && dep.isCriticalPath;
            return (
              <path
                key={`${depId}-${task.id}`}
                d={`M${x1} ${y1} L${x1 + 6} ${y1} L${x1 + 6} ${y2} L${x2 - 2} ${y2}`}
                stroke={onCritical ? '#F59E0B' : '#CBD5E1'}
                strokeWidth={onCritical ? 1.5 : 1}
                fill="none"
                markerEnd="url(#arrow)"
              />
            );
          })
        )}
      </svg>
    </div>
  );
}
