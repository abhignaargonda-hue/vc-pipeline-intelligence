import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function Runs() {
  const sql = db();
  const runs = await sql`select * from runs order by id desc limit 100`;
  const [tot] = await sql`select coalesce(sum(cost_inr),0) as inr, coalesce(sum(tavily_credits),0)::int as credits,
    coalesce(sum(gemini_input_tokens + gemini_output_tokens),0)::bigint as tokens, count(*)::int as n from runs`;
  const t = d => (d ? new Date(d).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' }) : '-');
  return (
    <>
      <h1>Runs and cost</h1>
      <p className="small muted">
        {tot.n} runs · total ₹{Number(tot.inr).toFixed(2)} · {tot.credits} Tavily credits · {Number(tot.tokens).toLocaleString('en-IN')} Gemini tokens.
        Cost = Tavily credits × $0.008 + Gemini Flash tokens at $0.50 / $3.00 per 1M (in / out), at ₹88/$ (list prices; the free tiers make the actual bill ₹0 at this volume).
      </p>
      <div className="wrap"><table>
        <thead><tr><th>#</th><th>Trigger</th><th>Started (IST)</th><th>Status</th><th>Fetched</th><th>New</th><th>Labelled</th><th>Counted</th><th>Tavily</th><th>Gemini in / out</th><th>Cost ₹</th><th>Changed</th><th>Errors</th></tr></thead>
        <tbody>{runs.map(r => (
          <tr key={r.id}>
            <td>{r.id}</td><td>{r.trigger}</td><td>{t(r.started_at)}</td><td>{r.status}</td>
            <td>{r.items_fetched}</td><td>{r.items_new}</td><td>{r.items_labelled}</td><td>{r.signals_counted}</td>
            <td>{r.tavily_credits}</td><td>{r.gemini_input_tokens.toLocaleString('en-IN')} / {r.gemini_output_tokens.toLocaleString('en-IN')}</td>
            <td><b>{Number(r.cost_inr).toFixed(2)}</b></td>
            <td className="small">{(r.changes || []).length ? (
              <details><summary>{r.changes.length} VCs</summary>{r.changes.map(c => <div key={c.vc_id}>{c.firm}: {c.from_score} → {c.to_score}</div>)}</details>
            ) : '0'}</td>
            <td className="small">{(r.errors || []).length ? <details><summary>{r.errors.length}</summary>{r.errors.map((e, i) => <div key={i}>{e}</div>)}</details> : '0'}</td>
          </tr>
        ))}</tbody>
      </table></div>
      <h2>Sources in the latest run</h2>
      <div className="small">{runs[0] && Object.entries(runs[0].source_counts || {}).map(([k, v]) => <div key={k}>{k}: {v}</div>)}</div>
    </>
  );
}
