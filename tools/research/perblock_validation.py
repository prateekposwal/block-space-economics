#!/usr/bin/env python3
"""Per-block validation strip (rows 1, 4). Bounded per-block sampling across eras
2010-2026, validating the daily-aggregate reconstruction legs against direct
per-block measurements.

Leg A (row 4, weight/size): esplora block summaries — weight, size, tx_count,
difficulty at sampled heights per era.
Leg B (row 1, fees): blockchain.info rawblock top-level `fee` (satoshis) at the
mid-era sample, vs the SCCR reconstruction era fee_btc_per_block.

Caches rawblock JSON per hash under captured-data/blockchain.info/rawblock/ so the
fee leg is deterministic/offline after first fetch. Esplora probes are cheap and
also cached under captured-data/esplora/.
"""
import json, os, time, statistics, datetime, urllib.request, socket, ssl

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
RAW_DIR = os.path.join(ROOT, "captured-data", "blockchain.info", "rawblock")
ESP_DIR = os.path.join(ROOT, "captured-data", "esplora")

os.makedirs(RAW_DIR, exist_ok=True)
os.makedirs(ESP_DIR, exist_ok=True)

UA = "bsahi-research/0.2"
UTC = datetime.timezone.utc


class RateLimited(Exception):
    """esplora returned 429. Skip this target; do not grind-retry — hammering
    makes every run overrun its budget and never checkpoint."""
    pass


# Wall-clock budget for one run. The collector kills the process at its own
# timeoutS; exiting cleanly just before that means the per-era checkpoint is
# always written and the next run resumes. Override with --budget N.
RUN_BUDGET_S = 540.0

def esplora(path):
    """GET via esplora API, cached by path.

    Rate limits are handled explicitly: the HTTP status line is parsed (it used
    to be discarded, so a 429 looked like a generic parse error and the retry
    loop hammered with 3-30s sleeps — every run overran its budget and never
    checkpointed). A 429 now raises RateLimited immediately; the caller skips
    that target and moves on, so a run always terminates with progress saved.
    """
    key = path.replace("/", "_").replace(":", "_")
    fp = os.path.join(ESP_DIR, key + ".json")
    if os.path.exists(fp):
        with open(fp) as f:
            v = json.load(f)
        if isinstance(v, str) and not (len(v) == 64 and all(c in "0123456789abcdef" for c in v)):
            os.remove(fp)  # corrupt cache (empty/truncated)
        else:
            return v
    last = None
    for attempt in range(4):
        try:
            s = socket.create_connection(("blockstream.info", 443), timeout=25)
            ctx = ssl.create_default_context()
            s.settimeout(20)
            s = ctx.wrap_socket(s, server_hostname="blockstream.info")
            s.sendall(f"GET {path} HTTP/1.1\r\nHost: blockstream.info\r\nUser-Agent: {UA}\r\nConnection: close\r\n\r\n".encode())
            buf = b""
            while True:
                try:
                    d = s.recv(65536)
                except socket.timeout:
                    break
                if not d:
                    break
                buf += d
            s.close()
            head, _, body = buf.partition(b"\r\n\r\n")
            try:
                status = int(head.split(b" ", 2)[1])
            except Exception:
                status = 0
            if status == 429:
                raise RateLimited(path)
            if status >= 400:
                raise RuntimeError(f"HTTP {status} for {path}")
            if not body:
                raise RuntimeError(f"empty body for {path}")
            if body.startswith(b"{"):
                d = json.loads(body)
            else:
                d = body.decode().strip()
                is_hash = len(d) == 64 and all(c in "0123456789abcdef" for c in d)
                if not (is_hash or d.isdigit()):
                    raise RuntimeError(f"unexpected body for {path}: {d[:80]}")
            with open(fp, "w") as f:
                json.dump(d, f)
            return d
        except RateLimited:
            raise
        except Exception as e:
            last = e
            if "block-height" in str(e) and "error" in str(e):
                time.sleep(20)
            else:
                time.sleep(min(3 * (attempt + 1), 10))
    raise last

