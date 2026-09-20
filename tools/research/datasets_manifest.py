#!/usr/bin/env python3
"""Datasets manifest (P4.2 / P3.3) — a versioned index of every published dataset.

Scans data/*.json (plus the frozen primary series), and emits data/datasets.json
with, for each dataset: schema, layer (observed/reconstructed/modelled), evidence
grade, size, last-updated, a canonical download URL, and a one-line description.

Layer/grade come from the Evidence Matrix classification held here; the integrity
audit (tools/research/integrity_audit.py) is the source of truth for the checks.
"""
import datetime
import glob
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DATA = os.path.join(ROOT, "data")
OUT = os.path.join(DATA, "datasets.json")

# dataset -> (layer, grade, description)
CATALOG = {
    "sccr.json": ("observed", "B", "Latest Storage Cost Coverage Ratio reading (dated)"),
    "sccr_history.json": ("observed", "B", "Daily SCCR series"),
    "sccr_historical_series.json": ("reconstructed", "B/C", "Era-level SCCR reconstruction (daily aggregates -> era legs)"),
    "sccr_sensitivity.json": ("modelled", "C", "SCCR sensitivity bands, bootstrap CI and stress test"),
    "utxo_state_series.json": ("observed", "A", "gettxoutsetinfo measurements from a real node (one row per height)"),
    "utxo_state_latest.json": ("observed", "A", "Latest observed UTXO/state measurement"),
    "utxo_series.json": ("reconstructed", "D", "UTXO/state anchors + chain-size cross-check"),
    "utxo_cost_ratio.json": ("reconstructed", "D", "Reconstructed UTXO state era table"),
    "perblock_validation.json": ("observed", "B", "Per-block SPOT samples (weight/size/tx/fee) vs the era aggregates"),
    "difficulty_series.json": ("observed", "A", "Bitcoin mining difficulty, 2009-present (frozen primary)"),
    "mempool_congestion_series.json": ("observed", "B*", "Mempool congestion, 2016-present (frozen primary)"),
    "production_cost_ratio.json": ("modelled", "C", "Producing-side energy cost vs production value, electricity scenarios"),
    "fee_allocation.json": ("modelled", "C", "Three claims on fee revenue per block + the subsidy crossover + temporal price-path scenarios"),
    "verify_cost_index.json": ("modelled", "C", "Verification Cost Index - the verification-burden trend + graded components"),
    "reproduction_verification.json": ("observed", "A", "JS=Python=C reproduction verification of the SCCR"),
    "integrity_audit.json": ("observed", "A", "Integrity audit: heights/dates, units, provenance, layers"),
    "node_census.json": ("observed", "C", "Address-manager sample: gossiped ADDRESSES (not nodes)"),
    "addrman_history.json": ("observed", "C", "Append-only history of the local addrman PUBLIC address sample (trend of node_census.json)"),
    "node_census_series.json": ("observed", "B", "Reachable-node crawl series (btcnodes)"),
    "node_geography.json": ("observed", "B", "Reachable-node network class (clearnet/Tor/I2P) + coarse geographic spread (btcnodes aggregates)"),
    "block_propagation.json": ("observed", "C", "Per-block relay: announcing-node counts + propagation stats (btcnodes inv sampler)"),
    "mining_geography.json": ("modelled", "C/D", "Mining hashrate share by country (auto: Hashrate Index quarterly heatmap; CBECI CSV preferred if present)"),
    "contribution_ratio.json": ("modelled", "C", "Three-axis contribution join: verification population | block relay | block production"),
    "d5_status.json": ("observed", "B", "D5 census endpoint status: tunnel, EXTERNAL reachability self-test, inbound counts"),
    "peer_relay.json": ("observed", "B", "First-party block first-seen per peer (clearnet vs onion vs inbound/outbound)"),
    "validation_cost.json": ("observed", "A", "Measured node-side validation cost per era from a full -reindex (first-party, no API)"),
    "node_crawl.json": ("observed", "A", "First-party reachable-node census by P2P handshake crawl (network class, client mix, sync)"),
    "propagation_cdf.json": ("observed", "A", "First-party block-relay propagation CDF (per-peer deltas, clearnet vs overlay, BIP152 HB)"),
    "price_index.json": ("observed", "A", "Robust multi-venue BTC/USD reference rate (median + MAD outlier rejection, full provenance)"),
    "pool_infrastructure.json": ("observed", "B", "Public pool stratum endpoints: CDN-fronting + RTT (shows why pool-IP geo cannot locate mining)"),
    "node_version_distribution.json": ("observed", "B", "Node software + service-bit distribution (self-declared)"),
    "seed_census.json": ("observed", "B", "DNS-seed address census — a third independent view of the node population"),
    "addrman_churn.json": ("observed", "B", "Addrman churn — empirical address-pool staleness (first-party gossip sampler)"),
    "inbound_census.json": ("observed", "B", "Inbound-peer census — first-party lower bound on non-listening nodes"),
    "verification_population.json": ("observed", "B", "Verification Population Observatory: observable node population + what is unobservable"),
    "population_snapshot.json": ("observed", "B", "Dated, hashed snapshot of the population-observability workstream (N, provenance, partition, component hashes)"),
    "bip110.json": ("observed", "A", "BIP-110 signaling state (GitHub Actions, mempool.space)"),
    "mining_concentration.json": ("observed", "B", "Mining concentration (HHI/Gini/N_eff per window)"),
    "pool_attribution_validation.json": ("observed", "C/B", "Pool attribution internal-coherence validation"),
}

