export type ProjectStatus = 'draft' | 'in_progress' | 'complete' | 'archived'

export type CurrentStateInput = {
  status: ProjectStatus
  sold: boolean
  listingDate?: string | null
  presalePhase1Date?: string | null
  presalePhase2Date?: string | null
  presalePhase3Date?: string | null
  phases: Array<{ name: 'Permitting' | 'Construction' | 'Sale'; status: 'pending' | 'in_progress' | 'complete'; sortOrder: number }>
}

export type CurrentStateLabel =
  | 'Draft' | 'Under Permitting' | 'Under Construction'
  | 'Presale Phase 1' | 'Presale Phase 2' | 'Presale Phase 3'
  | 'Listed' | 'Sold' | 'Complete' | 'Archived'

export function deriveCurrentState(input: CurrentStateInput): CurrentStateLabel {
  if (input.status === 'archived') return 'Archived'
  if (input.status === 'complete') return 'Complete'
  if (input.status === 'draft') return 'Draft'

  if (input.sold) return 'Sold'
  if (input.listingDate) return 'Listed'
  if (input.presalePhase3Date) return 'Presale Phase 3'
  if (input.presalePhase2Date) return 'Presale Phase 2'
  if (input.presalePhase1Date) return 'Presale Phase 1'

  const construction = input.phases.find(p => p.name === 'Construction')
  if (construction?.status === 'in_progress') return 'Under Construction'
  const permitting = input.phases.find(p => p.name === 'Permitting')
  if (permitting?.status === 'in_progress') return 'Under Permitting'
  return 'Draft'
}
