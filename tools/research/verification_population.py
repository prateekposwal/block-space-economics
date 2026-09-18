#!/usr/bin/env python3
"""Verification Population Observatory (P1 / Phase B).

Aggregates what is OBSERVABLE about Bitcoin's independently-reachable
verification population, and states plainly what is not. Four distinct
quantities that must never be conflated:

  A. Gossip-observed ADDRESSES  — addresses the node learned via addr gossip
     (addrman). Sample shaped by peer count/uptime. data/node_census.json.
  B. Reachable NODES            — connectable nodes from a scan.
     data/node_census_series.json + the per-node capture.
  C. Non-listening / private    — NOT remotely observable (only inbound peers).
  D. Total population           — NOT observable.

Reads the captured per-node records (captured-data/btcnodes-nodes/*.json) for
composition: software, service bits, geography, network/ASN, persistence
(connected_since), and self-reported chain height (with a plausibility filter).

Writes data/verification_population.json. Deterministic; no network.
"""
import collections
import datetime
import glob
import json
import os
import statistics

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
NODES_DIR = os.path.join(ROOT, "captured-data", "btcnodes-nodes")
SERIES = os.path.join(ROOT, "data", "node_census_series.json")
CENSUS = os.path.join(ROOT, "data", "node_census.json")
VERS = os.path.join(ROOT, "data", "node_version_distribution.json")
OUT = os.path.join(ROOT, "data", "verification_population.json")

# Service-bit interpretations. NODE_NETWORK(1) = can serve blocks from genesis
# (archival). NODE_NETWORK_LIMITED(1024) = can serve the last ~288 blocks
# (pruned). NOTE: modern Core behaviour around setting BOTH bits must be
# validated against the installed release before a split is treated as measured;
# we therefore publish the raw histogram and mark any split grade C.
NODE_NETWORK = 1
NODE_NETWORK_LIMITED = 1024
PLAUSIBLE_HEIGHT_MIN = 900_000   # 2026 chain is ~967k; anything far below is stale/garbage


def load_all_nodes():
    recs = []
    for f in sorted(glob.glob(os.path.join(NODES_DIR, "*.json"))):
        d = json.load(open(f))
        r = d.get("results") if isinstance(d, dict) else d
        if isinstance(r, list):
            recs.extend(r)
    return recs


