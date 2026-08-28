import {
  makeCtx, metrics, solve, backtest, roundWeights, isFeasible,
  type Bundle, type Ctx, type Limits, type Metrics, type Weights,
} from './engine.ts';

const $ = (s: string) => document.querySelector(s) as HTMLElement;
const f = (x: number, d = 2) => x.toFixed(d);
const pc = (x: number, d = 2) => `${x.toFixed(d)}%`;
const sgn = (x: number, d = 2) => `${x >= 0 ? '+' : ''}${x.toFixed(d)}`;

let ctx: Ctx;
let cur: Metrics;                    // the portfolio the client holds today
let L: Limits;
let alts: { key: string; title: string; desc: string; w: Weights; m: Metrics; feasible: boolean }[] = [];
let chosen = 'proposal';
let feeCurve: { cap: number; y: number; ok: boolean }[] = [];
let usCurve: { cap: number; y: number; ok: boolean }[] = [];

const ASK = { fee: 0.20, us: 70 };

async function boot() {
  const b: Bundle = await (await fetch('/api/bundle')).json();
  ctx = makeCtx(b);
  cur = metrics(ctx, b.client);
  L = {
    feeCap: ASK.fee, incomeFloor: cur.grossYield, usCap: ASK.us,
    minPos: 3, maxPos: 25, minHoldings: 6,
    bondMin: 22, bondMax: 42, volMax: cur.vol * 1.10,
    excluded: new Set(), pinned: {},
  };
  recompute();
}

function lim(o: Partial<Limits>): Limits { return { ...L, ...o }; }

function build(key: string, title: string, desc: string, ll: Limits, restarts = 40) {
  const s = solve(ctx, ll, restarts, 520, 11);
  const w = roundWeights(s.w);
  const m = metrics(ctx, w);
  return { key, title, desc, w, m, feasible: isFeasible(m, ll) };
}

function recompute() {
  // The recommendation honours the two asks the client can check on a statement —
  // cost and US weight — and buys back as much AFTER-TAX income as the shelf allows
  // inside them. Income is the one that has to give; the screen says so out loud.
  const proposal = build('proposal', 'Recommended — cost and US met',
    'The 0.20% ceiling and the 70% US cap both held. Inside them, the search maximises after-tax income.',
    lim({ incomeFloor: 0 }), 70);

  const keepIncome = build('income', 'Hold the income line, pay for it',
    'Income kept whole and US under 70% — the cost ceiling is the one that gives.',
    lim({ feeCap: 1.0 }), 55);

  const keepUS = build('usflex', 'Hold income at 0.20%, let US run',
    'Income kept whole and cost under 0.20% — the US cap is the one that gives.',
    lim({ usCap: 100 }), 55);

  const all3 = build('all3', 'All three imposed at once',
    'Every constraint hard. If this is infeasible the solver returns its closest miss, and you can see which ask it broke.',
    lim({}), 55);

  alts = [proposal, keepIncome, keepUS, all3];
  if (!alts.some((a) => a.key === chosen)) chosen = 'proposal';

  // "What would it take" — two one-dimensional sweeps: relax one ceiling at a time
  // and read off the best gross yield the shelf can reach.
  feeCurve = [];
  for (const cap of [0.15, 0.18, 0.20, 0.22, 0.24, 0.26, 0.30, 0.35]) {
    const s = solve(ctx, lim({ feeCap: cap, incomeFloor: 0 }), 24, 420, 3);
    feeCurve.push({ cap, y: s.m.grossYield, ok: false });
  }
  usCurve = [];
  for (const cap of [60, 65, 70, 75, 80, 85, 90, 95]) {
    const s = solve(ctx, lim({ usCap: cap, incomeFloor: 0 }), 24, 420, 3);
    usCurve.push({ cap, y: s.m.grossYield, ok: false });
  }
  // A strictly looser ceiling can never do worse than a tighter one, so the running
  // maximum is the right estimate — it cleans up the search noise, and it keeps the
  // sweep consistent with the fully-solved proposal at the client's own ceiling.
  const tidy = (rows: { cap: number; y: number; ok: boolean }[], atCap: number, atY: number) => {
    const hit = rows.find((r) => Math.abs(r.cap - atCap) < 1e-9);
    if (hit) hit.y = Math.max(hit.y, atY);
    let run = -Infinity;
    for (const r of rows) { run = Math.max(run, r.y); r.y = run; r.ok = r.y >= cur.grossYield - 0.005; }
  };
  tidy(feeCurve, ASK.fee, proposal.m.grossYield);
  tidy(usCurve, ASK.us, proposal.m.grossYield);
  render();
}

