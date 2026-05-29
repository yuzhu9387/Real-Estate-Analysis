'use client'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createProject, updateProjectMetadata } from '@/app/actions/projects'
import { cascadeProjectSchedule } from '@/lib/scheduling/project-targets'
import { WorkflowPhaseRow } from './workflow-phase-row'
import type { Assignment } from '@/lib/new-project-wizard/validate'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type ProjectFormMode = 'create' | 'edit'

export type ProjectFormInitial = {
  id?: string
  status?: 'draft' | 'in_progress' | 'complete' | 'archived'
  // Header
  name: string
  brand: 'al_homes' | 'alera' | 'apex'
  // Section 1 — property
  address: string
  city: string
  state: string
  zip: string
  titleHolder: string
  projectStrategy: string
  purchaseDate: string
  purchasePrice: string
  // Section 2 — schedule (inputs)
  targetStartDate: string
  targetPermittingDurationDays: string  // string for input binding; converted on save
  targetConstructionDurationDays: string
  targetSalesDurationDays: string
  // Section 3 — team
  pmId: string
  permittingPmId: string
  constructionPmId: string
  salesPmId: string
}

export type UserOption = { id: string; name: string; role: string; team: string | null }
export type TemplateOption = { id: string; name: string }

let assignmentSeq = 0
function nextAssignmentId(): string {
  assignmentSeq++
  return `a-${Date.now()}-${assignmentSeq}`
}

/* ------------------------------------------------------------------ */
/*  Form                                                               */
/* ------------------------------------------------------------------ */

