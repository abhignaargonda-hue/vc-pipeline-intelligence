// Scoring exactly as seed/signal-rubric.md sections 2-4 (v2). Pure functions; `today` is a YYYY-MM-DD string.

export const BASE = { S1: 60, S2: 35, S3: 35, S4a: 35, S4b: 15, S5: 15, S6: 15, S7: 15, N1: 0, N2: 0 };
const TIER1 = new Set(['S1', 'S2', 'S3', 'S4a']);
export const REL = { core: 1.0, adjacent: 0.7, general: 0.5, not_relevant: 0 };
const FLAG = { N1: 'Check for conflict', N2: 'Partner change: check who to contact' };

export const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);

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

export function itemPoints(s, today) {
  const rel = s.manual ? 'core' : s.relevance;
  const base = BASE[s.type] || 0;
  return base * (REL[rel] || 0) * recency(Math.max(0, daysBetween(s.published_at, today)));
}

// Breakdown for the dashboard: base x relevance x recency = points
export function itemBreakdown(s, today) {
  const rel = s.manual ? 'core' : s.relevance;
  const days = Math.max(0, daysBetween(s.published_at, today));
  return { base: BASE[s.type] || 0, rel, relMult: REL[rel] || 0, days, recMult: recency(days) };
}

export function itemFlags(s) {
  const f = [];
  if (FLAG[s.type]) f.push(FLAG[s.type]);
  if (s.type === 'S1' && s.category_peer) f.push(FLAG.N1);
  return f;
}

export function band(score) {
  if (score >= 50) return 'Reach out this week';
  if (score >= 25) return 'Warm: mention the signal if you contact them';
  if (score >= 1) return 'Low priority';
  return 'No recent signal in tracked sources - deprioritise this week';
}

// vc: { vc_id, vc_group, status }, signals: accepted signals for this VC within 30 days
export function scoreVc(vc, signals, today) {
  const sorted = signals
    .map(s => ({ ...s, points: itemPoints(s, today), flags: itemFlags(s) }))
    .sort((a, b) => b.points - a.points || String(b.published_at).localeCompare(String(a.published_at)));
  // Remove duplicates: the same event reported by several outlets counts once (best-scoring copy kept).
  const seenEvents = new Set();
  const scored = sorted.filter(s => {
    const k = `${s.type}|${s.event_key || s.url}`;
    if (seenEvents.has(k)) return false;
    seenEvents.add(k); return true;
  });
  const withPoints = scored.filter(s => s.points > 0);
  let raw = 0;
  if (withPoints.length) {
    raw = withPoints[0].points + 0.3 * withPoints.slice(1).reduce((a, s) => a + s.points, 0);
    if (vc.vc_group === 'logistics_active') raw += 10;
  }
  const score = Math.min(100, Math.round(raw));
  const best = withPoints[0] || null;
  const flags = [...new Set(scored.flatMap(s => s.flags))];
  const meet = scored.filter(s => ['S4a', 'S4b'].includes(s.type) && (s.event_end || s.event_start) && String(s.event_end || s.event_start).slice(0, 10) >= today);

  let action = band(score);
  if (best) {
    const st = (vc.status || '').toLowerCase();
    if (st.includes('waiting')) action = `${action}. Follow up - new hook: ${best.summary}`;
    else if (st.includes('yet to reach out')) action = `${action}. First outreach - hook: ${best.summary}`;
  }
  for (const m of meet) action += ` | Meet in person: ${m.event_name || 'event'}, ${fmtRange(m.event_start, m.event_end)}`;
  if (flags.length) action += ` | Flags: ${flags.join('; ')}`;

  return {
    score,
    action,
    band: band(score),
    best,
    flags,
    meet,
    last_signal_date: scored.length ? scored.map(s => String(s.published_at).slice(0, 10)).sort().at(-1) : null,
    summary: best ? `${best.summary} (${best.source}, ${String(best.published_at).slice(0, 10)})` : (flags.length ? scored[0].summary : null),
    sources: scored.map(s => s.url),
    items: scored,
  };
}

function fmtRange(a, b) {
  const f = d => new Date(String(d).slice(0, 10) + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  if (a && b && String(a).slice(0, 10) !== String(b).slice(0, 10)) return `${f(a)} - ${f(b)}`;
  return f(a || b);
}
