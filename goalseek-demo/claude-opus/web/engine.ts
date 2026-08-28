export interface Product {
  ticker: string; name: string; asset_class: string; category: string;
  region: string; er: number; role: string;
}
export interface Assumption {
  yieldPct: number; ordinary: number; qualified: number; exempt: number; note: string;
}
export interface Bundle {
  products: Product[];
  client: Record<string, number>;
  assumptions: Record<string, Assumption>;
  taxRates: { ordinary: number; qualified: number; exempt: number };
  window: { start: string; end: string; tradingDays: number; years: number };
  cagr: Record<string, number>;
  vol: Record<string, number>;
  maxDrawdown: Record<string, number>;
  cov: number[][]; corr: number[][];
  coverage: Record<string, { first: string; last: string; days: number }>;
  dates: string[]; priceIndex: Record<string, number[]>;
}

export type Weights = Record<string, number>;   // percentages, sum 100

export interface Metrics {
  fee: number;            // weighted expense ratio, %
  grossYield: number;     // %
  netYield: number;       // after-tax %, %
  taxDrag: number;        // gross - net
  usPct: number;
  equityPct: number;      // Equity + Equity Income + Alternatives + Real Assets
  bondPct: number;
  vol: number;            // annualised, %
  cagr: number;           // backtested annualised total return, %
  maxDD: number;          // %
  holdings: number;
  effN: number;           // 1 / HHI — effective number of holdings
  maxPos: number;
  turnover: number;       // one-way % of portfolio traded vs current
}

export interface Ctx {
  b: Bundle;
  idx: Record<string, number>;
  yields: Record<string, number>;   // advisor-editable
  taxRates: { ordinary: number; qualified: number; exempt: number };
  client: Weights;
}

export function makeCtx(b: Bundle, yields?: Record<string, number>): Ctx {
  const idx: Record<string, number> = {};
  b.products.forEach((p, i) => { idx[p.ticker] = i; });
  const y = yields ?? Object.fromEntries(
    Object.entries(b.assumptions).map(([k, v]) => [k, v.yieldPct]));
  return { b, idx, yields: y, taxRates: b.taxRates, client: b.client };
}

const DEFENSIVE = new Set(['Fixed Income']);

export function metrics(ctx: Ctx, w: Weights): Metrics {
  const { b } = ctx;
  let fee = 0, gy = 0, ny = 0, us = 0, bond = 0, hhi = 0, n = 0, maxPos = 0, turn = 0;
  for (const p of b.products) {
    const x = (w[p.ticker] ?? 0) / 100;
    if (x <= 0) continue;
    const a = b.assumptions[p.ticker];
    const yl = ctx.yields[p.ticker] ?? a.yieldPct;
    fee += x * p.er;
    gy += x * yl;
    ny += x * yl * (a.ordinary * (1 - ctx.taxRates.ordinary)
                  + a.qualified * (1 - ctx.taxRates.qualified)
                  + a.exempt * (1 - ctx.taxRates.exempt));
    if (p.region === 'US') us += x;
    if (DEFENSIVE.has(p.asset_class)) bond += x;
    hhi += x * x; n++; maxPos = Math.max(maxPos, x * 100);
  }
  for (const p of b.products) {
    turn += Math.abs((w[p.ticker] ?? 0) - (ctx.client[p.ticker] ?? 0));
  }
  // portfolio variance from annualised covariance
  let varr = 0;
  for (const p of b.products) {
    const xi = (w[p.ticker] ?? 0) / 100; if (xi === 0) continue;
    for (const q of b.products) {
      const xj = (w[q.ticker] ?? 0) / 100; if (xj === 0) continue;
      varr += xi * xj * b.cov[ctx.idx[p.ticker]][ctx.idx[q.ticker]];
    }
  }
  const bt = backtest(ctx, w);
  return {
    fee, grossYield: gy, netYield: ny, taxDrag: gy - ny,
    usPct: us * 100, equityPct: (1 - bond) * 100, bondPct: bond * 100,
    vol: Math.sqrt(Math.max(varr, 0)) * 100,
    cagr: bt.cagr, maxDD: bt.maxDD,
    holdings: n, effN: hhi > 0 ? 1 / hhi : 0, maxPos, turnover: turn / 2,
  };
}

