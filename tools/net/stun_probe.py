#!/usr/bin/env python3
"""STUN binding discovery — find the CGNAT external mapping of a UDP socket.

Implements RFC 5389 Binding Request/Response properly (the blueprint version had
a malformed host, never parsed the reply, and used UDP). Prints the external
IP:port the carrier NAT assigned, plus the local socket, so we can test whether
that mapping is actually usable for unsolicited inbound.
"""
import os, socket, struct, sys

MAGIC = 0x2112A442
STUN_SERVERS = [("stun.l.google.com", 19302), ("stun1.l.google.com", 19302),
                ("stun.cloudflare.com", 3478)]


def binding_request():
    tid = os.urandom(12)
    msg = struct.pack(">HHI", 0x0001, 0x0000, MAGIC) + tid
    return msg, tid


def parse(resp, tid):
    t, length, magic = struct.unpack(">HHI", resp[:8])
    rtid = resp[8:20]
    if rtid != tid:
        return None
    out = {}
    p = 20
    while p + 4 <= 20 + length:
        at, al = struct.unpack(">HH", resp[p:p+4])
        val = resp[p+4:p+4+al]
        if at in (0x0020, 0x0001):             # XOR-MAPPED / MAPPED-ADDRESS
            fam = val[1]
            xport = struct.unpack(">H", val[2:4])[0]
            port = xport ^ (MAGIC >> 16) if at == 0x0020 else xport
            if fam == 0x01:
                raw = struct.unpack(">I", val[4:8])[0]
                ip = socket.inet_ntoa(struct.pack(">I", raw ^ (MAGIC if at == 0x0020 else 0)))
            else:
                raw = val[4:20]
                ip = socket.inet_ntop(socket.AF_INET6, bytes(
                    a ^ b for a, b in zip(raw, struct.pack(">I", MAGIC) + tid)))
            out["external"] = (ip, port)
        p += 4 + al + ((4 - al % 4) % 4)
    return out


def main():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    s.bind(("0.0.0.0", 0))
    local = s.getsockname()
    print("local UDP socket      : %s:%d" % local)
    for host, port in STUN_SERVERS:
        try:
            s.settimeout(5)
            req, tid = binding_request()
            s.sendto(req, (host, port))
            resp, _ = s.recvfrom(2048)
            got = parse(resp, tid) or {}
            ext = got.get("external")
            if ext:
                print("STUN %-22s -> external mapping %s:%d" % (host, ext[0], ext[1]))
                print("   NAT translated port : %s -> %s" % (local[1], ext[1]))
                print("   (mapping is per-flow; a different destination gets a DIFFERENT port)")
            else:
                print("STUN %-22s -> no mapping in reply" % host)
        except Exception as e:
            print("STUN %-22s -> %s" % (host, str(e)[:50]))
    s.close()


if __name__ == "__main__":
    main()
