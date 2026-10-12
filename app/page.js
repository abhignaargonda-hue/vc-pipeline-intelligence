import { db } from '@/lib/db';
import { scoreVc, itemBreakdown } from '@/lib/score';
import { todayIST } from '@/lib/pipeline';
import Dashboard from './Dashboard';

export const dynamic = 'force-dynamic';

const bandOf = s => (s >= 50 ? 'reach' : s >= 25 ? 'warm' : s >= 1 ? 'low' : 'quiet');
const iso = d => (d ? new Date(d).toISOString() : null);

// Next scheduled cron: Mon/Thu 01:00 UTC (6:30am IST)
function nextRun(now = new Date()) {
  for (let i = 0; i < 8; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + i, 1, 0));
    if ([1, 4].includes(d.getUTCDay()) && d > now) return d.toISOString();
  }
  return null;
}

export default async function Page({ searchParams }) {
  const sp = await searchParams;
  const sql = db();
  const today = todayIST();
  const [vcRows, accepted, feed, runs] = await Promise.all([
    sql`select vc_id, firm, vc_group, partner_name, partner_title, website, status, last_contact_date::text as last_contact_date,
          contact_history, personal_notes, last_signal_date::text as last_signal_date, signal_summary, follow_up_score,
          recommended_action, logistics_evidence, thesis_quote from vcs order by follow_up_score desc, firm`,
    sql`select vc_id, url, title, source, published_at::text as published_at, type, relevance, confirmed, category_peer,
          event_name, event_start::text as event_start, event_end::text as event_end, event_key, summary, manual
        from signals where accepted and vc_id is not null and published_at >= (${today}::date - 30)`,
    sql`select s.id, s.vc_id, v.firm, s.url, s.title, s.summary, s.type, s.relevance, s.source, s.manual, s.accepted, s.rejected_reason,
          s.published_at::text as published_at, s.event_name, s.event_start::text as event_start, s.event_end::text as event_end
        from signals s left join vcs v on v.vc_id = s.vc_id
        where s.vc_id is not null order by s.accepted desc, s.published_at desc nulls last limit 400`,
    sql`select id, trigger, started_at, finished_at, status, items_fetched, items_new, items_labelled, signals_counted,
          tavily_credits, gemini_input_tokens, gemini_output_tokens, cost_inr, changes, errors, source_counts
        from runs order by id desc limit 60`,
  ]);

  const vcs = vcRows.map(v => {
    const r = scoreVc(v, accepted.filter(s => s.vc_id === v.vc_id), today);
    const counted = r.items.filter(i => i.points > 0);
    return {
      ...v,
      score: v.follow_up_score,
      band: bandOf(v.follow_up_score),
      flags: r.flags,
      meet: r.meet.map(m => ({ event_name: m.event_name, event_start: m.event_start, event_end: m.event_end, url: m.url })),
      bonus: counted.length && v.vc_group === 'logistics_active' ? 10 : 0,
      items: r.items.map((s, idx) => ({
        type: s.type, relevance: s.relevance, manual: s.manual, url: s.url, summary: s.summary, source: s.source,
        published_at: s.published_at, points: Math.round(s.points * 10) / 10, best: idx === 0 && s.points > 0,
        ...itemBreakdown(s, today),
      })),
    };
  });

  const lastRun = runs.find(r => ['cron', 'manual', 'verify', 'research'].includes(r.trigger) && r.status !== 'running') || null;
  const data = {
    today,
    nextRun: nextRun(),
    vcs,
    feed: feed.map(f => ({ ...f, id: Number(f.id) })),
    runs: runs.map(r => ({ ...r, id: Number(r.id), started_at: iso(r.started_at), finished_at: iso(r.finished_at), cost_inr: Number(r.cost_inr) })),
    lastRun: lastRun ? { ...lastRun, id: Number(lastRun.id), started_at: iso(lastRun.started_at), finished_at: iso(lastRun.finished_at), cost_inr: Number(lastRun.cost_inr) } : null,
  };
  return <Dashboard data={data} initialTab={sp?.tab || 'overview'} />;
}
