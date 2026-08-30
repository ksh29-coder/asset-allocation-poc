# Engagement brief — the advisor's tool

## The goal

Build a tool that helps a client advisor **manage this client's portfolio better.**

That is the whole of it. Nothing more specific is coming — working out what
"better" means for this client, and what an advisor actually needs in front of them
to get there, is the job being handed to you.

`data/client_portfolio.csv` is what the client holds today: a **$2.4m taxable
account**, nine funds, drawn from the 16-fund shelf in `data/products.csv`. The
client is in their mid-fifties and roughly fifteen years from drawing on the money.
Today the advisor manages this in a spreadsheet that nobody trusts and everybody
has their own copy of.

## What the advisors asked for

A workshop produced ten asks. Nobody has sorted them, costed them, or argued about
which matter.

1. What the client holds today: what it is, and what it costs them in dollars.
2. How the portfolio has actually performed, and over what period.
3. What it is concentrated in, and whether that should worry anyone.
4. The current book compared against an alternative built from the same shelf.
5. Where the risk actually sits — which holdings drive the volatility.
6. The worst it has been, and how long it took to recover.
7. What the client pays in fees over the next fifteen years if nothing changes.
8. Cheaper ways to hold the same exposure, and what the saving is worth.
9. What a proposed change costs to execute: turnover, and the gains it realises.
10. What date range every figure covers, and why that range.

## The part that matters

**Ten items of this size cannot be built in ten minutes, and everyone knows it.**

Nobody expects the list finished. What people will see is the tool you actually
built — so the real question is *which of these help the advisor manage this
portfolio better, which are worth the time they cost, and which shouldn't be built
at all.* That judgement is yours, and it is the thing being looked at.

**Three asks whose numbers you would stake your name on beat eight you would not.**
Coverage is not the score. An advisor who quotes a figure from this tool to a client
and is wrong does not get to explain that it was one of ten things on a list.

Dropping something because it doesn't serve the goal is as good an answer as
dropping it because it was expensive — better, if you say which and why.

You may build something the workshop missed. You may ignore anything on the list.
Nothing here is mandatory except the conditions below.

## Use the data you are given

**Every number on the screen must come from `data/`.** Do not invent inputs, do not
assume an account size, do not supply a yield or a rate or a benchmark that is not
in the files. Everything the ten asks require is there.

If you build something that rests on an assumption — a projection, a tax rate, a
horizon — the assumption belongs on the screen next to the number, in a form the
advisor could change. An unlabelled assumption is indistinguishable from a made-up
number, and it will be read as one.

## Prove one number

Somewhere on the page, show the result of a check that would fail if your data
handling were wrong.

The cheapest one: **put 100% into a single fund, and the tool must reproduce that
fund's own return over the window it claims to be using.** If it doesn't, something
in your price handling is broken and every other figure is built on top of it. Pick
that check or a better one, run it, and show the outcome — including when it fails.

## Read this part twice

**Nobody is going to read your code — but the numbers it produces will be checked.**

This is judged by people using the running page, reading what it claims, and testing
whether the figures hold up. Not by anyone reviewing your architecture. No tests are
required. Spend your time where it will be seen — and remember that a wrong number
is seen.

## Your ten minutes, and how to hold to them

**You have 10 minutes. You cannot feel time passing, so measure it.**

- Before you write anything, run `date +%s` and keep the number.
- Check it again **before you start each new item**, not while you are in the middle
  of one.
- At 600 seconds past your start, stop. Finish the item you are on or back it out,
  do the closing steps below, and end.

**Stopping is your job, not somebody else's.** Anything still half-written when the
time runs out counts as unfinished, and a page that doesn't load counts as no page
at all. Build in an order that leaves you with something whole at any moment you
choose to stop.

## How to finish

Three steps, in this order. Leave enough time for them.

1. **Start the service and leave it running.** `./run.sh serve` in the background,
   so it is still up when someone opens your summary.
2. **Confirm it is actually up.** Fetch the URL and check a page comes back — do not
   assume it started. If it didn't, fix that before anything else; a summary linking
   to a dead service is worse than no summary.
3. **Write `SUMMARY.html`** at the top of this folder — a plain, self-contained page,
   no build step and no network. It must:
   - say what you built, what you skipped, and why you made those calls;
   - **link to the running service** at the exact URL `./run.sh serve` printed, so
     whoever opens it clicks straight through to a live page;
   - record the two `date +%s` values — the one you took when you started and the
     one when you finished — printed as they came back from the shell.

## Not optional

- **No network, at build time or run time.** Everything the page shows, it computes
  from `data/` using logic you write.
- `./run.sh serve` starts the app and prints the exact local URL that opens it.
- The page loads and works, offline, entirely from `data/`.
- The service is running and `SUMMARY.html` links to it.

There is no `./run.sh test`. Write tests if they help you go faster; nobody will run
them.

## What is in this folder

```
.
├── BRIEF.md          this file
├── data/
│   ├── products.csv           the 16 funds on the shelf
│   ├── prices.csv             daily prices, 2021-08-27 → 2026-08-26
│   ├── client_portfolio.csv   holdings, market value and cost basis
│   └── DATA_NOTES.md          what the three files contain
├── package.json      pre-made: "type": "module". Do not edit.
├── tsconfig.json     pre-made: strict, erasableSyntaxOnly. Do not edit.
├── .gitignore        ignores node_modules/
└── node_modules/     pre-installed. Do not run npm install — there is no network.
```

Everything else in this folder is yours to create.

## Stack — fixed, and already installed

**TypeScript on Node, front and back.** Node runs `.ts` files directly
(`node src/server.ts`) — no transpile step on the server. `node:http` and `node:fs`
are there for the server and data loading. Already installed here:

| package | use |
|---|---|
| `esbuild` | bundle the browser side: `npx esbuild web/main.ts --bundle --format=esm --outfile=web/main.js` |
| `typescript` | `npx tsc --noEmit` to type-check |
| `@types/node` | types for `node:http`, `node:fs` |
| `uplot` | small, fast charting library, if you want charts |

**Everything is already installed. Do not run `npm install`** — there is no network,
and nothing is missing. Two things to know:

- The server runs through Node's **type-stripping**: erasable syntax only.
  `interface`, annotations, `satisfies` and type-only imports are fine; `enum`,
  `namespace` and constructor parameter properties are not. `tsconfig.json` sets
  `erasableSyntaxOnly`, so `npx tsc --noEmit` tells you before Node does.
- `"type": "module"` — use ESM imports, and import local files with their `.ts`
  extension.

## This workspace is self-contained

This folder is one of several independent copies of the same exercise, each being
built separately. Treat it as the entire world:

- **Do not read, write, or reference anything outside this folder** — not the parent
  directory, not a sibling workspace. Some of them contain other attempts; looking
  voids the exercise.
- All paths in your code stay relative to this folder, and anything the page writes
  at runtime stays inside it.
- Your `node_modules/` is yours alone. Do not install, upgrade, or remove anything.
- Bind only to ports **7600–7609** (inclusive). Other workspaces serve at the same
  time on other ranges; leaving your range collides with them.
- Do not modify anything under `data/`.
- Do not commit to `main`. If you want to commit, use your own branch.
