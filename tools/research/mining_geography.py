#!/usr/bin/env python3
"""Mining geography — where hashrate lives (population-geography Phase 3).

Automatic source ladder (first that succeeds wins):

  1. CBECI mining-map CSV in captured-data/cbeci/*.csv  (PREFERRED)
     Cambridge CCAF, monthly, the reference dataset. NOTE: the CBECI site is a
     Firebase SPA whose API (api.ccaf.io / ccaf.io/cbeci/api) is reCAPTCHA-gated,
     so we do NOT scrape it — this reads the file the map's own Download button
     produces, if the operator drops one in.

  2. Hashrate Index (Luxor) Global Hashrate Heatmap  (AUTOMATIC)
     Public quarterly blog post, no auth: country market share + EH/s. This is
     what makes the dataset self-updating when no CBECI CSV is present.

  3. otherwise status SOURCE_UNAVAILABLE.

BOTH are ESTIMATES, never censuses:
  * CBECI: pool sample covering ~32-38% of network hashrate; monthly; 1-3 mo lag.
  * Hashrate Index: quarterly, own (Luxor) methodology; publishes the top ~10.
Attribution is required for either. Writes data/mining_geography.json.
"""
import csv
import datetime
import glob
import json
import os
import re
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, "data", "mining_geography.json")
SRC_DIR = os.path.join(ROOT, "captured-data", "cbeci")
HI_CACHE = os.path.join(ROOT, "captured-data", "hashrateindex")
CBECI_URL = "https://ccaf.io/cbnsi/cbeci/mining_map"
HI_URL = "https://hashrateindex.com/blog/global-hashrate-heatmap-update-q%d-%d/"
UA = {"User-Agent": "bitcoinsahi-research/1.0 (+https://bitcoinsahi.com)"}

COUNTRY_KEYS = ("country", "countries", "country_name", "jurisdiction")
DATE_KEYS = ("date", "period", "month", "timestamp", "year_month", "yyyymm")
SHARE_KEYS = ("share", "hashrate", "hash_rate", "percentage", "percent", "value", "hashrate_share")


# ---------------------------------------------------------------- CBECI CSV
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
    ci, di, si = _col(header, COUNTRY_KEYS), _col(header, DATE_KEYS), _col(header, SHARE_KEYS)
    if ci is None:
        return None
    if si is not None:
        latest, out = None, {}
        for r in rows[1:]:
            if ci >= len(r) or si >= len(r):
                continue
            country, val = (r[ci] or "").strip(), _num(r[si])
            if not country or val is None:
                continue
            d = (r[di] or "").strip() if (di is not None and di < len(r)) else ""
            if d:
                if latest is None or d > latest:
                    latest, out = d, {country: val}
                elif d == latest:
                    out[country] = val
            else:
                out[country] = val
        return {"source_kind": "cbeci_csv", "period": latest, "shares": out}
    date_cols = [(i, h) for i, h in enumerate(header) if _looks_like_date(h)]
    if not date_cols:
        return None
    li, lh = sorted(date_cols, key=lambda t: t[1])[-1]
    out = {}
    for r in rows[1:]:
        if ci >= len(r) or li >= len(r):
            continue
        country, val = (r[ci] or "").strip(), _num(r[li])
        if country and val is not None:
            out[country] = val
    return {"source_kind": "cbeci_csv", "period": lh, "shares": out}


# ---------------------------------------------------- Hashrate Index (open HTML)
def _quarters(n=6):
    now = datetime.datetime.now(datetime.timezone.utc)
    y, q = now.year, (now.month - 1) // 3 + 1
    out = []
    for _ in range(n):
        out.append((q, y))
        q -= 1
        if q == 0:
            q, y = 4, y - 1
    return out


def parse_hi(html):
    """Pull the 'Top N Countries by Market Share (Qx YYYY)' list out of the post."""
    m = re.search(r"Top\s+\d+\s+Countries\s+by\s+Market\s+Share\s*\(([^)]+)\)", html)
    period = m.group(1).strip() if m else None
    txt = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", html))
    seg = txt[txt.find(m.group(0)):txt.find(m.group(0)) + 2000] if m else txt
    rows = re.findall(
        r"([A-Z][A-Za-z\.'&\- ]{2,40}?)\s*[\u2014\u2013-]\s*([0-9]{1,2}(?:\.[0-9]+)?)%\s*"
        r"\(~?\s*([0-9][0-9,\.]*)\s*EH/s\)", seg)
    shares, ehs = {}, {}
    for country, pct, e in rows:
        c = country.strip()
        shares[c] = float(pct)
        ehs[c] = float(e.replace(",", ""))
    if not shares:
        return None
    return {"source_kind": "hashrateindex_html", "period": period or "latest quarter",
            "shares": shares, "hashrate_ehs": ehs}


