#!/usr/bin/env python3
"""Population-thread versioned snapshot (#7).

Pins the state of the "observability of the node population" workstream on a
given date: the canonical N and its provenance, the three-quantity summary, the
observed activity partition, and a content hash (SHA-256) of every contributing
dataset. A downstream reader can therefore (a) reproduce the 2026-09-17 reading
and (b) detect drift in any input.

This is a SNAPSHOT, not a new measurement: it reads the committed datasets and
writes data/population_snapshot.json. Re-run after any input changes.

Output: data/population_snapshot.json  (schema bsahi.population-snapshot/1)
"""
import datetime
import hashlib
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DATA = os.path.join(ROOT, "data")
SPEC = os.path.join(ROOT, "research", "model-spec.json")
OUT = os.path.join(DATA, "population_snapshot.json")

# dataset -> (layer, grade) pulled straight from tools/research/datasets_manifest.py
COMPONENTS = {
    "verification_population.json": ("observed", "B"),
    "seed_census.json": ("observed", "B"),
    "addrman_churn.json": ("observed", "B"),
    "inbound_census.json": ("observed", "B"),
    "node_census_series.json": ("observed", "B"),
    "node_census.json": ("observed", "C"),
}


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def load(name):
    try:
        return json.load(open(os.path.join(DATA, name)))
    except Exception:
        return None


def main():
    spec = json.load(open(SPEC))
    q = spec["quantities"]
    n = q["N"]

    vp = load("verification_population.json") or {}
    seed = load("seed_census.json") or {}
    addr = load("addrman_churn.json") or {}
    inbound = load("inbound_census.json") or {}
    series = load("node_census_series.json") or {}

    tiers = {t["tier"]: t["count"] for t in (vp.get("activity_partition", {}) or {}).get("tiers", [])}
    quantities = vp.get("quantities", {}) or {}

    components = []
    for name, (layer, grade) in COMPONENTS.items():
        p = os.path.join(DATA, name)
        if not os.path.exists(p):
            continue
        components.append({
            "name": name,
            "layer": layer,
            "grade": grade,
            "bytes": os.path.getsize(p),
            "sha256": sha256(p),
        })

    snapshot = {
        "schema": "bsahi.population-snapshot/1",
        "layer": "observed",
        "as_of": datetime.date(2026, 9, 17).isoformat(),
        "generated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "model_spec": {
            "version": spec.get("version"),
            "N": n.get("value"),
            "N_units": n.get("units"),
            "N_captured_at": n.get("captured_at"),
            "N_is_lower_bound": True,
            "N_note": "Measured reachable validating-node count. Non-listening/private nodes are "
                      "not remotely observable, so the true set is larger (a larger N lowers the SCCR).",
        },
        "three_quantities": {
            "A_gossip_addresses": {
                "value": (quantities.get("A_gossip_addresses", {}) or {}).get("value"),
                "what": "addresses one node learned via addr gossip — NOT a node count",
            },
            "B_reachable_nodes": {
                "value": (quantities.get("B_reachable_nodes", {}) or {}).get("value") or series.get("latest_nodes"),
                "what": "independently reachable nodes measured by a crawl — the canonical N",
            },
            "C_unobservable_population": {
                "value": None,
                "what": "non-listening/private nodes — not observable by any crawler",
            },
        },
        "observed_activity_partition": {
            "scope": (vp.get("activity_partition", {}) or {}).get("scope"),
            "T1_serving_synced": tiers.get("T1 serving + synced"),
            "T2_serving_lagging": tiers.get("T2 serving + lagging"),
            "T3_no_service": tiers.get("T3 no service announced"),
        },
        "first_party_instruments": {
            "seed_census": {
                "distinct_addresses_ever": seed.get("distinct_addresses_ever"),
                "persistence_rate_pct": (seed.get("persistence", {}) or {}).get("persistence_rate_pct"),
                "what": "DNS-seed visible addresses — a third independent view",
            },
            "addrman_churn": {
                "distinct_addresses_ever": addr.get("distinct_addresses_ever"),
                "latest_count": addr.get("latest_count"),
                "persistence_rate_pct": (addr.get("churn", {}) or {}).get("persistence_rate_pct"),
                "what": "empirical address-pool persistence (first-party gossip sampler)",
            },
            "inbound_census": {
                "distinct_inbound_addresses_ever": inbound.get("distinct_inbound_addresses_ever"),
                "latest_inbound": (inbound.get("latest", {}) or {}).get("inbound_count"),
                "what": "first-party lower bound on non-listening nodes — PENDING node reachability",
            },
        },
        "components": components,
        "component_drift_expected": [
            "seed_census.json", "addrman_churn.json", "inbound_census.json",
        ],
        "component_drift_note": "The three first-party instruments above are re-sampled on a "
                                "schedule (hourly D5 inbound; 12 h D3 seed + D4 addrman), so their "
                                "hashes move by design. The hashes here pin the 2026-09-17 state so "
                                "that any *unexpected* change to a slow-moving input is detectable.",
        "open": [
            "D5 inbound census returns 0 until the node serves inbound connections "
            "(router port-forward 8333, or Tor) — the only path to a first-party lower bound "
            "on non-listening nodes. Everything else is built and polling.",
            "D5 external reproduction: an independent party must reproduce the SCCR "
            "(research/reproduce/recruit-message.md).",
        ],
        "note": "Versioned snapshot of the population-observability workstream. N has ONE source "
                "of truth (research/model-spec.json quantities.N, v%s). Any change to a listed "
                "component changes its sha256 — compare against this file to detect drift. "
                "Rebuild with tools/research/population_snapshot.py." % spec.get("version", "?"),
    }

    json.dump(snapshot, open(OUT, "w"), indent=2)
    print(f"wrote {os.path.relpath(OUT, ROOT)} — N={n.get('value')} (spec v{spec.get('version')}), "
          f"{len(components)} components hashed")
    for c in components:
        print(f"  {c['sha256'][:12]}  {c['name']}")
    print(f"  partition T1={tiers.get('T1 serving + synced')} "
          f"T2={tiers.get('T2 serving + lagging')} T3={tiers.get('T3 no service announced')}")


if __name__ == "__main__":
    main()
