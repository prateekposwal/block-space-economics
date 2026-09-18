#!/usr/bin/env python3
"""
SCCR Reproduction — Python implementation (independent of storage-ratio.js).

Computes the Storage Cost Coverage Ratio (SCCR) for every block in the frozen
fee_history capture, using ONLY:
  1. research/model-spec.json            (canonical model constants, v2.0.1)
  2. research/reproduce/input/fee_history_capture.json   (frozen live capture)

Formula (model-spec v2.0.1 / storage-ratio.js):
    R_blocks = 365.25 * 24 * 6                     (blocks per year)
    cb       = C / (B_block * R_blocks)            (cost per byte per year, USD/(byte*yr))
    L_node   = B_block * cb * T                    (lifetime storage cost per node per block)
    L_net    = L_node * N                          (network lifetime cost per block)
    SCCR_i   = (avgFees_i / 1e8 * USD_i) / L_net   (dimensionless, per block)

No script redefines a model constant; all quantities come from the spec JSON.
"""
import json
import os
import sys

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SPEC_PATH = os.path.join(REPO, 'research', 'model-spec.json')
INPUT_PATH = os.path.join(os.path.dirname(__file__), 'input', 'fee_history_capture.json')


def load_spec():
    with open(SPEC_PATH) as f:
        spec = json.load(f)
    q = spec['quantities']
    return {
        'C': q['C']['value'],
        'N': q['N']['value'],
        'T': q['T']['value'],
        'B_block': q['B_block']['value'],
        'version': spec['version'],
    }


def compute(cfg, capture):
    r_blocks = 365.25 * 24 * 6
    cb = cfg['C'] / (cfg['B_block'] * r_blocks)
    l_net = cfg['B_block'] * cb * cfg['T'] * cfg['N']
    results = []
    for entry in capture:
        fee_sats = entry.get('avgFees', 0)
        usd = entry.get('USD')
        # Missing price -> the fee leg is uncomputable; SKIP (never fabricate a
        # price). Matches the C implementation and storage-ratio.js. Was `or 0`.
        if not fee_sats or not usd:
            continue
        fee_usd = (fee_sats / 1e8) * usd
        results.append({
            'height': entry.get('avgHeight'),
            'fee_sats': fee_sats,
            'usd': usd,
            'fee_usd': fee_usd,
            'l_net': l_net,
            'ratio': fee_usd / l_net,
        })
    return results, l_net, cb


def main():
    with open(INPUT_PATH) as f:
        capture = json.load(f)
    cfg = load_spec()
    results, l_net, cb = compute(cfg, capture)

    ratios = [r['ratio'] for r in results]
    avg = sum(ratios) / len(ratios)
    below_1 = sum(1 for r in ratios if r < 1.0)
    print('=' * 62)
    print('  SCCR Reproduction (Python) — research/reproduce_sccr.py')
    print(f'  model-spec: v{cfg["version"]}   capture: {len(capture)} blocks')
    print('=' * 62)
    print(f'  Blocks sampled      : {len(ratios)}')
    print(f'  Avg SCCR            : {avg:.4f}')
    print(f'  Min / Max           : {min(ratios):.4f} / {max(ratios):.4f}')
    print(f'  Blocks below 1.0    : {below_1}/{len(ratios)} ({below_1/len(ratios)*100:.1f}%)')
    print(f'  L_net (USD/block)   : {l_net:.6f}')
    print(f'  cb  (USD/(byte*yr)) : {cb:.6e}')

    out_path = os.path.join(os.path.dirname(__file__), 'output', 'reproduce_sccr_python.json')
    with open(out_path, 'w') as f:
        json.dump({
            'implementation': 'python',
            'spec_version': cfg['version'],
            'capture_entries': len(capture),
            'blocks': len(ratios),
            'avg_sccr': round(avg, 6),
            'min': round(min(ratios), 6),
            'max': round(max(ratios), 6),
            'below_1x': below_1,
            'below_1x_pct': round(below_1 / len(ratios) * 100, 2),
            'l_net': l_net,
            'cb': cb,
            'per_block': [{'height': r['height'], 'ratio': round(r['ratio'], 6)} for r in results],
        }, f, indent=2)
    print(f'  wrote output/reproduce_sccr_python.json')
    return avg


if __name__ == '__main__':
    sys.exit(0 if main() else 1)