/** Constant-weight, daily-rebalanced growth of 100 over the common price window. */
export function backtest(ctx: Ctx, w: Weights): { path: number[]; cagr: number; maxDD: number } {
  const { b } = ctx;
  const ts = Object.keys(w).filter((t) => (w[t] ?? 0) > 0);
  const len = b.priceIndex[b.products[0].ticker].length;
  const path = new Array<number>(len).fill(0);
  for (let i = 0; i < len; i++) {
    let v = 0;
    for (const t of ts) v += (w[t] / 100) * b.priceIndex[t][i];
    path[i] = v;
  }
  // constant-weight path: recompose daily from index ratios
  const cw = new Array<number>(len); cw[0] = 100;
  for (let i = 1; i < len; i++) {
    let r = 0;
    for (const t of ts) r += (w[t] / 100) * (b.priceIndex[t][i] / b.priceIndex[t][i - 1] - 1);
    cw[i] = cw[i - 1] * (1 + r);
  }
  let peak = cw[0], mdd = 0;
  for (const x of cw) { peak = Math.max(peak, x); mdd = Math.min(mdd, x / peak - 1); }
  const years = b.window.years;
  return { path: cw, cagr: (Math.pow(cw[len - 1] / 100, 1 / years) - 1) * 100, maxDD: mdd * 100 };
}

// ---------------------------------------------------------------- solver

export interface Limits {
  feeCap: number;        // %
  incomeFloor: number;   // gross yield %, the "don't cut income" line
  usCap: number;         // %
  minPos: number;        // % — no dust positions
  maxPos: number;        // %
  minHoldings: number;
  bondMin: number; bondMax: number;
  volMax: number;        // % — do not buy income with risk
  excluded: Set<string>;
  pinned: Record<string, number>;   // ticker -> fixed weight %
}

export interface Solution { w: Weights; m: Metrics; feasible: boolean; score: number; }

function violations(m: Metrics, L: Limits): number {
  let v = 0;
  v += Math.max(0, m.fee - L.feeCap) * 100;
  v += Math.max(0, L.incomeFloor - m.grossYield) * 40;
  v += Math.max(0, m.usPct - L.usCap) * 3;
  v += Math.max(0, m.vol - L.volMax) * 8;
  v += Math.max(0, L.bondMin - m.bondPct) * 2 + Math.max(0, m.bondPct - L.bondMax) * 2;
  v += Math.max(0, L.minHoldings - m.holdings) * 10;
  v += Math.max(0, m.maxPos - L.maxPos) * 5;
  return v;
}

export function isFeasible(m: Metrics, L: Limits): boolean {
  return m.fee <= L.feeCap + 1e-9 && m.grossYield >= L.incomeFloor - 1e-9
      && m.usPct <= L.usCap + 1e-6 && m.vol <= L.volMax + 1e-6
      && m.bondPct >= L.bondMin - 1e-6 && m.bondPct <= L.bondMax + 1e-6
      && m.holdings >= L.minHoldings && m.maxPos <= L.maxPos + 1e-6;
}

/** What we optimise for once the constraints are met. Stated on screen. */
export function quality(m: Metrics): number {
  return m.netYield * 1.0                       // after-tax income to the client
       + Math.min(m.effN, 10) * 0.06            // genuine diversification, capped
       - m.turnover * 0.010                     // taxable account: trading has a cost
       - Math.max(0, m.maxDD + 20) * 0.0;       // drawdown handled by volMax
}

function objective(ctx: Ctx, w: Weights, L: Limits, vw = 1): { s: number; m: Metrics } {
  const m = metrics(ctx, w);
  return { s: quality(m) - violations(m, L) * vw, m };
}

function randomStart(ctx: Ctx, L: Limits, rnd: () => number): Weights {
  const pool = ctx.b.products.map((p) => p.ticker).filter((t) => !L.excluded.has(t));
  const w: Weights = {};
  let free = 100;
  for (const [t, v] of Object.entries(L.pinned)) { w[t] = v; free -= v; }
  const cand = pool.filter((t) => !(t in L.pinned));
  const k = Math.max(L.minHoldings, 5 + Math.floor(rnd() * 6));
  const pick = [...cand].sort(() => rnd() - 0.5).slice(0, Math.min(k, cand.length));
  const raw = pick.map(() => rnd() + 0.15);
  const sum = raw.reduce((a, b) => a + b, 0);
  pick.forEach((t, i) => { w[t] = Math.max(0, (raw[i] / sum) * free); });
  return w;
}