def main():
    series = json.load(open(SERIES))
    census = json.load(open(CENSUS))
    vers = json.load(open(VERS))
    recs = load_all_nodes()
    n = len(recs)
    captured_at = vers.get("captured_at") or datetime.datetime.now(datetime.timezone.utc).date().isoformat()
    tip = (series.get("points") or [{}])[-1].get("height")

    # --- software ---
    ua = collections.Counter(r.get("user_agent") or "unknown" for r in recs)
    core = sum(c for k, c in ua.items() if k.startswith("/Satoshi:"))

    # --- service bits (raw histogram + a flagged split) ---
    bits = collections.Counter(str(r.get("services", 0)) for r in recs)
    archival_like = sum(1 for r in recs if int(r.get("services") or 0) & NODE_NETWORK)
    limited = sum(1 for r in recs if int(r.get("services") or 0) & NODE_NETWORK_LIMITED)

    # --- geography / network ---
    countries = collections.Counter(r.get("country_name") or "n/a" for r in recs)
    orgs = collections.Counter(r.get("organization") or "n/a" for r in recs)
    tor = sum(c for k, c in orgs.items() if "tor" in k.lower())
    i2p = sum(c for k, c in orgs.items() if "i2p" in k.lower())

    # --- persistence (connected_since -> connected-for days) ---
    try:
        ref = datetime.datetime.fromisoformat(str(captured_at)).replace(tzinfo=datetime.timezone.utc)
        ref_ts = ref.timestamp()
    except Exception:
        ref_ts = None
    uptimes = []
    if ref_ts:
        for r in recs:
            cs = r.get("connected_since")
            if isinstance(cs, (int, float)) and 0 < cs < ref_ts:
                uptimes.append((ref_ts - cs) / 86400.0)
    uptimes.sort()

    # persistence is only real if connected_since spreads; here it does not.
    persist_status = "NOT MEASURED (connected_since == crawl session)"

    # --- self-reported height (with a plausibility filter) ---
    heights = [r.get("height") for r in recs if isinstance(r.get("height"), int)]
    plausible = [h for h in heights if h and h >= PLAUSIBLE_HEIGHT_MIN]
    garbage = len([h for h in heights if h is not None and h < PLAUSIBLE_HEIGHT_MIN])

    # ── D1: observed activity partition of the REACHABLE set ──
    # Only signals we can actually see on a crawled node: announced services,
    # self-reported height vs tip, and host network (clearnet / Tor / I2P).
    # This partitions the OBSERVED set; it says nothing about non-listening nodes.
    tip_n = tip or 0
    def is_synced(h):
        return isinstance(h, int) and tip_n and h >= tip_n - 1000
    tiers = {"t1_serving_synced": 0, "t2_serving_lagging": 0,
             "t3_no_service_announced": 0, "t4_height_unreported": 0}
    for r in recs:
        svc = int(r.get("services") or 0)
        serves = bool(svc & (NODE_NETWORK | NODE_NETWORK_LIMITED))
        h = r.get("height")
        if not isinstance(h, int):
            tiers["t4_height_unreported"] += 1
        elif not serves:
            tiers["t3_no_service_announced"] += 1
        elif is_synced(h):
            tiers["t1_serving_synced"] += 1
        else:
            tiers["t2_serving_lagging"] += 1
    partition = [
        {"tier": "T1 serving + synced", "count": tiers["t1_serving_synced"],
         "signal": "announces NODE_NETWORK or NODE_NETWORK_LIMITED AND height within 1000 of tip",
         "grade": "B", "role": "full/pruned validating validator, actively serving"},
        {"tier": "T2 serving + lagging", "count": tiers["t2_serving_lagging"],
         "signal": "announces a service bit but height far below tip (catch-up / stale)",
         "grade": "B", "role": "intermittent / catching-up validator"},
        {"tier": "T3 no service announced", "count": tiers["t3_no_service_announced"],
         "signal": "services == 0 (announces it can serve nothing)",
         "grade": "B", "role": "reachable but announces no serving capability — consumer, not infrastructure"},
        {"tier": "T4 height unreported", "count": tiers["t4_height_unreported"],
         "signal": "no height in the crawl record",
         "grade": "C", "role": "unclassifiable from this capture"},
    ]
    clearnet = n - tor - i2p
    net_breakdown = [
        {"network": "clearnet", "count": clearnet},
        {"network": "Tor", "count": tor},
        {"network": "I2P", "count": i2p},
    ]

    out = {
        "schema": "bsahi.verification-population/1",
        "layer": "observed",
        "captured_at": captured_at,
        "source": "btcnodes reachable-node crawl (per-node capture) + local addrman sample",
        "model": ("Four quantities, never conflated: (A) gossip-observed ADDRESSES, "
                  "(B) reachable NODES, (C) non-listening/private (unobservable), "
                  "(D) total population (unobservable)."),
        "quantities": {
            "A_gossip_addresses": {
                "layer": "observed", "grade": "C",
                "value": census.get("totalKnownAddresses"),
                "what": "addresses the local node learned via addr gossip (addrman), full set (count=0); public/listening-biased, not deduped to nodes",
                "not": "NOT a node count and NOT a bound on reachable nodes; only publicly reachable (advertising) nodes are gossiped",
                "source": "getnodeaddresses 0 (full addrman), data/node_census.json",
                "captured_at": census.get("captured_at"),
            },
            "B_reachable_nodes": {
                "layer": "observed", "grade": "B",
                "value": series.get("latest_nodes"),
                "snapshots": series.get("n_snapshots"),
                "period": series.get("period"),
                "source": "btcnodes reachable-node crawl",
            },
            "C_non_listening": {
                "layer": "unobservable", "grade": "D",
                "value": None,
                "note": "remote scans cannot see non-listening nodes; the only direct evidence is inbound peers on our own node (bitcoin-cli -netinfo).",
            },
            "D_total_population": {
                "layer": "unobservable", "grade": None, "value": None,
                "note": "total node population is not observable by any method; independent estimates span ~10K–100K reachable and an unknown multiple for non-listening.",
            },
        },
        "composition": {
            "nodes_in_capture": n,
            "software": {
                "bitcoin_core": core, "share": round(core / n, 4) if n else None,
                "top_user_agents": ua.most_common(8),
                "caveat": "user_agent is self-declared, not verified",
            },
            "service_bits": {
                "raw_histogram": bits.most_common(12),
                "node_network_set": archival_like,
                "node_network_limited_set": limited,
                "split_status": "GRADE C / UNVALIDATED — the mapping of NODE_NETWORK vs NODE_NETWORK_LIMITED to archival/pruned must be checked against the installed Core release before this is treated as a measured split",
            },
            "geography": {
                "top_countries": countries.most_common(12),
                "unresolved_country": countries.get("n/a", 0),
                "caveat": "IP-based; VPN/Tor/proxies distort. Not a user-population measure.",
            },
            "network": {
                "top_organizations": orgs.most_common(12),
                "tor": tor, "i2p": i2p,
                "caveat": "ASN/organisation describes hosting, not operators.",
            },
            "persistence": {
                "status": persist_status,
                "n_with_connected_since": len(uptimes),
                "median_connected_days": round(statistics.median(uptimes), 3) if uptimes else None,
                "p10_p90_days": [round(uptimes[int(0.10 * (len(uptimes) - 1))], 3),
                                 round(uptimes[int(0.90 * (len(uptimes) - 1))], 3)] if uptimes else None,
                "caveat": ("connected_since in this capture is effectively the CRAWLER's session time "
                           "(all values cluster under ~0.25 days), not node uptime. Node uptime/persistence "
                           "is therefore NOT measured here and must not be published as such; it requires "
                           "repeated per-node snapshots over time (same address observed across crawls)."),
            },
            "sync_state": {
                "chain_tip_at_capture": tip,
                "n_reported_height": len(heights),
                "plausible_height": len(plausible),
                "implausible_height": garbage,
                "caveat": "height is self-reported and frequently stale/garbage; used only as a sanity signal.",
            },
        },
        "activity_partition": {
            "scope": ("This partitions the OBSERVED REACHABLE set (%d nodes) only. It is silent about "
                      "non-listening/private nodes, which a crawl cannot see." % n),
            "definition_caveat": ("Tier boundaries use announced service bits and self-reported height. "
                                  "The NODE_NETWORK vs NODE_NETWORK_LIMITED archival/pruned interpretation is "
                                  "UNVALIDATED against the installed Core release, so T1/T2 are grouped by "
                                  "'serves' rather than split archival vs pruned."),
            "tiers": partition,
            "network_breakdown": net_breakdown,
            "corrected_framing": [
                "An address pool is NOT a node count: the ~241k candidate addresses are addresses (grade D), not live nodes.",
                "Non-listening nodes are not '0% of transit': they still RELAY transactions to their outbound peers; they simply cannot serve inbound requests.",
                "This partition is a lower-bound view of the validating set: hidden/private nodes are excluded and their exclusion makes every burden metric conservative.",
            ],
        },
        "headline": {
            "observed": f"At least {series.get('latest_nodes'):,} independently reachable Bitcoin nodes were measured ({captured_at}); the address manager of one small node knew ≥{census.get('totalKnownAddresses'):,} gossiped addresses.",
            "unobservable": "The total node population — including non-listening and private nodes — is not observable; BSAHI measures the observable part and states the gap rather than filling it with an estimate.",
            "grade": "B for the reachable count; C for the address sample; D/unobservable for everything beyond.",
        },
    }
    with open(OUT, "w") as f:
        json.dump(out, f, indent=2)
    print(json.dumps(out["headline"], indent=2))
    c = out["composition"]
    print(f"nodes in capture: {n:,} | Core share: {c['software']['share']:.1%}")
    print(f"service bits: NODE_NETWORK set {c['service_bits']['node_network_set']:,}, LIMITED set {c['service_bits']['node_network_limited_set']:,} ({c['service_bits']['split_status'][:24]}…)")
    print(f"geo: top={c['geography']['top_countries'][:3]} | unresolved={c['geography']['unresolved_country']:,}")
    print(f"net: tor={c['network']['tor']:,}, i2p={c['network']['i2p']:,}, top org={c['network']['top_organizations'][:2]}")
    print(f"persistence: {c['persistence']['status']} (median {c['persistence']['median_connected_days']}d)")
    print(f"height: plausible {c['sync_state']['plausible_height']:,}, implausible {c['sync_state']['implausible_height']:,}")
    print(f"\nwrote {os.path.relpath(OUT, ROOT)}")


if __name__ == "__main__":
    main()
