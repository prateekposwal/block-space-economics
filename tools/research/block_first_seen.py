#!/usr/bin/env python3
"""First-party block first-seen per peer (population-geography Phase 5).

Which of OUR peers handed us the block, and were they clearnet or onion?

Bitcoin Core's getpeerinfo exposes, per peer:
  last_block       unix time of the last block received/requested from that peer
  network          ipv4 | ipv6 | onion | i2p | cjdns   -> clearnet vs overlay
  connection_type  outbound-full-relay | block-relay-only | inbound | ...
  inbound          bool
  addr / addrbind  the peer address

Method (no config change, no restart):
  poll getbestblockhash; when the tip changes AND the node is not in
  initial-block-download/reindex, sample getpeerinfo and keep every peer whose
  last_block falls inside a short window of the change. The peer with the
  EARLIEST last_block is the first-seen relay for that block.

WHAT THIS IS / IS NOT
  * First-party only: it is the block-relay view of ONE node among its <=N peers,
    not the network. It says who told US first, not who mined the block.
  * last_block is a per-peer timestamp with second granularity, so ties are real
    and are reported as a set, not invented into a single winner.
  * While the node is in IBD/reindex there is no peer block relay to observe, so
    blocks are NOT recorded — the run is marked IBD and only the peer-composition
    snapshot is kept.
Writes captured-data/blocks/peer_relay.jsonl (append) + data/peer_relay.json.
"""
import argparse
import collections
import datetime
import json
import os
import subprocess
import time

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, "data", "peer_relay.json")
CDF_OUT = os.path.join(ROOT, "data", "propagation_cdf.json")
LOG_DIR = os.path.join(ROOT, "captured-data", "blocks")
LOG = os.path.join(LOG_DIR, "peer_relay.jsonl")
CLI = os.path.join(os.path.expanduser("~"), ".local", "bin", "bitcoin-cli")
RPC = ["-rpcuser=bsahi", "-rpcpassword=bsahi"]
CLEARNET = {"ipv4", "ipv6"}


def rpc(method, *params):
    try:
        out = subprocess.run([CLI] + RPC + [method] + list(params),
                             capture_output=True, text=True, timeout=20)
        if out.returncode != 0:
            return None
        return json.loads(out.stdout)
    except Exception:
        return None


def net_class(network):
    if network in CLEARNET:
        return "clearnet"
    if network in ("onion", "i2p", "cjdns"):
        return "overlay"
    return "unknown"


def composition(peers):
    comp = {"total": len(peers), "by_network": {}, "by_class": {}, "by_direction": {}}
    for p in peers:
        n = p.get("network", "unknown")
        comp["by_network"][n] = comp["by_network"].get(n, 0) + 1
        c = net_class(n)
        comp["by_class"][c] = comp["by_class"].get(c, 0) + 1
        d = "inbound" if p.get("inbound") else "outbound"
        comp["by_direction"][d] = comp["by_direction"].get(d, 0) + 1
    return comp


def sample_block(best, height, window_s):
    """Build the relay record for a block that just arrived from a peer."""
    now = int(time.time())
    peers = rpc("getpeerinfo") or []
    cands = []
    for p in peers:
        lb = p.get("last_block")
        if isinstance(lb, int) and (now - lb) <= window_s:
            cands.append({
                "peer_id": p.get("id"), "addr": p.get("addr"),
                "network": p.get("network"), "class": net_class(p.get("network")),
                "inbound": p.get("inbound"), "connection_type": p.get("connection_type"),
                "last_block": lb, "subver": p.get("subver"),
                "bip152_hb_to": p.get("bip152_hb_to"),      # we requested them as a HB peer
                "bip152_hb_from": p.get("bip152_hb_from"),  # they requested us as a HB peer
            })
    cands.sort(key=lambda c: c["last_block"])
    first_ts = cands[0]["last_block"] if cands else None
    first = [c for c in cands if c["last_block"] == first_ts] if first_ts else []
    return {
        "kind": "block", "hash": best, "height": height,
        "detected_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "candidates": cands,
        "first_seen": first,
        "first_class": first[0]["class"] if first else None,
        "spread_s": (cands[-1]["last_block"] - cands[0]["last_block"]) if len(cands) > 1 else 0,
    }


def append(row):
    os.makedirs(LOG_DIR, exist_ok=True)
    with open(LOG, "a") as f:
        f.write(json.dumps(row) + "\n")


def load_rows(kind):
    rows = []
    if os.path.exists(LOG):
        with open(LOG) as f:
            for line in f:
                if not line.strip():
                    continue
                try:
                    r = json.loads(line)
                except Exception:
                    continue
                if r.get("kind") == kind:
                    rows.append(r)
    return rows


def _cdf(deltas, cap=60):
    """[[t_seconds, cumulative_pct], ...] for every whole second up to min(max,cap)."""
    if not deltas:
        return []
    ds = sorted(deltas)
    n = len(ds)
    out, i = [], 0
    for t in range(0, min(ds[-1], cap) + 1):
        while i < n and ds[i] <= t:
            i += 1
        out.append([t, round(100 * i / n, 2)])
    return out


