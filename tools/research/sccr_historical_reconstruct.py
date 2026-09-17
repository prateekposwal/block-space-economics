#!/usr/bin/env python3
"""Historical SCCR reconstruction (BSAHI Rank-1, TELOS).

Reads frozen daily series from captured-data/historical/blockchain.info/ and
computes per-era SCCR with the canonical model (model-spec v2.x):

    L_net(N) = C x T x N / R_blocks            (USD/block, per era)
    SCCR_era = fee_USD_per_block / L_net(N)

fee_USD_per_block is derived from the aggregate series:
    blocks_per_day  = n_transactions / n_transactions_per_block
    fee_USD_block   = transaction_fees(BTC/day) x price(USD/BTC) / blocks_per_day

Two node-count scenarios:
  A "constant-N"      N = 32,000 everywhere (repo principal census, 2026-08-02)
  B "era-adjusted-N"  era N from the documented APPROXIMATION table (not repo
                      measurements; confidence C/D — see data-confidence.md)

Writes data/sccr_historical_series.json + prints a summary table.
Deterministic: reads only frozen JSON, no network.
"""
import json, datetime, statistics, os

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(ROOT, "captured-data", "historical", "blockchain.info")
OUT = os.path.join(ROOT, "data", "sccr_historical_series.json")

C_USD = 925.0
T_YRS = 10.0
R_BLOCKS = 52596.0
# Single source of truth: N from model-spec.json (re-based 2026-09-17 to the
# measured reachable validating-node count).
def _spec_n():
    import os as _os, json as _json
    _root = _os.path.dirname(_os.path.dirname(_os.path.dirname(_os.path.abspath(__file__))))
    return _json.load(open(_os.path.join(_root, "research", "model-spec.json")))["quantities"]["N"]["value"]

N_PRINCIPAL = _spec_n()

# Era-adjusted node approximation table — NOT repo measurements.
# Anchored to the Q7 reverse-engineering (8k/2017, 15k/2023) and the general
# node-count narrative (Dashjr/bitnodes-era crawls). Grade C/D.
# PRIMARY ANCHORS (2026-09-16, tools/research/node_census_capture.py):
#   2017 -> 11,891 (bitnodes.earn.com API archived 2017-12-11, Wayback Machine)
#   2026 -> 26,635 (btcnodes.io snapshot series, mean 2026-05-08..2026-09-15)
# Anchored eras use PRIMARY_ANCHOR_N below; remaining eras stay approximation.
ERA_N = {
    2013: 4_000, 2014: 4_500, 2015: 5_000, 2016: 6_000,
    2017: 8_000, 2018: 9_000, 2019: 10_000, 2020: 11_000,
    2021: 12_000, 2022: 13_000, 2023: 15_000, 2024: 17_000,
    2025: 17_000, 2026: N_PRINCIPAL,
}
PRIMARY_ANCHOR_N = {2017: 11_891, 2026: 26_635}
ANCHOR_SOURCE = {
    2017: "primary anchor: bitnodes.earn.com API archived 2017-12-11 (Wayback)",
    2026: "primary anchor: btcnodes.io snapshot series mean 2026-05-08..09-15",
}
ANCHOR_NOTE = ("2013-2016 / 2018-2025 remain approximation (no primary source "
               "recovered); 2017 and 2026 are primary-anchored.")

def load(slug):
    with open(os.path.join(SRC, slug + ".json")) as f:
        return json.load(f)

