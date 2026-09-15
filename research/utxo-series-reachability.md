# UTXO Series — Reachability Finding (build-or-document)

**BSAHI — row 6 (D historical), VCI state leg (row 7)**
*Produced: 2026-09-16*

## Goal

A continuous historical UTXO-count / state-size series: (a) moves row 6
historical D → C, and (b) hardens the VCI `utxo_state_gb` estimate table.

## Sources probed (2026-09-16) and results

| Source | What it would give | Result |
|---|---|---|
| CoinMetrics community API (`catalog-v2/asset-metrics?assets=btc`) | UTXO-count metric | NO utxo metric in the 31-metric BTC catalog (SplyCur, TxCnt etc. only) |
| blockchair `/bitcoin/stats` | aggregate state data | **REACHABLE (frozen)**: `outputs` 3,925,409,015 (cumulative outputs created), `transactions` 1.44B, `hodling_addresses` 59.57M, `blockchain_size` 768,994,703,599 B. **No unspent count. No cumulative inputs.** |
| blockchair `/bitcoin/blocks` (inputs/outputs per block) | exact per-block UTXO delta for a full scan | **HTTP 430 rate-limit** on all pagination attempts this session (limit=100/1000); ~967K blocks needed → full scan impractical under current limits |
| blockstream esplora (`blockstream.info/api`) | UTXO aggregate | 404 on probed paths; no UTXO-count aggregate exposed |
| mempool.space `/api/...` | UTXO aggregate/heuristics | No UTXO-count endpoint in public REST (mempool, fees, mining, lightning only) |
| bitinfocharts `/bitcoin/utxo.html` | UTXO count + history chart | **Hangs/timeouts** (page never completes, even with raw-socket 40s cap) |
| blockchain.info legacy `/q/` endpoints | `unspentcount`-style query | **Hangs** on probed paths |
| blockchain.info `/pools`, `__NEXT_DATA__` | (attribution, not UTXO) | client-side only (noted for row 11) |

## What the reachable evidence delivers (shipped)

`tools/research/utxo_series.py` + `data/utxo_series.json`:

1. **Primary anchors (blockchair, frozen 2026-09-15):** outputs-ever 3.925B,
   transactions-ever 1.44B, hodling-addresses 59.57M, chain size 769 GB.
2. **VCI chain-size cross-check: 2.7%.** VCI's cumulative daily-avg-block-size
   route (789.5 GB) vs blockchair's direct `blockchain_size` (769.0 GB) — the
   chain leg of VCI is now independently validated as tight.
3. **UTXO-count: NOT MEASURED.** No reachable primary source exposes a current
   unspent count; `utxo_count_2026` is explicitly `null`, not fabricated.

## Verdict

**Build-or-document: DOCUMENTED.** Row 6 historical stays D; VCI state leg stays
estimate-table. The pre-2016 continuous UTXO-count series requires one of:

1. A **synced local Bitcoin Core node** (the ready path — the census node is
   ~320K blocks behind; once synced, `gettxoutsetinfo` captures give a true
   primary series going forward, and per-block `nTx`-derived deltas cover the
   back-fill). This is the R5 node-sync decision, already deferred.
2. A **blockchair full block scan** from a session/host tolerant of its rate
   limits (~10K requests), computing Σ(outputs − non-coinbase inputs) per block.

No fabricated UTXO numbers exist in the repo.