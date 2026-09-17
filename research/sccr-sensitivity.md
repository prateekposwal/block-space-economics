# SCCR sensitivity, confidence intervals, and a stress test

<!-- seo-title: SCCR Sensitivity Bands and Confidence Intervals -->

**BSAHI — SCCR hardening (P2)**
*Produced: 2026-09-17 · Instrument: `tools/research/sccr_sensitivity.py`*

## Headline

The current reading is **SCCR 0.2883** (2026-09-17, 140 blocks, N=32,000, T=10, C=$925).
Across the assumption grid the index spans **0.028 – 3.413** (median 0.288), and stays
**below 1.0 in 22 of 27 combinations (81.5%)** — it crosses only at the corner most favourable to coverage (high N, long T, high C).

**The node count N dominates the uncertainty** (10.0× across the tested range), so the honest
statement is "SCCR is below 1× across essentially all plausible assumptions, dominated by uncertainty in N".

## Why the sensitivity is exact, not simulated

The SCCR is analytic in its assumptions:

```
R_blocks = 365.25 × 24 × 6               (blocks/year)
L_net    = N × T × C / R_blocks           (USD/block)
SCCR     = fee_USD_per_block / L_net
```

So SCCR is **inverse-linear in N, T and C**, and linear in the fee. The bands are exact for
the stated ranges; no Monte-Carlo approximation is needed for the *grid*. (A bootstrap is
used only for the *distribution* CI below, where it is the right tool.)

## 1. Assumption grid (N × T × C)

| N (nodes) | T (yr) | C (USD) | L_net (USD/block) | SCCR | vs 1× |
|---|---|---|---|---|---|
| 10,000 | 5 | $500 | 475 | **3.413** | **above** |
| 10,000 | 5 | $925 | 879 | **1.845** | **above** |
| 10,000 | 5 | $1500 | 1,426 | **1.138** | **above** |
| 10,000 | 10 | $500 | 951 | **1.707** | **above** |
| 10,000 | 10 | $925 | 1,759 | **0.922** | below |
| 10,000 | 10 | $1500 | 2,852 | **0.569** | below |
| 10,000 | 20 | $500 | 1,901 | **0.853** | below |
| 10,000 | 20 | $925 | 3,517 | **0.461** | below |
| 10,000 | 20 | $1500 | 5,704 | **0.284** | below |
| 32,000 | 5 | $500 | 1,521 | **1.067** | **above** |
| 32,000 | 5 | $925 | 2,814 | **0.577** | below |
| 32,000 | 5 | $1500 | 4,563 | **0.355** | below |
| 32,000 | 10 | $500 | 3,042 | **0.533** | below |
| 32,000 | 10 | $925 | 5,628 | **0.288** | below |
| 32,000 | 10 | $1500 | 9,126 | **0.178** | below |
| 32,000 | 20 | $500 | 6,084 | **0.267** | below |
| 32,000 | 20 | $925 | 11,256 | **0.144** | below |
| 32,000 | 20 | $1500 | 18,252 | **0.089** | below |
| 100,000 | 5 | $500 | 4,753 | **0.341** | below |
| 100,000 | 5 | $925 | 8,793 | **0.184** | below |
| 100,000 | 5 | $1500 | 14,260 | **0.114** | below |
| 100,000 | 10 | $500 | 9,506 | **0.171** | below |
| 100,000 | 10 | $925 | 17,587 | **0.092** | below |
| 100,000 | 10 | $1500 | 28,519 | **0.057** | below |
| 100,000 | 20 | $500 | 19,013 | **0.085** | below |
| 100,000 | 20 | $925 | 35,174 | **0.046** | below |
| 100,000 | 20 | $1500 | 57,039 | **0.028** | below |

## 2. Distribution and confidence interval

From the frozen reproduction capture — **155 real blocks** (not a model):

| statistic | value |
|---|---|
| mean | 0.2406 |
| median | 0.1933 |
| IQR | 0.1158 – 0.2954 |
| P5–P95 | 0.0687 – 0.5831 |
| min–max | 0.0490 – 1.0757 |
| **bootstrap 95% CI for the mean** | **0.2131 – 0.2707** |

legitimate CI for the mean of a real 155-block sample; NOT a claim about the population of all blocks. (bootstrap n=10000, seed 20260917).

## 3. Stress test — which assumption dominates

| assumption | range tested | SCCR at low | SCCR at high | spread |
|---|---|---|---|---|
| N | 10,000–100,000 | 0.922 | 0.092 | **10.0×** |
| T | 5–20 | 0.577 | 0.144 | **4.0×** |
| C | 500–1,500 | 0.533 | 0.178 | **3.0×** |

**Verdict:** SCCR is below 1.0 in 22/27 combinations; it crosses only at the most favourable-for-coverage corner (high N, long T, high C).

## Reproduction (copy-paste)

```bash
# the full sensitivity + CI + stress test, deterministic
python3 tools/research/sccr_sensitivity.py
# the per-block reproduction that feeds the distribution (JS = Python = C)
bash research/reproduce/cross_check.sh
```

The script reads `data/sccr.json` (the dated reading) and the frozen kit output,
so both the grid and the CI are reproducible from the repository alone.

## What this does and does not claim

- **Does:** quantify exactly how the index moves with each assumption; give a
  legitimate CI for the mean of the measured per-block sample.
- **Does not:** describe the population of all blocks (the CI is for the sample
  mean), or claim an SCCR point estimate independent of N — N is the dominant
  unknown, and that is stated, not hidden.
