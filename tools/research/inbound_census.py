#!/usr/bin/env python3
"""D5 — inbound-peer census (first-party evidence of NON-LISTENING nodes).

Remote scans can only see nodes that accept inbound connections. Our own node, by
contrast, can count the nodes that dial *us*: every inbound peer is a node that
reached out, which is exactly the behaviour of a non-listening / NAT'd / private
validator.

IDENTITY LIMITATION (measured 2026-09-18, two controlled experiments):
  Tor's hidden-service forwarding hides the origin — every onion inbound peer
  appears to Core as 127.0.0.1. A real bitcoind dialling in over our onion and a
  separate Tor client both recorded 127.0.0.1 (distinct ephemeral ports only).
  Therefore:
    * distinct-node counting REQUIRES clearnet inbound (a router port-forward);
    * Tor inbound supports only a CONCURRENCY lower bound (N simultaneous
      inbound peers => at least N non-listening nodes).

Also fixes an overcount: `addr` carries the peer's ephemeral source port, so the
old "distinct addresses" metric counted every reconnect as a new node. Identity
is now the IP, with the port stripped.

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


def _ip(addr):
    """Peer IP with the ephemeral port stripped (identity, not socket)."""
    if not addr:
        return ""
    if addr.startswith("["):                      # [ipv6]:port
        return addr[1:addr.find("]")]
    return addr.rsplit(":", 1)[0]


def _is_identity_hidden(ip):
    """Loopback => the origin is hidden (Tor HS forward, or a local test)."""
    return ip == "::1" or ip == "127.0.0.1" or ip.startswith("127.")


def main():
    if node is None:
        raise SystemExit("cannot import the RPC layer")
    cfg = node.parse_conf(node.find_conf())
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    peers = node.rpc(cfg, "getpeerinfo", [])
    net = node.rpc(cfg, "getnetworkinfo", [])

    inbound = [p for p in peers if p.get("inbound")]
    ips = [_ip(p.get("addr", "")) for p in inbound]
    identifiable = sorted({ip for ip in ips if ip and not _is_identity_hidden(ip)})
    hidden = sorted({ip for ip in ips if ip and _is_identity_hidden(ip)})
    rec = {"at": now, "connections_in": net.get("connections_in"),
           "inbound_count": len(inbound),
           "inbound_ips": identifiable,                # clearnet identity
           "identity_hidden": bool(hidden),
           "identity_hidden_ips": hidden,
           "connection_type_breakdown": _counts(p.get("connection_type", "?") for p in inbound)}

    with open(JSONL, "a") as f:
        f.write(json.dumps(rec) + "\n")

    rows = []
    if os.path.exists(JSONL):
        with open(JSONL) as f:
            rows = [json.loads(l) for l in f if l.strip()]
    ever = set()
    max_concurrent = 0
    hidden_ever = False
    for r in rows:
        ever |= {ip for ip in r.get("inbound_ips", []) if ip}
        # backward compat: older rows stored addr strings with ports
        if not r.get("inbound_ips") and r.get("inbound_addrs"):
            ever |= {_ip(a) for a in r["inbound_addrs"]
                     if a and not _is_identity_hidden(_ip(a))}
        max_concurrent = max(max_concurrent, r.get("inbound_count") or 0)
        hidden_ever = hidden_ever or bool(r.get("identity_hidden"))

    out = {
        "schema": "bsahi.inbound-census/2",
        "layer": "observed",
        "generated_at": now,
        "source": "Bitcoin Core getpeerinfo on the project's listening node",
        "method": "tools/research/inbound_census.py — count peers that dial in (identity = IP, port stripped)",
        "latest": rec,
        "samples": len(rows),
        "history": [{"at": r["at"], "inbound_count": r.get("inbound_count", 0),
                     "connections_in": r.get("connections_in")} for r in rows[-120:]],
        "distinct_inbound_addresses_ever": len(ever),
        "max_concurrent_inbound": max_concurrent,
        "identity_hidden_ever": hidden_ever,
        "interpretation": {
            "what_it_measures": ("Nodes that opened a connection to us. A node that dials out is, by that act, "
                                 "not serving inbound connections to the crawler — i.e. a non-listening / private node."),
            "clearnet_bound": ("`max_concurrent_inbound` is a first-party LOWER bound on non-listening nodes: "
                               "N simultaneous inbound peers means at least N such nodes exist."),
            "tor_limitation": ("Over Tor every peer appears as 127.0.0.1, so distinct-node identity is NOT "
                               "observable — only the concurrency bound. Distinct-node counting requires a "
                               "clearnet port-forward."),
            "what_it_is_not": ("Not a population count. It is bounded by our slots, uptime, reachability "
                               "(port-forward/Tor) and the churn of who happens to dial us."),
        },
        "requirements": {"maxconnections": "must exceed the outbound count so inbound slots exist",
                         "listen": "1",
                         "reachability": ("port-forward for clearnet distinct-node counting; "
                                          "Tor gives a concurrency bound only")},
        "headline": _headline(len(ever), max_concurrent, hidden_ever, len(rows), rec["inbound_count"]),
    }
    with open(OUT, "w") as f:
        json.dump(out, f, indent=2)
    print(f"inbound: {rec['inbound_count']} now | max concurrent ever: {max_concurrent} | "
          f"distinct clearnet IPs ever: {len(ever)} | identity-hidden seen: {hidden_ever}")
    print(f"connections_in (netinfo): {net.get('connections_in')} | listening: {net.get('localaddresses')}")
    print(f"\nwrote {os.path.relpath(OUT, ROOT)}")


def _headline(distinct_ips, max_conc, hidden_ever, samples, now_count):
    if distinct_ips:
        base = (f"{distinct_ips} distinct clearnet peer IP(s) and up to {max_conc} concurrent inbound "
                f"peer(s) across {samples} sample(s) have dialled in; latest: {now_count}")
    elif max_conc:
        base = (f"Up to {max_conc} concurrent inbound peer(s) across {samples} sample(s) — "
                f"identity hidden (Tor/loopback), so this is a concurrency lower bound, not a node count; "
                f"latest: {now_count}")
    else:
        base = (f"0 inbound peers observed across {samples} sample(s); the node accepts connections but "
                f"is not yet being dialled")
    if hidden_ever and distinct_ips:
        base += " (some peers identity-hidden via Tor)"
    return base


def _counts(it):
    from collections import Counter
    return dict(Counter(it))


if __name__ == "__main__":
    main()
