import { PHASE_ORDER, PERMITS } from '@/lib/permits';
import type { PermitKey } from '@/lib/types';
import { Check } from 'lucide-react';

export function PermitStageStepper({ current, completed }: { current: PermitKey; completed: Set<PermitKey> }) {
  const currentIdx = PHASE_ORDER.indexOf(current);
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="text-sm font-medium mb-3">Permit stage</div>
      <ol className="flex items-center gap-2 overflow-x-auto pb-1">
        {PHASE_ORDER.map((key, i) => {
          const p = PERMITS[key];
          const isDone = completed.has(key) || i < currentIdx;
          const isCurrent = i === currentIdx;
          return (
            <li key={key} className="flex items-center gap-2 shrink-0">
              <span
                className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium border"
                style={{
                  borderColor: isCurrent ? p.hex : '#E2E8F0',
                  backgroundColor: isCurrent ? `${p.hex}1A` : isDone ? '#F1F5F9' : 'transparent',
                  color: isCurrent ? p.hex : isDone ? '#64748B' : '#94A3B8',
                }}
              >
                {isDone && <Check className="size-3" />}
                {p.label}
              </span>
              {i < PHASE_ORDER.length - 1 && <span className="text-muted-foreground/40">→</span>}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
