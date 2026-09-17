#!/usr/bin/env python3
"""Fee allocation & security budget (P2 / Phase C2).

Bitcoin's transaction fees are the only long-run revenue. Three claims compete
for them; today almost none is actually paid by fees:

  1. SECURITY / PRODUCTION  — what miners must earn to cover energy (network-wide)
  2. STORAGE EXTERNALITY    — the modeled 10-year storage cost per block (L_net)
  3. NODE OPERATING COST    — a full node's annualized cost, per block

The block subsidy currently pays (1). As the subsidy halves every ~210,000 blocks
it eventually falls below the energy cost of production — the well-known security
budget crossover — at which point fees must fund (1), and if the storage
externality is to be internalized, (2) as well.

Only the subsidy arithmetic is exact; future prices/energy are a scenario. Every
projection is labelled modelled (grade C).

Reads: data/production_cost_ratio.json, data/sccr.json, research/model-spec.json,
and the frozen blockchain.info series. Writes data/fee_allocation.json.
"""
import datetime
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
BLOCKS_PER_DAY = 144.0
BLOCKS_PER_YEAR = 365.25 * 24 * 6
SERIES = os.path.join(ROOT, "captured-data", "historical", "blockchain.info")


def recent_mean(slug, t0, points=30):
    """Mean of the last `points` observations (a recent, not era-averaged, reading)."""
    d = json.load(open(os.path.join(SERIES, slug + ".json")))["values"]
    vals = [p["y"] for p in d if p["x"] >= t0]
    vals = vals[-points:] if vals else [p["y"] for p in d[-points:]]
    return sum(vals) / len(vals) if vals else None


def subsidy_schedule(start_year=2024, start=3.125, n=32):
    """Subsidy halves every 4 years (210,000 blocks). Exact arithmetic."""
    out, s, y = [], start, start_year
    for _ in range(n):
        out.append({"year": y, "subsidy_btc": s})
        s /= 2
        y += 4
    return out


