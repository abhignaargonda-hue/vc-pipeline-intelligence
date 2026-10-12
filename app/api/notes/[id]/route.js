import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { validBody, noteRow } from '@/lib/notes';

export const dynamic = 'force-dynamic';
const idOf = async params => { const { id } = await params; return /^\d+$/.test(id) ? Number(id) : null; };

// PATCH /api/notes/:id  { body }
export async function PATCH(req, { params }) {
  const id = await idOf(params);
  if (!id) return NextResponse.json({ error: 'bad id' }, { status: 400 });
  const v = validBody((await req.json().catch(() => ({}))).body);
  if (v.error) return NextResponse.json({ error: v.error }, { status: 400 });
  const [row] = await db()`update calendar_notes set body = ${v.body}, updated_at = now() where id = ${id}
    returning id, note_date::text, body, created_at, updated_at`;
  if (!row) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json({ note: noteRow(row) });
}

// DELETE /api/notes/:id
export async function DELETE(req, { params }) {
  const id = await idOf(params);
  if (!id) return NextResponse.json({ error: 'bad id' }, { status: 400 });
  const rows = await db()`delete from calendar_notes where id = ${id} returning id`;
  if (!rows.length) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
