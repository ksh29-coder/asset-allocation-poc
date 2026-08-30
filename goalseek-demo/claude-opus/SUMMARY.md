# Summary

`./run.sh serve` → bundles `web/main.ts` with esbuild, starts `node src/server.ts`,
prints the URL (first free port in 5700–5709, normally http://127.0.0.1:5700/).
Offline, everything computed from `data/`.

## What I built

A single proposal screen for the advisor, organised around the fact that the
client's three asks **cannot all be met on this shelf**.

1. **The three asks, as three cards**, each showing the proposal's number against
   the target, met/not met, and what they hold today.
2. **A verdict paragraph** that is generated from the actual solution, not
   written in advance. It names the conflict (JEPI+JEPQ are 35% of the portfolio
   and are simultaneously the expensive part, the American part and the income
   part), quantifies what was given up in gross *and* after-tax terms and in
   dollars on a $2m account, and states what it would take to buy the third ask
   back — read off the sweeps below, not asserted.
3. **The proposal itself**: weights, deltas vs. what they hold, turnover.
4. **"Before you send it"** — auto-generated flags for things the proposal
   changed that *nobody asked for*: risk-mix drift, turnover as a taxable event,
   loss of diversification, the size of the covered-call cut.
5. **Side-by-side metrics** vs. the current portfolio, with forward-looking
   figures (cost, yield) separated from realised history (vol, return, drawdown).
6. **Growth of $100** chart, proposal vs. current.
7. **"What it would take"** — two one-dimensional sweeps: best achievable gross
   yield at each cost ceiling (0.15%→0.35%) and at each US ceiling (60%→95%).
   This is where "you need 0.26%, or ~95% US" comes from.
8. **Three fully-built alternatives** (hold income and pay for it; hold income at
   0.20% and let US run; all three imposed at once) — click to load any of them.
9. **Steer it** — live ceilings for cost, income, US, volatility, max position,
   plus per-fund exclusion. Re-solve.
10. **Assumptions panel**, open by default, with every yield editable.

## The answer

- Today: **0.326%** cost, **4.90%** gross yield (3.04% after tax), **95% US**.
- Cost + US both met → income falls to **~4.47%** gross, **2.85%** after tax.
- Holding income whole at 70% US needs a cost ceiling around **0.26%**.
- Holding income whole at 0.20% pushes US to **~96%** — worse than today.
- So: **any two, never three.** The recommendation is to concede the fee ceiling
  by a few bp, because after tax it is the cheapest of the three to give.

## Decisions

- **Yields are an assumption, and the screen says so.** `prices.csv` is
  total-return adjusted close, so no income stream can be separated from it.
  Rather than pretend, I put an explicit indicative-yield table on screen with a
  tax-character split (ordinary / qualified / exempt), made every number
  editable, and reported income **after tax at 40.8%/23.8%** as well as gross —
  which matters a lot here, since covered-call premium is ordinary income.
- **"A portfolio is not a number to be minimised."** Feasibility is a hard gate
  (cost, income, US, volatility ceiling, 22–42% fixed income, 3% min / 25% max
  position, ≥6 holdings). Only inside that does the search optimise, and it
  optimises after-tax income with a diversification bonus and a turnover penalty
  — a taxable account should not be churned for basis points.
- **Every return figure is labelled with its window.** The 16 funds only share
  **2023-10-12 → 2026-07-17** (2.7y): JBND launched Oct 2023, and JAGG's series
  in `prices.csv` stops six weeks before the file's end date. Both facts are on
  the page, with a warning not to quote it as a five-year record.
- Search is random-restart local search on the simplex with a two-phase penalty
  (loose → heavy polish). Stated on screen, including that re-solving can move
  the answer by tenths.

## Left out

- No cost-basis data, so the tax cost of the 59% turnover cannot be computed —
  the screen flags this rather than ignoring it.
- Covariance is used for the volatility ceiling only; no mean-variance frontier.
- No lot-level or transition sequencing, no rebalance schedule, no print/PDF view.
- Alternatives are recomputed on every re-solve (a few seconds); no caching.
