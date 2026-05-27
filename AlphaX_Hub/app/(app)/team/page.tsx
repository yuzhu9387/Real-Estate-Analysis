import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/server/get-current-user'

export default async function TeamIndexPage() {
  const me = await requireUser()
  const teamRoute = me.team ?? 'design'
  redirect(`/team/${teamRoute}`)
}