def build_cdf(blocks):
    """Propagation CDF from first-party per-peer last_block deltas.

    Each block's peers are measured RELATIVE to the earliest last_block among our
    own peers for that block, so this is a within-node relay curve, not a global
    one. Split by network class (clearnet vs overlay) and by BIP152 high-bandwidth
    membership.
    """
    all_d, by_cls, hb_d, nonhb_d = [], collections.defaultdict(list), [], []
    wins, firsts, peers = collections.Counter(), collections.Counter(), set()
    for b in blocks:
        cands = b.get("candidates") or []
        if not cands:
            continue
        base = min(c["last_block"] for c in cands)
        for c in cands:
            d = c["last_block"] - base
            cls = c.get("class") or "unknown"
            hb = bool(c.get("bip152_hb_to") or c.get("bip152_hb_from"))
            all_d.append(d)
            by_cls[cls].append(d)
            (hb_d if hb else nonhb_d).append(d)
            if c.get("addr"):
                peers.add(c["addr"])
        for f in (b.get("first_seen") or []):
            wins[(f.get("addr"), f.get("class"))] += 1
        firsts[b.get("first_class") or "unknown"] += 1

    total = len(all_d)
    doc = {
        "schema": "bsahi.propagation-cdf/1",
        "layer": "observed",
        "generated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "source": ("first-party getpeerinfo last_block deltas per block "
                   "(tools/research/block_first_seen.py)"),
        "status": "OK" if total else "AWAITING_SYNCED_RELAY",
        "blocks_observed": sum(1 for b in blocks if b.get("candidates")),
        "peer_sightings": total,
        "distinct_peers": len(peers),
        "delta_cdf": _cdf(all_d),
        "by_class_cdf": {k: _cdf(v) for k, v in by_cls.items()},
        "high_bandwidth": {
            "hb_sightings": len(hb_d), "hb_cdf": _cdf(hb_d),
            "non_hb_sightings": len(nonhb_d), "non_hb_cdf": _cdf(nonhb_d),
        },
        "first_seen_counts": dict(firsts),
        "top_first_seen_peers": [[a, c, n] for (a, c), n in wins.most_common(10)],
        "note": ("FIRST-PARTY: deltas are relative to the earliest last_block among "
                 "OUR peers for that block — a within-node relay curve, not a global "
                 "propagation measurement. getpeerinfo timestamps are second-granular, "
                 "so ties are a set, not a single winner."),
    }
    if not total:
        doc["note"] = ("Structure is valid but empty: no synced-relay blocks yet "
                       "(node still reindexing). Fills automatically once IBD clears.")
    return doc


def build():
    blocks = load_rows("block")
    comps = load_rows("composition")
    by_class = {}
    for b in blocks:
        c = b.get("first_class") or "unknown"
        by_class[c] = by_class.get(c, 0) + 1
    latest_comp = comps[-1] if comps else None
    doc = {
        "schema": "bsahi.peer-relay/1",
        "layer": "observed",
        "generated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "source": "local Bitcoin Core getpeerinfo (last_block/network/connection_type) polled by tools/research/block_first_seen.py",
        "peer_composition": (latest_comp or {}).get("composition"),
        "blocks_observed": len(blocks),
        "first_seen_by_class": by_class,
        "blocks": blocks[-200:],
        "note": ("FIRST-PARTY: the relay view of THIS node among its own peers, not "
                 "the network. 'first_seen' = peer(s) with the earliest last_block "
                 "inside the detection window; second granularity means ties are a "
                 "set. It says who relayed the block to us, NOT who mined it. Blocks "
                 "are not recorded while the node is in IBD/reindex (no peer relay)."),
    }
    with open(OUT, "w") as f:
        json.dump(doc, f, indent=2)
    with open(CDF_OUT, "w") as f:
        json.dump(build_cdf(blocks), f, indent=2)
    return doc


def run(watch, poll_s, window_s, comp_every_s):
    prev = None          # last tip we have accounted for
    last_comp = 0.0
    ibd_state = None     # so the IBD/synced switch is logged ONCE, not every poll
    while True:
        info = rpc("getblockchaininfo")
        if info:
            raw_ibd = info.get("initialblockdownload")
            ibd = True if raw_ibd is None else bool(raw_ibd)   # unknown -> safe (don't record)
            best, height = info.get("bestblockhash"), info.get("blocks")
            if ibd_state is None or ibd != ibd_state:
                print(("IBD/reindex (height %s) — not recording relay; switches on "
                       "automatically when it clears" % height) if ibd
                      else "synced — now recording block relay from peers", flush=True)
                ibd_state = ibd
                prev = best      # never mistake the IBD->synced tip for a fresh block
            if ibd:
                prev = best      # blocks are replayed from disk, not relayed
            elif prev is None:
                prev = best      # adopt the current tip without recording it
            elif best and best != prev:
                row = sample_block(best, height, window_s)
                append(row)
                print("block %s h=%s first=%s (%s) cands=%d"
                      % (row["hash"][:16], row["height"],
                         (row["first_seen"][0]["addr"] if row["first_seen"] else "?"),
                         row["first_class"], len(row["candidates"])), flush=True)
                prev = best
        now = time.time()
        if now - last_comp >= comp_every_s or last_comp == 0.0:
            peers = rpc("getpeerinfo") or []
            if peers:
                append({"kind": "composition",
                        "at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
                        "composition": composition(peers)})
                build()
                last_comp = now
        if not watch:
            break
        time.sleep(poll_s)
    build()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--watch", action="store_true", help="poll continuously (for launchd)")
    ap.add_argument("--poll", type=int, default=5)
    ap.add_argument("--window", type=int, default=60, help="seconds: peer last_block within this is a candidate")
    ap.add_argument("--composition-every", type=int, default=900)
    ap.add_argument("--build-only", action="store_true", help="just rebuild data/peer_relay.json")
    args = ap.parse_args()
    if args.build_only:
        d = build()
        print("peer-relay: rebuilt from log — %d blocks observed" % d["blocks_observed"])
        return
    run(args.watch, args.poll, args.window, args.composition_every)


if __name__ == "__main__":
    main()