export function ProjectForm({
  mode,
  initial,
  templates,
  users,
  currentUserId,
}: {
  mode: ProjectFormMode
  initial: ProjectFormInitial
  templates: TemplateOption[]
  /** Eligible PM candidates (pm + owner roles). */
  users: UserOption[]
  currentUserId: string
}) {
  const router = useRouter()
  const [state, setState] = useState<ProjectFormInitial>({
    ...initial,
    pmId: initial.pmId || currentUserId,
  })
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // For non-draft projects, section 1 (deal facts) and section 2 (schedule cascade) are locked.
  // Header (name, brand, address) and section 3 (team) stay editable for the project's lifetime.
  const isDraft = mode === 'create' || initial.status === 'draft'
  const draftDisabled = !isDraft

  // Live cascade preview — runs on every keystroke so the user sees the derived dates.
  const cascade = useMemo(() => cascadeProjectSchedule({
    targetStartDate: state.targetStartDate || null,
    targetPermittingDurationDays: parsePosInt(state.targetPermittingDurationDays),
    targetConstructionDurationDays: parsePosInt(state.targetConstructionDurationDays),
    targetSalesDurationDays: parsePosInt(state.targetSalesDurationDays),
  }), [
    state.targetStartDate, state.targetPermittingDurationDays,
    state.targetConstructionDurationDays, state.targetSalesDurationDays,
  ])

  function patch(p: Partial<ProjectFormInitial>) {
    setState((s) => ({ ...s, ...p }))
  }

  /* ---------------- Workflow assignments (create mode only) ---------- */

  function addAssignment(phase: Assignment['phase'], templateId: string, templateName: string) {
    const existing = assignments.filter((a) => a.phase === phase)
    setAssignments((prev) => [...prev, {
      id: nextAssignmentId(), phase, templateId, templateName, sortOrder: existing.length,
    }])
  }
  function removeAssignment(id: string) {
    const removed = assignments.find((a) => a.id === id)
    if (!removed) return
    const remaining = assignments.filter((a) => a.id !== id)
    const renumbered = remaining.map((a) => {
      if (a.phase !== removed.phase) return a
      const sibs = remaining.filter((x) => x.phase === a.phase)
      return { ...a, sortOrder: sibs.findIndex((x) => x.id === a.id) }
    })
    setAssignments(renumbered)
  }
  function reorderPhase(phase: Assignment['phase'], next: Assignment[]) {
    const others = assignments.filter((a) => a.phase !== phase)
    setAssignments([...others, ...next])
  }
  const assignmentsForPhase = (phase: Assignment['phase']) =>
    assignments.filter((a) => a.phase === phase).sort((a, b) => a.sortOrder - b.sortOrder)

  /* ---------------- Submit ----------------------------------------- */

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!state.name.trim()) return setError('Project name is required.')
    if (!state.pmId) return setError('Project manager is required.')
    if (mode === 'create' && assignments.filter((a) => a.phase === 'Permitting').length === 0) {
      return setError('Permitting needs at least one workflow.')
    }

    const schedulePatch = {
      targetStartDate: emptyToNull(state.targetStartDate),
      targetPermittingDurationDays: parsePosInt(state.targetPermittingDurationDays),
      targetConstructionDurationDays: parsePosInt(state.targetConstructionDurationDays),
      targetSalesDurationDays: parsePosInt(state.targetSalesDurationDays),
    }

    setBusy(true)
    try {
      if (mode === 'create') {
        const payload = {
          name: state.name,
          brand: state.brand,
          address: emptyToNull(state.address),
          city: emptyToNull(state.city),
          state: emptyToNull(state.state),
          zip: emptyToNull(state.zip),
          titleHolder: emptyToNull(state.titleHolder),
          projectStrategy: emptyToNull(state.projectStrategy),
          purchaseDate: emptyToNull(state.purchaseDate),
          purchasePrice: emptyToNull(state.purchasePrice),
          ...schedulePatch,
          pmId: state.pmId,
          permittingPmId: emptyToNull(state.permittingPmId),
          constructionPmId: emptyToNull(state.constructionPmId),
          salesPmId: emptyToNull(state.salesPmId),
          assignments: assignments.map((a) => ({
            phaseName: a.phase, templateId: a.templateId, sortOrder: a.sortOrder,
          })),
        }
        const res = (await createProject(payload)) as { ok: true; id: string }
        router.push(`/projects/${res.id}`)
      } else {
        // Edit mode — patch only what's editable for the current status.
        const patchBody: Record<string, unknown> = {
          name: state.name,
          brand: state.brand,
          address: emptyToNull(state.address),
          city: emptyToNull(state.city),
          state: emptyToNull(state.state),
          zip: emptyToNull(state.zip),
          pmId: state.pmId,
          permittingPmId: emptyToNull(state.permittingPmId),
          constructionPmId: emptyToNull(state.constructionPmId),
          salesPmId: emptyToNull(state.salesPmId),
        }
        if (isDraft) {
          patchBody.titleHolder = emptyToNull(state.titleHolder)
          patchBody.projectStrategy = emptyToNull(state.projectStrategy)
          patchBody.purchaseDate = emptyToNull(state.purchaseDate)
          patchBody.purchasePrice = emptyToNull(state.purchasePrice)
          Object.assign(patchBody, schedulePatch)
        }
        await updateProjectMetadata({ projectId: initial.id!, patch: patchBody })
        router.push(`/projects/${initial.id}`)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setBusy(false)
    }
  }

  /* ---------------- Render ----------------------------------------- */

  const title = mode === 'create' ? 'New Project' : 'Edit Project'
  const cancelHref = mode === 'create' ? '/projects' : `/projects/${initial.id}`

  return (
    <form onSubmit={onSubmit} className="space-y-lg max-w-[1100px] pt-md">
      <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-md">
        <div>
          <Link
            href={cancelHref}
            className="inline-flex items-center gap-xs text-body-sm font-semibold text-primary hover:underline mb-xs"
          >
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            Back
          </Link>
          <h1 className="font-headline-lg text-headline-lg tracking-tight text-on-surface">
            {title}
          </h1>
        </div>
        <div className="flex items-center gap-xs">
          <Link
            href={cancelHref}
            className="inline-flex h-9 items-center gap-xs rounded-lg border border-outline-variant/40 bg-white px-sm text-body-sm font-semibold text-on-surface-variant hover:border-primary hover:text-primary transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={busy}
            className="inline-flex h-9 items-center gap-xs rounded-lg bg-primary px-md text-body-sm font-bold text-white shadow-sm shadow-primary/10 hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="material-symbols-outlined text-[16px]">save</span>
            {busy ? 'Saving…' : mode === 'create' ? 'Create Project' : 'Save Changes'}
          </button>
        </div>
      </header>

      {!isDraft && (
        <div className="flex items-center gap-xs rounded-lg border border-tertiary/30 bg-tertiary/5 px-md py-sm text-body-sm text-tertiary">
          <span className="material-symbols-outlined text-[18px]">info</span>
          <span>This project is already kicked off. Deal facts and the schedule cascade are locked.</span>
        </div>
      )}

      {/* Header fields — name + brand */}
      <Panel title="Basics" icon="badge">
        <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr] gap-md">
          <LabeledInput label="Project name" required>
            <input value={state.name} onChange={(e) => patch({ name: e.target.value })} className={inputCls} placeholder="e.g., 9 Greenwood Pl" required />
          </LabeledInput>
          <LabeledInput label="Brand" required>
            <select value={state.brand} onChange={(e) => patch({ brand: e.target.value as ProjectFormInitial['brand'] })} className={`${inputCls} glacier-select`}>
              <option value="al_homes">AL Homes</option>
              <option value="alera">Alera</option>
              <option value="apex">Apex</option>
            </select>
          </LabeledInput>
        </div>
      </Panel>

      {/* SECTION 1 — Property + deal facts */}
      <Panel title="Property" icon="home_work">
        <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr_120px_140px] gap-md">
          <LabeledInput label="Address">
            <input value={state.address} onChange={(e) => patch({ address: e.target.value })} className={inputCls} placeholder="123 Main St" />
          </LabeledInput>
          <LabeledInput label="City">
            <input value={state.city} onChange={(e) => patch({ city: e.target.value })} className={inputCls} />
          </LabeledInput>
          <LabeledInput label="State">
            <input value={state.state} onChange={(e) => patch({ state: e.target.value })} className={inputCls} maxLength={2} placeholder="CA" />
          </LabeledInput>
          <LabeledInput label="Zip">
            <input value={state.zip} onChange={(e) => patch({ zip: e.target.value })} className={inputCls} />
          </LabeledInput>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-md mt-md">
          <LabeledInput label="Title holder" locked={draftDisabled}>
            <input disabled={draftDisabled} value={state.titleHolder} onChange={(e) => patch({ titleHolder: e.target.value })} className={inputCls} />
          </LabeledInput>
          <LabeledInput label="Strategy" locked={draftDisabled}>
            <input disabled={draftDisabled} value={state.projectStrategy} onChange={(e) => patch({ projectStrategy: e.target.value })} className={inputCls} placeholder="e.g., Flip, Rent, SB9" />
          </LabeledInput>
          <LabeledInput label="Purchase date" locked={draftDisabled}>
            <input type="date" disabled={draftDisabled} value={state.purchaseDate} onChange={(e) => patch({ purchaseDate: e.target.value })} className={inputCls} />
          </LabeledInput>
          <LabeledInput label="Purchase price ($)" locked={draftDisabled}>
            <input disabled={draftDisabled} value={state.purchasePrice} onChange={(e) => patch({ purchasePrice: e.target.value })} className={inputCls} inputMode="decimal" placeholder="850000" />
          </LabeledInput>
        </div>
      </Panel>

      {/* SECTION 2 — Schedule cascade */}
      <Panel title="Schedule" icon="event">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr] gap-md mb-md">
          <LabeledInput label="Target start date" locked={draftDisabled}>
            <input type="date" disabled={draftDisabled} value={state.targetStartDate} onChange={(e) => patch({ targetStartDate: e.target.value })} className={inputCls} />
          </LabeledInput>
          <ReadOnlyDisplay label="Total Duration" value={cascade.targetProjectDurationDays !== null ? `${cascade.targetProjectDurationDays} days` : '—'} icon="timeline" />
        </div>

        <div className="space-y-sm">
          <PhaseDurationRow
            label="Permitting"
            durationField="targetPermittingDurationDays"
            durationValue={state.targetPermittingDurationDays}
            computedDateLabel="Target permitting date"
            computedDate={cascade.targetPermitDate}
            disabled={draftDisabled}
            onChange={(v) => patch({ targetPermittingDurationDays: v })}
          />
          <PhaseDurationRow
            label="Construction"
            durationField="targetConstructionDurationDays"
            durationValue={state.targetConstructionDurationDays}
            computedDateLabel="Target construction finish"
            computedDate={cascade.targetConstructionEndDate}
            disabled={draftDisabled}
            onChange={(v) => patch({ targetConstructionDurationDays: v })}
          />
          <PhaseDurationRow
            label="Sales"
            durationField="targetSalesDurationDays"
            durationValue={state.targetSalesDurationDays}
            computedDateLabel="Target exit date"
            computedDate={cascade.targetExitDate}
            disabled={draftDisabled}
            onChange={(v) => patch({ targetSalesDurationDays: v })}
          />
        </div>
      </Panel>

      {/* SECTION 3 — Team */}
      <Panel title="Team" icon="group">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
          <LabeledInput label="Project Manager" required>
            <UserSelect value={state.pmId} users={users} onChange={(v) => patch({ pmId: v })} placeholder="— pick —" allowEmpty={false} />
          </LabeledInput>
          <LabeledInput label="Permitting PM">
            <UserSelect value={state.permittingPmId} users={users} onChange={(v) => patch({ permittingPmId: v })} placeholder="(uses project PM)" allowEmpty />
          </LabeledInput>
          <LabeledInput label="Construction PM">
            <UserSelect value={state.constructionPmId} users={users} onChange={(v) => patch({ constructionPmId: v })} placeholder="(uses project PM)" allowEmpty />
          </LabeledInput>
          <LabeledInput label="Sales PM">
            <UserSelect value={state.salesPmId} users={users} onChange={(v) => patch({ salesPmId: v })} placeholder="(uses project PM)" allowEmpty />
          </LabeledInput>
        </div>
      </Panel>

      {/* Workflow assignments — create only (post-snapshot they're owned by the editor). */}
      {mode === 'create' && (
        <Panel title="Workflows" icon="checklist">
          <div className="space-y-md">
            <WorkflowPhaseRow
              phase="Permitting"
              required
              isError={assignments.filter((a) => a.phase === 'Permitting').length === 0}
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
          </div>
        </Panel>
      )}

      {error && (
        <div className="flex items-center gap-xs rounded-lg border border-error/20 bg-error/5 px-md py-sm text-body-sm text-error">
          <span className="material-symbols-outlined text-[18px]">error</span>
          {error}
        </div>
      )}
    </form>
  )
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

