'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { User } from '@/db/schema'

type NavLink = {
  href: string
  label: string
  icon: string
  match?: (pathname: string) => boolean
}

const PRIMARY_LINKS: NavLink[] = [
  { href: '/', label: 'Dashboard', icon: 'dashboard', match: (p) => p === '/' },
  { href: '/projects', label: 'Projects', icon: 'folder_managed', match: (p) => p.startsWith('/projects') },
  { href: '/workflows', label: 'Workflow', icon: 'dynamic_feed', match: (p) => p.startsWith('/workflows') },
  { href: '/my-tasks', label: 'My Tasks', icon: 'assignment', match: (p) => p.startsWith('/my-tasks') },
  { href: '/team', label: 'Team', icon: 'group', match: (p) => p.startsWith('/team') },
  { href: '/performance', label: 'Performance Review', icon: 'analytics', match: (p) => p.startsWith('/performance') },
]

const OWNER_SETTINGS: NavLink[] = [
  { href: '/settings/members', label: 'Members', icon: 'person_add', match: (p) => p.startsWith('/settings/members') },
  { href: '/settings/audit', label: 'Audit Logs', icon: 'history', match: (p) => p.startsWith('/settings/audit') },
]

const SETTINGS_LINK: NavLink = {
  href: '/settings/me',
  label: 'Settings',
  icon: 'settings',
  match: (p) => p === '/settings/me' || (p.startsWith('/settings') && !p.startsWith('/settings/members') && !p.startsWith('/settings/audit')),
}

export function Sidebar({ user }: { user: User }) {
  const pathname = usePathname() ?? '/'
  const isOwner = user.role === 'owner'

  return (
    <aside className="fixed left-0 top-0 h-full w-[240px] bg-white border-r border-outline-variant/30 flex flex-col py-lg px-md z-[60] custom-scrollbar overflow-y-auto">
      <Link href="/" className="mb-xl px-sm block hover:opacity-80 transition-opacity">
        <h1 className="font-headline-md text-headline-md font-bold text-primary">AlphaX Hub</h1>
        <p className="font-body-sm text-body-sm text-on-surface-variant">Management Dashboard</p>
      </Link>

      <nav className="flex-1 space-y-base">
        {PRIMARY_LINKS.map((link) => (
          <NavItem key={link.href} link={link} active={!!link.match?.(pathname)} />
        ))}

        {isOwner && (
          <>
            <div className="pt-lg pb-sm">
              <span className="text-label-caps font-label-caps text-outline px-md">SETTINGS</span>
            </div>
            {OWNER_SETTINGS.map((link) => (
              <NavItem key={link.href} link={link} active={!!link.match?.(pathname)} />
            ))}
            <NavItem link={SETTINGS_LINK} active={!!SETTINGS_LINK.match?.(pathname)} />
          </>
        )}

        {!isOwner && <NavItem link={SETTINGS_LINK} active={!!SETTINGS_LINK.match?.(pathname)} />}
      </nav>

      <div className="mt-auto space-y-base pt-lg border-t border-outline-variant/20">
        {isOwner && (
          <Link
            href="/projects/new"
            className="block w-full bg-primary text-white py-md rounded-lg font-bold text-center transition-all hover:brightness-110 active:scale-[0.98] mb-md shadow-lg shadow-primary/10"
          >
            Create New Project
          </Link>
        )}
        <a
          href="https://github.com/anthropics/claude-code/issues"
          className="flex items-center gap-md px-md py-sm rounded-lg text-on-surface-variant hover:bg-surface-container transition-all duration-150"
        >
          <span className="material-symbols-outlined">help_outline</span>
          <span className="font-body-md">Support</span>
        </a>
        <form action="/api/auth/logout" method="post">
          <button
            type="submit"
            className="w-full flex items-center gap-md px-md py-sm rounded-lg text-on-surface-variant hover:text-error transition-all duration-150"
          >
            <span className="material-symbols-outlined">logout</span>
            <span className="font-body-md">Log Out</span>
          </button>
        </form>
      </div>
    </aside>
  )
}

function NavItem({ link, active }: { link: NavLink; active: boolean }) {
  return (
    <Link
      href={link.href}
      className={[
        'flex items-center gap-md px-md py-sm rounded-lg transition-all duration-150 active:scale-[0.98]',
        active
          ? 'text-primary font-bold bg-primary/5 border-r-2 border-primary'
          : 'text-on-surface-variant hover:bg-surface-container',
      ].join(' ')}
    >
      <span className="material-symbols-outlined">{link.icon}</span>
      <span className="font-body-md">{link.label}</span>
    </Link>
  )
}
