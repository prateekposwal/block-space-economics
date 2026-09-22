#!/usr/bin/env python3
"""Bridge reserve monitor — the backing-ratio invariant.

WHY THIS EXISTS (and why a Bitcoin-only monitor cannot do it)

A bridge is two ledgers pretending to be one asset:

    Bitcoin chain:  BTC locked in custody          (SAY the reserve)
    host chain(s):  tokens minted against it        (the CLAIM)

Bitcoin can only ever show you the SAY. The exploit lives in the CLAIM. A
Bitcoin-only custody monitor therefore catches drains (real BTC leaving) but is
blind to Symbiosis — where 46.1 billion syBTC were minted against 330 satoshis
and NO bitcoin ever moved.

The fix is not a better Bitcoin monitor. It is to read BOTH sides and watch the
ratio:

    backing_ratio = BTC_reserves / token_supply

Both exploit families collapse the ratio below 1, just from opposite sides:

    reserves ↓ , supply flat   ->  custody DRAIN        (Liquid, 4,000 BTC out)
    supplies ↑ , reserves flat ->  UNBACKED MINT        (Symbiosis, Nomic)
    supply jumps by orders of magnitude -> fires instantly, no reserve needed

Reading the claim side is cheap: one eth_call to totalSupply(), through public
RPCs, cross-checked across several providers so a single lying or stale node
cannot move the number (same discipline as price_index.py).

This uses a wrapper's OWN published custodian address list, since custody is a
trust disclosure, not something derivable from the chain. Addresses are recorded
with provenance and every balance is measured, not transcribed.

HONEST SCOPE
  * Reads reserves and Ethereum supply. Other-chain supply is listed but NOT
    measured (the custodian truncates those addresses); its magnitude is
    published so the ratio's error bound is stated rather than hidden.
  * Under-counting supply would OVER-state the ratio and hide a shortfall, so
    the unmeasured gap is reported explicitly in the output.
  * This is a solvency/backing monitor, not an exploit detector. It sees the
    CONSEQUENCE of an unbacked mint (supply detachment), not the bug.

Writes data/bridge_reserves.json (+ captured-data/bridge/history.jsonl).
"""
import datetime
import json
import os
import statistics
import subprocess
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import sys
sys.path.insert(0, os.path.join(ROOT, "tools"))
from netfetch import bounded_get  # noqa: E402
OUT = os.path.join(ROOT, "data", "bridge_reserves.json")
CAP = os.path.join(ROOT, "captured-data", "bridge")
UA = {"User-Agent": "bitcoinsahi-research/1.0 (+https://bitcoinsahi.com)"}
ESPLORA = ["https://blockstream.info/api", "https://mempool.space/api"]

# Alert bands on the backing ratio. A fully-backed wrapper sits at ~1.00; the
# float is peg-in-in-transit and unclaimed mints, so small undershoot is normal.
BAND_OK = 0.999
BAND_WATCH = 0.98
# A supply move this large between snapshots is a step change, not organic flow.
SUPPLY_STEP_ALERT_PCT = 5.0

