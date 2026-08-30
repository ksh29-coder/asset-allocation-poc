# Data notes

What the three data files contain. All are static: the app works entirely from them,
with no live market-data calls.

## products.csv — 16 rows, one per fund

```
ticker,name,asset_class,category,region,expense_ratio_pct,role
```

The funds this advisor is allowed to sell. Real JPMorgan ETFs.
`expense_ratio_pct` is an annual percentage — `0.35` means 0.35% per year — per
public issuer/aggregator disclosures as of August 2026 (verify against
am.jpmorgan.com if exact figures matter).

## prices.csv — 17,604 rows, long format

```
date,ticker,adj_close
```

Daily closes sourced from public market data, spanning 2021-08-27 to 2026-08-26.
`adj_close` is adjusted for distributions — a total-return basis, not a price basis.
Because income is already inside the price, it cannot be separated back out of this
file.

## client_portfolio.csv — 9 rows

```
ticker,weight_pct,market_value,cost_basis
```

What this client holds today. `market_value` is the current value of the holding in
dollars; `cost_basis` is what was paid for it. Both are in whole dollars, and
`weight_pct` is that holding's share of the account. The account is taxable, so the
difference between the two columns is an unrealised gain or loss that becomes real
if the holding is sold.
