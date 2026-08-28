import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { loadProducts, loadClient, loadPrices, computeStats } from './data.ts';
import { YIELD_ASSUMPTIONS, TAX_RATES } from './assumptions.ts';

const ROOT = resolve(import.meta.dirname, '..');
const DATA = join(ROOT, 'data');

const products = loadProducts(DATA);
const client = loadClient(DATA);
const prices = loadPrices(DATA);
const tickers = products.map((p) => p.ticker);
const stats = computeStats(prices, tickers);

// Normalised price series (base 100) for charting, on the common window.
const priceIndex: Record<string, number[]> = {};
for (const t of tickers) {
  let v = 100; const out = [100];
  for (const r of stats.dailyReturns[t]) { v *= 1 + r; out.push(v); }
  priceIndex[t] = out.map((x) => Math.round(x * 1000) / 1000);
}

const bundle = JSON.stringify({
  products, client,
  assumptions: YIELD_ASSUMPTIONS, taxRates: TAX_RATES,
  window: { start: stats.commonStart, end: stats.commonEnd, tradingDays: stats.tradingDays,
            years: (stats.tradingDays - 1) / 252 },
  cagr: stats.cagr, vol: stats.vol, maxDrawdown: stats.maxDrawdown,
  cov: stats.cov, corr: stats.corr, coverage: stats.coverage,
  dates: stats.windowDates, priceIndex,
});

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.map': 'application/json',
};

const PORTS = [5700, 5701, 5702, 5703, 5704, 5705, 5706, 5707, 5708, 5709];

const server = createServer((req, res) => {
  const url = (req.url ?? '/').split('?')[0];
  if (url === '/api/bundle') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(bundle);
    return;
  }
  const rel = url === '/' ? '/index.html' : url;
  const file = join(ROOT, 'web', rel);
  if (!file.startsWith(join(ROOT, 'web')) || !existsSync(file)) {
    res.writeHead(404, { 'content-type': 'text/plain' }); res.end('not found'); return;
  }
  res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
  res.end(readFileSync(file));
});

function listen(i: number): void {
  if (i >= PORTS.length) { console.error('No free port in 5700-5709'); process.exit(1); }
  server.once('error', () => listen(i + 1));
  server.listen(PORTS[i], '127.0.0.1', () => {
    console.log(`\n  Proposal screen ready:  http://127.0.0.1:${PORTS[i]}/\n`);
  });
}
listen(0);