# Custodian addresses are PUBLISHED by the issuer (custody is a disclosure, not a
# chain-derivable fact) and verified on-chain by this tool before being trusted.
WRAPPERS = [
    {
        "id": "wbtc",
        "name": "Wrapped BTC (WBTC)",
        "token": {
            "chain": "ethereum",
            "address": "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599",
            "decimals": 8,
        },
        "supply_rpcs": [
            "https://ethereum-rpc.publicnode.com",
            "https://eth.drpc.org",
            "https://eth-mainnet.public.blastapi.io",
            "https://1rpc.io/eth",
            "https://eth.merkle.io",
        ],
        "custody_source": "https://www.wbtc.network/transparency",
        # The custodian's own claimed reserve total. We measure against it to
        # detect an INCOMPLETE address list: that page paginates, so page 1
        # alone covers only part of the reserves and would fake a shortfall.
        "published_reserves_btc": 116511.9929,
        "bitcoin_custody": [
            "3PRCCQMdWwjEKy89iVdL8LouknsgygwWpL",
            "3NfBFZRgKfHVJy7rSTutZyGpa5M2GpRdwu",
            "3EmKqHZhXic3TymhuY8NLS7Bdk91erm4V7",
            "3QdyHj1i4y5CywEFWJ5PwoqGzDxGyJGPeb",
            "3MnCLWSq31hetgbVA1Xn1VxVVb31SPeSKa",
            "3HHLh4HSK8wj1w3YW9i4Chdnuybgadhpz1",
            "31sW8NHLr9MELRdoGPWrEk6wBd1pj2uzkB",
            "36jGhq48YgvjJWtEpqrc57QzXcBJQyCsS7",
            "36ZsF5YgJDW25eZKS6gnZMqW4gr6wv9xp1",
            "3KWe9k7TG2j7xNw8BP9YHXBeHy1knC1xGS",
            "3ARRJS9VNVkMdiESpxq2AGfpZUQRUvdGgd",
            "3FDtvkk7hpZq5GuEJxt3Ps95vjtdDEfJ4T",
            "36h9DtMdqYWTxSg1yys2exZPFQoQXv8QRL",
            "31oMgrBjhbAr1ZZjFUFYfDT1ZYvx3Qp9qL",
            "3CDy1xZavmpd27jV6TZm5teH8U6hrdXRES",
            "3Muz5dT5EguQgTiXgQ1eqJYNkjjQuSMgsb",
            "3MkzCjZjodyaBXz7W8i9NTjduEdykdkd89",
            "35bXvntqjj5LnEpRVqU9bLcAPtT9crggYj",
            "3PyK2LYBfYMUXsa8sMhTSHQZ8StQy3Xoz8",
            "3FVsTChmR7WYgfnU3CAmrrD3kqmaRMaJCC",
        ],
        # Supply on chains this tool does NOT read, with the custodian's own
        # last-published magnitudes. Disclosed so the ratio's error is bounded.
        "unmeasured_chains": {
            "solana": 104.8300, "tron": 99.8400, "kava": 76.3787,
            "osmosis": 85.9553, "bsc": 0.0, "base": 0.0050,
        },
    },
    {
        # Claim-side only. The federation is an 11-of-15 multisig and its
        # mainchain peg addresses are per-peg-in tweaks of the federation
        # script, so there is no static reserve address list to watch. The
        # Liquid ledger still gives us the part that an unbacked L-BTC mint
        # (the Sep 6 incident) inflates.
        "id": "lbtc",
        "name": "Liquid Bitcoin (L-BTC)",
        "kind": "supply_only",
        "supply_kind": "liquid_peg",
        "asset_id": "6f0279e9ed041c3d710a9f57d0c02928416460c4b722ae3457a11eec381c526d",
        "token": {"chain": "liquid", "address": "L-BTC", "decimals": 8},
        "bitcoin_custody": [],
        "custody_source": ("11-of-15 federation multisig; peg addresses are derived per "
                           "peg-in, so no static list. Reserve leg not wired."),
        "unmeasured_chains": {},
    },
]

# Replay fixtures: reported figures from incidents with no readable live supply
# (the token or its chain is gone/paused). `layer: replay` in the output keeps
# these quarantined from measured data — they exercise the DETECTOR, they are not
# measurements.
REPLAYS = [
    {
        "id": "symbiosis-2026-09-11",
        "name": "Symbiosis BridgeV2 (syBTC)",
        "mechanism": "unbacked mint",
        "supply_before_tokens": 13.91,
        "supply_after_tokens": 46_100_000_000.0,
        "reserves_before_btc": 15.0,     # ~15 BTC recovered/held by the bridge
        "reserves_after_btc": 15.0,      # no bitcoin ever moved
        "reported": "330 satoshi deposit -> 46.1B syBTC in ~4 minutes, 12 txs",
        "source": "Blockaid alert; Symbiosis post-mortem; CoinDesk/Cryptonomist coverage",
    },
    {
        "id": "liquid-2026-09-06",
        "name": "Liquid Network (L-BTC)",
        "mechanism": "custody drain",
        "supply_before_tokens": 4_200.0,
        "supply_after_tokens": 4_200.0,   # L-BTC supply unchanged
        "reserves_before_btc": 4_200.0,
        "reserves_after_btc": 200.0,      # ~4,000 BTC left the federation wallet
        "reported": "~4,000 of 4,200 BTC withdrawn; ~85% later returned",
        "source": "Blockstream disclosure; Liquid Network incident reports",
    },
]


