import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { isDate, validBody, noteRow } from '@/lib/notes';

export const dynamic = 'force-dynamic';

// GET /api/notes?month=YYYY-MM  (no month: all notes, newest first)
export async function GET(req) {
  const month = new URL(req.url).searchParams.get('month');
  if (month && !/^\d{4}-\d{2}$/.test(month)) return NextResponse.json({ error: 'month must be YYYY-MM' }, { status: 400 });
  const sql = db();
  const rows = month
    ? await sql`select id, note_date::text, body, created_at, updated_at from calendar_notes
        where to_char(note_date, 'YYYY-MM') = ${month} order by note_date, created_at`
    : await sql`select id, note_date::text, body, created_at, updated_at from calendar_notes order by note_date desc, created_at desc limit 500`;
  return NextResponse.json({ notes: rows.map(noteRow) });
}

// POST /api/notes  { note_date: 'YYYY-MM-DD', body }
export async function POST(req) {
  const b = await req.json().catch(() => ({}));
  if (!isDate(b.note_date)) return NextResponse.json({ error: 'note_date must be YYYY-MM-DD' }, { status: 400 });
  const v = validBody(b.body);
  if (v.error) return NextResponse.json({ error: v.error }, { status: 400 });
  const [row] = await db()`insert into calendar_notes (note_date, body) values (${b.note_date}, ${v.body})
    returning id, note_date::text, body, created_at, updated_at`;
  return NextResponse.json({ note: noteRow(row) }, { status: 201 });
}
