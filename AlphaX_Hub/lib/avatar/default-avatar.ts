export function pickDefaultAvatar(userId: string): number {
  let hash = 0
  for (const ch of userId) hash = (hash * 31 + ch.charCodeAt(0)) & 0x7fffffff
  return (hash % 6) + 1
}
