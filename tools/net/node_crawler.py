#!/usr/bin/env python3
"""First-party reachable-node crawler (build-ourselves #2).

Dials the Bitcoin P2P network ourselves and completes a version/verack handshake
with each peer, so the reachable-node census, network class and client/version
mix are OUR measurement — not btcnodes/bitref.

Address sources, in order (deduped):
  1. our own addrman   — `bitcoin-cli getnodeaddresses 0` (PUBLIC gossip only)
  2. DNS seeds         — A/AAAA records (Core mainnet seeds)
  3. an optional file  — one host[:port] per line (--addrs)

Per address: TCP connect -> send version -> read the peer's version -> parse
protocol / services / user-agent / start height -> send verack -> close. Nothing
is stored beyond the handshake, and nothing is requested (no getaddr/getdata).

WHAT THIS IS / IS NOT
  * Reachable = answered the handshake, i.e. LISTENING nodes. Nodes behind NAT /
    non-listening are invisible to this and every other crawler -> a FLOOR.
  * Single vantage: coverage is biased by where we sit (CGNAT, one ASN).
  * Onion/I2P are NOT dialed by default (they need a SOCKS/overlay transport);
    their addresses are counted from gossip but excluded from the reachable rate.

Usage:
  node_crawler.py --dry-run                 # inventory addresses, dial nothing
  node_crawler.py --limit 300 --out /tmp/x  # bounded test run
  node_crawler.py --full                    # whole address set (slow)
Writes captured-data/crawl/<ts>.jsonl (raw) + data/node_crawl.json (aggregate).
"""
import argparse
import asyncio
import collections
import datetime
import hashlib
import json
import os
import random
import socket
import struct
import subprocess
import time

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, "data", "node_crawl.json")
CAP = os.path.join(ROOT, "captured-data", "crawl")
CLI = os.path.join(os.path.expanduser("~"), ".local", "bin", "bitcoin-cli")
RPC = ["-rpcuser=bsahi", "-rpcpassword=bsahi"]

MAGIC = bytes.fromhex("f9beb4d9")
PROTOCOL_VERSION = 70016
SERVICES = 1 | 8  # NODE_NETWORK | NODE_WITNESS
UA = "/bsahi-crawler:0.1/"
DNS_SEEDS = ["seed.bitcoin.sipa.be", "dnsseed.bluematt.me", "seed.bitcoinstats.com",
             "seed.bitcoin.jonasschnelli.ch", "seed.btc.petertodd.net",
             "seed.bitcoin.sprovoost.nl", "dnsseed.emzy.de", "seed.bitcoin.wiz.biz"]
SVC_NAMES = {1: "NODE_NETWORK", 2: "NODE_GETUTXO", 4: "NODE_BLOOM", 8: "NODE_WITNESS",
             1024: "NODE_NETWORK_LIMITED", 2048: "NODE_COMPACT_FILTERS"}


# ---------------------------------------------------------------- wire format
def checksum(p):
    return hashlib.sha256(hashlib.sha256(p).digest()).digest()[:4]


def varint(n):
    if n < 0xfd:
        return bytes([n])
    if n <= 0xffff:
        return b"\xfd" + struct.pack("<H", n)
    return b"\xfe" + struct.pack("<I", n)


def varstr(s):
    b = s.encode() if isinstance(s, str) else s
    return varint(len(b)) + b


def msg(command, payload=b""):
    return (MAGIC + command.encode().ljust(12, b"\x00") +
            struct.pack("<I", len(payload)) + checksum(payload) + payload)


def netaddr(ip, port):
    packed = socket.inet_pton(socket.AF_INET6, ip) if ":" in ip else \
        b"\x00" * 10 + b"\xff\xff" + socket.inet_aton(ip)
    return struct.pack("<Q", SERVICES) + packed + struct.pack(">H", port)


def version_payload(ip, port):
    return (struct.pack("<i", PROTOCOL_VERSION) + struct.pack("<Q", SERVICES) +
            struct.pack("<q", int(time.time())) + netaddr(ip, port) +
            netaddr("0.0.0.0", 0) + struct.pack("<Q", random.getrandbits(64)) +
            varstr(UA) + struct.pack("<i", 0) + b"\x01")


def _varstr_at(buf, off):
    n = buf[off]
    off += 1
    if n == 0xfd:
        n = struct.unpack_from("<H", buf, off)[0]; off += 2
    elif n == 0xfe:
        n = struct.unpack_from("<I", buf, off)[0]; off += 4
    return buf[off:off + n].decode("utf-8", "replace"), off + n


def parse_version(payload):
    """version, services, timestamp, 2 net addrs, nonce, user_agent, start_height."""
    if len(payload) < 80:
        return {}
    version, services = struct.unpack_from("<iQ", payload, 0)
    # layout: version(4) services(8) timestamp(8) addr_recv(26) addr_from(26) nonce(8)
    off = 4 + 8 + 8 + 26 + 26 + 8
    try:
        ua, off = _varstr_at(payload, off)
        sh = struct.unpack_from("<i", payload, off)[0] if len(payload) >= off + 4 else None
    except Exception:
        ua, sh = None, None
    return {"protocol": version, "services": services, "user_agent": ua[:64] if ua else None,
            "start_height": sh}


