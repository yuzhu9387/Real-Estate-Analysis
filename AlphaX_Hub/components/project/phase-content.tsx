import { ActionBar } from './action-bar'
import { GanttChart } from './gantt/gantt-chart'
import { TaskList } from './task-list'
import type { ProjectPageData } from '@/db/queries/project-page'

export function PhaseContent({
  phaseName, data,
}: {
  phaseName: 'Permitting' | 'Construction' | 'Sale'
  data: ProjectPageData
}) {
  const phase = data.phases.find(p => p.name === phaseName)
  if (!phase) return <div className="p-6 text-sm text-zinc-500">Phase not found.</div>

  const phaseWorkflows = data.workflows.filter(w => w.projectPhaseId === phase.id)
  const phaseWorkflowIds = phaseWorkflows.map(w => w.id)
  const phaseTasks = data.tasks.filter(t => phaseWorkflowIds.includes(t.projectWorkflowId))
  const openCount = phaseTasks.filter(t => t.status !== 'complete' && t.status !== 'wont_do').length

  const today = new Date()
  const kickoff = data.project.kickedOffAt ? new Date(data.project.kickedOffAt) : today
  const todayDayOffset = Math.max(0, Math.floor((today.getTime() - kickoff.getTime()) / (24 * 60 * 60 * 1000)))

  const urlSearch = new URLSearchParams()
  urlSearch.set('tab', phaseName.toLowerCase())

  return (
    <div className="space-y-3">
      <ActionBar
        phase={phase}
        project={data.project}
        allPhases={data.phases}
        openTasksInPhase={openCount}
      />
      <GanttChart
        tasks={phaseTasks}
        workflows={phaseWorkflows}
        taskDeps={data.taskDeps.filter(d => phaseTasks.some(t => t.id === d.fromTaskId || t.id === d.toTaskId))}
        todayDayOffset={todayDayOffset}
      />
      <TaskList
        phaseName={phaseName}
        tasks={data.tasks}
        users={data.users}
        project={data.project}
        todayDayOffset={todayDayOffset}
        workflowIds={phaseWorkflowIds}
        urlSearch={urlSearch}
      />
    </div>
  )
}
