# Mining Geography — Reachability & Reverse-Engineering Finding

<!-- seo-title: Mining Geography: What Can Be Measured and What Cannot -->

**BSAHI — reducing third-party dependence, item 3**
*Produced: 2026-09-19*

## Claim tested

The independence scorecard lists **Mining geography** as "inherently external —
pools don't disclose". This note tests that claim: can mining's geographic
distribution be measured or reverse-engineered FIRST-PARTY, the way we did for
the node population (crawler), geography (offline ASN DB) and validation cost
(reindex)?

## Methods surveyed (literature + practice)

| Method | What it yields | Who uses it | Verdict here |
|---|---|---|---|
| Pool-declared facility IPs, aggregated by the pool | hashrate by country/region | **CBECI / CCAF** mining map | Needs pool cooperation. Not reproducible. |
| Pool stratum endpoint IP → geolocate | "where the pool is" | common shortcut | **Dead — measured below.** |
| Miner Entanglement: connect to pools as a sub-miner, time their block notifications | pool block-reception latency | Cao et al., *Characterizing the Impact of Network Delay on Bitcoin Mining*, SRDS 2021 | Needs a miner/worker registration; gives latency, not location. |
| On-chain exchange-flow inference: trace coinbase → where miners cash out → exchange's region | miner region, majority of hashrate | Makarov & Schoar, *Blockchain Analysis of the Bitcoin Market*, NBER w29396 | Real, first-party-capable — but needs full address clustering + exchange labelling (research-scale). |
| Passive topology / minimum-spanning-tree from broadcast timing | infer the broadcasting (mining) node | Mariem et al., *Vivisecting Blockchain P2P Networks*, 2018 | Needs many vantage points + RTT matrix. Single-vantage here. |
| Published supplementary dataset (desensitized, per-location hashrate) | 2018–2019 monthly grid | Sun et al., *Spatial analysis of global Bitcoin mining*, Sci. Rep. 2022 | Historical only; importable but not current. |

## Measured evidence (this environment, 2026-09-19)

`tools/net/pool_infrastructure.py` resolves each pool's public stratum hostname,
geolocates it with the offline ip2asn DB, and probes TCP RTT:

| Pool | Hostname | Country | ASN org | CDN |
|---|---|---|---|---|
| F2Pool | btc.f2pool.com | US | CLOUDFLARENET | yes |
| ViaBTC | btc.viabtc.com | US | CLOUDFLARENET | yes |
| AntPool | stratum.antpool.com | US | CLOUDFLARENET | yes |
| Binance Pool | stratum.binance.com | US | AMAZON-02 | yes |
| Braiins/Slush | stratum.braiins.com | US | CLOUDFLARENET | yes |
| Foundry USA | foundryusapool.com | US | CLOUDFLARENET | yes |
| Kano | jp.kano.is | US | AS-VULTR | no |

**10 of 14 resolved addresses are CDN-fronted.** The country/ASN returned is the
*edge's*, not the pool's origin — and the pool's workers (the miners we actually
want) never appear in any of it. Pool-endpoint geolocation is therefore not a
mining-geography method at all; it is a CDN-geography method.

## Verdict

**Mining geography is not first-party measurable from a single node.** Two paths
exist and both are out of reach here:

1. **Pool cooperation** (the CBECI method) — the only direct measurement. Not
   obtainable without partner-pool agreements.
2. **On-chain exchange-flow inference** (the Makarov–Schoar method) — genuinely
   first-party in principle, and the strongest available substitute. It requires
   (a) full historical transaction-graph clustering and (b) a labelled
   exchange-address corpus. Neither is buildable in this repo today, and both are
   blocked while the node reindexes.

Everything a single node *can* measure about mining — pool block share via
coinbase tags — is **concentration**, not geography. That distinction is the
honest boundary, and it is why the scorecard keeps this row external.

## What is in use instead

An automatic **source ladder** in `tools/research/mining_geography.py`:

1. CBECI mining-map CSV in `captured-data/cbeci/` (monthly, authoritative, pool
   sample ~32–38%) — preferred if the operator drops one in; the CBECI API itself
   is reCAPTCHA-gated and is deliberately **not** scraped.
2. **Hashrate Index (Luxor) quarterly heatmap** — public HTML, parsed
   automatically (currently Q3 2026: US 36.7%, Russia 17.2%, China 12.2%,
   covering 85.1% of global hashrate). Both are labelled **estimates**.

## What would unblock a first-party answer

- A **distributed sentinel set** (≥3 geographically separate vantage points) plus
  the block-arrival timing we already record per peer — enough for latency-based
  origin inference.
- A **transaction-clustering indexer** + an exchange-address corpus — enables the
  exchange-flow method, which is the one genuinely first-party route to miner
  region.
