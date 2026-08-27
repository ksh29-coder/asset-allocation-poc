# Engagement brief — Asset Allocation Platform

Our advisory desk needs a portfolio management application for building and
monitoring client asset allocations. The investable universe is fixed: the
JPMorgan products in `data/products.csv`, with price history in
`data/prices.csv` (see `data/DATA_NOTES.md`).

This brief is deliberately open. We are not handing you a feature list — you
are expected to research what a professional asset-allocation tool should do
for an advisor constructing client portfolios from a fund shelf, decide which
features matter most, and build them well. Depth on the features that matter
beats shallow coverage of many.

## What we require

1. **A complete working web application** — user interface and server —
   that an advisor could use in a browser on this machine.
2. **Built entirely on the provided data.** No live market-data calls, no
   external data sources at runtime. The application must work offline once
   set up.
3. **Tested.** Whatever you build, ship a test suite you would stand behind.
4. **`SUMMARY.md`** at the repo root, written for a senior non-technical
   audience: what you built, which features you chose and *why* (what an
   advisor gains from each), what you deliberately left out, and what you
   would build next with more time.

## Command contract

```
./run.sh setup    # install dependencies (network allowed here only)
./run.sh serve    # start the application; print the local URL to open
./run.sh test     # run your test suite; nonzero exit on failure
```

Any language, framework, and architecture you judge appropriate.

## Port assignment

This application must bind only to ports in the range **4200–4209** (inclusive).
Several applications built from this brief run simultaneously on one machine, so
any port outside this range risks a collision. If you need more than one port —
say an API server and a frontend dev server — use additional ports from within
the range. `./run.sh serve` must print the exact URL to open.

## Notes

- Some funds have short histories (young ETFs). Handle real-world data
  conditions gracefully — this is a professional tool, not a happy-path demo.
- Expense ratios are in `products.csv`; advisors care about what a portfolio
  costs.
- Do not modify anything under `data/`.
