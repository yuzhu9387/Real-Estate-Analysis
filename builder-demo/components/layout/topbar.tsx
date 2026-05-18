'use client';
import { useDemoStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { RoleSwitcher } from './role-switcher';
import { RotateCcw } from 'lucide-react';

export function Topbar({ title }: { title: string }) {
  const reset = useDemoStore((s) => s.resetDemo);
  return (
    <header className="h-16 shrink-0 border-b border-border bg-background flex items-center justify-between px-6">
      <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={reset} title="Reset demo state">
          <RotateCcw className="size-3.5 mr-1.5" /> Reset
        </Button>
        <RoleSwitcher />
      </div>
    </header>
  );
}
