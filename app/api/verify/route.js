import { NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { db } from '@/lib/db';
import { runPipeline } from '@/lib/pipeline';
import { rateLimit } from '../run/route';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// Proof that the pipeline never overwrites Vikram's columns:
// sha256 over (vc_id, contact_history, personal_notes) for all 50 rows, before and after a run.
async function snapshot() {
  const rows = await db()`select vc_id, contact_history, personal_notes, status, last_contact_date::text as last_contact_date from vcs order by vc_id`;
  const h = cols => createHash('sha256').update(JSON.stringify(rows.map(r => [r.vc_id, ...cols.map(c => r[c])]))).digest('hex');
  return { rows: rows.length, hash_contact_history_personal_notes: h(['contact_history', 'personal_notes']), hash_all_manual_columns: h(['contact_history', 'personal_notes', 'status', 'last_contact_date']), at: new Date().toISOString() };
}

export async function GET(req) {
  const before = await snapshot();
  if (new URL(req.url).searchParams.get('run') !== '1') {
    return NextResponse.json({ ...before, hint: 'Add ?run=1 to hash, run the pipeline, and hash again (rate-limited like Run now).' });
  }
  const block = await rateLimit();
  if (block) return NextResponse.json({ error: block, current: before }, { status: 429 });
  const run = await runPipeline('verify');
  const after = await snapshot();
  return NextResponse.json({
    before, after, run,
    unchanged: before.hash_contact_history_personal_notes === after.hash_contact_history_personal_notes && before.hash_all_manual_columns === after.hash_all_manual_columns,
  });
}
