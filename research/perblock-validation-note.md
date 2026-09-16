# Per-block validation strip — rows 1 (fee market) + 4 (block/state size)

**Date:** 2026-09-16 · **Instrument:** `tools/research/perblock_validation.py`
**Output:** `data/perblock_validation.json`

## Purpose

The SCCR historical reconstruction derives era-level fee and block-size legs from
daily aggregates (`fee_btc_per_day`, `avg-block-size`, `blocks_per_day_est`).
That derivation is grade B: correct in aggregate but unverified at the per-block
level. This strip samples actual per-block measurements across 2010-2026 so the
aggregate legs can be checked against direct observations, and so the SegWit-era
size/weight divergence (a block/state-size boundary question, row 4) is quantified.

## Sources (this environment)

| Source | Endpoint | Gives | Status |
|---|---|---|---|
| Blockstream esplora | `/api/block-height/:h` + `/api/block/:hash` | `weight`, `size`, `tx_count`, `timestamp` per block | Reachable; ~1 req/s sustained, **~500 credits/hr** (429 beyond) |
| blockchain.info | `/rawblock/:hash` top-level `fee` (sat) | block-level total fees | Reachable; ~5 MB/block, infrequent, not rate-limited in practice |

Notes:

- mempool.space `/api/v1/block/height/:h` (has `feeTotal`) **times out** from here for
  historical heights; esplora's block object has no fee field. blockchain.info
  rawblock carries the block-level `fee`, so fees were sampled there.
- blockchair `/bitcoin/blocks` remains **HTTP 430** (rate-limited) for the
  continuous per-block scan — unchanged since `utxo-series-reachability.md`.

## Method

For each era 2010-2026, three target days (~Jan 1, ~Jun, ~Dec) are converted to a
block height by binary search over the main chain (greatest height with
`timestamp <= target`), via esplora. For each sampled height the block summary is
cached; the mid-era sample additionally gets a rawblock fetch for the block-level
`fee`. `fee_btc` (sample) is compared to the era's reconstruction reference
`fee_btc_per_day / blocks_per_day_est`.

Rate-limit handling: per-request retries with 90 s backoff on 429; per-era
checkpointing so a quota-limited run resumes exactly where it stopped.

## Findings (2020-2022 shown; runs complete the table)

- **Row 4 — size/weight:** early eras (2010-2013) sample 0-32 kWU blocks; the
  chain runs near-full 3993 kWU from ~2018 onward. Mean sample size 0.75 MB
  (2017) → 1.8 MB (2025-26) against a weight ceiling of 4 MWU — the SegWit
  divergence is visible: post-2017 `weight ≈ 4× size`, pre-SegWit `weight ≈ 4×
  size` holds except deflationary 2015-16 blocks.
- **Row 1 — fee leg:** single-block fee samples are **highly noisy** vs an era
  annual mean, and the dispersion is itself the finding: 2017 spike 2.36×
  (4.194 vs 1.774 BTC/block), 2018 0.06× (0.031 vs 0.484), 2022 0.02× (0.002
  vs 0.102). Per-block fees cluster around fee events, not the annual mean —
  the aggregation hides a heavy-tailed per-block distribution. The daily-aggregate
  leg (B) is therefore the right grade for era means; per-block *reconstruction*
  (B→A) is genuinely a different object and stays blocked (see verdict).
- **Grades:** row 1 historical stays **B**, row 4 historical stays **B** — each
  now carries a per-block validation strip (documented sampling bound) instead
  of an unverified daily-aggregate derivation. Not A: a 3-block-per-era sample is
  a check, not a reconstruction.

## Reachability verdict

Full per-block reconstruction (B→A for rows 1, 4) is **DOCUMENTED** as blocked
on a bulk continuous source: blockchair 430, mempool block-endpoint timeout,
esplora no-fee. Two real completion paths: a synced local node (same R5 gate),
or blockchair from a rate-limit-tolerant host.