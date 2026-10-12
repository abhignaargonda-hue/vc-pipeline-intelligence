# Source registry

Every live source the pipeline reads, what signal types it yields, and its known noise. Status as of 12 Oct 2026.
Status key: **tested** = opened and returned real items; **untested** = test in Stage 8 from the deployed app.

## A. Google Alerts theme feeds (Atom, D4)

All 9 queries checked against the Google Alerts list on 12 Oct 2026. #2, #3 and #9 were first saved wrongly (missing quotes, lowercase 'or', pasted instruction text) and corrected. Link-to-query mapping confirmed from each feed's <title> for #1-#7 and #9 (#8 not yet opened). Feeds created on 12 Oct are mostly empty: an alert only collects items published after it was made. Links are Google redirects: code must extract the real `url=` parameter.

| # | Query | Signals | Feed URL | Status | Known noise |
|---|---|---|---|---|---|
| 1 | `logistics startup raises funding India` | S1 (broad) | https://www.google.com/alerts/feeds/06384577686394607711/16324225994986073229 | tested (in browser) | Very noisy: 0 of first 3 entries relevant (Zetwerk IPO, Inner Sky Labs, cleantech roundup) |
| 2 | `"logistics" "led by" funding India` | S1 | https://www.google.com/alerts/feeds/06384577686394607711/5845460547091410117 | confirmed, empty so far | No items yet (new alert) |
| 3 | `"supply chain" OR "freight" OR "warehousing" startup "led by"` | S1 | https://www.google.com/alerts/feeds/06384577686394607711/18011395675215417816 | confirmed, empty so far | No items yet (new alert) |
| 4 | `logistics OR "supply chain" summit speakers investors India` | S4a / S4b | https://www.google.com/alerts/feeds/06384577686394607711/5970751545951463051 | confirmed, 3 items | All 3 off-target: Abu Dhabi SIF 2026, Asia hyperscale panel, ET Infra weekly logistics wrap |
| 5 | `"B2B SaaS" summit India speakers "venture"` | S4b | https://www.google.com/alerts/feeds/06384577686394607711/5217872920218687222 | confirmed, empty so far | No items yet |
| 6 | `"new fund" OR "fund close" "venture capital" India crore -"mutual fund" -NFO` | S5 | https://www.google.com/alerts/feeds/06384577686394607711/12967125829986015310 | confirmed, 1 item | Was matching mutual-fund 'New Fund Offers'; query tightened 12 Oct 2026 |
| 7 | `"applications open" accelerator OR cohort seed India startups` | S6 | https://www.google.com/alerts/feeds/06384577686394607711/14087817873688796835 | confirmed, empty so far | No items yet |
| 8 | `logistics startup acquired OR acquisition India` | S7 | https://www.google.com/alerts/feeds/06384577686394607711/11212238048955778917 | untested | Feed not yet opened |
| 9 | `site:linkedin.com/pulse logistics "venture capital" India` | S2 / S3 (LinkedIn, partial) | https://www.google.com/alerts/feeds/06384577686394607711/1773295689312293942 | confirmed, empty so far | Expected to stay quiet |

## B. Startup media RSS

| Source | Feed URL | Signals | Status | Known noise |
|---|---|---|---|---|
| Inc42 | https://inc42.com/feed/ | S1, S5, S7 | tested: live, but only 4 items and malformed XML | Use a lenient parser; most items are not logistics |
| YourStory | https://yourstory.com/feed | S1, S4b (TechSparks speaker posts), S5 | tested: live, ~7 items visible, truncated | Lots of consumer and festive-sale news |
| Entrackr | https://entrackr.com/feed | S1 | untested: fetch failed from research tool | Covered anyway via alerts #1-#3 (Entrackr stories already appear) |

## C. Tavily per-VC search (D12)

- One basic search per VC per run (1 credit); 50 VCs x 2 runs/week = ~430 credits/month of 1,000 free.
- Query built from vc-list.csv: the `guard_terms` column (firm name in quotes plus exclusions), optionally plus partner name.
- Window: last ~7 days per run; the 30-day window is computed from the stored signals table.
- AI answer feature OFF (exam rule: Gemini only). Only result title, URL, snippet and date are used.
- Status: untested. Stage 8 checks the news filter, publish dates and coverage of Indian outlets. Fallback: per-VC Google Alerts for VCs Tavily misses.

## D. Firm feeds (from vc-list.csv)

