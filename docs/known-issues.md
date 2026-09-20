# Known Open Issues — Bitcoin Sahi (2026-08-02)

Maintained list of honest, current gaps. Items marked **[deferred]** are explicitly
out of current scope (see `docs/decisions/2026-08-02-project-decisions.md`).

## Data layer
- **[deferred] Local Bitcoin Core node is behind tip** — at block 644,223 of
  960,718 (67%) as of 2026-08-02; ~3.8GB in ~3 days. Full IBD (~600GB) will not
  complete in a useful window. `getblockstats → utxo_size_inc` (R5 sub-task) is
  dropped until the node is synced.
- **Historical backfill depth is bounded by free sources** — mempool.space exposes
  only ~24h fee-history windows. Deep history requires a paid provider or a synced
  archival node. Captures began 2026-07-30.
- **[monitored] Raw-block-tip latency is high** — the full raw block of the tip
  (~1.2–2.8MB) legitimately takes 7–18s to fetch; `maxLatency` is set to 60s so it
  counts as healthy. It occasionally trips the error-count deduction in the
  quality score (98/100 on the 08-02 report; ages out within ~12 rounds).

## Site / product
- **No freshness label on the site** — homepage says "Updated live from the
  Bitcoin network"; a visible "Last updated: X hours ago" indicator is a TODO.
- **`/api/fees`, `/api/inscriptions`, `/api/utxo-cost-model` return 404** — the
  VPS backend is [deferred]; the `api/` directory serves static docs only.
- **No newsletter signup** — [deferred] with the backend.
- **Sitemap incomplete** — `working-paper.html` and `history-of-bitcoin.html` are
  not listed in the sitemap.

## Research
- **SCCR publication to arXiv / Bitcoin Optech** — not yet submitted; working paper
  is live on the site.
- **SCCR headline reconciliation (done 2026-08-02)** — model-spec v2.1.1 is now the (superseded: this entry records the 2026-08-02 state; N was later re-based 32,000 -> 26,586)
  canonical authority (N=32K, live re-measure 0.2252); working-paper/learn.html/
  marketing-queue were updated. Any future surface must read the live value, never
  a hardcoded number.
- **v1.0.0 public posts used the 1.49% figure** — intentionally not retro-edited
  (honest provenance); correction recorded in
  `docs/decisions/2026-08-02-sccr-v2-correction.md` and a pinned correction is a
  TODO for public channels.

## Publishing
- **Publishing queue has a backlog** (~57 pending posts) — the bridge is OFF by
  M4 design; policy decision pending (publish-on-a-cadence vs stay-off).