# ------------------------------------------------------------ address sources
def addrman(include_overlay=False):
    try:
        r = subprocess.run([CLI] + RPC + ["getnodeaddresses", "0"],
                           capture_output=True, text=True, timeout=60)
        rows = json.loads(r.stdout) if r.returncode == 0 else []
    except Exception:
        rows = []
    out = []
    for a in rows:
        net = a.get("network")
        if net in ("onion", "i2p", "cjdns") and not include_overlay:
            continue
        out.append((a["address"], a.get("port", 8333), net))
    return out


def dns_seeds():
    out = []
    for s in DNS_SEEDS:
        try:
            for fam, _, _, _, sa in socket.getaddrinfo(s, 8333, proto=socket.IPPROTO_TCP):
                out.append((sa[0], 8333, "ipv6" if fam == socket.AF_INET6 else "ipv4"))
        except Exception:
            continue
    return out


def gather(include_overlay, addr_file):
    seen, addrs = set(), []
    src = collections.Counter()
    for ip, port, net in addrman(include_overlay) + dns_seeds():
        key = "%s:%s" % (ip, port)
        if key in seen:
            continue
        seen.add(key)
        addrs.append((ip, port, net))
        src[net] += 1
    if addr_file and os.path.exists(addr_file):
        for line in open(addr_file):
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            ip, _, p = line.partition(":")
            if ip not in seen:
                seen.add(ip)
                net = "ipv6" if ":" in ip else "ipv4"
                addrs.append((ip, int(p or 8333), net))
                src["file"] += 1
    return addrs, src


# ------------------------------------------------------------------ the crawl
async def crawl_one(sem, ip, port, net, timeout, results):
    async with sem:
        t0 = time.time()
        row = {"addr": ip, "port": port, "network": net, "reachable": False}
        try:
            reader, writer = await asyncio.wait_for(asyncio.open_connection(ip, port), timeout)
            try:
                writer.write(msg("version", version_payload(ip, port)))
                await writer.drain()
                got, sent_verack = None, False
                end = time.time() + timeout
                while time.time() < end:
                    header = await asyncio.wait_for(reader.readexactly(24), timeout)
                    if header[:4] != MAGIC:
                        raise ValueError("bad magic")
                    cmd = header[4:16].rstrip(b"\x00").decode("utf-8", "replace")
                    plen = struct.unpack_from("<I", header, 16)[0]
                    payload = await asyncio.wait_for(reader.readexactly(plen), timeout) if plen else b""
                    if cmd == "version":
                        got = parse_version(payload)
                        if not sent_verack:
                            writer.write(msg("verack")); await writer.drain(); sent_verack = True
                    elif cmd == "verack" and got is not None:
                        break
                if got:
                    row.update(got)
                    row["reachable"] = True
                    row["latency_ms"] = round((time.time() - t0) * 1000, 1)
            finally:
                try:
                    writer.close()
                except Exception:
                    pass
        except Exception as e:
            row["error"] = type(e).__name__
        results.append(row)


async def crawl(addrs, concurrency, timeout, max_seconds):
    sem = asyncio.Semaphore(concurrency)
    results = []
    t0 = time.time()
    tasks = []
    for ip, port, net in addrs:
        if time.time() - t0 > max_seconds:
            break
        tasks.append(asyncio.create_task(crawl_one(sem, ip, port, net, timeout, results)))
        if len(tasks) % 500 == 0:
            await asyncio.sleep(0)   # let the loop breathe
    if tasks:
        await asyncio.gather(*tasks, return_exceptions=True)
    return results