function pick() { return alts.find((a) => a.key === chosen) ?? alts[0]; }

// ------------------------------------------------------------------ render

function render() {
  const a = pick();
  const m = a.m;
  const feeMet = m.fee <= L.feeCap + 1e-9;
  const usMet = m.usPct <= L.usCap + 1e-6;
  const incMet = m.grossYield >= cur.grossYield - 1e-9;
  const misses = [!feeMet && 'cost', !incMet && 'income', !usMet && 'US concentration'].filter(Boolean) as string[];
  const w = ctx.b.window;
  const period = `${w.start} → ${w.end} (${w.tradingDays.toLocaleString()} trading days, ${f(w.years, 1)} years)`;

  $('#app').innerHTML = `
<div class="wrap">
  <div class="hdr">
    <div>
      <h1>Proposal — taxable growth &amp; income</h1>
      <p class="sub">Couple, mid-fifties · ~15-year horizon · taxable, top bracket ·
        16-fund JPMorgan shelf · income shown gross <em>and</em> after tax at
        ${pc(ctx.taxRates.ordinary * 100, 1)} ordinary / ${pc(ctx.taxRates.qualified * 100, 1)} qualified.</p>
    </div>
    <div style="text-align:right"><div class="nm">Return &amp; risk figures cover</div>
      <div style="font-variant-numeric:tabular-nums">${period}</div></div>
  </div>

  ${asks(m, feeMet, incMet, usMet)}
  ${verdict(a, misses)}

  <div class="cols">
    <div class="grid">
      <div class="panel">
        <h2>Proposed portfolio — ${a.title}</h2>
        ${holdings(a.w)}
      </div>
      <div class="panel">
        <h2>Before you send it — what this proposal does that nobody asked for</h2>
        ${flags(a)}
      </div>
      <div class="panel">
        <h2>Proposed vs. held today — growth of $100</h2>
        <div class="legend">
          <span><i style="background:#6aa8ff"></i>Proposal</span>
          <span><i style="background:#93a0b1"></i>Current portfolio</span>
        </div>
        ${chart(a.w)}
        <p class="foot">Constant-weight, daily-rebalanced total return over ${period}.
          Backward-looking on the funds' own realised prices; it is not a forecast, and it
          assumes today's line-up existed for the whole window. Fees are <em>not</em> deducted
          again here — <code>adj_close</code> is already net of fund expenses.</p>
      </div>
    </div>

    <div class="grid">
      <div class="panel">
        <h2>Side by side</h2>
        ${kpis(m)}
      </div>
      <div class="panel">
        <h2>What else was on the table</h2>
        <div class="alts">${alts.map(card).join('')}</div>
      </div>
    </div>
  </div>

  <div class="cols3" style="margin-top:18px">
    <div class="panel">
      <h2>What it would take to get the third one</h2>
      <p class="sub" style="margin-bottom:14px">Each row: the best gross yield the shelf can
        reach at that ceiling, everything else held. The client's income line is
        <b>${pc(cur.grossYield)}</b>.</p>
      ${curve('Cost ceiling', feeCurve, (r) => pc(r.cap, 2), ASK.fee)}
      <div style="height:14px"></div>
      ${curve('US ceiling', usCurve, (r) => pc(r.cap, 0), ASK.us)}
    </div>
    <div class="panel">
      <h2>Steer it</h2>
      ${controls()}
    </div>
  </div>

  <div class="panel" style="margin-top:18px">
    <h2>What these numbers rest on</h2>
    ${assumptions()}
  </div>
</div>`;
  wire();
}

