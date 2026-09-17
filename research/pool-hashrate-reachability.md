# Pool Self-Reported Hashrate — Reachability Finding (build-or-document)

<!-- seo-title: Pool Hashrate Reachability: What's Measurable -->

**BSAHI — row 11 validation, Tier-2 item 1**
*Produced: 2026-09-16*

## Claim tested

The row-11 C→B move requires an INDEPENDENT ground truth for per-pool hashrate,
ideally pools' own reported hashrate. This note records what is reachable from
this environment and what is not, so the grade move is evidence-based.

## Reachability canvas (probed 2026-09-16)

| Source | What it would give | Result |
|---|---|---|
| pool.via.btc.com API | ViaBTC self-reported hashrate | **DNS does not resolve** (Errno 8) from this host |
| pool.btc.com | BTC.com pool stats / attribution | **DNS does not resolve** |
| public-data.binance.org | Binance pool public stats | **DNS does not resolve** |
| api.f2pool.com | F2Pool self-reported hashrate | reachable but **requires F2P-API-SECRET token** (public stats not granted) |
| www.f2pool.com/coin/btc | F2Pool page | **404** (path moved / page gone) |
| antpool.com/statistics | AntPool self-reported hashrate | **SPA shell only** — data client-rendered, no SSR number, no open API on probed paths |
| miningpoolstats.stream | aggregator pool self-reports | reachable once; **data client-side / API timeouts** |
| blockchain.info/pools | independent block attribution | **client-side only** (`__NEXT_DATA__` has no pool payload; no public stats API) |
| api.blockchair.com/bitcoin/stats | independent network hashrate | **REACHABLE, works** (1013.7 EH/s, H/s field) |

## What the reachable evidence does prove

`tools/research/pool_attribution_validation.py` + `data/pool_attribution_validation.json`:

1. **Internal coherence: 7/7 top pools.** Each pool's share across the 24h/3d/1w/1y
   windows agrees within ≤1.5σ (Poisson counting sigma per window). No pool is an
   attribution outlier. The measured shares are not a fluke of one window.
2. **Network-total cross-check: 2.34%.** blockchair `hashrate_24h` (1013.7 EH/s, an
   independent node-based estimate) vs mempool.space `lastEstimatedHashrate`
   (1037.7 EH/s). Two independent implementations agree on the network total that
   the producing-side instrument depends on.

## What it does NOT prove (and why the grade stays C live)

Self-reported per-pool hashrate is the definitive ground truth for row 11, and it
is **not reachable here** (DNS-blocked / token-gated / SPA / client-side —
canvas above). Without it, per-pool shares rest on block-tag attribution that is
internally coherent and network-consistent but not yet corroborated against pools'
own numbers.

## Path to close (C → B live)

1. Re-run the pool probes from a host where `via.btc.com` / `pool.btc.com` /
   `public-data.binance.org` resolve (VPN/proxy or cloud worker), OR
2. Register for the F2Pool public API token and Binance Pool public stats, OR
3. Fetch pool-reported hashrate from miningpoolstats' per-pool detail pages when its
   API is stable (`api.miningpoolstats.stream`).
Then compute per-pool `reported_share / block_share` ratios and record them.

## Verdict

**Build-or-document: DOCUMENTED.** Row 11 stays C live until pool self-reported
hashrate is captured; the evidence earned (internal coherence + network-total
cross-check) is recorded in `data/pool_attribution_validation.json`. No
fabricated pool-reported numbers exist.