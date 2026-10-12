// sha256 over (vc_id, contact_history, personal_notes) for all rows; used by /api/verify and the Last run report.
import { createHash } from 'node:crypto';
import { db } from './db.js';

export async function manualSnapshot() {
  const rows = await db()`select vc_id, contact_history, personal_notes, status, last_contact_date::text as last_contact_date from vcs order by vc_id`;
  const h = cols => createHash('sha256').update(JSON.stringify(rows.map(r => [r.vc_id, ...cols.map(c => r[c])]))).digest('hex');
  return { rows: rows.length, hash_contact_history_personal_notes: h(['contact_history', 'personal_notes']), hash_all_manual_columns: h(['contact_history', 'personal_notes', 'status', 'last_contact_date']), at: new Date().toISOString() };
}

// Is the DB guard (trigger + write function) in place?
export async function guardActive() {
  const [r] = await db()`select
    exists(select 1 from pg_trigger where tgname = 'vcs_guard_trg' and tgenabled <> 'D') as trg,
    exists(select 1 from pg_proc where proname = 'app_update_vc_signal') as fn`;
  return r.trg && r.fn;
}
