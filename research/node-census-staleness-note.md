# Node Census Staleness Report

**BSAHI — Data Quality Assessment**
*Produced: 2026-09-11 03:24 UTC* | *Updated: 2026-09-16 (primary reachable-node series captured); corrected 2026-09-20*

---

## Correction (2026-09-20): there is no 32,000 addrman cap

Earlier revisions of this note — and several other documents — described
`totalKnownAddresses = 32,000` as an **addrman cap**. That is wrong, and we have
the measurement to show it: `getnodeaddresses 0` (which returns the whole
address manager) came back with **61,302** addresses on 2026-09-20, and the
count has kept growing with peer exposure. The 32,000 figure came from an older
code path that requested a literal count and so truncated the response.

Two separate corrections follow from this:

1. The addrman sample is an **address** set, not a node count, and it is **not
   capped** at any round number.
2. The reachable-node count N is measured independently (btcnodes crawl), and is
   **26,586** — not 32,000.

## 2026-09-16 update — primary reachable-node census captured

`tools/research/node_census_capture.py` captures the **btcnodes.io snapshot API**
(renamed bitnodes) — 3,981 snapshots, 2026-05-08 → 2026-09-15, ~3/day.
`data/node_census_series.json` is the primary-source reachable-node series.

**Live reading: ~26,600 reachable nodes** (latest 26,586; monthly means
25.3–26.9K, June–Sep 2026). The separate local addrman sample
(`data/node_census.json`) is a count of gossiped **addresses** — public,
listening-biased, and not a node count.

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

## Current state at the original assessment (retained)

| Field | Value |
|---|---|
| Census date | 2026-08-02T19:05:03.982Z |
| Staleness at the time | **39 days** |
| Total known addresses | 32,000 (the truncated sample recorded then; now 61,302) |
| Live connections at capture | 8 |
| Live capture attempted | **No** — Bitcoin Core RPC not reachable |
| Live capture reason | `bitcoind` not running; `bitcoin-cli` cannot connect to 127.0.0.1:8332 |

---

## Why this mattered

The node census was a **primary-source lower bound** — the node knows at least
the addresses in its address manager. What was not understood at the time is
that the address-manager sample measures **addresses, not nodes**, and that the
recorded 32,000 was a truncation rather than a ceiling. The true reachable-node
set is measured separately, with independent estimates spanning 10K–100K.

**A stale census meant:**
- SCCR was computed with an N that was too high (32,000), making SCCR artificially low
- The 30-day staleness threshold (documented in `research/model-spec.json`) was exceeded
- The `census_stale: true` flag was correctly set in `data/sccr_latest.json`

---

## What a fresh census reveals

1. **Current reachable-node count** — 26,586 (measured; a lower bound)
2. **Address-manager sample** — 61,302 public gossiped addresses (not nodes)
3. **Pruned vs. archival distribution** — from our own handshake crawl: ~79% full, ~21% pruned
4. **Geographic distribution** — from the offline ASN DB, over the crawl
5. **Version distribution** — from our own crawl (`by_user_agent_top`)

---

## How to refresh

The reachable-node series is captured by
`tools/research/node_census_capture.py` (btcnodes snapshot API), scheduled daily.

The local address-manager sample is captured by `tools/agents/25-node-census.js`,
which runs `bitcoin-cli getnodeaddresses 0` (the whole address manager) on the
local Bitcoin Core node:

1. Start `bitcoind` with the BSAHI configuration (`~/Library/Application Support/Bitcoin/bitcoin.conf`)
2. Wait for sync (the node is currently reindexing)
3. Run `node tools/agents/25-node-census.js`
4. The agent writes the sample to `data/node_census.json` and appends to `data/addrman_history.json`

---

## Honest statement

**No data was fabricated.** The values recorded on 2026-08-02 are kept as the
historical record. What changed is the *interpretation*: the 32,000 was a
truncated address sample, not an addrman cap and not a node count.

**Postscript (2026-09-20):** `getnodeaddresses 0` returns 61,302 addresses, so
the "cap" reading is retired. N (reachable nodes) is measured at 26,586 from an
independent crawl.

---

*Census sources: btcnodes.io snapshot API (reachable nodes) and Bitcoin Core
`getnodeaddresses 0` (address sample). Agents: `tools/research/node_census_capture.py`,
`tools/agents/25-node-census.js`.*
