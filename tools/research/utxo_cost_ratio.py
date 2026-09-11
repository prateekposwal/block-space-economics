#!/usr/bin/env python3
"""
BSAHI — UTXO Cost Internalization Ratio (UTXOCIR)

Computes the ratio of fee-side contribution to UTXO growth cost.

NUMERATOR: Fee contribution attributable to UTXO creation.
  From fee_history_blocks.json: avgFees (sats/block) × USD/BTC price.

DENOMINATOR: UTXO growth cost from model-spec.json v2.1.0:
  cb_insc = 1.92573e-6 $/byte/year (marginal inscription attribution)
  × UTXO bytes created per block × N nodes

Note: The task spec references '29.9 KB/block marginal growth' which does
not appear in the repo's utxo_cost_model.py. This script uses verified
model-spec.json constants: inscription-only growth = 480MB/year ≈ 9.1 KB/block.

Usage: python3 tools/research/utxo_cost_ratio.py
Output: data/utxo_cost_ratio.json
"""
import json
import os
import sys

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
FEE_PATH = os.path.join(REPO_ROOT, 'data', 'fee_history_blocks.json')
SPEC_PATH = os.path.join(REPO_ROOT, 'research', 'model-spec.json')
OUTPUT_PATH = os.path.join(REPO_ROOT, 'data', 'utxo_cost_ratio.json')

def main():
    with open(FEE_PATH) as f:
        fee_data = json.load(f)
    blocks = fee_data['blocks']

    with open(SPEC_PATH) as f:
        spec = json.load(f)
    Q = spec['quantities']

    cb_insc = Q['cb_insc']['value']       # 1.92573e-6 $/byte/year
    N = Q['N']['value']                    # 32000 nodes
    I_BYTES = Q['I_bytes']['value']        # 400 bytes
    I_RATE = Q['I_rate']['value']          # 100000 inscriptions/month
    R_BLOCKS = Q['R_blocks']['value']      # 52596 blocks/year

    # UTXO growth per block (inscription marginal attribution)
    utxo_bytes_per_year = I_BYTES * I_RATE * 12  # 480,000,000 bytes/year
    utxo_bytes_per_block = utxo_bytes_per_year / R_BLOCKS  # ~9128 bytes/block

    # Network-wide UTXO growth cost per block
    utxo_growth_cost_per_block = cb_insc * utxo_bytes_per_block * N

    # Per-block computation
    results = []
    for b in blocks:
        avg_fees_sats = b['avgFees']
        usd_price = b['usd']
        fee_usd = avg_fees_sats * (usd_price / 1e8)

        utxocir = fee_usd / utxo_growth_cost_per_block

        results.append({
            "height": b['h'],
            "timestamp": b['t'],
            "avgFees_sats": avg_fees_sats,
            "usd_price": usd_price,
            "fee_usd": round(fee_usd, 4),
            "utxocir": round(utxocir, 6)
        })

    # Summary
    utxocirs = [r['utxocir'] for r in results]
    summary = {
        "schema": "bsahi.utxo-cost-ratio/1",
        "generated_at": fee_data['generated_at'],
        "source": fee_data['source'],
        "model_spec_version": spec['version'],
        "note": (
            "UTXOCIR = fee_USD_per_block / (cb_insc × UTXO_bytes_per_block × N). "
            "Numerator: avgFees × USD_price from fee_history_blocks.json. "
            "Denominator: cb_insc=1.92573e-6 $/byte/year (model-spec.json v2.1.0), "
            "I_BYTES=400, I_RATE=100K/mo, N=32,000. "
            "The task spec referenced '29.9 KB/block marginal growth' which does not "
            "appear in utxo_cost_model.py. This script uses verified model-spec.json "
            "constants: inscription-only growth = 480MB/year ≈ 9.1 KB/block. "
            "Fee data covers 2026 blocks only (not 2017)."
        ),
        "parameters": {
            "cb_insc_usd_per_byte_year": cb_insc,
            "I_bytes": I_BYTES,
            "I_rate_monthly": I_RATE,
            "utxo_bytes_per_block": round(utxo_bytes_per_block, 1),
            "N_nodes": N,
            "C_usd_year": Q['C']['value'],
            "T_years": Q['T']['value']
        },
        "summary": {
            "n_blocks": len(results),
            "period": f"{blocks[0]['h']}–{blocks[-1]['h']}",
            "avg_utxocir": round(sum(utxocirs)/len(utxocirs), 6),
            "min_utxocir": round(min(utxocirs), 6),
            "max_utxocir": round(max(utxocirs), 6),
            "blocks_above_1x": sum(1 for u in utxocirs if u >= 1.0),
            "blocks_above_1x_pct": round(100 * sum(1 for u in utxocirs if u >= 1.0) / len(utxocirs), 1)
        },
        "per_block": results
    }

    with open(OUTPUT_PATH, 'w') as f:
        json.dump(summary, f, indent=2)

    print(f"UTXOCIR Summary:")
    print(f"  Blocks analyzed: {len(results)}")
    print(f"  Avg UTXOCIR: {summary['summary']['avg_utxocir']:.6f}")
    print(f"  Range: {summary['summary']['min_utxocir']:.6f} – {summary['summary']['max_utxocir']:.6f}")
    print(f"  Blocks above 1×: {summary['summary']['blocks_above_1x']}/{len(results)} ({summary['summary']['blocks_above_1x_pct']}%)")
    print(f"\nOutput: {OUTPUT_PATH}")
    return summary

if __name__ == '__main__':
    main()
