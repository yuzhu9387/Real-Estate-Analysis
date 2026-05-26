import { pickDefaultAvatar } from '@/lib/avatar/default-avatar'

type Size = 'xs' | 'sm' | 'md' | 'lg'

const SIZES: Record<Size, number> = { xs: 16, sm: 24, md: 40, lg: 64 }

export function Avatar({
  user, size = 'sm',
}: {
  user: { id: string; avatarUrl?: string | null; name: string }
  size?: Size
}) {
  const px = SIZES[size]
  const fallback = `/avatars/avatar-${pickDefaultAvatar(user.id)}.svg`
  const src = user.avatarUrl || fallback
  return (
    <img
      src={src}
      alt={user.name}
      title={user.name}
      width={px}
      height={px}
      className="rounded-full inline-block"
      style={{ width: px, height: px }}
    />
  )
}
