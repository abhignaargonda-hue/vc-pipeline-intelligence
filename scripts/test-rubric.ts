// Feeds T01-T17 from seed/signal-test-set.json STRAIGHT into the scoring code (lib/score.js), using the labels
// written in the test set (no Gemini, no network, no database). Checks scores and bands against signal-rubric.md section 6.
// Usage: npm run test-rubric   (Node >= 22.18 runs .ts directly)
import { readFileSync } from 'node:fs';
import { parseCsv } from '../lib/csv.js';
import { rejectReason, scoreVc, band } from '../lib/score.js';

type Case = { id: string; vc: string | null; title: string; url: string; published: string;
  expect: { signal: boolean; type: string | null; relevance: string | null; action_band: string | null } };

const set = JSON.parse(readFileSync(new URL('../seed/signal-test-set.json', import.meta.url), 'utf8'));
const vcs = parseCsv(readFileSync(new URL('../seed/vc-list.csv', import.meta.url), 'utf8'))
  .map((r: any) => ({ vc_id: r.vc_id, firm: r.firm, vc_group: r.group, stage_fit: r.stage_fit, partner_name: r.partner_name, status: r.status }));
const vcIds = new Set(vcs.map(v => v.vc_id));
const today: string = set.as_of; // 2026-10-12 (IST)
const idOf = (name: string) => vcs.find(v => v.firm.toLowerCase() === name.trim().toLowerCase())?.vc_id ?? null;

// Event date for T08 comes from seed/vc-list-notes.md ("TechSparks 2026 speaker (7 Oct 2026, event 13-15 Oct)").
const EVENTS: Record<string, { event_name: string; event_start: string; event_end: string }> = {
  T08: { event_name: 'TechSparks 2026', event_start: '2026-10-13', event_end: '2026-10-15' },
};

const signals: any[] = [];
const caseRows: any[] = [];
for (const c of set.cases as Case[]) {
  const names = (c.vc && c.vc !== '(manual)') ? c.vc.split(';') : [null];
  for (const n of names) {
    const manual = c.vc === '(manual)';
    const s = {
      id: c.id, vc_id: manual ? 'VC01' : (n ? idOf(n) : null), url: manual ? 'manual-entry' : c.url,
      // T17 has no date by design ("entered, >30 days"): use window_start - 1 day.
      published_at: manual ? new Date(Date.parse(set.window_start) - 86400000).toISOString().slice(0, 10) : c.published,
      type: c.expect.type ?? (manual ? 'S2' : 'none'), relevance: c.expect.relevance ?? 'not_relevant',
      confirmed: true, manual, summary: c.title, source: 'test-set', ...(EVENTS[c.id] || {}),
    };
    const reason = rejectReason(s, today, { vcIds });
    if (!reason) signals.push(s);
    caseRows.push({ id: c.id, vc: (n || c.vc || 'none').trim().slice(0, 24), expect_signal: c.expect.signal, actual_signal: !reason,
      reason: reason || '', pass: !reason === c.expect.signal });
  }
}

const EXPECTED: [string, number, string, boolean?][] = [
  ['IvyCap Ventures', 64, 'Reach out this week'], ['3one4 Capital', 55, 'Reach out this week'],
  ['Info Edge Ventures', 48, 'Warm'], ['Avaana Capital', 42, 'Warm'], ['Blume Ventures', 35, 'Warm'],
  ['Speciale Invest', 24, 'Low priority', true], ['Lightspeed India', 21, 'Low priority'], ['WEH Ventures', 19, 'Low priority'],
];
const bandRows = EXPECTED.map(([firm, score, b, meet]) => {
  const v = vcs.find(x => x.firm === firm)!;
  const r = scoreVc(v, signals.filter(s => s.vc_id === v.vc_id), today, { version: 'v2' });
  const r3 = scoreVc(v, signals.filter(s => s.vc_id === v.vc_id), today, { version: 'v3' });
  const ok = r.score === score && band(r.score).startsWith(b) && (!meet || r.meet.length > 0);
  return { vc: firm, expected: score, actual: r.score, expected_band: b, actual_band: band(r.score).split(':')[0], meet_in_person: r.meet.map(m => m.event_name).join(', '), pass: ok, v3_fit_x_timing: r3.score };
});
// Every other tracked VC (incl. Equentis, IPV, Peak XV, Fireside) must score 0
const zeroFails = vcs.filter(v => !EXPECTED.some(e => e[0] === v.firm))
  .map(v => ({ v, r: scoreVc(v, signals.filter(s => s.vc_id === v.vc_id), today, { version: 'v2' }) })).filter(x => x.r.score !== 0);

console.log(`\nT01-T17 hard filters (as of ${today})`); console.table(caseRows);
console.log('\nScores and bands vs signal-rubric.md section 6 (v2 maths; v3 column = fit x timing, informational:');
console.log('the test set has no deal-stage labels, so v3 treats every deal as stage "unknown")'); console.table(bandRows);
const fails = caseRows.filter(r => !r.pass).length + bandRows.filter(r => !r.pass).length + zeroFails.length;
if (zeroFails.length) console.log('Unexpected non-zero:', zeroFails.map(x => `${x.v.firm} ${x.r.score}`).join(', '));
console.log(fails ? `\nFAIL: ${fails} mismatches` : `\nPASS: ${caseRows.length} case rows, ${bandRows.length} bands, all other VCs 0`);
process.exit(fails ? 1 : 0);
