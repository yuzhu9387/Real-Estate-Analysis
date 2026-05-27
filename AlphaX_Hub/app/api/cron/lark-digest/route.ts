import { NextResponse, type NextRequest } from 'next/server'
import { db } from '@/db/client'
import { getDigestSummariesForActiveOptedInUsers } from '@/db/queries/my-tasks'
import { sendLarkDirectMessage } from '@/lib/lark/messaging'
import { shouldSendDigest, buildDigestMessage } from '@/lib/my-tasks/digest-payload'

export async function POST(req: NextRequest) {
  const expected = process.env.LARK_DIGEST_CRON_SECRET
  if (!expected) return NextResponse.json({ error: 'cron secret not configured' }, { status: 500 })
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${expected}`) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const baseUrl = process.env.APP_PUBLIC_URL ?? 'http://localhost:3000'
  const summaries = await getDigestSummariesForActiveOptedInUsers(db)

  const result = { processed: 0, sent: 0, skipped: 0, errors: [] as Array<{ userId: string; error: string }> }

  for (const s of summaries) {
    result.processed++
    if (!shouldSendDigest(s)) {
      result.skipped++
      continue
    }
    try {
      await sendLarkDirectMessage({
        openId: s.larkOpenId,
        text: buildDigestMessage({ ...s, myTasksUrl: `${baseUrl}/my-tasks` }),
      })
      result.sent++
    } catch (e) {
      result.errors.push({ userId: s.userId, error: e instanceof Error ? e.message : String(e) })
    }
  }

  return NextResponse.json(result)
}