const inputCls =
  'h-10 w-full rounded-lg border border-outline-variant/40 bg-white px-sm text-body-sm text-on-surface focus:outline-none focus:border-primary transition-colors disabled:bg-surface-container disabled:text-on-surface-variant disabled:cursor-not-allowed placeholder:text-outline/60'

function Panel({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-outline-variant/30 bg-white shadow-sm overflow-hidden">
      <header className="flex items-center gap-sm px-lg py-md border-b border-outline-variant/30 bg-surface-container-low/40">
        <span className="material-symbols-outlined text-primary text-[18px]">{icon}</span>
        <span className="text-label-caps font-label-caps text-on-surface tracking-widest">
          {title}
        </span>
      </header>
      <div className="p-lg">{children}</div>
    </section>
  )
}

function LabeledInput({
  label,
  required,
  locked,
  children,
}: {
  label: string
  required?: boolean
  locked?: boolean
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="block mb-xs text-label-caps font-label-caps text-outline tracking-widest">
        {label}
        {required && <span className="ml-xs text-error normal-case tracking-normal font-normal">(required)</span>}
        {locked && <span className="ml-xs text-outline normal-case tracking-normal font-normal italic">(locked after kickoff)</span>}
      </span>
      {children}
    </label>
  )
}

function ReadOnlyDisplay({ label, value, icon }: { label: string; value: string; icon?: string }) {
  return (
    <div className="flex flex-col">
      <span className="block mb-xs text-label-caps font-label-caps text-outline tracking-widest">
        {label}
        <span className="ml-xs text-outline normal-case tracking-normal font-normal italic">(auto)</span>
      </span>
      <div className="h-10 inline-flex items-center gap-xs rounded-lg border border-dashed border-outline-variant/40 bg-surface-container-low/40 px-sm text-body-sm font-data-display text-on-surface">
        {icon && <span className="material-symbols-outlined text-[16px] text-outline">{icon}</span>}
        {value}
      </div>
    </div>
  )
}

