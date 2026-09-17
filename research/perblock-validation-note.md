# Per-block spot validation — rows 1 (fee market) + 4 (block/state size)

<!-- seo-title: Per-Block Spot Validation: Eras vs Real Blocks -->

**Date:** 2026-09-16 (2025-2026 eras completed 2026-09-17) · **Instrument:** `tools/research/perblock_validation.py`
**Output:** `data/perblock_validation.json`

## Purpose

The SCCR historical reconstruction derives era-level fee and block-size legs from
daily aggregates (`fee_btc_per_day`, `avg-block-size`, `blocks_per_day_est`).
That derivation is grade B: correct in aggregate but unverified at the per-block
level. This strip samples actual per-block measurements across 2010-2026 so the
aggregate legs can be checked against direct observations, and so the SegWit-era
size/weight divergence (a block/state-size boundary question, row 4) is quantified.

## Scope and caveat — this is a spot-check, not a survey

Each era is sampled at **three blocks** (2026: **two**). That is a *spot-check*
against the daily-aggregate reconstruction — it is **not** a statistical
characterization of the era. Nothing here supports a claim like "this is the
average behavior of 2026": a two- or three-block sample cannot describe a year of
~52,600 blocks.

What the sample *can* do, and does:

- confirm the aggregate legs are the right order of magnitude (they are), and
- expose the shape that a mean hides — e.g. single-block fees are heavy-tailed
  around an era mean, and post-SegWit `weight ≈ 4x size` is visible.

Read every per-era number below as "one measured block", never as "the era".

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

## Findings (table complete through 2026)

- **Row 4 — size/weight:** early eras (2010-2013) sample 0-32 kWU blocks; the
  chain runs near-full 3993 kWU from ~2018 onward. Mean sample size 0.75 MB
  (2017) → 1.6-2.0 MB (2023-26) against a weight ceiling of 4 MWU — the SegWit
  divergence is visible: post-2017 `weight ≈ 4× size`, pre-SegWit `weight ≈ 4×
  size` holds except deflationary 2015-16 blocks. Ordinals/Runes-era tx counts
  confirm congestion: 2023 sampled 2,924 txs/block, 2024 4,246 txs/block (vs
  ~1,400-1,700 in 2021-22), and the recent eras stay near-full — 2025 1.95 MB /
  2,373 txs, 2026 1.68 MB / 5,522 txs (the highest sampled tx density).
- **Row 1 — fee leg:** single-block fee samples are **highly noisy** vs an era
  annual mean, and the dispersion is itself the finding: 2017 spike 2.36×
  (4.194 vs 1.774 BTC/block), 2018 0.06× (0.031 vs 0.484), 2022 0.02× (0.002
  vs 0.102). Per-block fees cluster around fee events, not the annual mean —
  the aggregation hides a heavy-tailed per-block distribution. The daily-aggregate
  leg (B) is therefore the right grade for era means; per-block *reconstruction*
  (B→A) is genuinely a different object and stays blocked (see verdict). The
  cooling fee market is visible at block level in the tail: 2025 lands near
  parity (1.05×, 0.035 vs 0.033) while 2026 falls to 0.31× (0.006 vs 0.019).
- **Grades:** row 1 historical stays **B**, row 4 historical stays **B** — each
  now carries a per-block validation strip (documented sampling bound) instead
  of an unverified daily-aggregate derivation. Not A: a 3-block-per-era sample is
  a check, not a reconstruction.

## Reachability verdict

Full per-block reconstruction (B→A for rows 1, 4) is **DOCUMENTED** as blocked
on a bulk continuous source: blockchair 430, mempool block-endpoint timeout,
esplora no-fee. Two real completion paths: a synced local node (same R5 gate),
or blockchair from a rate-limit-tolerant host.