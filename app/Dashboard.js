'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Sun, Table2, ArrowUpDown, CalendarDays, Radio, ClipboardList, Lock, Sparkles, Search, X, Copy, Check, ExternalLink,
  ChevronDown, ChevronRight, ChevronLeft, Plus, Info, ShieldCheck, AlertTriangle, PanelLeftClose, PanelLeftOpen, Play, Clock,
  Trash2, ArrowUp, ArrowDown, Rows3, Rows4,
} from 'lucide-react';

/* ---------------- constants & helpers ---------------- */
const BANDS = {
  reach: { label: 'Reach out', long: 'Reach out this week' },
  warm: { label: 'Warm', long: 'Warm: mention the signal' },
  low: { label: 'Low', long: 'Low priority' },
  checkout: { label: 'Check out', long: 'Check out (older news)' },
  unknown: { label: 'No news', long: 'No news found (unknown)' },
};
const ORDER = ['reach', 'warm', 'low', 'checkout', 'unknown'];
const parked = v => ['Passed', 'Not now'].includes(v.my_status);
const NAV = [
  { key: 'today', label: 'Today', icon: Sun, sub: 'Who to message today, why, and who to skip this week', key2: 't' },
  { key: 'pipeline', label: 'Pipeline', icon: Table2, sub: 'All 50 VCs, mirroring the Neon pipeline table', key2: 'p' },
  { key: 'changes', label: 'Changes', icon: ArrowUpDown, sub: 'What moved since the previous run', key2: 'c' },
  { key: 'calendar', label: 'Calendar', icon: CalendarDays, sub: 'Signals, events, runs and your notes by day', key2: 'a' },
  { key: 'signals', label: 'Signals', icon: Radio, sub: 'Every accepted signal, newest first', key2: 's' },
  { key: 'report', label: 'Last run report', icon: ClipboardList, sub: 'Run now, cost, coverage and proof your data is untouched', key2: 'r' },
];

