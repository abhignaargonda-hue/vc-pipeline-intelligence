import { NextResponse } from 'next/server';
import { runPipeline } from '@/lib/pipeline';
import { manualSnapshot } from '@/lib/verify';
import { rateLimit } from '../run/route';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// Proof that the pipeline never overwrites Vikram's columns:
// sha256 over (vc_id, contact_history, personal_notes) for all 50 rows, before and after a run.
const snapshot = manualSnapshot;

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
