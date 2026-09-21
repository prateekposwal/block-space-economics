#!/usr/bin/env python3
"""Estimate the non-listening (private) node population by capture-recapture.

The total node count is NOT recoverable from the protocol — no registry, no
heartbeat, and `getaddr` returns a deliberately bounded, filtered subset of one
node's address manager. But the non-listening population can be *estimated* from
how often the same source IPs reappear across independent capture occasions,
which is the standard ecological answer to "how many are there that I cannot
enumerate?".

Occasions (both supported):
  * --mode time     split OUR inbound history into K equal periods (default 2).
                    Independent-ish catches of the same population over time.
  * --vantage NAME=PATH   one occasion per vantage log (our log + external peers).
                    Stronger: independent observers, not just independent times.

Estimators:
  Lincoln-Petersen  N = n1*n2 / m
  Chapman (biased-corrected, preferred for small m)
  Chao1             N = S_obs + f1^2 / (2*f2)   (lower bound under heterogeneity)

ASSUMPTIONS THAT ARE VIOLATED IN PRACTICE (stated, not hidden):
  closure (no arrivals/departures between occasions), equal catchability
  (every node equally likely to dial us), and independence of occasions.
  Reconnecting nodes, churn, NAT-shared IPs and our own connection ceiling all
  break these — so the number is an ESTIMATE with a wide interval, never a census.

Writes data/private_population_estimate.json.
"""
import argparse
import datetime
import json
import math
import os

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, "data", "private_population_estimate.json")
INBOUND = os.path.join(ROOT, "data", "inbound_samples.jsonl")


# ───────────────────────── pure estimator (unit-testable) ─────────────────────────
def estimate(occasions):
    """occasions: list of sets of ids. Returns the estimate dict (no I/O)."""
    occ = [set(o) for o in occasions]
    n = [len(o) for o in occ]
    S = set().union(*occ) if occ else set()
    S_obs = len(S)

    freq = {}
    for ident in S:
        freq[ident] = sum(1 for o in occ if ident in o)
    f1 = sum(1 for v in freq.values() if v == 1)
    f2 = sum(1 for v in freq.values() if v == 2)

    out = {
        "occasions": n,
        "occasions_count": len(occ),
        "distinct_observed": S_obs,
        "seen_once": f1, "seen_twice": f2,
        "status": "OK", "estimators": {}, "estimate": None, "ci95": None,
        "floor": S_obs,
    }
    if S_obs == 0:
        out["status"] = "NO_OBSERVATIONS"
        out["note"] = ("No non-listening inbound source observed yet. Nothing to "
                       "estimate — the instrument is recording, the population sample is empty.")
        return out
    if len(occ) < 2:
        out["status"] = "NEEDS_SECOND_OCCASION"
        out["note"] = "Capture-recapture needs at least two occasions."
        return out

    m = sum(1 for v in freq.values() if v == len(occ))   # seen in every occasion

    # ── two-occasion estimators ──
    if len(occ) == 2:
        n1, n2 = n[0], n[1]
        if m > 0:
            lp = (n1 * n2) / m
            lp_var = (n1 * n2 * (n1 - m) * (n2 - m)) / (m ** 3)
            out["estimators"]["lincoln_petersen"] = {
                "N": round(lp, 2), "se": round(math.sqrt(lp_var), 2),
                "ci95": [round(max(S_obs, lp - 1.96 * math.sqrt(lp_var)), 2),
                         round(lp + 1.96 * math.sqrt(lp_var), 2)]}
            ch = ((n1 + 1) * (n2 + 1) / (m + 1)) - 1
            ch_var = (((n1 + 1) * (n2 + 1) * (n1 - m) * (n2 - m)) /
                      (((m + 1) ** 2) * (m + 2)))
            out["estimators"]["chapman"] = {
                "N": round(ch, 2), "se": round(math.sqrt(ch_var), 2),
                "ci95": [round(max(S_obs, ch - 1.96 * math.sqrt(ch_var)), 2),
                         round(ch + 1.96 * math.sqrt(ch_var), 2)]}
            out["estimate"] = round(ch, 2)
            out["ci95"] = out["estimators"]["chapman"]["ci95"]
        else:
            out["status"] = "INSUFFICIENT_RECAPTURES"
            out["note"] = ("No node was caught in both occasions, so Lincoln-Petersen "
                           "and Chapman are undefined (m = 0). The observed distinct count "
                           "is a floor only.")

    # ── richness estimator: valid for any number of occasions, handles heterogeneity ──
    if f2 > 0:
        chao = S_obs + (f1 ** 2) / (2 * f2)
        r = f1 / f2
        chao_var = f2 * (0.5 * r ** 2 + r ** 3 + 0.25 * r ** 4)
        out["estimators"]["chao1"] = {
            "N": round(chao, 2), "se": round(math.sqrt(chao_var), 2),
            "ci95": [round(max(S_obs, chao - 1.96 * math.sqrt(chao_var)), 2),
                     round(chao + 1.96 * math.sqrt(chao_var), 2)],
            "kind": "lower bound on richness"}
        if out["estimate"] is None and out["status"] == "OK":
            out["estimate"] = round(chao, 2)
            out["ci95"] = out["estimators"]["chao1"]["ci95"]
    else:
        out["estimators"]["chao1"] = {"N": None, "note": "f2 = 0: no node seen twice, Chao1 undefined"}

    if out["estimate"] is None and out["status"] == "OK":
        out["status"] = "INSUFFICIENT_RECAPTURES"
    return out


