# The Externality Is Growing — SCCR Trend, Week of Aug 2026

**Status:** RESEARCH NOTE (2026-08-11) · **Program:** Bitcoin Resource Accounting
**Companion:** `research/working-paper.md`, `research/cost-to-flood.md`
**Source:** live SCCR measurements (model-spec v2.1.0, N=32K census)

---

## The finding

The Storage Cost Coverage Ratio is **falling**. In one week it dropped from
~0.26 to **0.17** — transaction fees are covering less and less of the modeled
storage cost that confirmed data imposes on the network.

| Date | Avg SCCR | Blocks sampled |
|---|---|---|
| 2026-08-02 | 0.2186 | 171 |
| 2026-08-03 | 0.2840 | 137 |
| 2026-08-04 | 0.2611 | 159 |
| **2026-08-10** | **0.1704** | 150 |

## Why this matters

The SCCR is the ratio of fees paid to the estimated 10-year storage cost. When
it falls, the **unpriced externality is growing** — each block's data costs the
network more relative to what the fee market pays for it.

This is the direction the paper's thesis predicts in a **cooling fee market**:
- Fees fall with congestion (fee-floor regime: ~1-2 sat/vB)
- Storage cost stays constant (the bytes are already committed)
- So the ratio drops — the gap between "what the fee pays" and "what the data
  costs" widens

This is also the **attacker-side implication** from `cost-to-flood.md`: in a
low-fee regime, flooding the chain gets *cheaper per byte* while the storage it
imposes stays the same — the leverage ratio **rises** as fees fall.

## Not a defect — a measurement

We are not claiming this is broken. The SCCR is a measurement of a pricing gap;
a falling value is the model working as intended — **tracking the growing
unpriced residue** that the paper exists to quantify. The trend is the
contribution: the externality is *not static*, it moves with the fee market,
and right now it is moving away from coverage.

## Open question this raises

If fees keep falling and the ratio keeps dropping, at what point does the
unpriced storage cost become a *binding* constraint on node operation? The
paper's §5.4 knife-edge (the strong claim inverts at N≈49K or BTC≈$77K) and
`cost-to-flood.md` (leverage 3.0×) bracket this — the falling trend moves
*along* those bounds.

## DONE vs LEFT

**DONE:** the trend note; the data is live-measured daily.
**LEFT:** wire this as the research headline on the site (Data Story / Articles);
watch the trend daily (the agent captures it).

---

*Bitcoin Sahi Research — The Externality Is Growing (SCCR trend note), 2026-08-11.*
