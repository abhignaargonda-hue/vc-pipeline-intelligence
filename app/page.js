import { db } from '@/lib/db';
import { scoreVc, groupEvents, personMatch, STATUSES, bandKey, CHECK_OUT_REASON, daysBetween } from '@/lib/score';
import { todayIST, diffSnapshots } from '@/lib/pipeline';
import { manualSnapshot, guardActive } from '@/lib/verify';
import Dashboard from './Dashboard';

export const dynamic = 'force-dynamic';

const iso = d => (d ? new Date(d).toISOString() : null);
const TABS = ['today', 'pipeline', 'changes', 'calendar', 'signals', 'report'];
const LEGACY = { overview: 'today', runs: 'report' };

// Next scheduled cron: Mon/Thu 01:00 UTC (6:30am IST)
function nextRun(now = new Date()) {
  for (let i = 0; i < 8; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + i, 1, 0));
    if ([1, 4].includes(d.getUTCDay()) && d > now) return d.toISOString();
  }
  return null;
}

// ---- Read-only fields derived from stored data (UI v2) ----
const PLAIN = { S1: 'New investment', S2: 'Blog post', S3: 'Interview', S4a: 'Spoke at event', S4b: 'Spoke at event', S5: 'New fund',
  S6: 'Applications open', S7: 'Follow-on', N1: 'Category peer', N2: 'Partner change' };
// From seed/company-profile.md section 1 (the statement's own words): B2B logistics SaaS, raising a Seed round, India.
const PITCH = "We're building a B2B logistics SaaS in India and are raising our seed round";
const plainOf = (type, stage) => (type === 'S7' && ['ipo', 'exit', 'secondary'].includes(stage) ? 'IPO / exit (context)' : PLAIN[type] || type);
const dShort = d => (d ? new Date(String(d).slice(0, 10) + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }) : '');

// Company / fund / person the event is about: first word of Gemini's event_key, kept only if it appears in the stored summary
// (the summary's own spelling is used). Otherwise null, and the clause is dropped.
function subjectOf(item) {
  const first = String(item.event_key || '').split(/[^A-Za-z0-9]+/).filter(Boolean)[0];
  if (!first || first.length < 3) return null;
  // the word as spelled in the summary (case-insensitive find), plus up to two following words that are
  // genuinely capitalised in the summary ("Dodge AI", "Litemed India"); trailing punctuation dropped.
  const summary = String(item.summary || '');
  const m = summary.match(new RegExp(`\\b${first.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[A-Za-z0-9]*`, 'i'));
  if (!m) return null;
  const tail = summary.slice(m.index + m[0].length).match(/^(?:[ -][A-Z][A-Za-z0-9]*){0,2}/)[0];
  return (m[0] + tail).replace(/\s+(Raises|Raised|Leads|Led|Secures|Closes|Marks|Launches|Sets|Is|Has|And|Pre|Series|Seed|Rs)\b.*$/, '').trim();
}

// One template per signal type, filled only from stored fields; a missing field drops its clause.
function opener(v, it, today) {
  if (!it) return null;
  const first = (v.partner_name || '').replace(/^(dr|mr|ms|mrs)\.?\s+/i, '').split(/\s+/)[0];
  const hi = first ? `Hi ${first},` : `Hi ${v.firm} team,`;
  const co = subjectOf(it);
  const date = dShort(it.published_at);
  const on = date ? ` on ${date}` : '';
  const upcoming = (it.event_start || '') >= today;
  switch (it.type) {
    case 'S1': return `${hi} saw ${v.firm} backed ${co || 'a new company'}${on}. ${PITCH}, and would value 20 minutes.`;
    case 'S5': return `${hi} congratulations on ${v.firm}'s new fund${date ? ` (${date})` : ''}. ${PITCH}, and would value 20 minutes as you start deploying.`;
    case 'S2': return `${hi} read ${v.firm}'s recent post${date ? ` (${date})` : ''}: ${it.summary.replace(/\.$/, '')}. ${PITCH}; would value your view.`;
    case 'S3': return `${hi} came across your recent interview${date ? ` (${date})` : ''}: ${it.summary.replace(/\.$/, '')}. ${PITCH}; would value 20 minutes.`;
    case 'S4a': case 'S4b': return it.event_name && upcoming
      ? `${hi} saw you'll be at ${it.event_name}${it.event_city ? ` in ${it.event_city}` : ''}. ${PITCH}; would love to say hello there.`
      : `${hi} saw your session${it.event_name ? ` at ${it.event_name}` : ''}${on}. ${PITCH}, and would value 20 minutes.`;
    case 'S6': return `${hi} saw ${v.firm}'s applications are open${on}. ${PITCH}; we'd like to apply and would value a quick chat.`;
    case 'S7': return `${hi} saw ${v.firm} doubled down on ${co || 'a portfolio company'}${on}. ${PITCH}, and would value 20 minutes.`;
    default: return null;
  }
}

function whereWeStand(status, lastContact, today) {
  const s = (status || '').trim();
  if (!s) return 'Not contacted';
  if (/waiting/i.test(s) && lastContact) return `Waiting · ${daysBetween(lastContact, today)} days`;
  return s;
}

