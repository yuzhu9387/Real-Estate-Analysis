# 19133 Cozette Ln, Cupertino — all ATTOM source data

- **APN:** 375-07-019  ·  **ATTOM id:** 155679723  ·  **County:** Santa Clara (FIPS 6085)
- **Owner:** CITY OF CUPERTINO (acquired **2020-10-02**, quitclaim deed, doc 0024751178)
- **Source tables:** `public.taxassessor` (1 row) · `public.recorder` (13 deed/mortgage rows, 1988–2020) · `public.amortizedequity` (1 row, stale) · `actool.mls` (0 rows — never MLS-listed)

## ⚠️ Not vacant — it's a house
`propertyusegroup = Residential`. Single-family home **built 1949** (effective 1975): **1,892 sqft, 4 bed / 2 bath, 9 rooms**, fireplace, 2-car garage (430 sqft). Lot **11,250 sqft (0.258 ac, 75×150)**. Subdivision "Loree/Lores Estates", Tract 550, Lot 148. Zoning **R1-10**.
(The build-suitability score of 97 treated it as "Residential" — but there is an existing 1949 house on it; it is a city-owned SFR, a possible surplus/redevelopment candidate, not raw vacant land.)

## Assessed value (2023 roll)
- Total **$1,695,175** = land $1,203,839 + improvements $491,336
- Tax billed 2023: **$20,885.84** (still on the tax roll despite city ownership)
- Market value (land): 0

## Ownership / deed & mortgage chronology (public.recorder, 13 rows)
| Date | Doc type | Grantee / owner | Mortgage |
|------|----------|-----------------|----------|
| 1988-11-01 | DTTR | Eugene Albretsen | $62,000 Household Finance |
| 1990-04-11 | DTTR | Eugene Albretsen | $210,000 Amerimac |
| 2001-01-09 | DTTR | Albretsen Trust | $50,000 California Federal |
| 2003-05-13 | DTTR | Albretsen (TR) | $100,000 Citibank West |
| 2005-12-07 | DTIT | Eugene M & Sandra J Albretsen | $305,000 CitiMortgage |
| 2006-03-24 | DTIT | Eugene & Sandra Albretsen | $450,000 Washington Mutual |
| 2006-05-18 | DTTR | Eugene M & Sandra J Albretsen | $100,000 HSBC |
| 2008-03-14 | DTTR | Eugene M & Sandra J Albretsen | $200,000 HSBC |
| 2011-06-08 | DTGD (grant) | **Chang K & Chang Jung S Kim** (buy, ~$1,222,000) | $222,000 JMAC |
| 2011-12-29 | DTTR | Chang K & Chang Jung S Kim | $417,000 JMAC |
| 2016-09-20 | DTQC (quitclaim) | KIM 2002 FAMILY TRUST | — |
| **2020-10-02** | **DTQC (quitclaim)** | **CITY OF CUPERTINO** | — |
| (undated) | DTQC | Albretsen Trust | — |

## amortizedequity (1 row) — STALE, ignore
Estimated available equity $3,090,301 / lendable $2,472,240, first-loan amortized $253,199. This is computed off the **2011 Kim $417k loan** (firstloantransactionid 321878606) and is meaningless now that the City owns it free & clear (2020). Kept for completeness only.

## Files
- `taxassessor.json` — full assessor record (all non-null fields)
- `recorder_13_deeds.json` — all 13 deed/mortgage transactions
- `amortizedequity.json` — the (stale) equity row
