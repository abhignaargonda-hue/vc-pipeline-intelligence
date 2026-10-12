import { neon } from '@neondatabase/serverless';
const sql = neon(process.env.DATABASE_URL);
const vcs = await sql`select vc_id, follow_up_score, recommended_action, last_signal_date::text lsd, signal_summary, last_checked_at::text checked from vcs order by vc_id`;
const sigs = await sql`select vc_id, url, source, published_at::text p, type, relevance, deal_stage, deal_role, event_name, event_city, left(summary,140) s from signals where accepted and vc_id is not null and published_at >= '2026-09-12' order by vc_id, published_at desc`;
const run = await sql`select id, trigger, finished_at::text f, items_fetched, signals_counted, cost_inr from runs where status='ok' order by id desc limit 1`;
console.log(JSON.stringify({run, vcs, sigs}));
