'use client'
import { useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import type { Task, ProjectWorkflow, TaskDep } from '@/db/schema'
import { computeGanttLayout, type Zoom } from './gantt-layout'

const ROW_HEIGHT = 22
const HEADER_HEIGHT = 30

export function GanttChart({
  tasks, workflows, taskDeps, todayDayOffset,
}: {
  tasks: Task[]
  workflows: ProjectWorkflow[]
  taskDeps: TaskDep[]
  todayDayOffset: number
}) {
  const router = useRouter()
  const search = useSearchParams()
  const [zoom, setZoom] = useState<Zoom>('month')

  const rows = useMemo(() => {
    const list: Array<{ kind: 'workflow'; workflow: ProjectWorkflow } | { kind: 'task'; task: Task }> = []
    for (const w of workflows) {
      list.push({ kind: 'workflow', workflow: w })
      for (const t of tasks.filter(t => t.projectWorkflowId === w.id && t.parentTaskId === null)) {
        list.push({ kind: 'task', task: t })
      }
    }
    return list
  }, [workflows, tasks])

  const validTasks = tasks.filter(t => t.plannedStartDay !== null && t.plannedEndDay !== null)
  const minDay = validTasks.length === 0 ? 0 : Math.min(...validTasks.map(t => t.plannedStartDay!), todayDayOffset)
  const maxDay = validTasks.length === 0 ? 30 : Math.max(...validTasks.map(t => t.plannedEndDay!), todayDayOffset) + 5

  const layout = computeGanttLayout({
    zoom, minDay, maxDay,
    tasks: validTasks.map(t => ({ id: t.id, start: t.plannedStartDay!, end: t.plannedEndDay! })),
  })
  const taskXById = new Map(layout.taskX.map(t => [t.id, t]))

  const svgHeight = HEADER_HEIGHT + rows.length * ROW_HEIGHT + 10
  const todayX = (todayDayOffset - minDay) * layout.dayWidth

  function openTask(id: string) {
    const next = new URLSearchParams(search)
    next.set('task', id)
    router.push(`?${next.toString()}`, { scroll: false })
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-3">
      <div className="flex items-center gap-2 mb-2">
        <div className="text-xs uppercase text-zinc-600">Timeline</div>
        <div className="ml-auto flex gap-1">
          {(['week','month','quarter'] as const).map(z => (
            <button key={z} onClick={() => setZoom(z)}
              className={['px-2 py-0.5 text-xs rounded',
                z === zoom ? 'bg-zinc-200' : 'bg-white border border-zinc-300 text-zinc-600'].join(' ')}>
              {z}
            </button>
          ))}
        </div>
      </div>

      {validTasks.length === 0 ? (
        <div className="p-4 text-sm text-zinc-500">No workflows assigned to this phase yet. Edit the project to add workflows.</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <svg width={Math.max(layout.totalWidth + 200, 500)} height={svgHeight} style={{ display: 'block' }}>
            {todayX >= 0 && todayX <= layout.totalWidth + 200 && (
              <line x1={200 + todayX} y1={0} x2={200 + todayX} y2={svgHeight} stroke="#dc2626" strokeWidth={1} strokeDasharray="4 2" />
            )}

            {rows.map((row, i) => {
              const y = HEADER_HEIGHT + i * ROW_HEIGHT
              if (row.kind === 'workflow') {
                return (
                  <g key={row.workflow.id}>
                    <rect x={0} y={y} width={Math.max(layout.totalWidth + 200, 500)} height={ROW_HEIGHT} fill="#f4f4f5" />
                    <text x={6} y={y + 15} fontSize="12" fontWeight="600" fill="#27272a">▸ {row.workflow.name}</text>
                  </g>
                )
              }
              const t = row.task
              const bar = taskXById.get(t.id)
              if (!bar) return <text key={t.id} x={20} y={y + 15} fontSize="11" fill="#71717a">{t.name} (no schedule)</text>
              const fill = t.isUnplanned ? '#fee2e2' : '#93c5fd'
              const stroke = t.isOnCriticalPath ? '#dc2626' : 'none'

              return (
                <g key={t.id} onClick={() => openTask(t.id)} style={{ cursor: 'pointer' }}>
                  <text x={20} y={y + 15} fontSize="11" fill="#3f3f46">{t.name}</text>
                  <rect x={200 + bar.x} y={y + 5} width={bar.width} height={ROW_HEIGHT - 10}
                        fill={fill} stroke={stroke} strokeWidth={t.isOnCriticalPath ? 2 : 0} rx={2} />
                  {t.actualStartDay !== null && (
                    <rect x={200 + (t.actualStartDay - minDay) * layout.dayWidth} y={y + 8}
                          width={((t.actualEndDay ?? todayDayOffset) - t.actualStartDay) * layout.dayWidth}
                          height={ROW_HEIGHT - 16} fill="#1e40af" opacity={0.7} rx={2} />
                  )}
                </g>
              )
            })}

            {zoom !== 'quarter' && taskDeps.map((d, i) => {
              const fromBar = taskXById.get(d.fromTaskId)
              const toBar = taskXById.get(d.toTaskId)
              if (!fromBar || !toBar) return null
              const fromIdx = rows.findIndex(r => r.kind === 'task' && r.task.id === d.fromTaskId)
              const toIdx = rows.findIndex(r => r.kind === 'task' && r.task.id === d.toTaskId)
              if (fromIdx === -1 || toIdx === -1) return null
              const fy = HEADER_HEIGHT + fromIdx * ROW_HEIGHT + ROW_HEIGHT / 2
              const ty = HEADER_HEIGHT + toIdx * ROW_HEIGHT + ROW_HEIGHT / 2
              const fx = 200 + fromBar.x + fromBar.width
              const tx = 200 + toBar.x
              return (
                <path key={i} d={`M${fx} ${fy} L${fx + 4} ${fy} L${fx + 4} ${ty} L${tx - 2} ${ty}`}
                      stroke="#a1a1aa" strokeWidth={1} fill="none" markerEnd="url(#arrow)" />
              )
            })}

            <defs>
              <marker id="arrow" viewBox="0 0 8 8" refX="6" refY="4" markerWidth="6" markerHeight="6" orient="auto">
                <path d="M0 0 L8 4 L0 8 Z" fill="#a1a1aa" />
              </marker>
            </defs>
          </svg>
        </div>
      )}
    </div>
  )
}
