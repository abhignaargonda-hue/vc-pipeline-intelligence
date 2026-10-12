# vc-list.csv: notes (current list, 12 Oct 2026)

- Source: Vikram's sheet "vc-list-50-logistics-seed" (Google Sheets), tab "50 VCs". 50 firms, each with a real, sourced
  logistics / supply-chain deal AND evidence that it writes seed / pre-Series A cheques. Researched 12 Oct 2026 from live pages
  (Inc42, YourStory, Entrackr, firm sites). Blank = could not be verified; nothing was guessed.
- Columns kept as in the sheet: #, Firm, Type, Website, Logistics deal, Deal source, Second logistics deal, Second source,
  Seed evidence (quote), Seed source, Partner, Title, Team page, Aliases, Watch-outs, Confidence.
- Mapping into Neon `vcs`: vc_id = VC + "#" (VC01-VC50); vc_group = logistics_active for all 50 (the sheet's selection rule);
  partner_verified_on_firm_site = yes when a partner is named (sheet summary: 37 verified); guard_terms (Tavily query):
  reused from the first list for the 28 overlapping firms, otherwise derived from firm name + aliases + the Watch-outs exclusions.
- Vikram's columns (last_contact_date, status, contact_history, personal_notes) are not in the sheet: empty by design.
- 15+ firms overlap the first list; the first list is kept as `vc-list-v1.csv` (the 17-case test set was written against it).
- The sheet's "Not included" tab explains left-out firms (e.g. Avaana, Antler, Speciale, WEH, Gemba: no logistics deal found).
- Earlier notes on the first list are in git history (seed/vc-list-notes.md before 12 Oct 2026 v4).
