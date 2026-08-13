# block_adoption — SegWit / Taproot / Legacy usage capture

Captured by the Data Engineer capture agent hourly (config.js `block_adoption`
endpoint). Producer: capture-agent (collector `tools/data-engineering/block-adoption-collect.js`).

## Purpose

Real per-block adoption data for the capacity page's SegWit/Taproot adoption
section. Replaces the removed `Math.random()` fabrication and the `-- pending`
placeholder with measured values.

## Data source

- **SegWit / Legacy**: `GET https://mempool.space/api/v1/block/:hash` →
  `extras.segwitTotalTxs`, `segwitTotalSize`, `segwitTotalWeight`, plus
  `tx_count`, `weight`, `size`. SegWit share = `segwitTotalTxs / tx_count`
  (authoritative count, includes Taproot — Taproot spends are SegWit v1).
- **Taproot**: `GET https://mempool.space/api/block/:hash/txs` (25 txs/page,
  paginated) → each tx summary's `vin[].prevout.scriptpubkey_type`:
  - `v1_p2tr` → taproot spend
  - `v0_p2wpkh` / `v0_p2wsh` → segwit spend
  - anything else → legacy spend
  Bounded sample: 2 evenly-spaced pages per block × the tip + 5 previous
  blocks (≈300 txs per capture). Labeled **sampled** in every consumer.
  Known limitation: P2SH-wrapped segwit outputs report `p2sh` and count as
  legacy here (native segwit is exact).

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
