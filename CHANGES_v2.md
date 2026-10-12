# Changes v2 (12 Oct 2026)

## Coverage: what was broken and how it was fixed
| Problem | Cause | Fix |
|---|---|---|
| "Reach out this week (0)" although the test set has in-window signals | Tavily searched only the last 7 days and the system started on 12 Oct, so 12 Sep - 5 Oct was never searched (trace: `npm run trace`) | Lookback is 30 days until a run has covered the whole 30-day window, then the gap since the last run (min 7). Still 1 basic search per VC; max_results 5 -> 20 at the same credit cost |
| Dates off by one near midnight | Published dates converted in UTC | Converted to the IST calendar date |
| One deal counted up to 11 times (Gravity, Zetwerk, Myca) | Gemini gave different event keys per outlet; later re-reports looked fresher | Group by VC + type + subject; all S5 per VC = one event; date = earliest report |
| Scores differed across screens (changelog 78 vs card 51) | Changelog stored at run time, code changed later; deployed code older than DB | One stored score everywhere; per-run snapshots (run_scores); "What changed" = snapshot diff |
| Test-set articles had been imported into live tables | Build-time shortcut that broke the live-data rule | Deleted (15 rows, 2 runs); import script removed |
| Still not found live | T05/T06/T07 are firm blog posts: not in Tavily's news index; Tavily general search returns them without a date, so the 30-day rule rejects them. T08 event dates are not in any fetched text | Not faked. Vikram can log them with Log a signal |

`npm run test-rubric` (scripts/test-rubric.ts) feeds T01-T17 straight into the scorer: v2 maths matches signal-rubric.md section 6 exactly (8/8 bands, T11-T17 rejected).

## New features
- Scoring v3 = fit x timing (signal-rubric.md section 7): deal stage and lead role, new early-stage fund = strong timing, IPO/exit = context only, poor_fit capped at Low, partner attribution.
- Editable status (Not contacted / Reached out - waiting / In conversation / Second meeting / Passed / Not now) in the VC panel, stored in a separate `vc_status` log. Passed / Not now leave the reach-out and warm lists.
- "Your partner / someone else at the firm / firm-level" tag on every signal.
- "No news found (unknown)" replaces "Quiet"; unknown VCs sorted by fit, with an explanation of source limits.
- Honest empty state: if no VC crosses 50, the top 3 warm leads are shown with "No VC crossed 50 this run."
- Signals feed grouped by event, every report kept (shows when outlets report different numbers), collapsible Rejected list with reasons.
- VC panel: score maths (timing x fit + bonus, cap), partner, thesis with source, logistics deal on record with source, status editor + history.
- Runs page explains id gaps and every trigger type; scheduled run skipped if a full run succeeded in the last 6 hours.
- Event city / country labels (shown in Meet in person and Calendar).

## Components map
No new outputs. One new store (`vc_status`, written only by Vikram from the dashboard) and one internal table (`run_scores` snapshots). The map's Neon box should list them; the "Notes + status: his only" rule is unchanged (vcs columns untouched).
