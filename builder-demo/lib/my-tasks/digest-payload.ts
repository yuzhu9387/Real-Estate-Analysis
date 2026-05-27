export type DigestCounts = {
  overdueCount: number
  dueThisWeekCount: number
  pendingMyReviewCount: number
}

export function shouldSendDigest(counts: DigestCounts): boolean {
  return counts.overdueCount > 0 || counts.dueThisWeekCount > 0 || counts.pendingMyReviewCount > 0
}

export function buildDigestMessage(input: DigestCounts & { myTasksUrl: string }): string {
  return [
    '📋 BuildFlow daily digest',
    `Overdue: ${input.overdueCount}`,
    `Due this week: ${input.dueThisWeekCount}`,
    `Pending your review: ${input.pendingMyReviewCount}`,
    `👉 ${input.myTasksUrl}`,
  ].join('\n')
}