function asks(m: Metrics, feeMet: boolean, incMet: boolean, usMet: boolean) {
  const one = (q: string, cls: boolean, big: string, tgt: string, was: string) => `
    <div class="ask ${cls ? 'met' : 'miss'}">
      <div class="q">${q}</div>
      <div class="row"><span class="big">${big}</span><span class="tgt">${tgt}</span>
        <span class="tag">${cls ? 'met' : 'not met'}</span></div>
      <div class="was">${was}</div>
    </div>`;
  return `<div class="asks">
    ${one('We\u2019re paying too much. Get the running cost under 0.20%.', feeMet,
        pc(m.fee, 3), 'vs 0.200% target',
        `Today ${pc(cur.fee, 3)} — a saving of ${f((cur.fee - m.fee) * 100, 1)} bp, about
         $${Math.round((cur.fee - m.fee) * 10000 / 100 * 1)} per $10,000 a year.`)}
    ${one('Don\u2019t cut our income.', incMet,
        pc(m.grossYield), `vs ${pc(cur.grossYield)} today`,
        `After tax: ${pc(m.netYield)} vs ${pc(cur.netYield)} today
         (${sgn(m.netYield - cur.netYield)} pp).`)}
    ${one('We\u2019re far too concentrated in America. Get us under 70% US.', usMet,
        pc(m.usPct, 1), 'vs 70% target',
        `Today ${pc(cur.usPct, 1)} US — only JGLO sits outside it.`)}
  </div>`;
}

function verdict(a: { title: string; m: Metrics }, misses: string[]) {
  const m = a.m;
  const dGross = m.grossYield - cur.grossYield, dNet = m.netYield - cur.netYield;
  const feeNeeded = feeCurve.find((r) => r.ok);
  const usNeeded = usCurve.find((r) => r.ok);
  const AUM = 2_000_000;
  const feeSaved = Math.round((cur.fee - m.fee) / 100 * AUM);
  const incLost = Math.round((cur.netYield - m.netYield) / 100 * AUM);

  const carrier = `The income in this portfolio is carried by JEPI and JEPQ — 35% of what they
    hold, at 0.35% a year, both US, both paying ordinary-income covered-call premium. They are
    the expensive part, the American part and the income part all at once, so the two asks that
    <em>can</em> be met are met by cutting exactly the sleeve that pays them.`;

  if (!misses.length) {
    return `<div class="verdict good"><b>This one meets all three.</b>
      <p>Cost ${pc(m.fee, 3)}, income ${pc(m.grossYield)} gross (${pc(cur.grossYield)} today),
      US ${pc(m.usPct, 1)}. But read the turnover before you celebrate: ${pc(m.turnover, 0)} of
      the portfolio has to be traded, and in a taxable account that is a realised-gains event
      the client will feel this April. Check it lot by lot.</p></div>`;
  }

  const missTxt = misses.length === 1
    ? `Everything except <b>${misses[0]}</b>.`
    : `Missing: <b>${misses.join(' and ')}</b>.`;

  return `<div class="verdict">
    <b>All three cannot be met together on this shelf. ${missTxt}</b>
    <p>${carrier}
    <br><br>
    <b>What this proposal gives up.</b> Gross income falls to <b>${pc(m.grossYield)}</b> from
    ${pc(cur.grossYield)} (${sgn(dGross)} pp). ${dNet < 0
      ? `After tax the gap is much smaller — ${pc(m.netYield)} vs ${pc(cur.netYield)}
         (${sgn(dNet)} pp) — because covered-call premium is ordinary income at
         ${pc(ctx.taxRates.ordinary * 100, 1)} and what replaces it is not. On a $2m account
         that is about <b>$${Math.abs(incLost).toLocaleString()}/yr</b> less spendable income
         against <b>$${feeSaved.toLocaleString()}/yr</b> saved in fees.`
      : `After tax they are <em>ahead</em>: ${pc(m.netYield)} vs ${pc(cur.netYield)}
         (${sgn(dNet)} pp), because the covered-call income they lose was taxed at
         ${pc(ctx.taxRates.ordinary * 100, 1)}. The headline yield falls; the money they
         actually keep does not. Say it in that order, or the number on the statement will
         do the talking for you.`}
    <br><br>
    <b>What would buy the third ask back.</b>
    ${feeNeeded
      ? `Keep US under 70% and hold income whole, and the cost ceiling has to move to about
         <b>${pc(feeNeeded.cap, 2)}</b> — ${f((feeNeeded.cap - ASK.fee) * 100, 0)} bp over the ask,
         roughly $${Math.round((feeNeeded.cap - ASK.fee) / 100 * AUM).toLocaleString()}/yr on $2m.`
      : `Holding income whole under a 70% US cap is not reachable at any cost on this shelf.`}
    ${usNeeded
      ? ` Or keep the 0.20% ceiling and let US run back to about <b>${pc(usNeeded.cap, 0)}</b>.`
      : ` And at a 0.20% ceiling, income cannot be held whole at any US weight.`}
    Both alternatives are built out in full below — click one to load it.
    <br><br>
    <b>The recommendation.</b> Take the cost and US asks, which are exact and checkable, and
    open the meeting on the income shortfall rather than waiting to be asked. The trade to
    argue for is the fee ceiling: ${feeNeeded ? `${f((feeNeeded.cap - ASK.fee) * 100, 0)} bp`
    : 'a higher fee'} is the cheapest of the three things to give, and it is the one the client
    is least likely to notice month to month.</p></div>`;
}

