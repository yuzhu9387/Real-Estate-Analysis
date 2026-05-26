'use client';
import { useDemoStore } from '@/lib/store';
import { USERS } from '@/lib/sample-data';
import { Avatar } from '@/components/shared/avatar';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChevronDown } from 'lucide-react';

export function RoleSwitcher() {
  const currentUserId = useDemoStore((s) => s.currentUserId);
  const setCurrentUser = useDemoStore((s) => s.setCurrentUser);
  const current = USERS.find((u) => u.id === currentUserId)!;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 rounded-md border border-border bg-card px-2.5 py-1.5 text-sm hover:bg-accent">
        <Avatar user={current} size={20} />
        <span className="font-medium">{current.name}</span>
        <span className="text-xs text-muted-foreground">· {current.role}</span>
        <ChevronDown className="size-3.5 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>View as</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {USERS.map((u) => (
          <DropdownMenuItem key={u.id} onClick={() => setCurrentUser(u.id)}>
            <Avatar user={u} size={20} />
            <div className="ml-2 flex flex-col">
              <span className="text-sm">{u.name}</span>
              <span className="text-xs text-muted-foreground">{u.role}</span>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
