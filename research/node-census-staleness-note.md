# Node Census Staleness Report

**BSAHI — Data Quality Assessment**
*Produced: 2026-09-11 03:24 UTC* | *Updated: 2026-09-16 (primary reachable-node series captured)*

---

## 2026-09-16 update — primary reachable-node census now captured

`tools/research/node_census_capture.py` captures the **btcnodes.io snapshot API**
(renamed bitnodes) — 3,981 snapshots, 2026-05-08 → 2026-09-15, ~3/day.
`data/node_census_series.json` is the PRIMARY-SOURCE reachable-node series.

**Live reading: ~26,600 reachable nodes** (latest 26,586, monthly means
25.3-26.9K June–Sep 2026). The addrman `totalKnownAddresses=32,000` in
`node_census.json` is the **addrman CAP, not a count** — the real reachable set
is ~26.6K.

**Era anchors for the SCCR reconstruction (N table):**
- **2017-12-11: N ≈ 11,891** — Wayback-archived `bitnodes.earn.com/api/v1/snapshots/`
  page-1 (47,320-snapshot history), recovered raw via `web.archive.org/web/... id_`.
- **2026: N ≈ 26,635** — btcnodes.io series mean (2026-05-08..09-15).

Deep history is NOT recoverable as a continuous series: btcnodes retains only
~4 months; the Wayback Machine holds just 3 captures of the old paginated API
(2017-12-11 retrievable; two 2022-12-31 mementos 404 on raw fetch). Eras
2013-2016 and 2018-2025 remain approximation in the SCCR N table; 2017 and 2026
are now primary-anchored.

**SCCR impact (2026-09-16, re-run):** with N=26,635 (not 32,000), 2026 SCCR =
0.297 (still < 1 — first sustained sub-1× regime confirmed). With N=11,891
(not 8,000), 2017 SCCR = 3.35 — the Q7 "2017 ≈ 10.0" claim is even less
reproducible than at the old estimate.

---

## Current State (original, retained)

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

**Live local-nothing was NOT performed. No data was fabricated.**
The underlying local census values (32,000 addresses, 2026-08-02) remain
unchanged because no fresh `bitcoin-cli` data was available.

**Postscript (2026-09-16):** the reachable-node gap is now covered from a
DIFFERENT primary source — btcnodes.io's snapshot API (28,586→26,586 reachable),
which does not require the local node. The local addrman census remains a
separate primary source; its 32,000 is now understood as an addrman cap, not a
reachable count.

---

*Census source: Bitcoin Core getnodeaddresses (local node, RPC max 32,000; addrman saturation lower bound). Agent: `tools/agents/25-node-census.js`.*
