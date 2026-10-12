// The twice-weekly pipeline: fetch -> clean -> Gemini label -> code score -> write 4 columns via app_update_vc_signal().
import { db } from './db.js';
import { fetchFeeds, fetchTavily, normUrl, buildMatchers, preMatch } from './sources.js';
import { labelItems } from './gemini.js';
import { scoreVc, rejectReason, daysBetween } from './score.js';

// Cost assumptions (design choice; override with env). Gemini Flash list price per 1M tokens, Tavily pay-as-you-go per credit.
const USD_INR = Number(process.env.USD_INR || 88);
const GEMINI_IN_USD = Number(process.env.GEMINI_IN_USD_PER_M || 0.5);
const GEMINI_OUT_USD = Number(process.env.GEMINI_OUT_USD_PER_M || 3.0);
const TAVILY_USD = Number(process.env.TAVILY_USD_PER_CREDIT || 0.008);

export const todayIST = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
export const costInr = (credits, tin, tout) =>
  Math.round((credits * TAVILY_USD + (tin / 1e6) * GEMINI_IN_USD + (tout / 1e6) * GEMINI_OUT_USD) * USD_INR * 100) / 100;

// Never selects contact_history or personal_notes.
export const loadVcs = sql => sql`select vc_id, firm, vc_group, stage_fit, partner_name, aliases, guard_terms, status from vcs order by vc_id`;

// Vikram's latest status per VC from the dashboard (separate vc_status table; falls back to vcs.status).
export const latestStatus = async sql => Object.fromEntries((await sql`
  select distinct on (vc_id) vc_id, status from vc_status order by vc_id, created_at desc`).map(r => [r.vc_id, r.status]));

export async function insertSignal(sql, runId, s) {
  const rows = await sql`
    insert into signals (run_id, vc_id, url, title, source, published_at, type, relevance, confirmed, category_peer,
      event_name, event_start, event_end, event_key, summary, manual, accepted, rejected_reason,
      deal_stage, deal_role, person, event_city, event_country)
    values (${runId}, ${s.vc_id || null}, ${s.url}, ${s.title || null}, ${s.source}, ${s.published_at || null}, ${s.type || null},
      ${s.relevance || null}, ${s.confirmed ?? null}, ${!!s.category_peer}, ${s.event_name || null}, ${validDate(s.event_start)},
      ${validDate(s.event_end)}, ${s.event_key || null}, ${s.summary || null}, ${!!s.manual}, ${!s.rejected_reason}, ${s.rejected_reason || null},
      ${s.deal_stage || null}, ${s.deal_role || null}, ${s.person || null}, ${s.event_city || null}, ${s.event_country || null})
    on conflict do nothing returning id`;
  return rows.length > 0;
}
const validDate = d => (d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null);

// Recompute scores from every accepted signal of the last 30 days, write the 4 columns through the DB function,
// and store a snapshot for this run (run_scores). "What changed" = this snapshot vs the previous one.
export async function recomputeScores(sql, today, runId, onlyVcIds = null) {
  const vcs = await loadVcs(sql);
  const statuses = await latestStatus(sql);
  const sigs = await sql`
    select vc_id, url, title, source, published_at::text as published_at, type, relevance, confirmed, category_peer,
      event_name, event_start::text as event_start, event_end::text as event_end, event_key, summary, manual,
      deal_stage, deal_role, person, event_city, event_country
    from signals where accepted and vc_id is not null and published_at >= (${today}::date - 30)`;
  const targets = vcs.filter(v => !onlyVcIds || onlyVcIds.includes(v.vc_id));
  const results = {};
  for (let i = 0; i < targets.length; i += 10) {
    await Promise.all(targets.slice(i, i + 10).map(async v => {
      const r = scoreVc(v, sigs.filter(s => s.vc_id === v.vc_id), today, { status: statuses[v.vc_id] });
      results[v.vc_id] = r;
      await sql`select app_update_vc_signal(${v.vc_id}, ${r.last_signal_date}, ${r.summary}, ${r.score}, ${r.action}, ${JSON.stringify(r.sources)}::jsonb)`;
    }));
  }
  if (!runId) return [];
  // Snapshot all 50 (untouched VCs keep their current values)
  const now = await sql`select vc_id, firm, follow_up_score, recommended_action, signal_summary from vcs`;
  for (const v of now) {
    await sql`insert into run_scores (run_id, vc_id, score, band, action, summary)
      values (${runId}, ${v.vc_id}, ${v.follow_up_score}, ${bandKey(v.follow_up_score)}, ${v.recommended_action}, ${v.signal_summary})
      on conflict (run_id, vc_id) do update set score = excluded.score, band = excluded.band, action = excluded.action, summary = excluded.summary`;
  }
  return diffSnapshots(sql, runId);
}

