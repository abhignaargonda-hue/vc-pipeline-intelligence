'use client';
import { useState } from 'react';

export default function RunNow() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  async function go() {
    setBusy(true); setMsg('Running: fetching feeds + 50 Tavily searches, labelling with Gemini (about 1 min)...');
    try {
      const r = await fetch('/api/run', { method: 'POST' });
      const j = await r.json();
      if (!r.ok) setMsg(j.error || 'Failed');
      else { setMsg(`Done: ${j.fetched} items fetched, ${j.new} new, ${j.counted} signals counted, ${j.changes} VCs changed.`); setTimeout(() => location.reload(), 1200); }
    } catch (e) { setMsg(e.message); }
    setBusy(false);
  }
  return (
    <div className="row">
      <button onClick={go} disabled={busy}>{busy ? 'Running...' : 'Run now'}</button>
      <span className="small muted">{msg || 'Limited to once per 30 minutes. Scheduled: Mon + Thu 6:30am IST.'}</span>
    </div>
  );
}
