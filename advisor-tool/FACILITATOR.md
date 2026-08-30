# Facilitator note — the advisor's tool

**Keep this out of the workspaces.** Each brief tells the model its folder is the
entire world; this file sits one level up.

## What this run is

Four models, four identical folders, ten minutes, one goal: *help the advisor manage
this client's portfolio better.* Ten asks came out of a workshop, unsorted. They
cannot all be built, and the brief says so.

**What is being watched is which asks each model judged worth building, and whether
the numbers survive being checked.** Not feature count.

Two things changed from the last run, both because of what it exposed:

- **Nothing on the list requires an invented number any more.** The old briefs
  planted items the data couldn't answer (income with no yields, rate regimes with
  no rate series). That rewarded refusal and taught every model to say "no data."
  Every ask here is computable from `data/`, and the brief says outright: use what
  you are given, label any assumption on screen.
- **The client portfolio now carries market value and cost basis.** Previously
  models invented an account size — $100, $100k, $1m and $2m across runs — which
  made every dollar figure incomparable. It is now a **$2.4m taxable account with
  $312k of unrealised gain.**

## The answer key

This is what a strong submission looks like. It is a hypothesis, not a rubric — if a
model builds something better that isn't here, that is the most interesting result
available and worth more than matching this list.

The advisor's real job with this book is to answer two questions: **what is this
costing, and is it working?** A strong tool answers both in a form that can be
turned around and shown to a client.

1. **Cost in dollars, not basis points.** The blended fee is 0.326% — which means
   nothing to anyone. **$7,824 a year on $2.4m** is the same fact in a form that
   lands. Ask 7 extends it over the horizon. A tool that only shows a percentage has
   not answered the question.
2. **"Is it working" resolved into a comparison.** A return figure alone has no
   referent. Ask 4 is where this lives — but only if it produces an answer, not a
   scatter plot. Nine thousand random portfolios is a construction tool, not
   something you show a client.
3. **The honest window (ask 10).** Every performance figure is about to be repeated
   out loud. See below.
4. **A view.** The goal says *manage better*, which implies doing something. A tool
   that only displays leaves the advisor exactly where they started.

**The chain that separates the field is 7 → 8 → 9:** what you're paying, how to pay
less, what it costs to get there. A weak submission builds those as three unrelated
panels. A strong one connects them.

## The tension planted in the cost basis

This is the best thing in the data and it is worth finding on screen:

| holding | value | unrealised | fee |
|---|---|---|---|
| **JCPB** | $288,000 | **−$22,000** | 0.38% — dearest bond fund on the shelf |
| **JEPQ** | $360,000 | **+$120,000** | 0.35% |
| JGRO | $288,000 | +$98,000 | 0.44% |
| BBRE | $192,000 | −$13,000 | 0.11% |

**The cheap win and the right win are different moves.** Swapping JCPB for JAGG
(0.38% → 0.07%) is nearly free *and* harvests a $22k loss. But the bigger problem
with this book is arguably the 35% sitting in covered-call income sold to someone
fifteen years from drawing — and trimming JEPQ realises $120k of gain.

Ask the room: *which of these tools would have shown you that, and which would have
let you walk into the meeting recommending the expensive trade?*

## The trap that has survived five runs

Ask 10 — *what date range every figure covers, and why.* Nine of the sixteen funds
launched after the price history starts, and JAGG stops five weeks before the
others. The client's book holds JAGG, so it cannot honestly be quoted
current-to-date.

Previous runs produced: a return quoted **3.6 points too high** (window start
handled, end ignored); a hard-coded date range with an invented rationale attached;
and a price matrix so misaligned that **27% of the client's daily returns were NaN**
while the screen looked complete.

The brief now asks for a self-check — *put 100% into one fund and reproduce that
fund's own return*. On last run's worst submission that check fails on every fund,
one with the wrong sign and one blank. **Look for whether the check is on the page,
and whether it passes.**

## Running it

```
cd <workspace> && ./run.sh serve      # prints its URL
```

claude-opus 7600–7609 · kimi3 7700–7709 · inkling 7800–7809 · glm 7900–7909. All
four can serve at once. (Avoid 5000 and 7000 — macOS AirPlay holds both.)

The brief now tells each model to **leave its service running and verify it is up**
before writing the summary, so `SUMMARY.html` should link straight through to a live
page. If a link is dead, that is a finding, not a setup problem.

- **Plug the laptop in**, or run `caffeinate`. A previous session lost 37 minutes to
  idle sleep on battery, mid-build.
- Stagger the launches a few seconds apart.
- Each `SUMMARY.html` records the model's own `date +%s` at start and finish — that
  is your real elapsed time, including the thinking before the first file, which
  file timestamps cannot show.

## Things worth asking the room

- Which of these would you let an advisor take into a client meeting on Monday?
- Look at what each one refused to build. Do you agree with the call?
- What is this client paying? Which tools told you in money, and which in percent?
- Pick the most impressive number on any screen and ask where it came from.
- One of these was built by a model anyone can download and run on their own
  hardware. Which one do you think it was?
