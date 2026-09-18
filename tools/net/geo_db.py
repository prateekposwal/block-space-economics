#!/usr/bin/env python3
"""Offline IP -> country / ASN / org database (build-ourselves #3).

One downloaded asset, then NO per-request geo API. Source: iptoasn.com
(ip2asn-v4.tsv.gz / ip2asn-v6.tsv.gz) — no signup, refreshed daily upstream, and
each row carries country AND ASN AND the org name, so it covers everything we
previously borrowed from btcnodes/bitref location data.

Rows are (range_start, range_end, asn, cc, org). We parse them into parallel
sorted arrays once and binary-search (bisect) per lookup — all local.

Files live under captured-data/geo/ (pipeline state, not committed). Refresh is
gated to once per REFRESH_DAYS so a daily caller stays polite.

CLI:
  geo_db.py --update                 # (re)download if stale
  geo_db.py --stats                  # ranges loaded + coverage
  geo_db.py --lookup 8.8.8.8 [::1]
"""
import argparse
import bisect
import datetime
import gzip
import ipaddress
import json
import os
import time
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
GEO = os.path.join(ROOT, "captured-data", "geo")
SOURCES = {"v4": "https://iptoasn.com/data/ip2asn-v4.tsv.gz",
           "v6": "https://iptoasn.com/data/ip2asn-v6.tsv.gz"}
UA = {"User-Agent": "bitcoinsahi-research/1.0 (+https://bitcoinsahi.com)"}
REFRESH_DAYS = 7

_STATE = {}


def _path(v):
    return os.path.join(GEO, "ip2asn-%s.tsv.gz" % v)


def _fresh(v):
    p = _path(v)
    if not os.path.exists(p):
        return False
    age = (time.time() - os.path.getmtime(p)) / 86400
    return age < REFRESH_DAYS


def update(force=False):
    os.makedirs(GEO, exist_ok=True)
    out = {}
    for v, url in SOURCES.items():
        if not force and _fresh(v):
            out[v] = "fresh"
            continue
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=120) as r:
                data = r.read()
            with open(_path(v), "wb") as f:
                f.write(data)
            out[v] = "updated %d bytes" % len(data)
        except Exception as e:
            out[v] = "FAILED: %s" % str(e)[:60]
    return out


def _v6(s):
    return ":" in s


def load():
    """Parse both files into parallel sorted arrays. Cached per process."""
    if _STATE:
        return _STATE
    for v in ("v4", "v6"):
        p = _path(v)
        if not os.path.exists(p):
            continue
        starts, ends, asns, ccs, orgs = [], [], [], [], []
        with gzip.open(p, "rt", errors="replace") as f:
            for line in f:
                parts = line.rstrip("\n").split("\t")
                if len(parts) < 5:
                    continue
                try:
                    a = int(ipaddress.IPv6Address(parts[0])) if v == "v6" else \
                        int(ipaddress.IPv4Address(parts[0]))
                    b = int(ipaddress.IPv6Address(parts[1])) if v == "v6" else \
                        int(ipaddress.IPv4Address(parts[1]))
                except Exception:
                    continue
                asn = parts[2] if parts[2] not in ("", "0", "NA") else None
                cc = parts[3] if parts[3] and parts[3] != "None" else None
                org = parts[4].strip() or None
                starts.append(a); ends.append(b); asns.append(asn)
                ccs.append(cc); orgs.append(org)
        order = sorted(range(len(starts)), key=lambda i: starts[i])
        _STATE[v] = {
            "starts": [starts[i] for i in order],
            "ends": [ends[i] for i in order],
            "asns": [asns[i] for i in order],
            "ccs": [ccs[i] for i in order],
            "orgs": [orgs[i] for i in order],
        }
    return _STATE


def lookup(ip):
    v = "v6" if _v6(ip) else "v4"
    st = load().get(v)
    if not st:
        return {"ip": ip, "country": None, "asn": None, "org": None,
                "note": "no %s database loaded" % v}
    try:
        n = int(ipaddress.IPv6Address(ip)) if v == "v6" else int(ipaddress.IPv4Address(ip))
    except Exception:
        return {"ip": ip, "country": None, "asn": None, "org": None, "note": "bad ip"}
    i = bisect.bisect_right(st["starts"], n) - 1
    if i >= 0 and n <= st["ends"][i]:
        return {"ip": ip, "country": st["ccs"][i], "asn": st["asns"][i], "org": st["orgs"][i]}
    return {"ip": ip, "country": None, "asn": None, "org": None, "note": "no range match"}


def stats():
    st = load()
    return {v: {"ranges": len(st[v]["starts"]),
                "with_country": sum(1 for c in st[v]["ccs"] if c),
                "with_asn": sum(1 for a in st[v]["asns"] if a)}
            for v in st}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--update", action="store_true")
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--stats", action="store_true")
    ap.add_argument("--lookup", nargs="*")
    args = ap.parse_args()
    if args.update or args.force:
        print("update:", json.dumps(update(force=args.force)))
    if args.stats:
        print("stats:", json.dumps(stats(), indent=1))
    for ip in (args.lookup or []):
        print(json.dumps(lookup(ip)))


if __name__ == "__main__":
    main()
