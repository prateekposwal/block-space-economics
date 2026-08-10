# BSAHI Beta Program — Full Plan & Record

**Status:** LIVE (2026-08-11) · **Source of truth:** `data/beta-users.json` (managed
by `tools/agents/27-beta-manager.js`)
**Pages:** beta.html (register) · beta-login.html (access) · products/send-widget.html · products/sccr-index.html

---

## 1. What the beta is

**First 100 users** get free access to the Send Widget and the SCCR Index for
**six months**. No card required. After the 100th, new registrations go to a
waitlist (still recorded). Terms can be changed later (the architect's note) —
the system is built so expiry/plan/cap are all parameters, not hardcoded.

## 2. The architecture (connected + recorded)

```
beta.html (register form)
    │  POST /beta/register
    ▼
de-server (port 3456) ──► tools/agents/27-beta-manager.js
    │                        │
    │   register(email,name,product,source)
    │   • dedupe by email
    │   • cap 100 (BETA_CAP), plan 'beta-free-6mo', expiry +6 months (FREE_MONTHS)
    │   • issues an access key
    ▼
data/beta-users.json  ──►  data/beta-status.json  (count/cap/open, served to the site)
    │
    └── every registration is RECORDED: who, when, product, source, plan, spot,
        expiry, key — the full audit trail in one file

beta-login.html
    │  GET /beta/verify?key=...
    ▼
de-server ──► beta-manager.verifyKey() ──► unlocks Send Widget + SCCR Index
```

**Every piece is connected:**
- **Register** (beta.html) → POST to de-server → recorded in beta-users.json
- **Status** (count/cap/open) → served as beta-status.json → shown on product pages
- **Login** (beta-login.html) → verify key → unlock access
- **Product pages** → live data (widget + index) + beta-status

## 3. The data model (data/beta-users.json)

```json
{
  "schema": "bsahi.beta-users/1",
  "registered_at": "...",
  "users": [
    {
      "email": "you@company.com",
      "name": "...",
      "product": "send-widget | sccr-index | both",
      "source": "beta.html | ...",
      "registered_at": "ISO",
      "plan": "beta-free-6mo | waitlist",
      "spot": 1..100,
      "expiry": "ISO (+6 months)",
      "key": "access key",
      "active": true
    }
  ]
}
```

## 4. Parameters (all changeable)

| Parameter | Value | Where |
|---|---|---|
| Beta cap | 100 | `beta-manager.js` `BETA_CAP` |
| Free months | 6 | `beta-manager.js` `FREE_MONTHS` |
| Plan name | beta-free-6mo | registration |
| Port | 3456 | server.js |
| Users file | data/beta-users.json | beta-manager |
| Status file | data/beta-status.json | beta-manager |

To change "six months" → "twelve": edit `FREE_MONTHS` and re-issue. To extend a
specific user: edit their `expiry` in beta-users.json. All recorded.

## 5. Operations

```bash
# Register a user (CLI, if the site's form is down)
node tools/agents/27-beta-manager.js --register "user@x.com" "Name" "both" "manual"

# Verify a key
node tools/agents/27-beta-manager.js --verify "<key>"

# View status (count/cap/open)
node tools/agents/27-beta-manager.js --status

# View all registrations (the audit trail)
node tools/agents/27-beta-manager.js --list
```

## 6. Honest limits (static-site reality)

- **GitHub Pages is static** — the `/beta/register` and `/beta/verify` endpoints
  live on the **local de-server (port 3456)**, not the public site. When the
  public form POSTs and the server is reachable, registration is fully
  automatic. When it's not (e.g., a visitor from the public internet), the form
  **falls back to a mailto** so the signup is still captured, and the architect
  records it via the CLI.
- The **access key** is a lightweight gate for the free beta UI — not crypto-grade
  auth. It's appropriate for a 100-user free beta, not for sensitive data.
- **For true public self-serve**: the next step is a serverless form endpoint
  (e.g., a GitHub Action on form submission, or a hosted form) so public
  registrations auto-record without the local server. Documented as a follow-up.

## 7. Follow-ups

- [x] Product pages (widget + index) with beta CTA
- [x] Registration + login pages
- [x] Beta-manager (cap, plan, expiry, key, audit trail) + server endpoints
- [x] Status served to product pages
- [ ] Serverless registration endpoint for public self-serve (no local server needed)
- [ ] Email confirmation on registration (beta@bitcoinsahi.com flow)
- [ ] /developers page with embed docs + beta access

---

*Bitcoin Sahi — beta program plan & record, 2026-08-11.*