const d10 = d => String(d || '').slice(0, 10);
const fmt = (d, opt = { day: 'numeric', month: 'short' }) => (d ? new Date(d10(d) + 'T00:00:00Z').toLocaleDateString('en-GB', { ...opt, timeZone: 'UTC' }) : '');
const fmtDT = d => (d ? new Date(d).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '-');
const istDay = d => new Date(d).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
const host = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };
const addDays = (iso, n) => new Date(Date.parse(iso + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);
const weekStart = iso => { const d = new Date(d10(iso) + 'T00:00:00Z'); return addDays(d10(iso), -((d.getUTCDay() + 6) % 7)); };
const isIndia = e => !e.event_country || /india/i.test(e.event_country);

function BandChip({ band, small }) {
  return <span className={`band band-${band} ${small ? 'sm' : ''}`}>{BANDS[band]?.label || band}</span>;
}
function Score({ v }) { return <span className="score mono">{v.score}</span>; }
function SourceLink({ url }) {
  if (!url || !/^https?:/.test(url)) return <span className="muted small">No source link: do not rely on this</span>;
  return <a className="src" href={url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}>{host(url)} <ExternalLink size={12} aria-hidden /></a>;
}
function Clamp({ text, lines = 2, className = '' }) {
  return <span className={`clamp clamp-${lines} ${className}`} title={text || ''}>{text}</span>;
}

/* ---------------- shell ---------------- */
export default function Dashboard({ data, initialTab }) {
  const [tab, setTab] = useState(initialTab);
  const [collapsed, setCollapsed] = useState(false);
  const [selected, setSelected] = useState(null);
  const [pipeBand, setPipeBand] = useState('all');
  const [toasts, setToasts] = useState([]);
  const [notes, setNotes] = useState(data.notes);
  const searchRef = useRef(null);
  const byId = useMemo(() => Object.fromEntries(data.vcs.map(v => [v.vc_id, v])), [data.vcs]);

  const toast = useCallback((text, kind = 'ok') => {
    const id = Math.random();
    setToasts(t => [...t, { id, text, kind }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3200);
  }, []);
  const go = useCallback((t, opts = {}) => {
    setTab(t); if (opts.band) setPipeBand(opts.band);
    window.history.replaceState(null, '', t === 'today' ? '/' : `/?tab=${t}`);
    window.scrollTo(0, 0);
  }, []);
  const open = id => setSelected(byId[id] || null);

  useEffect(() => { try { setCollapsed(localStorage.getItem('sidebar') === 'c'); } catch {} }, []);
  const toggleSidebar = () => setCollapsed(c => { try { localStorage.setItem('sidebar', c ? 'o' : 'c'); } catch {} return !c; });

  // Keyboard: "/" search, "g" + t/p/c/a/s/r to switch pages, Esc closes panels
  useEffect(() => {
    let g = false, timer;
    const onKey = e => {
      const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName);
      if (e.key === 'Escape') { setSelected(null); return; }
      if (typing) return;
      if (e.key === '/') {
        e.preventDefault();
        if (tab !== 'pipeline') go('pipeline');
        setTimeout(() => searchRef.current?.focus(), 50); return;
      }
      if (g) { const n = NAV.find(x => x.key2 === e.key); if (n) go(n.key); g = false; return; }
      if (e.key === 'g') { g = true; clearTimeout(timer); timer = setTimeout(() => { g = false; }, 900); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tab, go]);

  const page = NAV.find(n => n.key === tab);
  const next = data.nextRun ? new Date(data.nextRun).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '-';

  return (
    <div className={`shell ${collapsed ? 'collapsed' : ''}`}>
      <a href="#main" className="skip">Skip to content</a>
      <aside className="side" aria-label="Main navigation">
        <div className="brand">
          <span className="logo" aria-hidden>V</span>
          <div className="brand-text"><b>VC Pipeline</b><small>Vikram · Seed · B2B logistics</small></div>
          <button className="icon-btn on-navy collapse-btn" onClick={toggleSidebar} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
            {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
        </div>
        <nav>
          {NAV.map(n => {
            const I = n.icon;
            return (
              <button key={n.key} className={`nav ${tab === n.key ? 'on' : ''}`} onClick={() => go(n.key)} title={`${n.label} (g ${n.key2})`} aria-current={tab === n.key ? 'page' : undefined}>
                <I size={18} aria-hidden /><span>{n.label}</span>
              </button>
            );
          })}
        </nav>
        <div className="side-foot">
          <div className="nextline"><Clock size={14} aria-hidden /><span>Next run: <b className="mono">{next}</b></span></div>
          <p>Public link · no login · press <kbd>/</kbd> to search</p>
        </div>
      </aside>

      <div className="main" id="main">
        <header className="pagehead">
          <h1>{page.label}</h1>
          <p className="muted">{page.sub}</p>
        </header>
        <div className="content">
          {tab === 'today' && <Today data={data} open={open} go={go} toast={toast} />}
          {tab === 'pipeline' && <Pipeline data={data} band={pipeBand} setBand={setPipeBand} open={open} searchRef={searchRef} />}
          {tab === 'changes' && <Changes data={data} open={open} />}
          {tab === 'calendar' && <Calendar data={data} open={open} go={go} notes={notes} setNotes={setNotes} toast={toast} />}
          {tab === 'signals' && <Signals data={data} open={open} toast={toast} />}
          {tab === 'report' && <Report data={data} open={open} toast={toast} />}
        </div>
      </div>

      {selected && <Drawer vc={selected} statuses={data.statuses} onClose={() => setSelected(null)} toast={toast} />}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map(t => <div key={t.id} className={`toast ${t.kind}`}>{t.kind === 'err' ? <AlertTriangle size={16} /> : <Check size={16} />}{t.text}</div>)}
      </div>
    </div>
  );
}

/* ---------------- Today ---------------- */
function CopyButton({ text, toast, label = 'Copy' }) {
  const [done, setDone] = useState(false);
  return (
    <button className="btn ghost sm" onClick={async e => {
      e.stopPropagation();
      try { await navigator.clipboard.writeText(text); setDone(true); toast('Opener copied'); setTimeout(() => setDone(false), 1500); }
      catch { toast('Could not copy', 'err'); }
    }}>{done ? <Check size={14} /> : <Copy size={14} />}{done ? 'Copied' : label}</button>
  );
}

function Today({ data, open, go, toast }) {
  const [openBand, setOpenBand] = useState(null);
  const [skipOpen, setSkipOpen] = useState(false);
  const active = data.vcs.filter(v => !parked(v));
  const reach = active.filter(v => v.band === 'reach').sort((a, b) => b.score - a.score);
  const warm = active.filter(v => v.band === 'warm').sort((a, b) => b.score - a.score);
  const hit = [...reach, ...warm].slice(0, 7);
  const rest = reach.length + warm.length - hit.length;
  const skip = data.vcs.filter(v => v.skip);
  const counts = Object.fromEntries(ORDER.map(b => [b, data.vcs.filter(v => v.band === b).length]));
  const n = reach.length;
  const verdict = n >= 5 ? ['Heavy outreach day', `${n} VCs to message`] : n >= 1 ? ['Light day', `${n} VC${n === 1 ? '' : 's'} to message`] : ['Quiet day', 'nobody crossed 60'];

  return (
    <div className="stack-lg">
      <section className="verdict" aria-label="Today's verdict">
        <b>{verdict[0]}:</b> {verdict[1]}
        {data.lastRun && <span className="muted small"> · from run #{data.lastRun.id}, {fmtDT(data.lastRun.finished_at)}</span>}
      </section>

      <section aria-label="VCs by band">
        <div className="bandrow">
          {ORDER.map(b => (
            <button key={b} className={`bandnum bn-${b} ${openBand === b ? 'on' : ''}`} aria-expanded={openBand === b} onClick={() => setOpenBand(openBand === b ? null : b)}>
              <span className="mono num">{counts[b]}</span><span className="lbl">{BANDS[b].long}</span>
              <ChevronDown size={14} className="chev" aria-hidden />
            </button>
          ))}
        </div>
        {openBand && <BandList band={openBand} vcs={data.vcs.filter(v => v.band === openBand)} open={open} />}
      </section>

      <section aria-label="This week's hit list">
        <div className="sec-h"><h2>This week&apos;s hit list</h2>
          <span className="muted small">{reach.length} reach out + top warm, by score{rest > 0 && <> · <button className="linkbtn" onClick={() => go('pipeline')}>See all {rest + hit.length} in Pipeline →</button></>}</span></div>
        {hit.length === 0 ? <p className="empty">No VC has a scoring signal this run. Nothing to send today; check the Check out list or log what you have seen yourself.</p> : (
          <div className="hitlist">{hit.map((v, i) => <HitCard key={v.vc_id} v={v} rank={i + 1} open={open} toast={toast} />)}</div>
        )}
      </section>

      <section aria-label="Skip this week" className="card">
        <button className="collapse-h" aria-expanded={skipOpen} onClick={() => setSkipOpen(!skipOpen)}>
          {skipOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}<h2>Quiet: skip this week</h2><span className="pill-count mono">{skip.length} to skip this week</span>
        </button>
        {skipOpen && (
          <ul className="skiplist">{skip.map(v => (
            <li key={v.vc_id} onClick={() => open(v.vc_id)}><b>{v.firm}</b><BandChip band={v.band} small /><Clamp text={v.skip} lines={1} className="muted small" /></li>
          ))}</ul>
        )}
      </section>
    </div>
  );
}

function BandList({ band, vcs, open }) {
  const list = [...vcs].sort((a, b) => b.score - a.score || a.firm.localeCompare(b.firm));
  return (
    <div className="bandlist card">
      {list.length === 0 && <p className="muted">None in this band.</p>}
      {list.map(v => {
        const best = v.items.find(i => i.best);
        return (
          <div key={v.vc_id} className="bl-row" onClick={() => open(v.vc_id)}>
            <div className="bl-name"><b>{v.firm}</b><span className="muted small">{v.partner_name || 'no tracked partner'}</span></div>
            {band !== 'checkout' && band !== 'unknown' ? <span className="score mono">{v.score}</span> : <span />}
            <div className="bl-line">
              {band === 'unknown' ? <span className="muted small">Nothing found in tracked sources (30 days)</span>
                : band === 'checkout' && v.checkout ? <><Clamp text={v.checkout.summary} lines={1} className="small" /><span className="mono small muted">{fmt(v.checkout.published_at)}</span><SourceLink url={v.checkout.url} /></>
                : best ? <><Clamp text={best.summary} lines={1} className="small" /><SourceLink url={best.url} /></> : <span className="muted small">{v.recommended_action}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function HitCard({ v, rank, open, toast }) {
  const best = v.items.find(i => i.best);
  return (
    <article className="hit card" onClick={() => open(v.vc_id)}>
      <header className="hit-h">
        <span className="rank mono">{rank}</span>
        <div className="hit-title"><b>{v.firm}</b><span className="muted small">{v.partner_name ? `${v.partner_name}${v.partner_title ? `, ${v.partner_title}` : ''}` : 'no tracked partner'}</span></div>
        {v.flags.includes('Check for conflict') && <span className="chip-alert">Check for conflict</span>}
        <BandChip band={v.band} /><Score v={v} />
      </header>
      <dl className="hit-rows">
        <dt>What happened</dt><dd>{v.what_line || '-'}</dd>
        <dt>Proof</dt><dd className="proof"><Clamp text={best?.summary} lines={2} />{best && <SourceLink url={best.url} />}</dd>
        <dt>Where we stand</dt><dd>{v.stand}</dd>
        <dt>What to do</dt>
        <dd>
          <Clamp text={v.recommended_action} lines={2} />
          {v.opener && <div className="opener" onClick={e => e.stopPropagation()}><Clamp text={v.opener} lines={2} className="small" /><CopyButton text={v.opener} toast={toast} /></div>}
        </dd>
      </dl>
    </article>
  );
}

/* ---------------- Pipeline ---------------- */
const COLS = [
  { k: 'firm', label: 'Firm', group: 'mine', get: v => v.firm },
  { k: 'partner', label: 'Partner', group: 'mine', get: v => v.partner_name || '' },
  { k: 'thesis', label: 'Thesis', group: 'mine', get: v => v.thesis_quote || '' },
  { k: 'status', label: 'Status', group: 'mine', get: v => v.status || '' },
  { k: 'contact', label: 'Last contact', group: 'mine', get: v => v.last_contact_date || '' },
  { k: 'notes', label: 'My notes', group: 'mine', get: v => v.personal_notes || '' },
  { k: 'lsd', label: 'Last signal date', group: 'sys', get: v => v.last_signal_date || '' },
  { k: 'summary', label: 'Signal summary', group: 'sys', get: v => v.signal_summary || '' },
  { k: 'score', label: 'Follow-up score', group: 'sys', get: v => v.score },
  { k: 'action', label: 'Recommended action', group: 'sys', get: v => v.recommended_action || '' },
];

function Pipeline({ data, band, setBand, open, searchRef }) {
  const [q, setQ] = useState('');
  const [flagsOnly, setFlagsOnly] = useState(false);
  const [sort, setSort] = useState({ k: 'score', dir: -1 });
  const [dense, setDense] = useState(false);
  const counts = Object.fromEntries(ORDER.map(b => [b, data.vcs.filter(v => v.band === b).length]));
  const col = COLS.find(c => c.k === sort.k);
  const list = data.vcs
    .filter(v => (band === 'all' || v.band === band) && (!flagsOnly || v.flags.length) &&
      (!q || `${v.firm} ${v.partner_name || ''} ${v.signal_summary || ''} ${v.recommended_action || ''}`.toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => { const x = col.get(a), y = col.get(b); return (typeof x === 'number' ? x - y : String(x).localeCompare(String(y))) * sort.dir || a.firm.localeCompare(b.firm); });
  const th = c => (
    <th key={c.k} className={`g-${c.group}`} aria-sort={sort.k === c.k ? (sort.dir > 0 ? 'ascending' : 'descending') : 'none'}>
      <button className="sortbtn" onClick={() => setSort(s => ({ k: c.k, dir: s.k === c.k ? -s.dir : (c.k === 'score' ? -1 : 1) }))}>
        {c.label}{sort.k === c.k && (sort.dir > 0 ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
      </button>
    </th>
  );
  return (
    <div className="stack">
      <div className="toolbar">
        <div className="chips">
          <button className={`chip ${band === 'all' ? 'on' : ''}`} onClick={() => setBand('all')}>All <span className="mono">{data.vcs.length}</span></button>
          {ORDER.map(b => <button key={b} className={`chip ${band === b ? 'on' : ''}`} onClick={() => setBand(b)}><i className={`dot dot-${b}`} />{BANDS[b].label} <span className="mono">{counts[b]}</span></button>)}
          <button className={`chip ${flagsOnly ? 'on' : ''}`} onClick={() => setFlagsOnly(!flagsOnly)}>Conflict flag <span className="mono">{data.vcs.filter(v => v.flags.length).length}</span></button>
        </div>
        <div className="row">
          <label className="search"><Search size={15} aria-hidden /><input ref={searchRef} placeholder="Search  ( / )" value={q} onChange={e => setQ(e.target.value)} aria-label="Search VCs" /></label>
          <button className="btn ghost sm" onClick={() => setDense(!dense)} aria-pressed={dense}>{dense ? <Rows4 size={14} /> : <Rows3 size={14} />}{dense ? 'Compact' : 'Comfortable'}</button>
        </div>
      </div>
      <div className="tablewrap card flush">
        <table className={`ptable ${dense ? 'dense' : ''}`}>
          <thead>
            <tr className="grouprow">
              <th colSpan={6} className="g-mine"><Lock size={13} aria-hidden /> Your columns (read-only)</th>
              <th colSpan={4} className="g-sys"><Sparkles size={13} aria-hidden /> Updated by the system (only these 4)</th>
            </tr>
            <tr>{COLS.map(th)}</tr>
          </thead>
          <tbody>
            {list.map(v => (
              <tr key={v.vc_id} onClick={() => open(v.vc_id)} tabIndex={0} onKeyDown={e => e.key === 'Enter' && open(v.vc_id)}>
                <td className="g-mine"><b>{v.firm}</b>{v.flags.includes('Check for conflict') && <span className="chip-alert sm">conflict</span>}</td>
                <td className="g-mine small">{v.partner_name || <span className="muted">-</span>}</td>
                <td className="g-mine small"><Clamp text={v.thesis_quote} lines={2} /></td>
                <td className="g-mine small">{v.status || <span className="muted">-</span>}{v.my_status && <div className="muted">set here: {v.my_status}</div>}</td>
                <td className="g-mine small mono">{v.last_contact_date ? fmt(v.last_contact_date) : <span className="muted">-</span>}</td>
                <td className="g-mine small"><Clamp text={v.personal_notes || '-'} lines={2} className={v.personal_notes ? '' : 'muted'} /></td>
                <td className="g-sys small mono">{v.last_signal_date ? fmt(v.last_signal_date) : '-'}</td>
                <td className="g-sys small"><Clamp text={v.signal_summary || '-'} lines={2} /></td>
                <td className="g-sys"><span className="score mono">{v.score}</span> <BandChip band={v.band} small /></td>
                <td className="g-sys small"><Clamp text={v.recommended_action || '-'} lines={2} /></td>
              </tr>
            ))}
            {list.length === 0 && <tr><td colSpan={10} className="muted">No VCs match.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusSetter({ vc, statuses, toast }) {
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  async function save(s) {
    setStatus(s); setBusy(true);
    const r = await fetch('/api/status', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ vc_id: vc.vc_id, status: s }) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (j.ok) { toast(`Status saved: ${s}`); setTimeout(() => location.reload(), 600); } else toast(j.message || 'Could not save', 'err');
  }
  return (
    <label className="statusset small">
      <span className="muted">My status (separate log):</span>
      <select value={status} disabled={busy} onChange={e => save(e.target.value)}>
        <option value="" disabled>{vc.my_status || 'Set…'}</option>
        {statuses.map(s => <option key={s}>{s}</option>)}
      </select>
    </label>
  );
}

function Drawer({ vc, statuses, onClose, toast }) {
  const [t, setT] = useState('signals');
  const counted = vc.items.filter(i => i.points > 0);
  const best = counted[0];
  const TABS = [['signals', 'Signals'], ['score', 'Score'], ['partner', 'Partner & thesis'], ['warm', 'Warm path']];
  return (
    <div className="overlay" onClick={onClose}>
      <aside className="drawer" role="dialog" aria-modal="true" aria-label={vc.firm} onClick={e => e.stopPropagation()}>
        <header className="drawer-h">
          <div>
            <h2>{vc.firm}</h2>
            <div className="row small muted">{vc.partner_name || 'No tracked partner'} · {vc.vc_type || vc.vc_group}</div>
            <div className="row" style={{ marginTop: 8 }}><span className="score mono lg">{vc.score}</span><BandChip band={vc.band} />
              {vc.flags.includes('Check for conflict') && <span className="chip-alert">Check for conflict</span>}</div>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </header>
        <p className="action-line">{vc.recommended_action}</p>
        <StatusSetter vc={vc} statuses={statuses} toast={toast} />
        <div className="tabs" role="tablist">
          {TABS.map(([k, l]) => <button key={k} role="tab" aria-selected={t === k} className={`tab ${t === k ? 'on' : ''}`} onClick={() => setT(k)}>{l}</button>)}
        </div>

        {t === 'signals' && <div className="stack">
          {vc.checkout && <div className="sig checkout"><BandChip band="checkout" small /><Clamp text={vc.checkout.summary} lines={2} /><div className="row small muted"><span className="mono">{fmt(vc.checkout.published_at)}</span><SourceLink url={vc.checkout.url} /></div></div>}
          {vc.items.length === 0 && !vc.checkout && <p className="empty">No signal in tracked sources in the last 30 days.</p>}
          {vc.items.map((i, k) => (
            <div key={k} className="sig">
              <div className="row small"><b>{i.plain}</b><span className="muted mono">{fmt(i.published_at)}</span>{i.copies > 1 && <span className="muted">{i.copies} reports</span>}<span className="muted">{i.who}</span></div>
              <Clamp text={i.summary} lines={2} />
              <SourceLink url={i.url} />
            </div>
          ))}
        </div>}

        {t === 'score' && <div className="stack">
          {counted.length === 0 ? <p className="empty">Nothing scored, so the score is 0{vc.checkout ? ' (Check out band: older news is shown, never scored)' : ''}.</p> : counted.map((i, k) => (
            <div key={k} className="scorebox">
              <div className="row small"><b>{i.plain}</b><span className="muted">{fmt(i.published_at)}</span>{i.best && <span className="tag">best</span>}<span className="mono right">{i.points}</span></div>
              {[['What', i.what, 0.5, 50], ['Logistics', i.logistics, 0.3, 30], ['Fresh', i.fresh, 0.15, 15], ['Led', i.led, 0.05, 5]].map(([l, raw, w, max]) => (
                <div key={l} className="bar-row">
                  <span className="bar-l small">{l} <span className="muted">{Math.round(w * 100)}%</span></span>
                  <span className="bar"><i style={{ width: `${(raw * w / max) * 100}%` }} /></span>
                  <span className="mono small">{(raw * w).toFixed(1)}<span className="muted">/{max}</span></span>
                </div>
              ))}
            </div>
          ))}
          {best && <p className="formula mono small">best {best.points.toFixed(1)} + 5 × {vc.extra} extra signal{vc.extra === 1 ? '' : 's'} (max +15) = {vc.raw}{vc.cap < 100 ? ` → capped at ${vc.cap}` : ''} → <b>{vc.score}</b></p>}
        </div>}

        {t === 'partner' && <dl className="kv">
          <dt>Partner</dt><dd>{vc.partner_name ? `${vc.partner_name}${vc.partner_title ? `, ${vc.partner_title}` : ''}` : '-'}{vc.partner_verified_on_firm_site !== 'yes' && <span className="tag">verify partner</span>}</dd>
          {vc.team_page_url && <><dt>Team page</dt><dd><SourceLink url={vc.team_page_url} /></dd></>}
          <dt>Seed evidence</dt><dd>{vc.thesis_quote ? `"${vc.thesis_quote}"` : '-'} {vc.thesis_url && <SourceLink url={vc.thesis_url} />}</dd>
          <dt>Type</dt><dd>{vc.vc_type || '-'}</dd>
          {vc.watch_outs && <><dt>Watch-outs</dt><dd>{vc.watch_outs}</dd></>}
          <dt><Lock size={12} /> Status</dt><dd>{vc.status || '-'}</dd>
          <dt><Lock size={12} /> Last contact</dt><dd className="mono">{vc.last_contact_date ? fmt(vc.last_contact_date, { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}</dd>
          <dt><Lock size={12} /> Contact history</dt><dd>{vc.contact_history || '-'}</dd>
          <dt><Lock size={12} /> My notes</dt><dd>{vc.personal_notes || '-'}</dd>
        </dl>}

        {t === 'warm' && <div className="stack">
          {vc.logistics_evidence ? <>
            <p>Warm path: ask a founder from their logistics portfolio.</p>
            <div className="sig"><Clamp text={vc.logistics_evidence} lines={3} /><SourceLink url={vc.logistics_source_url} /></div>
            {vc.second_logistics_deal && <div className="sig"><Clamp text={vc.second_logistics_deal} lines={3} /><SourceLink url={vc.second_logistics_source_url} /></div>}
            <p className="muted small">Company names exactly as in the research sheet. No founder names or LinkedIn links are invented.</p>
          </> : <p className="empty">No logistics deal on record for this VC.</p>}
        </div>}
      </aside>
    </div>
  );
}

/* ---------------- Changes ---------------- */
function Changes({ data, open }) {
  const [i, setI] = useState(0);
  const sel = data.changes[i];
  if (!sel) return <p className="empty">No score snapshots yet. Changes appear after the second run.</p>;
  return (
    <div className="stack">
      <div className="toolbar">
        <label className="row small">Compare
          <select value={i} onChange={e => setI(Number(e.target.value))}>
            {data.changes.map((c, k) => <option key={c.run.id} value={k}>Run #{c.run.id} ({c.run.trigger}){c.prev ? ` vs #${c.prev}` : ''}</option>)}
          </select>
        </label>
        <span className="muted small">{sel.run.at ? fmtDT(sel.run.at) : ''} · {sel.rows.length} VC{sel.rows.length === 1 ? '' : 's'} changed</span>
      </div>
      {sel.rows.length === 0 ? <p className="empty">Nothing changed in this run.</p> : (
        <div className="tablewrap card flush"><table className="ptable">
          <thead><tr><th>VC</th><th>Score</th><th>Band</th><th><span className="sr">Direction</span></th><th>Reason</th></tr></thead>
          <tbody>{sel.rows.map(c => {
            const up = c.to_score > c.from_score, down = c.to_score < c.from_score;
            return (
              <tr key={c.vc_id} onClick={() => open(c.vc_id)}>
                <td><b>{c.firm}</b></td>
                <td className="mono">{c.from_score} → <b>{c.to_score}</b></td>
                <td className="nowrap"><BandChip band={c.from_band} small /> → <BandChip band={c.to_band} small /></td>
                <td>{up ? <ArrowUp size={16} className="up" aria-label="up" /> : down ? <ArrowDown size={16} className="down" aria-label="down" /> : <span className="muted">•</span>}</td>
                <td className="small"><Clamp text={c.summary || c.to_action} lines={1} /> {c.url && <SourceLink url={c.url} />}</td>
              </tr>
            );
          })}</tbody>
        </table></div>
      )}
    </div>
  );
}

/* ---------------- Calendar ---------------- */
function Calendar({ data, open, go, notes, setNotes, toast }) {
  const [ym, setYm] = useState(data.today.slice(0, 7));
  const [day, setDay] = useState(data.today);
  const [panel, setPanel] = useState('day');
  const [y, m] = ym.split('-').map(Number);

  const marks = useMemo(() => {
    const M = {};
    const add = (d, k, item) => { (M[d] ||= { runs: 0, signals: [], events: [], notes: 0 }); if (k === 'runs') M[d].runs++; else if (k === 'notes') M[d].notes++; else M[d][k].push(item); };
    data.runs.filter(r => ['cron', 'manual', 'verify'].includes(r.trigger)).forEach(r => add(istDay(r.started_at), 'runs'));
    const seen = new Set();
    data.events.filter(s => s.event_start).forEach(s => {
      const k = `${s.vc_id}|${s.event_name}|${s.event_start}`; if (seen.has(k)) return; seen.add(k);
      const end = s.event_end && s.event_end >= s.event_start ? s.event_end : s.event_start;
      for (let d = s.event_start; d <= end; d = addDays(d, 1)) add(d, 'events', s);
    });
    data.events.filter(s => s.published_at).forEach(s => add(d10(s.published_at), 'signals', s));
    notes.forEach(n => add(n.note_date, 'notes'));
    return M;
  }, [data, notes]);
  const sched = d => { const wd = new Date(d + 'T00:00:00Z').getUTCDay(); return d > data.today && (wd === 1 || wd === 4); };

  const first = new Date(Date.UTC(y, m - 1, 1));
  const pad = (first.getUTCDay() + 6) % 7;
  const daysIn = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells = [...Array(pad).fill(null), ...Array.from({ length: daysIn }, (_, i) => `${ym}-${String(i + 1).padStart(2, '0')}`)];
  const shift = n => setYm(new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7));
  const sel = marks[day] || { runs: 0, signals: [], events: [], notes: 0 };

  return (
    <div className="cal-layout">
      <div className="card">
        <div className="sec-h">
          <h2>{first.toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })}</h2>
          <div className="row">
            <button className="icon-btn" onClick={() => shift(-1)} aria-label="Previous month"><ChevronLeft size={18} /></button>
            <button className="btn ghost sm" onClick={() => { setYm(data.today.slice(0, 7)); setDay(data.today); }}>Today</button>
            <button className="icon-btn" onClick={() => shift(1)} aria-label="Next month"><ChevronRight size={18} /></button>
          </div>
        </div>
        <div className="cal">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => <div key={d} className="cal-h">{d}</div>)}
          {cells.map((d, i) => {
            if (!d) return <div key={i} className="cal-c empty" />;
            const mk = marks[d] || { runs: 0, signals: [], events: [], notes: 0 };
            const ev = mk.events[0];
            return (
              <button key={i} className={`cal-c ${d === data.today ? 'today' : ''} ${d === day ? 'sel' : ''}`} onClick={() => setDay(d)} aria-label={`${fmt(d, { day: 'numeric', month: 'long' })}: ${mk.signals.length} signals, ${mk.events.length} events, ${mk.runs} runs, ${mk.notes} notes`}>
                <span className="cal-n mono">{Number(d.slice(8))}</span>
                {ev && <span className={`cal-ev ${isIndia(ev) ? '' : 'abroad'}`} title={ev.event_name}>▲ {ev.event_name}</span>}
                <span className="cal-marks">
                  {(mk.runs > 0 || sched(d)) && <i className={mk.runs ? 'mk-run' : 'mk-sched'} title={mk.runs ? 'run' : 'scheduled run'} />}
                  {mk.signals.length > 0 && <span className="mk-sig" title={`${mk.signals.length} signals`}>◆{mk.signals.length > 1 ? mk.signals.length : ''}</span>}
                  {mk.notes > 0 && <i className="mk-note" title="note" />}
                </span>
              </button>
            );
          })}
        </div>
        <div className="legend small muted"><span><i className="mk-run" /> run day</span><span><i className="mk-sched" /> scheduled (Mon/Thu 6:30)</span><span>◆ signal</span><span><span className="cal-ev">▲ India event</span></span><span><span className="cal-ev abroad">▲ event abroad</span></span><span><i className="mk-note" /> note</span></div>
      </div>

      <div className="card">
        <div className="tabs" role="tablist">
          <button role="tab" aria-selected={panel === 'day'} className={`tab ${panel === 'day' ? 'on' : ''}`} onClick={() => setPanel('day')}>Day</button>
          <button role="tab" aria-selected={panel === 'notes'} className={`tab ${panel === 'notes' ? 'on' : ''}`} onClick={() => setPanel('notes')}>My notes</button>
        </div>
        <h3 className="dayhead">{fmt(day, { weekday: 'long', day: 'numeric', month: 'long' })}</h3>
        {panel === 'day' ? (
          <div className="stack">
            {sel.runs > 0 && <button className="linkbtn" onClick={() => go('report')}>{sel.runs} run{sel.runs > 1 ? 's' : ''} this day → Last run report</button>}
            {sel.events.map((e, k) => <div key={'e' + k} className="dayitem" onClick={() => open(e.vc_id)}><span className={`cal-ev ${isIndia(e) ? '' : 'abroad'}`}>▲ {e.event_name}</span><span className="small">{e.firm}{e.event_city ? ` · ${e.event_city}` : ''}</span><SourceLink url={e.url} /></div>)}
            {sel.signals.map((s, k) => <div key={'s' + k} className="dayitem" onClick={() => open(s.vc_id)}><b className="small">◆ {s.plain}</b><span className="small">{s.firm}: <Clamp text={s.summary} lines={2} /></span><SourceLink url={s.url} /></div>)}
            {!sel.runs && !sel.events.length && !sel.signals.length && <p className="empty">No signals or events on this day.</p>}
          </div>
        ) : <Notes day={day} notes={notes} setNotes={setNotes} toast={toast} setDay={d => { setDay(d); setYm(d.slice(0, 7)); }} />}
      </div>
    </div>
  );
}

function NoteEditor({ note, day, onSaved, onDeleted, toast }) {
  const [text, setText] = useState(note?.body || '');
  const [state, setState] = useState('');
  const [confirm, setConfirm] = useState(false);
  const timer = useRef(null);
  const save = async body => {
    if (!body.trim()) return;
    setState('Saving…');
    const r = note
      ? await fetch(`/api/notes/${note.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ body }) })
      : await fetch('/api/notes', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ note_date: day, body }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setState(''); toast(j.error || 'Could not save note', 'err'); return; }
    setState('Saved');
    onSaved(j.note, !note);
    if (!note) { toast('Note saved'); setText(''); }
  };
  const onChange = e => {
    const v = e.target.value.slice(0, 2000); setText(v); setState('');
    if (note) { clearTimeout(timer.current); timer.current = setTimeout(() => save(v), 800); } // autosave existing notes
  };
  const del = async () => {
    const r = await fetch(`/api/notes/${note.id}`, { method: 'DELETE' });
    if (r.ok) { onDeleted(note.id); toast('Note deleted'); } else toast('Could not delete', 'err');
  };
  return (
    <div className="note">
      <textarea value={text} onChange={onChange} placeholder={note ? '' : 'Write a note for this day…'} rows={3} maxLength={2000} aria-label={note ? 'Edit note' : 'New note'} />
      <div className="row small">
        <span className="muted mono">{text.length}/2000</span>
        <span className="saved">{state}</span>
        <span className="right row">
          {!note && <button className="btn primary sm" disabled={!text.trim()} onClick={() => save(text)}>Save note</button>}
          {note && (confirm
            ? <><button className="btn danger sm" onClick={del}>Confirm delete</button><button className="btn ghost sm" onClick={() => setConfirm(false)}>Cancel</button></>
            : <button className="btn ghost sm" onClick={() => setConfirm(true)}><Trash2 size={14} />Delete</button>)}
        </span>
      </div>
    </div>
  );
}

function Notes({ day, notes, setNotes, toast, setDay }) {
  const dayNotes = notes.filter(n => n.note_date === day);
  const onSaved = (n, isNew) => setNotes(ns => isNew ? [n, ...ns] : ns.map(x => x.id === n.id ? n : x));
  const onDeleted = id => setNotes(ns => ns.filter(x => x.id !== id));
  return (
    <div className="stack">
      {dayNotes.map(n => <NoteEditor key={n.id} note={n} day={day} onSaved={onSaved} onDeleted={onDeleted} toast={toast} />)}
      <NoteEditor key={`new-${day}-${dayNotes.length}`} note={null} day={day} onSaved={onSaved} onDeleted={onDeleted} toast={toast} />
      <p className="muted small">Visible to anyone with this link.</p>
      <h4>All notes</h4>
      {notes.length === 0 ? <p className="empty">No notes yet.</p> : (
        <ul className="allnotes">{[...notes].sort((a, b) => b.note_date.localeCompare(a.note_date) || String(b.created_at).localeCompare(String(a.created_at))).map(n => (
          <li key={n.id}><button className="linkbtn" onClick={() => setDay(n.note_date)}><span className="mono">{fmt(n.note_date)}</span></button> <Clamp text={n.body} lines={1} className="small" /></li>
        ))}</ul>
      )}
    </div>
  );
}

/* ---------------- Signals ---------------- */
function Signals({ data, open, toast }) {
  const [sheet, setSheet] = useState(false);
  const [rej, setRej] = useState(false);
  const weeks = useMemo(() => {
    const W = new Map();
    for (const e of data.events) { const k = weekStart(e.published_at); (W.get(k) || W.set(k, []).get(k)).push(e); }
    return [...W.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [data.events]);
  return (
    <div className="stack">
      <div className="toolbar">
        <span className="muted small">{data.events.length} events in the last 30 days, duplicates across outlets counted once</span>
        <button className="btn primary" onClick={() => setSheet(true)}><Plus size={16} />Log a signal</button>
      </div>
      {weeks.length === 0 && <p className="empty">No accepted signals in the last 30 days.</p>}
      {weeks.map(([wk, list]) => (
        <section key={wk} className="card">
          <h3 className="weekhead">Week of {fmt(wk, { day: 'numeric', month: 'short' })}</h3>
          <ul className="feed">{list.map(s => (
            <li key={s.key}>
              <span className="feed-type">{s.plain}</span>
              <div className="feed-body">
                <div className="row small"><button className="linkbtn" onClick={() => open(s.vc_id)}><b>{s.firm}</b></button>
                  <span className="mono muted">{fmt(s.published_at)}</span><SourceLink url={s.url} />
                  <span className="info" tabIndex={0} title={[`relevance: ${s.manual ? 'core (logged)' : s.relevance}`, s.deal_stage && `stage: ${s.deal_stage}`, s.person && `person: ${s.person} (${s.who})`, s.reports.length > 1 && `${s.reports.length} reports of this event`].filter(Boolean).join(' · ')}><Info size={14} aria-label="details" /></span>
                </div>
                <Clamp text={s.summary} lines={2} className="small" />
              </div>
            </li>
          ))}</ul>
        </section>
      ))}
      <section className="card">
        <button className="collapse-h" aria-expanded={rej} onClick={() => setRej(!rej)}>
          {rej ? <ChevronDown size={16} /> : <ChevronRight size={16} />}<h2>Rejected</h2><span className="pill-count mono">{data.rejected.length}</span>
        </button>
        {rej && <ul className="feed">{data.rejected.map(s => (
          <li key={s.id}><span className="feed-type muted">{s.type || '-'}</span><div className="feed-body">
            <div className="row small"><b>{s.firm}</b><span className="mono muted">{fmt(s.published_at)}</span><SourceLink url={s.url} /></div>
            <Clamp text={s.summary || s.title} lines={1} className="small" /><div className="small muted">Why: {s.rejected_reason}</div></div></li>
        ))}</ul>}
      </section>
      {sheet && <LogSheet vcs={data.vcs} today={data.today} onClose={() => setSheet(false)} toast={toast} />}
    </div>
  );
}

function LogSheet({ vcs, today, onClose, toast }) {
  const [busy, setBusy] = useState(false);
  const [date, setDate] = useState('');
  const [msg, setMsg] = useState(null);
  const age = date ? Math.round((Date.parse(today) - Date.parse(date)) / 86400000) : null;
  async function submit(e) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    const f = Object.fromEntries(new FormData(e.target));
    const r = await fetch('/api/log', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(f) }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : { message: 'Network error' };
    setBusy(false); setMsg(j);
    if (j.ok) { toast('Signal logged'); setTimeout(() => location.reload(), 1200); } else toast(j.message || 'Not counted', 'err');
  }
  return (
    <div className="overlay" onClick={onClose}>
      <aside className="drawer sheet" role="dialog" aria-modal="true" aria-label="Log a signal" onClick={e => e.stopPropagation()}>
        <header className="drawer-h"><h2>Log a signal</h2><button className="icon-btn" onClick={onClose} aria-label="Close"><X size={18} /></button></header>
        <form className="form" onSubmit={submit}>
          <label>VC<select name="vc_id" required defaultValue=""><option value="" disabled>Select VC</option>{[...vcs].sort((a, b) => a.firm.localeCompare(b.firm)).map(v => <option key={v.vc_id} value={v.vc_id}>{v.firm}</option>)}</select></label>
          <label>Link<input name="url" type="url" placeholder="https://www.linkedin.com/posts/…" required /></label>
          <label>Post date<input name="post_date" type="date" max={today} required value={date} onChange={e => setDate(e.target.value)} />
            {age != null && <span className={`small ${age > 30 ? 'warn' : 'muted'}`}>{age > 30 ? `${age} days old: stored but not counted (30-day rule)` : `${age} days old: inside the 30-day window`}</span>}</label>
          <label>One line<input name="line" placeholder="What happened" required /></label>
          <button className="btn primary" disabled={busy}>{busy ? 'Processing…' : 'Log signal'}</button>
          <p className="muted small">Processed now: Gemini labels the type, relevance is treated as core, the 30-day rule still applies.</p>
          {msg && <p className={`small ${msg.ok ? '' : 'warn'}`}>{msg.message}</p>}
        </form>
      </aside>
    </div>
  );
}

/* ---------------- Last run report ---------------- */
const TRIGGER_NOTE = { cron: 'scheduled run', manual: 'Run now / CLI', verify: 'via /api/verify', log: 'Log a signal', status: 'status change (rescore)', relabel: 'v3 relabel', snapshot: 'score snapshot' };

function RunNow({ nextAllowedAt, toast }) {
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const wait = nextAllowedAt ? Math.max(0, Date.parse(nextAllowedAt) - now) : 0;
  const mmss = `${Math.floor(wait / 60000)}:${String(Math.floor((wait % 60000) / 1000)).padStart(2, '0')}`;
  async function go() {
    setBusy(true); toast('Run started: feeds, 50 searches, labelling (about a minute)');
    const r = await fetch('/api/run', { method: 'POST' }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : { error: 'Network error' };
    setBusy(false);
    if (r?.ok) { toast(`Done: ${j.fetched} fetched, ${j.counted} counted`); setTimeout(() => location.reload(), 1200); } else toast(j.error || 'Run failed', 'err');
  }
  return (
    <div className="runnow">
      <button className="btn primary" onClick={go} disabled={busy || wait > 0}><Play size={14} />{busy ? 'Running…' : 'Run now'}</button>
      <span className="small muted">{wait > 0 ? <>Next allowed in <b className="mono">{mmss}</b></> : 'Limited to once per 30 minutes'}</span>
    </div>
  );
}

function Report({ data, open, toast }) {
  const r = data.lastRun;
  const v = data.verify || {};
  const ok = !v.error && v.guard;
  const next = data.nextRun ? new Date(data.nextRun).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '-';
  return (
    <div className="stack-lg">
      <div className="card toprow">
        <div><span className="muted small">Next run</span><b className="mono">{next}</b></div>
        <div><span className="muted small">Last run</span><b>{r ? <>#{r.id} · {r.trigger} · <span className="mono">{fmtDT(r.finished_at)}</span></> : '-'}</b></div>
        <RunNow nextAllowedAt={data.nextAllowedAt} toast={toast} />
      </div>
      <div className="stats">
        <div className="stat"><span className="muted small">VCs scanned</span><b className="mono">{data.vcs.length}</b></div>
        <div className="stat"><span className="muted small">Items fetched</span><b className="mono">{r?.items_fetched ?? '-'}</b></div>
        <div className="stat"><span className="muted small">Signals found</span><b className="mono">{r?.signals_counted ?? '-'}</b></div>
        <div className="stat"><span className="muted small">Cost</span><b className="mono">₹{r ? r.cost_inr.toFixed(2) : '-'}</b></div>
        <div className="stat"><span className="muted small">Tavily credits</span><b className="mono">{r?.tavily_credits ?? '-'}</b></div>
      </div>
      <div className={`card untouched ${ok ? '' : 'bad'}`}>
        {ok ? <ShieldCheck size={22} aria-hidden /> : <AlertTriangle size={22} aria-hidden />}
        <div>
          <b>{ok ? 'Your data untouched' : 'Check needed'}</b>
          <p>{ok ? 'Contact history, status and notes: unchanged by the pipeline ✓' : (v.error ? `Verify check failed: ${v.error}` : 'The database guard (trigger / write function) is missing. Code could write your columns.')}</p>
          <p className="muted small">Database guard active · fingerprint <span className="mono">{String(v.hash_contact_history_personal_notes || '').slice(0, 12)}…</span> · checked {fmtDT(v.at)} · <a href="/api/verify" target="_blank" rel="noreferrer">raw check</a></p>
        </div>
      </div>
      <section className="card">
        <div className="sec-h"><h2>Data gaps</h2><span className="muted small">no item at all from any source in the last 60 days</span></div>
        {data.gaps.length === 0 ? <p className="empty">Every VC had at least one item.</p> : (
          <div className="gaps">{data.gaps.map(g => <button key={g.vc_id} className="chip" onClick={() => open(g.vc_id)}>{g.firm}</button>)}</div>
        )}
        <p className="muted small">Coverage is thin here: news search found nothing about these firms. Log what you see on LinkedIn yourself.</p>
      </section>
      <section className="card flush">
        <div className="sec-h pad"><h2>Runs & cost</h2><span className="muted small">ids skip #1, #3, #5, #6 (build-time tests deleted); #11, #12 discarded with reasons</span></div>
        <div className="tablewrap"><table className="ptable">
          <thead><tr><th>#</th><th>Trigger</th><th>Started</th><th>Status</th><th>Fetched</th><th>Counted</th><th>Tavily</th><th>Gemini in / out</th><th>Cost ₹</th><th>Notes</th></tr></thead>
          <tbody>{data.runs.map(x => (
            <tr key={x.id}>
              <td className="mono">{x.id}</td><td title={TRIGGER_NOTE[x.trigger] || ''}>{x.trigger}</td><td className="mono small nowrap">{fmtDT(x.started_at)}</td>
              <td>{x.status === 'ok' ? <span className="tag">ok</span> : <span className="tag muted-tag">{x.status}</span>}</td>
              <td className="mono">{x.items_fetched}</td><td className="mono">{x.signals_counted}</td><td className="mono">{x.tavily_credits}</td>
              <td className="mono small nowrap">{x.gemini_input_tokens.toLocaleString('en-IN')} / {x.gemini_output_tokens.toLocaleString('en-IN')}</td>
              <td className="mono">{x.cost_inr.toFixed(2)}</td>
              <td className="small">{(x.errors || []).length ? <Clamp text={x.errors.join(' · ')} lines={1} className="muted" /> : <span className="muted">-</span>}</td>
            </tr>
          ))}</tbody>
        </table></div>
      </section>
    </div>
  );
}
