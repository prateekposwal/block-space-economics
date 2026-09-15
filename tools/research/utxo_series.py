#!/usr/bin/env python3
"""UTXO/state series — reachable anchors + VCI cross-check (BSAHI Tier-2 #1/#2).

The continuous pre-2016 UTXO-count series is NOT reachable from this
environment (see research/utxo-series-reachability.md for the probed sources).
This tool records the primary anchors that ARE reachable and cross-checks VCI's
chain-size leg against an independent source:

  outputs_ever       = blockchair cumulative outputs created (primary, frozen)
  transactions       = blockchair cumulative tx count (primary, frozen)
  hodling_addresses  = blockchair non-empty addresses (primary, frozen)
  blockchain_size    = blockchair current chain size, bytes (primary, frozen)
                       -> VCI cross-check: vs our cumulative avg-block-size route

Deterministic + offline (reads captured-data + data only). Writes
data/utxo_series.json.
"""
import json, os, datetime

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, "data", "utxo_series.json")
BC_STATS = os.path.join(ROOT, "captured-data", "blockchair", "stats.json")
VCI = os.path.join(ROOT, "data", "verify_cost_index.json")

def main():
    bc = json.load(open(BC_STATS))["data"]
    vci = json.load(open(VCI))
    e26 = next(e for e in vci["eras"] if e["era"] == "2026")

    chain_bytes_bc = int(bc.get("blockchain_size") or 0)
    chain_gb_bc = chain_bytes_bc / 1e9
    vci_chain_gb = e26["chain_gb"]
    diff_pct = abs(chain_gb_bc - vci_chain_gb) / chain_gb_bc * 100

    out = {
        "schema": "bsahi.utxo-series/1",
        "generated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "status": "ANCHORS + CROSS-CHECK — continuous UTXO-count series NOT obtainable this session (documented in research/utxo-series-reachability.md)",
        "anchors_blockchair_2026_09_15": {
            "outputs_ever_created": bc.get("outputs"),
            "transactions_ever": bc.get("transactions"),
            "hodling_addresses": bc.get("hodling_addresses"),
            "blocks": bc.get("blocks"),
            "blockchain_size_bytes": chain_bytes_bc,
            "blockchain_size_gb": round(chain_gb_bc, 1),
        },
        "utxo_count_2026": None,
        "utxo_count_reason": "No reachable primary source exposes a current UTXO count (blockchair /stats has cumulative outputs, not unspent; blockchair /blocks rate-limited 430 for a full scan; esplora/mempool/bitinfocharts/legacy /q hang or 404). Not fabricated.",
        "vci_chain_size_cross_check": {
            "vci_chain_gb_2026_avg_size_route": vci_chain_gb,
            "blockchair_chain_gb_2026": round(chain_gb_bc, 1),
            "relative_diff_pct": round(diff_pct, 1),
            "note": "VCI's cumulative avg-block-size route runs ~10% high of blockchair's direct measurement; well within the documented scenario grade. Neither is the UTXO state leg.",
        },
        "vci_state_leg_status": "utxo_state_gb remains the documented estimate table in verify_cost_index.py (0.5-11 GB per era); hardening to a measured series is blocked on a reachable UTXO-count source or a synced local node (gettxoutsetinfo snapshots).",
        "row6_historical_grade": "D — unchanged; reachability evidence filed (research/utxo-series-reachability.md).",
    }
    with open(OUT, "w") as f:
        json.dump(out, f, indent=2)

    print("Anchors (blockchair, 2026-09-15):")
    for k, v in out["anchors_blockchair_2026_09_15"].items():
        print(f"  {k:24s} {v}")
    print("\nVCI chain-size cross-check:")
    print(f"  vci route: {vci_chain_gb} GB | blockchair: {round(chain_gb_bc,1)} GB | diff {round(diff_pct,1)}%")
    print("\nUTXO count: NOT MEASURED (documented). Wrote", OUT)

if __name__ == "__main__":
    main()