function clean(ctx: Ctx, w: Weights, L: Limits): Weights {
  const out: Weights = {};
  let s = 0;
  for (const p of ctx.b.products) {
    let v = w[p.ticker] ?? 0;
    if (p.ticker in L.pinned) v = L.pinned[p.ticker];
    else if (v < L.minPos || L.excluded.has(p.ticker)) v = 0;
    if (v > 0) { out[p.ticker] = v; s += v; }
  }
  const pinSum = Object.values(L.pinned).reduce((a, b) => a + b, 0);
  const freeSum = s - pinSum;
  if (freeSum > 0) {
    const target = 100 - pinSum;
    for (const t of Object.keys(out)) if (!(t in L.pinned)) out[t] *= target / freeSum;
  }
  return out;
}

export function solve(ctx: Ctx, L: Limits, restarts = 34, steps = 520, seed = 7): Solution {
  let st = seed >>> 0;
  const rnd = () => { st = (st * 1664525 + 1013904223) >>> 0; return st / 4294967296; };
  const tickers = ctx.b.products.map((p) => p.ticker).filter((t) => !L.excluded.has(t) && !(t in L.pinned));
  let best: Weights = {}; let bestS = -Infinity; let bestRank = -Infinity; let bestM: Metrics | null = null;

  for (let r = 0; r < restarts; r++) {
    const vw = 1 + (r / restarts) * 40;
    let w = clean(ctx, randomStart(ctx, L, rnd), L);
    let cur = objective(ctx, w, L, vw);
    let step = 12;
    for (let s = 0; s < steps; s++) {
      if (s % 90 === 89) step = Math.max(0.6, step * 0.55);
      const i = tickers[Math.floor(rnd() * tickers.length)];
      const j = tickers[Math.floor(rnd() * tickers.length)];
      if (i === j) continue;
      const avail = w[i] ?? 0;
      const d = Math.min(avail, step * (0.25 + rnd()));
      if (d <= 1e-6) continue;
      const nw = { ...w };
      nw[i] = avail - d; nw[j] = (nw[j] ?? 0) + d;
      if (nw[i] < L.minPos) { nw[j] += nw[i]; nw[i] = 0; }
      if (nw[i] === 0) delete nw[i];
      if (nw[j] < L.minPos) continue;
      const cand = objective(ctx, nw, L, vw);
      if (cand.s > cur.s) { w = nw; cur = cand; }
    }
    w = clean(ctx, w, L);
    cur = objective(ctx, w, L, vw);
    const feas = isFeasible(cur.m, L) ? 1 : 0;
    const rank = feas * 1e6 + cur.s;
    if (rank > bestRank) { bestRank = rank; bestS = cur.s; best = w; bestM = cur.m; }
  }
  // polish: heavy violation weight, fine steps — pull the answer strictly inside
  {
    let w = best; let cur = objective(ctx, w, L, 400);
    for (let s = 0; s < 900; s++) {
      const i = tickers[Math.floor(rnd() * tickers.length)];
      const j = tickers[Math.floor(rnd() * tickers.length)];
      if (i === j) continue;
      const avail = w[i] ?? 0;
      const d = Math.min(avail, 1.5 * rnd());
      if (d <= 1e-6) continue;
      const nw = { ...w };
      nw[i] = avail - d; nw[j] = (nw[j] ?? 0) + d;
      if (nw[i] < L.minPos) { nw[j] += nw[i]; nw[i] = 0; }
      if (nw[i] === 0) delete nw[i];
      if (nw[j] < L.minPos) continue;
      const cand = objective(ctx, nw, L, 400);
      if (cand.s > cur.s) { w = nw; cur = cand; }
    }
    w = clean(ctx, w, L); cur = objective(ctx, w, L, 400);
    const m0 = metrics(ctx, best);
    if (isFeasible(cur.m, L) || !isFeasible(m0, L)) { best = w; bestM = cur.m; bestS = cur.s; }
  }
  const m = bestM ?? metrics(ctx, best);
  return { w: best, m, feasible: isFeasible(m, L), score: bestS };
}

export function roundWeights(w: Weights, dp = 1): Weights {
  const k = Math.pow(10, dp);
  const out: Weights = {};
  const ents = Object.entries(w).filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1]);
  let acc = 0;
  ents.forEach(([t, v], i) => {
    if (i === ents.length - 1) out[t] = Math.round((100 - acc) * k) / k;
    else { const r = Math.round(v * k) / k; out[t] = r; acc += r; }
  });
  return out;
}
