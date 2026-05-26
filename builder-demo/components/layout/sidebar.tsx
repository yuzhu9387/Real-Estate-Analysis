import Link from 'next/link'
import type { User } from '@/db/schema'

const baseLinks = [
  { href: '/', label: 'Dashboard' },
  { href: '/projects', label: 'Projects' },
  { href: '/my-tasks', label: 'My Tasks' },
  { href: '/team', label: 'Team' },
  { href: '/performance', label: 'Performance Review' },
]

export function Sidebar({ user }: { user: User }) {
  return (
    <nav className="flex h-screen w-60 flex-col gap-1 border-r border-zinc-200 bg-white p-4">
      <div className="mb-4 text-lg font-semibold">BuildFlow</div>
      {baseLinks.map((l) => (
        <Link key={l.href} href={l.href} className="rounded px-3 py-2 hover:bg-zinc-100">{l.label}</Link>
      ))}
      {user.role === 'owner' && (
        <>
          <div className="mt-4 text-xs uppercase text-zinc-500">Settings</div>
          <Link href="/workflows" className="rounded px-3 py-2 hover:bg-zinc-100">Workflow Templates</Link>
          <Link href="/settings/members" className="rounded px-3 py-2 hover:bg-zinc-100">Members</Link>
          <Link href="/settings/audit" className="rounded px-3 py-2 hover:bg-zinc-100">Audit Logs</Link>
        </>
      )}
      <div className="mt-auto">
        <div className="px-3 py-2 text-sm text-zinc-600">{user.name} ({user.role})</div>
        <form action="/api/auth/logout" method="post">
          <button className="w-full rounded px-3 py-2 text-left text-sm hover:bg-zinc-100">Sign out</button>
        </form>
      </div>
    </nav>
  )
}
