// Imports the real, researched articles in seed/signal-test-set.json (each opened and dated on 12 Oct 2026) into `signals`,
// using the SAME Gemini labeller and code filters as the pipeline, then rescores. Source is marked "Research (12 Oct 2026)".
// Rejected cases are stored with their reason too. Usage: npm run import-research
import { readFileSync } from 'node:fs';
import { db } from '../lib/db.js';
import { labelItems } from '../lib/gemini.js';
import { rejectReason } from '../lib/score.js';
import { buildMatchers, preMatch, normUrl } from '../lib/sources.js';
import { loadVcs, insertSignal, recomputeScores, todayIST, costInr } from '../lib/pipeline.js';

const sql = db();
const today = todayIST();
const set = JSON.parse(readFileSync(new URL('../seed/signal-test-set.json', import.meta.url), 'utf8'));
const vcs = await loadVcs(sql);
const vcIds = new Set(vcs.map(v => v.vc_id));
const matchers = buildMatchers(vcs);
// Research notes (seed/vc-list-notes.md) carry facts found when the articles were opened, e.g. event dates.
const notes = readFileSync(new URL('../seed/vc-list-notes.md', import.meta.url), 'utf8').split('\n');
const notesFor = title => notes.filter(l => vcs.some(v => title.includes(v.firm) && l.includes(v.firm))).join(' ');
const cases = [...new Map(set.cases.filter(c => /^https?:/.test(c.url)).map(c => [normUrl(c.url), c])).values()];
const items = cases.map(c => {
  const it = { url: normUrl(c.url), title: c.title, snippet: `${c.title}. ${notesFor(c.title)}`.trim(), published: c.published, source: 'Research (12 Oct 2026)' };
  return { ...it, candidates: preMatch(it, matchers) };
});
const [run] = await sql`insert into runs (trigger) values ('research') returning id`;
const { labels, inputTokens, outputTokens } = await labelItems(items, vcs, today);
let counted = 0;
for (const l of labels) {
  const it = items[l.i]; if (!it) continue;
  const s = { ...l, url: it.url, title: it.title, source: it.source, published_at: it.published };
  s.rejected_reason = normUrl(l.url || '') !== it.url ? 'URL not fetched by the pipeline (Gemini URL mismatch)' : rejectReason(s, today, { vcIds });
  if (!s.vc_id || !vcIds.has(s.vc_id)) s.vc_id = null;
  if (await insertSignal(sql, run.id, s) && !s.rejected_reason) counted++;
  else if (s.vc_id && (s.event_start || s.event_name)) {
    // Already stored (e.g. found live by Tavily): fill event fields only if they are empty.
    await sql`update signals set event_name = coalesce(event_name, ${s.event_name || null}),
      event_start = coalesce(event_start, ${/^\d{4}-\d{2}-\d{2}$/.test(s.event_start || '') ? s.event_start : null}),
      event_end = coalesce(event_end, ${/^\d{4}-\d{2}-\d{2}$/.test(s.event_end || '') ? s.event_end : null})
      where url = ${s.url} and vc_id = ${s.vc_id}`;
  }
}
const changes = await recomputeScores(sql, today);
await sql`update runs set finished_at = now(), status = 'ok', items_fetched = ${items.length}, items_new = ${items.length},
  items_labelled = ${labels.length}, signals_counted = ${counted}, gemini_input_tokens = ${inputTokens}, gemini_output_tokens = ${outputTokens},
  cost_inr = ${costInr(0, inputTokens, outputTokens)}, changes = ${JSON.stringify(changes)}::jsonb, source_counts = ${JSON.stringify({ 'Research (seed/signal-test-set.json)': items.length })}::jsonb
  where id = ${run.id}`;
console.log(`Imported ${items.length} researched items, ${counted} counted; ${changes.length} VCs changed.`);
changes.forEach(c => console.log(`  ${c.firm}: ${c.from_score} -> ${c.to_score}`));
