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
- seed/vc-list.csv          50 REAL VCs from Vikram's sheet "vc-list-50-logistics-seed" (v4 list). seed/vc-list-v1.csv = first list (test set). Vikram's columns are EMPTY by design
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

## v3 features (12 Oct 2026, after Vikram's review)
- Scoring v3 = fit x timing (seed/signal-rubric.md section 7). Deal stage/role, person and event city are Gemini labels; code scores.
- One number everywhere: dashboard shows the stored follow_up_score; every run (and status change / log) stores a snapshot in run_scores;
  "What changed" = latest snapshot vs previous.
- Duplicates grouped by VC + type + subject, dated by the earliest report; Signals feed shows one row per event with all reports.
- Vikram's status is editable on the dashboard but stored ONLY in the separate append-only vc_status table (app_set_status()).
  vcs.status / contact_history / personal_notes are still never written (trigger + /api/verify hash).
- Tavily lookback: 30 days until a run has covered the full 30-day window, then the gap since the last run (min 7). 1 basic search per VC.
- Scheduled cron skips if a full run succeeded in the last 6 hours.
- Scripts: test-rubric (v2 maths vs rubric section 6), trace (coverage trace of T01-T10), relabel (one-off v3 relabel of stored live signals).
- Never insert test-set items into live tables.

## v4 (current) - 12 Oct 2026
- VC list replaced by Vikram's sheet (seed/vc-list.csv, notes in seed/vc-list-notes.md). Old list kept as seed/vc-list-v1.csv.
- Scoring = Rubric v4 (seed/signal-rubric.md section 8): per signal 0.50 What + 0.30 Logistics + 0.15 Fresh + 0.05 Led;
  VC = best + 5 per extra (max +15), cap 100, poor_fit cap 24. Bands: Reach out >= 60, Warm 25-59, Low 1-24,
  Check out (0 + a qualifying 31-60 day item, never scored), No news found (unknown).
- Fetch window 60 days: Tavily with start_date/end_date (not `days`), still 1 basic search per VC; Tavily placeholder dates
  (<today-30> 17:00:00 GMT) are treated as undated.
- Dashboard: 5 KPI tiles / band-bar segments incl. Check out, "This week's 5", four-part score maths in the VC panel.

## UI v2 (12 Oct 2026) - UI_REVAMP_PROMPT_v2.md
Question the UI answers: "Who do I message today, why, and who can I ignore this week?" No data, scoring, band, pipeline,
cron, Gemini/Tavily or existing-API changes (before/after JSON compared identical).

**Palette tokens** (app/globals.css): navy-900 #0B1F3A (sidebar, headings), navy-700 #163A6B (hover/active), blue-600 #1F5FAD
(primary, Reach out), blue-400 #5B8FD6 (Warm), blue-200 #A9C6EC (Low), blue-100 #E3EFFB (soft fills, "system" columns),
blue-50 #F2F7FC (page bg), white #FFFFFF (cards), border #D6E4F2, ink #0F2740, muted #5B6F86, grey-300 #C5CFDB (No news / Skip),
alert #B4363A (ONLY the "Check for conflict" chip). Check out = white with dashed blue-600 outline. Up = blue-600, down = muted.
Inter for text, IBM Plex Mono (tabular) for scores, dates and rupees. 8px grid, 12px radius, one shadow, 1px borders.

**Pages** (navy sidebar, collapses to icons; bottom tab bar at <= 768px; keys: / search, g t|p|c|a|s|r):
1. Today: verdict (Heavy >= 5 Reach out, Light 1-4, Quiet 0), band number row (click opens that band's VCs), hit list
   (Reach out + top Warm, max 7; What happened / Proof / Where we stand / What to do + opener with Copy), "Quiet: skip this week".
2. Pipeline: one table mirroring `vcs`, two column groups: "Your columns (read-only)" and "Updated by the system (only these 4)";
   sortable, sticky header, band / conflict chips, search, compact toggle; drawer tabs Signals / Score / Partner & thesis / Warm path.
3. Changes: snapshot run selector (run_scores), old -> new score and band, reason + link.
4. Calendar: Monday-first grid; markers: run day dot, signal diamond, India event blue tag (abroad = outlined), note dot;
   right panel tabs Day / My notes (autosave, edit, delete with confirm, All notes list). "Visible to anyone with this link."
5. Signals: "+ Log a signal" side sheet (30-day check inline), feed grouped by week, details behind an "i" tooltip, collapsible Rejected.
6. Last run report: Next run, Run now (30-min limit with countdown), last run; VCs scanned / items / signals / cost / credits;
   "Your data untouched" (DB guard active + verify fingerprint); Data gaps (no item at all in 60 days); Runs & cost table.
   Run now / Next run appear ONLY here (+ one "Next run" line in the sidebar footer).

**Notes table**: `calendar_notes(id bigserial pk, note_date date not null, body text not null check (char_length(body) <= 2000),
created_at, updated_at)`; not linked to vcs. API: GET /api/notes?month=YYYY-MM, POST /api/notes, PATCH /api/notes/:id,
DELETE /api/notes/:id (validated).

**Opener templates** (app/page.js `opener()`, no AI call; filled only from stored fields; a missing field drops its clause;
{company} = first word of the event_key as spelled in the stored summary; {pitch} = "We're building a B2B logistics SaaS in India
and are raising our seed round" from seed/company-profile.md section 1):
- New investment (S1): "Hi {first}, saw {firm} backed {company} on {date}. {pitch}, and would value 20 minutes."
- New fund (S5): "Hi {first}, congratulations on {firm}'s new fund ({date}). {pitch}, and would value 20 minutes as you start deploying."
- Blog post (S2): "Hi {first}, read {firm}'s recent post ({date}): {summary}. {pitch}; would value your view."
- Interview (S3): "Hi {first}, came across your recent interview ({date}): {summary}. {pitch}; would value 20 minutes."
- Event (S4a/S4b): upcoming: "Hi {first}, saw you'll be at {event} in {city}. {pitch}; would love to say hello there."
  past: "Hi {first}, saw your session at {event} on {date}. {pitch}, and would value 20 minutes."
- Applications open (S6): "Hi {first}, saw {firm}'s applications are open on {date}. {pitch}; we'd like to apply and would value a quick chat."
- Follow-on (S7): "Hi {first}, saw {firm} doubled down on {company} on {date}. {pitch}, and would value 20 minutes."
No partner -> "Hi {firm} team,". The status editor in the VC drawer still writes only the separate vc_status log.
