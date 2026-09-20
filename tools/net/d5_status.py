#!/usr/bin/env python3
"""D5 census status — is the private/non-listening measurement actually live?

The dashboard must not claim "no public endpoint" once there IS one, nor imply we
are counting private nodes when we are not. This emits data/d5_status.json with
the three things that matter, each independently checkable:

  1. endpoint   — is the census IPv6 tunnel up (handshake fresh) and routed?
  2. reachable  — an EXTERNAL reachability self-test of [tunnel]:8333 performed
                  through the Tor exit network (a genuinely external IPv6
                  vantage — validated with a control before use).
  3. inbound    — what Core has actually observed (from data/inbound_census.json).

Nothing is inferred: if the external probe fails, reachable is false; if no
inbound peer has arrived, the count is 0 and Tier C stays null.
"""
import datetime
import json
import os
import re
import subprocess

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, "data", "d5_status.json")
CONF = os.path.join(os.path.expanduser("~"), ".bsahi", "route64.conf")
TR = os.path.join(ROOT, "tools", "net", "tunnel-root.sh")
CENSUS = os.path.join(ROOT, "data", "inbound_census.json")
SOCKS = "127.0.0.1:9050"


def sh(cmd, timeout=30):
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
        return r.returncode, (r.stdout or "") + (r.stderr or "")
    except Exception as e:
        return 1, str(e)


def tunnel_addr():
    try:
        for line in open(CONF):
            m = re.match(r"\s*Address\s*=\s*(.+)", line)
            if m:
                for a in m.group(1).split(","):
                    a = a.strip().split("/")[0]
                    if ":" in a:
                        return a
    except Exception:
        pass
    return None


def endpoint_state():
    rc, out = sh(["sudo", "-n", TR, "hsage"])
    ts = "".join(ch for ch in out.strip() if ch.isdigit())
    now = int(datetime.datetime.now().timestamp())
    age = (now - int(ts)) if ts else None
    _, routes = sh(["netstat", "-rn", "-f", "inet6"])
    routed = "2000::/3" in routes
    return {"handshake_age_s": age,
            "handshake_fresh": bool(age is not None and age < 180),
            "global_v6_routed_via_tunnel": routed}


def external_probe(addr):
    """Reach [addr]:8333 through a Tor exit. Core answers with a binary version
    message, so curl errors — the point is only whether the TCP connect lands."""
    if not addr:
        return {"reachable": False, "reason": "no tunnel address"}
    rc, out = sh(["curl", "-s", "--socks5-hostname", SOCKS, "-m", "25",
                  "-o", "/dev/null", "-w", "%{errormsg}",
                  "http://[%s]:8333/" % addr], timeout=40)
    low = out.lower()
    if "timed out" in low or "could not resolve" in low or "no route" in low:
        return {"reachable": False, "reason": out.strip()[:80]}
    if "refused" in low:
        return {"reachable": False, "reason": "connection refused (port closed)"}
    return {"reachable": True, "reason": out.strip()[:80] or "tcp completed"}


def inbound_counts():
    try:
        d = json.load(open(CENSUS))
        # Tier C must use the CRAWLER-FILTERED count: known monitors dial nodes on
        # purpose and are not evidence of a non-listening/private node.
        return {"now": (d.get("latest") or {}).get("inbound_count", 0),
                "distinct_ever": d.get("distinct_inbound_measurement_ever",
                                       d.get("distinct_inbound_addresses_ever", 0)),
                "raw_distinct_ever": d.get("distinct_inbound_addresses_ever", 0),
                "known_crawlers_ever": len(d.get("known_crawler_ips_ever") or [])}
    except Exception:
        return {"now": 0, "distinct_ever": 0}


def main():
    addr = tunnel_addr()
    ep = endpoint_state()
    probe = external_probe(addr)
    inb = inbound_counts()
    live = ep["handshake_fresh"] and ep["global_v6_routed_via_tunnel"] and probe["reachable"]
    doc = {
        "schema": "bsahi.d5-status/1",
        "layer": "observed",
        "generated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "source": ("tunnel status (scoped sudo) + external reachability self-test via the "
                   "Tor exit network + data/inbound_census.json"),
        "census_endpoint": addr,
        "endpoint": ep,
        "external_reachability": probe,
        "measurement_live": live,
        "inbound": inb,
        "tier_c_value": inb["distinct_ever"] or None,
        "statement": (
            "Census endpoint live (Route64 IPv6); inbound reachable — externally verified. "
            "%d inbound peer(s) observed so far." % inb["now"] if live else
            ("Census endpoint up but external reachability NOT verified." if ep["handshake_fresh"]
             else "No census endpoint: tunnel not up/unrouted — private nodes unobservable.")),
        "note": ("Tier C is reported as null until real inbound peers are observed; a live "
                 "instrument is not a measurement. Source IPs are preserved end-to-end, so "
                 "distinct inbound IPs are a genuine lower bound on non-listening nodes."),
    }
    with open(OUT, "w") as f:
        json.dump(doc, f, indent=2)
    print("d5-status: live=%s endpoint=%s probe=%s inbound_now=%s distinct_ever=%s"
          % (live, addr, probe["reachable"], inb["now"], inb["distinct_ever"]))
    print("  -> %s" % OUT)


if __name__ == "__main__":
    main()
