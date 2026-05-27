'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createProject } from '@/app/actions/projects'
import { validateWizard, validationMessage, type WizardState, type Assignment } from '@/lib/new-project-wizard/validate'
import { WorkflowPhaseRow } from './workflow-phase-row'

const CURRENT_YEAR = new Date().getFullYear()
const YEARS = [CURRENT_YEAR, CURRENT_YEAR + 1, CURRENT_YEAR + 2, CURRENT_YEAR + 3]
const QUARTERS: Array<1 | 2 | 3 | 4> = [1, 2, 3, 4]

let assignmentSeq = 0
function nextAssignmentId(): string {
  assignmentSeq++
  return `a-${Date.now()}-${assignmentSeq}`
}

export function NewProjectForm({
  templates,
}: {
  templates: Array<{ id: string; name: string }>
}) {
  const router = useRouter()
  const [state, setState] = useState<WizardState>({
    name: '', brand: 'al_homes', city: '', state: '',
    targetExitYear: CURRENT_YEAR + 1,
    targetExitQuarter: 1,
    assignments: [],
  })
  const [busy, setBusy] = useState(false)
  const [errorBanner, setErrorBanner] = useState<string | null>(null)

  const validation = validateWizard(state)

  function patch(p: Partial<WizardState>) {
    setState(s => ({ ...s, ...p }))
  }

  function addAssignment(phase: Assignment['phase'], templateId: string, templateName: string) {
    const existingInPhase = state.assignments.filter(a => a.phase === phase)
    const newAssignment: Assignment = {
      id: nextAssignmentId(),
      phase, templateId, templateName,
      sortOrder: existingInPhase.length,
    }
    patch({ assignments: [...state.assignments, newAssignment] })
  }

  function removeAssignment(assignmentId: string) {
    const removed = state.assignments.find(a => a.id === assignmentId)
    if (!removed) return
    const remaining = state.assignments.filter(a => a.id !== assignmentId)
    const renumbered = remaining.map(a => {
      if (a.phase !== removed.phase) return a
      const siblings = remaining.filter(x => x.phase === a.phase)
      const newSortOrder = siblings.findIndex(x => x.id === a.id)
      return { ...a, sortOrder: newSortOrder }
    })
    patch({ assignments: renumbered })
  }

  function reorderPhase(phase: Assignment['phase'], newOrder: Assignment[]) {
    const others = state.assignments.filter(a => a.phase !== phase)
    patch({ assignments: [...others, ...newOrder] })
  }

  function assignmentsForPhase(phase: Assignment['phase']): Assignment[] {
    return state.assignments
      .filter(a => a.phase === phase)
      .sort((a, b) => a.sortOrder - b.sortOrder)
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrorBanner(null)
    const err = validateWizard(state)
    if (err) { setErrorBanner(validationMessage(err)); return }

    setBusy(true)
    try {
      const payload = {
        name: state.name,
        brand: state.brand,
        city: state.city,
        state: state.state,
        targetExitQuarter: `${state.targetExitYear}-Q${state.targetExitQuarter}`,
        assignments: state.assignments.map(a => ({
          phaseName: a.phase, templateId: a.templateId, sortOrder: a.sortOrder,
        })),
      }
      const res = await createProject(payload) as { ok: true; id: string }
      router.push(`/projects/${res.id}`)
    } catch (e) {
      setErrorBanner(e instanceof Error ? e.message : 'Failed to create project')
    } finally {
      setBusy(false)
    }
  }

  const submitDisabledReason = validation ? validationMessage(validation) : null

  return (
    <form onSubmit={onSubmit} className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold">New Project</h1>

      {errorBanner && (
        <div className="rounded border border-red-200 bg-red-50 text-red-700 text-sm px-3 py-2">{errorBanner}</div>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-700">Basics</h2>
        <label className="block">
          <span className="text-xs text-zinc-600">Name *</span>
          <input
            value={state.name}
            onChange={(e) => patch({ name: e.target.value })}
            className="mt-1 w-full border border-zinc-300 rounded px-2 py-1 text-sm"
            placeholder="e.g., 9 Greenwood Pl"
          />
        </label>
        <label className="block">
          <span className="text-xs text-zinc-600">Brand *</span>
          <select
            value={state.brand}
            onChange={(e) => patch({ brand: e.target.value as WizardState['brand'] })}
            className="mt-1 w-full border border-zinc-300 rounded px-2 py-1 text-sm">
            <option value="al_homes">Al Homes</option>
            <option value="alera">Alera</option>
            <option value="apex">Apex</option>
          </select>
        </label>
        <div className="grid grid-cols-[1fr_120px] gap-3">
          <label className="block">
            <span className="text-xs text-zinc-600">City *</span>
            <input
              value={state.city}
              onChange={(e) => patch({ city: e.target.value })}
              className="mt-1 w-full border border-zinc-300 rounded px-2 py-1 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-xs text-zinc-600">State *</span>
            <input
              value={state.state}
              onChange={(e) => patch({ state: e.target.value })}
              className="mt-1 w-full border border-zinc-300 rounded px-2 py-1 text-sm"
              placeholder="MA"
            />
          </label>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-700">Targets</h2>
        <label className="block">
          <span className="text-xs text-zinc-600">Target Exit Quarter *</span>
          <div className="mt-1 flex gap-2">
            <select
              value={state.targetExitYear}
              onChange={(e) => patch({ targetExitYear: Number(e.target.value) })}
              className="border border-zinc-300 rounded px-2 py-1 text-sm">
              {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <select
              value={state.targetExitQuarter}
              onChange={(e) => patch({ targetExitQuarter: Number(e.target.value) as 1 | 2 | 3 | 4 })}
              className="border border-zinc-300 rounded px-2 py-1 text-sm">
              {QUARTERS.map(q => <option key={q} value={q}>Q{q}</option>)}
            </select>
          </div>
        </label>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-700">Workflows</h2>
        <WorkflowPhaseRow
          phase="Permitting"
          required
          isError={validation === 'permitting_empty'}
          assignments={assignmentsForPhase('Permitting')}
          availableTemplates={templates}
          onAdd={(id, name) => addAssignment('Permitting', id, name)}
          onRemove={removeAssignment}
          onReorder={(o) => reorderPhase('Permitting', o)}
        />
        <WorkflowPhaseRow
          phase="Construction"
          required={false}
          isError={false}
          assignments={assignmentsForPhase('Construction')}
          availableTemplates={templates}
          onAdd={(id, name) => addAssignment('Construction', id, name)}
          onRemove={removeAssignment}
          onReorder={(o) => reorderPhase('Construction', o)}
        />
        <WorkflowPhaseRow
          phase="Sale"
          required={false}
          isError={false}
          assignments={assignmentsForPhase('Sale')}
          availableTemplates={templates}
          onAdd={(id, name) => addAssignment('Sale', id, name)}
          onRemove={removeAssignment}
          onReorder={(o) => reorderPhase('Sale', o)}
        />
      </section>

      <div className="flex items-center gap-3 pt-2">
        <button
          type="button"
          onClick={() => router.push('/projects')}
          className="px-4 py-2 border border-zinc-300 rounded text-sm hover:bg-zinc-50">
          Cancel
        </button>
        <button
          type="submit"
          disabled={busy || !!validation}
          title={submitDisabledReason ?? undefined}
          className="ml-auto px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded text-sm hover:opacity-90 disabled:opacity-50">
          {busy ? 'Creating…' : 'Create Project'}
        </button>
      </div>
    </form>
  )
}