def main():
    pc = json.load(open(os.path.join(ROOT, "data", "production_cost_ratio.json")))
    sccr = json.load(open(os.path.join(ROOT, "data", "sccr.json")))
    spec = json.load(open(os.path.join(ROOT, "research", "model-spec.json")))
    q = spec["quantities"]

    # recent (last ~30 obs) measured fee revenue and price
    now = datetime.datetime.now(datetime.timezone.utc)
    t30 = (now - datetime.timedelta(days=90)).timestamp()
    fee_btc_day = recent_mean("transaction-fees", t30)
    price = recent_mean("market-price", t30)
    fee_usd_day = (fee_btc_day or 0) * (price or 0)

    # 2026 era producing-side leg (measured inputs)
    e26 = next((e for e in pc["eras"] if e["era"] == "2026"), pc["eras"][-1])
    energy_usd_day = e26["energy_cost_usd_day"]
    prod_value_usd_day = e26["production_value_usd_day"]

    energy_usd_block = energy_usd_day / BLOCKS_PER_DAY
    prod_value_block = prod_value_usd_day / BLOCKS_PER_DAY
    fee_usd_block_measured = fee_usd_day / BLOCKS_PER_DAY
    storage_block = sccr["l_net_usd"]                        # modeled 10-yr storage cost / block
    fee_usd_block_sccr = sccr["avg_sccr"] * sccr["l_net_usd"]  # implied by the SCCR reading
    # Network-wide node operating cost per block for ONE year (N x C / blocks/yr).
    # Distinct from L_net, which is the same cost over T=10 years. Comparing a
    # single node's opex to network-wide fees would be apples-to-oranges.
    node_opex_block = sccr["N"] * q["C"]["value"] / BLOCKS_PER_YEAR

    subsidy_now = 3.125
    subsidy_usd_block = subsidy_now * (price or 0)

    coverage = {
        "security_by_subsidy_pct": round(100 * subsidy_usd_block / energy_usd_block, 1) if energy_usd_block else None,
        "security_by_fees_pct": round(100 * fee_usd_block_measured / energy_usd_block, 1) if energy_usd_block else None,
        "storage_by_fees_pct": round(100 * sccr["avg_sccr"], 1),
        "network_node_opex_1yr_by_fees_pct": round(100 * fee_usd_block_measured / node_opex_block, 1) if node_opex_block else None,
    }

    # crossovers under a flat-price scenario (the price assumption is the scenario)
    def crossover(price_scn, energy=None):
        energy = energy or energy_usd_block
        sched = subsidy_schedule()
        for row in sched:
            if row["subsidy_btc"] * price_scn < energy:
                return row["year"]
        return None

    scenarios = []
    for p in (50000, 78000, 150000, 300000):
        scenarios.append({
            "price_usd": p,
            "subsidy_covers_energy_until_year": crossover(p),
            "note": "year the block subsidy alone falls below the current network-wide energy cost of production (flat-energy scenario)",
        })

    # year fees must cover security AND storage
    combined = energy_usd_block + storage_block
    fee_cover_year = None
    for row in subsidy_schedule():
        if row["subsidy_btc"] * (price or 0) < energy_usd_block:
            fee_cover_year = row["year"]
            break

    # ── Temporal expansion (Phase C2): the fee requirement per halving epoch ──
    # Price PATHS are scenarios (grade C). The subsidy halving is arithmetic (A).
    # The insight to encode: if price doubles each epoch, the USD subsidy is
    # ~constant, because the halving cancels the appreciation — so the nominal
    # security protection plateaus and CANNOT be relied on to grow.
    def path_rows(path):
        rows = []
        for r in subsidy_schedule():
            y, sub = r["year"], r["subsidy_btc"]
            if y not in path and y > max(path):
                # continue the last growth rate after the specified points
                yrs = sorted(path)
                g = (path[yrs[-1]] / path[yrs[-2]]) ** (1.0 / (yrs[-1] - yrs[-2])) if len(yrs) > 1 else 1.0
                price_y = path[yrs[-1]] * (g ** (y - yrs[-1]))
            else:
                price_y = path.get(y, path[max(path)])
            subsidy_usd = sub * price_y
            deficit = max(0.0, energy_usd_block - subsidy_usd)
            rows.append({
                "year": y, "subsidy_btc": sub, "price_usd": round(price_y, 0),
                "subsidy_usd_per_block": round(subsidy_usd, 0),
                "production_deficit_usd_per_block": round(deficit, 0),
                "storage_claim_usd_per_block": round(storage_block, 0),
                "total_fee_needed_usd_per_block": round(deficit + storage_block, 0),
                "subsidy_covers_energy": subsidy_usd >= energy_usd_block,
            })
        return rows

    paths = {
        "bsahi_specified": {2024: 50000, 2028: 78000, 2032: 150000, 2036: 300000},
        "flat_current_price": {y: (price or 68000) for y in (2024, 2028, 2032, 2036)},
        "double_each_epoch": {},
    }
    # build double-each-epoch from the current price
    p0 = price or 68000
    paths["double_each_epoch"] = {2024 + 4 * i: p0 * (2 ** i) for i in range(10)}

    temporal = {name: path_rows(path)[: (6 if name == "bsahi_specified" else 10)] for name, path in paths.items()}
    spec_rows = temporal["bsahi_specified"]
    plateau = [r["subsidy_usd_per_block"] for r in spec_rows if r["year"] >= 2032]

    out = {
        "schema": "bsahi.fee-allocation/1",
        "layer": "modelled",
        "generated_at": now.isoformat(),
        "method": ("tools/research/fee_allocation.py — three claims on fee revenue, per block, "
                   "and the subsidy crossover. Subsidy arithmetic is exact; prices/energy are a scenario."),
        "current": {
            "year": 2026,
            "price_usd": round(price, 2) if price else None,
            "subsidy_btc": subsidy_now,
            "claims_usd_per_block": {
                "security_energy_cost": round(energy_usd_block, 0),
                "storage_externality_L_net": round(storage_block, 0),
                "network_node_opex_1yr_per_block": round(node_opex_block, 2),
            },
            "revenue_usd_per_block": {
                "subsidy": round(subsidy_usd_block, 0),
                "fees_measured": round(fee_usd_block_measured, 0),
                "fees_implied_by_sccr": round(fee_usd_block_sccr, 0),
                "production_value_total": round(prod_value_block, 0),
            },
            "coverage_pct": coverage,
        },
        "halving_schedule": [{"year": r["year"], "subsidy_btc": r["subsidy_btc"],
                              "subsidy_usd_per_block_at_current_price": round(r["subsidy_btc"] * (price or 0), 0)}
                             for r in subsidy_schedule() if r["year"] in (2024, 2028, 2032, 2036, 2040, 2048, 2076, 2100)],
        "crossovers": {
            "combined_claim_usd_per_block": round(combined, 0),
            "fees_must_cover_security_from_year": fee_cover_year,
            "scenarios": scenarios,
            "class": "C — scenario, not a forecast",
        },
        "grades": {
            "halving schedule": "A (arithmetic)",
            "energy cost / storage L_net / node opex": "C (documented assumptions on measured legs)",
            "fee revenue": "B (frozen series: transaction-fees BTC/day x market price)",
            "multi-decade projection": "C (scenario)",
        },
        "headline": (
            f"Fees must eventually fund both security and the storage/verification burden; today they fund "
            f"almost neither. At ~${price:,.0f}/BTC the 2026 fee revenue is ~${fee_usd_block_measured:,.0f}/block "
            f"against a ~${energy_usd_block:,.0f}/block energy cost to produce a block and a ~${storage_block:,.0f}/block "
            f"modeled 10-year storage cost — so fees cover {coverage['security_by_fees_pct']}% of production and "
            f"{coverage['storage_by_fees_pct']}% of storage, while the subsidy ({coverage['security_by_subsidy_pct']}% of energy cost) "
            f"is still paying the security bill. Under a flat price the subsidy alone stops covering energy around "
            f"{fee_cover_year}."
        ) if price else "insufficient recent price/fee data",
        "temporal": {
            "layer": "modelled",
            "grade": "C — price paths are scenarios; the halving is arithmetic",
            "paths": temporal,
            "invariant": ("If price doubles each halving epoch, the USD subsidy is ~constant "
                          f"(observed plateau ~${plateau[0]:,.0f}/block across the specified path), because the "
                          "halving cancels the appreciation. Nominal security protection therefore does not "
                          "grow with an appreciating price on this path — the fee requirement rises on schedule "
                          "regardless."),
            "note": "production_deficit = max(0, energy_cost - subsidy_usd). total_fee_needed adds the modeled storage claim.",
        },
        "caveat": ("Miners are fee RECIPIENTS and validators are cost BEARERS — that asymmetry is the externality. "
                   "The 241k/218k address figures are addresses, not nodes, and are not used here."),
    }
    with open(os.path.join(ROOT, "data", "fee_allocation.json"), "w") as f:
        json.dump(out, f, indent=2)

    c = out["current"]
    print("claims USD/block:", c["claims_usd_per_block"])
    print("revenue USD/block:", c["revenue_usd_per_block"])
    print("coverage %:", c["coverage_pct"])
    print("subsidy-vs-energy crossover (flat price):", fee_cover_year)
    for s in scenarios:
        print(f"   @ ${s['price_usd']:,}: subsidy covers energy until {s['subsidy_covers_energy_until_year']}")
    print("\nheadline:", out["headline"][:200], "…")


if __name__ == "__main__":
    main()
