#!/usr/bin/env python3
"""One-shot node upgrade — fires automatically the moment the reindex finishes.

Why queued: the machine is at 75% reindex and only ~77 MB RAM is free. Restarting
now would be pointless (the node is mid-validation) and risky. So this waits for
`initialblockdownload == false`, then applies the quality upgrade ONCE, restarts
bitcoind a single time, and verifies the node came back at the same height (a
restart must never trigger a reindex).

Gates (all must pass):
  * getblockchaininfo reachable
  * initialblockdownload == False
  * the marker captured-data/node-upgrade.json does not exist

Applies:
  blocksonly=1 -> 0     become a full-relay peer (the single biggest quality win)
  prune=5000 -> 50000   keep ~50 GB instead of ~5 GB, so we can serve real history

Deliberately NOT applied, recorded in the conf as commented lines with the reason:
  blockfilterindex=1 / coinstatsindex=1  — enabling an index starts a full
  background index build (all ~967k blocks re-read). That is exactly the I/O+RAM
  load that crashed this node once. Enable by hand once the machine has headroom.

DROPPED: zmqpubrawblock / zmqpubrawtx. They were queued here but NOTHING consumes
them — pyzmq is not installed and no subscriber exists — so enabling them would
have been a config advertising a capability the project does not exercise. The one
edge they were meant to buy (custody spends seen BEFORE confirmation, for the
bridge watchtower) is available from Esplora's per-address mempool endpoint, which
is already our data path, without adding a dependency. If sub-second block-arrival
timing is ever wanted, add ZMQ deliberately together with its consumer.

Run `--selftest` to check the conf rewrite (pure, idempotent) without touching the
live conf.

Backs up bitcoin.conf before touching it. Idempotent: the marker makes it one-shot.
"""
import datetime
import json
import os
import re
import subprocess
import time

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CAP = os.path.join(ROOT, "captured-data")
MARKER = os.path.join(CAP, "node-upgrade.json")
NOTICE = os.path.join(ROOT, "data", "node_upgrade_notice.json")
CONF = os.path.join(os.path.expanduser("~"), "Library", "Application Support", "Bitcoin", "bitcoin.conf")
CLI = os.path.join(os.path.expanduser("~"), ".local", "bin", "bitcoin-cli")
BITCOIND = os.path.join(os.path.expanduser("~"), ".local", "bin", "bitcoind")
RPC = ["-rpcuser=bsahi", "-rpcpassword=bsahi"]

SET = {"prune": "50000", "blocksonly": "0"}
ADD = [
    "# Added by apply_node_upgrade.py after the reindex completed (full-relay):",
    "# NOT enabled on purpose: an index build re-reads every block and needs RAM/IO this",
    "# 8 GB host does not have spare (it OOM-crashed once). Uncomment when there is headroom.",
    "#blockfilterindex=1",
    "#coinstatsindex=1",
    "#peerblockfilters=1",
]


def now():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


def rpc(method, *params, timeout=25):
    try:
        r = subprocess.run([CLI] + RPC + [method] + list(params),
                           capture_output=True, text=True, timeout=timeout)
        return json.loads(r.stdout) if r.returncode == 0 else None
    except Exception:
        return None


def rewrite_conf(text):
    """Apply SET/ADD to a conf body. Pure + IDEMPOTENT so it can be unit-tested.

    Idempotent matters: the script is one-shot via the marker, but a conf that has
    already been upgraded must not accumulate duplicate appended lines if it ever
    runs again (or if a human re-runs it by hand)."""
    lines = text.split("\n")
    seen = set()
    out = []
    for ln in lines:
        m = re.match(r"\s*([a-zA-Z0-9_]+)\s*=", ln)
        if m and m.group(1) in SET:
            key = m.group(1)
            out.append("%s=%s" % (key, SET[key]))
            seen.add(key)
        else:
            out.append(ln)
    for key, val in SET.items():
        if key not in seen:
            out.append("%s=%s" % (key, val))
    body = "\n".join(out).rstrip("\n")
    missing = [a for a in ADD if a.strip() and a not in body]
    if missing:
        body += "\n\n" + "\n".join(missing)
    return body + "\n"


