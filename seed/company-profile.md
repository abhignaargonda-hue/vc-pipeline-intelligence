# Company profile: Vikram's startup

Context file for Gemini's relevance check and the N1 "check for conflict" flag.
Rule (D6): nothing invented. Only what the problem statement says, plus real, sourced category data.

## 1. What the problem statement says (verbatim facts)

| Fact | Statement wording |
|---|---|
| Founder | "Vikram is a first-time founder" |
| Round | "raising a Seed round" |
| Product category | "for his B2B logistics SaaS" |
| Time in market | "He has been at it for two months" |
| Pipeline | "a list of fifty VCs he's tracking" |
| Relevant signal examples | "a blog post about supply chain tech, made a new portfolio investment in a logistics company, or spoke at an industry event" |
| Location | Not stated. Decision D1: India-based, raising from Indian seed funds |

## 2. What is NOT known (and is deliberately left blank)

- Company name, product, sub-segment, customers, traction, raise amount, team.
- Therefore: no specific competitors. N1 is a "check for conflict" flag, not an automatic conflict (D11).

## 3. Relevance definition for Gemini

An item is RELEVANT when it shows the investor engaging with technology or software for moving, storing or managing goods for businesses.

Core terms (category definition, our design choice, not facts about Vikram):
logistics, supply chain, freight, trucking, fleet, transport management (TMS), warehousing, warehouse management (WMS),
3PL, last-mile, mid-mile, shipment visibility, route optimisation, freight procurement, cargo, cross-border shipping.

Adjacent (lower relevance): B2B SaaS generally, manufacturing tech, B2B commerce and distribution, procurement software.

Not relevant on their own: consumer delivery apps, quick commerce consumer news, EV vehicle makers, IPOs and stock news,
cleantech, fintech, AI that is not applied to logistics.

## 4. Category peers (real Indian B2B logistics software companies)

If a tracked VC is reported investing in one of these, or in any company Gemini identifies as B2B logistics software,
the signal is S1 AND carries the flag "Check for conflict". Vikram decides whether it is a conflict or a warm sign.

| Company | What it does | Source |
|---|---|---|
| FarEye | Delivery management platform | [Inc42 top funded logistics 2026](https://inc42.com/lists/top-20-funded-logistics-startups-in-india-2026), [Fretron TMS 2026](https://www.fretron.com/blog/best-tms-software-india-2026/) |
| Locus | Route optimisation and last-mile platform (acquired by Ingka Group, Oct 2025, per Fretron) | [Inc42](https://inc42.com/lists/top-20-funded-logistics-startups-in-india-2026), [Fretron](https://www.fretron.com/blog/best-tms-software-india-2026/) |
| Shipsy | Logistics automation: order management, last-mile, cross-border | [Zimyo, Apr 2026](https://www.zimyo.com/insights/top-logistics-saas-companies-india/) |
| Fretron | TMS for manufacturers | [Fretron](https://www.fretron.com/blog/best-tms-software-india-2026/) |
| SuperProcure | Freight procurement (reverse e-auctions) | [Fretron](https://www.fretron.com/blog/best-tms-software-india-2026/) |
| Fleetx | Fleet tracking and management | [Fretron](https://www.fretron.com/blog/best-tms-software-india-2026/) |
| Freight Tiger | Digital freight network | [Fretron](https://www.fretron.com/blog/best-tms-software-india-2026/) |
| Traqo | WhatsApp-native logistics tool for small manufacturers | [Fretron](https://www.fretron.com/blog/best-tms-software-india-2026/) |
| Kale Logistics Solutions | Cargo, aviation and multimodal logistics platform | [Zimyo](https://www.zimyo.com/insights/top-logistics-saas-companies-india/) |
| Shiprocket | Shipping and fulfilment platform for online sellers | [Inc42](https://inc42.com/lists/top-20-funded-logistics-startups-in-india-2026), [Zimyo](https://www.zimyo.com/insights/top-logistics-saas-companies-india/) |

Source caveats: Fretron's list is written by a vendor that appears in it; Zimyo is an HR-software blog. Both are used only to
confirm that a company exists and what it does. Accessed 12 Oct 2026.
