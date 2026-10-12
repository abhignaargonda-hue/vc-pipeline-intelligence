# VC Pipeline Intelligence

Vikram is a first-time founder raising a Seed round for a B2B logistics SaaS in India. He tracks 50 VCs and can't tell who is worth contacting right now.
Twice a week this system finds observable signals from the **last 30 days** for each VC. Gemini Flash labels each item, code scores it, and the result is written to his pipeline table in Neon Postgres. A public dashboard shows the ranking.

- **Live dashboard:** https://vc-pipeline-intelligence-cyan.vercel.app (runs: /runs, proof: /api/verify)
- **Components map:** [`docs/vc-pipeline-components-map-v4.png`](docs/vc-pipeline-components-map-v4.png)
- **Source of truth:** [`seed/`](seed). These files hold the company profile, the 50 real VCs, the source registry, the signal rubric v2 and the 17-case test set.

## How it works

| Step | Where | What |
|---|---|---|
| Trigger | `vercel.json`, `app/api/run` | Vercel cron `0 1 * * 1,4` (Mon + Thu 6:30am IST), checked with `CRON_SECRET`. The dashboard **Run now** button does the same and is limited to once per 30 min. |
| Read | `vcs` table | The 50 VCs seeded from `seed/vc-list.csv`. The pipeline never selects `contact_history` or `personal_notes`. |
| Collect | `lib/sources.js` | 9 Google Alert Atom feeds, Inc42 + YourStory RSS, 4 Substack feeds, and **one Tavily basic search per VC**. The search query is built from `guard_terms`, covers the last 7 days, and runs with `include_answer: false`. |
| Clean | `lib/pipeline.js` | Keeps the last 30 days only and drops undated items. Unwraps `google.com/url?url=` links, dedupes URLs, skips URLs already processed, and pre-matches each item to VCs by firm, aliases, guard terms and partner. |
| Label (AI) | `lib/gemini.js` | Gemini Flash, structured JSON, fields exactly as in rubric §1: vc_id, type, relevance, confirmed, event date, one-line summary. It also returns an event key used to dedupe syndicated stories. Context sent: `company-profile.md` + `signal-rubric.md` + VC names/aliases/partners. Never notes or history. |
| Score (code) | `lib/score.js` | Hard filters (§2), then points × relevance × recency (§3). VC score = best + 0.3 × others, +10 for `logistics_active`, capped at 100. Then the action band, status prefix, *Meet in person* and the N1/N2 flags (§4). |
| Write | `app_update_vc_signal()` | Writes only `last_signal_date, signal_summary, follow_up_score, recommended_action` (+ system `signal_sources, last_checked_at`). |
| Store | `signals`, `runs` | Every item is stored with its labels and its accept/reject reason. Every run is stored with items fetched, Tavily credits, Gemini tokens, cost in ₹, errors and *what changed*. |
| Output | `/`, `/runs` | Public dashboard and runs/cost page. No email. |

### Write protection in Postgres (`db/schema.sql`)
- `app_update_vc_signal()` is the **only** write path the app uses. It sets a transaction-local flag `app.writer = pipeline`.
- The `vcs_guard` trigger runs `BEFORE UPDATE`:
  - **Inside** the function, any change outside the 4+2 code columns raises an error. So status, contact history, notes and last contact date can never be overwritten.
  - **Outside** the function (Vikram in the Neon console), the code columns can't be edited by hand, but his own columns can.
- `/api/verify` gives the sha256 of `contact_history + personal_notes` (plus a hash over all manual columns). `/api/verify?run=1` hashes, runs the pipeline, hashes again and returns `unchanged: true/false`.

### Log a signal
On the dashboard, enter the VC, link, post date and one line. It is processed immediately:
- Gemini labels only the type.
- Relevance is treated as **core** (D8).
- The **30-day rule still applies**.
- The source is recorded as `logged by Vikram`.

### Cost
A run costs about 50 Tavily credits and about 150k Gemini Flash tokens. `/runs` shows the cost of each run in ₹ at list prices: $0.008/credit, $0.50 / $3.00 per 1M tokens, ₹88/$. You can change the rates with the `USD_INR`, `GEMINI_IN_USD_PER_M`, `GEMINI_OUT_USD_PER_M` and `TAVILY_USD_PER_CREDIT` env vars. At 2 runs/week, usage stays inside the free tiers.

## Setup

```bash
cp .env.example .env.local   # fill DATABASE_URL, GEMINI_API_KEY, GEMINI_MODEL, TAVILY_API_KEY, CRON_SECRET
npm install
npm run migrate              # creates tables, function, trigger in Neon
npm run seed                 # imports seed/vc-list.csv (50 VCs; Vikram's columns empty)
npm run run-once             # one full pipeline run from the CLI
npm run test-cases           # 17 test cases: expected vs actual (labels + bands)
npm run dev
```

Env vars needed on Vercel: `DATABASE_URL`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `TAVILY_API_KEY`, `CRON_SECRET`. Keys live only in `.env.local` (gitignored) and in Vercel.

## Test set result (`npm run test-cases`, as of 2026-10-12)
- Cases: **17/17** match expected (signal/no signal, type, relevance).
- Bands: **8/8** match rubric §6. IvyCap 64, 3one4 55, Info Edge 48, Avaana 42, Blume 35, Speciale 24 (+ Meet in person: TechSparks 2026), Lightspeed 21, WEH 19.
- Gemini is non-deterministic even at temperature 0. In one rerun, one relevance label shifted (core vs adjacent), which moved one band. The script prints the full table so any drift is visible.
- T17 (manual log > 30 days) uses a post date one day before the window start, because the test set has no real URL for it by design.

## Routes
| Route | |
|---|---|
| `/` | Ranked pipeline (Reach out / Warm / Low / No recent signal) with summary, source link and flags. Also shows what changed since the last run, Meet in person, Vikram's status and notes (read-only), and the Log-a-signal box. |
| `/runs` | Every run: items, Tavily credits, Gemini tokens, cost in ₹, changes, errors. |
| `POST /api/run` | Run now (rate-limited to once per 30 min). `GET` is for the cron only (`Authorization: Bearer CRON_SECRET`). |
| `POST /api/log` | Log a signal. |
| `GET /api/verify[?run=1]` | Hash proof that Vikram's columns are untouched. |

## Rules followed
Gemini only labels and code scores. No signal is counted without a fetched URL and a date within 30 days, and a URL Gemini returns that the pipeline didn't fetch is rejected. Tavily's AI answer is off. No invented VCs, notes or numbers. No dashboard password and no email.