function flags(a: typeof alts[number]) {
  const m = a.m;
  const out: { sev: 'r' | 'w' | 'g'; t: string; b: string }[] = [];
  const dEq = m.equityPct - cur.equityPct;
  if (Math.abs(dEq) >= 3) out.push({ sev: 'w',
    t: `Risk mix moves ${sgn(dEq, 0)} pp in growth assets (${f(cur.equityPct, 0)}% → ${f(m.equityPct, 0)}%)`,
    b: `The client asked about cost, income and geography — not about their equity weight. This
        is a change to their risk, made as a side effect of hitting the other three. ${dEq < 0
        ? 'It is a de-risking, and fifteen years from drawdown that is a defensible choice — but it is a choice, and it needs saying out loud.'
        : 'It is more risk, not less. Do not let it pass unmentioned.'}` });
  if (m.turnover >= 35) out.push({ sev: 'r',
    t: `Turnover is ${f(m.turnover, 0)}% of the portfolio — a taxable event, not a rebalance`,
    b: `This is a taxable account in a top bracket. ${f(m.turnover, 0)}% one-way turnover means
        realised gains on positions held since at least 2023. Nothing on this page knows their
        cost basis, so the tax bill is not in any number here. Price it lot by lot before you
        send it, and consider phasing the trade across two tax years.` });
  if (m.holdings <= 7) out.push({ sev: 'w',
    t: `Only ${m.holdings} holdings — effective diversification falls to ${f(m.effN, 1)} from ${f(cur.effN, 1)}`,
    b: `The optimiser concentrates: it will not hold a fund that does not earn its place against
        the constraints. That is efficient and it is also fragile. Raise the minimum holdings or
        lower the maximum position in the panel opposite if you want a wider book.` });
  const jepi = (a.w['JEPI'] ?? 0) + (a.w['JEPQ'] ?? 0);
  const jepiNow = (ctx.b.client['JEPI'] ?? 0) + (ctx.b.client['JEPQ'] ?? 0);
  if (jepi < jepiNow - 5) out.push({ sev: 'w',
    t: `Covered-call sleeve cut from ${f(jepiNow, 0)}% to ${f(jepi, 0)}%`,
    b: `This is the change the client will actually feel, because it is the line on the statement
        that pays them monthly. It is also the single reason the cost and US asks can be met.
        Lead with it; do not let them find it.` });
  if (m.maxDD > cur.maxDD + 1) out.push({ sev: 'g',
    t: `Worst drawdown improves to ${f(m.maxDD, 1)}% from ${f(cur.maxDD, 1)}%`,
    b: `Over ${ctx.b.window.start} → ${ctx.b.window.end} only — a window with no equity bear
        market in it. It is not evidence the portfolio is defensive.` });
  if (m.vol > cur.vol + 0.3) out.push({ sev: 'r',
    t: `Volatility rises to ${f(m.vol, 1)}% from ${f(cur.vol, 1)}%`,
    b: `Income has been bought with risk. Tighten the volatility ceiling opposite and re-solve.` });
  if (!out.length) out.push({ sev: 'g', t: 'Nothing material moved that the client did not ask to move.',
    b: 'Risk mix, turnover and diversification are all close to what they hold today.' });
  return `<div class="flags">${out.map((o) => `<div class="flag ${o.sev}">
    <div class="ft">${o.t}</div><div class="fb">${o.b}</div></div>`).join('')}</div>`;
}

