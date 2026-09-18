#!/usr/bin/env python3
"""Contribution ratio — the honest three-axis join (population-geography Phase 4).

The request was a "public vs private node contribution ratio on blocks". That is
three DIFFERENT populations, and they must never be summed into one number:

  AXIS 1  VERIFICATION/RELAY POPULATION  (who exists)
          public/listening (reachable) split clearnet vs Tor/I2P overlay, plus the
          non-listening/private remainder, which is UNOBSERVABLE (floor only).
  AXIS 2  BLOCK RELAY                    (who carried it)
          per block, how many listening peers announced the inv and how tightly.
          A sample of listening peers — NOT the producer.
  AXIS 3  BLOCK PRODUCTION               (who made it)
          mining hashrate by country/region (CBECI, estimate) and pool concentration.
          A block is produced by a miner/pool; node reachability is irrelevant to it.

No arithmetic combines AXIS 1+2+3 into a single "ratio": doing so would be a
category error. This file publishes all three side by side with their grades.

Reads: node_geography.json, block_propagation.json, mining_geography.json,
       verification_population.json, pool_attribution_validation.json.
Writes data/contribution_ratio.json.
"""
import datetime
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DATA = os.path.join(ROOT, "data")
OUT = os.path.join(DATA, "contribution_ratio.json")


def load(name):
    p = os.path.join(DATA, name)
    try:
        with open(p) as f:
            return json.load(f)
    except Exception:
        return None


def axis_verification(geo, vp):
    if not geo:
        return {"available": False}
    nc = geo.get("network_class", {})
    out = {
        "available": True,
        "grade": "B (floor)",
        "reachable_nodes": nc.get("reachable_nodes"),
        "overlay_pct": nc.get("overlay_share_pct"),
        "tor_pct": nc.get("tor_share_pct"),
        "clearnet_lower_bound": nc.get("clearnet_top_asns_sum"),
        "region_counts": (geo.get("geography") or {}).get("region_counts"),
        "unobservable": "non-listening / NAT'd nodes — no crawler can see them; floor only",
    }
    if vp:
        q = vp.get("quantities", {})
        out["observability_tiers"] = {
            "A_gossip_addresses": (q.get("A_gossip_addresses") or {}).get("value"),
            "B_reachable_nodes": (q.get("B_reachable_nodes") or {}).get("value"),
            "C_non_listening": "unobservable",
            "D_total": "unobservable",
        }
    return out


def axis_relay(bp):
    if not bp:
        return {"available": False}
    return {
        "available": True,
        "grade": "C (pinger sample of listening peers)",
        "blocks_in_window": (bp.get("summary") or {}).get("blocks_in_window"),
        "announcing_nodes_min": (bp.get("summary") or {}).get("announcing_nodes_min"),
        "announcing_nodes_mean": (bp.get("summary") or {}).get("announcing_nodes_mean"),
        "announcing_nodes_max": (bp.get("summary") or {}).get("announcing_nodes_max"),
        "not_the_producer": "announcing peers != the miner that produced the block",
    }


def axis_production(mg, pool):
    a = {"available": False}
    if mg and mg.get("status") == "OK":
        rows = mg.get("country_share", [])
        a = {
            "available": True,
            "grade": "C/D (CBECI estimate, ~32-38% pool sample)",
            "period": mg.get("period"),
            "top_countries": [[r["country"], r["share_pct"]] for r in rows[:10]],
        }
    elif mg:
        a = {"available": False, "reason": mg.get("status"),
             "download_url": mg.get("download_url")}
    if pool:
        a["pool_attribution_status"] = pool.get("status")
        net = pool.get("network_cross_check_blockchair") or {}
        if net:
            a["network_hashrate_ehs"] = net.get("blockchair_hashrate_24h_ehs")
    return a


def main():
    doc = {
        "schema": "bsahi.contribution-ratio/1",
        "layer": "modelled",
        "generated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "source": ("join of node_geography.json + block_propagation.json + "
                   "mining_geography.json + verification_population.json + "
                   "pool_attribution_validation.json"),
        "caveat": ("These are THREE populations, not one. A single "
                   "'public vs private contribution ratio on blocks' is not defined: "
                   "blocks are PRODUCED by miners, RELAYED by nodes (public and "
                   "private alike), and the private/non-listening node share is "
                   "unobservable. Read the axes separately."),
        "axis_1_verification_population": axis_verification(load("node_geography.json"),
                                                            load("verification_population.json")),
        "axis_2_block_relay": axis_relay(load("block_propagation.json")),
        "axis_3_block_production": axis_production(load("mining_geography.json"),
                                                   load("pool_attribution_validation.json")),
    }
    with open(OUT, "w") as f:
        json.dump(doc, f, indent=2)
    a1 = doc["axis_1_verification_population"]
    a2 = doc["axis_2_block_relay"]
    a3 = doc["axis_3_block_production"]
    print("contribution-ratio:")
    print("  axis1 verification: reachable=%s overlay=%s%%"
          % (a1.get("reachable_nodes"), a1.get("overlay_pct")))
    print("  axis2 relay: %s blocks, announcing mean=%s"
          % (a2.get("blocks_in_window"), a2.get("announcing_nodes_mean")))
    print("  axis3 production: available=%s (%s)"
          % (a3.get("available"), a3.get("period") or a3.get("reason")))
    print("  -> %s" % OUT)


if __name__ == "__main__":
    main()
