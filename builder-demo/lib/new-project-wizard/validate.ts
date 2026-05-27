export type Assignment = {
  id: string
  phase: 'Permitting' | 'Construction' | 'Sale'
  templateId: string
  templateName: string
  sortOrder: number
}

export type WizardState = {
  name: string
  brand: 'al_homes' | 'alera' | 'apex'
  city: string
  state: string
  targetExitYear: number
  targetExitQuarter: 1 | 2 | 3 | 4
  assignments: Assignment[]
}

export type ValidationError = 'name' | 'city' | 'state' | 'exit_quarter_format' | 'permitting_empty'

const VALIDATION_MESSAGES: Record<ValidationError, string> = {
  name: 'Name is required',
  city: 'City is required',
  state: 'State is required',
  exit_quarter_format: 'Target exit quarter must be within the next few years',
  permitting_empty: 'Permitting needs at least one workflow',
}

export function validationMessage(err: ValidationError): string {
  return VALIDATION_MESSAGES[err]
}

export function validateWizard(state: WizardState): ValidationError | null {
  if (!state.name.trim()) return 'name'
  if (!state.city.trim()) return 'city'
  if (!state.state.trim()) return 'state'
  if (!Number.isInteger(state.targetExitQuarter) ||
      state.targetExitQuarter < 1 || state.targetExitQuarter > 4) {
    return 'exit_quarter_format'
  }
  if (state.targetExitYear < 2020 || state.targetExitYear > 2099) {
    return 'exit_quarter_format'
  }
  if (!state.assignments.some(a => a.phase === 'Permitting')) {
    return 'permitting_empty'
  }
  return null
}
