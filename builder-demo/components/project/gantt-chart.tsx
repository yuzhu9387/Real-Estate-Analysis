'use client';
import { useDemoStore } from '@/lib/store';
import { groupByPhase } from './gantt-types';
import { GanttBar } from './gantt-bar';
import { getPermit } from '@/lib/permits';
import { TODAY_DAY } from '@/lib/dates';

const ROW_H = 28;
const HEADER_H = 32;
const LABEL_W = 280;
const DAY_W = 6;
const PROJECT_DAYS = 200;

function dayToX(day: number): number {
  return LABEL_W + day * DAY_W;
}

export function GanttChart() {
  const tasks = useDemoStore((s) => Object.values(s.tasks));
  const groups = groupByPhase(tasks);
  const totalRows = groups.reduce((n, g) => n + g.rows.length, 0);
  const totalHeight = HEADER_H + totalRows * ROW_H + 16;
  const totalWidth = LABEL_W + PROJECT_DAYS * DAY_W;

  return (
    <div className="rounded-lg border border-border bg-card overflow-auto">
      <svg width={totalWidth} height={totalHeight}>
        {/* Month markers every 30 days */}
        {[0, 30, 60, 90, 120, 150, 180].map(d => (
          <g key={d}>
            <line x1={dayToX(d)} x2={dayToX(d)} y1={HEADER_H} y2={totalHeight - 16} stroke="#E2E8F0" strokeDasharray="2 4" />
            <text x={dayToX(d) + 4} y={20} fontSize={11} fill="#64748B">Day {d}</text>
          </g>
        ))}
        {/* Today line */}
        <line x1={dayToX(TODAY_DAY)} x2={dayToX(TODAY_DAY)} y1={HEADER_H - 6} y2={totalHeight - 16} stroke="#0F172A" strokeWidth={1.5} />
        <text x={dayToX(TODAY_DAY) + 4} y={20} fontSize={11} fill="#0F172A" fontWeight={600}>Today (Day {TODAY_DAY})</text>

        {/* Rows */}
        {groups.flatMap(group => group.rows).map(({ task, rowIndex }) => {
          const y = HEADER_H + rowIndex * ROW_H;
          const p = getPermit(task.phase);
          const x0 = dayToX(task.plannedStartDay);
          const baseW = (task.plannedDueDay - task.plannedStartDay) * DAY_W;
          const foreW = (task.forecastDueDay - task.plannedStartDay) * DAY_W;
          return (
            <g key={task.id}>
              <foreignObject x={0} y={y} width={LABEL_W - 8} height={ROW_H}>
                <div className="h-full flex items-center pl-3 gap-2 text-xs">
                  <span className="size-1.5 rounded-full shrink-0" style={{ backgroundColor: p.hex }} />
                  <span className="truncate">{task.title}</span>
                </div>
              </foreignObject>
              <GanttBar
                task={task}
                x={x0} y={y}
                baselineWidth={baseW}
                forecastWidth={foreW}
                rowHeight={ROW_H}
                dayToX={dayToX}
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
}
