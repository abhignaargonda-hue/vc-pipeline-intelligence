# Signal rubric (Stage 6) - used by code to score, and by Gemini as context to label

Source of the rules: Vikram's own words in the problem statement. Anything beyond them is marked [design choice].

## 1. What Gemini labels per item (it never scores)
- vc_id: which tracked VC the item is about (null if none). Must be THAT firm/partner, not a same-name company.
- type: S1 invested | S2 wrote | S3 podcast/interview | S4a spoke at logistics/B2B SaaS event | S4b general startup event |
  S5 new fund | S6 applications/cohort open | S7 logistics portfolio follow-on/exit | N1 backed a category peer | N2 partner left / fund paused | none
- relevance: core (logistics / supply chain software or operations for businesses) | adjacent (fleet EV, B2B commerce, manufacturing tech) | general | not_relevant
- confirmed: true only if the event happened (not "in talks")
- event_date: for S4, the event date if stated (to detect "upcoming")
- summary: one line, factual, from the item text only

## 2. Hard filters in code (before scoring)
1. published date must be within the last 30 days ("not a hunch... from the past thirty days"). No date -> rejected.
2. URL must be one the pipeline actually fetched. A URL Gemini invents is rejected.
3. vc_id must be one of the 50; otherwise the item is stored but scores nothing.
4. Tier 1 types need relevance core or adjacent. not_relevant -> 0.
5. confirmed=false -> 0.
6. Manual signals (logged by Vikram): relevance treated as core (D8); filter 1 still applies.

## 3. Points (v2, recalibrated on the real test set) [design choice; order follows the statement's examples]
| Type | Base |
|---|---|
| S1 invested | 60 |
| S2 wrote, S3 said, S4a spoke at a topic event | 35 |
| S4b, S5, S6, S7 | 15 |
| N1 | 0 points, adds flag "Check for conflict" |
| N2 | 0 points, adds flag "Partner change: check who to contact" |

Relevance multiplier: core 1.0, adjacent 0.7, general 0.5 (general allowed for Tier 2 only; Tier 1 general = 0).
Recency multiplier ("last week" matters most): 0-7 days 1.0, 8-14 days 0.9, 15-30 days 0.7.
VC score = best item + 0.3 x each other item, +10 if the VC has a real logistics deal on record (group logistics_active), capped at 100.
The +10 only applies on top of at least one live signal; no signal = 0.

Why v2: with v1 weights (S1 50; recency 0.8/0.6) no real case in the window could reach "Reach out this week", so the top band would never appear.
Only the weights changed; which items count as signals did not.

## 4. Action (recommended_action)
| Score | Action |
|---|---|
| 50-100 | Reach out this week |
| 25-49 | Warm: mention the signal if you contact them |
| 1-24 | Low priority |
| 0 | No recent signal in tracked sources - deprioritise this week (never "inactive") |
Prefix by status: waiting -> "Follow up - new hook: <summary>"; yet to reach out -> "First outreach - hook: <summary>".
If an S4 event date is in the future: append "Meet in person: <event>, <date>".
Flags (N1, N2) are always shown next to the action.

## 5. Never
- Never write any column except last_signal_date, signal_summary, follow_up_score, recommended_action.
- Never change status, contact history or notes.
- Never send Vikram's notes or history to Gemini or Tavily.
- Never create a signal without a fetched URL and a date.
- Never use Tavily's AI answer (exam: Gemini only).

## 6. Expected results on the test set (v2, computed before build)
| VC | Items | Score | Band |
|---|---|---|---|
| IvyCap | T01 S1 core, 12 d: 60x1x0.9=54, +10 | 64 | Reach out this week |
| 3one4 Capital | T03 S1 adj 12 d = 37.8; T05 S2 core 26 d = 24.5 x 0.3 = 7.4; +10 | 55 | Reach out this week |
| Info Edge Ventures | T04 S1 adj 12 d = 37.8; +10 | 48 | Warm |
| Avaana Capital | T02 S1 core 20 d = 42 (no +10: b2b_generalist) | 42 | Warm |
| Blume Ventures | T06 S2 adj 5 d = 24.5; +10 | 35 | Warm |
| Speciale Invest | T07 S2 adj 11 d = 22.1; T08 S4b 5 d = 7.5 x 0.3 = 2.3 | 24 | Low + Meet in person: TechSparks 13-15 Oct |
| Lightspeed India | T09 S7 adj 0 d = 10.5; +10 | 21 | Low |
| WEH Ventures | T10 S5 adj 13 d = 9.5; +10 | 19 | Low |
| Equentis, IPV, Peak XV, Fireside, others | T11-T17 rejected | 0 | No recent signal |
