export type DraftTask = {
  id: string
  name: string
  description: string
  startDay: number
  endDay: number
  ownerRoleLabel: string
  sortOrder: number
}
export type DraftDep = {
  id: string
  fromTaskId: string
  toTaskId: string
  lagDays: number
}
import type { ProductType } from '@/lib/workflows/product-types'

export type Draft = {
  name: string
  description: string
  productType: ProductType | null
  tasks: DraftTask[]
  deps: DraftDep[]
  savedAt: string
}

export const NEW_MODE_KEY = '__new__'

export function draftKey(idOrNew: string): string {
  return `workflow-draft-${idOrNew}`
}

export function saveDraft(idOrNew: string, draft: Draft, storage: Storage = localStorage): void {
  storage.setItem(draftKey(idOrNew), JSON.stringify(draft))
}

export function loadDraft(idOrNew: string, storage: Storage = localStorage): Draft | null {
  const raw = storage.getItem(draftKey(idOrNew))
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as { tasks?: Array<Record<string, unknown>> }
    // Drop drafts saved before the start/end day shape change.
    if (parsed.tasks?.some(t => !('startDay' in t) || !('endDay' in t))) return null
    return parsed as Draft
  } catch {
    return null
  }
}

export function clearDraft(idOrNew: string, storage: Storage = localStorage): void {
  storage.removeItem(draftKey(idOrNew))
}
