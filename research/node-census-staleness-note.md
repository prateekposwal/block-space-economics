# Node Census Staleness Report

**BSAHI — Data Quality Assessment**
*Produced: 2026-09-11 03:24 UTC*

---

## Current State

| Field | Value |
|---|---|
| Census date | 2026-08-02T19:05:03.982Z |
| Staleness | **39 days** |
| Total known addresses | 32,000 (lower bound) |
| Live connections at capture | 8 |
| Live capture attempted | **No** — Bitcoin Core RPC not reachable |
| Live capture reason | `bitcoind` not running; `bitcoin-cli` cannot connect to 127.0.0.1:8332 |

---

## Why this matters

The node census (N=32,000) is a **primary-source lower bound** — the node knows AT LEAST 32,000 addresses via `getnodeaddresses`, but the addrman caps at 32,000. The true reachable set is ≥32K, with independent estimates spanning 10K–100K.

**A stale census means:**
- SCCR is computed with an N that may be too low (making SCCR artificially high)
- The 30-day staleness threshold (documented in `research/model-spec.json`) is exceeded
- The `census_stale: true` flag is correctly set in `data/sccr_latest.json`

---

## What a fresh census would reveal

1. **Current reachable-node count** — whether N has grown above 32K (which would lower SCCR)
2. **Pruned vs. archival distribution** — how many nodes prune vs. store the full chain
3. **Geographic distribution** — concentration risk in node geography
4. **Version distribution** — what fraction runs Bitcoin Core vs. alternatives
5. **Uptime/uptime stability** — how long nodes stay connected

---

## How to refresh

The census is captured by `tools/agents/25-node-census.js`, which runs `bitcoin-cli getnodeaddresses 100` on a locally connected Bitcoin Core node. To refresh:

1. Start `bitcoind` with the BSAHI configuration (`~/.bitcoin/bitcoin.conf`)
2. Wait for sync (the node was ~320K blocks behind tip as of the last recorded state)
3. Run `node tools/agents/25-node-census.js`
4. The agent writes the fresh census to `data/node_census.json`

---

## Honest statement

**Live capture was NOT performed.** No data was fabricated. The node_census.json was updated with the staleness metadata (staleness_days, live_capture_tried, live_capture_reason). The underlying census values (32,000 addresses, 2026-08-02) remain unchanged because no fresh data was available.

---

*Census source: Bitcoin Core getnodeaddresses (local node, RPC max 32,000; addrman saturation lower bound). Agent: `tools/agents/25-node-census.js`.*
