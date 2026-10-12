// Imports seed/vc-list.csv into vcs. Only research columns are written.
// Vikram's columns (last_contact_date, status, contact_history, personal_notes) are inserted empty
// (as in the CSV) and never touched on re-seed. Usage: npm run seed
import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'node:fs';
import { parseCsv } from '../lib/csv.js';

const sql = neon(process.env.DATABASE_URL);
const rows = parseCsv(readFileSync(new URL('../seed/vc-list.csv', import.meta.url), 'utf8'));
const n = v => (v === '' ? null : v);
for (const r of rows) {
  await sql`
    insert into vcs (vc_id, firm, vc_group, website, partner_name, partner_title, partner_verified_on_firm_site,
      team_page_url, thesis_quote, thesis_url, stage_fit, logistics_evidence, logistics_source_url, blog_or_feed,
      aliases, guard_terms, research_notes, last_contact_date, status, contact_history, personal_notes)
    values (${r.vc_id}, ${r.firm}, ${n(r.group)}, ${n(r.website)}, ${n(r.partner_name)}, ${n(r.partner_title)},
      ${n(r.partner_verified_on_firm_site)}, ${n(r.team_page_url)}, ${n(r.thesis_quote)}, ${n(r.thesis_url)},
      ${n(r.stage_fit)}, ${n(r.logistics_evidence)}, ${n(r.logistics_source_url)}, ${n(r.blog_or_feed)},
      ${n(r.aliases)}, ${n(r.guard_terms)}, ${n(r.research_notes)}, ${n(r.last_contact_date)}, ${n(r.status)},
      ${n(r.contact_history)}, ${n(r.personal_notes)})
    on conflict (vc_id) do update set
      firm = excluded.firm, vc_group = excluded.vc_group, website = excluded.website,
      partner_name = excluded.partner_name, partner_title = excluded.partner_title,
      partner_verified_on_firm_site = excluded.partner_verified_on_firm_site, team_page_url = excluded.team_page_url,
      thesis_quote = excluded.thesis_quote, thesis_url = excluded.thesis_url, stage_fit = excluded.stage_fit,
      logistics_evidence = excluded.logistics_evidence, logistics_source_url = excluded.logistics_source_url,
      blog_or_feed = excluded.blog_or_feed, aliases = excluded.aliases, guard_terms = excluded.guard_terms,
      research_notes = excluded.research_notes`;
}
const [{ count }] = await sql`select count(*)::int as count from vcs`;
console.log(`Seeded ${rows.length} rows; vcs now has ${count} VCs.`);
