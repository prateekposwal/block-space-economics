#!/usr/bin/env python3
"""D5 — inbound-peer census (first-party evidence of NON-LISTENING nodes).

Remote scans can only see nodes that accept inbound connections. Our own node, by
contrast, can count the nodes that dial *us*: every inbound peer is a node that
reached out, which is exactly the behaviour of a non-listening / NAT'd / private
validator. Counting distinct inbound addresses over time therefore yields a
**first-party lower bound on the non-listening population that reaches us** — not
an inference from an address pool.

Requires the node to be listening with free connection slots (maxconnections) and,
for clearnet inbound, a reachable port; Tor inbound works without a port-forward.

Append-only: data/inbound_samples.jsonl and data/inbound_census.json (site view).
"""
import datetime
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
try:
    import utxo_state_measure as node
except Exception:
    node = None

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
JSONL = os.path.join(ROOT, "data", "inbound_samples.jsonl")
OUT = os.path.join(ROOT, "data", "inbound_census.json")


def main():
    if node is None:
        raise SystemExit("cannot import the RPC layer")
    cfg = node.parse_conf(node.find_conf())
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    peers = node.rpc(cfg, "getpeerinfo", [])
    net = node.rpc(cfg, "getnetworkinfo", [])

    inbound = [p for p in peers if p.get("inbound")]
    addrs = sorted({p.get("addr", "") for p in inbound if p.get("addr")})
    rec = {"at": now, "connections_in": net.get("connections_in"),
           "inbound_count": len(inbound), "inbound_addrs": addrs,
           "connection_type_breakdown": _counts(p.get("connection_type", "?") for p in inbound)}

    with open(JSONL, "a") as f:
        f.write(json.dumps(rec) + "\n")

    rows = []
    if os.path.exists(JSONL):
        with open(JSONL) as f:
            rows = [json.loads(l) for l in f if l.strip()]
    ever = set()
    for r in rows:
        ever |= set(r.get("inbound_addrs", []))

    out = {
        "schema": "bsahi.inbound-census/1",
        "layer": "observed",
        "generated_at": now,
        "source": "Bitcoin Core getpeerinfo on the project's listening node",
        "method": "tools/research/inbound_census.py — count distinct peers that dial in",
        "latest": rec,
        "samples": len(rows),
        "distinct_inbound_addresses_ever": len(ever),
        "interpretation": {
            "what_it_measures": ("Nodes that opened a connection to us. A node that dials out is, by that act, "
                                 "not serving inbound connections to the crawler — i.e. a non-listening / private node."),
            "what_it_is": "A first-party LOWER bound on the non-listening nodes that reach this node over time.",
            "what_it_is_not": ("Not a population count. It is bounded by our slots, uptime, reachability "
                               "(port-forward/Tor) and the churn of who happens to dial us."),
        },
        "requirements": {"maxconnections": "must exceed the outbound count so inbound slots exist",
                         "listen": "1", "reachability": "port-forward for clearnet, or Tor for onion inbound"},
        "headline": (f"{len(ever)} distinct nodes have dialled in across {len(rows)} sample(s); "
                     f"latest inbound connections: {rec['inbound_count']}"),
    }
    with open(OUT, "w") as f:
        json.dump(out, f, indent=2)
    print(f"inbound: {rec['inbound_count']} now | distinct ever: {len(ever)} | samples: {len(rows)}")
    print(f"connections_in (netinfo): {net.get('connections_in')} | listening: {net.get('localaddresses')}")
    print(f"\nwrote {os.path.relpath(OUT, ROOT)}")


def _counts(it):
    from collections import Counter
    return dict(Counter(it))


if __name__ == "__main__":
    main()
