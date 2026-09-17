#!/usr/bin/env python3
"""UTXO / chain-state measurement — the OBSERVED layer (BSAHI Priority #1).

Three state numbers exist in this project and they must never be mixed:

  1. OBSERVED (this tool)      — gettxoutsetinfo from a real Bitcoin Core node.
                                 Authoritative, but only exists for heights we
                                 have actually measured. Grade A where present.
  2. RECONSTRUCTED             — the era estimate table (data/utxo_cost_ratio.json
                                 / VCI utxo_state_gb_table). Grade D: no
                                 continuous source; interpolated from anchors.
  3. CURRENT / LIVE            — the latest observed row (data/utxo_state_latest.json).

This tool is append-only and idempotent by height: run it as often as you like
(cron, launchd, or by hand). It never rewrites history — a correction is a new
row. Raw RPC responses are cached under captured-data/utxo-state/ for audit.

Usage:
  utxo_state_measure.py              # measure now (skips if this height exists)
  utxo_state_measure.py --force      # record even if the height exists
  utxo_state_measure.py --hash none  # fastest: counts/amounts only (no muhash)

RPC config is read from (first found): $BITCOIN_CONF, ~/Library/Application
Support/Bitcoin/bitcoin.conf (macOS), ~/.bitcoin/bitcoin.conf, or
tools/agents/bitcoin.conf. Supports rpcuser/rpcpassword or a cookie file.
"""
import argparse
import base64
import datetime
import json
import os
import re
import socket
import sys
import urllib.error
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SERIES = os.path.join(ROOT, "data", "utxo_state_series.jsonl")
SERIES_JSON = os.path.join(ROOT, "data", "utxo_state_series.json")
LATEST = os.path.join(ROOT, "data", "utxo_state_latest.json")
CACHE_DIR = os.path.join(ROOT, "captured-data", "utxo-state")

CONF_CANDIDATES = [
    os.environ.get("BITCOIN_CONF"),
    os.path.expanduser("~/Library/Application Support/Bitcoin/bitcoin.conf"),
    os.path.expanduser("~/.bitcoin/bitcoin.conf"),
    os.path.join(ROOT, "tools", "agents", "bitcoin.conf"),
]


def find_conf():
    for c in CONF_CANDIDATES:
        if c and os.path.exists(c):
            return c
    return None


def parse_conf(path):
    cfg = {}
    with open(path, "r", errors="ignore") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            cfg[k.strip()] = v.strip()
    return cfg


def rpc(cfg, method, params=None):
    """Minimal JSON-RPC over HTTP — no dependency on the configured node."""
    host = cfg.get("rpcconnect", "127.0.0.1")
    port = cfg.get("rpcport", "8332")
    user = cfg.get("rpcuser")
    pwd = cfg.get("rpcpassword")
    if not user and cfg.get("rpccookiefile"):
        with open(os.path.expanduser(cfg["rpccookiefile"])) as f:
            user, _, pwd = f.read().strip().partition(":")
    if not (user and pwd):
        raise SystemExit(f"no RPC credentials found in {find_conf()}")
    url = f"http://{host}:{port}/"
    body = json.dumps({"jsonrpc": "1.0", "id": "bsahi", "method": method,
                       "params": params or []}).encode()
    req = urllib.request.Request(url, data=body, headers={
        "Content-Type": "application/json",
        "Authorization": "Basic " + base64.b64encode(f"{user}:{pwd}".encode()).decode(),
    })
    try:
        with urllib.request.urlopen(req, timeout=600) as r:
            d = json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"{method}: {e.code} {e.read().decode()[:200]}")
    except (urllib.error.URLError, socket.timeout) as e:
        raise SystemExit(f"cannot reach the node at {url} — is bitcoind running? ({e})")
    if d.get("error"):
        raise RuntimeError(f"{method}: {d['error']}")
    return d["result"]