def main():
    os.makedirs(CAP, exist_ok=True)
    if os.path.exists(MARKER):
        print("node-upgrade: already applied — nothing to do")
        return 0

    info = rpc("getblockchaininfo")
    if info is None:
        print("node-upgrade: RPC unreachable — waiting")
        return 0
    if info.get("initialblockdownload"):
        print("node-upgrade: waiting — still syncing (h%s/%s, %.1f%%)"
              % (info.get("blocks"), info.get("headers"),
                 100.0 * (info.get("blocks") or 0) / max(1, info.get("headers") or 1)))
        return 0

    before_h = info.get("blocks")
    print("node-upgrade: SYNC ED — applying upgrade at height %s" % before_h)

    # 1. back up + rewrite the conf
    if not os.path.exists(CONF):
        print("node-upgrade: no bitcoin.conf at %s — aborting" % CONF)
        return 1
    orig = open(CONF).read()
    bak = CONF + ".bak." + datetime.datetime.now().strftime("%Y%m%d%H%M%S")
    open(bak, "w").write(orig)
    open(CONF, "w").write(rewrite_conf(orig))
    print("  conf updated (backup: %s)" % os.path.basename(bak))

    # 2. one graceful restart
    rpc("stop")
    for _ in range(60):
        if subprocess.run(["pgrep", "-x", "bitcoind"], capture_output=True).returncode != 0:
            break
        time.sleep(1)
    time.sleep(3)
    subprocess.Popen([BITCOIND, "-daemon"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    # 3. wait for it, then prove there was no reindex
    after = None
    for _ in range(60):
        time.sleep(5)
        after = rpc("getblockchaininfo")
        if after:
            break
    ok = bool(after) and (after.get("blocks") or 0) >= (before_h or 0) - 2

    doc = {
        "schema": "bsahi.node-upgrade-notice/1",
        "layer": "observed",
        "source": "tools/net/apply_node_upgrade.py (one-shot; gated on initialblockdownload == false)",
        "generated_at": now(),
        "applied": True,
        "height_before": before_h,
        "height_after": (after or {}).get("blocks"),
        "no_reindex": ok,
        "conf_backup": os.path.basename(bak),
        "changed": {"blocksonly": "0", "prune": "50000"},
        "added": [],
        "dropped_zmq": ("zmqpubrawblock/zmqpubrawtx were queued but have no consumer; "
                        "removed rather than enabled unused. The pre-confirmation mempool "
                        "edge is available via Esplora's per-address mempool endpoint."),
        "deferred_indexes": ["blockfilterindex", "coinstatsindex", "peerblockfilters"],
        "deferred_reason": ("An index build re-reads every block and needs RAM/IO this 8 GB "
                            "host lacks (it OOM-crashed once). Uncomment in bitcoin.conf when "
                            "there is headroom."),
        "note": ("Runs once. Full-relay (blocksonly=0) makes the node materially more useful "
                 "to peers; prune=50000 keeps ~50 GB of history instead of ~5 GB."),
    }
    with open(NOTICE, "w") as f:
        json.dump(doc, f, indent=2)
    with open(MARKER, "w") as f:
        json.dump(doc, f, indent=2)

    print("node-upgrade: applied. height %s -> %s | no_reindex=%s"
          % (before_h, doc["height_after"], ok))
    return 0 if ok else 1


def _selftest():
    """Pure checks on rewrite_conf — never touches the live bitcoin.conf."""
    base = "server=1\nprune=5000\nblocksonly=1\nlisten=1\nrest=1\n"
    once = rewrite_conf(base)
    twice = rewrite_conf(once)
    thrice = rewrite_conf(twice)
    checks = [
        ("prune -> 50000", "prune=50000" in once),
        ("blocksonly -> 0", "blocksonly=0" in once),
        ("no stale prune=5000", "prune=5000\n" not in once),
        ("no stale blocksonly=1", "blocksonly=1\n" not in once),
        ("untouched keys preserved", "server=1" in once and "listen=1" in once and "rest=1" in once),
        ("indexes commented, not enabled", all(("#" + k) in once for k in
            ("blockfilterindex=1", "coinstatsindex=1", "peerblockfilters=1"))),
        ("no zmq lines added", "zmqpubraw" not in once),
        ("idempotent (2nd run == 1st)", twice == once),
        ("idempotent (3rd run == 1st)", thrice == once),
    ]
    ok = True
    for name, good in checks:
        ok &= good
        print("  %-34s %s" % (name, "PASS" if good else "FAIL"))
    print("SELFTEST " + ("PASS" if ok else "FAIL"))
    return 0 if ok else 1


if __name__ == "__main__":
    import sys
    raise SystemExit(_selftest() if "--selftest" in sys.argv else main())
