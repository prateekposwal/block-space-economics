# block_adoption — SegWit / Taproot / Legacy usage capture

Captured by the Data Engineer capture agent hourly (config.js `block_adoption`
endpoint). Producer: capture-agent (collector `tools/data-engineering/block-adoption-collect.js`).

## Purpose

Real per-block adoption data for the capacity page's SegWit/Taproot adoption
section. Replaces the removed `Math.random()` fabrication and the `-- pending`
placeholder with measured values.

## Capture volume (2026-08-14 hardening)

- Walk depth: **10 blocks** via `previousblockhash` (was 5).
- Per-block sample: **25 uniformly-sampled txs** (was 12), seeded rotating
  offset so each hourly capture covers different txids.
- Per capture: **250 sampled txs** (was 60) + 20 block-summary/txids calls ≈
  **271 sequential requests/hour** (~268 to mempool.space) — trivial against
  the hourly cadence. HTTP 429 / any non-200 aborts or skips gracefully
  (never throws); the agent records the failure and backoffs (retries: 0).

## Data source

- **SegWit / Legacy**: `GET https://mempool.space/api/v1/block/:hash` →
  `extras.segwitTotalTxs`, `segwitTotalSize`, `segwitTotalWeight`, plus
  `tx_count`, `weight`, `size`. SegWit share = `segwitTotalTxs / tx_count`
  (authoritative count, includes Taproot — Taproot spends are SegWit v1).
- **Taproot**: `GET https://mempool.space/api/block/:hash/txids` (ALL txids in
  one call — the `/txs` pagination path ignores `start_index`, so it cannot
  give uniform coverage) → pick a deterministic **uniform subsample** of 25
  txids via a per-capture seeded PRNG (rotating slice — each hourly capture
  samples a different draw) → `GET https://mempool.space/api/tx/:txid` per
  sampled tx, classify `vin[].prevout.scriptpubkey_type`:
  - `v1_p2tr` → taproot spend
  - `v0_p2wpkh` / `v0_p2wsh` → segwit spend
  - anything else → legacy spend
  Bounded sample: 25 uniformly-sampled txs per block × the tip + 9 previous
  blocks (250 txs per capture, 2026-08-14: was 12 × 5 = 60). Aggregate
  subsamples across captures of the same block in `buildAdoption()` — each
  draw is different, so summed coverage grows over time. Labeled **sampled**
  in every consumer. Known limitation: P2SH-wrapped segwit outputs report
  `p2sh` and count as legacy here (native segwit is exact).

## Capture shape (`payload.data`)

```json
{
  "tipHash": "64-hex",
  "tipHeight": 962345,
  "capturedAt": "ISO",
  "blocks": [
    { "hash", "height", "timestamp", "tx_count", "size", "weight",
      "segwitTotalTxs", "segwitTotalSize", "segwitTotalWeight" }
  ],
  "taprootSample": {
    "blocksSampled", "txsSampled", "coinbase", "nonCoinbase",
    "taprootSpends", "segwitSpends", "legacySpends", "unclassified",
    "p2trPct", "method"
  }
}
```

## Consumers

- `tools/generate_viz_data.js` → `buildAdoption()` → `data/adoption.json`
  (public mirror, regenerated every snapshot-agent run, writeOnChange)
- `capacity.html` → fetches `data/adoption.json`, renders SegWit / Taproot
  (sampled) / Legacy cards + bar + effective TPS from real weights.

## Honesty rules

- Never fabricate: missing mirror → `--` + "data pending" note, never 0% / fake.
- Taproot is a subset of SegWit: the bar renders Taproot *inside* the SegWit
  segment (Legacy + SegWit-non-Taproot + Taproot = 100%).
- Effective TPS = observed tx throughput from real blocks
  (`Σtx_count / (N × avg block interval)`), not an invented constant.