# ────────────────────────────────── loaders ──────────────────────────────────
def _rows(path):
    rows = []
    if os.path.exists(path):
        for line in open(path, errors="replace"):
            if line.strip():
                try:
                    rows.append(json.loads(line))
                except Exception:
                    pass
    return rows


def _ids(row):
    v = row.get("inbound_measurement_ips")
    return set(v) if isinstance(v, list) and v else set()


def occasions_time(rows, k):
    """Split the sample history into k equal periods; union the ids in each."""
    rows = [r for r in rows if r.get("at")]
    if not rows:
        return []
    rows.sort(key=lambda r: r["at"])
    per = max(1, math.ceil(len(rows) / k))
    out = []
    for i in range(0, len(rows), per):
        chunk = rows[i:i + per]
        acc = set()
        for r in chunk:
            acc |= _ids(r)
        out.append(acc)
    return out


def occasions_localaddr(rows):
    """One occasion per LOCAL ADDRESS peer dialled (our own capture channels).

    Every address in our routed prefix is gossiped separately, so arrivals on each
    are a distinct channel. Independence is WEAK — same host, same peer set — so the
    estimate from this mode is optimistic (recapture is too likely, N biased low).
    Use it to get a number now; use --mode vantage for a defensible one.
    """
    per = {}
    for r in rows:
        bl = r.get("by_local_addr")
        if isinstance(bl, dict):
            for addr, ips in bl.items():
                if isinstance(ips, list):
                    per.setdefault(addr, set()).update(ips)
    return [(a, s) for a, s in sorted(per.items()) if s]


def occasions_vantage(specs):
    """specs: list of (label, path). One occasion per vantage."""
    return [(label, set().union(*[_ids(r) for r in _rows(p)]) if _rows(p) else set())
            for label, p in specs]


