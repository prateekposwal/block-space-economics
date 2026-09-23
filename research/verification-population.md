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

## Who provides the infrastructure? Four classes, two of them unobservable

The table above asks *what can be observed*. A different and more useful question is
*who supplies the infrastructure*, because that is what the storage-cost model divides
between. Four classes, and only two are within reach of this vantage:

| class | observable? | how | status |
|---|---|---|---|
| **Public / listening nodes** | yes | crawler + handshake | measured: **26,586** |
| **Private / non-listening nodes** | bounded, not counted | inbound peers only | estimate `None` (needs a 2nd capture occasion) |
| **Institutional** (exchanges, custodians, businesses, mining ops) | **no — not attributable** | hosting concentration only | Hetzner ≈11% of the crawl, but that is a *host*, not an institution |
| **Delegated / lightweight users** (wallets using someone else's node) | **no — not in the P2P layer** | nothing | no packet distinguishes a remote-node user from an operator |

Two of these are hard limits, not gaps to be closed later:

- **Institutional infrastructure cannot be attributed from the P2P layer.** Exchanges
  and custodians run on shared cloud, so a node's IP says which *provider* it rents
  from, not who operates it. This is the same failure mode that made pool-IP
  geolocation useless (`data/pool_infrastructure.json`: 10 of 14 pool endpoints are
  CDN-fronted). Counting ASNs is possible; naming institutions is not.
- **Delegated users are invisible to Bitcoin's own network.** A wallet pointed at
  someone else's node emits no distinguishing P2P signal. Only wallet telemetry could
  size this class, and it is not available.

**Why it matters for the cost model.** The infrastructure cost is borne by the public
and private node classes; the institutional class bears it partially and internally;
the delegated class bears none of it while receiving the verification guarantee. So
the four classes are not a taxonomy for its own sake — they are the reason "cost per
node × N" is a lower bound on the burden, and why the uncovered layer (see the
fee-allocation analysis) has to be carried by whoever is left holding a node.

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


## Activity partition of the observed reachable set (D1)

Partitions the **26,577 observed reachable nodes** by what a crawl can actually see: announced service bits, self-reported height vs the chain tip, and host network.

| tier | nodes | share | grade | role |
|---|---:|---:|---|---|
| **T1 serving + synced** | 23,949 | 90.1% | B | full/pruned validating validator, actively serving |
| **T2 serving + lagging** | 2,081 | 7.8% | B | intermittent / catching-up validator |
| **T3 no service announced** | 547 | 2.1% | B | reachable but announces no serving capability — consumer, not infrastructure |
| **T4 height unreported** | 0 | 0.0% | C | unclassifiable from this capture |

**Network:** clearnet 9,601 (36%) · Tor 12,745 (48%) · I2P 4,231 (16%). (Tor and I2P nodes *are* reachable to a crawler that speaks those transports — which is why IP geography is unresolved for ~64% of the set.)

**Honest scope.** This partitions the **observed reachable set only**. It is silent about non-listening/private nodes, which no crawl can see. The `NODE_NETWORK` vs `NODE_NETWORK_LIMITED` archival/pruned interpretation is **unvalidated** against the installed Core release, so T1/T2 are grouped by "serves" rather than split archival vs pruned.

## Corrected framing (D2)

- An address pool is NOT a node count: the ~241k candidate addresses are addresses (grade D), not live nodes.
- Non-listening nodes are not '0% of transit': they still RELAY transactions to their outbound peers; they simply cannot serve inbound requests.
- This partition is a lower-bound view of the validating set: hidden/private nodes are excluded and their exclusion makes every burden metric conservative.

## The first-party inbound test (D5) — and its identity limit

`tools/research/inbound_census.py` counts the nodes that **dial us**. That set is a
MIX: a **listening** node can dial us too, so these are an **upper bound on private
participation**, not a count of non-listening nodes. Two controlled experiments were run on 2026-09-18 to test
whether the Tor route can produce distinct-node evidence:

| experiment | result |
|---|---|
| A **separate Tor client** connects to the node's onion service | ✅ connected; node logged `INBOUND: 1` |
| A **real bitcoind** dials in over the onion | ✅ full P2P handshake (`/Satoshi:27.1.0/`) |

**Both were recorded by Core as `127.0.0.1`.** Tor's hidden-service forwarding
hides the origin, so every onion peer looks like loopback. The consequence:

- **Tor inbound supports only a _concurrency_ bound** — N simultaneous inbound
  peers means at least N nodes dialled us (an upper bound on private participation,
  not a count of non-listening nodes).
- **Distinct-node counting requires a clearnet port-forward**, where Core sees
  distinct source IPs. Tor is not a substitute for it.

The instrument was corrected accordingly (`bsahi.inbound-census/2`): identity is
the peer **IP with the ephemeral port stripped** — which also fixes an overcount in
v1, where `addr` included the source port so every reconnect looked like a new
node — and loopback peers are flagged `identity_hidden` rather than counted.
`max_concurrent_inbound` is the usable first-party lower bound; it remains a lower
bound, never a population count.

## The headline

> **At least 26,586 independently reachable Bitcoin nodes were measured (2026-09-16); the address manager of one small node knew ≥32,000 gossiped addresses.** The total node population — including non-listening and private nodes — is not observable. BSAHI measures the observable part and states the gap rather than filling it with an estimate.

**Grades:** B for the reachable count; C for the address sample; D/unobservable for everything beyond..

## Method and limits

- Reachable set and composition from a reachable-node crawl capture; address sample from a local node's `getnodeaddresses`.
- `user_agent` is self-declared; ASN/organisation describes hosting, not operators; geography is IP-based and distorted by VPN/Tor/proxies.
- The reachable set is a **sample** shaped by the crawl; non-listening nodes are invisible to it.
- Node count is one of the dominant inputs to the SCCR — see [SCCR sensitivity](/research/sccr-sensitivity) and the [Evidence Matrix](/research/evidence-matrix).

Data: [`/data/verification_population.json`](/data/verification_population.json) · Method: [Methodology](/research/methodology) · Replicate: [Replication invite](/research/replicate)
