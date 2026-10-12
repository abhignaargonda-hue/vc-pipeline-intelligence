# VC Pipeline Intelligence (Vikram) — project rules for Claude Code

## What this is
MESA Section 1 Final Exam, problem statement "VC Fundraising Pipeline Intelligence".
Vikram, first-time founder raising Seed for a B2B logistics SaaS (India), tracks 50 VCs. Twice a week the system finds
observable signals from the last 30 days per VC, scores them, and updates his pipeline table in Neon Postgres.
Note: the statement says "Supabase table"; we use Neon (also Postgres). Same table, same rules.

## Exam rules (non-negotiable)
- Live external data wherever possible; real data must be present at submission.
- All AI tasks use Gemini Flash (GEMINI_MODEL). No Claude API inside the app.
- Deploy on Vercel. Submit public URL + GitHub repo + Components Map.

## Seed files (read these first, they are the source of truth)
- seed/company-profile.md   facts about Vikram's company, relevance terms, 10 category peers (N1 check)
- seed/vc-list.csv          50 REAL VCs. Vikram's columns (last_contact_date, status, contact_history, personal_notes) are EMPTY by design
- seed/source-registry.md   every live source: 9 Google Alert Atom feeds, Inc42/YourStory RSS, Substack feeds, Tavily per-VC search, manual box
- seed/signal-rubric.md     v2 rubric: what Gemini labels, hard filters, points, multipliers, bands, wording, "never" rules
- seed/signal-test-set.json 17 real cases (10 signals, 7 rejections) with expected bands
- vc-pipeline-components-map-v4.png  locked components map (v4: Neon, public dashboard, no email)

## Hard rules
1. Code writes ONLY 4 columns on the VC table: last_signal_date, signal_summary, follow_up_score, recommended_action
   (plus system columns signal_sources, last_checked_at). Enforce in the database too (function + trigger).
2. Never change status, contact_history, personal_notes. Never send them to Gemini or Tavily.
3. Gemini only LABELS fetched items (vc, type, relevance, confirmed, event_date, summary). Code scores.
4. Reject any signal without a fetched URL and a published date within 30 days. Reject URLs Gemini invents.
5. Tavily: basic search, 1 per VC per run, last ~7 days, include_answer OFF.
6. Google Alert links are google.com/url redirects: extract the real `url=` parameter.
7. Nothing invented: no fake VCs, notes, quotes or numbers.
8. Keys only in .env.local (gitignored) and Vercel env vars.
9. Database is Neon Postgres via DATABASE_URL (@neondatabase/serverless). No Supabase.
11. No emails and no Resend. The dashboard (and the Neon table) are the only outputs.
10. No dashboard password. The dashboard is public. /api/run accepts Vercel's cron call (CRON_SECRET header) and the dashboard's Run-now button, which is rate-limited to once per 30 minutes.

## Schedule
Vercel cron Mon + Thu 6:30am IST = "0 1 * * 1,4" (UTC).