Only Substack `/feed` URLs are real RSS. Other entries are web pages (blog, insights, podcast) with no confirmed feed; they are covered by Tavily, not polled directly.

| VC | Firm | Feed or page | Type | Status |
|---|---|---|---|---|
| VC01 | Blume Ventures | https://blume.vc/newsletters | page only | n/a |
| VC01 | Blume Ventures | https://blumefieldnotes.substack.com/feed | RSS (Substack) | tested: live |
| VC02 | Stellaris Venture Partners | https://stellarisvp.com/insights | page only | n/a |
| VC04 | Accel (India) | https://www.youtube.com/@AccelVC | page only | n/a |
| VC05 | Elevation Capital | https://www.elevationcapital.com/perspectives | page only | n/a |
| VC07 | Peak XV Partners | https://www.peakxv.com/insights | page only | n/a |
| VC08 | Nexus Venture Partners | https://www.youtube.com/@nexusventurepartners | page only | n/a |
| VC10 | Prime Venture Partners | https://www.primevp.in/content | page only | n/a |
| VC11 | 3one4 Capital | https://www.3one4capital.com/blog | page only | n/a |
| VC11 | 3one4 Capital | https://www.3one4capital.com/podcast | page only | n/a |
| VC12 | Kalaari Capital | https://behindthescenesbykalaaricapital.buzzsprout.com | RSS (podcast host) | n/a |
| VC14 | Inflection Point Ventures | https://ipventures.in/blog/ | page only | n/a |
| VC15 | Ankur Capital | https://medium.com/ankur-capital | page only | n/a |
| VC16 | Antler India | https://www.antler.co/blog | page only | n/a |
| VC18 | Kae Capital | https://kae-capital.com/blogs/ | page only | n/a |
| VC19 | pi Ventures | https://www.piventures.in/insights | page only | n/a |
| VC20 | Arkam Ventures | https://arkamvc.com/blog-articles | page only | n/a |
| VC22 | BEENEXT | https://www.beenext.com/blog/ | page only | n/a |
| VC23 | Venture Catalysts | https://www.venturecatalysts.in/news-research | page only | n/a |
| VC24 | Titan Capital | https://titancapital.vc/blogs | page only | n/a |
| VC25 | All In Capital | https://allindiacapital.substack.com/feed | RSS (Substack) | derived from Substack pattern, untested |
| VC26 | Arali Ventures | https://www.araliventures.in/blog | page only | n/a |
| VC29 | Better Capital | https://medium.com/better-capital/ | page only | n/a |
| VC31 | Omnivore | https://omnivorevc.substack.com/feed | RSS (Substack) | derived from Substack pattern, untested |
| VC32 | Equentis Angel Fund | https://www.equentis.com/blog | page only | n/a |
| VC34 | Endiya Partners | https://www.endiya.com/blogs | page only | n/a |
| VC36 | Together Fund | https://www.together.fund/perspectives | page only | n/a |
| VC37 | Eximius Ventures | https://eximiusecho.substack.com/feed | RSS (Substack) | derived from Substack pattern, untested |
| VC38 | Unicorn India Ventures | https://medium.com/unicornindia | page only | n/a |
| VC39 | Gemba Capital | https://gembacapital.in/insights.php | page only | n/a |
| VC40 | Saama Capital | https://saama.vc/news/ | page only | n/a |
| VC42 | Fireside Ventures | https://firesideventures.com/blogs/ignite | page only | n/a |
| VC43 | DSG Consumer Partners | https://www.dsgcp.com/perspectives | page only | n/a |
| VC44 | Rukam Capital | https://rukamcapital.com/blogs/ | page only | n/a |
| VC45 | Lumikai | https://www.lumikai.com/blog | page only | n/a |

## E. Manual: Log-a-signal box (D5)

- Vikram pastes a LinkedIn (or any) link, the post date and one line. Processed immediately (D8).
- Skips Gemini's relevance check; still must be within 30 days; marked `source: logged by Vikram`.

## Not used, and why

- LinkedIn / X APIs: no usable free access. The Ken and other paywalled newsletters: no API. Crunchbase, Tracxn, PitchBook, Dealroom: enterprise pricing. SEC Form D: US only.
- Google News RSS search: blocked for our research tool; Google Alerts covers the same index. Re-check in Stage 8 only if needed.
- Per-VC Google Alerts: replaced by Tavily (same job); fallback only.
