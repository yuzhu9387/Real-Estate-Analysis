'use client'
import { useState } from 'react'
import { kickOffPhase, markPhaseComplete } from '@/app/actions/phases'
import type { ProjectPhase } from '@/db/schema'
import { usePermissions } from '@/lib/hooks/use-permissions'
import { phaseActionState } from '@/lib/project-page/phase-action-state'

export function ActionBar({
  phase, project, allPhases, openTasksInPhase,
}: {
  phase: ProjectPhase
  project: { id: string; pmId: string; status: 'draft'|'in_progress'|'complete'|'archived' }
  allPhases: ProjectPhase[]
  openTasksInPhase: number
}) {
  const { can } = usePermissions()
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const earlier = allPhases.filter(p => p.sortOrder < phase.sortOrder)
  const state = phaseActionState(phase, earlier)

  const canKickOff = can({ type: 'project.kick_off_phase', project })
  const canMarkComplete = can({ type: 'project.mark_phase_complete', project })

  const visible = state.visible && (
    state.action === 'kick_off' ? canKickOff : canMarkComplete
  )

  async function perform() {
    setBusy(true)
    setErr(null)
    try {
      if (state.action === 'kick_off') await kickOffPhase({ phaseId: phase.id })
      if (state.action === 'mark_complete') await markPhaseComplete({ phaseId: phase.id })
      setConfirming(false)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'failed')
    } finally { setBusy(false) }
  }

  const PHASE_STATUS_COLORS = {
    pending: 'text-zinc-500',
    in_progress: 'text-blue-600',
    complete: 'text-emerald-600',
  } as const

  return (
    <div className="rounded-lg bg-zinc-100 px-3 py-2 flex items-center gap-3">
      <strong>{phase.name} phase</strong>
      <span className={`text-xs ${PHASE_STATUS_COLORS[phase.status]}`}>● {phase.status.replace('_', ' ')}</span>

      {visible && (
        <button
          onClick={() => {
            if (state.action === 'mark_complete' && openTasksInPhase > 0) setConfirming(true)
            else perform()
          }}
          disabled={!state.enabled || busy}
          title={state.disabledReason ?? undefined}
          className={[
            'ml-auto px-3 py-1.5 rounded text-sm text-white',
            state.enabled ? 'bg-gradient-to-r from-cyan-500 to-blue-500 hover:opacity-90' : 'bg-zinc-300 cursor-not-allowed',
          ].join(' ')}
        >
          {state.label}
        </button>
      )}

      {confirming && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setConfirming(false)}>
          <div className="bg-white rounded-lg p-6 max-w-md" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-semibold">Mark phase complete?</h2>
            <p className="text-sm text-zinc-600 mt-2">
              {openTasksInPhase} task{openTasksInPhase === 1 ? '' : 's'} in this phase still {openTasksInPhase === 1 ? 'has' : 'have'} not finished. Mark complete anyway?
            </p>
            {err && <div className="text-red-600 text-sm mt-2">{err}</div>}
            <div className="flex gap-2 mt-4">
              <button onClick={() => setConfirming(false)} className="border rounded px-3 py-1.5 text-sm">Cancel</button>
              <button onClick={perform} disabled={busy} className="ml-auto bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded px-3 py-1.5 text-sm">Yes, mark complete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
