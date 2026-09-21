#!/usr/bin/env python3
"""IBD / relay watcher — reports the two transitions we are waiting on.

The private-node block-participation number is gated on the node finishing its
reindex. This watcher fires ONCE for each event and records it, so nobody has to
poll by hand:

  1. ibd_cleared          — the first time `initialblockdownload` goes false
                            (the node has caught up; relay capture can begin)
  2. participation_first  — the first time propagation_cdf.json reports a
                            non-zero participation.blocks_observed
                            (i.e. the first measured "% of blocks with an
                            inbound / non-listening announcer")

State lives in captured-data/ibd-watch-state.json (pipeline state, not committed)
so each event fires exactly once. Writes data/ibd_cleared_notice.json.
"""
import datetime
import json
import os
import subprocess

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, "data", "ibd_cleared_notice.json")
STATE = os.path.join(ROOT, "captured-data", "ibd-watch-state.json")
CDF = os.path.join(ROOT, "data", "propagation_cdf.json")
PPE = os.path.join(ROOT, "data", "private_population_estimate.json")
CLI = os.path.join(os.path.expanduser("~"), ".local", "bin", "bitcoin-cli")


def rpc(method):
    try:
        r = subprocess.run([CLI, "-rpcuser=bsahi", "-rpcpassword=bsahi", method],
                           capture_output=True, text=True, timeout=20)
        return json.loads(r.stdout) if r.returncode == 0 else None
    except Exception:
        return None


def load(path, default):
    try:
        with open(path) as f:
            return json.load(f)
    except Exception:
        return default


def now():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


def main():
    info = rpc("getblockchaininfo")
    cdf = load(CDF, {}) or {}
    part = cdf.get("participation") or {}
    blocks_obs = part.get("blocks_observed") or 0

    state = load(STATE, {})
    events = []
    if info is not None:
        ibd = bool(info.get("initialblockdownload"))
        if not ibd and not state.get("ibd_cleared"):
            state["ibd_cleared"] = {"at": now(), "height": info.get("blocks")}
            events.append("ibd_cleared")
        if ibd and not state.get("ibd_cleared"):
            state["last_ibd_height"] = info.get("blocks")
    if blocks_obs and not state.get("participation_first"):
        state["participation_first"] = {
            "at": now(), "blocks_observed": blocks_obs,
            "inbound_announcer_share_pct": part.get("inbound_announcer_share_pct"),
            "inbound_first_seen_share_pct": part.get("inbound_first_seen_share_pct"),
        }
        events.append("participation_first")

    # The whole point of the exercise: the moment capture-recapture can produce a
    # NUMBER (a recapture exists), record it. Until then the estimator reports
    # None/INSUFFICIENT_RECAPTURES — this fires exactly once, when that changes.
    ppe = load(PPE, {}) or {}
    if ppe.get("estimate") is not None and not state.get("private_estimate_first"):
        state["private_estimate_first"] = {
            "at": now(), "estimate": ppe.get("estimate"), "ci95": ppe.get("ci95"),
            "distinct_observed": ppe.get("distinct_observed"),
            "occasions": ppe.get("occasions"),
            "status": ppe.get("status"), "independence": ppe.get("independence"),
        }
        events.append("private_estimate_first")

    os.makedirs(os.path.dirname(STATE), exist_ok=True)
    with open(STATE, "w") as f:
        json.dump(state, f, indent=2)

    doc = {
        "schema": "bsahi.ibd-notice/1",
        "layer": "observed",
        "generated_at": now(),
        "source": "local Bitcoin Core getblockchaininfo + data/propagation_cdf.json",
        "ibd_now": (info or {}).get("initialblockdownload"),
        "height": (info or {}).get("blocks"),
        "headers": (info or {}).get("headers"),
        "participation_blocks_observed": blocks_obs,
        "ibd_cleared": state.get("ibd_cleared"),
        "participation_first": state.get("participation_first"),
        "private_estimate_first": state.get("private_estimate_first"),
        "private_estimate_now": ppe.get("estimate"),
        "private_status_now": ppe.get("status"),
        "events_this_run": events,
        "note": ("One-shot transition record. ibd_cleared = the node finished syncing, so "
                 "first-party block-relay capture can begin. participation_first = the first "
                 "measured share of observed blocks whose announcers included an inbound "
                 "(non-listening) peer. Both are recorded the first time they happen; this "
                 "file is rewritten on each run but the events do not repeat."),
    }
    with open(OUT, "w") as f:
        json.dump(doc, f, indent=2)

    if events:
        for e in events:
            print("ibd-watch: *** %s *** %s" % (e, json.dumps(state.get(e))))
    else:
        print("ibd-watch: waiting — ibd=%s height=%s participation_blocks=%s private_estimate=%s (%s)"
              % ((info or {}).get("initialblockdownload"), (info or {}).get("blocks"), blocks_obs,
                 ppe.get("estimate"), ppe.get("status")))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