function holdings(w: Weights) {
  const rows = ctx.b.products
    .map((p) => ({ p, x: w[p.ticker] ?? 0, c: ctx.b.client[p.ticker] ?? 0 }))
    .filter((r) => r.x > 0 || r.c > 0)
    .sort((a, b) => b.x - a.x || b.c - a.c);
  const mx = Math.max(...rows.map((r) => r.x));
  return `<table><thead><tr>
      <th>Fund</th><th>Region</th><th>Fee</th><th>Yield</th>
      <th>Today</th><th>Proposed</th><th>Δ</th></tr></thead><tbody>
    ${rows.map((r) => {
      const d = r.x - r.c;
      return `<tr>
        <td><span class="tk">${r.p.ticker}</span>
            <div class="nm">${r.p.name.replace('JPMorgan ', '')}</div></td>
        <td class="nm">${r.p.region}</td>
        <td>${f(r.p.er, 2)}%</td>
        <td>${f(ctx.yields[r.p.ticker], 1)}%</td>
        <td class="${r.c ? '' : 'zero'}">${r.c ? f(r.c, 1) : '—'}</td>
        <td>${r.x ? `<span class="bar" style="width:${(r.x / mx) * 46}px"></span>
              <b style="margin-left:6px">${f(r.x, 1)}</b>` : '<span class="zero">—</span>'}</td>
        <td class="${d > 0.05 ? 'up' : d < -0.05 ? 'down' : 'zero'}">${Math.abs(d) < 0.05 ? '—' : sgn(d, 1)}</td>
      </tr>`;
    }).join('')}
  </tbody><tfoot><tr><td>${rows.filter((r) => r.x > 0).length} holdings</td><td></td>
    <td>${f(pick().m.fee, 3)}%</td><td>${f(pick().m.grossYield, 2)}%</td>
    <td>100.0</td><td>100.0</td>
    <td>${f(pick().m.turnover, 0)}% turn</td></tr></tfoot></table>
  <p class="foot">Δ is the change in portfolio weight, in percentage points. Turnover is
  one-way: ${f(pick().m.turnover, 0)}% of the portfolio has to be traded, and in a taxable
  account every sale here is a realised gain. Minimum position ${L.minPos}%, maximum ${L.maxPos}%.</p>`;
}