export default async function Page({ searchParams }) {
  const sp = await searchParams;
  const sql = db();
  const today = todayIST();
  const [vcRows, accepted, feed, runs, statusRows, checkoutRows, snapRuns, notRelevant, anyItems, notes, lastManual, verify, guard] = await Promise.all([
    sql`select vc_id, firm, vc_group, stage_fit, partner_name, partner_title, website, status, last_contact_date::text as last_contact_date,
          contact_history, personal_notes, last_signal_date::text as last_signal_date, signal_summary, follow_up_score,
          recommended_action, logistics_evidence, logistics_source_url, thesis_quote, thesis_url, partner_verified_on_firm_site,
          vc_type, second_logistics_deal, second_logistics_source_url, watch_outs, confidence, team_page_url
        from vcs order by follow_up_score desc, firm`,
    sql`select vc_id, url, title, source, published_at::text as published_at, type, relevance, confirmed, category_peer,
          event_name, event_start::text as event_start, event_end::text as event_end, event_key, summary, manual,
          deal_stage, deal_role, person, event_city, event_country
        from signals where accepted and vc_id is not null and published_at >= (${today}::date - 30)`,
    sql`select s.id, s.vc_id, v.firm, s.url, s.title, s.summary, s.type, s.relevance, s.source, s.manual, s.accepted, s.rejected_reason,
          s.published_at::text as published_at, s.event_name, s.event_start::text as event_start, s.event_end::text as event_end,
          s.event_key, s.deal_stage, s.person, s.event_city, s.event_country
        from signals s left join vcs v on v.vc_id = s.vc_id
        where s.vc_id is not null and (s.published_at >= (${today}::date - 30) or not s.accepted) order by s.published_at desc nulls last limit 600`,
    sql`select id, trigger, started_at, finished_at, status, items_fetched, items_new, items_labelled, signals_counted,
          tavily_credits, gemini_input_tokens, gemini_output_tokens, cost_inr, changes, errors, source_counts
        from runs order by id desc limit 80`,
    sql`select vc_id, status, note, created_at from vc_status order by created_at desc`,
    sql`select vc_id, url, source, published_at::text as published_at, type, relevance, summary from signals
        where rejected_reason = ${CHECK_OUT_REASON} and vc_id is not null
          and published_at < (${today}::date - 30) and published_at >= (${today}::date - 60)`,
    sql`select distinct run_id from run_scores order by run_id desc limit 10`,
    sql`select distinct on (vc_id) vc_id, summary, url, published_at::text as published_at from signals
        where vc_id is not null and rejected_reason = 'not relevant' and published_at >= (${today}::date - 30)
        order by vc_id, published_at desc`,
    sql`select vc_id, count(*)::int as n from signals where vc_id is not null and published_at >= (${today}::date - 60) group by vc_id`,
    sql`select id, note_date::text as note_date, body, created_at, updated_at from calendar_notes order by note_date desc, created_at desc limit 500`,
    sql`select max(started_at) as last from runs where trigger in ('manual','verify')`,
    manualSnapshot().catch(e => ({ error: e.message })),
    guardActive().catch(() => false),
  ]);

  const statusOf = {}, statusHist = {};
  for (const r of statusRows) { statusOf[r.vc_id] ||= r; (statusHist[r.vc_id] ||= []).push({ status: r.status, note: r.note, at: iso(r.created_at) }); }
  const nrBy = Object.fromEntries(notRelevant.map(r => [r.vc_id, r]));
  const itemsBy = Object.fromEntries(anyItems.map(r => [r.vc_id, r.n]));

  const vcs = vcRows.map(v => {
    const st = statusOf[v.vc_id]?.status || v.status || '';
    const r = scoreVc(v, accepted.filter(s => s.vc_id === v.vc_id), today, { status: st, checkout: checkoutRows.filter(s => s.vc_id === v.vc_id) });
    const band = bandKey(v.follow_up_score, v.recommended_action);
    const best = r.items.find(i => i.points > 0) || null;
    let skip = null;
    if (['Passed', 'Not now'].includes(st)) skip = `Your status: ${st}`;
    else if (band === 'low' || band === 'unknown') {
      if (r.items.length && r.items.every(i => ['S4a', 'S4b'].includes(i.type) && i.rel === 'general')) skip = 'Only general event news';
      else if (nrBy[v.vc_id] && !best) skip = `Latest news not logistics: ${nrBy[v.vc_id].summary}`;
      else if (band === 'low') skip = `Weak signal only: ${best?.summary || r.items[0]?.summary || 'low score'}`;
      else skip = 'No news found in 30 days';
    }
    return {
      ...v,
      score: v.follow_up_score, recomputed: r.score, band,
      my_status: st, my_status_note: statusOf[v.vc_id]?.note || null, status_history: statusHist[v.vc_id] || [],
      stand: whereWeStand(st, v.last_contact_date, today),
      opener: opener(v, best, today),
      what_line: best ? [plainOf(best.type, best.stage), subjectOf(best) || best.event_name, dShort(best.published_at)].filter(Boolean).join(' · ') : null,
      skip, items60: itemsBy[v.vc_id] || 0,
      checkout: r.checkout ? { url: r.checkout.url, summary: r.checkout.summary, published_at: r.checkout.published_at, source: r.checkout.source, type: r.checkout.type } : null,
      flags: r.flags,
      meet: r.meet.map(m => ({ event_name: m.event_name, event_city: m.event_city, event_country: m.event_country, event_start: m.event_start, event_end: m.event_end, url: m.url })),
      bonus: r.bonus, extra: r.extra, cap: r.cap, raw: Math.round(r.raw * 10) / 10,
      items: r.items.map((s, idx) => ({
        type: s.type, plain: plainOf(s.type, s.stage), relevance: s.relevance, manual: s.manual, url: s.url, summary: s.summary, source: s.source,
        published_at: s.published_at, points: Math.round(s.points * 10) / 10, best: idx === 0 && s.points > 0,
        what: s.what, logistics: s.logistics, fresh: s.fresh, led: s.led, rel: s.rel, days: s.days, stage: s.stage,
        deal_role: s.deal_role, note: s.note, who: s.who, person: s.person,
        copies: s.copies, reports: s.reports, flags: s.flags, category_peer: s.category_peer,
      })),
    };
  });

  const byVc = Object.fromEntries(vcRows.map(v => [v.vc_id, v]));
  const events = groupEvents(feed.filter(f => f.accepted)).map(g => {
    const first = [...g].sort((a, b) => String(a.published_at).localeCompare(String(b.published_at)))[0];
    const stage = g.find(x => x.deal_stage && x.deal_stage !== 'unknown')?.deal_stage || null;
    return { key: `${first.vc_id}|${first.id}`, vc_id: first.vc_id, firm: first.firm, type: first.type, plain: plainOf(first.type, stage),
      relevance: first.relevance, manual: first.manual, published_at: first.published_at, summary: first.summary, url: first.url,
      deal_stage: g.find(x => x.deal_stage && x.deal_stage !== 'unknown')?.deal_stage || null,
      who: personMatch(g.find(x => x.person) || first, byVc[first.vc_id]), person: g.find(x => x.person)?.person || null,
      event_name: g.find(x => x.event_name)?.event_name || null, event_start: g.find(x => x.event_start)?.event_start || null,
      event_end: g.find(x => x.event_end)?.event_end || null, event_city: g.find(x => x.event_city)?.event_city || null,
      event_country: g.find(x => x.event_country)?.event_country || null,
      reports: g.map(x => ({ url: x.url, source: x.source, published_at: x.published_at, summary: x.summary })) };
  }).sort((a, b) => String(b.published_at).localeCompare(String(a.published_at)));
  const rejected = feed.filter(f => !f.accepted).map(f => ({ ...f, id: Number(f.id) }));

  // Changes: every snapshot run vs the snapshot before it (existing run_scores data).
  const runById = Object.fromEntries(runs.map(r => [Number(r.id), r]));
  const changes = [];
  for (const { run_id } of snapRuns) {
    const rows = await diffSnapshots(sql, run_id);
    const r = runById[Number(run_id)];
    changes.push({ run: { id: Number(run_id), trigger: r?.trigger || '', at: iso(r?.finished_at || r?.started_at) },
      prev: rows[0]?.prev_run || null,
      rows: rows.map(c => ({ ...c, from_band: bandKey(c.from_score, c.from_action), to_band: bandKey(c.to_score, c.to_action),
        url: vcs.find(v => v.vc_id === c.vc_id)?.items.find(i => i.best)?.url || vcs.find(v => v.vc_id === c.vc_id)?.checkout?.url || null })) });
  }

  const pipelineRuns = runs.filter(r => ['cron', 'manual', 'verify'].includes(r.trigger));
  const lastRun = pipelineRuns.find(r => r.status !== 'running') || null;
  const lastManualAt = lastManual[0]?.last ? new Date(lastManual[0].last).getTime() : 0;
  const tab = LEGACY[sp?.tab] || sp?.tab;

  const data = {
    today, nextRun: nextRun(), vcs, events, rejected, statuses: STATUSES, changes,
    nextAllowedAt: lastManualAt ? new Date(lastManualAt + 30 * 60 * 1000).toISOString() : null,
    runs: runs.map(r => ({ ...r, id: Number(r.id), started_at: iso(r.started_at), finished_at: iso(r.finished_at), cost_inr: Number(r.cost_inr) })),
    lastRun: lastRun ? { ...lastRun, id: Number(lastRun.id), started_at: iso(lastRun.started_at), finished_at: iso(lastRun.finished_at), cost_inr: Number(lastRun.cost_inr) } : null,
    verify: { ...verify, guard },
    gaps: vcs.filter(v => !v.items60).map(v => ({ vc_id: v.vc_id, firm: v.firm })),
    notes: notes.map(n => ({ ...n, id: Number(n.id), created_at: iso(n.created_at), updated_at: iso(n.updated_at) })),
  };
  return <Dashboard data={data} initialTab={TABS.includes(tab) ? tab : 'today'} />;
}