def _get(url, timeout=20, raw=False, data=None):
    # bounded_get covers DNS too. This tool makes ~26 calls (20 custody addresses
    # + supply consensus); each one used to be able to hang on resolution, which
    # is how a run once took 9,335s.
    body = bounded_get(url, timeout=timeout, data=data).decode("utf-8", "replace")
    return body.strip() if raw else json.loads(body)


def _esplora(path, raw=False):
    last = None
    for base in ESPLORA:
        try:
            return _get(base + path, raw=raw)
        except Exception as e:      # noqa: BLE001
            last = e
    raise RuntimeError("all Esplora hosts failed for %s: %r" % (path, last))


def total_supply(rpc, address):
    """ERC-20 totalSupply() via eth_call. Selector 0x18160ddd."""
    payload = json.dumps({
        "jsonrpc": "2.0", "id": 1, "method": "eth_call",
        "params": [{"to": address, "data": "0x18160ddd"}, "latest"],
    }).encode()
    r = _get(rpc, data=payload)
    if "result" not in r:
        raise RuntimeError("rpc error: %s" % r.get("error"))
    return int(r["result"], 16)


LIQUID_API = "https://blockstream.info/liquid/api"


def liquid_supply(asset_id, decimals):
    """Circulating L-BTC from the Liquid peg ledger.

    The federation's mainchain peg addresses are per-peg-in tweaks of the
    federation script, not a static list, so the Bitcoin reserve leg cannot be
    wired from a published address list. The Liquid side is fully readable
    though: peg-in mints L-BTC, peg-out and explicit burns destroy it, so

        circulating = peg_in_amount - peg_out_amount - burned_amount

    That is the CLAIM side — exactly the side an unbacked L-BTC mint inflates —
    so it is worth monitoring on its own. Single source (Blockstream's Esplora),
    which is a real trust caveat: no second Liquid indexer is publicly available.
    """
    d = _get(LIQUID_API + "/asset/" + asset_id)
    c = d["chain_stats"]
    scale = 10 ** decimals
    pin = c.get("peg_in_amount", 0) / scale
    pout = c.get("peg_out_amount", 0) / scale
    burned = c.get("burned_amount", 0) / scale
    return pin - pout - burned, {
        "peg_in_amount": round(pin, 8),
        "peg_out_amount": round(pout, 8),
        "burned_amount": round(burned, 8),
        "peg_in_count": c.get("peg_in_count"),
        "peg_out_count": c.get("peg_out_count"),
    }


def supply_consensus(rpcs, address, decimals):
    """Query every RPC; they MUST agree (same chain => same number).

    A disagreement means a stale or lying node, so we take the median and record
    the spread rather than silently trusting whichever answered first.
    """
    values, errors = {}, {}
    for rpc in rpcs:
        try:
            values[rpc] = total_supply(rpc, address) / (10 ** decimals)
        except Exception as e:      # noqa: BLE001
            errors[rpc] = type(e).__name__
    if not values:
        return None, {}, errors
    med = statistics.median(values.values())
    used = {k: v for k, v in values.items() if abs(v - med) <= max(med * 1e-9, 1e-6)}
    return med, used, errors


_B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"


