import { readFileSync } from 'node:fs';

export interface Product {
  ticker: string; name: string; asset_class: string; category: string;
  region: string; er: number; role: string;
}

function parseCsv(text: string): string[][] {
  return text.trim().split(/\r?\n/).map((l) => l.split(','));
}

export function loadProducts(dir: string): Product[] {
  const rows = parseCsv(readFileSync(`${dir}/products.csv`, 'utf8'));
  return rows.slice(1).map((r) => ({
    ticker: r[0], name: r[1], asset_class: r[2], category: r[3],
    region: r[4], er: Number(r[5]), role: r[6],
  }));
}

export function loadClient(dir: string): Record<string, number> {
  const rows = parseCsv(readFileSync(`${dir}/client_portfolio.csv`, 'utf8'));
  const out: Record<string, number> = {};
  for (const r of rows.slice(1)) out[r[0]] = Number(r[1]);
  return out;
}

export interface PriceSeries {
  dates: string[];                       // union of all dates, sorted
  series: Record<string, (number | null)[]>;
}

export function loadPrices(dir: string): PriceSeries {
  const rows = parseCsv(readFileSync(`${dir}/prices.csv`, 'utf8')).slice(1);
  const dateSet = new Set<string>();
  const byTicker: Record<string, Map<string, number>> = {};
  for (const r of rows) {
    const [d, t, p] = r;
    dateSet.add(d);
    (byTicker[t] ??= new Map()).set(d, Number(p));
  }
  const dates = [...dateSet].sort();
  const series: Record<string, (number | null)[]> = {};
  for (const t of Object.keys(byTicker)) {
    const m = byTicker[t];
    series[t] = dates.map((d) => m.get(d) ?? null);
  }
  return { dates, series };
}

export interface Stats {
  tickers: string[];
  /** first date on which EVERY ticker has a price — the common window */
  commonStart: string;
  commonEnd: string;
  tradingDays: number;
  /** annualised total return over the common window, decimal */
  cagr: Record<string, number>;
  vol: Record<string, number>;
  maxDrawdown: Record<string, number>;
  /** daily return matrix over common window, tickers x days */
  cov: number[][];      // annualised covariance
  corr: number[][];
  /** aligned daily returns for exact backtesting */
  dailyReturns: Record<string, number[]>;
  windowDates: string[];
  coverage: Record<string, { first: string; last: string; days: number }>;
}

export function computeStats(p: PriceSeries, tickers: string[]): Stats {
  // common window: rows where all tickers present
  const idx: number[] = [];
  for (let i = 0; i < p.dates.length; i++) {
    if (tickers.every((t) => p.series[t]?.[i] != null)) idx.push(i);
  }
  const windowDates = idx.map((i) => p.dates[i]);
  const dailyReturns: Record<string, number[]> = {};
  const cagr: Record<string, number> = {};
  const vol: Record<string, number> = {};
  const maxDrawdown: Record<string, number> = {};
  const years = (idx.length - 1) / 252;
  for (const t of tickers) {
    const s = p.series[t];
    const px = idx.map((i) => s[i] as number);
    const r: number[] = [];
    for (let i = 1; i < px.length; i++) r.push(px[i] / px[i - 1] - 1);
    dailyReturns[t] = r;
    cagr[t] = Math.pow(px[px.length - 1] / px[0], 1 / years) - 1;
    const mean = r.reduce((a, b) => a + b, 0) / r.length;
    const v = r.reduce((a, b) => a + (b - mean) ** 2, 0) / (r.length - 1);
    vol[t] = Math.sqrt(v * 252);
    let peak = px[0], mdd = 0;
    for (const x of px) { peak = Math.max(peak, x); mdd = Math.min(mdd, x / peak - 1); }
    maxDrawdown[t] = mdd;
  }
  const n = tickers.length;
  const cov: number[][] = [], corr: number[][] = [];
  const means = tickers.map((t) => {
    const r = dailyReturns[t]; return r.reduce((a, b) => a + b, 0) / r.length;
  });
  for (let i = 0; i < n; i++) {
    cov[i] = []; corr[i] = [];
    for (let j = 0; j < n; j++) {
      const a = dailyReturns[tickers[i]], b = dailyReturns[tickers[j]];
      let s = 0;
      for (let k = 0; k < a.length; k++) s += (a[k] - means[i]) * (b[k] - means[j]);
      cov[i][j] = (s / (a.length - 1)) * 252;
    }
  }
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++)
    corr[i][j] = cov[i][j] / Math.sqrt(cov[i][i] * cov[j][j]);

  const coverage: Record<string, { first: string; last: string; days: number }> = {};
  for (const t of tickers) {
    const s2 = p.series[t];
    const have = p.dates.filter((_, i) => s2[i] != null);
    coverage[t] = { first: have[0], last: have[have.length - 1], days: have.length };
  }
  return {
    coverage,
    tickers, commonStart: windowDates[0], commonEnd: windowDates[windowDates.length - 1],
    tradingDays: windowDates.length, cagr, vol, maxDrawdown, cov, corr, dailyReturns, windowDates,
  };
}
