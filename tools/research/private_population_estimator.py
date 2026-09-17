#!/usr/bin/env python3
"""Private (non-listening) population estimator — PROPOSED, internal.

Derivation: research/private-population-estimator.md

    R = P * (i / o - 1)

  P = listening ("public") nodes  -> research/model-spec.json quantities.N (Grade B)
  R = non-listening ("private") nodes -> the estimate (quantity C)
  o = network-wide outbound connection degree (Core default: 8 full + 2 block-only)
  i = inbound connections observed at a TYPICAL listening node

Every outbound connection terminates at a listening node, so network-wide held
inbound = o*(P+R); distributed over P listening nodes, a typical node sees
i = o*(P+R)/P. The inbound cap cancels (see the note). The result is a LOWER
bound: a new / poorly-advertised node under-receives inbound.

NOT published. Requires a reachable node to supply i (the D5 instrument).
"""
import argparse
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SPEC = os.path.join(ROOT, "research", "model-spec.json")


def n_public():
    return json.load(open(SPEC))["quantities"]["N"]["value"]


def estimate(p, i, o):
    """R = P*(i/o - 1). Returns (R, total, ratio) or None when i <= o."""
    if i <= o:
        return None
    r = p * (i / o - 1)
    return r, p + r, r / p


def sccr_at(total_n, baseline_sccr, baseline_n):
    """SCCR is inverse-linear in N."""
    return baseline_sccr * baseline_n / total_n


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--inbound", type=float, default=None, help="observed inbound count i at a typical listening node")
    ap.add_argument("--outbound", type=float, default=8.0, help="network-wide outbound degree o (default 8)")
    ap.add_argument("--table", action="store_true", help="emit the i-sweep table")
    ap.add_argument("--sccr", type=float, default=0.3624, help="baseline SCCR at P (for the implication column)")
    args = ap.parse_args()

    p = n_public()
    print(f"P (listening nodes, measured) = {p:,}   o = {args.outbound:g}")

    if args.table:
        print(f"\n  {'i':>5} | {'R (private)':>12} | {'total':>10} | {'R:P':>7} | {'SCCR':>7}")
        print(f"  {'-'*5}-+-{'-'*12}-+-{'-'*10}-+-{'-'*7}-+-{'-'*7}")
        for i in [8, 12, 20, 30, 40, 60, 80, 100, 125]:
            e = estimate(p, i, args.outbound)
            if not e:
                print(f"  {i:>5} | {'-- (i<=o)':>12} |")
                continue
            r, tot, ratio = e
            print(f"  {i:>5} | {r:>12,.0f} | {tot:>10,.0f} | {ratio:>6.1f}:1 | {sccr_at(tot, args.sccr, p):>7.4f}")

    if args.inbound is not None:
        e = estimate(p, args.inbound, args.outbound)
        if not e:
            print(f"\n  i={args.inbound:g} <= o={args.outbound:g}: not a valid sample of a typical node.")
            return 1
        r, tot, ratio = e
        print(f"\n  i = {args.inbound:g}  ->  R = {r:,.0f} private nodes (lower bound)")
        print(f"  total population ~ {tot:,.0f}  ({ratio:.1f}:1 private:public)")
        print(f"  SCCR at that total ~ {sccr_at(tot, args.sccr, p):.4f}")
        print(f"  Erlay (CCS'19) 9:1 would imply i = {args.outbound * (9 + 1):g}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
