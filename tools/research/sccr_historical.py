#!/usr/bin/env python3
"""
BSAHI — Historical SCCR Reconstruction (2013→2026).

Reconstructs the Storage Cost Coverage Ratio across historical regimes
using the canonical model-spec.json v2.1.0 formula:
    SCCR = fee_USD / L_net
    L_net = C × T × N / R_blocks

This script is a FRAMEWORK — it documents what CAN and CANNOT be computed
from existing BSAHI assets. Historical fee data, BTC price data, and
historical node counts are NOT available in the repo. The Q7 partials
from working-paper §10 are treated as CLAIMS requiring verification,
not as measurements.

The script:
  1. Computes L_net for the canonical N=32000 census
  2. Reverse-engineers what fee_USD would produce the Q7 partials
  3. Documents all assumptions, data gaps, and uncertainty per era
  4. Outputs a structured JSON series (with honest gaps)
  5. Compares against the existing Q7 partials

Author: BSAHI Historical Reconstruction (2026-09-09)
"""
import json
import os
import sys

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SPEC_PATH = os.path.join(REPO, 'research', 'model-spec.json')

def load_spec():
    with open(SPEC_PATH) as f:
        spec = json.load(f)
    q = spec['quantities']
    return {
        'C': q['C']['value'],        # 925 USD/yr
        'N': q['N']['value'],        # 32000 nodes
        'T': q['T']['value'],        # 10 yr
        'B_block': q['B_block']['value'],  # 1,500,000 bytes
        'R_blocks': q['R_blocks']['value'], # 52,596 blocks/yr
        'version': spec['version'],
    }

def compute_l_net(cfg):
    """L_net = C × T × N / R_blocks"""
    return cfg['C'] * cfg['T'] * cfg['N'] / cfg['R_blocks']

def compute_cb(cfg):
    """cb = C / (B_block × R_blocks)"""
    return cfg['C'] / (cfg['B_block'] * cfg['R_blocks'])

def compute_l_node(cfg):
    """L = cb × B_block × T"""
    cb = compute_cb(cfg)
    return cb * cfg['B_block'] * cfg['T']

def sccr_from_fee_usd(fee_usd, l_net):
    return fee_usd / l_net

def fee_usd_for_sccr(sccr, l_net):
    return sccr * l_net

