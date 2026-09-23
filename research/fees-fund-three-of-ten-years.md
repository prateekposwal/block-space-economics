# Fees Fund Three of the Ten Modelled Years

**BSAHI — interpretation note**
*Produced: 2026-09-23*

## What the SCCR does and does not say

The Storage Cost Coverage Ratio is **0.4307** — an upper bound. That number is easy
to over-read. It does **not** say "Bitcoin is 57% underfunded," and it does not say
"nobody is paying for nodes."

What it says, in one sentence: **on the current fee basis, fees fund roughly the
first 3 of the 10 modelled years of the node-cost commitment, and the remainder is
carried by whoever runs a node.**

## What the model actually claims

The SCCR is a ratio of one fee reading to a multi-year commitment:

```
SCCR  = fees / L_net        L_net = N · C · T
```

where `N` = the reachable-node count (a floor), `C` = annual node operating cost
($925/yr), and `T` = 10 years. So the denominator is the network-wide node cost
**over a decade**, and the numerator is **one** fee reading. The ratio is therefore
a coverage fraction of that commitment, not a solvency verdict.

Per block, 2026, all on one fee basis (measured 30-day mean, ~$1,417/block):

| claim on fees | USD/block | covered by fees |
|---|---:|---:|
| Security / production (energy to produce a block) | $198,549 | 0.7% (subsidy pays 107.3%) |
| **Node-cost commitment** (`L_net` = N·C·T, T=10yr) | **$4,676** | **30.3%** |
| Node operating cost, **one year** of the same thing | $467.57 | 303.0% |

At 30.3% of a ten-year commitment, fees cover **~3.0 years**. That is the finding.

## A trap in that table — and why it is worth naming

Those last two rows are **the same cost at different horizons**. `L_net` is exactly
`node_opex × T` (measured ratio 10.001), so their coverage percentages differ by
exactly `T` (30.3% × 10 = 303.0%). They are one fact, not two.

We nearly published them as two. The version of this note I first drafted argued
*"fees cover node operation but not permanence."* **That is an artifact.** There is
no separate permanence term in the model — permanence *is* the multi-year node cost.
Reading the pair as "opex covered, permanence not" is a horizon illusion, and the
table invited it by showing a 1-year and a 10-year figure side by side unlabelled.

Both the table and the headline now say so explicitly, because the next person to
read those two rows will make the same mistake.

## Who carries the remainder

The uncovered ~70% is not absorbed by the fee market. It lands on the node classes
that actually hold the data — public and private/non-listening nodes alike. Every
hidden node independently bears the replication and validation burden, so the
measured floor makes the true coverage *lower*, not higher.

Two other classes receive the verification guarantee without carrying it:
institutional infrastructure (exchanges, custodians — partially, and internally)
and delegated/lightweight users (not at all, and not observable in the P2P layer).
See the verification-population observatory for why those two cannot be measured
from this vantage.

## Two caveats that must travel with the number

- **The fee window matters, and it is named.** The SCCR is a live reading on its own
  block window (137 blocks, 2026-09-23), which implies ~$2,014/block. On the 30-day
  mean (~$1,417/block) the storage coverage is 30.3%; on the SCCR's own window it is
  43.1%. Both are true. Quoting one as "the" coverage while the other is the headline
  is a category error, so the coverage table uses one basis and the SCCR is reported
  separately.
- **This is time-varying, not a constant.** SCCR is driven by the fee market, which
  moves. The 3-of-10 figure is the current reading, not a fixed property.

## What this does not say

It is not a claim that Bitcoin is failing, nor that anyone *should* pay differently.
It is a measurement of which layer the fee market currently funds and which it
leaves to node operators. The interesting question is the second one — and it is
answerable, which is why the distinction is worth keeping sharp.

## Data

- `data/fee_allocation.json` — the three claims, one fee basis, and the horizon note.
- `data/sccr.json` — the live SCCR reading and its own window.
- `research/sccr-sensitivity.md` — why N dominates the uncertainty and why the
  baseline is a strict floor.