export const bandKey = s => (s >= 50 ? 'reach' : s >= 25 ? 'warm' : s >= 1 ? 'low' : 'unknown');

export async function diffSnapshots(sql, runId) {
  const [prev] = await sql`select max(run_id) as id from run_scores where run_id < ${runId}`;
  if (!prev?.id) return [];
  const rows = await sql`
    select c.vc_id, v.firm, coalesce(p.score, 0) as from_score, c.score as to_score, p.action as from_action, c.action as to_action, c.summary
    from run_scores c join vcs v using (vc_id) left join run_scores p on p.vc_id = c.vc_id and p.run_id = ${prev.id}
    where c.run_id = ${runId} and (coalesce(p.score, -1) <> c.score or coalesce(p.action, '') <> coalesce(c.action, ''))
      and not (coalesce(p.score, 0) = 0 and c.score = 0)
    order by c.score desc`;
  return rows.map(r => ({ ...r, prev_run: Number(prev.id) }));
}

// Tavily lookback. Steady state (Mon + Thu runs): ~7 days, the gap since the last run.
// The rubric's window is 30 days, so if no earlier successful run has searched back to (today - 30),
// this run searches 30 days (still 1 basic search per VC). Fixes the cold-start gap found in the coverage trace.
export async function tavilyLookback(sql, today) {
  const rows = await sql`select (started_at at time zone 'Asia/Kolkata')::date::text as d, coalesce(tavily_days, 7) as days
    from runs where status = 'ok' and tavily_credits > 0 and started_at > now() - interval '30 days' order by started_at`;
  if (!rows.length) return 30;
  const coveredFrom = rows.map(r => daysBetween(r.d, today) + r.days).reduce((a, b) => Math.max(a, b), 0); // days back covered
  if (coveredFrom < 30) return 30;
  const sinceLast = daysBetween(rows.at(-1).d, today) + 1;
  return Math.min(30, Math.max(7, sinceLast));
}

