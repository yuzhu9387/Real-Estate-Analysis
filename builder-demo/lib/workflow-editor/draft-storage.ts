export type DraftTask = {
  id: string
  name: string
  description: string
  durationDays: number
  ownerRoleLabel: string
  sortOrder: number
}
export type DraftDep = {
  id: string
  fromTaskId: string
  toTaskId: string
  lagDays: number
}
export type Draft = {
  name: string
  description: string
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
    return JSON.parse(raw) as Draft
  } catch {
    return null
  }
}

export function clearDraft(idOrNew: string, storage: Storage = localStorage): void {
  storage.removeItem(draftKey(idOrNew))
}
