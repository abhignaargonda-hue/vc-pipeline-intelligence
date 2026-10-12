// Rubric v4 check (seed/signal-rubric.md section 8). Feeds T01-T17 from seed/signal-test-set.json STRAIGHT into
// lib/score.js using the labels written in the test set (no Gemini, no network, no database), and compares every
// VC score with a hand-written reference of the v4 formula. Also checks the hard filters (T11-T17 rejected).
// The test set was written for the first VC list, so VC names resolve against seed/vc-list-v1.csv.
// Usage: npm run test-rubric   (Node >= 22.18 runs .ts directly)
import { readFileSync } from 'node:fs';
import { parseCsv } from '../lib/csv.js';
import { rejectReason, scoreVc, band } from '../lib/score.js';

type Case = { id: string; vc: string | null; title: string; url: string; published: string;
  expect: { signal: boolean; type: string | null; relevance: string | null } };

const set = JSON.parse(readFileSync(new URL('../seed/signal-test-set.json', import.meta.url), 'utf8'));
const vcs = parseCsv(readFileSync(new URL('../seed/vc-list-v1.csv', import.meta.url), 'utf8'))
  .map((r: any) => ({ vc_id: r.vc_id, firm: r.firm, vc_group: r.group, partner_name: r.partner_name, status: r.status }));
const vcIds = new Set(vcs.map(v => v.vc_id));
const today: string = set.as_of; // 2026-10-12 (IST)
const idOf = (name: string) => vcs.find(v => v.firm.toLowerCase() === name.trim().toLowerCase())?.vc_id ?? null;
// Lead role as written in the test-set titles ("led by IvyCap", "co-led by 3one4 ..."); otherwise unknown.
const roleOf = (title: string, firm: string) => {
  const t = title.toLowerCase(), f = firm.toLowerCase().split(' ')[0];
  if (new RegExp(`co-led by [^()]*${f}`).test(t)) return 'co-led';
  if (new RegExp(`led by [^()]*${f}`).test(t)) return 'led';
  return 'unknown';
};

// ---- Reference implementation, written from the rubric text (independent of lib/score.js) ----
const WHAT: Record<string, number> = { S1: 70, S5: 60, S2: 35, S3: 35, S4a: 35, S4b: 20, S6: 20, S7: 20 };
const LOG: Record<string, number> = { core: 100, adjacent: 40, general: 10 };
const FRESH = (d: number) => (d <= 7 ? 100 : d <= 14 ? 70 : d <= 30 ? 40 : 0);
const days = (p: string) => Math.round((Date.parse(today) - Date.parse(p)) / 86400000);
function reference(sigs: any[]) {
  const pts = sigs.map(s => {
    const led = s.type !== 'S1' ? 100 : ['led', 'co-led'].includes(s.deal_role) ? 100 : 60;
    return 0.5 * (WHAT[s.type] || 0) + 0.3 * (LOG[s.manual ? 'core' : s.relevance] || 0) + 0.15 * FRESH(days(s.published_at)) + 0.05 * led;
  }).filter(p => p > 0).sort((a, b) => b - a);
  return pts.length ? Math.min(100, Math.round(pts[0] + Math.min(15, 5 * (pts.length - 1)))) : 0;
}

const signals: any[] = [];
const caseRows: any[] = [];
for (const c of set.cases as Case[]) {
  const names = (c.vc && c.vc !== '(manual)') ? c.vc.split(';') : [null];
  for (const n of names) {
    const manual = c.vc === '(manual)';
    const vc_id = manual ? 'VC01' : (n ? idOf(n) : null);
    const s = {
      id: c.id, vc_id, url: manual ? 'manual-entry' : c.url,
      // T17 has no date by design ("entered, >30 days"): use window_start - 1 day.
      published_at: manual ? new Date(Date.parse(set.window_start) - 86400000).toISOString().slice(0, 10) : c.published,
      type: c.expect.type ?? (manual ? 'S2' : 'none'), relevance: c.expect.relevance ?? 'not_relevant',
      deal_role: n ? roleOf(c.title, n) : 'unknown', confirmed: true, manual, summary: c.title, source: 'test-set', event_key: c.id,
    };
    const reason = rejectReason(s, today, { vcIds });
    if (!reason) signals.push(s);
    caseRows.push({ id: c.id, vc: (n || c.vc || 'none').trim().slice(0, 24), expect_signal: c.expect.signal, actual_signal: !reason,
      role: s.deal_role, reason: reason || '', pass: !reason === c.expect.signal });
  }
}

const tested = [...new Set(signals.map(s => s.vc_id))];
const bandRows = tested.map(id => {
  const v = vcs.find(x => x.vc_id === id)!;
  const mine = signals.filter(s => s.vc_id === id);
  const r = scoreVc(v, mine, today);
  const ref = reference(mine);
  return { vc: v.firm, signals: mine.map(s => s.id).join('+'), reference: ref, actual: r.score, band: band(r.score).split(':')[0], pass: ref === r.score };
}).sort((a, b) => b.actual - a.actual);
const zeroFails = vcs.filter(v => !tested.includes(v.vc_id)).filter(v => scoreVc(v, [], today).score !== 0);

console.log(`\nT01-T17 hard filters (as of ${today})`); console.table(caseRows);
console.log('\nRubric v4: lib/score.js vs reference formula (0.50 What + 0.30 Logistics + 0.15 Fresh + 0.05 Led; best + 5/extra, max +15)');
console.table(bandRows);
const fails = caseRows.filter(r => !r.pass).length + bandRows.filter(r => !r.pass).length + zeroFails.length;
console.log(fails ? `\nFAIL: ${fails} mismatches` : `\nPASS: ${caseRows.length} case rows, ${bandRows.length} VC scores match the v4 reference, all other VCs 0`);
process.exit(fails ? 1 : 0);
