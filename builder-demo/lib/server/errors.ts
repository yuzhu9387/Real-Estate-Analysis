export class AppError extends Error {
  constructor(message: string, public readonly httpStatus: number) {
    super(message)
  }
}
export class UnauthorizedError extends AppError { constructor(m = 'Unauthorized') { super(m, 401) } }
export class ForbiddenError extends AppError { constructor(m = 'Forbidden') { super(m, 403) } }
export class NotFoundError extends AppError { constructor(target = 'Resource') { super(`${target} not found`, 404) } }
export class ValidationError extends AppError {
  constructor(m = 'Validation failed', public readonly fields?: Record<string, string>) { super(m, 400) }
}
export class ProjectLockedError extends AppError {
  constructor(status: string, m = `Project is locked (status: ${status})`) { super(m, 409) }
}
export class InvalidTransitionError extends AppError {
  constructor(from: string, to: string) { super(`Invalid transition: ${from} → ${to}`, 409) }
}
export class ConflictError extends AppError { constructor(m = 'Conflict') { super(m, 409) } }
