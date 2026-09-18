#!/usr/bin/env python3
"""Pool infrastructure probe (mining-geography reverse engineering, step 1).

Question: can we learn WHERE mining happens by geolocating mining-pool stratum
endpoints? Method: resolve each pool's stratum hostname, geolocate the address
with the offline geo DB, and measure TCP connect RTT.

MEASURED ANSWER: no. Every major pool fronts its stratum endpoints with a CDN
(Cloudflare, AS13335), so the resolved address is the CDN edge, not the pool's
origin servers — and the pool's workers (the miners we actually want) never
appear at all. This tool records that fact with data instead of asserting it, and
flags each pool as fronted/unfronted.

It does NOT connect to submit shares or mine. It is a DNS + TCP-connect probe.

WHAT THIS IS / IS NOT
  * Pool INFRASTRUCTURE reachability/RTT — not miner geography.
  * If 'fronted_by_cdn' is true, the country/ASN is the CDN's, NOT the pool's.
Writes data/pool_infrastructure.json.
"""
import datetime
import json
import os
import socket
import subprocess
import sys
import time

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, "data", "pool_infrastructure.json")
sys.path.insert(0, os.path.join(ROOT, "tools", "net"))

# Curated pool -> stratum hostname(s). Hostnames are the pools' public endpoints;
# several from the ME paper (Cao et al. 2021) have since gone away.
POOLS = {
    "F2Pool": ["btc.f2pool.com"],
    "ViaBTC": ["btc.viabtc.com"],
    "AntPool": ["stratum.antpool.com"],
    "Binance Pool": ["stratum.binance.com"],
    "Braiins/Slush": ["stratum.braiins.com"],
    "Foundry USA": ["foundryusapool.com"],
    "Luxor": ["pool.luxor.tech"],
    "OCEAN": ["pool.ocean.xyz"],
    "Kano": ["jp.kano.is"],
}
PORTS = [3333, 1800, 25, 8888, 443]
CDN_HINTS = ("CLOUDFLARE", "FASTLY", "AKAMAI", "CLOUDFRONT", "IMPERVA", "CDN77",
             "GOOGLE-", "AMAZON-02")


def resolve(host):
    ips = []
    for fam in (socket.AF_INET, socket.AF_INET6):
        try:
            for _, _, _, _, sa in socket.getaddrinfo(host, None, fam, socket.SOCK_STREAM):
                if sa[0] not in ips:
                    ips.append(sa[0])
        except Exception:
            pass
    return ips


def rtt(ip, port, timeout=3.0, tries=3):
    best = None
    for _ in range(tries):
        t0 = time.time()
        try:
            s = socket.create_connection((ip, port), timeout=timeout)
            dt = (time.time() - t0) * 1000
            s.close()
            best = dt if best is None else min(best, dt)
        except Exception:
            continue
        time.sleep(0.05)
    return round(best, 1) if best is not None else None


def geolocate(ip):
    try:
        import geo_db
        return geo_db.lookup(ip)
    except Exception as e:
        return {"error": str(e)[:50]}


def main():
    rows = []
    for pool, hosts in POOLS.items():
        entry = {"pool": pool, "hosts": {}}
        for h in hosts:
            ips = resolve(h)
            hrec = {"resolved": ips, "addresses": []}
            for ip in ips[:2]:
                g = geolocate(ip)
                rec = {"ip": ip, "country": g.get("country"), "asn": g.get("asn"),
                       "org": g.get("org")}
                org = (g.get("org") or "").upper()
                rec["fronted_by_cdn"] = any(x in org for x in CDN_HINTS)
                for p in PORTS:
                    ms = rtt(ip, p)
                    if ms is not None:
                        rec["stratum_port_open"] = p
                        rec["rtt_ms"] = ms
                        break
                hrec["addresses"].append(rec)
            entry["hosts"][h] = hrec
        rows.append(entry)

    fronted = sum(1 for e in rows for h in e["hosts"].values()
                  for a in h["addresses"] if a.get("fronted_by_cdn"))
    total_addr = sum(1 for e in rows for h in e["hosts"].values() for a in h["addresses"])
    doc = {
        "schema": "bsahi.pool-infrastructure/1",
        "layer": "observed",
        "generated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "source": "DNS resolution + TCP connect RTT of public pool stratum endpoints, geolocated with the offline ip2asn DB",
        "pools_probed": len(rows),
        "addresses_geolocated": total_addr,
        "fronted_by_cdn": fronted,
        "verdict": ("CDN-fronted: pool endpoint IPs are edge addresses, so this "
                    "method CANNOT locate mining. Miner geography needs pool-held "
                    "worker IPs (CBECI method) or on-chain exchange-flow inference."),
        "pools": rows,
        "note": ("Pool INFRASTRUCTURE only — never miners. Where fronted_by_cdn is "
                 "true the country/ASN belong to the CDN, not the pool. Recorded to "
                 "document why pool-IP geolocation is not a viable mining-geography "
                 "method."),
    }
    with open(OUT, "w") as f:
        json.dump(doc, f, indent=2)
    print("pool-infrastructure: %d pools, %d addresses, %d CDN-fronted"
          % (doc["pools_probed"], doc["addresses_geolocated"], fronted))
    for e in rows:
        for h, hr in e["hosts"].items():
            a = (hr["addresses"] or [{}])[0]
            print("  %-14s %-24s %-16s %s rtt=%s%s"
                  % (e["pool"], h, a.get("country") or "-", a.get("org") or "-",
                     a.get("rtt_ms"), " [CDN]" if a.get("fronted_by_cdn") else ""))
    print("  -> %s" % OUT)


if __name__ == "__main__":
    main()
