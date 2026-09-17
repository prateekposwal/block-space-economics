# SCCR sensitivity, confidence intervals, and a stress test

<!-- seo-title: SCCR Sensitivity Bands and Confidence Intervals -->

**BSAHI — SCCR hardening (P2)**
*Refreshed: 2026-09-17 · Instrument: `tools/research/sccr_sensitivity.py`*

## Headline

The current reading is **SCCR {{SCCR_UB}}** — an **upper bound**, for the reason below ({{SCCR_DATE}}, {{SCCR_BLOCKS}} blocks, N={{N}}, T={{T}}, C=${{C}}).
Across the assumption grid the index spans **0.030 – 3.565** (median 0.356), and stays
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
| 10,000 | 5 | $500 | 475 | **3.565** | **above** |
| 10,000 | 5 | $925 | 879 | **1.927** | **above** |
| 10,000 | 5 | $1,500 | 1,426 | **1.188** | **above** |
| 10,000 | 10 | $500 | 951 | **1.782** | **above** |
| 10,000 | 10 | $925 | 1,759 | **0.963** | below |
| 10,000 | 10 | $1,500 | 2,852 | **0.594** | below |
| 10,000 | 20 | $500 | 1,901 | **0.891** | below |
| 10,000 | 20 | $925 | 3,517 | **0.482** | below |
| 10,000 | 20 | $1,500 | 5,704 | **0.297** | below |
| 26,586 | 5 | $500 | 1,264 | **1.341** | **above** |
| 26,586 | 5 | $925 | 2,338 | **0.725** | below |
| 26,586 | 5 | $1,500 | 3,791 | **0.447** | below |
| 26,586 | 10 | $500 | 2,527 | **0.670** | below |
| 26,586 | 10 | $925 | 4,676 | **0.362** | below |
| 26,586 | 10 | $1,500 | 7,582 | **0.224** | below |
| 26,586 | 20 | $500 | 5,055 | **0.335** | below |
| 26,586 | 20 | $925 | 9,351 | **0.181** | below |
| 26,586 | 20 | $1,500 | 15,164 | **0.112** | below |
| 100,000 | 5 | $500 | 4,753 | **0.356** | below |
| 100,000 | 5 | $925 | 8,793 | **0.193** | below |
| 100,000 | 5 | $1,500 | 14,260 | **0.119** | below |
| 100,000 | 10 | $500 | 9,506 | **0.178** | below |
| 100,000 | 10 | $925 | 17,587 | **0.096** | below |
| 100,000 | 10 | $1,500 | 28,519 | **0.059** | below |
| 100,000 | 20 | $500 | 19,013 | **0.089** | below |
| 100,000 | 20 | $925 | 35,174 | **0.048** | below |
| 100,000 | 20 | $1,500 | 57,039 | **0.030** | below |

## 2. Distribution and confidence interval

From the frozen reproduction capture — **155 real blocks** (not a model):

| statistic | value |
|---|---|
| mean | 0.2896 |
| median | 0.2326 |
| IQR | 0.1394 – 0.3555 |
| P5–P95 | 0.0827 – 0.7019 |
| min–max | 0.0590 – 1.2948 |
| **bootstrap 95% CI for the mean** | **0.2565 – 0.3259** |

## 3. Stress test — which assumption dominates

| assumption | range tested | SCCR at low | SCCR at high | spread |
|---|---|---|---|---|
| N | 10,000–100,000 | 0.9634 | 0.0963 | **10.0×** |
| T | 5–20 | 0.7248 | 0.1812 | **4.0×** |
| C | 500–1,500 | 0.6704 | 0.2235 | **3.0×** |

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


## Unpublicised-node sensitivity (baseline = strict floor)

Baseline `N = 26,586` is **Grade B** (measured reachable). Unpublicised nodes are **Grade D** and excluded from the index; they are shown here as an explicit band. Excluding them makes `L_net` a lower bound and the SCCR an upper bound — the baseline is **conservative**.

