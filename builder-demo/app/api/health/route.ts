import { NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { db } from '@/db/client'

export async function GET() {
  try {
    await db.execute(sql`SELECT 1`)
    return NextResponse.json({ ok: true, db: 'up' })
  } catch (e) {
    return NextResponse.json({ ok: false, db: 'down', error: String(e) }, { status: 503 })
  }
}
