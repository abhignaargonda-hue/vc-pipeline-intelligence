import { neon } from '@neondatabase/serverless';
import { scoreVc } from '../lib/score.js';
import { diffSnapshots } from '../lib/pipeline.js';
const sql = neon(process.env.DATABASE_URL);
await sql`update runs set changes = ${JSON.stringify(await diffSnapshots(sql, 9))}::jsonb where id = 9`;
const vcs = await sql`select vc_id, firm, vc_group, stage_fit, partner_name, status, follow_up_score from vcs where follow_up_score > 0 order by follow_up_score desc`;
for (const v of vcs) {
  const sigs = await sql`select url, source, published_at::text published_at, type, relevance, confirmed, category_peer, event_key, summary, manual, deal_stage, deal_role, person, event_name, event_city, event_country, event_start::text event_start, event_end::text event_end from signals where accepted and vc_id = ${v.vc_id} and published_at >= '2026-09-12'`;
  const r = scoreVc(v, sigs, '2026-10-12');
  console.log(`\n${String(r.score).padStart(3)} ${v.firm} [${v.vc_group}] fit ${r.fit.mult}${r.fit.cap ? ' cap ' + r.fit.cap : ''} ${r.score !== v.follow_up_score ? '!! DB=' + v.follow_up_score : ''}`);
  r.items.slice(0, 3).forEach(i => console.log(`     ${i.points.toFixed(1).padStart(5)} ${i.type}/${i.relevance}/${i.stage}/${i.deal_role || '-'} x${i.copies} ${i.published_at} [${i.who}${i.person ? ': ' + i.person : ''}] ${i.summary.slice(0, 60)}`));
}
console.log((await sql`select count(*)::int n from vcs where follow_up_score = 0`)[0].n, 'VCs with no news found');
