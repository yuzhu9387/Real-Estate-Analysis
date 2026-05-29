'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { EditorHeader } from './editor-header'
import { DraftBanner } from './draft-banner'
import { TaskList } from './task-list'
import { hasCycle } from '@/lib/workflow-editor/has-cycle'
import { computeTotals } from '@/lib/workflow-editor/compute-totals'
import {
  saveDraft, loadDraft, clearDraft, NEW_MODE_KEY,
  type Draft, type DraftTask,
} from '@/lib/workflow-editor/draft-storage'
import { useLeavePrompt } from '@/lib/workflow-editor/use-leave-prompt'
import {
  createWorkflowTemplate, updateWorkflowTemplate,
  archiveWorkflowTemplate, unarchiveWorkflowTemplate,
} from '@/app/actions/workflows'
import {
  PRODUCT_TYPES,
  PRODUCT_TYPE_LABELS,
  productTypeGroup,
  type ProductType,
} from '@/lib/workflows/product-types'

type Mode = 'new' | 'edit'

export function EditorShell({
  mode, templateId, initial, serverUpdatedAt, isArchived,
}: {
  mode: Mode
  templateId: string | null
  initial: Draft
  serverUpdatedAt: string | null
  isArchived: boolean
}) {
  const router = useRouter()
  const draftKeyId = templateId ?? NEW_MODE_KEY
  const [state, setState] = useState<Draft>(initial)
  const [isSaving, setSaving] = useState(false)
  const [errorBanner, setErrorBanner] = useState<string | null>(null)
  const [draftToOffer, setDraftToOffer] = useState<Draft | null>(null)
  const lastSavedRef = useRef<Draft>(initial)

  useEffect(() => {
    const d = loadDraft(draftKeyId)
    if (!d) return
    if (serverUpdatedAt && new Date(d.savedAt) <= new Date(serverUpdatedAt)) {
      clearDraft(draftKeyId)
      return
    }
    setDraftToOffer(d)
  }, [draftKeyId, serverUpdatedAt])

  useEffect(() => {
    if (state === lastSavedRef.current) return
    saveDraft(draftKeyId, { ...state, savedAt: new Date().toISOString() })
  }, [state, draftKeyId])

  const isDirty = JSON.stringify(state) !== JSON.stringify(lastSavedRef.current)
  useLeavePrompt(isDirty)

  const totals = useMemo(
    () => computeTotals(state.tasks.map(t => ({ startDay: t.startDay, endDay: t.endDay }))),
    [state.tasks],
  )

  const violations = useMemo(() => {
    const taskById = new Map(state.tasks.map(t => [t.id, t]))
    return state.deps
      .map(d => ({
        pred: taskById.get(d.fromTaskId),
        succ: taskById.get(d.toTaskId),
      }))
      .filter(({ pred, succ }) => pred && succ && succ.startDay < pred.endDay)
      .map(({ pred, succ }) => ({ predName: pred!.name || '(unnamed)', succName: succ!.name || '(unnamed)' }))
  }, [state.tasks, state.deps])

  function patch(next: Partial<Draft>) {
    setState(s => ({ ...s, ...next }))
  }
  function reorderTasks(newOrder: DraftTask[]) { patch({ tasks: newOrder }) }
  function changeTask(taskId: string, p: Partial<DraftTask>) {
    patch({ tasks: state.tasks.map(t => t.id === taskId ? { ...t, ...p } : t) })
  }
  function deleteTask(taskId: string) {
    patch({
      tasks: state.tasks.filter(t => t.id !== taskId)
        .map((t, i) => ({ ...t, sortOrder: i })),
      deps: state.deps.filter(d => d.fromTaskId !== taskId && d.toTaskId !== taskId),
    })
  }
  function addTask() {
    const id = `new-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    const startDay = state.tasks.length === 0
      ? 1
      : Math.max(...state.tasks.map(t => t.endDay))
    patch({
      tasks: [...state.tasks, {
        id, name: '', description: '',
        startDay, endDay: startDay,
        ownerRoleLabel: '', sortOrder: state.tasks.length,
      }],
    })
  }
  function addDep(taskId: string, upstreamTaskId: string) {
    if (state.deps.some(d => d.toTaskId === taskId && d.fromTaskId === upstreamTaskId)) return
    const id = `dep-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    const newDeps = [...state.deps, { id, fromTaskId: upstreamTaskId, toTaskId: taskId, lagDays: 0 }]
    // Auto-suggest: shift successor start to max(predecessor.endDay + lag) for all current preds (incl. the new one).
    const target = state.tasks.find(t => t.id === taskId)
    if (!target) { patch({ deps: newDeps }); return }
    const newPredEnds = newDeps
      .filter(d => d.toTaskId === taskId)
      .map(d => {
        const p = state.tasks.find(t => t.id === d.fromTaskId)
        return p ? p.endDay + d.lagDays : 0
      })
    const newStart = Math.max(...newPredEnds, 1)
    const duration = target.endDay - target.startDay
    patch({
      tasks: state.tasks.map(t =>
        t.id === taskId ? { ...t, startDay: newStart, endDay: newStart + duration } : t
      ),
      deps: newDeps,
    })
  }
  function removeDep(taskId: string, upstreamTaskId: string) {
    patch({ deps: state.deps.filter(d => !(d.toTaskId === taskId && d.fromTaskId === upstreamTaskId)) })
  }

  function validate(): string | null {
    if (!state.name.trim()) return 'Name is required'
    if (!state.productType) return 'Product type is required'
    if (state.tasks.length === 0) return 'At least one task is required'
    if (state.tasks.some(t => !t.name.trim())) return 'Every task needs a name'
    if (state.tasks.some(t => !Number.isInteger(t.startDay) || t.startDay < 1))
      return 'Every task needs a start day >= 1'
    if (state.tasks.some(t => !Number.isInteger(t.endDay) || t.endDay < t.startDay))
      return 'End day cannot be before start day'
    const cycleInput = {
      tasks: state.tasks.map(t => ({ id: t.id })),
      deps: state.deps.map(d => ({ fromId: d.fromTaskId, toId: d.toTaskId })),
    }
    if (hasCycle(cycleInput)) return 'Dependencies form a cycle'
    return null
  }

  async function onSave() {
    const err = validate()
    if (err) { setErrorBanner(err); return }
    setErrorBanner(null); setSaving(true)
    try {
      const taskIndexById = new Map(state.tasks.map((t, i) => [t.id, i]))
      const payload = {
        name: state.name,
        description: state.description || null,
        productType: state.productType,
        tasks: state.tasks.map(t => ({
          name: t.name, description: t.description || null,
          startDay: t.startDay, endDay: t.endDay,
          ownerRoleLabel: t.ownerRoleLabel || null,
        })),
        deps: state.deps.map(d => ({
          fromIdx: taskIndexById.get(d.fromTaskId)!,
          toIdx: taskIndexById.get(d.toTaskId)!,
          lagDays: d.lagDays,
        })),
      }
      let finalId = templateId
      if (mode === 'new') {
        const res = await createWorkflowTemplate(payload) as { ok: true; id: string }
        finalId = res.id
      } else {
        await updateWorkflowTemplate({ id: templateId!, ...payload })
      }
      clearDraft(draftKeyId)
      lastSavedRef.current = state
      router.push(`/workflows/${finalId}`)
    } catch (e) {
      setErrorBanner(e instanceof Error ? e.message : 'Save failed')
    } finally { setSaving(false) }
  }

  function onCancel() {
    if (isDirty && !window.confirm('Discard changes?')) return
    clearDraft(draftKeyId)
    router.push(mode === 'edit' ? `/workflows/${templateId}` : '/workflows')
  }

  async function onArchive() {
    if (!templateId) return
    if (!window.confirm("Archive this template? Existing projects are unaffected; new projects won't see it in the picker.")) return
    await archiveWorkflowTemplate({ id: templateId })
    clearDraft(draftKeyId)
    router.push('/workflows')
  }

  async function onRestore() {
    if (!templateId) return
    await unarchiveWorkflowTemplate({ id: templateId })
    router.refresh()
  }

  return (
    <div className="space-y-xl max-w-[1240px] pt-md">
      <EditorHeader
        mode={mode} isArchived={isArchived} isDirty={isDirty} isSaving={isSaving}
        errorBanner={errorBanner}
        onSave={onSave} onCancel={onCancel} onArchive={onArchive} onRestore={onRestore}
      />
      {draftToOffer && (
        <DraftBanner
          savedAt={draftToOffer.savedAt}
          onRestore={() => { setState(draftToOffer); setDraftToOffer(null) }}
          onDiscard={() => { clearDraft(draftKeyId); setDraftToOffer(null) }}
        />
      )}
      <div className="space-y-lg">
        {/* General Information panel */}
        <section className="rounded-xl border border-outline-variant/30 bg-white shadow-sm overflow-hidden">
          <header className="flex items-center gap-sm px-lg py-md border-b border-outline-variant/30 bg-surface-container-low/40">
            <span className="material-symbols-outlined text-primary text-[18px]">info</span>
            <span className="text-label-caps font-label-caps text-on-surface tracking-widest">
              General Information
            </span>
          </header>
          <div className="p-lg space-y-md">
            <label className="block">
              <span className="block mb-xs text-label-caps font-label-caps text-outline tracking-widest">
                Template name
              </span>
              <input
                value={state.name}
                onChange={(e) => patch({ name: e.target.value })}
                placeholder={mode === 'new' ? 'Untitled template' : 'Template name'}
                className="w-full font-headline-md text-headline-md text-on-surface bg-white rounded-lg border border-outline-variant/40 outline-none px-md py-sm focus:border-primary transition-colors placeholder:text-outline/60"
              />
            </label>
            <label className="block">
              <span className="block mb-xs text-label-caps font-label-caps text-outline tracking-widest">
                Description
                <span className="ml-xs text-outline normal-case tracking-normal font-normal">
                  (optional)
                </span>
              </span>
              <textarea
                value={state.description}
                onChange={(e) => patch({ description: e.target.value })}
                placeholder="Short one-line description so the team knows when to use this template…"
                rows={2}
                className="w-full text-body-md text-on-surface bg-white rounded-lg border border-outline-variant/40 outline-none px-md py-sm focus:border-primary transition-colors placeholder:text-outline/60 resize-y min-h-[64px]"
              />
            </label>

            <label className="block">
              <span className="block mb-xs text-label-caps font-label-caps text-outline tracking-widest">
                Product Type
                <span className="ml-xs text-error normal-case tracking-normal font-normal">
                  (required)
                </span>
              </span>
              <select
                value={state.productType ?? ''}
                onChange={(e) =>
                  patch({ productType: (e.target.value || null) as ProductType | null })
                }
                className="glacier-select h-10 w-full rounded-lg border border-outline-variant/40 bg-white px-md text-body-sm text-on-surface focus:outline-none focus:border-primary transition-colors"
              >
                <option value="">— Select the project type this workflow applies to —</option>
                {(['ADU', 'Alera', 'AL Homes'] as const).map((group) => (
                  <optgroup key={group} label={group}>
                    {PRODUCT_TYPES.filter((t) => productTypeGroup(t) === group).map((t) => (
                      <option key={t} value={t}>
                        {PRODUCT_TYPE_LABELS[t]}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>
          </div>
        </section>

        {/* Workflow Schedule strip — acts as a divider/summary between sections */}
        <div className="rounded-xl border border-outline-variant/30 bg-white px-lg py-md shadow-sm flex flex-wrap items-center gap-md text-body-sm">
          <span className="text-label-caps font-label-caps text-outline tracking-widest">
            Workflow Schedule
          </span>
          {state.tasks.length === 0 ? (
            <span className="text-on-surface-variant">Add a task to see the schedule.</span>
          ) : (
            <div className="flex flex-wrap items-center gap-md font-data-display">
              <ScheduleStat label="START" value={`day ${totals.totalStartDay}`} />
              <ScheduleStat label="END" value={`day ${totals.totalEndDay}`} />
              <ScheduleStat label="DURATION" value={`${totals.totalDurationDays}d`} accent="primary" />
              <ScheduleStat label="TASKS" value={`${state.tasks.length}`} />
            </div>
          )}
        </div>

        {/* Tasks panel */}
        <section className="rounded-xl border border-outline-variant/30 bg-white shadow-sm overflow-hidden">
          <header className="flex items-center justify-between gap-sm px-lg py-md border-b border-outline-variant/30 bg-surface-container-low/40">
            <div className="flex items-center gap-sm min-w-0">
              <span className="material-symbols-outlined text-primary text-[18px]">checklist</span>
              <span className="text-label-caps font-label-caps text-on-surface tracking-widest">
                Tasks
              </span>
              <span className="text-body-sm text-on-surface-variant">
                ({state.tasks.length} {state.tasks.length === 1 ? 'task' : 'tasks'}
                {violations.length > 0 ? `, ${violations.length} issue${violations.length === 1 ? '' : 's'}` : ''})
              </span>
            </div>
            <button
              type="button"
              onClick={addTask}
              className="inline-flex h-8 items-center gap-xs rounded-lg border border-outline-variant/40 bg-white px-sm text-body-sm font-semibold text-on-surface-variant hover:border-primary hover:text-primary transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">add</span>
              Add Task
            </button>
          </header>

          <div className="p-lg space-y-sm">
            {violations.length > 0 && (
              <div className="flex items-start gap-xs rounded-lg border border-error/20 bg-error/5 px-md py-sm text-body-sm text-error">
                <span className="material-symbols-outlined text-[18px]">warning</span>
                <span>
                  {violations.length === 1
                    ? <>Task <strong>&ldquo;{violations[0].succName}&rdquo;</strong> starts before its dependency <strong>&ldquo;{violations[0].predName}&rdquo;</strong> ends.</>
                    : <><strong>{violations.length}</strong> tasks start before their dependencies end.</>}
                </span>
              </div>
            )}
            <TaskList
              tasks={state.tasks}
              deps={state.deps}
              onReorder={reorderTasks}
              onChangeTask={changeTask}
              onDeleteTask={deleteTask}
              onAddDep={addDep}
              onRemoveDep={removeDep}
              onAddTask={addTask}
            />
          </div>
        </section>
      </div>
    </div>
  )
}

function ScheduleStat({
  label,
  value,
  accent,
}: {
  label: string
  value: string
  accent?: 'primary'
}) {
  return (
    <div className="flex items-center gap-xs">
      <span className="text-label-caps font-label-caps text-outline tracking-widest">{label}</span>
      <span
        className={[
          'font-data-display text-on-surface',
          accent === 'primary' ? 'text-primary font-semibold' : '',
        ].join(' ')}
      >
        {value}
      </span>
    </div>
  )
}
