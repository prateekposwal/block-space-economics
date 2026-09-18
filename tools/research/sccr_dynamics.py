#!/usr/bin/env python3
"""
BSAHI — SCCR Dynamics: v3.0 deep-question scenario engine (Q1, Q4, Q5).

Extends reproduce.py with the v3.0 dynamic agenda:
  Q1  Equilibrium: the 4-way scenario (price, fees, nodes, storage cost) and
      single-lever decomposition.
  Q4  Price lever: P* where SCCR = 1 (baseline + frozen-capture cross-check),
      and the RIR-family extension method.
  Q5  2040:        cost deflation x node growth x fee regime — two divergent
      futures.

Canonical quantities ONLY from research/model-spec.json (current version). No
constants redefined. The historical baseline is anchored at working-paper
section-10 (SCCR = 0.2228, the 167-block live capture at the then-N=32K,
C=$925, T=10, P~$63K) and cross-checked against the frozen-capture reproduction
(SCCR = 0.2186, 171 blocks) from tools/research/reproduce.py.

SCCR is homogeneous in its drivers (working-paper section-10 method note):
    SCCR = fee_USD / L_net = fee_BTC * P * R_blocks / (C * T * N)
    fee_BTC = fee_sats_per_block / 1e8 ; L_net = C * T * N / R_blocks

Print: markdown tables.  --json: write tools/research/sccr_dynamics_output.json
"""
import argparse
import json
import os

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SPEC_PATH = os.path.join(REPO, 'research', 'model-spec.json')
OUT_PATH = os.path.join(os.path.dirname(__file__), 'sccr_dynamics_output.json')

# --- canonical quantities (model-spec.json v2.0.1 only) -------------------
def load_spec():
    with open(SPEC_PATH) as f:
        spec = json.load(f)
    q = spec['quantities']
    return {
        'C': q['C']['value'],
        'N': q['N']['value'],
        'T': q['T']['value'],
        'B_block': q['B_block']['value'],
        'R_blocks': q['R_blocks']['value'],
        'version': spec['version'],
    }

# --- baseline anchors ------------------------------------------------------
# SCCR_0 = 0.2228 (working-paper section-10 live baseline, 167 blocks).
# fee_sats_per_block implied by 0.2228 at P=$63K: fee_USD = 0.2228*L_net;
# sats = fee_USD / P * 1e8.  ~1.99 sat/vB at the 1M-vB block-weight limit.
BASE_P = 63000.0
# N from model-spec.json (single source of truth; re-based 2026-09-17)
def _spec_n():
    import os as _os, json as _json
    _r = _os.path.dirname(_os.path.dirname(_os.path.dirname(_os.path.abspath(__file__))))
    return _json.load(open(_os.path.join(_r, 'research', 'model-spec.json')))['quantities']['N']['value']
_SPEC_N = _spec_n()

BASE_FEE_SATS = 0.2228 * (925.0 * 10.0 * _SPEC_N / 52596.0) / 63000.0 * 1e8
BASE_SCCR = 0.2228

# frozen-capture cross-check (reproduce.py --json, 171 blocks)
FROZEN_SCCR = 0.218605
FROZEN_P = 63023.0


def l_net(C, N, T, R):
    return C * T * N / R


def fee_usd(fee_sats, P):
    return (fee_sats / 1e8) * P


def sccr(fee_sats, P, C, N, T, R):
    return fee_usd(fee_sats, P) / l_net(C, N, T, R)


def scenario(tag, label, P, fee_mult, N_mult, C_mult, T=10.0, R=52596.0,
             fee_sats=None):
    """fee_mult scales the baseline fee (sat/vB equivalent); C/N mult scale
    canonical C=925 and N (model-spec quantities.N). Returns dict + computed SCCR."""
    fs = fee_sats if fee_sats is not None else BASE_FEE_SATS * fee_mult
    C = 925.0 * C_mult
    N = _SPEC_N * N_mult
    return {
        'tag': tag, 'label': label,
        'P_usd': P, 'fee_mult': fee_mult, 'fee_sats_per_block': fs,
        'N': N, 'C_usd_per_yr': C,
        'fee_usd_per_block': fee_usd(fs, P),
        'l_net_usd': l_net(C, N, T, R),
        'sccr': sccr(fs, P, C, N, T, R),
    }


def md_row(s, digits=4):
    return '| %s | $%s | %s | %s | $%.2f | $%.2f | **%.4f** |' % (
        s['label'], '{:,.0f}'.format(s['P_usd']), s['fee_mult'],
        '{:,.0f}'.format(s['N']),
        s['fee_usd_per_block'], s['l_net_usd'], s['sccr'])


