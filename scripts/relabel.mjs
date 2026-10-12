// One-off (v3): re-labels stored live signals with the v3 label fields (deal_stage, deal_role, person, event city)
// using the SAME Gemini labeller, from the stored title + summary of the fetched item. Then rescores.
// Only rows that came from live sources are touched; nothing is added. Usage: npm run relabel
import { db } from '../lib/db.js';
import { labelItems } from '../lib/gemini.js';
import { rejectReason } from '../lib/score.js';
import { loadVcs, recomputeScores, todayIST, costInr } from '../lib/pipeline.js';

const sql = db();
const today = todayIST();
const vcs = await loadVcs(sql);
const vcIds = new Set(vcs.map(v => v.vc_id));
const rows = await sql`select id, vc_id, url, title, summary, source, published_at::text p from signals
  where vc_id is not null and not manual and published_at >= (${today}::date - 30) and (accepted or rejected_reason in ('not relevant','Tier 1 type needs core/adjacent relevance'))`;
const [run] = await sql`insert into runs (trigger) values ('relabel') returning id`;
let tin = 0, tout = 0, updated = 0;
const batches = []; for (let i = 0; i < rows.length; i += 12) batches.push(rows.slice(i, i + 12));
await Promise.all(batches.map(async batch => {
  const items = batch.map(r => ({ url: r.url, title: r.title, snippet: `${r.title}. ${r.summary || ''}`, published: r.p, source: r.source, candidates: [r.vc_id] }));
  const res = await labelItems(items, vcs, today);
  tin += res.inputTokens; tout += res.outputTokens;
  for (const [k, r] of batch.entries()) {
    const l = res.labels.find(x => x.i === k && x.vc_id === r.vc_id);
    if (!l) continue;
    const s = { ...l, url: r.url, published_at: r.p, vc_id: r.vc_id };
    const reason = rejectReason(s, today, { vcIds });
    await sql`update signals set type = ${l.type}, relevance = ${l.relevance}, confirmed = ${l.confirmed}, category_peer = ${!!l.category_peer},
      deal_stage = ${l.deal_stage || null}, deal_role = ${l.deal_role || null}, person = ${l.person || null},
      event_city = ${l.event_city || null}, event_country = ${l.event_country || null}, event_key = ${l.event_key || null},
      event_name = coalesce(${l.event_name || null}, event_name), summary = ${l.summary || r.summary},
      accepted = ${!reason}, rejected_reason = ${reason} where id = ${r.id}`;
    updated++;
  }
}));
const changes = await recomputeScores(sql, today, run.id);
await sql`update runs set finished_at = now(), status = 'ok', items_labelled = ${updated}, gemini_input_tokens = ${tin}, gemini_output_tokens = ${tout},
  cost_inr = ${costInr(0, tin, tout)}, changes = ${JSON.stringify(changes)}::jsonb where id = ${run.id}`;
console.log(`Relabelled ${updated}/${rows.length} stored live signals (run #${run.id}); ${changes.length} VCs changed.`);
