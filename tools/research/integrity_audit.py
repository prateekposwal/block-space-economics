#!/usr/bin/env python3
"""Research-integrity audit (P0).

Checks the datasets, not the prose:

  A. HEIGHTS/DATES  — every (height, timestamp) pair is monotonic, and known
                      on-chain anchors are consistent across files.
  B. UNITS          — derived unit fields agree with their raw counterparts
                      (e.g. hashrate_ehs == hashrate_ths / 1e6); declared source
                      units are recorded where the tool expects them.
  C. PROVENANCE     — every data/*.json carries schema + generated_at + a source
                      or method; flags the ones that do not.
  D. LAYERS         — each dataset is classified observed / reconstructed /
                      modelled. Observed means "read from a node or a frozen
                      primary capture"; reconstructed means derived by a stated
                      procedure; modelled means assumptions dominate.

Writes data/integrity_audit.json and prints a summary. Exit code is non-zero if
any FAIL-level check fails, so it can gate CI.
"""
import datetime
import glob
import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DATA = os.path.join(ROOT, "data")
OUT = os.path.join(DATA, "integrity_audit.json")

# Known on-chain anchors (primary-source verified): height -> UTC date
ANCHORS = {
    671462: "2021-02-25",   # our own gettxoutsetinfo capture (IBD tip)
    963648: "2026-08-23",   # BIP-110 lock-in (blockstream.info)
    966270: "2026-09-09",   # BIP-110 post-lock-in snapshot
}

# Datasets that are OBSERVED (measured), per the project's own definitions.
OBSERVED = {
    "utxo_state_series.json", "utxo_state_latest.json",
    "sccr.json", "sccr_latest.json", "sccr_history.json",
    "perblock_validation.json", "bip110.json", "bip110_daily.json",
    "difficulty_series.json", "mempool_congestion_series.json",
    "production_cost_ratio.json",   # producing-side measured legs + documented assumptions
    "fee_history.json", "block_interval.json", "hashrate.json",
}
# Datasets where reconstruction is explicit.
RECONSTRUCTED = {"sccr_historical_series.json", "utxo_series.json", "utxo_cost_ratio.json"}
# Datasets where assumptions dominate.
MODELLED = {"verify_cost_index.json", "bandwidth_bound.json", "roi.json"}


def load(p):
    try:
        with open(p) as f:
            return json.load(f)
    except Exception:
        return None


def audit_heights():
    findings = []
    pairs = []
    pv = load(os.path.join(DATA, "perblock_validation.json"))
    if pv:
        for r in pv.get("_rows", []):
            for s in r.get("samples", []):
                if s and "height" in s and "timestamp" in s:
                    pairs.append((s["height"], s["timestamp"], "perblock_validation"))
    us = load(os.path.join(DATA, "utxo_state_latest.json"))
    if us:
        h = us.get("height")
        ma = us.get("measured_at")
        if h and ma:
            ts = int(datetime.datetime.fromisoformat(ma.replace("Z", "+00:00")).timestamp())
            pairs.append((h, ts, "utxo_state_latest"))
    bip = load(os.path.join(DATA, "bip110.json"))
    if bip:
        w = bip.get("window") or {}
        for k in ("lockIn", "currentHeight"):
            if isinstance(w.get(k), int):
                pass  # no timestamp alongside; skipped deliberately
    # monotonicity per source
    by_src = {}
    for h, ts, src in pairs:
        by_src.setdefault(src, []).append((ts, h))
    for src, rows in by_src.items():
        rows.sort()
        bad = [(a, b) for a, b in zip(rows, rows[1:]) if b[1] < a[1]]
        findings.append({"check": "monotonicity", "source": src, "status": "PASS" if not bad else "FAIL",
                         "detail": f"{len(rows)} pairs, {len(bad)} inversions" + (f" e.g. {bad[:2]}" if bad else "")})
    # Anchor consistency: the height's CHAIN date (block_time) must match the known
    # anchor; the capture time (measured_at) is separate and may differ by years
    # while the node is in IBD. Never conflate the two.
    if us:
        h = us.get("height")
        bt = (us.get("block_time") or "")[:10]
        ma = (us.get("measured_at") or "")[:10]
        if h in ANCHORS:
            if bt:
                ok = ANCHORS[h] == bt
                findings.append({"check": "anchor:chain_date", "source": "utxo_state_latest",
                                 "status": "PASS" if ok else "FAIL",
                                 "detail": f"height {h}: block_time {bt} vs anchor {ANCHORS[h]} (captured {ma})"})
            else:
                findings.append({"check": "anchor:chain_date", "source": "utxo_state_latest", "status": "INFO",
                                 "detail": f"height {h} = {ANCHORS[h]} (chain); captured {ma}; block_time not recorded in this row (pre-dates the field)"})
    return findings


