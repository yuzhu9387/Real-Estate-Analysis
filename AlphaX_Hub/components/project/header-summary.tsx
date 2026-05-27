import type { Project, User } from '@/db/schema'
import { EditMetadataButton } from './edit-metadata-button'

const STATUS_COLORS: Record<Project['status'], string> = {
  draft: 'text-zinc-600',
  in_progress: 'text-blue-600',
  complete: 'text-emerald-600',
  archived: 'text-zinc-400',
}

const STATUS_LABEL: Record<Project['status'], string> = {
  draft: 'Draft', in_progress: 'In Progress', complete: 'Complete', archived: 'Archived',
}

function formatCurrency(n: string | null): string {
  if (!n) return '—'
  const num = Number(n)
  if (Number.isNaN(num)) return '—'
  return `$${num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function f(v: unknown): string {
  return v == null || v === '' ? '—' : String(v)
}

export function HeaderSummary({ project, pm }: { project: Project; pm: User | undefined }) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4">
      <div className="flex items-baseline gap-3 flex-wrap">
        <strong className="text-xl">{project.name}</strong>
        <span className="text-zinc-500 text-sm">
          {project.city ?? '—'}{project.state ? `, ${project.state}` : ''}
        </span>
        <span className="bg-gradient-to-r from-cyan-500 to-blue-500 text-white text-xs px-2 py-0.5 rounded">
          {project.brand}
        </span>
        <span className={`ml-auto text-sm ${STATUS_COLORS[project.status]}`}>
          ● {STATUS_LABEL[project.status]}
        </span>
        <EditMetadataButton project={project} />
      </div>
      <div className="mt-2 flex gap-4 flex-wrap text-sm text-zinc-600">
        <span>PM: {f(pm?.name)}</span>
        <span>Purchased: {f(project.purchaseDate)} · {formatCurrency(project.purchasePrice)}</span>
        <span>Target Permit: {f(project.targetPermitDate)}</span>
        <span>Target Construction End: {f(project.targetConstructionEndDate)}</span>
        <span>Target Exit: {f(project.targetExitQuarter)}</span>
      </div>
    </section>
  )
}