def rawblock_raw(hash_hex):
    """GET rawblock, decode chunked, cache bytes."""
    fp = os.path.join(RAW_DIR, hash_hex + ".json")
    if os.path.exists(fp):
        with open(fp) as f:
            return json.load(f)
    s = socket.create_connection(("blockchain.info", 443), timeout=30)
    ctx = ssl.create_default_context()
    s.settimeout(30)
    s = ctx.wrap_socket(s, server_hostname="blockchain.info")
    s.sendall(f"GET /rawblock/{hash_hex} HTTP/1.1\r\nHost: blockchain.info\r\nUser-Agent: {UA}\r\nConnection: close\r\n\r\n".encode())
    buf = b""
    while True:
        try:
            d = s.recv(65536)
        except socket.timeout:
            break
        if not d:
            break
        buf += d
    s.close()
    header, _, body = buf.partition(b"\r\n\r\n")
    assert b"200" in header.split(b"\r\n")[0], header[:60]
    chunks = b""
    rest = body
    if b"\r\n" in rest[:8] and not rest.startswith(b"{"):
        while rest:
            size_b, _, rest = rest.partition(b"\r\n")
            if not size_b:
                break
            n = int(size_b, 16)
            if n == 0:
                break
            chunks += rest[:n]
            rest = rest[n + 2:]
    else:
        chunks = rest
    d = json.loads(chunks)
    with open(fp, "w") as f:
        json.dump(d, f)
    return d

def block_at_height(h):
    h = int(h)
    if h in _hcache:
        return _hcache[h]
    hashed = esplora(f"/api/block-height/{h}")
    if not (isinstance(hashed, str) and len(hashed) == 64):
        raise RuntimeError(f"block-height/{h} bad hash: {hashed!r}")
    b = esplora(f"/api/block/{hashed}")
    if not isinstance(b, dict) or "height" not in b:
        raise RuntimeError(f"block/{hashed} not a block summary: {str(b)[:80]}")
    rec = {"height": b["height"], "timestamp": b["timestamp"], "hash": b["id"],
           "weight": b["weight"], "size": b["size"], "tx_count": b["tx_count"]}
    _hcache[h] = rec
    return rec

_hcache = {}
_cache_written = False
_tip = None

def tip_height():
    """Live chain tip height, queried once per process."""
    global _tip
    if _tip is None:
        _tip = int(esplora("/api/blocks/tip/height"))
    return _tip

def find_block_le(ts_target):
    """Binary search for the block with greatest height whose timestamp <= ts_target.
    Bounded by the live tip so heights above the chain are never probed; a
    'Block not found' response (tip race) is treated as above-tip rather than
    fatal. Probe heights get cached, so repeat runs are cheap."""
    lo, hi = 0, tip_height()
    best = None
    while lo <= hi:
        mid = (lo + hi) // 2
        try:
            b = block_at_height(mid)
        except RuntimeError as e:
            if "Block not found" in str(e):
                hi = mid - 1
                continue
            raise
        if b["timestamp"] <= ts_target:
            best = b
            lo = mid + 1
        else:
            hi = mid - 1
    return best

N_SAMPLES = 12   # default targets per era (was 3) — increase for a real distribution

def era_samples(year, n_targets=N_SAMPLES, deadline=None):
    """Heights/times spread evenly across the era. n_targets controls sample size;
    the 2026 era is truncated to the part of the year that has actually elapsed."""
    n = max(1, int(n_targets))
    last_day = 250 if year == 2026 else 350     # 2026 ~65% elapsed at capture time
    if n == 1:
        days = [1]
    else:
        days = sorted({1 + round((last_day - 1) * i / (n - 1)) for i in range(n)})
    samples = []
    for d in days:
        if deadline is not None and time.monotonic() > deadline:
            print(f"  [budget] {year}: stopping era early at {len(samples)} samples", flush=True)
            break
        t = datetime.datetime(year, 1, 1, tzinfo=UTC) + datetime.timedelta(days=d - 1)
        try:
            b = find_block_le(int(t.timestamp()))
        except RateLimited:
            # Skip immediately — no sleep. Grinding on a 429 is what made runs
            # exceed their budget; the persistent probe cache means a later run
            # (or a later pass) will fill the gaps.
            print(f"  [rate-limited] {year} day {d}: skipping", flush=True)
            continue
        except Exception as e:
            print(f"  [skip] {year} day {d}: {str(e)[:60]}", flush=True)
            time.sleep(5)
            continue
        samples.append(b)
        time.sleep(0.1)
    return samples

