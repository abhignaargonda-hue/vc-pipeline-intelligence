import { NextResponse } from 'next/server';
import { logSignal } from '@/lib/pipeline';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  try {
    const r = await logSignal({ vc_id: body.vc_id, url: (body.url || '').trim(), post_date: body.post_date, line: body.line });
    return NextResponse.json(r, { status: r.ok ? 200 : 400 });
  } catch (e) {
    return NextResponse.json({ ok: false, message: e.message }, { status: 500 });
  }
}
