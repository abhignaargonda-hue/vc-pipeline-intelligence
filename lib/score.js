// Scoring. v3 = fit x timing (seed/signal-rubric.md section 7, from Vikram's review on 12 Oct 2026).
// v2 (sections 2-4) is still available with { version: 'v2' } so the rubric's own test table can be checked.
// Pure functions; `today` is a YYYY-MM-DD string in IST.

export const BASE = { S1: 60, S2: 35, S3: 35, S4a: 35, S4b: 15, S5: 15, S6: 15, S7: 15, N1: 0, N2: 0 };
const TIER1 = new Set(['S1', 'S2', 'S3', 'S4a']);
export const REL = { core: 1.0, adjacent: 0.7, general: 0.5, not_relevant: 0 };
const FLAG = { N1: 'Check for conflict', N2: 'Partner change: check who to contact' };
const PERSON_TYPES = new Set(['S2', 'S3', 'S4a', 'S4b']);

// v3 timing: a new early-stage fund is the clearest "deploying now" signal; liquidity events say nothing about seed cheques.
export const STAGE = { 'pre-seed': 1.2, seed: 1.2, 'pre-series-a': 1.0, 'series-a': 1.0, 'pre-series-b': 0.6, 'series-b-plus': 0.4, debt: 0, unknown: 0.9 };
export const ROLE = { led: 1.0, 'co-led': 1.0, participated: 0.85, unknown: 0.9 };
const S5_EARLY_BASE = 40;

export const daysBetween = (a, b) => Math.round((Date.parse(String(b).slice(0, 10)) - Date.parse(String(a).slice(0, 10))) / 86400000);

export function recency(days) {
  if (days < 0 || days > 30) return 0;
  if (days <= 7) return 1.0;
  if (days <= 14) return 0.9;
  return 0.7;
}

// Hard filters (section 2). Returns null if the signal is accepted, else the reason.
export function rejectReason(s, today, { fetchedUrls, vcIds } = {}) {
  if (!s.published_at) return 'no published date';
  const d = daysBetween(s.published_at, today);
  if (d > 30) return `older than 30 days (${d} d)`;
  if (d < -1) return 'published date in the future';
  if (fetchedUrls && !fetchedUrls.has(s.url)) return 'URL not fetched by the pipeline';
  if (!s.vc_id || (vcIds && !vcIds.has(s.vc_id))) return 'not a tracked VC';
  if (!s.type || s.type === 'none') return 'not a signal type';
  if (s.confirmed === false) return 'not confirmed';
  const rel = s.manual ? 'core' : s.relevance;
  if (s.type === 'N1' || s.type === 'N2') return null; // flag-only
  if (rel === 'not_relevant' || !REL[rel]) return 'not relevant';
  if (TIER1.has(s.type) && rel === 'general') return 'Tier 1 type needs core/adjacent relevance';
  return null;
}

// "my partner" | "someone else at the firm" | "firm-level"
export function personMatch(s, vc) {
  const p = String(s.person || '').trim().toLowerCase();
  if (!p) return 'firm-level';
  const mine = String(vc?.partner_name || '').trim().toLowerCase();
  if (!mine) return 'firm-level (no tracked partner)';
  if ( (p.includes(mine) || mine.includes(p) || p.split(/\s+/).at(-1) === mine.split(/\s+/).at(-1))) return 'my partner';
  return 'someone else at the firm';
}

// Points for one item, with every factor exposed for the dashboard.
export function itemBreakdown(s, today, vc = null, version = 'v3') {
  const rel = s.manual ? 'core' : s.relevance;
  const days = Math.max(0, daysBetween(s.published_at, today));
  const recMult = recency(days);
  let base = BASE[s.type] || 0;
  let relMult = REL[rel] || 0;
  let stageMult = 1, roleMult = 1, personMult = 1, note = '';
  const stage = s.deal_stage || 'unknown';
  if (version === 'v3') {
    if (s.type === 'S1') {
      stageMult = STAGE[stage] ?? STAGE.unknown; roleMult = ROLE[s.deal_role || 'unknown'] ?? ROLE.unknown;
      if (stage === 'debt') note = 'debt deal: no seed equity signal';
    }
    if (s.type === 'S5' && ['pre-seed', 'seed', 'pre-series-a', 'series-a', 'unknown'].includes(stage)) {
      base = S5_EARLY_BASE; relMult = Math.max(relMult, 0.8); note = 'new early-stage fund: deploying now';
    }
    if (s.type === 'S7' && (stage === 'exit' || stage === 'ipo' || stage === 'secondary')) {
      base = 0; note = 'liquidity event (IPO / exit / secondary): context only, says nothing about seed cheques';
    }
    if (PERSON_TYPES.has(s.type) && vc && personMatch(s, vc) === 'someone else at the firm') { personMult = 0.8; note = note || 'someone else at the firm, not your partner'; }
  }
  const points = base * relMult * recMult * stageMult * roleMult * personMult;
  return { base, rel, relMult, days, recMult, stage, stageMult, roleMult, personMult, points, note };
}

export function itemPoints(s, today, vc = null, version = 'v3') { return itemBreakdown(s, today, vc, version).points; }

export function itemFlags(s) {
  const f = [];
  if (FLAG[s.type]) f.push(FLAG[s.type]);
  if (s.type === 'S1' && s.category_peer) f.push(FLAG.N1);
  return f;
}