export async function runPipeline(trigger) {
  const sql = db();
  const today = todayIST();
  const [run] = await sql`insert into runs (trigger) values (${trigger}) returning id`;
  const errors = [];
  let tin = 0, tout = 0, credits = 0, fetched = 0, newCount = 0, labelled = 0, counted = 0;
  const sourceCounts = {};
  try {
    const vcs = await loadVcs(sql);
    const vcIds = new Set(vcs.map(v => v.vc_id));

    // 1. Collect (feeds + one Tavily search per VC) in parallel
    const tavilyDays = await tavilyLookback(sql, today);
    sourceCounts._tavily_lookback_days = tavilyDays;
    const [feeds, tav] = await Promise.all([fetchFeeds(), fetchTavily(vcs, tavilyDays)]);
    errors.push(...feeds.errors, ...tav.errors);
    credits = tav.credits;
    Object.assign(sourceCounts, feeds.counts, { Tavily: tav.items.length });
    const all = [...feeds.items, ...tav.items];
    fetched = all.length;

    // 2. Clean: 30-day window, real URLs, dedupe, pre-match
    const byUrl = new Map();
    let dropped = 0;
    for (const it of all) {
      if (!/^https?:\/\//.test(it.url || '') || !it.published) { dropped++; continue; }
      const d = daysBetween(it.published, today);
      if (d > 30 || d < -1) { dropped++; continue; }
      const key = normUrl(it.url);
      const prev = byUrl.get(key);
      if (prev) { if (it.vc_hint) prev.hints.add(it.vc_hint); continue; }
      byUrl.set(key, { ...it, key, hints: new Set(it.vc_hint ? [it.vc_hint] : []) });
    }
    sourceCounts._dropped_old_or_undated = dropped;
    const fetchedKeys = new Set(byUrl.keys());
    const keys = [...byUrl.keys()];
    const seen = keys.length ? await sql`select distinct url from signals where url = any(${keys})` : [];
    const seenSet = new Set(seen.map(r => r.url));
    const fresh = [...byUrl.values()].filter(it => !seenSet.has(it.key));
    newCount = fresh.length;

    const matchers = buildMatchers(vcs);
    const toLabel = [];
    for (const it of fresh) {
      const candidates = [...new Set([...it.hints, ...preMatch(it, matchers)])];
      if (!candidates.length) {
        await insertSignal(sql, run.id, { url: it.key, title: it.title, source: it.source, published_at: it.published, rejected_reason: 'no tracked VC named in item' });
      } else toLabel.push({ ...it, candidates });
    }

    // 3. Gemini labels (batches of 12, run in parallel)
    const batches = [];
    for (let i = 0; i < toLabel.length; i += 12) batches.push(toLabel.slice(i, i + 12));
    for (let i = 0; i < batches.length; i += 20) {
      await Promise.all(batches.slice(i, i + 20).map(async batch => {
        try {
          const r = await labelItems(batch, vcs, today);
          tin += r.inputTokens; tout += r.outputTokens;
          const labelledIdx = new Set();
          for (const l of r.labels) {
            const it = batch[l.i];
            if (!it) continue;
            labelledIdx.add(l.i);
            labelled++;
            const s = { ...l, url: it.key, title: it.title, source: it.source, published_at: it.published };
            // Hard filters (rubric section 2). URL must be one we fetched: a URL Gemini changes/invents is rejected.
            s.rejected_reason = !fetchedKeys.has(normUrl(l.url || '')) ? 'URL not fetched by the pipeline (Gemini URL mismatch)'
              : rejectReason(s, today, { vcIds });
            if (!s.vc_id || !vcIds.has(s.vc_id)) s.vc_id = null;
            if (await insertSignal(sql, run.id, s) && !s.rejected_reason) counted++;
          }
          for (let k = 0; k < batch.length; k++) if (!labelledIdx.has(k)) {
            const it = batch[k];
            await insertSignal(sql, run.id, { url: it.key, title: it.title, source: it.source, published_at: it.published, rejected_reason: 'not labelled by Gemini' });
          }
        } catch (e) { errors.push(`Gemini batch: ${e.message}`); }
      }));
    }

    // 4. Score in code and write only the 4 columns
    const changes = await recomputeScores(sql, today, run.id);
    await sql`update runs set tavily_days = ${tavilyDays}, finished_at = now(), status = ${errors.some(e => e.startsWith('Gemini')) ? 'error' : 'ok'},
      items_fetched = ${fetched}, items_new = ${newCount}, items_labelled = ${labelled}, signals_counted = ${counted},
      tavily_credits = ${credits}, gemini_input_tokens = ${tin}, gemini_output_tokens = ${tout},
      cost_inr = ${costInr(credits, tin, tout)}, source_counts = ${JSON.stringify(sourceCounts)}::jsonb,
      errors = ${JSON.stringify(errors)}::jsonb, changes = ${JSON.stringify(changes)}::jsonb
      where id = ${run.id}`;
    return { run_id: run.id, fetched, new: newCount, labelled, counted, credits, tin, tout, changes: changes.length, errors };
  } catch (e) {
    errors.push(`Fatal: ${e.message}`);
    await sql`update runs set finished_at = now(), status = 'error', items_fetched = ${fetched}, tavily_credits = ${credits},
      gemini_input_tokens = ${tin}, gemini_output_tokens = ${tout}, cost_inr = ${costInr(credits, tin, tout)},
      errors = ${JSON.stringify(errors)}::jsonb where id = ${run.id}`;
    throw e;
  }
}

// Log-a-signal: processed immediately. Relevance treated as core (D8); the 30-day rule still applies.
export async function logSignal({ vc_id, url, post_date, line }) {
  const sql = db();
  const today = todayIST();
  if (!/^https?:\/\/\S+$/.test(url || '')) return { ok: false, message: 'Link must start with http(s)://' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(post_date || '')) return { ok: false, message: 'Post date must be YYYY-MM-DD' };
  if (!line || line.trim().length < 5) return { ok: false, message: 'Add one line describing the post' };
  const vcs = await loadVcs(sql);
  const vc = vcs.find(v => v.vc_id === vc_id);
  if (!vc) return { ok: false, message: 'Pick a tracked VC' };

  const [run] = await sql`insert into runs (trigger) values ('log') returning id`;
  const key = normUrl(url);
  const base = { vc_id, url: key, title: line.trim(), source: 'logged by Vikram', published_at: post_date, manual: true, relevance: 'core', confirmed: true };
  let tin = 0, tout = 0;
  const errors = [];
  const d = daysBetween(post_date, today);
  let s;
  if (d > 30 || d < -1) {
    s = { ...base, type: null, summary: line.trim(), rejected_reason: d > 30 ? `older than 30 days (${d} d)` : 'published date in the future' };
  } else {
    try {
      const r = await labelItems([{ url: key, title: line.trim(), published: post_date, source: 'logged by Vikram', candidates: [vc_id], snippet: line.trim() }], [vc], today);
      tin = r.inputTokens; tout = r.outputTokens;
      const l = r.labels.find(x => x.vc_id === vc_id) || r.labels[0] || {};
      s = { ...base, type: l.type || 'none', confirmed: l.confirmed ?? true, category_peer: l.category_peer,
        deal_stage: l.deal_stage, deal_role: l.deal_role, person: l.person, event_city: l.event_city, event_country: l.event_country,
        event_key: l.event_key, event_name: l.event_name, event_start: l.event_start, event_end: l.event_end, summary: l.summary || line.trim() };
      s.rejected_reason = rejectReason(s, today);
    } catch (e) {
      errors.push(e.message);
      s = { ...base, type: null, summary: line.trim(), rejected_reason: 'Gemini error: ' + e.message };
    }
  }
  const inserted = await insertSignal(sql, run.id, s);
  const changes = await recomputeScores(sql, today, run.id, [vc_id]);
  await sql`update runs set finished_at = now(), status = ${errors.length ? 'error' : 'ok'}, items_fetched = 1, items_new = ${inserted ? 1 : 0},
    items_labelled = ${tin ? 1 : 0}, signals_counted = ${inserted && !s.rejected_reason ? 1 : 0}, gemini_input_tokens = ${tin},
    gemini_output_tokens = ${tout}, cost_inr = ${costInr(0, tin, tout)}, errors = ${JSON.stringify(errors)}::jsonb,
    changes = ${JSON.stringify(changes)}::jsonb where id = ${run.id}`;
  if (!inserted) return { ok: false, message: 'This link is already logged for this VC.' };
  if (s.rejected_reason) return { ok: false, message: `Stored but not counted: ${s.rejected_reason}.` };
  const [after] = await sql`select follow_up_score, recommended_action from vcs where vc_id = ${vc_id}`;
  return { ok: true, message: `Counted as ${s.type}. ${vc.firm}: score ${after.follow_up_score} - ${after.recommended_action}` };
}
