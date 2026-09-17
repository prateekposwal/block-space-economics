# SCCR Reproduction Kit

**Storage Cost Coverage Ratio (SCCR)** — independent, multi-language reproduction
of the working paper's headline measurement (`research/working-paper.md` v2.2.0,
`research/model-spec.json` v2.1.0).

## What is reproduced

    R_blocks = 365.25 × 24 × 6                    (blocks per year)
    cb       = C / (B_block × R_blocks)            (cost per byte per year)
    L_node   = B_block × cb × T                    (lifetime storage cost / node / block)
    L_net    = L_node × N                          (network lifetime cost / block, USD)
    SCCR_i   = (avgFees_i / 1e8 × USD_i) / L_net   (dimensionless, per block)

All constants come from `research/model-spec.json` — **no script redefines a
model constant**.

## Three independent implementations (same formula, same data)

| # | Language | File | Input |
|---|----------|------|-------|
| 1 | **JavaScript** (canonical) | `tools/research/storage-ratio.js` | live capture from `captured-data/bsahi.db` |
| 2 | **Python** | `research/reproduce/reproduce_sccr.py` | frozen capture `input/fee_history_capture.json` |
| 3 | **C** (standalone, no deps) | `research/reproduce/reproduce_sccr.c` | frozen capture `input/fee_history_capture.json` |

## Input data file

`research/reproduce/input/fee_history_capture.json` — the **FROZEN** capture used
for all reference outputs in this kit. It is immutable by contract: nothing in
the pipeline writes to `research/reproduce/input/`. (The **live** rolling 24-hour
capture the SCCR dashboard reads is refreshed by GitHub Actions into
`captured-data/sccr-live/` — `.github/workflows/research-data.yml` →
`tools/generate_research_data.js --only sccr` — from
`mempool.space/api/v1/mining/blocks/fees/24h`; that path is refreshable by
design, this one is not.) Current frozen snapshot: **2026-09-16, 155 blocks,
heights 967138 → 967292, model-spec v2.1.0.** Provenance (count, height range,
source, generated_at) lives in the sibling
`research/reproduce/input/fee_history_capture.meta.json` (the capture file
itself must stay a bare array — a wrapper object would break the C/JS/Python
consumers below). Each element:

    { "avgHeight": 967138, "timestamp": 1785588823, "avgFees": 3494636, "USD": 63016 }

- `avgFees` — total block fees (sats) at that height
- `USD` — BTC price (USD) at capture time

{ "avgHeight": 967138, "timestamp": 1789485471, "avgFees": 5097865, "USD": 75892 }

- `avgFees` — total block fees (sats) at that height
- `USD` — BTC price (USD) at capture time

The element count is the count frozen at snapshot time (current: 155 elements,
contiguous heights 967138 → 967292). A quick sanity check (shape + parse,
content-agnostic):

    python3 -c "import json;d=json.load(open('research/reproduce/input/fee_history_capture.json'));print(len(d),all(set(e)=={'avgHeight','timestamp','avgFees','USD'} for e in d))"

## Data-freshness nuance (why the frozen input exists)

The SCCR live series reads a **rolling 24-hour window** — its block count
changes as old blocks roll off and new ones arrive, so the live number moves
with the fee market (observed: avg 0.2406 on 2026-09-16). The frozen input file
is the exact capture pinned as the kit's reference (dated snapshot), so
cross-language reproduction compares like-for-like against a stable, committed
baseline — it is NOT refreshed by the pipeline. The JS canonical implementation
supports an input override for comparing against the frozen file:

    SCCR_INPUT_FILE=research/reproduce/input/fee_history_capture.json \
      node tools/research/storage-ratio.js

Default behavior (live DB) is unchanged when the env var is absent.

## Run all three

```bash
bash research/reproduce/cross_check.sh
```

Prints each implementation's avg/min/max/below-1× and asserts per-block
agreement between JS, Python, and C (max |diff| < 1e-6). The script
auto-compiles the C implementation from source if the binary is absent
(the binary is gitignored and not shipped in clones).

## Reference outputs (2026-09-16 frozen snapshot, 155 blocks, model-spec v2.1.0)

| Metric | JS | Python | C |
|---|---|---|---|
| Blocks | 155 | 155 | 155 |
| Avg SCCR | 0.2406 | 0.2406 | 0.2406 |
| Min / Max | 0.0490 / 1.0757 | 0.0490 / 1.0757 | 0.0490 / 1.0757 |
| Below 1× | 98.7% (153/155) | 98.7% (153/155) | 98.7% (153/155) |
| L_net (USD/block) | 5627.804 | 5627.804 | 5627.804 |

Note: the snapshot contains **two blocks above 1×** (max SCCR 1.0757 — fees
covering >100% of the modeled 10-yr storage cost). This is the honest dated
band: the "100% below 1×" strong form does not survive the real capture
(working-paper §5.4). The exact values change with the fee market; each new
frozen snapshot is dated and re-pinned.

## External reproduction protocol (3 steps)

> **Who:** anyone *uninvolved* in the paper (Prateek's task to find one).
> **What they need:** exactly three things — (1) this directory's `input/`
> capture file, (2) the two reference outputs (this README's table + the
> canonical JS report at `reports/research/storage-ratio-YYYY-MM-DD.md`),
> (3) this 3-step protocol. They should NOT need the SQLite DB, the repo's
> tooling, or any Bitcoin-specific knowledge.

1. **Check the input** — confirm `input/fee_history_capture.json` has 155
   elements, each with `avgFees` and `USD`, and that heights are contiguous
   (967138 → 967292). (1 minute)
2. **Compute independently** — implement the formula in ANY language of their
   choice (or run the provided C/Python), reading ONLY the input file and the
   four constants (C=925, N=32000, T=10, B_block=1500000). No consulting of
   the JS report or this repo's other code. (30 minutes)
3. **Compare against the reference outputs** — their avg SCCR must round to
   **0.2406**, min **0.0490**, max **1.0757**, 153/155 below 1× (98.7%). Report
   the per-block max deviation from the JS reference if they produce per-block
   values.

**Record the result** in `research/reproduce/external-reproduction.md` with:
date, reproducer (anonymous ok), language, their numbers, and any discrepancy.

---

*Bitcoin Sahi Research — Reproduction Kit for the Storage Cost Coverage Ratio
(working-paper v2.2.0, model-spec v2.1.0), 2026-08-02.*

## Last verification (2026-09-17)

Ran `cross_check.sh`: **JS = Python = C**, 155/155 heights matched, max per-block difference **4.9e-7**, avg SCCR **0.2406** (min 0.0490, max 1.0757, 153/155 below 1×). Machine-readable record: `data/reproduction_verification.json`.