// VC fit from seed/vc-list.csv (group + stage_fit). Nothing inferred beyond those two columns.
export function vcFit(vc) {
  const sf = String(vc?.stage_fit || '').toLowerCase();
  if (vc?.vc_group === 'poor_fit') return { mult: 1, cap: 24, why: `poor fit for a seed equity round (${vc.stage_fit || 'group poor_fit'}): capped at Low` };
  if (/not seed/.test(sf)) return { mult: 0.6, cap: null, why: `stage fit "${vc.stage_fit}": does not do seed` };
  if (!sf || /unclear|stage agnostic|angel platform/.test(sf)) return { mult: 0.85, cap: null, why: `stage fit unclear ("${vc.stage_fit || '-'}")` };
  if (/series f|growth|ipo|series b/.test(sf) && !/pre-seed|first/.test(sf)) return { mult: 0.9, cap: null, why: `multi-stage fund ("${vc.stage_fit}")` };
  return { mult: 1, cap: null, why: `seed fit ("${vc.stage_fit}")` };
}

export function band(score) {
  if (score >= 50) return 'Reach out this week';
  if (score >= 25) return 'Warm: mention the signal if you contact them';
  if (score >= 1) return 'Low priority';
  return 'No news found in tracked sources (unknown, not inactive)';
}

export const STATUSES = ['Not contacted', 'Reached out - waiting', 'In conversation', 'Second meeting', 'Passed', 'Not now'];

// Remove duplicates: the same event reported by several outlets counts once. Group by type + subject
// (first word of Gemini's event_key, which starts with the company/fund/person name), keep the strongest
// label in the group, and date it by the EARLIEST report (re-reports must not make an old deal look fresh).
export function groupEvents(signals) {
  const subject = s => String(s.event_key || s.url).toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)[0] || s.url;
  const groups = new Map();
  for (const s of signals) {
    // A VC announces at most one new fund in 30 days: all S5 reports for a VC are one event.
    const k = s.type === 'S5' ? `${s.vc_id || ''}|S5` : `${s.vc_id || ''}|${s.type}|${subject(s)}`;
    (groups.get(k) || groups.set(k, []).get(k)).push(s);
  }
  return [...groups.values()];
}

// vc: { vc_id, vc_group, stage_fit, partner_name, status }, signals: accepted signals for this VC within 30 days
// opts.status: Vikram's latest status from the dashboard (vc_status table); falls back to vc.status.
export function scoreVc(vc, signals, today, opts = {}) {
  const version = opts.version || 'v3';
  const strength = s => (BASE[s.type] || 0) * (REL[s.manual ? 'core' : s.relevance] || 0);
  const known = (g, f) => {
    const vals = g.map(s => s[f]).filter(v => v && v !== 'unknown');
    return vals.sort((a, b) => vals.filter(x => x === b).length - vals.filter(x => x === a).length)[0] || 'unknown';
  };
  const scored = groupEvents(signals).map(g => {
    const top = Math.max(...g.map(strength));
    const rep0 = g.filter(s => strength(s) === top).sort((a, b) => String(a.published_at).localeCompare(String(b.published_at)))[0];
    // Stage / role / person: the most common value any report actually states (not the most favourable multiplier).
    const rep = { ...rep0, deal_stage: known(g, 'deal_stage'), deal_role: known(g, 'deal_role'), person: rep0.person || g.find(s => s.person)?.person || null };
    const earliest = g.map(s => String(s.published_at).slice(0, 10)).sort()[0];
    const merged = { ...rep, published_at: earliest, copies: g.length, reports: g.map(s => ({ url: s.url, source: s.source, published_at: s.published_at, summary: s.summary })),
      event_name: rep.event_name || g.find(s => s.event_name)?.event_name, event_city: rep.event_city || g.find(s => s.event_city)?.event_city,
      event_country: rep.event_country || g.find(s => s.event_country)?.event_country,
      event_start: rep.event_start || g.find(s => s.event_start)?.event_start, event_end: rep.event_end || g.find(s => s.event_end)?.event_end };
    const b = itemBreakdown(merged, today, vc, version);
    return { ...merged, ...b, who: personMatch(merged, vc), flags: [...new Set(g.flatMap(itemFlags))] };
  }).sort((a, b) => b.points - a.points || String(b.published_at).localeCompare(String(a.published_at)));

  const withPoints = scored.filter(s => s.points > 0);
  const timing = withPoints.length ? withPoints[0].points + 0.3 * withPoints.slice(1).reduce((a, s) => a + s.points, 0) : 0;
  const fit = version === 'v3' ? vcFit(vc) : { mult: 1, cap: null, why: '' };
  const bonus = withPoints.length && vc.vc_group === 'logistics_active' ? 10 : 0;
  let raw = timing * fit.mult + bonus;
  let score = Math.min(100, Math.round(raw));
  if (fit.cap != null) score = Math.min(score, fit.cap);
  const best = withPoints[0] || null;
  const flags = [...new Set(scored.flatMap(s => s.flags))];
  const meet = scored.filter(s => ['S4a', 'S4b'].includes(s.type) && (s.event_end || s.event_start) && String(s.event_end || s.event_start).slice(0, 10) >= today);

  const status = opts.status || vc.status || '';
  const st = status.toLowerCase();
  let action = band(score);
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
    score, action, band: band(score), best, flags, meet, fit, bonus, timing, raw, status,
    last_signal_date: scored.length ? scored.map(s => String(s.published_at).slice(0, 10)).sort().at(-1) : null,
    summary: best ? `${best.summary} (${String(best.published_at).slice(0, 10)})` : (scored[0] ? scored[0].summary : null),
    sources: scored.map(s => s.url),
    items: scored,
  };
}

function fmtRange(a, b) {
  const f = d => new Date(String(d).slice(0, 10) + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  if (a && b && String(a).slice(0, 10) !== String(b).slice(0, 10)) return `${f(a)} - ${f(b)}`;
  return f(a || b);
}
