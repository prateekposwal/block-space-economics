#!/usr/bin/env python3
"""Node-side validation cost, measured (population-geography Phase 1 of the
build-it-ourselves plan — no external API).

A full `-reindex` walks the chain from genesis, validating every block in order on
ONE machine. Bitcoin Core logs an `UpdateTip` line per connected block with the
WALL-CLOCK time, so the reindex is a natural experiment: wall-time between
consecutive tips is the real cost of validating that block on this hardware.

This harvests debug.log into a per-era validation-cost curve:
  blocks/s, ms/block, txs, us/tx  by block-date year.

WHAT THIS IS / IS NOT
  * FIRST-PARTY and measured — the cost side of the SCCR/VCI thesis, which is
    otherwise only MODELLED. No third-party API is involved.
  * SINGLE MACHINE. It is one hardware/OS/disk sample, not the network's average.
  * A REINDEX is not live validation: it re-validates historical blocks without
    gossip/relay/parallel validation, and early eras include startup + coins-cache
    flush overhead. Read RELATIVE movement across eras, not absolute levels.
  * Timestamps are second-granular, so a very fast era can span <1s.

Writes captured-data/validation/updatetip.jsonl + data/validation_cost.json.
"""
import argparse
import collections
import datetime
import json
import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, "data", "validation_cost.json")
CAP = os.path.join(ROOT, "captured-data", "validation")
LOG = os.path.join(os.path.expanduser("~"), "Library", "Application Support",
                   "Bitcoin", "debug.log")
CLI = os.path.join(os.path.expanduser("~"), ".local", "bin", "bitcoin-cli")
RPC = ["-rpcuser=bsahi", "-rpcpassword=bsahi"]

PAT = re.compile(
    r"^(\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d)Z UpdateTip: new best=([0-9a-f]+) height=(\d+) "
    r"version=\S+ log2_work=(\S+) tx=(\d+) date='([^']+)' progress=(\S+)"
    r"(?: cache=(\S+)\((\d+)txo\))?")


def _iso(ts):
    return datetime.datetime.fromtimestamp(ts, datetime.timezone.utc).isoformat()


def harvest(log=LOG):
    rows = []
    with open(log, errors="replace") as f:
        for line in f:
            if "UpdateTip" not in line:
                continue
            m = PAT.match(line)
            if not m:
                continue
            ts = datetime.datetime.fromisoformat(m.group(1) + "+00:00").timestamp()
            rows.append({"ts": ts, "height": int(m.group(3)), "tx": int(m.group(5)),
                         "block_date": m.group(6)[:19], "progress": float(m.group(7)),
                         "cache_txo": int(m.group(9)) if m.group(9) else None})
    # Keep only the CURRENT pass: the tail where heights are strictly increasing.
    i = len(rows) - 1
    while i > 0 and rows[i]["height"] > rows[i - 1]["height"]:
        i -= 1
    return rows[i:]


def era_of(block_date):
    return block_date[:4]


def aggregate(pass_rows):
    eras = collections.OrderedDict()
    for r in pass_rows:
        eras.setdefault(era_of(r["block_date"]), []).append(r)
    out = []
    for era in sorted(eras):
        e = eras[era]
        dt = e[-1]["ts"] - e[0]["ts"]
        blocks = e[-1]["height"] - e[0]["height"]
        txs = e[-1]["tx"] - e[0]["tx"]
        rec = {"era": era, "blocks": blocks, "wall_seconds": int(dt),
               "height_from": e[0]["height"], "height_to": e[-1]["height"],
               "txs": txs, "blocks_per_sec": None, "ms_per_block": None,
               "tx_per_sec": None, "us_per_tx": None}
        if dt > 0:
            rec["blocks_per_sec"] = round(blocks / dt, 3)
            rec["ms_per_block"] = round(1000 * dt / blocks, 3) if blocks else None
            rec["tx_per_sec"] = round(txs / dt, 1)
            rec["us_per_tx"] = round(1e6 * dt / txs, 2) if txs else None
        else:
            rec["note"] = "whole era below the 1s timer resolution"
        out.append(rec)
    return out


def hardware():
    def sysctl(k):
        try:
            return subprocess.run(["sysctl", "-n", k], capture_output=True, text=True,
                                  timeout=10).stdout.strip()
        except Exception:
            return None
    mem = sysctl("hw.memsize")
    return {"model": sysctl("hw.model"), "cpu": sysctl("machdep.cpu.brand_string"),
            "cores": sysctl("hw.ncpu"),
            "mem_gb": round(int(mem) / 1e9, 1) if mem and mem.isdigit() else None}


