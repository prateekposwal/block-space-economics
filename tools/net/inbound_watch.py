#!/usr/bin/env python3
"""Watch node inbound peers until the Tor onion ramps.

Samples connections_in + the inbound peer list on an interval and appends one
line per sample to ~/Library/Logs/bsahi-inbound.log, so the ramp (or its absence)
can be reviewed after the fact. Exits on its own after --hours.

The authoritative measurement stays inbound_census.py (hourly, via the
collector); this is a higher-resolution watch for the initial ramp.

Usage:
  python3 tools/net/inbound_watch.py --interval 600 --hours 6
"""
import argparse
import base64
import datetime
import json
import os
import time
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CONF = os.path.expanduser("~/Library/Application Support/Bitcoin/bitcoin.conf")
LOG = os.path.expanduser("~/Library/Logs/bsahi-inbound.log")
STATE = os.path.join(ROOT, "data", "inbound_census.json")


def rpc(method, params=None, timeout=8):
    user = password = ""
    with open(CONF) as f:
        for line in f:
            if line.startswith("rpcuser="):
                user = line.split("=", 1)[1].strip()
            elif line.startswith("rpcpassword="):
                password = line.split("=", 1)[1].strip()
    port = 8332
    with open(CONF) as f:
        for line in f:
            if line.startswith("rpcport="):
                port = int(line.split("=", 1)[1].strip())
    body = json.dumps({"jsonrpc": "1.0", "id": "w", "method": method,
                       "params": params or []}).encode()
    req = urllib.request.Request("http://127.0.0.1:%d/" % port, data=body)
    req.add_header("Content-Type", "application/json")
    req.add_header("Authorization", "Basic " + base64.b64encode(
        ("%s:%s" % (user, password)).encode()).decode())
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.load(r).get("result")


def stamp():
    return datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def log(msg):
    line = "%s %s" % (stamp(), msg)
    print(line, flush=True)
    try:
        with open(LOG, "a") as f:
            f.write(line + "\n")
    except Exception:
        pass


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--interval", type=int, default=600, help="seconds between samples")
    ap.add_argument("--hours", type=float, default=6.0, help="stop after this long")
    args = ap.parse_args()

    deadline = time.monotonic() + args.hours * 3600
    last = None
    log("inbound watch start (interval %ds, %.1fh)" % (args.interval, args.hours))
    while time.monotonic() < deadline:
        try:
            ni = rpc("getnetworkinfo")
            peers = rpc("getpeerinfo")
            hin = [p for p in peers if p.get("inbound")]
            onion = [a["address"] for a in ni.get("localaddresses", [])
                     if a.get("address", "").endswith(".onion")]
            ci = ni.get("connections_in")
            detail = ", ".join(sorted({p.get("addr", "?") for p in hin})[:3])
            log("connections_in=%s inbound_peers=%d onion=%s%s"
                % (ci, len(hin), (onion[0][:16] + "…") if onion else "none",
                   (" [" + detail + "]") if detail else ""))
            if ci and ci > 0 and last == 0:
                log("RAMPED — first inbound peers detected over the onion")
            last = ci
        except Exception as e:
            log("sample error: %s" % str(e)[:100])
        time.sleep(args.interval)
    log("inbound watch end")


if __name__ == "__main__":
    main()
