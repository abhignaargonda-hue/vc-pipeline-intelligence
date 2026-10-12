'use client';
import { useEffect, useMemo, useState } from 'react';

const BANDS = {
  reach: { label: 'Reach out this week', short: 'Reach out', color: 'var(--reach)', soft: 'var(--reach-soft)' },
  warm: { label: 'Warm: mention the signal', short: 'Warm', color: 'var(--warm)', soft: 'var(--warm-soft)' },
  low: { label: 'Low priority', short: 'Low', color: 'var(--low)', soft: 'var(--low-soft)' },
  checkout: { label: 'Check out (older news, not scored)', short: 'Check out', color: 'var(--checkout)', soft: 'var(--checkout-soft)' },
  unknown: { label: 'No news found (unknown)', short: 'Unknown', color: 'var(--unknown)', soft: 'var(--unknown-soft)' },
};
const ORDER = ['reach', 'warm', 'low', 'checkout', 'unknown'];
const parked = v => ['Passed', 'Not now'].includes(v.my_status);
const GROUP_RANK = { logistics_active: 0, b2b_generalist: 1, poor_fit: 2 };
const WHO_CLASS = { 'my partner': 'p-reach', 'someone else at the firm': 'p-warm' };
const TYPE_NAMES = { S1: 'Invested', S2: 'Wrote', S3: 'Podcast / interview', S4a: 'Spoke (logistics event)', S4b: 'Spoke (startup event)', S5: 'New fund', S6: 'Applications open', S7: 'Portfolio follow-on / exit', N1: 'Category peer', N2: 'Partner change' };