def rpc(method, *params):
    try:
        r = subprocess.run([CLI] + RPC + [method] + list(params),
                           capture_output=True, text=True, timeout=20)
        return json.loads(r.stdout) if r.returncode == 0 else None
    except Exception:
        return None


def sample_resources():
    """Append one live (height, progress, cpu%) row while the reindex runs."""
    info = rpc("getblockchaininfo")
    if not info:
        return None
    cpu = None
    try:
        ps = subprocess.run(["ps", "-A", "-o", "%cpu,comm"], capture_output=True,
                            text=True, timeout=10).stdout
        for line in ps.splitlines():
            if "bitcoind" in line:
                try:
                    cpu = float(line.split()[0])
                except Exception:
                    pass
                break
    except Exception:
        pass
    row = {"at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
           "height": info.get("blocks"), "progress": info.get("verificationprogress"),
           "ibd": info.get("initialblockdownload"), "bitcoind_cpu_pct": cpu}
    os.makedirs(CAP, exist_ok=True)
    with open(os.path.join(CAP, "resources.jsonl"), "a") as f:
        f.write(json.dumps(row) + "\n")
    return row


def load_resources(limit=200):
    p = os.path.join(CAP, "resources.jsonl")
    if not os.path.exists(p):
        return []
    rows = []
    with open(p) as f:
        for line in f:
            try:
                rows.append(json.loads(line))
            except Exception:
                pass
    return rows[-limit:]


def build(pass_rows=None):
    pass_rows = pass_rows if pass_rows is not None else harvest()
    if not pass_rows:
        print("validation-cost: no UpdateTip rows found", file=sys.stderr)
        return None
    by_era = aggregate(pass_rows)
    dt = pass_rows[-1]["ts"] - pass_rows[0]["ts"]
    blocks = pass_rows[-1]["height"] - pass_rows[0]["height"]
    txs = pass_rows[-1]["tx"] - pass_rows[0]["tx"]
    # relative cost index, anchored on the first era with a measurable rate
    base = next((e for e in by_era if e["ms_per_block"]), None)
    if base:
        for e in by_era:
            e["cost_index_vs_base"] = (round(e["ms_per_block"] / base["ms_per_block"], 2)
                                       if e["ms_per_block"] else None)
    doc = {
        "schema": "bsahi.validation-cost/1",
        "layer": "observed",
        "generated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "source": ("local Bitcoin Core debug.log UpdateTip wall-clock timings during a "
                   "full -reindex (single machine, first-party)"),
        "hardware": hardware(),
        "pass": {
            "start_utc": _iso(pass_rows[0]["ts"]), "end_utc": _iso(pass_rows[-1]["ts"]),
            "from_height": pass_rows[0]["height"], "to_height": pass_rows[-1]["height"],
            "blocks": blocks, "txs": txs, "wall_seconds": int(dt),
            "blocks_per_sec": round(blocks / dt, 3) if dt else None,
            "ms_per_block": round(1000 * dt / blocks, 3) if (dt and blocks) else None,
            "still_reindexing": bool((rpc("getblockchaininfo") or {}).get("initialblockdownload")),
        },
        "by_era": by_era,
        "cost_index_base_era": base["era"] if base else None,
        "resources": load_resources(),
        "caveats": [
            "Single machine and disk: one hardware sample, not the network average.",
            "A -reindex is not live validation (no gossip/relay/parallel validation).",
            "Early eras include reindex startup and coins-cache flush overhead; treat the "
            "first era as anomalous and read RELATIVE movement across eras.",
            "UpdateTip timestamps are second-granular.",
            "Measured node-side cost — the cost side of the SCCR/VCI thesis, otherwise modelled.",
        ],
    }
    with open(OUT, "w") as f:
        json.dump(doc, f, indent=2)
    return doc


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--harvest", action="store_true", help="also dump raw UpdateTip rows")
    ap.add_argument("--sample", action="store_true", help="record one live resource sample")
    args = ap.parse_args()
    if args.sample:
        sample_resources()
    rows = harvest()
    if args.harvest:
        os.makedirs(CAP, exist_ok=True)
        with open(os.path.join(CAP, "updatetip.jsonl"), "w") as f:
            for r in rows:
                f.write(json.dumps(r) + "\n")
    doc = build(rows)
    if doc:
        p = doc["pass"]
        print("validation-cost: h%d->%d in %.1fh | %.2f blocks/s | %.1f ms/block"
              % (p["from_height"], p["to_height"], p["wall_seconds"] / 3600,
                 p["blocks_per_sec"] or 0, p["ms_per_block"] or 0))
        print("  " + " | ".join("%s %sms/blk" % (e["era"], e["ms_per_block"])
                                for e in doc["by_era"] if e["ms_per_block"]))
        print("  -> %s" % OUT)


if __name__ == "__main__":
    main()