function PhaseDurationRow({
  label,
  durationField,
  durationValue,
  computedDateLabel,
  computedDate,
  disabled,
  onChange,
}: {
  label: string
  durationField: string
  durationValue: string
  computedDateLabel: string
  computedDate: string | null
  disabled: boolean
  onChange: (value: string) => void
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-[120px_1fr_1fr] gap-md items-end p-sm rounded-lg border border-outline-variant/20 bg-surface-container-low/30">
      <div className="text-body-md font-bold text-on-surface">{label}</div>
      <LabeledInput label={`${label} duration`} locked={disabled}>
        <input
          type="number"
          min="0"
          step="1"
          disabled={disabled}
          value={durationValue}
          onChange={(e) => onChange(e.target.value)}
          className={`${inputCls} no-spin`}
          placeholder="days"
          name={durationField}
        />
      </LabeledInput>
      <ReadOnlyDisplay label={computedDateLabel} value={computedDate ?? '—'} icon="event_available" />
    </div>
  )
}

function UserSelect({
  value,
  users,
  onChange,
  placeholder,
  allowEmpty,
}: {
  value: string
  users: UserOption[]
  onChange: (id: string) => void
  placeholder: string
  allowEmpty: boolean
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`${inputCls} glacier-select`}
    >
      {allowEmpty && <option value="">{placeholder}</option>}
      {!allowEmpty && !value && <option value="" disabled>{placeholder}</option>}
      {users.map((u) => (
        <option key={u.id} value={u.id}>
          {u.name} — {u.role}
          {u.team ? ` (${u.team})` : ''}
        </option>
      ))}
    </select>
  )
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function emptyToNull(s: string): string | null {
  const trimmed = s.trim()
  return trimmed === '' ? null : trimmed
}

function parsePosInt(s: string | number | null | undefined): number | null {
  if (s === null || s === undefined || s === '') return null
  const n = typeof s === 'number' ? s : Number(s)
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) return null
  return n
}
