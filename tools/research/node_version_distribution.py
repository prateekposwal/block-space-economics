#!/usr/bin/env python3
"""Reachable-node software/services distribution (BSAHI Tier-1 item 5 partial).

The pruned-vs-archival split is NOT remotely observable (see
research/pruned-split-measurement-scope.md), but the reachable population's
user_agent (software+version) and service bits ARE observable from btcnodes.io
/api/v1/nodes/. That distribution is the governance/upgrade-readiness proxy the
node-staleness note asks for, and a partial observable substitute for the census
item.

Deterministic + offline: raw pages cached under captured-data/btcnodes-nodes/.
Writes data/node_version_distribution.json.
"""
import json, os, sys, datetime, statistics, urllib.request, time

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CACHE = os.path.join(ROOT, "captured-data", "btcnodes-nodes")
OUT = os.path.join(ROOT, "data", "node_version_distribution.json")
API = "https://btcnodes.io/api/v1/nodes/"
PAGE = 100
UA = {"User-Agent": "bsahi-research"}

def get(page):
    path = os.path.join(CACHE, f"nodes_page_{page}.json")
    if os.path.exists(path):
        with open(path) as f:
            return json.load(f)
    for attempt in range(5):
        try:
            req = urllib.request.Request(f"{API}?page={page}&limit={PAGE}", headers=UA)
            with urllib.request.urlopen(req, timeout=45) as r:
                data = json.load(r)
            break
        except Exception:
            if attempt == 4:
                raise
            time.sleep(1.5 + attempt)
    os.makedirs(CACHE, exist_ok=True)
    with open(path, "w") as f:
        json.dump(data, f, indent=2)
    time.sleep(0.12)
    return data

def main():
    offline = "--offline" in sys.argv
    page = 1
    nodes = []
    total = None
    while True:
        d = get(page)
        if total is None:
            total = d["count"]
        res = d.get("results", [])
        nodes.extend(res)
        if len(nodes) >= total or not res:
            break
        page += 1
        if page % 50 == 0:
            print(f"  {len(nodes)}/{total} ...", flush=True)
    nodes = nodes[:total]

    # version histogram: bucket by major Satoshi version from user_agent
    vers = {}
    agents = {}
    services = {}
    for n in nodes:
        ua = n.get("user_agent") or "unknown"
        agents[ua] = agents.get(ua, 0) + 1
        # extract /Satoshi:X.Y.Z/
        import re
        m = re.search(r"Satoshi:(\d+\.\d+\.\d+)", ua)
        if m:
            major = m.group(1).split(".")[0]
            vers["Core " + m.group(1)] = vers.get("Core " + m.group(1), 0) + 1
        else:
            key = "non-Core:" + ua[:24]
            vers[key] = vers.get(key, 0) + 1
        svc = n.get("services", 0)
        services[svc] = services.get(svc, 0) + 1

    core_share = sum(v for k, v in vers.items() if k.startswith("Core "))
    dist = {
        "schema": "bsahi.node-version-distribution/1",
        "generated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "source": "btcnodes.io /api/v1/nodes/ (reachable-node scan)",
        "n_nodes": len(nodes),
        "captured_at": "2026-09-16",
        "core_major_share": round(sum(v for k, v in vers.items() if k.startswith("Core 3"))/len(nodes), 6),
        "bitcoin_core_share_of_reachable": round(core_share / len(nodes), 6),
        "by_exact_version": {k: v for k, v in sorted(vers.items(), key=lambda x: -x[1])[:16]},
        "by_services_bitmask": {str(k): v for k, v in sorted(services.items(), key=lambda x: -x[1])[:10]},
        "note": "user_agent is self-declared, not verified. Pruned-vs-archival is NOT observable here (see pruned-split-measurement-scope.md).",
    }
    with open(OUT, "w") as f:
        json.dump(dist, f, indent=2)
    print(f"captured {len(nodes)} reachable nodes ({total} total)")
    print("core share:", dist["bitcoin_core_share_of_reachable"], "| Core30/31 share:", dist["core_major_share"])
    print("top versions:", dict(list(dist['by_exact_version'].items())[:6]))
    print("Wrote", OUT)

if __name__ == "__main__":
    main()