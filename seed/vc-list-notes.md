# vc-list.csv: research notes (12 Oct 2026)

- 52 real Indian firms researched; 50 kept. Every value was taken from a page fetched on 12 Oct 2026. Unverifiable fields are left blank.
- 43 rows have a partner currently listed on the firm's own team page (partner_verified_on_firm_site = yes).
- 7 rows are firm-level only (partner blank) because the firm site blocks automated reading or has no team page:
  Leo Capital, WEH Ventures, Better Capital, Venture Highway, Omnivore, Equentis Angel Fund, Riverwalk Holdings.
  They are kept because each has real logistics deal evidence; signals are matched on the firm name.
- Dropped: Huddle Ventures and Java Capital (team not verifiable and no logistics evidence).
- Groups follow the evidence found, not a target split:
  logistics_active 33 (a real logistics or supply-chain deal found), b2b_generalist 8 (fits B2B/early stage, no logistics deal found),
  poor_fit 9 (consumer-only, gaming, or venture debt). Poor-fit rows are controls: they should score low or quiet.
- Vikram's columns (last_contact_date, status, contact_history, personal_notes) are empty by design (D6).
- Known checks before use: Accel partner title comes from a 2019 Inc42 article; Stellaris shows "Investor" not Partner;
  Venture Catalysts founder spelled Rajan/Ranjan across sources; Equentis OORJAA article URL to be captured from alert feed.
- Live test cases already inside the 30-day window: Avaana Capital led Drivn seed (22 Sep 2026); Vishesh Rajaram
  (Speciale Invest) announced as TechSparks 2026 speaker (7 Oct 2026, event 13-15 Oct).
