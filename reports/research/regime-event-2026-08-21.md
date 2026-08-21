# Regime Event — SCCR 0.16 → 0.44: The Fee Market's Storage Coverage, Measured Live

**Published:** 2026-08-21 · **Source:** live `/data/sccr_history.json` series (canonical
GH research-data producer — mempool.space 24h public fee endpoint → `sccr_live.py --frozen`,
spec v2.1.0, N=32K lower-bound census, T=10yr).

## Headline
> **SCCR rose from ~0.16 to ~0.44 in roughly 4–5 days — the fee market's storage coverage
> doubled-then-nearly-tripled, measured live on real blocks.**

"Storage Cost Coverage Ratio" = transaction fees ÷ modeled 10-year storage cost across the
real 32K-node census. Below 1.0 = fees do not cover what the data costs the network. The
fee market's storage coverage is a live, dated quantity — and it just moved sharply.

## The measured series (last 8 points, from the live record)
| Date | avg_SCCR | blocks | below 1× |
|------|----------|--------|----------|
| 2026-08-14 | 0.2378 | 148 | 99.3% |
| 2026-08-15 | 0.2095 | 147 | 99.3% |
| 2026-08-16 | **0.1574** (recent low) | 154 | 100% |
| 2026-08-17 | 0.1830 | 164 | 100% |
| 2026-08-18 | 0.2232 | 149 | 100% |
| 2026-08-19 | 0.3187 | 119 | 100% |
| 2026-08-20 | 0.4059 | 126 | 98.4% |
| 2026-08-21 | **0.4433** | 133 | **96.2%** |

**Bottom line:** avg SCCR is up **~2.8×** from its 5-day low (0.1574 → 0.4433). The share of
blocks below the full-coverage 1× threshold has correspondingly dropped from 100% to **96.2%**
— i.e. the fee market is now pricing a larger fraction of the storage externality than it was
a week ago, and doing so while coverage climbs.

## Why it matters (factual reading, no spin)
- This is the **first sustained break above the ~0.22–0.29 band** that characterized the
  Aug 02–15 record into a new, higher regime. That band was the historical *baseline* for the
  unpriced-storage-externality thesis; today's reading is material evidence that the gap is
  **fee-market-driven and time-varying**, not a fixed constant.
- The reference columns are all real: `data/sccr_history.json` (14 points, 08-02→08-21) and
  `data/sccr_latest.json` (avg 0.443333, below_1x 128/133 = 96.24%).
- Methodological honesty: N=32K is a **lower-bound** census (08-02); T=10yr is an assumption;
  the ratio reflects fee pressure, not a change in storage physics.

## Provenance
```
source  : /data/sccr_history.json + /data/sccr_latest.json (live, bitcoinsahi.com)
writer  : .github/workflows/research-data.yml → tools/generate_research_data.js --only sccr
model   : sccr_live.py --frozen, spec v2.1.0
verified: curl https://bitcoinsahi.com/data/sccr_history.json → count 14, matches origin/main
```
