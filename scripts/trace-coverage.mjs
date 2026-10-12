// Traces T01-T10 from seed/signal-test-set.json through every pipeline stage, using (a) what the live runs stored
// in `signals` and (b) a fresh collection pass with the SAME fetch code. Writes nothing. Usage: npm run trace
import { readFileSync } from 'node:fs';
import { db } from '../lib/db.js';
import { fetchFeeds, normUrl, buildMatchers, preMatch, toISODate } from '../lib/sources.js';
import { daysBetween } from '../lib/score.js';
import { todayIST, loadVcs } from '../lib/pipeline.js';

const sql = db();
const today = todayIST();
const set = JSON.parse(readFileSync(new URL('../seed/signal-test-set.json', import.meta.url), 'utf8'));
const cases = set.cases.filter(c => /^T(0\d|10)$/.test(c.id));
const vcs = await loadVcs(sql);
const matchers = buildMatchers(vcs);
const KEY = { T01: /blitz/i, T02: /drivn/i, T03: /gravity/i, T04: /gravity/i, T05: /supply chain award/i, T06: /procol/i, T07: /ultraviolette/i, T08: /techsparks/i, T09: /zetwerk/i, T10: /fund iii|250 cr/i };

async function tavily(query, opts) {
  const r = await fetch('https://api.tavily.com/search', { method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.TAVILY_API_KEY}` },
    body: JSON.stringify({ query, search_depth: 'basic', include_answer: false, max_results: 10, ...opts }) });
  return (await r.json()).results || [];
}

const feeds = await fetchFeeds();
const stored = await sql`select url, vc_id, source, type, relevance, accepted, rejected_reason, published_at::text p, run_id from signals where not manual`;
const runs = await sql`select id, trigger, started_at from runs order by id`;
const MODES = { 'live (news, 7d)': { topic: 'news', days: 7 }, 'news, 30d': { topic: 'news', days: 30 }, 'general, month': { topic: 'general', time_range: 'month' } };
let credits = 0;
const out = [];
for (const c of cases) {
  const vcName = c.vc; const vc = vcs.find(v => v.firm === vcName);
  const url = normUrl(c.url);
  const row = { id: c.id, vc: vcName, published: c.published, age_days: daysBetween(c.published, today) };
  // Stage: stored by a live run?
  const st = stored.filter(s => s.url === url);
  const sameEvent = stored.filter(s => s.vc_id === vc.vc_id && KEY[c.id].test(s.url));
  row.stored_in_live_runs = st.length ? st.map(s => `${s.source} run#${s.run_id} ${s.vc_id}/${s.type}/${s.relevance}/${s.accepted ? 'counted' : s.rejected_reason}`).join(' | ') : 'no';
  row.same_event_other_url = sameEvent.length ? sameEvent.map(s => `${s.url} ${s.type}/${s.relevance}/${s.accepted ? 'counted' : s.rejected_reason}`).join(' | ') : 'no';
  // Stage: in today's feeds?
  const inFeeds = feeds.items.filter(i => normUrl(i.url) === url || KEY[c.id].test(i.title));
  row.feeds_now = inFeeds.length ? inFeeds.map(i => `${i.source} [${i.published}] ${normUrl(i.url) === url ? 'same URL' : 'other URL'}`).join(' | ') : 'not in any feed';
  // Stage: Tavily with the live query vs alternatives
  for (const [mode, opts] of Object.entries(MODES)) {
    const res = await tavily(vc.guard_terms, opts); credits++;
    const hit = res.find(r => normUrl(r.url) === url) || res.find(r => KEY[c.id].test(`${r.title} ${r.content}`));
    if (!hit) { row[mode] = `not returned (${res.length} results)`; continue; }
    const pub = hit.published_date ? toISODate(hit.published_date) : null;
    const it = { title: hit.title, snippet: hit.content || '', vc_hint: vc.vc_id };
    const cands = preMatch(it, matchers);
    row[mode] = `${normUrl(hit.url) === url ? 'same URL' : 'same event: ' + new URL(hit.url).hostname}; date ${pub || 'NONE'}${pub ? ` (${daysBetween(pub, today)} d)` : ''}; prematch ${cands.join(',')}`;
  }
  out.push(row);
}
for (const r of out) { console.log(`\n=== ${r.id} ${r.vc} (published ${r.published}, ${r.age_days} d old)`); for (const [k, v] of Object.entries(r)) if (!['id', 'vc', 'published', 'age_days'].includes(k)) console.log(`  ${k.padEnd(22)} ${v}`); }
console.log(`\nLive runs so far: ${runs.map(r => `#${r.id} ${r.trigger} ${new Date(r.started_at).toISOString().slice(0, 16)}`).join(', ')}`);
console.log(`Feed item counts now: ${JSON.stringify(feeds.counts)}`);
console.log(`Feed items by date: oldest ${feeds.items.map(i => i.published).filter(Boolean).sort()[0]}, newest ${feeds.items.map(i => i.published).filter(Boolean).sort().at(-1)}`);
console.log(`Tavily credits used by this trace: ${credits}`);