def build_reconstruction():
    cfg = load_spec()
    l_net_canonical = compute_l_net(cfg)
    cb = compute_cb(cfg)
    l_node = compute_l_node(cfg)
    
    print("=" * 78)
    print("  BSAHI — Historical SCCR Reconstruction Framework")
    print("=" * 78)
    print(f"  model-spec: {cfg['version']}")
    print(f"  C = ${cfg['C']}/yr  N = {cfg['N']}  T = {cfg['T']}yr")
    print(f"  B_block = {cfg['B_block']:,} bytes  R_blocks = {cfg['R_blocks']:,}")
    print(f"  L_net (canonical, N={cfg['N']}) = ${l_net_canonical:.2f}/block")
    print(f"  cb = {cb:.6e} USD/(byte·yr)")
    print(f"  L_node = ${l_node:.6f} USD/block/node")
    print()
    
    # Q7 partials from working-paper §10 Q7 (claims, not measurements)
    q7_claims = {
        '2017': {'sccr': 10.0, 'note': 'era-adjusted node counts, source: working-paper §10 Q7'},
        '2021': {'sccr': 8.0, 'note': 'era-adjusted node counts, source: working-paper §10 Q7'},
        '2023': {'sccr': 5.0, 'note': 'era-adjusted node counts, source: working-paper §10 Q7'},
        '2024': {'sccr': 4.8, 'note': 'era-adjusted node counts, source: working-paper §10 Q7'},
    }
    
    # What fee_USD would be needed at N=32000 (canonical) for each Q7 partial
    print("=" * 78)
    print("  REVERSE-ENGINEERING Q7 PARTIALS (at N=32000 canonical)")
    print("=" * 78)
    print(f"  {'Era':<6} {'Claimed SCCR':<14} {'Required fee_USD/block':<24} {'Implied sat/vB*':<16}")
    print(f"  {'-'*6:<6} {'-'*14:<14} {'-'*24:<24} {'-'*16:<16}")
    
    # Approximate block weight limit: ~4M WU, but ~1.5MB effective
    # At ~1.5MB block, ~1M vB, fee in sats/vB
    vB_per_block = 1_000_000  # approximate virtual bytes per block
    
    for era, claim in q7_claims.items():
        fee_needed = fee_usd_for_sccr(claim['sccr'], l_net_canonical)
        # Convert to sat/vB: fee_USD = (sats/vB * vB) / 1e8 * BTC_price
        # So sats/vB = fee_USD * 1e8 / (vB * BTC_price)
        # At BTC=$63K (current): sats/vB = fee_USD * 1e8 / (1e6 * 63000)
        sats_vb_at_63k = fee_needed * 1e8 / (vB_per_block * 63000)
        print(f"  {era:<6} {claim['sccr']:<14} ${fee_needed:>20,.0f}        {sats_vb_at_63k:<14.1f}")
    
    print()
    print("  * Implied sat/vB at BTC=$63,000 (current price). Historical prices would differ.")
    print("  * At N=32000, these fee levels are implausibly high for most blocks.")
    print("  * The Q7 claim says 'era-adjusted node counts' — if N was LOWER,")
    print("    L_net is smaller, and lower fee_USD suffices. This is the key uncertainty.")
    
    # Era-adjusted N analysis
    print()
    print("=" * 78)
    print("  ERA-ADJUSTED NODE COUNT ANALYSIS")
    print("=" * 78)
    print(f"  If Q7 partials are computed at era-appropriate N:")
    print()
    print(f"  {'Era':<6} {'Claimed SCCR':<14} {'N needed for claim':<20} {'Fee_USD needed':<20}")
    print(f"  {'-'*6:<6} {'-'*14:<14} {'-'*20:<20} {'-'*20:<20}")
    
    # Known-ish historical node counts (from general knowledge, NOT repo evidence)
    # Bitcoin Core node estimates: 2017 ~5K-10K, 2021 ~10K-15K, 2023 ~15K-20K, 2024 ~20K-25K
    era_n_estimates = {
        '2017': 8000,   # Rough estimate: ~10K nodes during the bull run
        '2021': 12000,  # Rough estimate: ~12K nodes
        '2023': 15000,  # Rough estimate: ~15K nodes
        '2024': 20000,  # Rough estimate: ~20K nodes
    }
    
    for era, claim in q7_claims.items():
        n_est = era_n_estimates.get(era, 'unknown')
        if isinstance(n_est, int):
            l_net_era = cfg['C'] * cfg['T'] * n_est / cfg['R_blocks']
            fee_needed = claim['sccr'] * l_net_era
            print(f"  {era:<6} {claim['sccr']:<14} N={n_est:<16} ${fee_needed:>16,.0f}")
        else:
            print(f"  {era:<6} {claim['sccr']:<14} {'N=unknown':<16} {'?':>16}")
    
    # Data availability assessment
    print()
    print("=" * 78)
    print("  DATA AVAILABILITY ASSESSMENT")
    print("=" * 78)
    
    data_avail = [
        ('2013', 'NOT AVAILABLE', 'No fee data, no price data, no node count'),
        ('2015', 'NOT AVAILABLE', 'No fee data, no price data, no node count'),
        ('2017', 'NOT AVAILABLE (in repo)', 'Blockstream provides block headers only; no aggregate fees'),
        ('2019', 'NOT AVAILABLE', 'No fee data, no price data, no node count'),
        ('2021', 'NOT AVAILABLE (in repo)', 'Blockstream provides block headers only; no aggregate fees'),
        ('2023', 'NOT AVAILABLE (in repo)', 'backtest.py only covers UTXO model, not SCCR'),
        ('2024', 'NOT AVAILABLE', 'No fee data, no price data, no node count'),
        ('2025', 'NOT AVAILABLE', 'No fee data, no price data, no node count'),
        ('2026', 'PARTIAL', 'fee_history.json (Aug 16-22), sccr_history.json (Aug 2-Sep 9)'),
    ]
    
    print(f"  {'Era':<6} {'Status':<30} {'Notes'}")
    print(f"  {'-'*6:<6} {'-'*30:<30} {'-'*40}")
    for era, status, notes in data_avail:
        print(f"  {era:<6} {status:<30} {notes}")
    
    # Build the output JSON
    historical_series = {
        "schema": "bsahi.sccr-historical/1",
        "generated_at": "2026-09-09T23:00:00Z",
        "model_spec_version": cfg['version'],
        "canonical_l_net_usd": round(l_net_canonical, 6),
        "canonical_cb": cb,
        "canonical_l_node": l_node,
        "status": "INCOMPLETE — data gaps prevent full reconstruction",
        "l_net_formula": "C × T × N / R_blocks",
        "sccr_formula": "fee_USD / L_net",
        "canonical_constants": {
            "C_usd_per_year": cfg['C'],
            "N_nodes": cfg['N'],
            "T_years": cfg['T'],
            "B_block_bytes": cfg['B_block'],
            "R_blocks_per_year": cfg['R_blocks']
        },
        "eras": [],
        "q7_claims": {},
        "data_gaps": [
            "No historical fee data (sat/vB per block) exists in the repo for any pre-2026 period",
            "No historical BTC price data exists in the repo",
            "No historical node count (N) data exists in the repo — N=32000 is only the 2026-08-02 census",
            "Blockstream API provides block headers (size, tx_count, timestamp) but NOT aggregate fees per block",
            "Mempool.space is not reachable from the production machine; even if reachable, it provides recent data only",
            "The backtest.py only covers the UTXO cost model (not SCCR) with 2023-era intentional overrides",
            "The sccr_dynamics.py computes FUTURE scenarios (Q1/Q4/Q5), not historical SCCR values",
            "The Q7 partials (2017≈10.0, 2021≈8.0, 2023≈5.0, 2024≈4.8) are stated as facts in working-paper §10 Q7 but have NO source data, NO derivation script, and NO historical capture backing them",
            "The phrase 'era-adjusted node counts' in Q7 implies different N per era, but no historical N values are provided"
        ],
        "q7_claims_verbatim": {
            "source": "research/working-paper.md §10 Q7 and research/future-directions-v3.md §1",
            "verbatim": "Historically yes: SCCR averaged above 1× in 2017–2024 fee-peak years (2017 avg ~10.0, 2021 ~8.0, 2023 ~5.0, 2024 ~4.8, era-adjusted node counts); 2025–2026 is the first sustained sub-1× regime",
            "verification_status": "UNVERIFIED — no source data, derivation, or script found in repo"
        }
    }
    
    # Add era entries
    for era, status, notes in data_avail:
        entry = {
            "era": era,
            "reconstructable": False,
            "status": status,
            "notes": notes,
            "fee_data_available": False,
            "btc_price_data_available": False,
            "node_count_data_available": False,
            "sccr_computable": False,
            "q7_claim_sccr": q7_claims.get(era, {}).get('sccr', None),
            "q7_claim_verified": False,
            "confidence": "NONE"
        }
        historical_series["eras"].append(entry)
    
    # Add the 2026 partial
    historical_series["eras"].append({
        "era": "2026",
        "reconstructable": True,
        "status": "PARTIAL — live data available",
        "notes": "fee_history.json (Aug 16-22), sccr_history.json (Aug 2-Sep 9), captured-data (Jul 30-Aug 22)",
        "fee_data_available": True,
        "btc_price_data_available": True,
        "node_count_data_available": True,
        "sccr_computable": True,
        "q7_claim_sccr": None,
        "q7_claim_verified": False,
        "confidence": "HIGH (live measurement)",
        "l_net_canonical": l_net_canonical,
        "latest_observation": {"date": "2026-09-09", "avg_sccr": 0.371939, "blocks": 137},
        "series_range": {"min_sccr": 0.157405, "max_sccr": 0.450841, "period": "2026-08-02 to 2026-09-09"}
    })
    
    # Write the output
    output_path = os.path.join(REPO, 'data', 'sccr_historical_series.json')
    with open(output_path, 'w') as f:
        json.dump(historical_series, f, indent=2, default=str)
    print()
    print(f"  Wrote {output_path}")
    
    # Final verdict
    print()
    print("=" * 78)
    print("  VERDICT")
    print("=" * 78)
    print("  TEST: Does SCCR survive historical reconstruction?")
    print()
    print("  RESULT: C (Broken) — structural problems")
    print()
    print("  REASONS:")
    print("  1. The historical SCCR partials (2017≈10.0, 2021≈8.0, 2023≈5.0, 2024≈4.8)")
    print("     are UNVERIFIABLE from existing BSAHI assets. They are stated as facts")
    print("     in working-paper §10 Q7 with no source data, no derivation script,")
    print("     and no historical fee/price/node captures.")
    print("  2. No historical fee data exists in the repo for any pre-2026 period.")
    print("  3. The Blockstream API provides block headers but NOT aggregate fees")
    print("     per block — reconstructing fee_USD would require fetching every")
    print("     transaction in every historical block (thousands of requests).")
    print("  4. The Q7 partials say 'era-adjusted node counts' but provide no historical")
    print("     N values. Without historical N, the SCCR formula cannot be evaluated.")
    print("  5. The backtest.py and sccr_dynamics.py do NOT compute historical SCCR.")
    print("  6. The 'era-adjusted' language suggests the partials may have been")
    print("     computed with different N values per era — but this is undocumented.")
    print()
    print("  HOWEVER: The CANONICAL FORMULA is sound and reproducible.")
    print("  The SCCR framework itself (model-spec.json v2.1.0) is coherent.")
    print("  The problem is DATA AVAILABILITY, not model coherence.")
    print()
    print("  GO/NO-GO for Step 2 (BIP-110 case study):")
    print("  → CONDITIONAL NO-GO: The BIP-110 measurement can proceed using 2026")
    print("    live data (which exists), but the HISTORICAL comparison is")
    print("    unverifiable. Step 2 should be scoped to current-regime measurement.")
    
    return historical_series

if __name__ == '__main__':
    build_reconstruction()
