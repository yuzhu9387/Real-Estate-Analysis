import type { User } from '@/lib/types';

export function Avatar({ user, size = 24 }: { user: User; size?: number }) {
  return (
    <span
      title={user.name}
      className="inline-flex items-center justify-center rounded-full text-white text-[10px] font-semibold"
      style={{ width: size, height: size, backgroundColor: user.avatarColor, fontSize: size * 0.4 }}
    >
      {user.initials}
    </span>
  );
}
