# Verification Population Observatory

<!-- seo-title: Verification Population Observatory — Observable Bitcoin Nodes -->

**BSAHI — what is observable about Bitcoin's verification population, and what is not.**
*Captured 2026-09-16 · Instrument: `tools/research/verification_population.py`*

## The question, reframed

Not *"how many Bitcoin nodes are there?"* — the total population is **not observable** — but *"how large is the independently reachable verification population, and what can we observe about it?"*

Four quantities are reported separately and **never conflated**:

| quantity | layer | grade | value |
|---|---|---|---|
| A. Gossip-observed **addresses** (addrman) | observed | C | ≥32,000 (request ceiling, returned in full) |
| B. Reachable **nodes** | observed | B | **26,586** |
| C. Non-listening / private nodes | unobservable | D | — (evidence only via inbound peers) |
| D. Total population | unobservable | — | — |

**A is not a node count.** `getnodeaddresses 32000` returns addresses from one node's address manager (learned via addr gossip); the set includes stale/unreachable entries and its size depends on peer count and uptime. The measured reachable-node count is B.

## Composition of the reachable set (26,577 nodes)

**Software** — Bitcoin Core is 97.7% of reachable nodes (self-declared user agents):

| user agent | nodes |
|---|---|
| `/Satoshi:31.1.0/` | 6,129 |
| `/Satoshi:31.0.0/` | 2,162 |
| `/Satoshi:29.3.0/` | 1,656 |
| `/Satoshi:29.3.0/Knots:20260507/` | 1,342 |
| `/Satoshi:27.0.0/` | 1,286 |
| `/Satoshi:29.2.0/` | 1,170 |
| `/Satoshi:28.1.0/` | 1,119 |
| `/Satoshi:26.0.0/` | 892 |

**Networks** — a large share of the "reachable" set is anonymity networks, which is why IP geography is unresolved for 64% of nodes:

| organisation | nodes |
|---|---|
| Tor network | 12,733 |
| I2P network | 4,231 |
| Akamai Connected Cloud | 898 |
| Hetzner Online GmbH | 889 |
| PONYNET | 468 |
| OVH SAS | 389 |
| GOOGLE-CLOUD-PLATFORM | 340 |
| AMAZON-02 | 286 |

- Tor: **12,745** (48%) · I2P: **4,231** (16%)
- Geography (resolved only):   n/a   16,973   United States   3,320   Germany   1,563   France   640   Canada…

**Service bits (raw)** — published as a raw histogram; the archival/pruned mapping is **unvalidated**:

| services bitmask | nodes |
|---|---|
| 3081 | 8,690 |
| 3145 | 6,429 |
| 3080 | 1,740 |
| 1033 | 1,715 |
| 1037 | 1,439 |
| 3085 | 1,263 |
| 3077 | 859 |
| 0 | 540 |

> GRADE C / UNVALIDATED — the mapping of NODE_NETWORK vs NODE_NETWORK_LIMITED to archival/pruned must be checked against the installed Core release before this is treated as a measured split

**Persistence — NOT measured.** connected_since in this capture is effectively the CRAWLER's session time (all values cluster under ~0.25 days), not node uptime. Node uptime/persistence is therefore NOT measured here and must not be published as such; it requires repeated per-node snapshots over time (same address observed across crawls).

**Sync state** — 25,571 nodes reported a plausible height; 1,006 reported an implausible one (self-reported height is frequently stale). Chain tip at capture: 967176.

## The headline

> **At least 26,586 independently reachable Bitcoin nodes were measured (2026-09-16); the address manager of one small node knew ≥32,000 gossiped addresses.** The total node population — including non-listening and private nodes — is not observable. BSAHI measures the observable part and states the gap rather than filling it with an estimate.

**Grades:** B for the reachable count; C for the address sample; D/unobservable for everything beyond..

## Method and limits

- Reachable set and composition from a reachable-node crawl capture; address sample from a local node's `getnodeaddresses`.
- `user_agent` is self-declared; ASN/organisation describes hosting, not operators; geography is IP-based and distorted by VPN/Tor/proxies.
- The reachable set is a **sample** shaped by the crawl; non-listening nodes are invisible to it.
- Node count is one of the dominant inputs to the SCCR — see [SCCR sensitivity](/research/sccr-sensitivity) and the [Evidence Matrix](/research/evidence-matrix).

Data: [`/data/verification_population.json`](/data/verification_population.json) · Method: [Methodology](/research/methodology) · Replicate: [Replication invite](/research/replicate)
