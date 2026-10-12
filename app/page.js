import { db } from '@/lib/db';
import { scoreVc } from '@/lib/score';
import { todayIST } from '@/lib/pipeline';
import RunNow from './RunNow';
import LogSignal from './LogSignal';

export const dynamic = 'force-dynamic';

const BANDS = [
  { key: 'hot', title: 'Reach out this week', test: s => s >= 50 },
  { key: 'warm', title: 'Warm: mention the signal if you contact them', test: s => s >= 25 && s < 50 },
  { key: 'low', title: 'Low priority', test: s => s >= 1 && s < 25 },
  { key: 'none', title: 'No recent signal in tracked sources (deprioritise this week)', test: s => s < 1 },
];

const fmt = d => (d ? new Date(String(d).slice(0, 10) + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '');
const host = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return u; } };

export default async function Page() {
  const sql = db();
  const today = todayIST();
  const [vcs, sigs, runs] = await Promise.all([
    sql`select vc_id, firm, vc_group, partner_name, partner_title, website, status, last_contact_date::text as last_contact_date,
          contact_history, personal_notes, last_signal_date::text as last_signal_date, signal_summary, follow_up_score,
          recommended_action, last_checked_at from vcs order by follow_up_score desc, firm`,
    sql`select vc_id, url, title, source, published_at::text as published_at, type, relevance, confirmed, category_peer,
          event_name, event_start::text as event_start, event_end::text as event_end, event_key, summary, manual
        from signals where accepted and vc_id is not null and published_at >= (${today}::date - 30)`,
    sql`select id, trigger, started_at, finished_at, status, items_fetched, signals_counted, cost_inr, changes
        from runs where trigger <> 'log' and status <> 'running' order by id desc limit 1`,
  ]);
  const last = runs[0];
  const detail = Object.fromEntries(vcs.map(v => [v.vc_id, scoreVc(v, sigs.filter(s => s.vc_id === v.vc_id), today)]));
  const meet = vcs.flatMap(v => detail[v.vc_id].meet.map(m => ({ ...m, firm: v.firm })));
  const changes = last?.changes || [];

  return (
    <>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div>
          <h1>Who is worth reaching out to right now</h1>
          <div className="small muted">
            50 tracked VCs · signals from the last 30 days · today {fmt(today)} (IST)
            {last && <> · last run #{last.id} ({last.trigger}) {new Date(last.finished_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}, {last.items_fetched} items, ₹{Number(last.cost_inr).toFixed(2)}</>}
          </div>
        </div>
        <RunNow />
      </div>

      <h2>What changed since last run</h2>
      {changes.length === 0 ? <p className="muted">No score or action changed in the last run.</p> : (
        <div className="wrap"><table>
          <thead><tr><th>VC</th><th>Score</th><th>Now</th><th className="hide-sm">Why</th></tr></thead>
          <tbody>{changes.map(c => (
            <tr key={c.vc_id}><td>{c.firm}</td><td className="score">{c.from_score} → {c.to_score}</td>
              <td>{c.to_action}</td><td className="hide-sm small">{c.url ? <a href={c.url} target="_blank">{c.summary}</a> : c.summary}</td></tr>
          ))}</tbody>
        </table></div>
      )}

      <h2>Meet in person</h2>
      {meet.length === 0 ? <p className="muted">No upcoming events found for tracked VCs.</p> : (
        <ul>{meet.map((m, i) => (
          <li key={i}><b>{m.firm}</b>: {m.event_name || 'event'}, {fmt(m.event_start)}{m.event_end && m.event_end !== m.event_start ? ` - ${fmt(m.event_end)}` : ''} · <a href={m.url} target="_blank">{m.summary}</a></li>
        ))}</ul>
      )}

      <h2>Log a signal</h2>
      <LogSignal vcs={[...vcs].sort((a, b) => a.firm.localeCompare(b.firm))} today={today} />

      {BANDS.map(b => {
        const list = vcs.filter(v => b.test(v.follow_up_score));
        return (
          <section key={b.key}>
            <h2 className={`b-${b.key}`}>{b.title} ({list.length})</h2>
            {list.length === 0 ? <p className="muted">None this run.</p> : (
              <div className="wrap"><table>
                <thead><tr><th>VC</th><th>Score</th><th>Recommended action and signals</th><th className="hide-sm">Vikram's status and notes (read-only)</th></tr></thead>
                <tbody>{list.map(v => {
                  const d = detail[v.vc_id];
                  return (
                    <tr key={v.vc_id}>
                      <td style={{ minWidth: 160 }}><b>{v.firm}</b><div className="small muted">{v.partner_name || 'firm-level'}{v.vc_group ? ` · ${v.vc_group}` : ''}</div></td>
                      <td className={`score b-${b.key}`}>{v.follow_up_score}</td>
                      <td>
                        <div>{v.recommended_action || 'Not scored yet'}</div>
                        {d.flags.map(f => <span key={f} className="tag flag">{f}</span>)}
                        {d.items.slice(0, 3).map((s, i) => (
                          <div key={i} className="small">
                            <span className="tag">{s.type}</span><span className="tag">{s.manual ? 'core (logged)' : s.relevance}</span>
                            <a href={s.url} target="_blank">{s.summary}</a> <span className="muted">· {s.manual ? 'logged by Vikram' : host(s.url)} · {fmt(s.published_at)} · +{s.points.toFixed(1)}</span>
                          </div>
                        ))}
                        {d.items.length > 3 && <details><summary>{d.items.length - 3} more</summary>{d.items.slice(3).map((s, i) => (
                          <div key={i} className="small"><span className="tag">{s.type}</span><a href={s.url} target="_blank">{s.summary}</a> <span className="muted">· {fmt(s.published_at)}</span></div>
                        ))}</details>}
                      </td>
                      <td className="hide-sm small" style={{ minWidth: 180 }}>
                        <div><b>Status:</b> {v.status || <span className="muted">-</span>}</div>
                        <div><b>Last contact:</b> {v.last_contact_date ? fmt(v.last_contact_date) : <span className="muted">-</span>}</div>
                        <div><b>Notes:</b> {v.personal_notes || <span className="muted">-</span>}</div>
                        {v.contact_history && <div><b>History:</b> {v.contact_history}</div>}
                      </td>
                    </tr>
                  );
                })}</tbody>
              </table></div>
            )}
          </section>
        );
      })}
      <p className="small muted">Scores follow seed/signal-rubric.md v2. Gemini only labels items; code scores them and writes only last_signal_date, signal_summary, follow_up_score and recommended_action (enforced in Postgres). Vikram's status, contact history and notes are never written or sent to Gemini or Tavily.</p>
    </>
  );
}