# ─────────────────────────────────── main ───────────────────────────────────
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--mode", choices=["time", "vantage", "localaddr"], default="time")
    ap.add_argument("--periods", type=int, default=2, help="capture occasions when --mode time")
    ap.add_argument("--vantage", action="append", default=[],
                    help="LABEL=PATH of an additional inbound jsonl vantage")
    ap.add_argument("--reachable", type=int, default=None,
                    help="measured reachable node count, for the total estimate")
    args = ap.parse_args()

    if args.mode == "localaddr":
        rows = _rows(INBOUND)
        labelled = occasions_localaddr(rows)
        if len(labelled) < 2:
            est = estimate([s for _, s in labelled]) if labelled else estimate([])
            est["status"] = "NEEDS_SECOND_OCCASION"
            est["note"] = ("Only %d local address(es) have caught anything; capture-recapture "
                           "needs two. The second address (…::3) is live and advertised — it "
                           "needs inbound arrivals, which depend on peers learning it."
                           % len(labelled))
        else:
            est = estimate([s for _, s in labelled])
        est["occasions"] = [{"label": l, "n": len(s)} for l, s in labelled]
        est["independence"] = "WEAK (same host, same peer set) — treat as optimistic"
    elif args.mode == "vantage":
        specs = [("self", INBOUND)] + [(v.split("=", 1)[0], v.split("=", 1)[1])
                                       for v in args.vantage if "=" in v]
        labelled = occasions_vantage(specs)
        est = estimate([s for _, s in labelled])
        est["occasions"] = [{"label": l, "n": len(s)} for l, s in labelled]
    else:
        rows = _rows(INBOUND)
        occ = occasions_time(rows, args.periods)
        est = estimate(occ)
        est["occasions"] = [{"label": "period-%d" % (i + 1), "n": len(o)}
                            for i, o in enumerate(occ)]
        est["periods"] = args.periods

    reachable = args.reachable
    if reachable is None:
        try:
            reachable = int(json.load(open(os.path.join(ROOT, "data", "sccr.json"))).get("N") or 0) or None
        except Exception:
            reachable = None

    doc = {
        "schema": "bsahi.private-population/1",
        "layer": "modelled",
        "generated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "source": ("capture-recapture over first-party inbound observations "
                   "(data/inbound_samples.jsonl + any --vantage logs)"),
        "method": "Lincoln-Petersen / Chapman (2 occasions) and Chao1 richness; CI = point ± 1.96 SE",
        "status": est["status"],
        "estimate": est.get("estimate"),
        "ci95": est.get("ci95"),
        "floor": est.get("floor"),
        "distinct_observed": est.get("distinct_observed"),
        "occasions": est.get("occasions"),
        "estimators": est.get("estimators"),
        "frequency": {"seen_once": est.get("seen_once"), "seen_twice": est.get("seen_twice")},
        "note": est.get("note"),
        "reachable_nodes": reachable,
        "total_if_estimate_holds": (est.get("estimate") + reachable
                                    if (est.get("estimate") and reachable) else None),
        "assumptions": [
            "closure: no arrivals/departures between occasions (violated — nodes churn)",
            "equal catchability: every non-listening node equally likely to dial us (violated — "
            "reconnecting/NAT-heavy nodes are over-caught)",
            "independence of occasions (partly violated when occasions are time-slices of one vantage)",
            "distinct IP = distinct node (violated under NAT/CGNAT — biases the estimate DOWN)",
        ],
        "caveats": [
            "The protocol cannot yield a census: there is no registry, no heartbeat, and getaddr "
            "returns a bounded, filtered subset of one node's addrman.",
            "Nodes that only ever connect to other non-listening nodes are invisible to every "
            "vantage and can never be estimated from inbound data.",
            "Chao1 and any recapture estimate are LOWER bounds under heterogeneous catchability.",
            "One vantage is a floor. Recapture across independent vantages (--mode vantage) is a "
            "genuine estimate and needs a second always-on reachable host.",
        ],
    }
    with open(OUT, "w") as f:
        json.dump(doc, f, indent=2)

    print("private-population: status=%s | observed=%s | occasions=%s | estimate=%s CI=%s"
          % (doc["status"], doc["distinct_observed"],
             [o.get("n") for o in (doc["occasions"] or [])] if isinstance(doc["occasions"], list) else doc["occasions"],
             doc["estimate"], doc["ci95"]))
    print("  -> %s" % OUT)


if __name__ == "__main__":
    main()
