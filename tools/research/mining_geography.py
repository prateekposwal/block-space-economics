#!/usr/bin/env python3
"""Mining geography — where hashrate lives (population-geography Phase 3).

Source of truth: Cambridge CBECI Mining Map (ccaf.io/cbnsi/cbeci/mining_map).
It is a WASM SPA backed by Firebase; there is no stable public JSON endpoint, so
this tool does NOT scrape it. Instead it imports the CSV the map's own "Download"
button produces, from captured-data/cbeci/*.csv (long OR wide format), and emits
a normalised country/region hashrate-share table.

To refresh the source: open https://ccaf.io/cbnsi/cbeci/mining_map , click
Download, and drop the file in captured-data/cbeci/.

Honest boundaries (from the CBECI methodology):
  * monthly, usually 1-3 month publication lag
  * extrapolated from a POOL SAMPLE that has covered ~32-38% of network hashrate
    since the map launched (Sep 2019) — it is an ESTIMATE, not a census
  * regional (province) breakdown exists only for China and the US
  * licence: CC BY-NC-SA 4.0 — attribution + link required
Writes data/mining_geography.json (status SOURCE_UNAVAILABLE if no CSV present).
"""
import csv
import datetime
import glob
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, "data", "mining_geography.json")
SRC_DIR = os.path.join(ROOT, "captured-data", "cbeci")
DOWNLOAD_URL = "https://ccaf.io/cbnsi/cbeci/mining_map"

COUNTRY_KEYS = ("country", "countries", "country_name", "jurisdiction")
DATE_KEYS = ("date", "period", "month", "timestamp", "year_month", "yyyymm")
SHARE_KEYS = ("share", "hashrate", "hash_rate", "percentage", "percent", "value", "hashrate_share")


def _col(headers, keys):
    for i, h in enumerate(headers):
        hl = (h or "").strip().lower().replace(" ", "_")
        if hl in keys or any(k in hl for k in keys):
            return i
    return None


def _num(v):
    try:
        return float(str(v).replace("%", "").replace(",", "").strip())
    except Exception:
        return None


def _looks_like_date(h):
    h = (h or "").strip()
    return len(h) >= 7 and h[:4].isdigit() and ("-" in h or "/" in h)


def parse_csv(path):
    """Tolerant parse of CBECI long (country,date,share) or wide (country,<YYYY-MM>...) CSV."""
    with open(path, newline="", encoding="utf-8-sig", errors="replace") as f:
        rows = list(csv.reader(f))
    rows = [r for r in rows if any((c or "").strip() for c in r)]
    if len(rows) < 2:
        return None
    header = rows[0]
    ci = _col(header, COUNTRY_KEYS)
    di = _col(header, DATE_KEYS)
    si = _col(header, SHARE_KEYS)
    if ci is None:
        return None

    # long format
    if si is not None:
        latest_date, out = None, {}
        for r in rows[1:]:
            if ci >= len(r) or si >= len(r):
                continue
            country = (r[ci] or "").strip()
            val = _num(r[si])
            if not country or val is None:
                continue
            d = (r[di] or "").strip() if (di is not None and di < len(r)) else ""
            if d:
                if latest_date is None or d > latest_date:
                    latest_date, out = d, {country: val}
                elif d == latest_date:
                    out[country] = val
            else:
                out[country] = val
        return {"format": "long", "period": latest_date, "shares": out}

    # wide format: pick the latest date-like column
    date_cols = [(i, h) for i, h in enumerate(header) if _looks_like_date(h)]
    if not date_cols:
        return None
    li, lh = sorted(date_cols, key=lambda t: t[1])[-1]
    out = {}
    for r in rows[1:]:
        if ci >= len(r) or li >= len(r):
            continue
        country = (r[ci] or "").strip()
        val = _num(r[li])
        if country and val is not None:
            out[country] = val
    return {"format": "wide", "period": lh, "shares": out}


def main():
    os.makedirs(SRC_DIR, exist_ok=True)
    files = sorted(glob.glob(os.path.join(SRC_DIR, "*.csv")))
    parsed, used = None, None
    for p in files:
        try:
            r = parse_csv(p)
        except Exception:
            r = None
        if r and r.get("shares"):
            parsed, used = r, p
            break

    if not parsed:
        doc = {
            "schema": "bsahi.mining-geography/1",
            "layer": "modelled",
            "generated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "source": "Cambridge CBECI Mining Map (manual CSV import)",
            "status": "SOURCE_UNAVAILABLE",
            "download_url": DOWNLOAD_URL,
            "note": ("No CSV found in captured-data/cbeci/. The CBECI mining map is a "
                     "Firebase-backed SPA with no stable public JSON endpoint, so the "
                     "data is imported from the map's own Download button. Monthly, "
                     "~32-38% pool sample, 1-3 month lag. CC BY-NC-SA 4.0."),
        }
    else:
        shares = parsed["shares"]
        tot = sum(v for v in shares.values() if v > 0) or 1.0
        table = sorted(([c, round(v, 3), round(100.0 * v / tot, 2)] for c, v in shares.items()),
                       key=lambda x: -x[1])
        doc = {
            "schema": "bsahi.mining-geography/1",
            "layer": "modelled",
            "generated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "source": "Cambridge CBECI Mining Map (manual CSV import): " + os.path.basename(used),
            "status": "OK",
            "period": parsed.get("period"),
            "format": parsed.get("format"),
            "country_share": [{"country": c, "share": s, "share_pct": p} for c, s, p in table],
            "note": ("ESTIMATE, not a census: CBECI extrapolates from a pool sample that "
                     "has covered ~32-38% of network hashrate since 2019; monthly with a "
                     "1-3 month lag; regional detail only for China and the US. "
                     "CC BY-NC-SA 4.0 — attribute Cambridge CCAF and link ccaf.io/cbnsi/cbeci."),
        }
    with open(OUT, "w") as f:
        json.dump(doc, f, indent=2)
    if doc["status"] == "OK":
        print("mining-geography: %s period=%s countries=%d -> %s"
              % (doc["status"], doc["period"], len(doc["country_share"]), OUT))
    else:
        print("mining-geography: SOURCE_UNAVAILABLE (drop a CBECI CSV in captured-data/cbeci/) -> %s" % OUT)


if __name__ == "__main__":
    main()
