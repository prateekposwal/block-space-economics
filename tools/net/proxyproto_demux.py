#!/usr/bin/env python3
"""PROXY-protocol demuxer — recover real peer IPs for the D5 inbound census.

WHY THIS EXISTS
  On a CGNAT link the node cannot accept inbound, and routing through a plain
  proxy/Tor collapses every peer to the relay's address (or 127.0.0.1), which
  destroys identity. This sits behind a public entry point that speaks the HAProxy
  PROXY protocol (v1 or v2): the entry point prepends the peer's real source
  address to the TCP stream. We parse that header, record the TRUE source IP, strip
  it, and forward the clean stream to the local bitcoind.

  Bitcoin Core cannot parse PROXY headers on 8333, so this demuxer is what makes a
  source-preserving relay usable. `getpeerinfo` on bitcoind will show 127.0.0.1;
  the REAL IPs live in the demuxer's JSONL, which is the census evidence.

REAL-PEER FILTER
  A raw TCP connect is not a node (scanners, health checks). A connection counts as
  a Bitcoin peer only if the first 4 bytes it sends are the network magic
  (mainnet f9beb4d9) — a cheap L4 filter that needs no handshake state.

TOPOLOGY
  peers -> [public entry: HAProxy send-proxy-v2] -> [reverse tunnel] ->
  this demuxer :8334 -> bitcoind 127.0.0.1:8333

Usage:
  python3 tools/net/proxyproto_demux.py --listen 8334 --forward 8333 \
      --log data/proxy_inbound.jsonl
"""
import argparse
import datetime
import json
import os
import socket
import struct
import threading
import time

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
MAGIC = bytes.fromhex("f9beb4d9")          # bitcoin mainnet
V2_SIG = b"\r\n\r\n\x00\r\nQUIT\n"         # 12 bytes (NOT 16)
PIPE_BUF = 65536


def _now():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


def read_proxy_header(sock):
    """Return (src_ip, src_port, leftover) from a PROXY v1/v2 header, or raise."""
    sock.settimeout(5)
    first = b""
    while len(first) < 16:
        chunk = sock.recv(16 - len(first))
        if not chunk:
            raise ValueError("closed before header")
        first += chunk
        if len(first) >= 6 and first[:6] == b"PROXY ":
            break
        if len(first) == 16:
            break

    if first.startswith(V2_SIG):
        rest = first[len(V2_SIG):]              # 12-byte signature, not 16
        while len(rest) < 4:
            rest += sock.recv(4 - len(rest))
        ver_cmd, fam, length = rest[0], rest[1], struct.unpack(">H", rest[2:4])[0]
        body = rest[4:]
        while len(body) < length:
            body += sock.recv(length - len(body))
        if fam >> 4 == 0x1:                        # AF_INET
            src = socket.inet_ntoa(body[0:4])
            sport = struct.unpack(">H", body[8:10])[0]
        elif fam >> 4 == 0x2:                      # AF_INET6
            src = socket.inet_ntop(socket.AF_INET6, body[0:16])
            sport = struct.unpack(">H", body[32:34])[0]
        else:
            src, sport = "", 0
        return src, sport, b""

    if first.startswith(b"PROXY "):
        buf = first
        while b"\r\n" not in buf:
            buf += sock.recv(128)
        line, leftover = buf.split(b"\r\n", 1)
        parts = line.decode("latin1").split()
        # PROXY TCP4 src dst sport dport | PROXY UNKNOWN
        if len(parts) >= 6:
            return parts[2], int(parts[4]), leftover
        return "", 0, leftover

    raise ValueError("no PROXY header (first bytes: %r)" % first[:12])


def pipe(src, dst):
    try:
        while True:
            data = src.recv(PIPE_BUF)
            if not data:
                break
            dst.sendall(data)
    except Exception:
        pass
    finally:
        try:
            dst.shutdown(socket.SHUT_WR)
        except Exception:
            pass


def _log(rec, log_path, lock):
    with lock:
        try:
            with open(log_path, "a") as f:
                f.write(json.dumps(rec) + "\n")
        except Exception:
            pass
    if rec.get("ok"):
        print("%s src=%s:%s" % ("PEER" if rec["bitcoin_peer"] else "conn",
                                rec["src_ip"], rec["src_port"]), flush=True)


def handle(client, addr, fwd_host, fwd_port, log_path, lock):
    rec = {"at": _now(), "proxy_peer": addr[0], "src_ip": None, "src_port": None,
           "bitcoin_peer": False, "ok": False}
    up = None
    try:
        src_ip, src_port, leftover = read_proxy_header(client)
        rec["src_ip"], rec["src_port"] = src_ip, src_port
        # Classify from the header leftover + whatever arrives next. Written to the
        # log IMMEDIATELY: the evidence must not depend on the connection ending
        # (bitcoind can hold it open indefinitely).
        first = leftover or b""
        client.settimeout(0.4)
        try:
            while len(first) < 4:
                c = client.recv(4 - len(first))
                if not c:
                    break
                first += c
        except socket.timeout:
            pass
        finally:
            client.settimeout(None)
        rec["bitcoin_peer"] = first[:4] == MAGIC
        rec["ok"] = True
        up = socket.create_connection((fwd_host, fwd_port), timeout=10)
        if first:
            up.sendall(first)
        _log(rec, log_path, lock)
        t0 = time.time()
        t1 = threading.Thread(target=pipe, args=(client, up), daemon=True)
        t2 = threading.Thread(target=pipe, args=(up, client), daemon=True)
        t1.start(); t2.start(); t1.join(); t2.join()
    except Exception as e:
        rec["error"] = str(e)[:80]
        if rec["src_ip"] is None:
            _log(rec, log_path, lock)          # record the failed connection too
    finally:
        for s in (client, up):
            try:
                if s:
                    s.close()
            except Exception:
                pass


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--listen", type=int, default=8334)
    ap.add_argument("--forward", type=int, default=8333)
    ap.add_argument("--forward-host", default="127.0.0.1")
    ap.add_argument("--bind", default="0.0.0.0")
    ap.add_argument("--log", default=os.path.join(ROOT, "data", "proxy_inbound.jsonl"))
    args = ap.parse_args()

    srv = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    srv.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    srv.bind((args.bind, args.listen))
    srv.listen(64)
    print("proxyproto demuxer: :%d -> %s:%d  (log %s)"
          % (args.listen, args.forward_host, args.forward, args.log), flush=True)
    lock = threading.Lock()
    while True:
        client, addr = srv.accept()
        threading.Thread(target=handle,
                         args=(client, addr, args.forward_host, args.forward, args.log, lock),
                         daemon=True).start()


if __name__ == "__main__":
    main()