def main():
    price = load("market-price")["values"]
    txbf  = load("transaction-fees")["values"]
    ntx   = load("n-transactions")["values"]
    tpb   = load("n-transactions-per-block")["values"]

    # align ntx and tpb by timestamp -> per-day blocks estimate
    nt_by_t  = {int(p["x"]): p["y"] for p in ntx}
    tp_by_t  = {int(p["x"]): p["y"] for p in tpb}
    bpd_all  = {}
    for t, nt in nt_by_t.items():
        tp = tp_by_t.get(t)
        if tp:
            bpd_all[t] = nt / tp

    range_ = list(range(2013, 2027))
    eras_out = []
    for yr in range_:
        t0 = datetime.datetime(yr, 1, 1, tzinfo=datetime.timezone.utc).timestamp()
        t1t = datetime.datetime(yr + 1, 1, 1, tzinfo=datetime.timezone.utc).timestamp() if yr < 2026 else (1 << 62)
        txbf_pts = [p for p in txbf if t0 <= p["x"] < t1t]
        if not txbf_pts:
            eras_out.append({"era": str(yr), "reconstructable": False, "status": "NOT AVAILABLE"})
            continue
        bpd = [bpd_all[int(p["x"])] for p in txbf_pts if int(p["x"]) in bpd_all]
        prc = [p["y"] for p in price if t0 <= p["x"] < t1t]
        fee_b = statistics.mean(p["y"] for p in txbf_pts)
        blocks_day = statistics.median(bpd) if bpd else 144.0
        price_avg = statistics.mean(prc) if prc else None
        fee_usd_block = fee_b * price_avg / blocks_day if price_avg else None

        L_net_32 = C_USD * T_YRS * N_PRINCIPAL / R_BLOCKS
        N_era = PRIMARY_ANCHOR_N.get(yr, ERA_N.get(yr, N_PRINCIPAL))
        anchored = yr in PRIMARY_ANCHOR_N
        L_net_era = C_USD * T_YRS * N_era / R_BLOCKS

        eras_out.append({
            "era": str(yr),
            "reconstructable": True,
            "status": "RECONSTRUCTED (daily aggregates, blockchain.info charts)",
            "fee_btc_per_day": round(fee_b, 4),
            "blocks_per_day_est": round(blocks_day, 1),
            "btc_price_usd_avg": round(price_avg, 2) if price_avg else None,
            "fee_usd_per_block": round(fee_usd_block, 2) if fee_usd_block else None,
            "L_net_usd_32k": round(L_net_32, 2),
            "L_net_usd_eraN": round(L_net_era, 2),
            "N_scenario_B": N_era,
            "N_source": ANCHOR_SOURCE.get(yr, "approximation (no primary source recovered)"),
            "sccr_const_N32k": round(fee_usd_block / L_net_32, 4) if fee_usd_block else None,
            "sccr_era_adjusted_N": round(fee_usd_block / L_net_era, 4) if fee_usd_block else None,
            "data_confidence": "C" if yr < 2016 else ("B*" if anchored else "B"),  # anchored eras carry primary N
        })

    # Q7 comparison
    Q7 = {"2017": 10.0, "2021": 8.0, "2023": 5.0, "2024": 4.8}
    q7 = {}
    for e in eras_out:
        if e["era"] in Q7:
            m = e.get("sccr_era_adjusted_N")
            q7[e["era"]] = {
                "claimed": Q7[e["era"]],
                "measured_const_N32k": e.get("sccr_const_N32k"),
                "measured_era_adjusted_N": m,
                "verdict": "COMPATIBLE (within 50%)" if m and abs(m - Q7[e["era"]]) <= Q7[e["era"]] * 0.5 else "INCOMPATIBLE (>50% off)",
            }

    out = {
        "schema": "bsahi.sccr-historical-series.v3",
        "generated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "model_spec_version": "v2.1.0 (canonical)",
        "status": "RECONSTRUCTED-ESTIMATE — daily aggregates from blockchain.info charts; fee=BTC/day x USD price; node count scenario B is an approximation",
        "l_net_formula": "C x T x N / R_blocks",
        "sccr_formula": "fee_USD / L_net",
        "canonical_constants": {"C_usd_per_year": C_USD, "N_nodes": N_PRINCIPAL, "T_years": T_YRS, "R_blocks_per_year": R_BLOCKS},
        "canonical_l_net_usd": round(C_USD * T_YRS * N_PRINCIPAL / R_BLOCKS, 2),
        "dataset_metadata": {
            "sources": ["https://api.blockchain.info/charts/market-price",
                        "https://api.blockchain.info/charts/transaction-fees",
                        "https://api.blockchain.info/charts/n-transactions",
                        "https://api.blockchain.info/charts/n-transactions-per-block",
                        "https://api.blockchain.info/charts/avg-block-size",
                        "https://api.blockchain.info/charts/hash-rate"],
            "frozen_at": "2026-09-15",
            "frozen_path": "captured-data/historical/blockchain.info/",
            "granularity": "daily",
            "note": "Reproducible offline from frozen JSON; hash-rate last point ~956 EH/s cross-checks repo hashrate.json (934 EH/s).",
        },
        "eras": eras_out,
        "q7_claims": q7,
        "q7_claims_verbatim": {
            "2017": "Working paper Q7: 2017 avg SCCR ~10.0 (era-adjusted node counts)",
            "2021": "Working paper Q7: 2021 avg SCCR ~8.0 (era-adjusted node counts)",
            "2023": "Working paper Q7: 2023 avg SCCR ~5.0 (era-adjusted node counts)",
            "2024": "Working paper Q7: 2024 avg SCCR ~4.8 (era-adjusted node counts)",
        },
        "data_gaps": [
            "Historical node count: scenario B uses documented approximations, NOT repo measurements (grade C/D)",
            "fee_USD/block derived from daily aggregates, not per-block fee captures",
            "2013-2015 fee/BTC series sparse at the epoch start; confidence C",
            "2026 partial year includes live repo captures (authoritative, see data/sccr_history.json)",
        ],
    }
    with open(OUT, "w") as f:
        json.dump(out, f, indent=2)

    print(f"{'yr':6}{'fee_USD/blk':>14}{'L32k':>10}{'LeraN':>10}{'SCCR@32k':>12}{'SCCR@era':>12}{'N_era':>7}   conf")
    for e in eras_out:
        if not e.get("reconstructable"):
            continue
        print(f"{e['era']:6}{e['fee_usd_per_block'] or 0:>14.2f}{e['L_net_usd_32k']:>10.2f}{e['L_net_usd_eraN']:>10.2f}"
              f"{e['sccr_const_N32k'] or 0:>12.4f}{e['sccr_era_adjusted_N'] or 0:>12.4f}{e['N_scenario_B']:>7}   {e['data_confidence']}")
    print("\nQ7 comparison:")
    for k, v in q7.items():
        print(f"  {k}: claimed={v['claimed']}  constN32k={v['measured_const_N32k']}  eraAdjN={v['measured_era_adjusted_N']}  -> {v['verdict']}")
    print(f"\nWrote {OUT}")

if __name__ == "__main__":
    main()