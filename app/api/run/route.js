import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { runPipeline } from '@/lib/pipeline';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// Vercel cron: GET with Authorization: Bearer CRON_SECRET (Mon + Thu 6:30am IST)
export async function GET(req) {
  if (!process.env.CRON_SECRET || req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  return NextResponse.json(await runPipeline('cron'));
}

// Dashboard "Run now" button: rate-limited to once per 30 minutes (checked in the runs table)
export async function POST() {
  const block = await rateLimit();
  if (block) return NextResponse.json({ error: block }, { status: 429 });
  try {
    return NextResponse.json(await runPipeline('manual'));
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function rateLimit() {
  const sql = db();
  const [r] = await sql`select max(started_at) as last from runs where trigger in ('manual','verify')`;
  const [busy] = await sql`select count(*)::int as n from runs where status = 'running' and started_at > now() - interval '6 minutes'`;
  if (busy.n > 0) return 'A run is already in progress.';
  if (r.last && Date.now() - new Date(r.last).getTime() < 30 * 60 * 1000) {
    const mins = Math.ceil((30 * 60 * 1000 - (Date.now() - new Date(r.last).getTime())) / 60000);
    return `Run now is limited to once per 30 minutes. Try again in ${mins} min.`;
  }
  return null;
}