def audit_units():
    findings = []
    pc = load(os.path.join(DATA, "production_cost_ratio.json"))
    if pc:
        bad = []
        for e in pc.get("eras", []):
            ths, ehs = e.get("hashrate_ths"), e.get("hashrate_ehs")
            if ths and ehs and abs(ehs - ths / 1e6) > 1e-3:
                bad.append(e["era"])
            if ths and ehs and abs(ehs) > 5000:   # anything >5 ZH/s is implausible
                bad.append(e["era"] + "(implausible)")
            # power sanity: TH/s x J/TH = W
            pw = ths * e.get("asec_efficiency_j_per_th", 0)
            if pw and abs(pw / 1e9 - e.get("power_gw", 0)) > 0.5:
                bad.append(e["era"] + "(power)")
        findings.append({"check": "units:hashrate_ehs==ths/1e6 & power==ths*eff", "source": "production_cost_ratio",
                         "status": "PASS" if not bad else "FAIL", "detail": f"eras with mismatches: {bad or 'none'}"})
    # VCI: GB conversions use 1e9 (decimal) for bytes
    vci = load(os.path.join(DATA, "verify_cost_index.json"))
    if vci:
        e26 = next((e for e in vci.get("eras", []) if e["era"] == "2026"), None)
        findings.append({"check": "units:chain size is decimal GB (1e9 bytes)", "source": "verify_cost_index",
                         "status": "PASS" if e26 else "WARN",
                         "detail": f"2026 chain_gb={e26['chain_gb']} (decimal GB)" if e26 else "no 2026 era"})
    return findings


# Keys that legitimately declare WHEN a dataset was produced. Generators differ
# (captured_at / measured_at / verified_at / observedAt); the audit's intent is
# "does the dataset declare its production time", not "does it use one spelling".
# `date`/`as_of` are deliberately excluded: those are the data's reference period,
# not the generation instant, and must not satisfy this check.
TIME_KEYS = ("generated_at", "produced_at", "registered_at", "captured_at",
             "measured_at", "verified_at", "observed_at", "observedAt")


def audit_provenance():
    findings = []
    missing = []
    for p in sorted(glob.glob(os.path.join(DATA, "*.json"))):
        name = os.path.basename(p)
        if name in NON_RESEARCH:
            continue   # ops/runtime files: provenance is not part of the research claim
        d = load(p)
        if not isinstance(d, dict):
            continue
        has_schema = bool(d.get("schema") or d.get("schema_version"))
        has_time = any(d.get(k) for k in TIME_KEYS)
        has_src = any(k in d for k in ("source", "sources", "provenance", "method",
                                        "inputs", "note", "notes"))
        if not (has_schema and has_time and has_src):
            missing.append({"file": name, "schema": has_schema, "generated_at": has_time, "source": has_src})
    findings.append({"check": "provenance(schema+generated_at+source)", "source": "data/*.json",
                     "status": "PASS" if not missing else "WARN",
                     "detail": f"{len(missing)} dataset(s) incomplete", "missing": missing})
    return findings


# Layers established by the Evidence Matrix (research/evidence-matrix.md) for
# datasets whose generator does not yet emit a 'layer' field.
MATRIX_LAYER = {
    "fee_history_blocks.json": "observed", "lightning_history.json": "observed",
    "mempool_fee_histogram.json": "observed", "mining_concentration.json": "observed",
    "node_census.json": "observed", "node_census_anchors.json": "observed",
    "node_census_series.json": "observed", "node_version_distribution.json": "observed",
    "pool_attribution_validation.json": "observed",
}

