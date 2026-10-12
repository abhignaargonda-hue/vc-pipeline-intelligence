// Scoring: Rubric v4 (seed/signal-rubric.md section 8). Sections 2-7 are kept in the rubric as history.
// Pure functions; `today` is a YYYY-MM-DD string in IST.
//
// PER SIGNAL: points = 0.50*What + 0.30*Logistics + 0.15*Fresh + 0.05*Led
// VC SCORE   = best signal + 5 per extra scoring signal (max +15), rounded, capped at 100; poor_fit capped at 24.

const TIER1 = new Set(['S1', 'S2', 'S3', 'S4a']);
export const REL = { core: 1.0, adjacent: 0.7, general: 0.5, not_relevant: 0 }; // used only for hard-filter checks
const FLAG = { N1: 'Check for conflict', N2: 'Partner change: check who to contact' };

export const W = { what: 0.5, logistics: 0.3, fresh: 0.15, led: 0.05 };
export const LOGISTICS = { core: 100, adjacent: 40, general: 10, not_relevant: 0 };
const SKIP_STAGES = new Set(['ipo', 'exit', 'secondary', 'debt']);

export const daysBetween = (a, b) => Math.round((Date.parse(String(b).slice(0, 10)) - Date.parse(String(a).slice(0, 10))) / 86400000);

export function fresh(days) {
  if (days < 0 || days > 30) return 0;
  if (days <= 7) return 100;
  if (days <= 14) return 70;
  return 40;
}

// What happened (0 = skip: liquidity events and debt say nothing about a seed equity cheque)
export function whatPoints(s) {
  const stage = s.deal_stage || 'unknown';
  if (SKIP_STAGES.has(stage)) return 0;
  switch (s.type) {
    case 'S1': return 70;
    case 'S5': return stage === 'series-b-plus' ? 20 : 60; // new fund; early-stage (or stage not stated) = 60
    case 'S2': case 'S3': case 'S4a': return 35;
    case 'S4b': case 'S6': case 'S7': return 20; // S7 here = follow-on (IPO/exit/secondary skipped above)
    default: return 0; // N1/N2 are flags only
  }
}

export function ledPoints(s) {
  if (s.type !== 'S1') return 100; // non-investment signals
  return ['led', 'co-led'].includes(s.deal_role) ? 100 : 60;
}

// Hard filters (section 2). maxDays 30 for scoring; the pipeline also asks with maxDays 60 to find "Check out" items.
export function rejectReason(s, today, { fetchedUrls, vcIds, maxDays = 30 } = {}) {
  if (!s.published_at) return 'no published date';
  const d = daysBetween(s.published_at, today);
  if (d > maxDays) return `older than ${maxDays} days (${d} d)`;
  if (d < -1) return 'published date in the future';
  if (fetchedUrls && !fetchedUrls.has(s.url)) return 'URL not fetched by the pipeline';
  if (!s.vc_id || (vcIds && !vcIds.has(s.vc_id))) return 'not a tracked VC';
  if (!s.type || s.type === 'none') return 'not a signal type';
  if (s.confirmed === false) return 'not confirmed';
  const rel = s.manual ? 'core' : s.relevance;
  if (s.type === 'N1' || s.type === 'N2') return null; // flag-only
  if (rel === 'not_relevant' || !(rel in REL)) return 'not relevant';
  if (TIER1.has(s.type) && rel === 'general') return 'Tier 1 type needs core/adjacent relevance';
  return null;
}

export const CHECK_OUT_REASON = 'older than 30 days (check out)';

// Card label only (no effect on the score): "my partner" | "someone else at the firm" | "firm-level"
export function personMatch(s, vc) {
  const p = String(s.person || '').trim().toLowerCase();
  if (!p) return 'firm-level';
  const mine = String(vc?.partner_name || '').trim().toLowerCase();
  if (!mine) return 'firm-level (no tracked partner)';
  if (p.includes(mine) || mine.includes(p) || p.split(/\s+/).at(-1) === mine.split(/\s+/).at(-1)) return 'my partner';
  return 'someone else at the firm';
}

// The four weighted parts of one signal, exposed for the dashboard.
export function itemBreakdown(s, today) {
  const rel = s.manual ? 'core' : s.relevance;
  const days = Math.max(0, daysBetween(s.published_at, today));
  const what = whatPoints(s);
  const logistics = LOGISTICS[rel] ?? 0;
  const fr = fresh(days);
  const led = ledPoints(s);
  const points = what === 0 ? 0 : W.what * what + W.logistics * logistics + W.fresh * fr + W.led * led;
  const note = what === 0 && SKIP_STAGES.has(s.deal_stage) ? `${s.deal_stage}: skipped (says nothing about a seed cheque)` : '';
  return { rel, days, what, logistics, fresh: fr, led, points, note, stage: s.deal_stage || 'unknown' };
}

export const itemPoints = (s, today) => itemBreakdown(s, today).points;

export function itemFlags(s) {
  const f = [];
  if (FLAG[s.type]) f.push(FLAG[s.type]);
  if (s.type === 'S1' && s.category_peer) f.push(FLAG.N1);
  return f;
}

export function band(score, checkout = false) {
  if (score >= 60) return 'Reach out this week';
  if (score >= 25) return 'Warm: mention the signal if you contact them';
  if (score >= 1) return 'Low priority';
  if (checkout) return 'Check out';
  return 'No news found (unknown, not inactive)';
}

export const bandKey = (score, action = '') =>
  score >= 60 ? 'reach' : score >= 25 ? 'warm' : score >= 1 ? 'low' : String(action || '').startsWith('Check out') ? 'checkout' : 'unknown';

