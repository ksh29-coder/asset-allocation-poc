# Data notes

- `products.csv` — the investable universe: 16 real JPMorgan ETFs across
  equity, equity income, fixed income, real assets and alternatives. Expense
  ratios are per public issuer/aggregator disclosures as of August 2026 (verify
  against am.jpmorgan.com if exact figures matter).
- `prices.csv` — daily adjusted closes for every ticker, long format:
  `date,ticker,adj_close`, sourced from public market data (5 years where
  available; many funds are younger — e.g. JEPQ 2022, JMEE 2022, JIRE 2022,
  JGRO 2022, JGLO 2023, HELO 2023, JBND 2023 — treat shorter histories as a
  real-world data condition, not an error). Only 7 of the 16 funds reach back to
  the start of the window on 2021-08-27, and four of those seven are bond funds,
  so any long-horizon view of a diversified portfolio has to confront this.
- Coverage is not uniform at the **end** of the window either: `JAGG` stops on
  2026-07-17 while every other fund runs to 2026-08-26. Decide deliberately how
  a portfolio containing a fund with a shorter tail is valued, and say what you
  chose — silently forward-filling and silently truncating give different
  numbers.
- Adjusted closes include distributions (total-return basis), which matters for
  the income ETFs (JEPI/JEPQ/JPIE distribute heavily).
- Data is static: applications must work entirely from these files, with no
  live market-data calls.
