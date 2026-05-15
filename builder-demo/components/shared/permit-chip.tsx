import { getPermit } from '@/lib/permits';
import type { PermitKey } from '@/lib/types';

export function PermitChip({ permit, size = 'sm' }: { permit: PermitKey; size?: 'sm' | 'md' }) {
  const p = getPermit(permit);
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium ${size === 'md' ? 'text-sm px-2.5 py-1' : ''}`}
      style={{ backgroundColor: `${p.hex}1A`, color: p.hex }}
    >
      <span className="size-1.5 rounded-full" style={{ backgroundColor: p.hex }} />
      {p.label}
    </span>
  );
}
