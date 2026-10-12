// Calendar notes (UI v2). Separate table, never touches vcs.
export const MAX_NOTE = 2000;
export const isDate = d => /^\d{4}-\d{2}-\d{2}$/.test(d || '') && !isNaN(Date.parse(d));
export function validBody(b) {
  const s = typeof b === 'string' ? b.trim() : '';
  if (!s) return { error: 'Note is empty' };
  if (s.length > MAX_NOTE) return { error: `Note is longer than ${MAX_NOTE} characters` };
  return { body: s };
}
export const noteRow = r => ({ id: Number(r.id), note_date: r.note_date, body: r.body, created_at: r.created_at, updated_at: r.updated_at });
