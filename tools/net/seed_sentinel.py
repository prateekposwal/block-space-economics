#!/usr/bin/env python3
"""Minimal Bitcoin *seeding* sentinel — the correct form of the "hired sentinel".

WHY NOT A BARE LISTENER (measured 2026-09-18):
  A plain TCP 8333 listener receives nothing (or port scanners). Bitcoin nodes only
  dial addresses they learned via `addr` gossip or the hardcoded DNS seeds. So a
  listener is undiscoverable, and any traffic it did see would be scanner noise — not
  non-listening validators. Shipping that would poison the census.

WHAT THIS DOES INSTEAD (discoverability first):
  1. connects OUT to real peers (DNS-seeded),
  2. completes the version/verack handshake,
  3. advertises our own public address via `addr` so peers add us to their addrman,
  4. only then can inbound peers arrive — which are the evidence we actually want.

It deliberately uses plaintext v1 (BIP-324 v2 is optional in Core and not required
to be discovered). Needs a host with a PUBLIC reachable IP; no root for port 8333.

  tools/net/seed_sentinel.py --listen 8333 --advertise <public_ip>:8333 --log data/sentinel.jsonl
  tools/net/seed_sentinel.py --selftest          # handshake against the local node
"""
import argparse
import datetime
import hashlib
import json
import os
import random
import socket
import struct
import threading
import time

MAGIC = bytes.fromhex("f9beb4d9")
PROTOCOL_VERSION = 70016
SERVICES = 1  # NODE_NETWORK
DEFAULT_SEEDS = ["seed.bitcoin.sipa.be", "dnsseed.bluematt.me", "seed.bitcoinstats.com"]


def now():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


def checksum(payload):
    return hashlib.sha256(hashlib.sha256(payload).digest()).digest()[:4]


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
    if ":" in ip:                                   # ipv6 -> 16 bytes
        packed = socket.inet_pton(socket.AF_INET6, ip)
    else:                                           # ipv4 -> v4-mapped
        packed = b"\x00" * 10 + b"\xff\xff" + socket.inet_aton(ip)
    return struct.pack("<Q", SERVICES) + packed + struct.pack(">H", port)


def version_payload(ip, port):
    return (struct.pack("<i", PROTOCOL_VERSION) + struct.pack("<Q", SERVICES) +
            struct.pack("<q", int(time.time())) +
            netaddr(ip, port) + netaddr("0.0.0.0", 0) +
            struct.pack("<Q", random.getrandbits(64)) +
            varstr("/bsahi-sentinel:0.1/") + struct.pack("<i", 0) + b"\x01")


def read_exact(sock, n):
    buf = b""
    while len(buf) < n:
        c = sock.recv(n - len(buf))
        if not c:
            raise EOFError("peer closed")
        buf += c
    return buf


def read_message(sock):
    header = read_exact(sock, 24)
    if header[:4] != MAGIC:
        raise ValueError("bad magic: %s" % header[:4].hex())
    command = header[4:16].rstrip(b"\x00").decode(errors="replace")
    length = struct.unpack("<I", header[16:20])[0]
    payload = read_exact(sock, length) if length else b""
    return command, payload


def handshake(sock, ip, port, log):
    sock.sendall(msg("version", version_payload(ip, port)))
    saw_version = saw_verack = False
    sock.settimeout(10)
    for _ in range(6):
        cmd, _ = read_message(sock)
        if cmd == "version":
            saw_version = True
            sock.sendall(msg("verack"))
        elif cmd == "verack":
            saw_verack = True
        if saw_version and saw_verack:
            return True
    return False


def self_test(ip, port):
    """Prove our serialization against the running local node."""
    print("==> selftest: handshake against %s:%d" % (ip, port))
    s = socket.create_connection((ip, port), timeout=10)
    ok = handshake(s, "127.0.0.1", 8333, print)
    print("   handshake complete:", ok)
    if ok:
        s.sendall(msg("getaddr"))          # ask for peers; a real peer replies with addr
        s.settimeout(6)
        try:
            for _ in range(5):
                cmd, payload = read_message(s)
                print("   <- %s (%d bytes)" % (cmd, len(payload)))
        except Exception as e:
            print("   (no further msgs: %s)" % str(e)[:40])
    s.close()
    return ok


def advertise(sock, ip, port):
    """Send one addr message advertising ourselves (the discovery step)."""
    self_addr = netaddr(ip, port)
    payload = varint(1) + struct.pack("<I", int(time.time())) + self_addr
    sock.sendall(msg("addr", payload))


def run(listen_port, adv_ip, adv_port, log_path, seeds, rounds):
    lock = threading.Lock()
    seen = set()

    def log_rec(rec):
        with lock:
            with open(log_path, "a") as f:
                f.write(json.dumps(rec) + "\n")

    # --- inbound: only reached once we are in peers' addrman ---
    def listener():
        srv = socket.socket()
        srv.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        srv.bind(("0.0.0.0", listen_port))
        srv.listen(64)
        print("listening on %d" % listen_port, flush=True)
        while True:
            c, a = srv.accept()
            c.settimeout(5)
            try:
                first = c.recv(4)
            except Exception:
                first = b""
            bitcoin = first == MAGIC
            rec = {"at": now(), "src_ip": a[0], "src_port": a[1], "bitcoin_peer": bitcoin}
            if bitcoin and a[0] not in seen:
                seen.add(a[0])
            log_rec(rec)
            print("%s %s" % ("PEER" if bitcoin else "conn", a[0]), flush=True)
            c.close()

    threading.Thread(target=listener, daemon=True).start()

    # --- outbound: get discovered ---
    for r in range(rounds):
        for seed in seeds:
            try:
                ips = [i[4][0] for i in socket.getaddrinfo(seed, 8333, socket.AF_INET)]
            except Exception:
                continue
            random.shuffle(ips)
            for ip in ips[:2]:
                try:
                    s = socket.create_connection((ip, 8333), timeout=8)
                    if handshake(s, adv_ip, adv_port, print):
                        advertise(s, adv_ip, adv_port)
                        print("advertised %s:%d to %s" % (adv_ip, adv_port, ip), flush=True)
                    s.close()
                except Exception:
                    pass
        time.sleep(60)
        print("distinct validator IPs so far: %d" % len(seen), flush=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--selftest", action="store_true")
    ap.add_argument("--listen", type=int, default=8333)
    ap.add_argument("--advertise", default=None, help="public_ip:port peers should dial")
    ap.add_argument("--log", default="data/sentinel.jsonl")
    ap.add_argument("--seeds", default=",".join(DEFAULT_SEEDS))
    ap.add_argument("--rounds", type=int, default=60)
    a = ap.parse_args()
    if a.selftest:
        raise SystemExit(0 if self_test("127.0.0.1", 8333) else 1)
    if not a.advertise:
        raise SystemExit("--advertise public_ip:port is required (the address peers will dial)")
    # Advertise may be an IPv4 host:port or an IPv6 literal, bracketed or not.
    adv = a.advertise.strip()
    if adv.startswith("["):
        ip, _, port = adv[1:].partition("]:")
    else:
        ip, _, port = adv.rpartition(":")
        if not ip:            # no colon at all -> whole string is the host
            ip, port = adv, "8333"
    os.makedirs(os.path.dirname(a.log) or ".", exist_ok=True)
    run(a.listen, ip, int(port or 8333), a.log, a.seeds.split(","), a.rounds)


if __name__ == "__main__":
    main()