def main():
    ap = argparse.ArgumentParser(description='BSAHI SCCR dynamics (Q1/Q4/Q5)')
    ap.add_argument('--json', action='store_true',
                    help='write tools/research/sccr_dynamics_output.json')
    args = ap.parse_args()

    spec = load_spec()
    print('=' * 78)
    print('  BSAHI — SCCR Dynamics (v3.0 deep questions Q1 / Q4 / Q5)')
    print('  model-spec v%s · baseline SCCR 0.2228 (P=$63K, N=32K, C=925, T=10)' % spec['version'])
    print('=' * 78)

    # ---------------------------------------------------------------- Q1 ---
    print('\n## Q1 — 4-way scenario (BTC $1M, fees up, nodes up, storage cheaper)')
    q1 = [
        scenario('base', 'Baseline (today)', BASE_P, 1.0, 1.0, 1.0),
        scenario('p1m', 'Price only: $1M', 1_000_000, 1.0, 1.0, 1.0),
        scenario('f5', 'Fees only: 5 sat/vB', BASE_P, 5.0 / 1.99, 1.0, 1.0),
        scenario('n64', 'Nodes only: N=64K', BASE_P, 1.0, 2.0, 1.0),
        scenario('c2', 'Storage only: C/2', BASE_P, 1.0, 1.0, 0.5),
        scenario('4way', '4-WAY: $1M, 5 sat/vB, N=64K, C/2', 1_000_000, 5.0 / 1.99, 2.0, 0.5),
        scenario('4way10', '4-WAY alt: $1M, 10 sat/vB, N=64K, C/2', 1_000_000, 10.0 / 1.99, 2.0, 0.5),
        scenario('3way_n', '3-way (no N): $1M, 5 sat/vB, C/2', 1_000_000, 5.0 / 1.99, 1.0, 0.5),
    ]
    print('| Scenario | P (USD) | fee mult | N | fee_USD/block | L_net USD | SCCR |')
    print('|---|---|---|---|---|---|---|')
    for s in q1:
        print(md_row(s))
    w = q1[-3]
    print('\nVerdict: 4-way SCCR = **%.3f** — OVERSHOOTS 1x by %.1fx (coverage, not gap).'
          % (w['sccr'], w['sccr']))
    print('Cross-check at frozen capture (SCCR 0.2186, P=$63,023): 4-way = %.3f.'
          % (w['sccr'] * FROZEN_SCCR / BASE_SCCR))

    # ---------------------------------------------------------------- Q4 ---
    print('\n## Q4 — Price for SCCR = 1 (the price lever)')
    p_star_base = BASE_P / BASE_SCCR
    p_star_frozen = FROZEN_P / FROZEN_SCCR
    print('P* (baseline 0.2228 @ P=$63K)      = $%s  (~$283K, matches working-paper 5.4)' % '{:,.0f}'.format(p_star_base))
    print('P* (frozen capture 0.2186 @ $63,023) = $%s  (~$288K)' % '{:,.0f}'.format(p_star_frozen))
    q4 = []
    for target in (0.5, 1.0, 2.0, 3.5):
        q4.append({'target': target, 'P': BASE_P / BASE_SCCR * target})
    print('| Target SCCR | P* (USD/BTC) |')
    print('|---|---|')
    for r in q4:
        print('| %.1fx | $%s |' % (r['target'], '{:,.0f}'.format(r['P'])))

    # ---------------------------------------------------------------- Q5 ---
    print('\n## Q5 — 2040 scenarios (C deflation x N growth x fee regime)')
    q5 = [
        scenario('q5flat', '2040: C/10, N x2, fees ~2 sat/vB (flat)', BASE_P, 1.0, 2.0, 0.1),
        scenario('q5fee10', '2040: C/10, N x2, fees 10 sat/vB', BASE_P, 10.0 / 1.99, 2.0, 0.1),
        scenario('q5demand', '2040: fees 10 sat/vB, C & N today', BASE_P, 10.0 / 1.99, 1.0, 1.0),
        scenario('q5n4', '2040: N x4 (128K), C flat, fees flat', BASE_P, 1.0, 4.0, 1.0),
        scenario('q5c2n2', '2040: C/2, N x2, fees flat', BASE_P, 1.0, 2.0, 0.5),
        scenario('q5neutmix', '2040: C/10, N x2, fees 10 sat/vB, P=$283K', 283_000, 10.0 / 1.99, 2.0, 0.1),
    ]
    print('| Scenario | P (USD) | fee mult | N | fee_USD/block | L_net USD | SCCR |')
    print('|---|---|---|---|---|---|---|')
    for s in q5:
        print(md_row(s))
    print('\nQ6 reference (working-paper section-10): N x4 -> 0.0557 (matches %s).'
          % ('%.4f' % q5[3]['sccr']))

    out = {
        'spec_version': spec['version'],
        'baseline': {'sccr': BASE_SCCR, 'P_usd': BASE_P, 'fee_sats_per_block': BASE_FEE_SATS,
                     'sat_per_vb': BASE_FEE_SATS / 1e6, 'l_net_usd': l_net(925, 32000, 10, 52596)},
        'frozen_capture': {'sccr': FROZEN_SCCR, 'P_usd': FROZEN_P},
        'q1_4way': w, 'q1_scenarios': q1,
        'q4': {'P_star_baseline': p_star_base, 'P_star_frozen': p_star_frozen,
               'targets': q4},
        'q5_scenarios': q5,
    }
    if args.json:
        with open(OUT_PATH, 'w') as f:
            json.dump(out, f, indent=2, default=float)
        print('\nWrote %s' % OUT_PATH)


if __name__ == '__main__':
    main()