def fetch_hi():
    os.makedirs(HI_CACHE, exist_ok=True)
    for q, y in _quarters(6):
        url = HI_URL % (q, y)
        cache = os.path.join(HI_CACHE, "q%d-%d.html" % (q, y))
        html = None
        if os.path.exists(cache) and (datetime.datetime.now().timestamp()
                                      - os.path.getmtime(cache)) / 86400 < 30:
            html = open(cache, encoding="utf-8", errors="replace").read()
        else:
            try:
                req = urllib.request.Request(url, headers=UA)
                with urllib.request.urlopen(req, timeout=45) as r:
                    if r.status != 200:
                        continue
                    html = r.read().decode("utf-8", "replace")
                open(cache, "w", encoding="utf-8").write(html)
            except Exception:
                continue
        p = parse_hi(html)
        if p:
            p["url"] = url
            return p
    return None


# ---------------------------------------------------------------------- main
def main():
    os.makedirs(SRC_DIR, exist_ok=True)
    parsed = None
    for path in sorted(glob.glob(os.path.join(SRC_DIR, "*.csv"))):
        try:
            r = parse_csv(path)
        except Exception:
            r = None
        if r and r.get("shares"):
            r["url"] = CBECI_URL
            r["file"] = os.path.basename(path)
            parsed = r
            break
    if not parsed:
        parsed = fetch_hi()

    if not parsed:
        doc = {
            "schema": "bsahi.mining-geography/1", "layer": "modelled",
            "generated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "source": "CBECI mining map (csv) / Hashrate Index heatmap (html)",
            "status": "SOURCE_UNAVAILABLE", "download_url": CBECI_URL, "alt_url": HI_URL % tuple(_quarters(1)[0]),
            "note": ("No CBECI CSV present and the Hashrate Index heatmap could not be "
                     "parsed. Both are ESTIMATES. CBECI is reCAPTCHA-gated and is not "
                     "scraped; drop its Download CSV in captured-data/cbeci/."),
        }
    else:
        shares = parsed["shares"]
        vals = [v for v in shares.values() if v > 0]
        # Values may be fractions (0.367) or already-percent (36.7). Scale only,
        # never renormalise: these are shares of GLOBAL hashrate, and the source
        # often lists only the top N, so the tail must stay un-inflated.
        scale = 100.0 if (vals and max(vals) <= 1.0) else 1.0
        ehs = parsed.get("hashrate_ehs") or {}
        kind = parsed["source_kind"]
        rows = sorted(({"country": c, "share_pct": round(v * scale, 2),
                        "hashrate_ehs": ehs.get(c)} for c, v in shares.items() if v > 0),
                      key=lambda x: -x["share_pct"])
        coverage = round(sum(r["share_pct"] for r in rows), 2)
        if kind == "cbeci_csv":
            attribution = ("Cambridge CBECI Mining Map (CC BY-NC-SA 4.0) — attribute "
                           "Cambridge CCAF and link ccaf.io/cbnsi/cbeci. Monthly; "
                           "~32-38% pool sample; 1-3 month lag.")
        else:
            attribution = ("Hashrate Index (Luxor) Global Hashrate Heatmap — attribute "
                           "Hashrate Index and link hashrateindex.com. Quarterly; top "
                           "countries only; Luxor's own methodology.")
        doc = {
            "schema": "bsahi.mining-geography/1", "layer": "modelled",
            "generated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "source": ("%s: %s" % (kind, parsed.get("file") or parsed.get("url"))),
            "source_kind": kind, "source_url": parsed.get("url"),
            "status": "OK", "period": parsed.get("period"),
            "country_share": rows,
            "listed_coverage_pct": coverage,
            "coverage_note": ("share_pct is of GLOBAL hashrate as published; the "
                              "listed countries cover %s%% — the unlisted tail is NOT "
                              "redistributed." % coverage),
            "note": "ESTIMATE, not a census. " + attribution,
        }
    with open(OUT, "w") as f:
        json.dump(doc, f, indent=2)
    if doc["status"] == "OK":
        print("mining-geography: %s period=%s countries=%d source=%s -> %s"
              % (doc["status"], doc["period"], len(doc["country_share"]),
                 doc.get("source_kind"), OUT))
        print("  top: " + ", ".join("%s %s%%" % (r["country"], r["share_pct"])
                                    for r in doc["country_share"][:5]))
    else:
        print("mining-geography: SOURCE_UNAVAILABLE -> %s" % OUT)


if __name__ == "__main__":
    main()
