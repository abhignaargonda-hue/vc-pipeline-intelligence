'use client';
import { useState } from 'react';

export default function LogSignal({ vcs, today }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  async function submit(e) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    setBusy(true); setMsg(null);
    try {
      const r = await fetch('/api/log', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(f) });
      const j = await r.json();
      setMsg({ ok: j.ok, text: j.message });
      if (j.ok) { e.target.reset(); setTimeout(() => location.reload(), 1500); }
    } catch (err) { setMsg({ ok: false, text: err.message }); }
    setBusy(false);
  }
  return (
    <div className="box">
      <form className="log" onSubmit={submit}>
        <select name="vc_id" required defaultValue="">
          <option value="" disabled>VC...</option>
          {vcs.map(v => <option key={v.vc_id} value={v.vc_id}>{v.firm}</option>)}
        </select>
        <input name="url" type="url" placeholder="Link (e.g. LinkedIn post)" required />
        <input name="post_date" type="date" max={today} required />
        <input name="line" placeholder="One line: what happened" required />
        <button disabled={busy}>{busy ? 'Processing...' : 'Log signal'}</button>
      </form>
      <div className="small" style={{ marginTop: 6, color: msg ? (msg.ok ? 'var(--ok)' : 'var(--hot)') : 'var(--muted)' }}>
        {msg ? msg.text : 'Processed immediately: Gemini labels the type, relevance is treated as core, and the 30-day rule still applies.'}
      </div>
    </div>
  );
}
