# BSAHI Admin Dashboard — Record & Guide

**Status:** LIVE (2026-08-11) · **URL:** `admin.html` (behind key)
**Backend:** de-server (port 3456) `/admin/dashboard` + `/admin/beta` endpoints (key-protected)
**Data sources:** beta-users.json, beta-status.json, ROI tracker, DB (captures/findings/block_stats/node_geo), DE-agent state

---

## 1. Access

- Page: `http://localhost:3456/admin` (local de-server only — NOT on the public site; loopback-bound, never deployed to GitHub Pages)
- **Requires the admin key** (`ADMIN_KEY` env on the de-server; no default — 503 if unset)
- The dashboard loads same-origin from the local de-server (`/admin/dashboard`) — it's an internal tool, not public-facing
- Auto-refreshes every 60 seconds

## 2. What it shows

### Beta
- Registered (of 100 cap) · Waitlist · Status (open/waitlist)

### Research & Data
- Captures (SQLite) · Research findings · Block stats · Node geo (countries)

### ROI
- Dev tier value ($50/mo) · Enterprise tier ($500/mo) — from TODO R4 plan
- Potential monthly revenue (converted users × dev tier)
- Estimated annual value
- Converted → paid count (manually updated)
- Hosting cost ($0 — GitHub Pages)

### Beta Users (table)
- Spot, name, email, product, plan, expiry, status

### System Health
- DE cycle · last run · M4 gate state

## 3. ROI tracking (tools/agents/28-roi-tracker.js)

Data lives in `data/roi.json` (gitignored — architect-owned). Tracked:
- **Costs**: hosting ($0), bandwidth ($0), tools, labor hours — set via `--set-cost`
- **Revenue-ready**: widget tier, enterprise tier, index license, annual report — editable in the JSON
- **Beta conversion**: registered, waitlist, converted-to-paid — `--set-conversion`

```bash
node tools/agents/28-roi-tracker.js                          # view ROI
node tools/agents/28-roi-tracker.js --set-cost tools 25      # record a cost
node tools/agents/28-roi-tracker.js --set-conversion 3       # mark 3 users converted to paid
```

## 4. The honest ROI reality

Today: $0 revenue, $0 hosting cost (free infra), 0 beta users. The ROI model shows
**potential** ($50/mo per converted dev-tier user, $500/mo enterprise) — it becomes
real as (a) beta users convert, (b) the index licenses. The dashboard tracks the
*potential → realized* gap honestly: potential_revenue and converted_to_paid are
separate numbers.

## 5. Security

- Admin key is the de-server's `ADMIN_KEY` env (no default — the key is required, not optional)
- Change it: set `ADMIN_KEY` in the launchd plist environment, restart de-server
- The dashboard is local-only (the public page shows login but the data fetch
  requires the local server)

---

*Bitcoin Sahi — admin dashboard record & guide, 2026-08-11.*