const d10 = d => String(d || '').slice(0, 10);
const fmt = (d, opt = { day: 'numeric', month: 'short' }) => (d ? new Date(d10(d) + 'T00:00:00Z').toLocaleDateString('en-GB', { ...opt, timeZone: 'UTC' }) : '');
const fmtDT = d => (d ? new Date(d).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '-');
const istDay = d => new Date(d).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
const host = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return u; } };
const addDays = (iso, n) => new Date(Date.parse(iso + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);

const Icon = ({ d, size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {d.map((p, i) => <path key={i} d={p} />)}
  </svg>
);
const I = {
  overview: ['M3 3h7v9H3z', 'M14 3h7v5h-7z', 'M14 12h7v9h-7z', 'M3 16h7v5H3z'],
  pipeline: ['M3 6h18', 'M3 12h18', 'M3 18h18', 'M7 6v0', 'M7 12v0'],
  calendar: ['M3 5h18v16H3z', 'M16 3v4', 'M8 3v4', 'M3 10h18'],
  signals: ['M2 12h4l3-8 4 16 3-8h6'],
  runs: ['M12 2v4', 'M12 18v4', 'M4.9 4.9l2.8 2.8', 'M16.3 16.3l2.8 2.8', 'M2 12h4', 'M18 12h4', 'M4.9 19.1l2.8-2.8', 'M16.3 7.7l2.8-2.8'],
  shield: ['M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z', 'M9 12l2 2 4-4'],
  play: ['M6 4l14 8-14 8z'],
  clock: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M12 6v6l4 2'],
  ext: ['M15 3h6v6', 'M10 14L21 3', 'M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6'],
  x: ['M18 6L6 18', 'M6 6l12 12'],
  search: ['M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z', 'M21 21l-4.3-4.3'],
  pin: ['M12 22s-7-6.2-7-12a7 7 0 1 1 14 0c0 5.8-7 12-7 12z', 'M12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z'],
  left: ['M15 18l-6-6 6-6'],
  right: ['M9 18l6-6-6-6'],
};

const NAV = [
  { key: 'overview', label: 'Overview', icon: I.overview },
  { key: 'pipeline', label: 'Pipeline', icon: I.pipeline },
  { key: 'calendar', label: 'Calendar', icon: I.calendar },
  { key: 'signals', label: 'Signals', icon: I.signals },
  { key: 'runs', label: 'Runs & cost', icon: I.runs },
];

export default function Dashboard({ data, initialTab }) {
  const [tab, setTab] = useState(NAV.some(n => n.key === initialTab) ? initialTab : 'overview');
  const [band, setBand] = useState('all');
  const [selected, setSelected] = useState(null);
  const byId = useMemo(() => Object.fromEntries(data.vcs.map(v => [v.vc_id, v])), [data.vcs]);
  const counts = useMemo(() => Object.fromEntries(ORDER.map(b => [b, data.vcs.filter(v => v.band === b).length])), [data.vcs]);

  const go = (t, b) => { setTab(t); if (b) setBand(b); window.history.replaceState(null, '', t === 'overview' ? '/' : `/?tab=${t}`); };
  const open = id => setSelected(byId[id] || null);

  return (
    <div className="shell">
      <aside className="side">
        <div className="brand"><span className="logo">V</span><div><b>VC Pipeline</b><small>Vikram · Seed · B2B logistics</small></div></div>
        <nav>
          {NAV.map(n => (
            <button key={n.key} className={`nav ${tab === n.key ? 'on' : ''}`} onClick={() => go(n.key)}>
              <Icon d={n.icon} /><span>{n.label}</span>
              {n.key === 'pipeline' && <em>{data.vcs.length}</em>}
            </button>
          ))}
        </nav>
        <div className="side-foot">
          <a className="nav" href="/api/verify" target="_blank"><Icon d={I.shield} /><span>Verify notes untouched</span></a>
          <p>Public dashboard · no login. Code writes only 4 columns; Vikram's status and notes are read-only.</p>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div>
            <h1>{NAV.find(n => n.key === tab).label}</h1>
            <p className="muted small">Signals from the last 30 days · today {fmt(data.today, { day: 'numeric', month: 'short', year: 'numeric' })} (IST)
              {data.lastRun && <> · last run #{data.lastRun.id} ({data.lastRun.trigger}) {fmtDT(data.lastRun.finished_at)}</>}</p>
          </div>
          <div className="top-actions">
            <div className="next"><Icon d={I.clock} size={16} /><div><small>Next run</small><b>{data.nextRun ? new Date(data.nextRun).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '-'}</b></div></div>
            <RunNow />
          </div>
        </header>

        <div className="content">
          {tab === 'overview' && <Overview data={data} counts={counts} go={go} open={open} />}
          {tab === 'pipeline' && <Pipeline vcs={data.vcs} band={band} setBand={setBand} counts={counts} open={open} />}
          {tab === 'calendar' && <Calendar data={data} open={open} />}
          {tab === 'signals' && <Signals data={data} open={open} />}
          {tab === 'runs' && <Runs runs={data.runs} />}
        </div>
      </div>

      {selected && <Detail vc={selected} statuses={data.statuses} onClose={() => setSelected(null)} />}
    </div>
  );
}

/* ---------------- Run now ---------------- */
function RunNow() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  async function go() {
    setBusy(true); setMsg('Fetching feeds + 50 Tavily searches, labelling with Gemini...');
    try {
      const r = await fetch('/api/run', { method: 'POST' });
      const j = await r.json();
      if (!r.ok) setMsg(j.error || 'Failed');
      else { setMsg(`Done: ${j.fetched} fetched, ${j.new} new, ${j.counted} counted.`); setTimeout(() => location.reload(), 1200); }
    } catch (e) { setMsg(e.message); }
    setBusy(false);
  }
  return (
    <div className="runnow">
      <button className="btn primary" onClick={go} disabled={busy}><Icon d={I.play} size={14} />{busy ? 'Running...' : 'Run now'}</button>
      <small className="muted">{msg || 'Max once per 30 min'}</small>
    </div>
  );
}

/* ---------------- Overview ---------------- */
function Overview({ data, counts, go, open }) {
  const total = data.vcs.length;
  const active = data.vcs.filter(v => !parked(v));
  const reach = active.filter(v => v.band === 'reach').sort((a, b) => b.score - a.score);
  const top5 = reach.slice(0, 5);
  const checkouts = active.filter(v => v.band === 'checkout');
  const warm = active.filter(v => v.band === 'warm');
  const meet = data.vcs.flatMap(v => v.meet.map(m => ({ ...m, firm: v.firm, vc_id: v.vc_id })));
  const changes = data.changes || [];
  return (
    <>
      <div className="kpis">
        {ORDER.map(b => (
          <button key={b} className={`kpi k-${b}`} onClick={() => go('pipeline', b)}>
            <span className="dot" />
            <small>{BANDS[b].label}</small>
            <b>{counts[b]}</b>
            <span className="muted small">of {total} VCs · view →</span>
          </button>
        ))}
      </div>

      <div className="card">
        <div className="card-h"><h3>Band split</h3><span className="muted small">Rubric v4 · click a segment to filter</span></div>
        <div className="splitbar">
          {ORDER.filter(b => counts[b]).map(b => (
            <button key={b} style={{ flex: counts[b], background: BANDS[b].color }} title={`${BANDS[b].label}: ${counts[b]}`} onClick={() => go('pipeline', b)}>
              {counts[b] >= 2 ? counts[b] : ''}
            </button>
          ))}
        </div>
        <div className="legend">{ORDER.map(b => <span key={b}><i style={{ background: BANDS[b].color }} />{BANDS[b].short} ({counts[b]})</span>)}</div>
      </div>

      <div className="grid2">
        <div className="card">
          <div className="card-h"><h3>What changed since last run</h3>
            <span className="muted small">{data.changesRun ? `snapshot #${data.changesRun.id} (${data.changesRun.trigger}) vs the one before` : ''}</span></div>
          {changes.length === 0 ? <p className="muted">No score or action changed.</p> : (
            <ul className="changes">{changes.map(c => {
              const b = c.to_score >= 50 ? 'reach' : c.to_score >= 25 ? 'warm' : c.to_score >= 1 ? 'low' : 'unknown';
              return (
                <li key={c.vc_id} onClick={() => open(c.vc_id)}>
                  <span className={`delta ${c.to_score >= c.from_score ? 'up' : 'down'}`}>{c.to_score > c.from_score ? '▲' : c.to_score < c.from_score ? '▼' : '•'}</span>
                  <b>{c.firm}</b>
                  <span className="mono">{c.from_score} → <span style={{ color: BANDS[b].color }}>{c.to_score}</span></span>
                  <span className="muted small ellipsis">{c.summary}</span>
                </li>
              );
            })}</ul>
          )}
        </div>
        <div className="card amber">
          <div className="card-h"><h3><Icon d={I.pin} size={16} /> Meet in person</h3><span className="small">upcoming events with a tracked VC</span></div>
          {meet.length === 0 ? <p className="muted">No upcoming events found.</p> : meet.map((m, i) => (
            <div key={i} className="meet" onClick={() => open(m.vc_id)}>
              <div className="meet-date"><b>{fmt(m.event_start, { day: 'numeric' })}</b><small>{fmt(m.event_start, { month: 'short' })}</small></div>
              <div><b>{m.event_name || 'Event'}</b>{m.event_city && <span className="small"> · {m.event_city}{m.event_country ? `, ${m.event_country}` : ''}</span>}
                <div className="small">{m.firm} · {fmt(m.event_start)}{m.event_end && m.event_end !== m.event_start ? ` – ${fmt(m.event_end)}` : ''}</div>
                <a className="small" href={m.url} target="_blank" onClick={e => e.stopPropagation()}>source ↗</a></div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid2">
        <div className="stack">
          <div className="card">
            <div className="card-h"><h3><span className="pill p-reach">Ready to talk</span> This week's 5</h3><span className="muted small">top Reach-out VCs by score{reach.length > 5 ? ` · ${reach.length - 5} more in Pipeline` : ''}</span></div>
            {top5.length > 0 ? top5.map((v, i) => <VcCard key={v.vc_id} v={v} open={open} rank={i + 1} />) : (
              <>
                <p className="emptyline">No VC crossed 50 this run. These are the strongest warm leads.</p>
                {warm.slice(0, 3).map(v => <VcCard key={v.vc_id} v={v} open={open} />)}
              </>
            )}
          </div>
          {checkouts.length > 0 && <div className="card">
            <div className="card-h"><h3><span className="pill p-checkout">Check out</span> Older news (31-60 days), not scored</h3><span className="muted small">{checkouts.length}</span></div>
            {checkouts.slice(0, 6).map(v => <CheckoutLine key={v.vc_id} v={v} open={open} />)}
            {checkouts.length > 6 && <p className="small muted">+{checkouts.length - 6} more in Pipeline → Check out</p>}
          </div>}
          <div className="card">
            <div className="card-h"><h3><span className="pill p-warm">Warm</span> Mention the signal if you contact them</h3><span className="muted small">{warm.length}</span></div>
            {warm.length === 0 ? <p className="muted">None.</p> : warm.slice(reach.length ? 0 : 3).map(v => <VcCard key={v.vc_id} v={v} open={open} compact />)}
          </div>
        </div>
        <div className="card">
          <div className="card-h"><h3>Proximity rings</h3><span className="muted small">closer to centre = more worth contacting now</span></div>
          <Rings vcs={data.vcs} open={open} />
        </div>
      </div>
    </>
  );
}

function WhoTag({ item }) {
  if (!item) return null;
  return <span className={`pill ${WHO_CLASS[item.who] || 'p-unknown'}`} title={item.person || ''}>{item.who === 'my partner' ? `your partner${item.person ? `: ${item.person}` : ''}` : item.who === 'someone else at the firm' ? `someone else: ${item.person}` : 'firm-level'}</span>;
}

function CheckoutLine({ v, open }) {
  const c = v.checkout;
  return (
    <div className="vccard b-checkout" onClick={() => open(v.vc_id)}>
      <div className="vccard-body">
        <div className="row"><b>{v.firm}</b><span className="muted small">{v.partner_name || 'no tracked partner'}</span></div>
        {c && <div className="small">{c.summary} <span className="muted">· {fmt(c.published_at)} · </span><a href={c.url} target="_blank" onClick={e => e.stopPropagation()}>{host(c.url)} ↗</a></div>}
      </div>
    </div>
  );
}

function VcCard({ v, open, compact, rank }) {
  const best = v.items.find(i => i.points > 0);
  return (
    <div className={`vccard b-${v.band}`} onClick={() => open(v.vc_id)}>
      {rank && <span className="rank">{rank}</span>}
      <ScoreRing score={v.score} band={v.band} size={compact ? 40 : 52} />
      <div className="vccard-body">
        <div className="row"><b>{v.firm}</b><span className="muted small">{v.partner_name || 'no tracked partner'}</span>
          {v.my_status && <span className="pill p-low">{v.my_status}</span>}
          {v.flags.map(f => <span key={f} className="pill p-flag">{f}</span>)}</div>
        {best && <div className="small">{best.summary}</div>}
        {best && <div className="small muted row" style={{ gap: 4 }}><span className="tag">{best.type}</span>{best.stage !== 'unknown' && <span className="tag t-rel">{best.stage}</span>}<WhoTag item={best} />{fmt(best.published_at)}{best.copies > 1 ? ` · ${best.copies} reports` : ''}</div>}
        {!compact && v.logistics_evidence && <div className="small muted">Logistics deal on record: {v.logistics_evidence}</div>}
      </div>
    </div>
  );
}

function ScoreRing({ score, band, size = 48 }) {
  const r = size / 2 - 4, c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} className="scorering" aria-label={`score ${score}`}>
      <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--line)" strokeWidth="4" fill="none" />
      <circle cx={size / 2} cy={size / 2} r={r} stroke={BANDS[band].color} strokeWidth="4" fill="none" strokeLinecap="round"
        strokeDasharray={`${(c * Math.min(100, score)) / 100} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" fontSize={size / 3.2} fontWeight="700" fill="var(--fg)">{score}</text>
    </svg>
  );
}

function Rings({ vcs, open }) {
  const [hover, setHover] = useState(null);
  const S = 420, C = S / 2;
  const zones = { reach: [26, 62], warm: [72, 104], low: [114, 140], checkout: [150, 174], unknown: [184, 204] };
  const dots = [];
  ORDER.forEach(b => {
    const list = vcs.filter(v => v.band === b);
    list.forEach((v, i) => {
      const [r0, r1] = zones[b];
      const frac = b === 'unknown' || b === 'checkout' ? 0.5 : b === 'reach' ? 1 - (v.score - 60) / 40 : b === 'warm' ? 1 - (v.score - 25) / 35 : 1 - (v.score - 1) / 24;
      const r = r0 + (r1 - r0) * Math.max(0, Math.min(1, frac));
      const a = (i / Math.max(1, list.length)) * 2 * Math.PI + (b === 'unknown' ? 0.2 : b === 'checkout' ? 1.4 : b === 'low' ? 0.9 : b === 'warm' ? 0.4 : -1.2);
      dots.push({ v, x: C + r * Math.cos(a), y: C + r * Math.sin(a), b });
    });
  });
  return (
    <div className="rings">
      <svg viewBox={`0 0 ${S} ${S}`} role="img" aria-label="VC proximity rings">
        {[...ORDER].reverse().map(b => <circle key={b} cx={C} cy={C} r={zones[b][1] + 8} fill={BANDS[b].soft} stroke="var(--line)" />)}
        <circle cx={C} cy={C} r="16" fill="var(--accent)" />
        <text x={C} y={C} dominantBaseline="central" textAnchor="middle" fill="#fff" fontSize="11" fontWeight="700">You</text>
        {ORDER.map(b => <text key={b} x={C} y={C - zones[b][1] - 1} textAnchor="middle" fontSize="10" fill="var(--muted)">{BANDS[b].short}</text>)}
        {dots.map(({ v, x, y, b }) => (
          <g key={v.vc_id} className="ringdot" onClick={() => open(v.vc_id)} onMouseEnter={() => setHover({ v, x, y })} onMouseLeave={() => setHover(null)}>
            <circle cx={x} cy={y} r="13" fill="transparent" />
            <circle cx={x} cy={y} r={b === 'unknown' || b === 'checkout' ? 4.5 : 7} fill={BANDS[b].color} stroke={parked(v) ? 'var(--fg)' : '#fff'} strokeWidth="1.5" />
            {(b === 'reach' || b === 'warm') && <text x={x} y={y - 11} textAnchor="middle" fontSize="10.5" fontWeight="600" fill="var(--fg)">{v.firm.split(' ')[0]}</text>}
          </g>
        ))}
      </svg>
      {hover && (
        <div className="ringtip" style={{ left: `${(hover.x / S) * 100}%`, top: `${(hover.y / S) * 100}%` }}>
          <b>{hover.v.firm}</b> · {hover.v.score}<br /><span className="small">{BANDS[hover.v.band].label}{hover.v.my_status ? ` · ${hover.v.my_status}` : ''}</span>
        </div>
      )}
    </div>
  );
}

/* ---------------- Pipeline ---------------- */
function Pipeline({ vcs, band, setBand, counts, open }) {
  const [q, setQ] = useState('');
  const [group, setGroup] = useState('all');
  const [conflict, setConflict] = useState(false);
  const list = vcs.filter(v =>
    (band === 'all' || v.band === band) && (group === 'all' || v.vc_group === group) && (!conflict || v.flags.length) &&
    (!q || `${v.firm} ${v.partner_name || ''} ${v.signal_summary || ''} ${v.my_status || ''}`.toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => b.score - a.score || (GROUP_RANK[a.vc_group] ?? 3) - (GROUP_RANK[b.vc_group] ?? 3) || a.firm.localeCompare(b.firm));
  return (
    <div className="card">
      <div className="filters">
        <div className="chips">
          <button className={`chip ${band === 'all' ? 'on' : ''}`} onClick={() => setBand('all')}>All <em>{vcs.length}</em></button>
          {ORDER.map(b => (
            <button key={b} className={`chip c-${b} ${band === b ? 'on' : ''}`} onClick={() => setBand(b)}><i />{BANDS[b].short} <em>{counts[b]}</em></button>
          ))}
          <button className={`chip ${conflict ? 'on' : ''}`} onClick={() => setConflict(!conflict)}>Flags <em>{vcs.filter(v => v.flags.length).length}</em></button>
        </div>
        <div className="row">
          <select value={group} onChange={e => setGroup(e.target.value)}>
            <option value="all">All groups</option><option value="logistics_active">logistics_active</option>
            <option value="b2b_generalist">b2b_generalist</option><option value="poor_fit">poor_fit</option>
          </select>
          <label className="search"><Icon d={I.search} size={15} /><input placeholder="Search VC, partner, signal, status" value={q} onChange={e => setQ(e.target.value)} /></label>
        </div>
      </div>
      {band === 'checkout' && <p className="small muted">Check out = nothing scored in the last 30 days, but a qualifying item from 31-60 days ago exists. It is shown for context and never scored or moved into another band.</p>}
      {band === 'unknown' && <p className="small muted">Unknown = our tracked sources (news search, Google Alerts, Inc42/YourStory, 4 Substacks) found nothing in 30 days. It is not proof the fund is inactive: LinkedIn and most firm blogs are not machine-readable. Use Log a signal for what you see yourself. Sorted by fit.</p>}
      <div className="wrap">
        <table className="tbl">
          <thead><tr><th>VC</th><th>Score</th><th>Band</th><th className="hide-sm">Latest signal</th><th className="hide-sm">Your status</th></tr></thead>
          <tbody>
            {list.map(v => {
              const best = v.items.find(i => i.points > 0) || v.items[0];
              return (
                <tr key={v.vc_id} onClick={() => open(v.vc_id)} className={`clickrow ${parked(v) ? 'parkedrow' : ''}`}>
                  <td><b>{v.firm}</b><div className="small muted">{v.partner_name || 'no tracked partner'} · {v.vc_group}</div></td>
                  <td><ScoreRing score={v.score} band={v.band} size={36} /></td>
                  <td><span className={`pill p-${v.band}`}>{BANDS[v.band].short}</span>{v.flags.map(f => <span key={f} className="pill p-flag">{f}</span>)}</td>
                  <td className="hide-sm small">{best ? <>{best.summary} <span className="muted">· {fmt(best.published_at)}</span> <WhoTag item={best} /></>
                    : v.checkout ? <><span className="pill p-checkout">older</span>{v.checkout.summary} <span className="muted">· {fmt(v.checkout.published_at)}</span> <a href={v.checkout.url} target="_blank" onClick={e => e.stopPropagation()}>↗</a></>
                    : <span className="muted">No news found in tracked sources</span>}</td>
                  <td className="hide-sm small">{v.my_status ? <span className="pill p-low">{v.my_status}</span> : <span className="muted">set in panel →</span>}</td>
                </tr>
              );
            })}
            {list.length === 0 && <tr><td colSpan="5" className="muted">No VCs match.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusEditor({ v, statuses }) {
  const [status, setStatus] = useState(v.my_status && statuses.includes(v.my_status) ? v.my_status : '');
  const [note, setNote] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  async function save() {
    if (!status) return;
    setBusy(true); setMsg('');
    const r = await fetch('/api/status', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ vc_id: v.vc_id, status, note }) });
    const j = await r.json();
    setBusy(false);
    if (j.ok) { setMsg('Saved. Rescoring...'); setTimeout(() => location.reload(), 700); } else setMsg(j.message || 'Failed');
  }
  return (
    <div className="statusbox">
      <div className="row">
        <select value={status} onChange={e => setStatus(e.target.value)}><option value="" disabled>Set your status</option>{statuses.map(s => <option key={s}>{s}</option>)}</select>
        <input placeholder="Optional note (e.g. 'passed: too early')" value={note} onChange={e => setNote(e.target.value)} style={{ flex: 1 }} />
        <button className="btn primary" disabled={busy || !status} onClick={save}>Save</button>
      </div>
      <div className="small muted">{msg || 'Passed / Not now removes the VC from your reach-out and warm lists. Saved to a separate status log; your original columns are never overwritten.'}</div>
      {v.status_history.length > 0 && <details><summary>History ({v.status_history.length})</summary>{v.status_history.map((h, i) => <div key={i} className="small">{fmtDT(h.at)}: <b>{h.status}</b>{h.note ? ` · ${h.note}` : ''}</div>)}</details>}
    </div>
  );
}

function Detail({ vc, onClose, statuses }) {
  useEffect(() => {
    const k = e => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  const counted = vc.items.filter(i => i.points > 0);
  const best = counted[0];
  return (
    <div className="overlay" onClick={onClose}>
      <aside className="drawer" onClick={e => e.stopPropagation()}>
        <div className="drawer-h">
          <ScoreRing score={vc.score} band={vc.band} size={60} />
          <div style={{ flex: 1 }}>
            <h2>{vc.firm}</h2>
            <div className="small muted">{vc.partner_name ? `${vc.partner_name}, ${vc.partner_title || ''}` : 'No tracked partner (firm-level)'} · {vc.vc_type || vc.vc_group}{vc.confidence ? ` · ${vc.confidence} confidence` : ''}
              {vc.partner_verified_on_firm_site && vc.partner_verified_on_firm_site !== 'yes' && <span className="pill p-warm">verify partner</span>}
              {vc.website && <> · <a href={`https://${vc.website}`} target="_blank">{vc.website}</a></>}</div>
            <span className={`pill p-${vc.band}`}>{BANDS[vc.band].label}</span>{vc.flags.map(f => <span key={f} className="pill p-flag">{f}</span>)}
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><Icon d={I.x} /></button>
        </div>

        <section>
          <h4>Your status</h4>
          <StatusEditor v={vc} statuses={statuses} />
        </section>

        <section>
          <h4>Recommended action</h4>
          <p className="action">{vc.recommended_action || 'Not scored yet'}</p>
        </section>

        <section>
          <h4>How the score was worked out (Rubric v4)</h4>
          {vc.checkout && <div className="checkoutbox small"><span className="pill p-checkout">Check out</span> Older news (not scored): {vc.checkout.summary} · {fmt(vc.checkout.published_at)} · <a href={vc.checkout.url} target="_blank">{host(vc.checkout.url)} ↗</a></div>}
          {vc.items.length === 0 ? <p className="muted small">No signal in the last 30 days, so the score is 0{vc.checkout ? ' (Check out band)' : ' (no news found: unknown, not inactive)'}.</p> : (
            <>
              <div className="wrap"><table className="tbl small">
                <thead><tr><th>Signal</th><th>What ×0.50</th><th>Logistics ×0.30</th><th>Fresh ×0.15</th><th>Led ×0.05</th><th>= Pts</th></tr></thead>
                <tbody>{vc.items.map((i, k) => (
                  <tr key={k} className={i.best ? 'bestrow' : ''}>
                    <td><span className="tag">{i.type}</span>{TYPE_NAMES[i.type] || ''}{i.best && <span className="pill p-reach">best</span>}{i.copies > 1 && <span className="muted"> · {i.copies} reports, counted once</span>}
                      {i.note && <div className="muted">{i.note}</div>}</td>
                    <td className="mono">{i.what} <span className="muted">→ {(i.what * 0.5).toFixed(1)}</span></td>
                    <td className="mono">{i.logistics} <span className="muted">({i.manual ? 'core, logged' : i.rel}) → {(i.logistics * 0.3).toFixed(1)}</span></td>
                    <td className="mono">{i.fresh} <span className="muted">({i.days} d) → {(i.fresh * 0.15).toFixed(1)}</span></td>
                    <td className="mono">{i.led} <span className="muted">{i.type === 'S1' ? `(${i.deal_role || 'unknown'})` : '(not a deal)'} → {(i.led * 0.05).toFixed(1)}</span></td>
                    <td className="mono"><b>{i.points}</b></td>
                  </tr>
                ))}</tbody>
              </table></div>
              <p className="formula mono small">
                {best ? <>best {best.points.toFixed(1)} + 5 × {vc.extra} extra signal{vc.extra === 1 ? '' : 's'} (max +15) = {vc.raw}
                  {vc.cap < 100 ? ` → capped at ${vc.cap} (poor fit)` : ''} → <b>{vc.score}</b> · {BANDS[vc.band].label}</> : 'Only skipped or flag items (0 points).'}
              </p>
              {vc.recomputed !== vc.score && <p className="small reason">Stored score {vc.score}; recomputing now gives {vc.recomputed}. It updates on the next run.</p>}
            </>
          )}
        </section>

        <section>
          <h4>Signals (last 30 days)</h4>
          {vc.items.length === 0 ? <p className="muted small">None in tracked sources.</p> : vc.items.map((i, k) => (
            <div key={k} className="sig">
              <div className="row" style={{ gap: 4 }}><span className="tag">{i.type}</span><span className="tag t-rel">{i.manual ? 'core (logged)' : i.relevance}</span><WhoTag item={i} /><span className="muted small">{fmt(i.published_at)}</span></div>
              <a href={i.url} target="_blank">{i.summary} <Icon d={I.ext} size={12} /></a>
              {i.copies > 1 && <details><summary>{i.copies} reports of this event</summary>{i.reports.map((r, j) => (
                <div key={j} className="small"><a href={r.url} target="_blank">{host(r.url)}</a> · {fmt(r.published_at)} · {r.summary}</div>
              ))}</details>}
            </div>
          ))}
        </section>

        {vc.thesis_quote && <section><h4>Seed evidence</h4><p className="small">"{vc.thesis_quote}" {vc.thesis_url && <a href={vc.thesis_url} target="_blank">source ↗</a>}</p></section>}
        {vc.logistics_evidence && <section><h4>Logistics deals on record (warm-path lead)</h4>
          <p className="small">{vc.logistics_evidence} {vc.logistics_source_url && <a href={vc.logistics_source_url} target="_blank">source ↗</a>}</p>
          {vc.second_logistics_deal && <p className="small">{vc.second_logistics_deal} {vc.second_logistics_source_url && <a href={vc.second_logistics_source_url} target="_blank">source ↗</a>}</p>}</section>}
        {vc.watch_outs && <section><h4>Watch-outs (research)</h4><p className="small">{vc.watch_outs}</p></section>}

        <section className="readonly">
          <h4>Your original columns <span className="pill p-unknown">read-only</span></h4>
          <dl>
            <dt>Status (Neon)</dt><dd>{vc.status || '-'}</dd>
            <dt>Last contact</dt><dd>{vc.last_contact_date ? fmt(vc.last_contact_date, { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}</dd>
            <dt>Contact history</dt><dd>{vc.contact_history || '-'}</dd>
            <dt>Notes</dt><dd>{vc.personal_notes || '-'}</dd>
          </dl>
          <p className="muted small">Never written by code, never sent to Gemini or Tavily (proof: /api/verify).</p>
        </section>
      </aside>
    </div>
  );
}

/* ---------------- Calendar ---------------- */
function Calendar({ data, open }) {
  const [ym, setYm] = useState(data.today.slice(0, 7));
  const [day, setDay] = useState(data.today);
  const [y, m] = ym.split('-').map(Number);

  const marks = useMemo(() => {
    const M = {};
    const add = (d, item) => { (M[d] = M[d] || []).push(item); };
    data.runs.filter(r => ['cron', 'manual', 'verify'].includes(r.trigger)).forEach(r => add(istDay(r.started_at), { kind: 'run', label: `Run #${r.id} (${r.trigger}): ${r.items_fetched} items, ₹${r.cost_inr.toFixed(2)}` }));
    // Scheduled cron runs (Mon + Thu 6:30am IST) from tomorrow to end of the visible range
    for (let d = addDays(data.today, 1); d <= addDays(data.today, 70); d = addDays(d, 1)) {
      const wd = new Date(d + 'T00:00:00Z').getUTCDay();
      if (wd === 1 || wd === 4) add(d, { kind: 'sched', label: 'Scheduled run, 6:30am IST' });
    }
    const evSeen = new Set();
    data.events.filter(s => s.event_start).forEach(s => {
      const k = `${s.vc_id}|${s.event_name}|${s.event_start}`; if (evSeen.has(k)) return; evSeen.add(k);
      const end = s.event_end && s.event_end >= s.event_start ? s.event_end : s.event_start;
      for (let d = s.event_start; d <= end; d = addDays(d, 1)) add(d, { kind: 'event', label: `${s.event_name || 'Event'}${s.event_city ? ` (${s.event_city})` : ''} · ${s.firm}`, vc_id: s.vc_id, url: s.url });
    });
    data.events.filter(s => s.published_at).forEach(s => add(s.published_at, { kind: 'signal', label: `${s.firm}: ${s.summary}`, vc_id: s.vc_id, url: s.url, type: s.type }));
    return M;
  }, [data]);

  const first = new Date(Date.UTC(y, m - 1, 1));
  const startPad = (first.getUTCDay() + 6) % 7; // Monday first
  const daysIn = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells = [...Array(startPad).fill(null), ...Array.from({ length: daysIn }, (_, i) => `${ym}-${String(i + 1).padStart(2, '0')}`)];
  const shift = n => { const d = new Date(Date.UTC(y, m - 1 + n, 1)); setYm(d.toISOString().slice(0, 7)); };
  const windowStart = addDays(data.today, -30);
  const sel = marks[day] || [];

  return (
    <div className="grid-cal">
      <div className="card">
        <div className="card-h">
          <h3>{first.toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })}</h3>
          <div className="row">
            <button className="icon-btn" onClick={() => shift(-1)} aria-label="Previous month"><Icon d={I.left} /></button>
            <button className="btn" onClick={() => { setYm(data.today.slice(0, 7)); setDay(data.today); }}>Today</button>
            <button className="icon-btn" onClick={() => shift(1)} aria-label="Next month"><Icon d={I.right} /></button>
          </div>
        </div>
        <div className="cal">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => <div key={d} className="cal-h">{d}</div>)}
          {cells.map((d, i) => {
            if (!d) return <div key={i} className="cal-c empty" />;
            const ms = marks[d] || [];
            const kinds = new Set(ms.map(x => x.kind));
            const nSig = ms.filter(x => x.kind === 'signal').length;
            const ev = ms.find(x => x.kind === 'event');
            return (
              <button key={i} className={`cal-c ${d === data.today ? 'today' : ''} ${d === day ? 'sel' : ''} ${d >= windowStart && d <= data.today ? 'inwin' : ''}`} onClick={() => setDay(d)}>
                <span className="cal-n">{Number(d.slice(8))}</span>
                {ev && <span className="cal-ev">{ev.label.split(' · ')[0]}</span>}
                <span className="cal-dots">
                  {(kinds.has('run') || kinds.has('sched')) && <i className={kinds.has('run') ? 'k-run' : 'k-sched'} title="run" />}
                  {nSig > 0 && <i className="k-signal" title={`${nSig} signals`} />}
                  {nSig > 1 && <small>{nSig}</small>}
                </span>
              </button>
            );
          })}
        </div>
        <div className="legend">
          <span><i className="k-run" />Run done</span><span><i className="k-sched" />Scheduled run (Mon/Thu)</span>
          <span><i className="k-event" />Event</span><span><i className="k-signal" />Signal published</span><span><i className="k-win" />30-day window</span>
        </div>
      </div>
      <div className="card">
        <div className="card-h"><h3>{fmt(day, { weekday: 'long', day: 'numeric', month: 'long' })}</h3></div>
        {sel.length === 0 ? <p className="muted">Nothing on this day.</p> : sel.map((x, i) => (
          <div key={i} className={`dayitem d-${x.kind}`} onClick={() => x.vc_id && open(x.vc_id)}>
            <span className="tag">{x.kind === 'signal' ? x.type : x.kind === 'sched' ? 'scheduled' : x.kind}</span>
            <span>{x.label}</span>
            {x.url && <a href={x.url} target="_blank" onClick={e => e.stopPropagation()}><Icon d={I.ext} size={12} /></a>}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------- Signals ---------------- */
function Signals({ data, open }) {
  const [type, setType] = useState('all');
  const list = data.events.filter(s => type === 'all' || s.type === type);
  const reports = data.events.reduce((a, e) => a + e.reports.length, 0);
  return (
    <>
      <div className="card">
        <div className="card-h"><h3>Log a signal</h3><span className="muted small">e.g. a LinkedIn post you saw</span></div>
        <LogSignal vcs={[...data.vcs].sort((a, b) => a.firm.localeCompare(b.firm))} today={data.today} />
      </div>
      <div className="card">
        <div className="filters">
          <div className="small muted">{data.events.length} events in the last 30 days, from {reports} reports. Duplicates across outlets are grouped and counted once.</div>
          <select value={type} onChange={e => setType(e.target.value)}>
            <option value="all">All types</option>
            {Object.entries(TYPE_NAMES).map(([k, v]) => <option key={k} value={k}>{k} {v}</option>)}
          </select>
        </div>
        <div className="feed">
          {list.map(s => (
            <div key={s.key} className="feeditem">
              <div className="feed-meta">
                <b className="link" onClick={() => open(s.vc_id)}>{s.firm}</b>
                <span className="tag">{s.type}</span><span className="tag t-rel">{s.manual ? 'core (logged)' : s.relevance}</span>
                {s.deal_stage && <span className="tag t-rel">{s.deal_stage}</span>}
                <WhoTag item={s} />
                <span className="muted small">{fmt(s.published_at)} · {s.manual ? 'logged by Vikram' : host(s.url)}</span>
              </div>
              <a href={s.url} target="_blank">{s.summary}</a>
              {s.reports.length > 1 && <details><summary>{s.reports.length} reports of this event (numbers can differ by outlet)</summary>{s.reports.map((r, j) => (
                <div key={j} className="small"><a href={r.url} target="_blank">{host(r.url)}</a> · {fmt(r.published_at)} · {r.summary}</div>
              ))}</details>}
            </div>
          ))}
          {list.length === 0 && <p className="muted">No signals.</p>}
        </div>
        <details className="rejected-list">
          <summary>Rejected ({data.rejected.length}): what the pipeline threw out, and why</summary>
          {data.rejected.map(s => (
            <div key={s.id} className="feeditem rejected">
              <div className="feed-meta"><b>{s.firm}</b>{s.type && <span className="tag">{s.type}</span>}<span className="muted small">{fmt(s.published_at)} · {s.source}</span></div>
              <a href={s.url} target="_blank">{s.summary || s.title}</a>
              <div className="small reason">Not counted: {s.rejected_reason}</div>
            </div>
          ))}
        </details>
      </div>
    </>
  );
}

function LogSignal({ vcs, today }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [date, setDate] = useState('');
  const tooOld = date && date < addDays(today, -30);
  async function submit(e) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    setBusy(true); setMsg(null);
    try {
      const r = await fetch('/api/log', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(f) });
      const j = await r.json();
      setMsg({ ok: j.ok, text: j.message });
      if (j.ok) { e.target.reset(); setDate(''); setTimeout(() => location.reload(), 1500); }
    } catch (err) { setMsg({ ok: false, text: err.message }); }
    setBusy(false);
  }
  return (
    <form className="logform" onSubmit={submit}>
      <select name="vc_id" required defaultValue=""><option value="" disabled>Select VC</option>{vcs.map(v => <option key={v.vc_id} value={v.vc_id}>{v.firm}</option>)}</select>
      <input name="url" type="url" placeholder="Link (LinkedIn post, article)" required />
      <input name="post_date" type="date" max={today} required value={date} onChange={e => setDate(e.target.value)} />
      <input name="line" placeholder="One line: what happened" required />
      <button className="btn primary" disabled={busy}>{busy ? 'Processing...' : 'Log signal'}</button>
      <div className={`small formmsg ${msg ? (msg.ok ? 'ok' : 'bad') : tooOld ? 'bad' : 'muted'}`}>
        {msg ? msg.text : tooOld ? 'Older than 30 days: it will be stored but not counted (30-day rule).' : 'Processed immediately. Gemini labels the type, relevance is treated as core, the 30-day rule still applies.'}
      </div>
    </form>
  );
}

/* ---------------- Runs ---------------- */
const TRIGGER_NOTE = { cron: 'scheduled pipeline run', manual: 'Run now / CLI pipeline run', verify: 'pipeline run via /api/verify', log: 'Log a signal (1 item)',
  status: 'your status change (rescore, no fetch)', relabel: 'one-off v3 relabel of stored signals', snapshot: 'score snapshot before v3' };
function Runs({ runs }) {
  const pipeline = runs.filter(r => ['cron', 'manual', 'verify'].includes(r.trigger));
  const tot = runs.reduce((a, r) => ({ inr: a.inr + r.cost_inr, cr: a.cr + r.tavily_credits, tk: a.tk + r.gemini_input_tokens + r.gemini_output_tokens }), { inr: 0, cr: 0, tk: 0 });
  const max = Math.max(1, ...runs.map(r => r.cost_inr));
  return (
    <>
      <div className="kpis">
        <div className="kpi static"><small>Pipeline runs</small><b>{pipeline.length}</b><span className="muted small">{runs.length} entries incl. logs / status</span></div>
        <div className="kpi static"><small>Total cost</small><b>₹{tot.inr.toFixed(2)}</b></div>
        <div className="kpi static"><small>Tavily credits</small><b>{tot.cr}</b></div>
        <div className="kpi static"><small>Gemini tokens</small><b>{tot.tk.toLocaleString('en-IN')}</b></div>
      </div>
      <div className="card">
        <p className="muted small">Every entry is listed. Run ids skip #1, #3, #5 and #6: those were build-time test runs deleted on 12 Oct (a local test log, and the test-set import that broke the live-data rule). Scheduled runs are skipped if a full run succeeded in the last 6 hours.
          Cost = Tavily credits × $0.008 + Gemini Flash tokens at $0.50 / $3.00 per 1M (in / out), at ₹88/$ (list prices; free tiers make the bill ₹0 at this volume).</p>
        <div className="wrap"><table className="tbl">
          <thead><tr><th>#</th><th>Trigger</th><th>Started (IST)</th><th>Status</th><th>Fetched</th><th>New</th><th>Counted</th><th>Tavily</th><th>Gemini in / out</th><th>Cost ₹</th><th>Changed</th><th>Errors</th></tr></thead>
          <tbody>{runs.map(r => (
            <tr key={r.id}>
              <td>{r.id}</td><td><span className="tag" title={TRIGGER_NOTE[r.trigger] || ''}>{r.trigger}</span><div className="small muted">{TRIGGER_NOTE[r.trigger]}</div></td><td className="small">{fmtDT(r.started_at)}</td>
              <td><span className={`pill ${r.status === 'ok' ? 'p-reach' : r.status === 'error' ? 'p-flag' : 'p-unknown'}`}>{r.status}</span></td>
              <td>{r.items_fetched}</td><td>{r.items_new}</td><td>{r.signals_counted}</td><td>{r.tavily_credits}</td>
              <td className="small mono">{r.gemini_input_tokens.toLocaleString('en-IN')} / {r.gemini_output_tokens.toLocaleString('en-IN')}</td>
              <td><div className="costbar"><i style={{ width: `${(r.cost_inr / max) * 100}%` }} /><b>{r.cost_inr.toFixed(2)}</b></div></td>
              <td className="small">{(r.changes || []).length ? <details><summary>{r.changes.length} VCs</summary>{r.changes.map(c => <div key={c.vc_id}>{c.firm}: {c.from_score} → {c.to_score}</div>)}</details> : '0'}</td>
              <td className="small">{(r.errors || []).length ? <details><summary>{r.errors.length}</summary>{r.errors.map((e, i) => <div key={i}>{e}</div>)}</details> : '0'}</td>
            </tr>
          ))}</tbody>
        </table></div>
      </div>
    </>
  );
}
