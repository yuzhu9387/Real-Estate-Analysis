import { requireUser } from '@/lib/server/get-current-user'
import { Avatar } from '@/components/shared/avatar'
import { DigestOptOutForm } from './digest-opt-out-form'

export default async function SettingsMePage() {
  const me = await requireUser()
  return (
    <div className="space-y-4 max-w-2xl">
      <h1 className="text-2xl font-semibold">My Settings</h1>
      <div className="rounded-lg border border-zinc-200 bg-white p-4 flex items-center gap-3">
        <Avatar user={me} size="lg" />
        <div>
          <div className="font-medium">{me.name}</div>
          <div className="text-sm text-zinc-600">{me.email ?? '—'}</div>
          <div className="text-xs text-zinc-500 mt-1">Role: {me.role} · Team: {me.team ?? '—'}</div>
        </div>
      </div>
      <DigestOptOutForm initialOptedOut={me.larkDigestOptedOut} />
    </div>
  )
}
