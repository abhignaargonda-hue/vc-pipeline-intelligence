// Imports seed/vc-list.csv (Vikram's sheet "vc-list-50-logistics-seed", researched 12 Oct 2026) into vcs.
// Only research columns are written. Vikram's columns (last_contact_date, status, contact_history, personal_notes)
// are not in the sheet: inserted empty and never touched on re-seed. Usage: npm run seed
//
// The sheet has no Tavily query column, so guard_terms are DERIVED (documented, nothing invented):
//  - firm also in the old list (seed/vc-list-v1.csv): reuse its researched guard_terms;
//  - otherwise: the firm name and aliases in quotes, plus exclusions for the same-name companies the sheet's
//    "Watch-outs" column names (e.g. "Not Titan Company" -> -"Titan Company").
import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'node:fs';
import { parseCsv } from '../lib/csv.js';

const sql = neon(process.env.DATABASE_URL);
const rows = parseCsv(readFileSync(new URL('../seed/vc-list.csv', import.meta.url), 'utf8'));
const old = parseCsv(readFileSync(new URL('../seed/vc-list-v1.csv', import.meta.url), 'utf8'));
const n = v => (v == null || String(v).trim() === '' ? null : String(v).trim());
const norm = s => String(s).toLowerCase().replace(/\(.*?\)/g, '').replace(/[^a-z0-9]/g, '');
const oldBy = Object.fromEntries(old.map(o => [norm(o.firm), o]));
const firmName = f => f.replace(/\s*\(incl\.[^)]*\)/i, '').trim(); // "Peak XV Partners (incl. Surge)" -> "Peak XV Partners"

function guardTerms(r) {
  const o = oldBy[norm(firmName(r.Firm))] || oldBy[norm(r.Firm)];
  if (o?.guard_terms) return { terms: o.guard_terms, from: 'v1 list' };
  const names = [firmName(r.Firm).replace(/\s*\(.*?\)/g, ''), ...String(r.Aliases || '').split(/;/).map(a => a.replace(/\(.*?\)/g, '').trim())]
    .filter(a => a && a.length > 3 && !/platform|former name/i.test(a));
  const uniq = [...new Set(names)];
  const excl = [];
  for (const m of String(r['Watch-outs'] || '').matchAll(/(?:^|[.;]\s*)Not ([A-Z][^.;,()]+?)(?:\s*\(|[.;,]|$)/g)) excl.push(m[1].trim());
  for (const m of String(r['Watch-outs'] || '').matchAll(/([A-Z][\w .]+?)\s*\([^)]*\)\s*is a different company/g)) excl.push(m[1].trim());
  const q = uniq.map(x => `"${x}"`).join(' OR ') + (/(angel|capital|ventures|fund)$/i.test(uniq[0]) ? '' : ' India');
  return { terms: (q + ' ' + excl.map(e => `-"${e}"`).join(' ')).trim(), from: 'derived' };
}

for (const r of rows) {
  const id = `VC${String(r['#']).padStart(2, '0')}`;
  const g = guardTerms(r);
  const deal2 = n(r['Second logistics deal']);
  await sql`
    insert into vcs (vc_id, firm, vc_group, vc_type, website, partner_name, partner_title, partner_verified_on_firm_site,
      team_page_url, thesis_quote, thesis_url, stage_fit, logistics_evidence, logistics_source_url,
      second_logistics_deal, second_logistics_source_url, aliases, guard_terms, watch_outs, confidence, research_notes)
    values (${id}, ${firmName(r.Firm)}, 'logistics_active', ${n(r.Type)}, ${n(r.Website)}, ${n(r.Partner)}, ${n(r.Title)},
      ${n(r.Partner) ? 'yes' : 'no'}, ${n(r['Team page'])}, ${n(r['Seed evidence (quote)'])}, ${n(r['Seed source'])},
      ${n(r['Seed evidence (quote)'])}, ${n(r['Logistics deal (company – round – amount – date – role)'])}, ${n(r['Deal source'])},
      ${deal2}, ${n(r['Second source'])}, ${n(r.Aliases)}, ${g.terms}, ${n(r['Watch-outs'])}, ${n(r.Confidence)},
      ${`guard_terms ${g.from}`})
    on conflict (vc_id) do update set
      firm = excluded.firm, vc_group = excluded.vc_group, vc_type = excluded.vc_type, website = excluded.website,
      partner_name = excluded.partner_name, partner_title = excluded.partner_title,
      partner_verified_on_firm_site = excluded.partner_verified_on_firm_site, team_page_url = excluded.team_page_url,
      thesis_quote = excluded.thesis_quote, thesis_url = excluded.thesis_url, stage_fit = excluded.stage_fit,
      logistics_evidence = excluded.logistics_evidence, logistics_source_url = excluded.logistics_source_url,
      second_logistics_deal = excluded.second_logistics_deal, second_logistics_source_url = excluded.second_logistics_source_url,
      aliases = excluded.aliases, guard_terms = excluded.guard_terms, watch_outs = excluded.watch_outs,
      confidence = excluded.confidence, research_notes = excluded.research_notes`;
}
const [{ count }] = await sql`select count(*)::int as count from vcs`;
console.log(`Seeded ${rows.length} rows; vcs now has ${count} VCs.`);