def write_site_series():
    """Rebuild the site-readable JSON series + summary from the append-only log."""
    rows = sorted(load_series(), key=lambda r: r["height"])
    # keep the last few rows per height (raw log may hold re-measurements)
    dedup = {}
    for r in rows:
        dedup[r["height"]] = r
    rows = [dedup[h] for h in sorted(dedup)]
    doc = {
        "schema": "bsahi.utxo-state-series/1",
        "layer": "observed",
        "note": ("OBSERVED gettxoutsetinfo measurements from a real Bitcoin Core node. "
                 "This is NOT the reconstructed era table (grade D) and must not be mixed with it."),
        "count": len(rows),
        "rows": rows,
    }
    with open(SERIES_JSON, "w") as f:
        json.dump(doc, f, indent=2)
    return len(rows)


def load_series():
    rows = []
    if os.path.exists(SERIES):
        with open(SERIES) as f:
            for line in f:
                line = line.strip()
                if line:
                    rows.append(json.loads(line))
    return rows


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--hash", default="muhash", choices=["muhash", "hash_serialized_2", "none"])
    args = ap.parse_args()

    conf_path = find_conf()
    if not conf_path:
        raise SystemExit("no bitcoin.conf found")
    cfg = parse_conf(conf_path)

    info = rpc(cfg, "getblockchaininfo")
    height = info["blocks"]
    headers = info["headers"]
    ibd = info.get("initialblockdownload", headers > height)

    rows = load_series()
    if any(r["height"] == height for r in rows) and not args.force:
        n = write_site_series()
        print(f"height {height} already recorded — series has {n} row(s) (use --force to re-record)")
        return

    # gettxoutsetinfo is the measurement. 'none' returns counts/amounts without a
    # hash; muhash gives a verifiable commitment to the set.
    utxo = rpc(cfg, "gettxoutsetinfo", [args.hash])

    # On-disk chainstate size (real bytes the node carries), when derivable.
    disk_bytes = None
    try:
        chainstate_dir = os.path.join(cfg.get("datadir", os.path.expanduser("~/Library/Application Support/Bitcoin")), "chainstate")
        if os.path.isdir(chainstate_dir):
            disk_bytes = sum(os.path.getsize(os.path.join(chainstate_dir, f))
                             for f in os.listdir(chainstate_dir) if os.path.isfile(os.path.join(chainstate_dir, f)))
    except Exception:
        pass

    rec = {
        "schema": "bsahi.utxo-state/1",
        "layer": "observed",
        "measured_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "height": height,
        "bestblock": utxo.get("bestblock"),
        "utxo_count": utxo.get("txouts"),
        "total_amount_btc": utxo.get("total_amount"),
        "disk_size_bytes": utxo.get("disk_size"),          # node's own UTXO DB size
        "chainstate_disk_bytes": disk_bytes,               # actual chainstate dir bytes
        "bogosize_bytes": utxo.get("bogosize"),
        "hash_type": args.hash,
        "utxo_hash": utxo.get("muhash") or utxo.get("hash_serialized_2"),
        "verificationprogress": round(info.get("verificationprogress", 0), 6),
        "headers": headers,
        "initialblockdownload": bool(ibd),
        "source": {"rpc": f"{cfg.get('rpcconnect','127.0.0.1')}:{cfg.get('rpcport','8332')}",
                   "conf": conf_path, "tool": "tools/research/utxo_state_measure.py"},
    }

    os.makedirs(CACHE_DIR, exist_ok=True)
    with open(os.path.join(CACHE_DIR, f"gettxoutsetinfo_{height}.json"), "w") as f:
        json.dump(utxo, f, indent=2)
    with open(os.path.join(CACHE_DIR, f"getblockchaininfo_{height}.json"), "w") as f:
        json.dump(info, f, indent=2)

    with open(SERIES, "a") as f:
        f.write(json.dumps(rec) + "\n")
    write_site_series()
    # newest wins for 'latest' (and we never mix layers in this file)
    with open(LATEST, "w") as f:
        json.dump(rec, f, indent=2)

    print(json.dumps({k: rec[k] for k in ("height", "utxo_count", "total_amount_btc",
                                          "disk_size_bytes", "initialblockdownload",
                                          "verificationprogress")}, indent=2))
    print(f"\nappended -> {os.path.relpath(SERIES, ROOT)}  (rows: {len(load_series())})")
    if ibd:
        print("NOTE: node is still in initial block download — this height is NOT the "
              "chain tip. Row recorded as OBSERVED-AT-HEIGHT, not 'current'.")


if __name__ == "__main__":
    main()