# --------------------------------------------------------------------- report
def build(results, src_counts, elapsed, tip_height):
    reach = [r for r in results if r.get("reachable")]
    by_net = collections.Counter(r["network"] for r in reach)
    by_ua = collections.Counter(r.get("user_agent") or "unknown" for r in reach)
    by_proto = collections.Counter(r.get("protocol") for r in reach)
    svc = collections.Counter()
    heights = []
    for r in reach:
        s = r.get("services") or 0
        if s & 1:                       # a node offering both is a FULL node
            svc["NODE_NETWORK"] += 1
        elif s & 1024:
            svc["NODE_NETWORK_LIMITED"] += 1
        else:
            svc["other"] += 1
        if isinstance(r.get("start_height"), int) and r["start_height"] > 0:
            heights.append(r["start_height"])
    # Offline geo/ASN enrichment (no per-request API). Skips if the DB is absent.
    by_country, by_asn = collections.Counter(), collections.Counter()
    geo_ok = False
    try:
        import geo_db
        if geo_db.load():
            geo_ok = True
            for r in reach:
                g = geo_db.lookup(r["addr"])
                if g.get("country"):
                    by_country[g["country"]] += 1
                if g.get("asn"):
                    by_asn[(g["asn"], g.get("org") or "")] += 1
    except Exception:
        pass
    located = sum(by_country.values())
    lag = None
    if heights and tip_height:
        below = sum(1 for h in heights if tip_height - h > 6)
        lag = {"peers_reporting_height": len(heights), "behind_more_than_6_blocks": below,
               "share_synced_pct": round(100 * (len(heights) - below) / len(heights), 2)}
    doc = {
        "schema": "bsahi.node-crawl/1",
        "layer": "observed",
        "generated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "source": "first-party handshake crawler (tools/net/node_crawler.py); addresses from local addrman + DNS seeds",
        "attempted": len(results),
        "reachable": len(reach),
        "reachable_pct": round(100 * len(reach) / len(results), 2) if results else None,
        "elapsed_s": round(elapsed, 1),
        "address_pool": dict(src_counts),
        "by_network": dict(by_net),
        "by_user_agent_top": by_ua.most_common(15),
        "by_protocol": dict(by_proto),
        "services": dict(svc),
        "by_country": by_country.most_common(),
        "by_asn_top": [[a, o, n] for (a, o), n in by_asn.most_common(10)],
        "located_pct": round(100 * located / len(reach), 2) if reach else None,
        "geo_source": ("iptoasn ip2asn offline DB (captured-data/geo)" if geo_ok
                       else "unavailable — offline geo DB not built"),
        "sync": lag,
        "our_tip_height": tip_height,
        "sample_reachable": sorted(x["addr"] for x in reach)[:50],
        "note": ("FIRST-PARTY reachable census. Reachable = completed the handshake, "
                 "i.e. LISTENING nodes; NAT'd/non-listening are invisible to every "
                 "crawler, so this is a FLOOR. Single vantage (one ASN/site) and "
                 "onion/I2P excluded from dialing by default."),
    }
    return doc


def tip():
    try:
        r = subprocess.run([CLI] + RPC + ["getblockchaininfo"], capture_output=True,
                           text=True, timeout=20)
        return json.loads(r.stdout).get("blocks")
    except Exception:
        return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true", help="inventory only, dial nothing")
    ap.add_argument("--full", action="store_true", help="crawl the whole pool (default: --limit)")
    ap.add_argument("--limit", type=int, default=300, help="max addresses when not --full")
    ap.add_argument("--concurrency", type=int, default=100)
    ap.add_argument("--timeout", type=float, default=4.0)
    ap.add_argument("--max-seconds", type=int, default=1800)
    ap.add_argument("--include-overlay", action="store_true", help="include onion/i2p in the pool count")
    ap.add_argument("--addrs", default=None, help="extra host[:port] file")
    ap.add_argument("--enrich-raw", default=None,
                    help="rebuild data/node_crawl.json from an existing raw jsonl (no dialing)")
    args = ap.parse_args()

    if args.enrich_raw:
        raw = args.enrich_raw
        if raw == "latest":                      # enrich the newest crawl on disk
            cand = ([os.path.join(CAP, x) for x in os.listdir(CAP)] if os.path.isdir(CAP) else [])
            cand = [p for p in cand if p.endswith(".jsonl")]
            raw = max(cand, key=os.path.getmtime) if cand else None
            if not raw:
                print("no raw crawl files under %s" % CAP)
                return
        rows = []
        with open(raw) as f:
            for line in f:
                if line.strip():
                    try:
                        rows.append(json.loads(line))
                    except Exception:
                        pass
        doc = build(rows, {"enriched_from": os.path.basename(raw)}, 0.0, tip())
        with open(OUT, "w") as f:
            json.dump(doc, f, indent=2)
        print("enriched %d rows -> %s" % (len(rows), OUT))
        print("  reachable %d | by_country %s" % (doc["reachable"], doc["by_country"][:8]))
        print("  top ASN %s" % doc["by_asn_top"][:4])
        return

    addrs, src = gather(args.include_overlay, args.addrs)
    print("address pool: %d (%s)" % (len(addrs), dict(src)))
    if args.dry_run:
        print("dry-run: nothing dialed. Widen with --full, bound with --limit N.")
        return
    if not args.full:
        random.shuffle(addrs)
        addrs = addrs[:args.limit]
    print("dialing %d addresses @ concurrency %d, timeout %.1fs" % (len(addrs), args.concurrency, args.timeout))

    t0 = time.time()
    results = asyncio.run(crawl(addrs, args.concurrency, args.timeout, args.max_seconds))
    elapsed = time.time() - t0
    doc = build(results, src, elapsed, tip())

    os.makedirs(CAP, exist_ok=True)
    ts = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    with open(os.path.join(CAP, "crawl_%s.jsonl" % ts), "w") as f:
        for r in results:
            f.write(json.dumps(r) + "\n")
    with open(OUT, "w") as f:
        json.dump(doc, f, indent=2)

    print("node-crawl: %d/%d reachable (%.1f%%) in %.0fs"
          % (doc["reachable"], doc["attempted"], doc["reachable_pct"] or 0, elapsed))
    print("  by network: %s" % doc["by_network"])
    print("  top user agents: %s" % doc["by_user_agent_top"][:3])
    print("  -> %s" % OUT)


if __name__ == "__main__":
    main()
