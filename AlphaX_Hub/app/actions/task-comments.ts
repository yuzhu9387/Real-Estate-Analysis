'use server'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { eq } from 'drizzle-orm'
import { db } from '@/db/client'
import { tasks, projects, taskComments } from '@/db/schema'
import { requirePermission } from '@/lib/server/require-permission'
import { NotFoundError } from '@/lib/server/errors'

export async function addTaskComment(raw: unknown) {
  const input = z.object({
    taskId: z.string().uuid(),
    body: z.string().min(1),
    kind: z.enum(['discussion','review_request','review_approve','review_revision']).default('discussion'),
  }).parse(raw)

  const taskRows = await db.select().from(tasks).where(eq(tasks.id, input.taskId))
  if (taskRows.length === 0) throw new NotFoundError('Task')
  const projRows = await db.select().from(projects).where(eq(projects.id, taskRows[0].projectId))
  const project = projRows[0]
  const user = await requirePermission({
    type: 'task.add_comment',
    project: { pmId: project.pmId, status: project.status },
    task: { ownerId: taskRows[0].ownerId, reviewerId: taskRows[0].reviewerId },
  })

  await db.insert(taskComments).values({
    taskId: input.taskId, authorId: user.id, body: input.body, kind: input.kind,
  })
  revalidatePath(`/projects/${project.id}`)
  return { ok: true }
}
