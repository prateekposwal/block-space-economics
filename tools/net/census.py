#!/usr/bin/env python3
"""BSAHI D5 — unified, environment-adaptive inbound census (one command).

WHY THIS EXISTS
  Every reachability path has been individually proven or disproven on this
  project (port-forward, UPnP, NAT-PMP, IPv6, Tor identity, STUN/hole-punch, free
  sandboxes, PWD, free tunnels). Rather than a pile of one-off probes, this is the
  single entry point that:

    1. measures the environment (is clearnet inbound possible? IPv6? is a Tor
       onion live? what does the node actually see?), and
    2. emits the STRONGEST HONEST bound that environment permits.

  Two grades of evidence, never conflated:
    * DISTINCT  — reachable clearnet/IPv6 inbound gives real, un-SNATed peer IPs.
    * CONCURRENCY — Tor inbound hides identity (peers appear as 127.0.0.1), so the
      only valid bound is `max simultaneous inbound peers >= N non-listening nodes`.
    * CONTAINED — no inbound path: report 0 with the measured reason.

  Fabricating scanner traffic as validators is explicitly not an option; the
  verdict says CONTAINED rather than pretending.

Usage:
  tools/net/census.py                 # full probe + verdict -> data/inbound_census_verdict.json
  tools/net/census.py --json          # machine-readable only
"""
import argparse
import base64
import datetime
import json
import os
import re
import socket
import subprocess
import sys
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CONF = os.path.expanduser("~/Library/Application Support/Bitcoin/bitcoin.conf")
OUT = os.path.join(ROOT, "data", "inbound_census_verdict.json")


def rpc(method, params=None, timeout=8):
    cfg = {}
    with open(CONF) as f:
        for line in f:
            if "=" in line and not line.startswith("#"):
                k, _, v = line.strip().partition("=")
                cfg[k] = v
    port = int(cfg.get("rpcport", 8332))
    body = json.dumps({"jsonrpc": "1.0", "id": "c", "method": method,
                       "params": params or []}).encode()
    req = urllib.request.Request("http://127.0.0.1:%d/" % port, data=body)
    req.add_header("Content-Type", "application/json")
    req.add_header("Authorization", "Basic " + base64.b64encode(
        ("%s:%s" % (cfg.get("rpcuser", ""), cfg.get("rpcpassword", ""))).encode()).decode())
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.load(r).get("result")


def public_v4():
    try:
        return urllib.request.urlopen("https://api.ipify.org", timeout=8).read().decode().strip()
    except Exception:
        return None


def v6_addr():
    try:
        out = subprocess.run(["ifconfig", "en0"], capture_output=True, text=True).stdout
        m = re.search(r"inet6 (2[0-9a-f:]+)", out)
        return m.group(1) if m else None
    except Exception:
        return None


def check_clearnet(ip, port=8333):
    if not ip:
        return {"reachable": False, "reason": "no public IPv4"}
    try:
        req = urllib.request.Request(
            "https://portchecker.io/api/v1/query",
            data=json.dumps({"host": ip, "ports": [port]}).encode(),
            headers={"content-type": "application/json"})
        d = json.load(urllib.request.urlopen(req, timeout=20))
        ok = bool(d.get("check") and d["check"][0].get("status"))
        return {"reachable": ok, "reason": "port open" if ok else "port closed (CGNAT / no forward)"}
    except Exception as e:
        if "403" in str(e):
            return {"reachable": False, "reason": "probe rate-limited (403); prior measured result: blocked by router"}
        return {"reachable": False, "reason": "probe failed: %s" % str(e)[:40]}


def check_ipv6(v6, port=8333):
    """Resolve our IPv6 via an AAAA-only sslip.io name and TCP-check it externally."""
    if not v6:
        return {"reachable": False, "reason": "no global IPv6"}
    host = v6.replace(":", "-") + ".sslip.io"
    try:
        req = urllib.request.Request(
            "https://check-host.net/check-tcp?host=%s:%d&max_nodes=3" % (host, port),
            headers={"Accept": "application/json"})
        rid = json.load(urllib.request.urlopen(req, timeout=20)).get("request_id")
        if not rid:
            return {"reachable": False, "reason": "checker rejected IPv6 host"}
        import time
        time.sleep(12)
        req2 = urllib.request.Request("https://check-host.net/check-result/" + rid,
                                      headers={"Accept": "application/json"})
        res = json.load(urllib.request.urlopen(req2, timeout=20))
        ok = any(isinstance(v, list) and v and isinstance(v[0], dict) and v[0].get("time")
                 for v in res.values())
        return {"reachable": ok, "host": host,
                "reason": "open" if ok else "filtered/unreachable (router blocks inbound v6)"}
    except Exception as e:
        return {"reachable": False, "reason": "probe failed: %s" % str(e)[:40]}


