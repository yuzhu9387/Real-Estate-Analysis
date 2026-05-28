import type { User } from '@/db/schema'
import { SearchBox } from '@/components/dashboard/search-box'

export function TopAppBar({ user }: { user: User }) {
  const initials = user.name
    .split(/\s+/)
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <header className="fixed top-0 right-0 left-[240px] z-50 bg-white/70 backdrop-blur-xl border-b border-outline-variant/30 h-16 px-lg flex justify-between items-center">
      <div className="flex items-center gap-lg flex-1">
        <SearchBox />
      </div>
      <div className="flex items-center gap-md">
        <button
          type="button"
          aria-label="Notifications"
          className="p-sm text-on-surface-variant hover:text-primary transition-colors"
        >
          <span className="material-symbols-outlined">notifications</span>
        </button>
        <button
          type="button"
          aria-label="Help"
          className="p-sm text-on-surface-variant hover:text-primary transition-colors"
        >
          <span className="material-symbols-outlined">help</span>
        </button>
        <div className="h-8 w-[1px] bg-outline-variant/30 mx-sm" />
        <div className="flex items-center gap-sm group cursor-pointer">
          <div className="w-8 h-8 rounded-full overflow-hidden border border-primary/20 bg-surface-container-high flex items-center justify-center text-[11px] font-bold text-primary">
            {user.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img alt={`${user.name} avatar`} className="w-full h-full object-cover" src={user.avatarUrl} />
            ) : (
              <span>{initials}</span>
            )}
          </div>
          <div className="flex flex-col">
            <span className="font-body-sm text-body-sm text-on-surface font-semibold group-hover:text-primary transition-colors">
              {user.name}
            </span>
            <span className="text-[10px] text-outline uppercase tracking-widest">{user.role}</span>
          </div>
        </div>
      </div>
    </header>
  )
}