EXTRA = {  # frozen primary captures (not under data/)
    "captured-data/historical/blockchain.info/hash-rate.json": ("observed", "B", "Network hashrate, 2009-present (frozen; unit TH/s)"),
    "captured-data/historical/blockchain.info/avg-block-size.json": ("observed", "B", "Average block size, 2009-present (frozen; unit MB)"),
    "captured-data/historical/blockchain.info/miners-revenue.json": ("observed", "B", "Miners' revenue USD/day (frozen primary)"),
    "captured-data/historical/blockchain.info/market-price.json": ("observed", "B", "Market price USD (frozen primary)"),
}


def describe(path):
    try:
        d = json.load(open(path))
    except Exception:
        return None
    if not isinstance(d, dict):
        return {"rows": len(d) if isinstance(d, list) else None}
    out = {"keys": len(d)}
    for k in ("generated_at", "date", "schema"):
        if k in d:
            out[k] = d[k]
    for k in ("rows", "count", "earas", "eras", "points", "values"):
        if k in d and isinstance(d[k], list):
            out["rows"] = len(d[k])
            break
    return out


def main():
    items = []
    for p in sorted(glob.glob(os.path.join(DATA, "*.json"))):
        name = os.path.basename(p)
        cat = CATALOG.get(name)
        if not cat:
            continue
        layer, grade, desc = cat
        st = os.stat(p)
        meta = describe(p) or {}
        items.append({
            "name": name, "url": f"https://bitcoinsahi.com/data/{name}",
            "path": os.path.relpath(p, ROOT),
            "schema": meta.get("schema"), "layer": layer, "grade": grade,
            "description": desc, "bytes": st.st_size,
            "updated": meta.get("generated_at") or meta.get("date")
            or datetime.datetime.fromtimestamp(st.st_mtime, datetime.timezone.utc).isoformat(),
            "rows": meta.get("rows"),
        })
    for rel, (layer, grade, desc) in EXTRA.items():
        p = os.path.join(ROOT, rel)
        if not os.path.exists(p):
            continue
        st = os.stat(p)
        items.append({"name": os.path.basename(rel), "url": f"https://bitcoinsahi.com/{rel}",
                      "path": rel, "schema": None, "layer": layer, "grade": grade,
                      "description": desc, "bytes": st.st_size,
                      "updated": datetime.datetime.fromtimestamp(st.st_mtime, datetime.timezone.utc).isoformat(),
                      "rows": (describe(p) or {}).get("rows")})
    out = {
        "schema": "bsahi.datasets/1",
        "generated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "note": ("Versioned index of every published dataset. layer: observed | reconstructed | modelled. "
                 "grade: A direct measurement, B frozen primary with unit+date, C model/documented assumptions, "
                 "D reconstruction by interpolation. Rebuilt by tools/research/datasets_manifest.py."),
        "count": len(items),
        "datasets": sorted(items, key=lambda x: x["name"]),
    }
    with open(OUT, "w") as f:
        json.dump(out, f, indent=2)
    print(f"wrote {os.path.relpath(OUT, ROOT)} — {len(items)} datasets")
    for d in out["datasets"]:
        print(f"  [{d['layer'][:5]:5}/{d['grade']:3}] {d['name']:38} {d['bytes']:>9,} B")


if __name__ == "__main__":
    main()