def main():
    import sys
    from_year = 2010
    if "--from" in sys.argv:
        from_year = int(sys.argv[sys.argv.index("--from") + 1])
    n_samples = N_SAMPLES
    if "--samples" in sys.argv:
        n_samples = int(sys.argv[sys.argv.index("--samples") + 1])
    budget = RUN_BUDGET_S
    if "--budget" in sys.argv:
        budget = float(sys.argv[sys.argv.index("--budget") + 1])
    deadline = time.monotonic() + budget
    resample = "--resample" in sys.argv
    eras_sccr = {}
    with open(os.path.join(ROOT, "data", "sccr_historical_series.json")) as f:
        for e in json.load(f)["eras"]:
            eras_sccr[e["era"]] = e

    out_path = os.path.join(ROOT, "data", "perblock_validation.json")
    out = {"schema": "bsahi.perblock-validation/1",
           "generated_at": datetime.datetime.now(UTC).isoformat(),
           "method": "esplora block summary per sampled height (weight/size/tx_count/difficulty); blockchain.info rawblock top-level fee (sat) at mid-era sample",
           "era_rows": [], "_rows": []}
    if os.path.exists(out_path):
        try:
            with open(out_path) as f:
                prev = json.load(f)
            # Carry forward accumulated rows, but keep the fresh dict so the
            # checkpoint never drops schema/generated_at/method (re-stamped below).
            out["_rows"] = prev.get("_rows", [])
        except Exception:
            pass
    out["generated_at"] = datetime.datetime.now(UTC).isoformat()
    out.setdefault("_rows", [])
    rows = out["_rows"]
    # An era is DONE only if it reached the sample target. A partial era
    # (rate-limited) stays open and is retried — combined with the persistent
    # probe cache, partial eras converge instead of freezing with too few samples.
    done = {r["era"] for r in rows
            if len([b for b in r.get("samples", []) if b]) >= n_samples}
    if resample and from_year <= 2010:
        rows.clear()         # mutate in place — `rows` aliases out["_rows"], so a
        done.clear()         # rebind would detach the appends from the checkpoint
    first_year = from_year
    if not resample:
        first_year = next((y for y in range(from_year, 2027) if str(y) not in done), 2027)

    for year in range(first_year, 2027):
        if time.monotonic() > deadline:
            print(f"[budget] stopping before era {year} (checkpoint saved)", flush=True)
            break
        print(f"era {year} ...", flush=True)
        samples = era_samples(year, n_samples, deadline=deadline)
        if not [b for b in samples if b]:
            print(f"  [skip] era {year}: no samples this run", flush=True)
            continue
        mid = samples[len(samples) // 2]
        try:
            rb = rawblock_raw(mid["hash"])
        except RateLimited:
            print(f"  [rate-limited] era {year}: fee leg skipped", flush=True)
            rb = {}
        fee_sat = rb.get("fee")
        rows[:] = [r for r in rows if r["era"] != str(year)]   # replace any partial row
        rows.append({
            "era": str(year),
            "samples": samples,
            "fee_sat": fee_sat,
            "fee_btc": round(fee_sat / 1e8, 6) if fee_sat is not None else None,
        })
        with open(out_path, "w") as f:  # checkpoint after each era
            json.dump(out, f, indent=2)

    out["era_rows"] = []
    for r in rows:
        s = [b for b in r["samples"] if b]
        if not s:
            continue
        w_m = statistics.mean(b["weight"] for b in s)
        s_m = statistics.mean(b["size"] for b in s)
        t_m = statistics.mean(b["tx_count"] for b in s)
        ref = eras_sccr.get(r["era"])
        ref_fee = (ref["fee_btc_per_day"] / ref["blocks_per_day_est"]) if ref else None
        ratio = (r["fee_btc"] / ref_fee) if (r["fee_btc"] is not None and ref_fee) else None
        out["era_rows"].append({
            "era": r["era"], "n_samples": len(s), "mean_weight_wu": round(w_m, 1),
            "mean_size_bytes": round(s_m, 1), "mean_tx_count": round(t_m, 1),
            "size_weight_ratio": round(s_m / w_m, 4) if w_m else None,
            "sampled_fee_btc": r["fee_btc"], "ref_fee_btc_per_block": round(ref_fee, 6) if ref_fee else None,
            "fee_ratio_sample_over_ref": round(ratio, 3) if ratio else None,
            "source": "esplora + blockchain.info rawblock fee",
        })
    with open(out_path, "w") as f:
        json.dump(out, f, indent=2)
    print(f"\n{'era':6}{'n':>3}{'wt(kWU)':>10}{'size(MB)':>10}{'tx':>7}  {'fee_btc':>9} {'ref_fee_btc':>11} {'ratio':>7}")
    for r in out["era_rows"]:
        def fmt(v, w):
            return ("-" * (w - 1)) if v is None else f"{v:>{w}.3f}"
        w = r["mean_weight_wu"] / 1000
        sz = (r["mean_size_bytes"] or 0) / 1e6
        print(f"{r['era']:6}{r['n_samples']:>3}{w:>10.0f}{sz:>10.2f}{r['mean_tx_count']:>7.0f}"
              f"  {fmt(r['sampled_fee_btc'],9)} {fmt(r['ref_fee_btc_per_block'],11)} {fmt(r['fee_ratio_sample_over_ref'],7)}")

if __name__ == "__main__":
    main()