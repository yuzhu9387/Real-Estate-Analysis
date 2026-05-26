import type { Task } from '@/lib/types';
import { getPermit } from '@/lib/permits';

const STATUS_OVERLAY: Record<Task['status'], { fillOpacity: number; stroke?: string; strokeDasharray?: string; pattern?: boolean }> = {
  'Not Started':           { fillOpacity: 0,    strokeDasharray: '4 4' },
  'Ready':                 { fillOpacity: 0.15, strokeDasharray: '4 4' },
  'In Progress':           { fillOpacity: 1 },
  'Submitted for Review':  { fillOpacity: 1, pattern: true },
  'Needs Revision':        { fillOpacity: 1, stroke: '#F59E0B' },
  'Approved':              { fillOpacity: 1 },
  'Done':                  { fillOpacity: 1 },
  'Delayed':               { fillOpacity: 1, stroke: '#EF4444' },
  'Blocked':               { fillOpacity: 0.4 },
  'Cancelled':             { fillOpacity: 0.2 },
};

export function GanttBar({
  task, x, y, baselineWidth, forecastWidth, rowHeight, dayToX,
}: {
  task: Task;
  x: number;
  y: number;
  baselineWidth: number;
  forecastWidth: number;
  rowHeight: number;
  dayToX: (day: number) => number;
}) {
  const p = getPermit(task.phase);
  const overlay = STATUS_OVERLAY[task.status];
  const barH = rowHeight * 0.55;
  const barY = y + (rowHeight - barH) / 2;
  const baselineColor = p.hex;

  const actualX = task.actualStartDay !== null ? dayToX(task.actualStartDay) : null;
  const actualEnd = task.actualEndDay;
  const actualWidth = actualX !== null ? (actualEnd !== null ? dayToX(actualEnd) - actualX : 0) : 0;

  return (
    <g>
      {/* Baseline outline */}
      <rect
        x={x} y={barY} width={baselineWidth} height={barH}
        fill="none" stroke={baselineColor} strokeWidth={1.5} strokeDasharray="3 3"
        rx={3}
      />
      {/* Forecast tint */}
      {forecastWidth > baselineWidth && (
        <rect
          x={x + baselineWidth} y={barY} width={forecastWidth - baselineWidth} height={barH}
          fill={baselineColor} fillOpacity={0.18} rx={2}
        />
      )}
      {/* Actual fill */}
      {overlay.fillOpacity > 0 && (
        <rect
          x={x} y={barY} width={Math.max(actualWidth, baselineWidth)} height={barH}
          fill={baselineColor} fillOpacity={overlay.fillOpacity}
          stroke={overlay.stroke ?? 'none'} strokeWidth={overlay.stroke ? 2 : 0}
          rx={3}
        />
      )}
      {/* Critical path glow */}
      {task.isCriticalPath && (
        <rect
          x={x - 1} y={barY - 1} width={Math.max(baselineWidth, forecastWidth) + 2} height={barH + 2}
          fill="none" stroke="#F59E0B" strokeWidth={1} strokeOpacity={0.5} rx={4}
        />
      )}
    </g>
  );
}