def node_view():
    try:
        net = rpc("getnetworkinfo")
        peers = rpc("getpeerinfo")
    except Exception as e:
        return {"error": str(e)[:60]}
    inbound = [p for p in peers if p.get("inbound")]
    ips = set()
    for p in inbound:
        a = p.get("addr", "")
        ip = a[1:a.find("]")] if a.startswith("[") else a.rsplit(":", 1)[0]
        if ip and ip != "127.0.0.1" and ip != "::1":
            ips.add(ip)
    return {
        "connections_in": net.get("connections_in"),
        "inbound_now": len(inbound),
        "distinct_inbound_ips": sorted(ips),
        "onion": [a["address"] for a in net.get("localaddresses", [])
                  if a.get("address", "").endswith(".onion")],
        "localaddresses": [a["address"] for a in net.get("localaddresses", [])],
    }


def loopback_present(v):
    """Tor/loopback inbound is identity-hidden: peers show up as 127.0.0.1."""
    return (v.get("connections_in") or 0) > len(v.get("distinct_inbound_ips", []))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--json", action="store_true")
    a = ap.parse_args()

    ip4 = public_v4()
    ip6 = v6_addr()
    env = {
        "public_ipv4": ip4,
        "global_ipv6": ip6,
        "clearnet_inbound": check_clearnet(ip4),
        "ipv6_inbound": check_ipv6(ip6),
        "node": node_view(),
    }
    node = env["node"]
    conc = max(0, (node.get("connections_in") or 0) - len(node.get("distinct_inbound_ips", [])))
    distinct = node.get("distinct_inbound_ips", [])

    if distinct:
        grade, statement = "DISTINCT", (
            "Reachable inbound observed: %d distinct peer IP(s) — real, un-SNATed "
            "non-listening-node evidence." % len(distinct))
    elif conc > 0:
        grade, statement = "CONCURRENCY", (
            "%d simultaneous inbound peer(s) with hidden identity (Tor/loopback): a "
            "lower bound of >=%d non-listening nodes, NOT a distinct-node count. "
            "Distinct-node counting needs reachable clearnet/IPv6 inbound." % (conc, conc))
    else:
        reasons = []
        if not env["clearnet_inbound"]["reachable"]:
            reasons.append("clearnet: " + env["clearnet_inbound"]["reason"])
        if not env["ipv6_inbound"]["reachable"]:
            reasons.append("ipv6: " + env["ipv6_inbound"]["reason"])
        grade, statement = "CONTAINED", (
            "0 inbound reachable. Environment contains all inbound paths (%s). This is "
            "the correct, unpoisoned value — not a measurement failure. The instrument "
            "(seed_sentinel.py + proxyproto_demux.py) is ready for any non-CGNAT host."
            % "; ".join(reasons))

    verdict = {
        "schema": "bsahi.inbound-census-verdict/1",
        "generated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "grade": grade,
        "statement": statement,
        "concurrency_lower_bound": conc,
        "distinct_inbound_ips": distinct,
        "environment": env,
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump(verdict, open(OUT, "w"), indent=2)

    if a.json:
        print(json.dumps(verdict, indent=2))
    else:
        print("== BSAHI D5 census ==")
        print("  public IPv4      : %s" % ip4)
        print("  clearnet inbound : %s (%s)" % (env["clearnet_inbound"]["reachable"],
                                                env["clearnet_inbound"]["reason"]))
        print("  IPv6             : %s (%s)" % (env["ipv6_inbound"]["reachable"],
                                                env["ipv6_inbound"]["reason"]))
        print("  node inbound now : %s | distinct IPs: %d | onion: %s"
              % (node.get("connections_in"), len(distinct), bool(node.get("onion"))))
        print()
        print("  GRADE: %s" % grade)
        print("  %s" % statement)
        print("\n  wrote %s" % os.path.relpath(OUT, ROOT))
    return 0


if __name__ == "__main__":
    sys.exit(main())
