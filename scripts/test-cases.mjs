// Runs the 17 cases in seed/signal-test-set.json through the SAME Gemini labelling + code scoring as the pipeline,
// as of the test set's date (2026-10-12), and prints expected vs actual. Writes nothing to the database.
// Usage: npm run test-cases
import { readFileSync } from 'node:fs';
import { parseCsv } from '../lib/csv.js';
import { labelItems } from '../lib/gemini.js';
import { rejectReason, scoreVc, band } from '../lib/score.js';
import { buildMatchers, preMatch, normUrl } from '../lib/sources.js';

const set = JSON.parse(readFileSync(new URL('../seed/signal-test-set.json', import.meta.url), 'utf8'));
const vcsAll = parseCsv(readFileSync(new URL('../seed/vc-list.csv', import.meta.url), 'utf8')).map(r => ({ ...r, vc_group: r.group }));
const vcs = vcsAll.map(({ vc_id, firm, aliases, partner_name, guard_terms, vc_group, status }) => ({ vc_id, firm, aliases, partner_name, guard_terms, vc_group, status }));
const vcIds = new Set(vcs.map(v => v.vc_id));
const today = set.as_of;
const matchers = buildMatchers(vcs);
const byFirm = n => vcs.find(v => v.firm.toLowerCase() === String(n || '').toLowerCase().trim());

// T03 and T04 are the same article (one item, two VCs): label each unique URL once.
const auto = set.cases.filter(c => /^https?:/.test(c.url));
const uniq = [...new Map(auto.map(c => [normUrl(c.url), c])).values()];
const items = uniq.map(c => {
  const it = { url: normUrl(c.url), title: c.title, snippet: c.title, published: c.published, source: 'test-set' };
  return { ...it, candidates: preMatch(it, matchers) };
});
const { labels, inputTokens, outputTokens } = await labelItems(items, vcs, today);
const fetched = new Set(items.map(i => i.url));

const rows = [];
const accepted = [];
for (const c of set.cases) {
  const exp = c.expect;
  if (!/^https?:/.test(c.url)) {
    // T17: manual log older than 30 days. Built from the case text (no real URL by design); date = window_start - 1 day.
    const old = new Date(Date.parse(set.window_start) - 86400000).toISOString().slice(0, 10);
    const s = { vc_id: 'VC01', url: 'manual', type: 'S2', relevance: 'core', confirmed: true, manual: true, published_at: old };
    const reason = rejectReason(s, today);
    rows.push({ id: c.id, vc: c.vc, exp_signal: exp.signal, act_signal: !reason, exp_type: exp.type, act_type: '(manual)', exp_rel: exp.relevance, act_rel: 'core', reason: reason || '', pass: !reason === exp.signal });
    continue;
  }
  const expVc = byFirm(String(c.vc || '').split(';')[0]);
  const ls = labels.filter(l => normUrl(l.url || '') === normUrl(c.url) || items[l.i]?.url === normUrl(c.url));
  const l = (expVc && ls.find(x => x.vc_id === expVc.vc_id)) || ls.find(x => x.vc_id) || ls[0] || {};
  const s = { ...l, url: normUrl(c.url), published_at: c.published, source: 'test-set' };
  let reason = !fetched.has(normUrl(l.url || '')) ? 'URL not fetched' : rejectReason(s, today, { vcIds });
  if (!l.type) reason = 'not labelled';
  if (!reason) accepted.push(s);
  const act = !reason;
  rows.push({
    id: c.id, vc: (c.vc || 'none').slice(0, 22), exp_signal: exp.signal, act_signal: act,
    exp_type: exp.type || '-', act_type: l.type || '-', exp_rel: exp.relevance || '-', act_rel: l.relevance || '-',
    reason: reason || '', pass: act === exp.signal && (!exp.signal || (l.type === exp.type && l.relevance === exp.relevance)),
  });
}
console.log(`\nCASES (as of ${today}; Gemini ${process.env.GEMINI_MODEL}; ${inputTokens} in / ${outputTokens} out tokens)`);
console.table(rows);

// Per-VC bands vs rubric section 6
const expected = { VC21: [64, 'Reach out this week'], VC11: [55, 'Reach out this week'], VC13: [48, 'Warm'], VC41: [42, 'Warm'],
  VC01: [35, 'Warm'], VC35: [24, 'Low priority'], VC06: [21, 'Low priority'], VC28: [19, 'Low priority'] };
const bandRows = Object.entries(expected).map(([id, [es, eb]]) => {
  const v = vcs.find(x => x.vc_id === id);
  const r = scoreVc(v, accepted.filter(s => s.vc_id === id), today);
  return { vc: v.firm, exp_score: es, act_score: r.score, exp_band: eb, act_band: band(r.score).split(':')[0], meet: r.meet.map(m => `${m.event_name} ${m.event_start || ''}`).join('; '), pass: band(r.score).startsWith(eb) };
});
console.log('\nBANDS (rubric section 6, v2)');
console.table(bandRows);
const pc = rows.filter(r => r.pass).length, pb = bandRows.filter(r => r.pass).length;
console.log(`\nCases: ${pc}/${rows.length} match expected · Bands: ${pb}/${bandRows.length} match expected`);
