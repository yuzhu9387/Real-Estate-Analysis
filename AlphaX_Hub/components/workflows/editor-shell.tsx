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
    <div>
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
      <div className="space-y-3">
        <input value={state.name} onChange={(e) => patch({ name: e.target.value })}
          placeholder="Template name"
          className="w-full text-xl font-semibold border-b border-zinc-200 outline-none px-1 py-1 focus:border-blue-400" />
        <input value={state.description} onChange={(e) => patch({ description: e.target.value })}
          placeholder="One-line description (optional)"
          className="w-full text-sm border-b border-zinc-200 outline-none px-1 py-1 focus:border-blue-400" />

        <div className="rounded border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm flex items-center gap-4">
          <span className="text-zinc-500 font-medium">Workflow schedule:</span>
          {state.tasks.length === 0 ? (
            <span className="text-zinc-500">Add a task to see the schedule.</span>
          ) : (
            <>
              <span>Start: day {totals.totalStartDay}</span>
              <span>·</span>
              <span>End: day {totals.totalEndDay}</span>
              <span>·</span>
              <span>Duration: {totals.totalDurationDays} days</span>
              <span>·</span>
              <span>{state.tasks.length} tasks</span>
            </>
          )}
        </div>

        {violations.length > 0 && (
          <div className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {violations.length === 1
              ? `Task "${violations[0].succName}" starts before its dependency "${violations[0].predName}" ends.`
              : `${violations.length} tasks start before their dependencies end.`}
          </div>
        )}

        <h2 className="text-sm font-semibold text-zinc-700 mt-4">Tasks</h2>
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
    </div>
  )
}
