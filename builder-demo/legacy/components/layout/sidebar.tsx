'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, FolderKanban, ListChecks, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV = [
  { href: '/',                       label: 'Dashboard',    icon: LayoutDashboard },
  { href: '/projects/prj-9-greenwood-pl', label: '9 Greenwood Pl', icon: FolderKanban },
  { href: '/my-tasks',               label: 'My Tasks',     icon: ListChecks },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="w-60 shrink-0 border-r border-border bg-card flex flex-col">
      <div className="h-16 flex items-center gap-2 px-5 border-b border-border">
        <Building2 className="size-5 text-primary" />
        <span className="font-semibold text-sm tracking-tight">BuildFlow</span>
        <span className="text-[10px] text-muted-foreground ml-auto">Demo</span>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== '/' && pathname.startsWith(href));
          return (
            <Link key={href} href={href}
              className={cn(
                'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors',
                active ? 'bg-accent text-accent-foreground font-medium' : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
              )}>
              <Icon className="size-4" />
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
