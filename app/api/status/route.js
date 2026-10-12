import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { STATUSES } from '@/lib/score';
import { recomputeScores, todayIST } from '@/lib/pipeline';

export const dynamic = 'force-dynamic';

// Vikram sets his pipeline status from the dashboard. Written ONLY to the separate vc_status table
// (append-only, via app_set_status); vcs.status / contact_history / personal_notes are never touched.
export async function POST(req) {
  const { vc_id, status, note } = await req.json().catch(() => ({}));
  if (!STATUSES.includes(status)) return NextResponse.json({ ok: false, message: 'Unknown status' }, { status: 400 });
  const sql = db();
  const [vc] = await sql`select vc_id from vcs where vc_id = ${vc_id}`;
  if (!vc) return NextResponse.json({ ok: false, message: 'Unknown VC' }, { status: 400 });
  await sql`select app_set_status(${vc_id}, ${status}, ${(note || '').slice(0, 500)})`;
  const [run] = await sql`insert into runs (trigger, status, finished_at) values ('status', 'ok', now()) returning id`;
  const changes = await recomputeScores(sql, todayIST(), run.id, [vc_id]);
  await sql`update runs set changes = ${JSON.stringify(changes)}::jsonb where id = ${run.id}`;
  return NextResponse.json({ ok: true });
}