export const STATUSES = ['Not contacted', 'Reached out - waiting', 'In conversation', 'Second meeting', 'Passed', 'Not now'];

// Duplicates: the same event reported by several outlets counts once. Group by VC + type + subject
// (first word of Gemini's event_key, which starts with the company/fund/person name); all S5 for a VC = one event.
export function groupEvents(signals) {
  const subject = s => String(s.event_key || s.url).toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)[0] || s.url;
  const groups = new Map();
  for (const s of signals) {
    const k = s.type === 'S5' ? `${s.vc_id || ''}|S5` : `${s.vc_id || ''}|${s.type}|${subject(s)}`;
    (groups.get(k) || groups.set(k, []).get(k)).push(s);
  }
  return [...groups.values()];
}

const known = (g, f) => {
  const vals = g.map(s => s[f]).filter(v => v && v !== 'unknown');
  return vals.sort((a, b) => vals.filter(x => x === b).length - vals.filter(x => x === a).length)[0] || 'unknown';
};

// vc: { vc_id, vc_group, partner_name, status }, signals: accepted signals (<= 30 days) for this VC.
// opts.status: Vikram's latest dashboard status. opts.checkout: this VC's 31-60 day "check out" items.
export function scoreVc(vc, signals, today, opts = {}) {
  const strength = s => whatPoints(s) * 10 + (LOGISTICS[s.manual ? 'core' : s.relevance] || 0);
  const scored = groupEvents(signals).map(g => {
    const top = Math.max(...g.map(strength));
    const rep0 = g.filter(s => strength(s) === top).sort((a, b) => String(a.published_at).localeCompare(String(b.published_at)))[0];
    const rep = { ...rep0, deal_stage: known(g, 'deal_stage'), deal_role: known(g, 'deal_role'), person: rep0.person || g.find(s => s.person)?.person || null };
    const earliest = g.map(s => String(s.published_at).slice(0, 10)).sort()[0];
    const merged = { ...rep, published_at: earliest, copies: g.length,
      reports: g.map(s => ({ url: s.url, source: s.source, published_at: s.published_at, summary: s.summary })),
      event_name: rep.event_name || g.find(s => s.event_name)?.event_name, event_city: rep.event_city || g.find(s => s.event_city)?.event_city,
      event_country: rep.event_country || g.find(s => s.event_country)?.event_country,
      event_start: rep.event_start || g.find(s => s.event_start)?.event_start, event_end: rep.event_end || g.find(s => s.event_end)?.event_end };
    return { ...merged, ...itemBreakdown(merged, today), who: personMatch(merged, vc), flags: [...new Set(g.flatMap(itemFlags))] };
  }).sort((a, b) => b.points - a.points || String(b.published_at).localeCompare(String(a.published_at)));

  const withPoints = scored.filter(s => s.points > 0);
  const best = withPoints[0] || null;
  const extra = Math.max(0, withPoints.length - 1);
  const bonus = Math.min(15, 5 * extra);
  const raw = best ? best.points + bonus : 0;
  const cap = vc.vc_group === 'poor_fit' ? 24 : 100;
  const score = Math.min(cap, Math.round(raw));

  // Check out: only when nothing scores. The newest qualifying 31-60 day item; never scored.
  const checkout = score === 0 && (opts.checkout || []).length
    ? [...opts.checkout].sort((a, b) => String(b.published_at).localeCompare(String(a.published_at)))[0] : null;

  const flags = [...new Set(scored.flatMap(s => s.flags))];
  const meet = scored.filter(s => ['S4a', 'S4b'].includes(s.type) && (s.event_end || s.event_start) && String(s.event_end || s.event_start).slice(0, 10) >= today);

  const status = opts.status || vc.status || '';
  const st = status.toLowerCase();
  let action = band(score, !!checkout);
  if (checkout) action = `Check out (older news, not scored): ${checkout.summary} (${String(checkout.published_at).slice(0, 10)})`;
  if (st === 'passed') action = 'Passed (your status): do not re-pitch';
  else if (st === 'not now') action = 'Not now (your status): parked';
  else if (best) {
    if (st.includes('waiting')) action = `${action}. Follow up - new hook: ${best.summary}`;
    else if (st.includes('in conversation') || st.includes('second meeting')) action = `${action}. In conversation - use as a talking point: ${best.summary}`;
    else if (st.includes('yet to reach out') || st.includes('not contacted')) action = `${action}. First outreach - hook: ${best.summary}`;
  }
  for (const m of meet) action += ` | Meet in person: ${m.event_name || 'event'}${m.event_city ? ` (${m.event_city})` : ''}, ${fmtRange(m.event_start, m.event_end)}`;
  if (flags.length) action += ` | Flags: ${flags.join('; ')}`;

  return {
    score, raw, bonus, extra, cap, action, band: band(score, !!checkout), best, flags, meet, status, checkout,
    last_signal_date: scored.length ? scored.map(s => String(s.published_at).slice(0, 10)).sort().at(-1) : (checkout ? String(checkout.published_at).slice(0, 10) : null),
    summary: best ? `${best.summary} (${String(best.published_at).slice(0, 10)})` : checkout ? `${checkout.summary} (${String(checkout.published_at).slice(0, 10)})` : (scored[0] ? scored[0].summary : null),
    sources: best ? scored.map(s => s.url) : checkout ? [checkout.url] : scored.map(s => s.url),
    items: scored,
  };
}

function fmtRange(a, b) {
  const f = d => new Date(String(d).slice(0, 10) + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  if (a && b && String(a).slice(0, 10) !== String(b).slice(0, 10)) return `${f(a)} - ${f(b)}`;
  return f(a || b);
}