| N | layer | L_net (USD/block) | SCCR | fee coverage | externality vs baseline |
|---:|---|---:|---:|---:|---:|
| 26,586 | B | $4,676 | 0.3624 | 36.2% | 1.00× |
| 32,000 | C | $5,628 | 0.3011 | 30.1% | 1.20× |
| 50,000 | D | $8,793 | 0.1927 | 19.3% | 1.88× |
| 80,000 | D | $14,070 | 0.1204 | 12.0% | 3.01× |
| 100,000 | D | $17,587 | 0.0963 | 9.6% | 3.76× |
| 150,000 | D | $26,380 | 0.0642 | 6.4% | 5.64× |
| 200,000 | D | $35,174 | 0.0482 | 4.8% | 7.52× |
| 265,860 | D | $46,756 | 0.0362 | 3.6% | 10.00× |

**What the baseline means.** `N = 26,586` is the **observed reachable** population. Because SCCR = fees ÷ (N × cost), any additional cost-bearing node (private, NAT'd, Tor-hidden) enlarges the denominator and **lowers** SCCR. The measured floor is therefore an **upper bound** — `SCCR ≤ 0.3624` — and the externality is a **lower bound**. This holds unconditionally: it requires only that non-listening nodes bear *some* positive cost, not that they match the per-node cost model.

### Population scenarios — a band, not a measured total

The figures below are **scenarios**, and they are deliberately not presented as an established interval. `~265,860` is *not a measured Bitcoin node count*: it applies a **historical 9:1 private-to-public topology assumption** to today's observed reachable population.

{{TABLE:population_scenarios}}

> **The ~265,860 scenario is not a measured node count.** It applies a historical (2019) 9:1 private-to-public topology assumption to today's observed reachable population. BSAHI does not treat it as the current total-node count, and it does not revise the primary `N`. Erlay's "private" is defined by connectivity (no inbound), which approximates — but is not identical to — this project's unobservable quantity C.

**Literature source.** Erlay: Efficient Transaction Relay for Bitcoin (Naumenko, Maxwell, Wuille, Fedorova, Beschastnikh; CCS'19 / arXiv:1905.10518) reports **private:public ≈ 9:1** for the network at the time (6,000 public + 54,000 private). It is a topology parameter from a simulation, not a census. Note the public set has since grown from ~6,000 to 26,586 — assuming private grew proportionally is **unjustified**, so if anything the ratio has likely compressed.

### The open research question (and how to close it)

> **Can BSAHI empirically estimate the ratio between independently reachable/listening nodes and non-listening/private nodes — and does the historical 9:1 assumption still hold in 2026?**

The evidence ladder, with the rung that promotes each level:

| Rung | Estimate | Grade | How it is promoted |
|---|---|---|---|
| 1 | Observed reachable `N = 26,586` | B | — (measured) |
| 2 | Historical prior (9:1) | D | cite only; never the headline |
| 3 | Estimator `R = P·(i/o − 1)` from a reachable node | B–C | measure a typical node's inbound count `i` |
| 4 | Cross-validated (crawler + addrman + inbound agree) | A | independent agreement |

The estimator yields a **falsifiable prediction**: Erlay's 9:1 is algebraically equivalent to a typical listening node holding **`i ≈ 80`** inbound connections (`R/P = i/o − 1` with `o = 8`). Measuring `i` either corroborates the 2019 ratio on 2026 data or shows the network has become far more listening-heavy (i ≈ 20–40 ⇒ ratio 1.5:1–4:1). See `research/private-population-estimator.md`.

> The baseline infrastructure size (N = 26586) is a strict empirical floor. Because non-listening, private and Tor-hidden validating nodes cannot be audited with Grade B certainty, they are excluded from the primary index. However, because every hidden node independently bears the replication and validation burden, their exclusion means the true network-wide storage externality (L_net) is higher — and the localized fee coverage (SCCR) lower — than reported. The baseline is therefore conservative.

## What this does and does not claim

- **Does:** quantify exactly how the index moves with each assumption; give a
  legitimate CI for the mean of the measured per-block sample.
- **Does not:** describe the population of all blocks (the CI is for the sample
  mean), or claim an SCCR point estimate independent of N — N is the dominant
  unknown, and that is stated, not hidden.
