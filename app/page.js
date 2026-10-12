import { db } from '@/lib/db';
import { scoreVc, groupEvents, personMatch, STATUSES } from '@/lib/score';
import { todayIST, diffSnapshots, bandKey } from '@/lib/pipeline';
import Dashboard from './Dashboard';

export const dynamic = 'force-dynamic';

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
  const [vcRows, accepted, feed, runs, statusRows, snap] = await Promise.all([
    sql`select vc_id, firm, vc_group, stage_fit, partner_name, partner_title, website, status, last_contact_date::text as last_contact_date,
          contact_history, personal_notes, last_signal_date::text as last_signal_date, signal_summary, follow_up_score,
          recommended_action, logistics_evidence, logistics_source_url, thesis_quote, thesis_url, partner_verified_on_firm_site
        from vcs order by follow_up_score desc, firm`,
    sql`select vc_id, url, title, source, published_at::text as published_at, type, relevance, confirmed, category_peer,
          event_name, event_start::text as event_start, event_end::text as event_end, event_key, summary, manual,
          deal_stage, deal_role, person, event_city, event_country
        from signals where accepted and vc_id is not null and published_at >= (${today}::date - 30)`,
    sql`select s.id, s.vc_id, v.firm, s.url, s.title, s.summary, s.type, s.relevance, s.source, s.manual, s.accepted, s.rejected_reason,
          s.published_at::text as published_at, s.event_name, s.event_start::text as event_start, s.event_end::text as event_end,
          s.event_key, s.deal_stage, s.person, s.event_city
        from signals s left join vcs v on v.vc_id = s.vc_id
        where s.vc_id is not null and (s.published_at >= (${today}::date - 30) or not s.accepted) order by s.published_at desc nulls last limit 600`,
    sql`select id, trigger, started_at, finished_at, status, items_fetched, items_new, items_labelled, signals_counted,
          tavily_credits, gemini_input_tokens, gemini_output_tokens, cost_inr, changes, errors, source_counts
        from runs order by id desc limit 80`,
    sql`select vc_id, status, note, created_at from vc_status order by created_at desc`,
    sql`select max(run_id) as id from run_scores`,
  ]);
  const statusOf = {}, statusHist = {};
  for (const r of statusRows) { statusOf[r.vc_id] ||= r; (statusHist[r.vc_id] ||= []).push({ status: r.status, note: r.note, at: iso(r.created_at) }); }
  // "What changed" = latest score snapshot vs the one before it (same numbers as every other screen).
  const changes = snap[0]?.id ? await diffSnapshots(sql, snap[0].id) : [];
  const snapRun = snap[0]?.id ? runs.find(r => Number(r.id) === Number(snap[0].id)) : null;

  const vcs = vcRows.map(v => {
    const st = statusOf[v.vc_id]?.status || v.status || '';
    const r = scoreVc(v, accepted.filter(s => s.vc_id === v.vc_id), today, { status: st });
    return {
      ...v,
      // One number everywhere: the score stored in the pipeline table (written by the same scoring code).
      score: v.follow_up_score,
      recomputed: r.score,
      band: bandKey(v.follow_up_score),
      my_status: st, my_status_note: statusOf[v.vc_id]?.note || null, status_history: statusHist[v.vc_id] || [],
      flags: r.flags,
      meet: r.meet.map(m => ({ event_name: m.event_name, event_city: m.event_city, event_country: m.event_country, event_start: m.event_start, event_end: m.event_end, url: m.url })),
      fit: r.fit, bonus: r.bonus, timing: Math.round(r.timing * 10) / 10, raw: Math.round(r.raw * 10) / 10,
      items: r.items.map((s, idx) => ({
        type: s.type, relevance: s.relevance, manual: s.manual, url: s.url, summary: s.summary, source: s.source,
        published_at: s.published_at, points: Math.round(s.points * 10) / 10, best: idx === 0 && s.points > 0,
        base: s.base, rel: s.rel, relMult: s.relMult, days: s.days, recMult: s.recMult, stage: s.stage, stageMult: s.stageMult,
        roleMult: s.roleMult, personMult: s.personMult, deal_role: s.deal_role, note: s.note, who: s.who, person: s.person,
        copies: s.copies, reports: s.reports, flags: s.flags, category_peer: s.category_peer,
      })),
    };
  });
  const byVc = Object.fromEntries(vcRows.map(v => [v.vc_id, v]));
  // Signals feed grouped by event (one row per VC + type + subject), with every report kept underneath.
  const events = groupEvents(feed.filter(f => f.accepted)).map(g => {
    const first = [...g].sort((a, b) => String(a.published_at).localeCompare(String(b.published_at)))[0];
    return { key: `${first.vc_id}|${first.id}`, vc_id: first.vc_id, firm: first.firm, type: first.type, relevance: first.relevance,
      manual: first.manual, published_at: first.published_at, summary: first.summary, url: first.url, deal_stage: g.find(x => x.deal_stage && x.deal_stage !== 'unknown')?.deal_stage || null,
      who: personMatch(g.find(x => x.person) || first, byVc[first.vc_id]), person: g.find(x => x.person)?.person || null,
      event_name: g.find(x => x.event_name)?.event_name || null, event_start: g.find(x => x.event_start)?.event_start || null,
      event_end: g.find(x => x.event_end)?.event_end || null, event_city: g.find(x => x.event_city)?.event_city || null,
      reports: g.map(x => ({ url: x.url, source: x.source, published_at: x.published_at, summary: x.summary })) };
  }).sort((a, b) => String(b.published_at).localeCompare(String(a.published_at)));
  const rejected = feed.filter(f => !f.accepted).map(f => ({ ...f, id: Number(f.id) }));

  const lastRun = runs.find(r => ['cron', 'manual', 'verify'].includes(r.trigger) && r.status !== 'running') || null;
  const data = {
    today,
    nextRun: nextRun(),
    vcs,
    events, rejected, statuses: STATUSES,
    changes, changesRun: snapRun ? { id: Number(snapRun.id), trigger: snapRun.trigger, at: iso(snapRun.finished_at || snapRun.started_at) } : null,
    runs: runs.map(r => ({ ...r, id: Number(r.id), started_at: iso(r.started_at), finished_at: iso(r.finished_at), cost_inr: Number(r.cost_inr) })),
    lastRun: lastRun ? { ...lastRun, id: Number(lastRun.id), started_at: iso(lastRun.started_at), finished_at: iso(lastRun.finished_at), cost_inr: Number(lastRun.cost_inr) } : null,
  };
  return <Dashboard data={data} initialTab={sp?.tab || 'overview'} />;
}
