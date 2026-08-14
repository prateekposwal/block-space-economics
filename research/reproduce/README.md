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

`research/reproduce/input/fee_history_capture.json` — the frozen `fee_history`
capture that the JS implementation read from the DB at freeze time (originally
2026-08-02). Since 2026-08-14 it is **auto-refreshed by GitHub Actions**
(`.github/workflows/research-data.yml` → `tools/generate_research_data.js
--only sccr`, Mac-independence Phase 2) from the same public endpoint the live
pipeline reads — `mempool.space/api/v1/mining/blocks/fees/24h` — so it stays
current even when the local Mac is off. Refresh provenance (count, height
range, source, generated_at) lives in the sibling
`research/reproduce/input/fee_history_capture.meta.json` (the capture file
itself must stay a bare array — a wrapper object would break the C/JS/Python
consumers below). Each element:

    { "avgHeight": 960562, "timestamp": 1785588823, "avgFees": 3494636, "USD": 63016 }

- `avgFees` — total block fees (sats) at that height
- `USD` — BTC price (USD) at capture time

The element count varies with the rolling 24-hour window (the first freeze held
171 elements, contiguous heights 960562 → 960732; later windows hold fewer).
A quick sanity check (shape + parse, content-agnostic):

    python3 -c "import json;d=json.load(open('research/reproduce/input/fee_history_capture.json'));print(len(d),all(set(e)=={'avgHeight','timestamp','avgFees','USD'} for e in d))"

## Data-freshness nuance (why the frozen input exists)

The canonical JS implementation reads the **live** `fee_history` capture from the
DB, which is a rolling 24-hour window — its block count changes as old blocks
roll off and new ones arrive (observed: 171 blocks at freeze → 169 blocks later
the same day; avg 0.2186 → 0.2151). The frozen input file was the exact capture
used for the paper's reference outputs at freeze time (that version remains in
git history), so cross-language reproduction compares like-for-like — and it is
now kept current by the GitHub Actions refresh described above. The JS supports
an input override for this purpose:

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

## Reference outputs (2026-08-02 freeze, 171 blocks, model-spec v2.1.0)

| Metric | JS | Python | C |
|---|---|---|---|
| Blocks | 171 | 171 | 171 |
| Avg SCCR | 0.2186 | 0.2186 | 0.2186 |
| Min / Max | 0.0584 / 0.8320 | 0.0584 / 0.8320 | 0.0584 / 0.8320 |
| Below 1× | 100.0% | 100.0% | 100.0% |
| L_net (USD/block) | 5627.804 | 5627.804 | 5627.804 |

## External reproduction protocol (3 steps)

> **Who:** anyone *uninvolved* in the paper (Prateek's task to find one).
> **What they need:** exactly three things — (1) this directory's `input/`
> capture file, (2) the two reference outputs (this README's table + the
> canonical JS report at `reports/research/storage-ratio-YYYY-MM-DD.md`),
> (3) this 3-step protocol. They should NOT need the SQLite DB, the repo's
> tooling, or any Bitcoin-specific knowledge.

1. **Check the input** — confirm `input/fee_history_capture.json` has 171
   elements, each with `avgFees` and `USD`, and that heights are contiguous
   (960562 → 960732). (1 minute)
2. **Compute independently** — implement the formula in ANY language of their
   choice (or run the provided C/Python), reading ONLY the input file and the
   four constants (C=925, N=32000, T=10, B_block=1500000). No consulting of
   the JS report or this repo's other code. (30 minutes)
3. **Compare against the reference outputs** — their avg SCCR must round to
   **0.2186**, min **0.0584**, max **0.8320**, 100% below 1×. Report the
   per-block max deviation from the JS reference if they produce per-block
   values.

**Record the result** in `research/reproduce/external-reproduction.md` with:
date, reproducer (anonymous ok), language, their numbers, and any discrepancy.

---

*Bitcoin Sahi Research — Reproduction Kit for the Storage Cost Coverage Ratio
(working-paper v2.2.0, model-spec v2.1.0), 2026-08-02.*