function kpis(m: Metrics) {
  const row = (lab: string, a: number, b: number, d = 2, suf = '%', better = 1) => {
    const dd = b - a;
    const cls = Math.abs(dd) < 5e-3 ? 'zero' : (dd * better > 0 ? 'up' : 'down');
    return `<div class="lab">${lab}</div><div class="v">${f(a, d)}${suf}</div>
            <div class="v">${f(b, d)}${suf}</div>
            <div class="v ${cls}">${Math.abs(dd) < 5e-3 ? '—' : sgn(dd, d)}</div>`;
  };
  return `<div class="kpi">
    <div class="h">Measure</div><div class="h">Today</div><div class="h">Proposed</div><div class="h">Δ</div>
    ${row('Running cost (weighted OCF)', cur.fee, m.fee, 3, '%', -1)}
    ${row('Gross distribution yield', cur.grossYield, m.grossYield, 2, '%', 1)}
    ${row('After-tax yield', cur.netYield, m.netYield, 2, '%', 1)}
    ${row('Tax drag on income', cur.taxDrag, m.taxDrag, 2, '%', -1)}
    ${row('US exposure', cur.usPct, m.usPct, 1, '%', -1)}
    ${row('Growth / risk assets', cur.equityPct, m.equityPct, 1, '%', 0)}
    ${row('Fixed income', cur.bondPct, m.bondPct, 1, '%', 0)}
    <div class="note">Realised over ${ctx.b.window.start} → ${ctx.b.window.end} ↓</div>
    ${row('Volatility (annualised)', cur.vol, m.vol, 1, '%', -1)}
    ${row('Total return (annualised)', cur.cagr, m.cagr, 2, '%', 1)}
    ${row('Worst drawdown', cur.maxDD, m.maxDD, 1, '%', 1)}
    ${row('Effective no. of holdings', cur.effN, m.effN, 1, '', 1)}
    <div class="note">Cost and yield are forward-looking (stated fees, assumed yields).
      Volatility, return and drawdown are realised history over the window above and
      say nothing about the next fifteen years.</div>
  </div>`;
}

function card(a: typeof alts[number]) {
  const m = a.m;
  const chip = (ok: boolean, t: string) => `<span class="pill ${ok ? 'g' : 'r'}">${t}</span>`;
  const feeOk = m.fee <= ASK.fee + 1e-9, usOk = m.usPct <= ASK.us + 1e-6,
        incOk = m.grossYield >= cur.grossYield - 1e-9;
  const n = [feeOk, usOk, incOk].filter(Boolean).length;
  return `<div class="alt ${a.key === chosen ? 'on' : ''}" data-k="${a.key}">
    <div class="t">${a.title}<span class="pill ${n === 3 ? 'g' : ''}">${n}/3 asks met</span></div>
    <div class="d">${a.desc}</div>
    <div class="s">
      <span>Cost <b>${f(m.fee, 3)}%</b> ${chip(feeOk, feeOk ? 'ok' : 'over')}</span>
      <span>Income <b>${f(m.grossYield, 2)}%</b> ${chip(incOk, incOk ? 'held' : sgn(m.grossYield - cur.grossYield, 2) + 'pp')}</span>
      <span>US <b>${f(m.usPct, 1)}%</b> ${chip(usOk, usOk ? 'ok' : 'over')}</span>
      <span>Turnover <b>${f(m.turnover, 0)}%</b></span>
    </div></div>`;
}

function curve(label: string, rows: { cap: number; y: number; ok: boolean }[],
               fmt: (r: { cap: number }) => string, mark: number) {
  const target = cur.grossYield;
  const lo = Math.min(...rows.map((r) => r.y), target) - 0.2;
  const hi = Math.max(...rows.map((r) => r.y), target) + 0.2;
  return `<table><thead><tr><th>${label}</th><th>Best gross yield</th>
      <th>vs income line</th><th style="width:46%"></th></tr></thead><tbody>
    ${rows.map((r) => {
      const d = r.y - target;
      const at = Math.abs(r.cap - mark) < 1e-9;
      return `<tr style="${at ? 'background:rgba(106,168,255,.09)' : ''}">
        <td><span class="tk">${fmt(r)}</span>${at ? ' <span class="pill">client ask</span>' : ''}</td>
        <td>${f(r.y, 2)}%</td>
        <td class="${d >= -0.005 ? 'up' : 'down'}">${sgn(d, 2)} pp</td>
        <td><span class="bar" style="width:${((r.y - lo) / (hi - lo)) * 100}%;
             background:${d >= -0.005 ? 'var(--ok)' : 'var(--bad)'}"></span></td>
      </tr>`;
    }).join('')}
  </tbody></table>`;
}