def valid_bitcoin_address(addr):
    """Checksum-validate before querying.

    Custody address lists are transcribed from rendered web pages, which mangle
    them (one WBTC address, 3EmKqHZ..., is published-but-invalid). An unchecked
    bad address silently drops a ~2,400 BTC reserve from the denominator's
    counterpart and fakes a shortfall, so validation is not optional.
    """
    import hashlib
    if not addr:
        return False
    if addr.startswith("bc1"):
        return len(addr) >= 14 and addr == addr.lower()   # bech32 charset checked by explorer
    if addr[0] not in "13":
        return False
    n = 0
    for ch in addr:
        i = _B58.find(ch)
        if i < 0:
            return False
        n = n * 58 + i
    pad = len(addr) - len(addr.lstrip("1"))          # leading '1' == leading zero byte
    raw = b"\x00" * pad + n.to_bytes((n.bit_length() + 7) // 8, "big")
    if len(raw) != 25:
        return False
    return hashlib.sha256(hashlib.sha256(raw[:21]).digest()).digest()[:4] == raw[21:]


def address_balance(addr):
    """(confirmed_btc, unconfirmed_btc, utxos) for a Bitcoin address."""
    d = _esplora("/address/" + addr)
    c = d["chain_stats"]
    m = d.get("mempool_stats", {})
    conf = (c["funded_txo_sum"] - c["spent_txo_sum"]) / 1e8
    unconf = (m.get("funded_txo_sum", 0) - m.get("spent_txo_sum", 0)) / 1e8
    return conf, unconf, c["funded_txo_count"] - c["spent_txo_count"]


def custody_total(addresses):
    rows, conf, unconf = [], 0.0, 0.0
    for a in addresses:
        if not valid_bitcoin_address(a):
            rows.append({"address": a, "error": "INVALID_ADDRESS"})
            continue
        try:
            c, u, n = address_balance(a)
        except Exception as e:      # noqa: BLE001
            rows.append({"address": a, "error": type(e).__name__})
            continue
        conf += c
        unconf += u
        rows.append({"address": a, "btc": round(c, 4),
                     "unconfirmed_btc": round(u, 4), "utxos": n})
    return conf, unconf, rows


def band(ratio):
    if ratio is None:
        return "UNKNOWN"
    if ratio >= BAND_OK:
        return "OK"
    if ratio >= BAND_WATCH:
        return "WATCH"
    return "ALERT"


def prev_supply(wid):
    """Last supply snapshot for this wrapper, for step-change detection."""
    p = os.path.join(CAP, "history.jsonl")
    if not os.path.exists(p):
        return None
    last = None
    with open(p) as f:
        for line in f:
            try:
                d = json.loads(line)
            except Exception:       # noqa: BLE001
                continue
            if d.get("id") == wid and d.get("supply_tokens"):
                last = d["supply_tokens"]
    return last


def monitor(w):
    supply_only = w.get("kind") == "supply_only"
    decimals = w.get("token", {}).get("decimals", 8)
    if w.get("supply_kind") == "liquid_peg":
        supply, extra = liquid_supply(w["asset_id"], decimals)
        used, errors = {"blockstream-liquid-esplora": supply}, {}
    else:
        supply, used, errors = supply_consensus(w["supply_rpcs"], w["token"]["address"], decimals)
        extra = None
    if supply_only:
        conf = unconf = 0.0
        rows = []
    else:
        conf, unconf, rows = custody_total(w["bitcoin_custody"])
    measured_reserves = conf + unconf
    ratio = (measured_reserves / supply) if (supply and not supply_only) else None

    gap = sum(w.get("unmeasured_chains", {}).values())
    # ratio if the unmeasured chains exist (worst case for solvency)
    ratio_lower = (measured_reserves / (supply + gap)) if (supply and not supply_only) else None

    step_pct = None
    ps = prev_supply(w["id"])
    if ps:
        step_pct = round(100 * (supply - ps) / ps, 6)

    # A solvency verdict is only meaningful if we can see the whole reserve.
    # Measure our coverage against the issuer's claimed total first.
    published = w.get("published_reserves_btc")
    coverage = (measured_reserves / published) if published else None
    flags = []
    if supply_only:
        # Claim side only. No reserve leg => no ratio, no solvency verdict. The
        # value here is the supply series itself: an unbacked mint shows up as a
        # step change even when nothing on Bitcoin moves.
        status = "SUPPLY_ONLY"
        flags.append("NO_RESERVE_LEG")
    elif coverage is not None and coverage < 0.99:
        status = "INCOMPLETE_CUSTODY_LIST"
        flags.append("CUSTODY_COVERAGE_%.1f%%" % (100 * coverage))
        flags.append("NO_SOLVENCY_VERDICT")
    else:
        status = band(ratio_lower)
        if status == "ALERT":
            flags.append("UNDERCOLLATERALISED")
    if step_pct is not None and abs(step_pct) >= SUPPLY_STEP_ALERT_PCT:
        flags.append("SUPPLY_STEP_%s_%.2f%%" % ("UP" if step_pct > 0 else "DOWN", abs(step_pct)))
    bad = [r["address"] for r in rows if r.get("error")]
    if bad:
        flags.append("ADDRESSES_UNUSABLE_%d" % len(bad))

    return {
        "id": w["id"], "name": w["name"], "layer": "observed",
        "kind": w.get("kind", "reserve_backed"),
        "token": w.get("token"),
        "supply_tokens": round(supply, 8) if supply else None,
        "supply_breakdown": extra,
        "supply_sources_agreeing": len(used),
        "supply_sources_errors": errors,
        "supply_snapshot_prev": ps,
        "supply_change_pct": step_pct,
        "reserves_btc_confirmed": round(conf, 4),
        "reserves_btc_unconfirmed": round(unconf, 4),
        "reserves_btc_measured": round(measured_reserves, 4),
        "custody_addresses": rows,
        "unmeasured_chains_btc": w.get("unmeasured_chains", {}),
        "unmeasured_total_btc": round(gap, 4),
        "published_reserves_btc": published,
        "custody_coverage": round(coverage, 4) if coverage is not None else None,
        "backing_ratio": round(ratio, 6) if ratio else None,
        "backing_ratio_lower_bound": round(ratio_lower, 6) if ratio_lower else None,
        "status": status,
        "flags": flags,
        "custody_source": w["custody_source"],
        "note": ("backing_ratio_lower_bound counts the unmeasured chains' published "
                 "supply as real, so it is the conservative (solvency-safe) view. "
                 "custody_coverage = measured reserves / the issuer's claimed total; "
                 "below 1.0 the address list is incomplete and NO solvency verdict is "
                 "issued, because a partial reserve fakes exactly the shortfall this "
                 "tool exists to detect."),
    }


def replay(r):
    """Run the detector against reported incident figures (not measurements)."""
    rb = r["reserves_before_btc"] / r["supply_before_tokens"]
    ra = r["reserves_after_btc"] / r["supply_after_tokens"]
    return {
        "id": r["id"], "name": r["name"], "layer": "replay",
        "mechanism": r["mechanism"],
        "supply_before_tokens": r["supply_before_tokens"],
        "supply_after_tokens": r["supply_after_tokens"],
        "reserves_before_btc": r["reserves_before_btc"],
        "reserves_after_btc": r["reserves_after_btc"],
        "ratio_before": rb, "ratio_after": ra,
        "status_before": band(rb), "status_after": band(ra),
        "detected": band(ra) == "ALERT",
        "supply_step_pct": round(100 * (r["supply_after_tokens"] - r["supply_before_tokens"])
                                 / r["supply_before_tokens"], 4),
        "reported": r["reported"], "source": r["source"],
    }


ALERT_OUT = os.path.join(ROOT, "data", "bridge_alerts.json")
ALERT_LOG = os.path.join(CAP, "alerts.jsonl")


def send_webhooks():
    """Push through the SHARED alert channel.

    webhook_sender.py merges data/bridge_alerts.json with ops-health's
    tools/alerts.json, so this is the wiring that makes a bridge alert reach the
    webhook instead of dying in a file nobody reads. Best-effort: a webhook
    failure must never fail the collection.
    """
    try:
        subprocess.run(["python3", os.path.join(ROOT, "tools", "webhook_sender.py")],
                       capture_output=True, timeout=45)
    except Exception as e:      # noqa: BLE001
        print("  (webhook send skipped: %s)" % type(e).__name__)


def build_alerts(live):
    """Only fire where a claim is actually supportable.

    INCOMPLETE_CUSTODY_LIST and SUPPLY_ONLY deliberately produce no alert: a
    partial reserve fakes a shortfall, and a supply-only view has no reserve to
    compare against. Alerting on either would be crying wolf, which is how a
    monitor gets ignored on the day it is right.
    """
    out = []
    for m in live:
        if m["status"] == "ALERT":
            out.append("%s UNDERCOLLATERALISED: backing ratio %s"
                       % (m["id"], m["backing_ratio_lower_bound"]))
        for f in m["flags"]:
            if f.startswith("SUPPLY_STEP_"):
                out.append("%s %s (supply %s -> %s)"
                           % (m["id"], f, m["supply_snapshot_prev"], m["supply_tokens"]))
            if f.startswith("ADDRESSES_UNUSABLE_"):
                out.append("%s custody list has %s unusable address(es)"
                           % (m["id"], f.rsplit("_", 1)[1]))
    return out


def main():
    live = [monitor(w) for w in WRAPPERS]
    rep = [replay(r) for r in REPLAYS]

    for m in live:
        print("%-26s supply %s  reserves %.4f BTC  ratio %s  [%s] %s"
              % (m["id"], m["supply_tokens"], m["reserves_btc_measured"],
                 m["backing_ratio_lower_bound"], m["status"], ",".join(m["flags"])))
    for r in rep:
        print("%-26s %-14s ratio %.6g -> %.6g  %s  detected=%s"
              % (r["id"], r["mechanism"], r["ratio_before"], r["ratio_after"],
                 r["status_after"], r["detected"]))

    alerts = build_alerts(live)
    for a in alerts:
        print("  !! %s" % a)

    doc = {
        "schema": "bsahi.bridge-reserves/1",
        "layer": "observed",
        "generated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "source": ("Bitcoin custody balances measured via Esplora; token supply via "
                   "eth_call totalSupply() across independent public RPCs. Custodian "
                   "address lists are the issuers' published disclosures."),
        "method": ("backing_ratio = measured BTC reserves / token supply. Both exploit "
                   "families drive the ratio below 1: a custody drain lowers the "
                   "numerator, an unbacked mint raises the denominator."),
        "scope": ("Solvency/backing monitor. It observes the CONSEQUENCE of an unbacked "
                  "mint (supply detaching from reserves), not the contract bug. It "
                  "cannot see the mint itself, which happens on another chain."),
        "bands": {"ok": BAND_OK, "watch": BAND_WATCH,
                  "supply_step_alert_pct": SUPPLY_STEP_ALERT_PCT},
        "wrappers": live,
        "replays": rep,
        "alerts": alerts,
        "alert_policy": ("ALERT on: backing ratio below %s once custody coverage is "
                         "complete; a supply step of >= %.1f%% between snapshots; or an "
                         "undercollateralised flag. INCOMPLETE_CUSTODY_LIST and "
                         "SUPPLY_ONLY are reported but never alerted, because neither "
                         "can support a solvency claim."
                         % (BAND_WATCH, SUPPLY_STEP_ALERT_PCT)),
    }
    os.makedirs(CAP, exist_ok=True)
    with open(os.path.join(CAP, "history.jsonl"), "a") as f:
        for m in live:
            if m["supply_tokens"]:
                f.write(json.dumps({"at": doc["generated_at"], "id": m["id"],
                                    "supply_tokens": m["supply_tokens"],
                                    "reserves_btc": m["reserves_btc_measured"],
                                    "ratio": m["backing_ratio_lower_bound"]}) + "\n")
    with open(OUT, "w") as f:
        json.dump(doc, f, indent=2)

    with open(ALERT_OUT, "w") as f:
        json.dump({"alerts": alerts, "at": doc["generated_at"],
                   "source": "bridge-reserves"}, f, indent=2)
    if alerts:
        with open(ALERT_LOG, "a") as f:
            for a in alerts:
                f.write(json.dumps({"at": doc["generated_at"], "alert": a}) + "\n")
        send_webhooks()
    print("  -> %s  (%d alert(s))" % (OUT, len(alerts)))


if __name__ == "__main__":
    main()