# Ops / runtime / pipeline files — not research datasets, so the layer check is N/A.
NON_RESEARCH = {
    "alerts.json", "beta-status.json", "beta-users.json", "ops-health.json",
    "site-health.json", "snapshot.json", "latest.json", "fee_forecast.json",
    "integrity_audit.json", "content.json", "adoption.json", "roi.json", "datasets.json",
    "bitcoin-weather-2.json",
}


def audit_layers():
    findings = []
    missing = []
    for p in sorted(glob.glob(os.path.join(DATA, "*.json"))):
        name = os.path.basename(p)
        d = load(p)
        if not isinstance(d, dict):
            continue
        if name in NON_RESEARCH:
            continue
        if ("layer" not in d and name not in OBSERVED and name not in RECONSTRUCTED
                and name not in MODELLED and name not in MATRIX_LAYER):
            missing.append(name)
    findings.append({"check": "layer field or explicit classification", "source": "data/*.json",
                     "status": "PASS" if not missing else "WARN",
                     "detail": (f"{len(missing)} research dataset(s) without an explicit layer field: {missing}" if missing else "all research datasets classified")})
    return findings


def audit_model_spec():
    """Assert every N-derived value in model-spec.json is consistent with
    quantities.N — the single source of truth.

    Motivated by a real defect: quantities.N was re-based to 26,586 while
    L_net still held the N=32,000 value (5627.808) and bw_cost_per_year_net held
    126230.4. A consumer trusting those computed SCCR ~17% low. This is a FAIL
    (not a WARN): a self-contradicting canonical spec is a correctness bug.
    """
    findings = []
    p = os.path.join(ROOT, "research", "model-spec.json")
    spec = load(p)
    if not isinstance(spec, dict):
        return [{"check": "model-spec N-derivation", "source": "research/model-spec.json",
                 "status": "FAIL", "detail": "model-spec.json unreadable"}]
    q = spec.get("quantities", {})
    try:
        N = float(q["N"]["value"])
        L = float(q["L"]["value"])
        bw_node = float(q["bw_cost_per_year_node"]["value"])
        checks = [
            ("L_net", L * N, float(q["L_net"]["value"]), 0.05),
            ("bw_cost_per_year_net", bw_node * N, float(q["bw_cost_per_year_net"]["value"]), 0.5),
        ]
    except Exception as e:
        return [{"check": "model-spec N-derivation", "source": "research/model-spec.json",
                 "status": "FAIL", "detail": f"cannot read quantities: {str(e)[:60]}"}]
    drift = []
    for name, expect, got, tol in checks:
        if abs(expect - got) > tol:
            drift.append(f"{name}={got} but N*...={expect:.3f}")
    findings.append({
        "check": "model-spec N-derivation (quantities.N is the single source of truth)",
        "source": "research/model-spec.json", "status": "PASS" if not drift else "FAIL",
        "detail": ("all N-derived values match quantities.N=%g" % N) if not drift
                  else "DRIFT: " + "; ".join(drift)})
    return findings


def main():
    findings = (audit_heights() + audit_units() + audit_provenance() + audit_layers()
                + audit_model_spec())
    fails = [f for f in findings if f["status"] == "FAIL"]
    out = {
        "schema": "bsahi.integrity-audit/1",
        "generated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "method": "tools/research/integrity_audit.py — checks heights/dates, units, provenance, layers",
        "findings": findings,
        "summary": {"checks": len(findings), "fail": len(fails), "warn": sum(1 for f in findings if f["status"] == "WARN")},
    }
    with open(OUT, "w") as f:
        json.dump(out, f, indent=2)
    for f in findings:
        print(f"[{f['status']:4}] {f['check']}: {f['detail']}")
    print(f"\nwrote {os.path.relpath(OUT, ROOT)}")
    return 1 if fails else 0


if __name__ == "__main__":
    raise SystemExit(main())
