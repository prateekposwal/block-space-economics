# DORMANT — per-tx SQLite pipeline (transactions table + btc-rpc spool source)

**Marked DORMANT 2026-08-14 — do not build on, do not repoint new work here.**

## What was planned

- `tools/db/schema.sql` → `transactions` table: per-tx rows classified
  `segwit` / `legacy` / `inscription` with fee/vsize/weight — **0 rows,
  no writer**.
- `tools/agents/06-bitcoin-core-rpc.js` → `btc_rpc` spool source: per-block
  `getblockstats` (fee percentiles, `utxo_size_inc`) from a **local Bitcoin
  Core RPC** — the node never synced (`getblockchaininfo`: `blocks: 0`,
  `pruneHeight: 0`), so no usable records were ever produced.
- `tools/data-engineering/spool-consumer.js` → `btc_rpc` leg writing
  `block_stats` rows — dead code path (no `btc_rpc` schema in the registry,
  no `btc_rpc` endpoint in `tools/data-engineering/config.js`).

## Why it is dormant

The per-tx pipeline needed full-node infra (a synced local Core + spool +
SQLite writer) to answer ONE question: "what share of transactions are
SegWit vs Taproot vs Legacy?"

## The replacement (active)

`block_adoption` — `tools/data-engineering/block-adoption-collect.js`
(capture-agent, hourly):

- **SegWit / Legacy share**: authoritative `extras.segwitTotalTxs / tx_count`
  from the mempool.space block summary — exact, no per-tx enumeration.
- **Taproot share**: bounded uniform sample (25 txs × 10 blocks per capture)
  classified by `vin[].prevout.scriptpubkey_type` — labeled **sampled**.
- Infra: ~271 HTTP requests/hour to public APIs, zero DB, zero full node.
  ≈ **1/100th the infra** of the per-tx SQLite pipeline for the same question.

Consumers: `data/adoption.json` → `capacity.html` adoption section.

## Marker locations

- `tools/db/schema.sql` → `transactions` table header comment.
- `tools/agents/06-bitcoin-core-rpc.js` → file header comment.

Do NOT delete these files (old reports keep provenance); do NOT extend them.