function chart(w: Weights) {
  const W = 660, H = 230, P = 34;
  const a = backtest(ctx, w).path, b = backtest(ctx, ctx.b.client).path;
  const d = ctx.b.dates;
  const n = a.length;
  const lo = Math.min(...a, ...b), hi = Math.max(...a, ...b);
  const X = (i: number) => P + (i / (n - 1)) * (W - P - 8);
  const Y = (v: number) => H - 20 - ((v - lo) / (hi - lo)) * (H - 44);
  const path = (s: number[]) => s.map((v, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join('');
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => Math.round(t * (n - 1)));
  const gl = [lo, (lo + hi) / 2, hi];
  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto">
    ${gl.map((v) => `<line x1="${P}" x2="${W - 8}" y1="${Y(v)}" y2="${Y(v)}" stroke="#2a323d"/>
      <text x="2" y="${Y(v) + 3}">${Math.round(v)}</text>`).join('')}
    ${ticks.map((i, k) => `<text x="${X(i)}" y="${H - 5}" text-anchor="${k === 0 ? 'start' : k === ticks.length - 1 ? 'end' : 'middle'}">${d[i]}</text>`).join('')}
    <path d="${path(b)}" fill="none" stroke="#93a0b1" stroke-width="1.6"/>
    <path d="${path(a)}" fill="none" stroke="#6aa8ff" stroke-width="2"/>
    <text x="${W - 10}" y="${Y(a[n - 1]) - 6}" text-anchor="end" fill="#6aa8ff"
      style="font-size:11px;font-weight:600">${Math.round(a[n - 1])}</text>
    <text x="${W - 10}" y="${Y(b[n - 1]) + 14}" text-anchor="end" fill="#93a0b1"
      style="font-size:11px;font-weight:600">${Math.round(b[n - 1])}</text>
  </svg>`;
}

function controls() {
  const s = (id: string, lab: string, v: number, min: number, max: number, step: number, unit: string) =>
    `<div><label>${lab} <b id="${id}v">${f(v, step < 0.01 ? 3 : step < 1 ? 2 : 0)}${unit}</b></label>
     <input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${v}"></div>`;
  return `<div class="ctl">
    ${s('fee', 'Cost ceiling', L.feeCap, 0.10, 0.40, 0.005, '%')}
    ${s('inc', 'Income floor (gross yield)', L.incomeFloor, 2, 7, 0.05, '%')}
    ${s('us', 'US ceiling', L.usCap, 40, 100, 1, '%')}
    ${s('vol', 'Volatility ceiling', L.volMax, 5, 16, 0.25, '%')}
    ${s('mx', 'Max single position', L.maxPos, 10, 40, 1, '%')}
    <div><label>Funds the advisor will not use — click to exclude</label>
      <div class="chips">${ctx.b.products.map((p) =>
        `<span class="chip ${L.excluded.has(p.ticker) ? 'off' : ''}" data-x="${p.ticker}">${p.ticker}</span>`).join('')}</div></div>
    <div style="display:flex;gap:8px">
      <button class="pri" id="go">Re-solve</button>
      <button id="reset">Reset to client's asks</button>
    </div>
    <p class="foot">Once the constraints are satisfied the search maximises
      <b>after-tax income</b>, with a bonus for genuine diversification (effective holdings)
      and a penalty on turnover — a taxable account should not be churned to win basis points.
      It is a random-restart local search over the 16-fund simplex, so re-solving can move the
      answer by a few tenths; the constraint results do not move.</p>
  </div>`;
}

function assumptions() {
  return `<details open><summary>Yields are an assumption, not data — here they are, and you can change them</summary>
  <p class="foot" style="margin:0 0 12px">
    <code>prices.csv</code> is adjusted close on a <b>total-return</b> basis, so distributions are
    already reinvested into the series and no income stream can be separated out of it. Every
    yield below is therefore a stated, indicative trailing-12-month assumption by strategy type —
    edit any of them and re-solve. Fees come straight from <code>products.csv</code>. Tax
    character drives the after-tax column: covered-call premium and bond coupons are ordinary
    income, equity dividends are qualified, JMST is federally exempt.</p>
  <p class="foot" style="margin:0 0 12px"><b>Why the return window is only
    ${f(ctx.b.window.years, 1)} years, not the five in the file.</b> Every risk and return
    figure on this page is measured over the window all sixteen funds share, so the two
    portfolios are compared on identical days. That window is
    <b>${ctx.b.window.start} → ${ctx.b.window.end}</b>, pinned at the front by JBND
    (first price ${ctx.b.coverage['JBND'].first}) and at the back by JAGG, whose series in
    <code>prices.csv</code> stops on ${ctx.b.coverage['JAGG'].last} — six weeks short of the
    file's last date. It covers no full equity bear market. Do not quote the return figures as
    a five-year track record; they are not one.</p>
  <table><thead><tr><th>Fund</th><th>Role</th><th>Fee</th><th>Yield %</th>
    <th>Ordinary</th><th>Qualified</th><th>Exempt</th><th>After tax</th><th>Price history</th><th>Note</th></tr></thead><tbody>
  ${ctx.b.products.map((p) => {
    const a = ctx.b.assumptions[p.ticker]; const y = ctx.yields[p.ticker];
    const net = y * (a.ordinary * (1 - ctx.taxRates.ordinary) + a.qualified * (1 - ctx.taxRates.qualified) + a.exempt);
    return `<tr><td><span class="tk">${p.ticker}</span></td><td class="nm" style="text-align:left">${p.role}</td>
      <td>${f(p.er, 2)}%</td>
      <td><input type="number" step="0.1" min="0" value="${y}" data-y="${p.ticker}"></td>
      <td class="nm">${Math.round(a.ordinary * 100)}%</td><td class="nm">${Math.round(a.qualified * 100)}%</td>
      <td class="nm">${Math.round(a.exempt * 100)}%</td><td>${f(net, 2)}%</td>
      <td class="nm">${ctx.b.coverage[p.ticker].first} → ${ctx.b.coverage[p.ticker].last}</td>
      <td class="nm" style="text-align:left">${a.note}</td></tr>`;
  }).join('')}</tbody></table></details>`;
}

// ------------------------------------------------------------------ events

function wire() {
  document.querySelectorAll<HTMLElement>('.alt').forEach((el) =>
    el.onclick = () => { chosen = el.dataset.k!; render(); });
  document.querySelectorAll<HTMLElement>('.chip[data-x]').forEach((el) =>
    el.onclick = () => {
      const t = el.dataset.x!;
      if (L.excluded.has(t)) L.excluded.delete(t); else L.excluded.add(t);
      el.classList.toggle('off');
    });
  const bind = (id: string, k: keyof Limits, d: number, unit: string) => {
    const el = document.getElementById(id) as HTMLInputElement | null;
    if (!el) return;
    el.oninput = () => {
      (L as any)[k] = Number(el.value);
      document.getElementById(id + 'v')!.textContent = f(Number(el.value), d) + unit;
    };
  };
  bind('fee', 'feeCap', 3, '%'); bind('inc', 'incomeFloor', 2, '%');
  bind('us', 'usCap', 0, '%'); bind('vol', 'volMax', 2, '%'); bind('mx', 'maxPos', 0, '%');
  document.querySelectorAll<HTMLInputElement>('input[data-y]').forEach((el) =>
    el.onchange = () => { ctx.yields[el.dataset.y!] = Number(el.value); });
  const go = document.getElementById('go');
  if (go) go.onclick = () => { $('.wrap').classList.add('busy');
    setTimeout(() => { cur = metrics(ctx, ctx.b.client); recompute(); }, 20); };
  const rs = document.getElementById('reset');
  if (rs) rs.onclick = () => {
    L.feeCap = ASK.fee; L.usCap = ASK.us; L.incomeFloor = cur.grossYield;
    L.volMax = cur.vol * 1.10; L.maxPos = 25; L.excluded = new Set();
    $('.wrap').classList.add('busy'); setTimeout(recompute, 20);
  };
}

boot();
