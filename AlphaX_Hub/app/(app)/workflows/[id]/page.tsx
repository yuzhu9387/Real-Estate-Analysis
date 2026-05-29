import Link from 'next/link'
import { eq } from 'drizzle-orm'
import { notFound, redirect } from 'next/navigation'
import { requireUser } from '@/lib/server/get-current-user'
import { db } from '@/db/client'
import {
  workflowTemplates,
  workflowTemplateTasks,
  workflowTemplateTaskDeps,
  users,
} from '@/db/schema'
import { DuplicatePrompt } from '@/components/workflows/duplicate-prompt'
import {
  formatProductType,
  productTypeGroup,
} from '@/lib/workflows/product-types'

export default async function WorkflowDetailPage({ params }: { params: { id: string } }) {
  const me = await requireUser()
  if (me.role !== 'owner') redirect('/')

  const tpl = (
    await db.select().from(workflowTemplates).where(eq(workflowTemplates.id, params.id))
  )[0]
  if (!tpl) notFound()
  const tasks = (
    await db
      .select()
      .from(workflowTemplateTasks)
      .where(eq(workflowTemplateTasks.workflowTemplateId, tpl.id))
  ).sort((a, b) => a.sortOrder - b.sortOrder)
  const deps = await db
    .select()
    .from(workflowTemplateTaskDeps)
    .where(eq(workflowTemplateTaskDeps.workflowTemplateId, tpl.id))
  const creator = (await db.select().from(users).where(eq(users.id, tpl.createdById)))[0]

  const depsByTo = new Map<string, string[]>()
  for (const d of deps) {
    if (!depsByTo.has(d.toTaskId)) depsByTo.set(d.toTaskId, [])
    depsByTo.get(d.toTaskId)!.push(d.fromTaskId)
  }
  const taskNameById = new Map(tasks.map((t) => [t.id, t.name]))

  return (
    <div className="space-y-xl max-w-[1240px] pt-md">
      <div className="flex flex-col gap-sm md:flex-row md:items-center">
        <Link
          href="/workflows"
          className="inline-flex items-center gap-xs text-body-sm font-semibold text-primary hover:underline"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          Back to Workflow Templates
        </Link>
        <div className="md:ml-auto flex flex-wrap items-center gap-xs">
          {!tpl.isArchived && (
            <Link
              href={`/workflows/${tpl.id}/edit`}
              className="inline-flex h-9 items-center gap-xs rounded-lg border border-outline-variant/40 bg-white px-sm text-body-sm font-semibold text-on-surface-variant hover:border-primary hover:text-primary transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">edit</span>
              Edit
            </Link>
          )}
          <DuplicatePrompt sourceId={tpl.id} sourceName={tpl.name} />
        </div>
      </div>

      <div>
        <div className="flex flex-wrap items-center gap-sm mb-xs">
          <h1 className="font-headline-lg text-headline-lg tracking-tight text-on-surface">
            {tpl.name}
          </h1>
          {tpl.isArchived ? (
            <span className="inline-flex items-center h-[22px] px-sm rounded-full border border-outline-variant/40 bg-surface-container text-[10px] font-bold uppercase tracking-wide text-outline">
              Archived
            </span>
          ) : (
            <span className="inline-flex items-center h-[22px] px-sm rounded-full border border-secondary/20 bg-secondary/10 text-[10px] font-bold uppercase tracking-wide text-secondary">
              Active
            </span>
          )}
          {tpl.productType && (
            <span
              className="inline-flex items-center h-[22px] px-sm rounded-full border border-tertiary/30 bg-tertiary/10 text-tertiary text-[10px] font-bold uppercase tracking-wide"
              title={formatProductType(tpl.productType)}
            >
              {productTypeGroup(tpl.productType)}
            </span>
          )}
        </div>
        {tpl.productType && (
          <p className="text-body-sm text-on-surface-variant mt-xs">
            <span className="text-label-caps font-label-caps text-outline tracking-widest">
              Product Type
            </span>
            <span className="ml-sm text-on-surface font-semibold">
              {formatProductType(tpl.productType)}
            </span>
          </p>
        )}
        {tpl.description && (
          <p className="text-body-md text-on-surface-variant mt-xs">{tpl.description}</p>
        )}
      </div>

      <div className="rounded-xl border border-outline-variant/30 bg-white px-lg py-md shadow-sm flex flex-wrap items-center gap-md text-body-sm">
        <span className="text-label-caps font-label-caps text-outline tracking-widest">
          Workflow Schedule
        </span>
        {tasks.length === 0 ? (
          <span className="text-on-surface-variant">No tasks.</span>
        ) : (
          <div className="flex flex-wrap items-center gap-md font-data-display">
            <ScheduleStat label="START" value={`day ${tpl.totalStartDay}`} />
            <ScheduleStat label="END" value={`day ${tpl.totalEndDay}`} />
            <ScheduleStat
              label="DURATION"
              value={`${tpl.totalDurationDays}d`}
              accent="primary"
            />
            <ScheduleStat label="TASKS" value={`${tasks.length}`} />
          </div>
        )}
      </div>

      <section className="rounded-xl border border-outline-variant/30 bg-white p-lg shadow-sm">
        <h2 className="font-headline-md text-headline-md text-on-surface mb-md">
          Tasks ({tasks.length})
        </h2>
        {tasks.length === 0 ? (
          <div className="text-body-sm text-on-surface-variant">No tasks yet.</div>
        ) : (
          <ol className="space-y-sm">
            {tasks.map((t, i) => {
              const upstreamIds = depsByTo.get(t.id) ?? []
              return (
                <li
                  key={t.id}
                  className="rounded-lg border border-outline-variant/20 bg-surface-container-low/50 px-md py-sm"
                >
                  <div className="flex flex-wrap items-center gap-sm text-body-sm">
                    <span className="font-data-display text-outline w-7 text-right">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span className="flex-1 font-semibold text-on-surface min-w-0">{t.name}</span>
                    <span className="font-data-display text-body-sm text-on-surface-variant">
                      day {t.defaultStartDay}–{t.defaultEndDay}
                      <span className="text-outline">
                        {' · '}
                        {t.defaultEndDay - t.defaultStartDay}d
                      </span>
                    </span>
                    {t.defaultOwnerRoleLabel && (
                      <span className="inline-flex items-center h-6 px-sm rounded-full bg-surface-container text-[11px] font-semibold text-on-surface-variant">
                        {t.defaultOwnerRoleLabel}
                      </span>
                    )}
                  </div>
                  {upstreamIds.length > 0 && (
                    <div className="ml-[34px] mt-xs flex flex-wrap items-center gap-xs text-body-sm text-on-surface-variant">
                      <span className="text-label-caps font-label-caps text-outline tracking-widest">
                        Depends on
                      </span>
                      {upstreamIds.map((id) => {
                        const name = taskNameById.get(id)
                        if (!name) return null
                        return (
                          <span
                            key={id}
                            className="inline-flex items-center h-6 px-sm rounded-full bg-primary/10 text-[11px] font-semibold text-primary"
                          >
                            {name}
                          </span>
                        )
                      })}
                    </div>
                  )}
                </li>
              )
            })}
          </ol>
        )}
      </section>

      <div className="text-body-sm text-on-surface-variant">
        Created by <strong className="text-on-surface">{creator?.name ?? 'Unknown'}</strong>{' '}
        <span className="text-outline">·</span> {tpl.createdAt.toLocaleDateString()}
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
