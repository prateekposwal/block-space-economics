/* BSAHI data-health canonical freshness constants — ONE source of truth.
 *
 * The snapshot payload refreshes every 30 min (launchd com.bsahi.snapshot,
 * 1800s → data/snapshot.json). Every freshness consumer — js/data-health.js
 * and the inline page gates (index.html, live.html) — reads these from
 * window.BSAHI_HEALTH_CONFIG. Their local fallback defaults are the SAME
 * canonical numbers below, so no load-order or missing-config edge can split
 * the dot from the page gates.
 *
 * Cadence semantics (2026-08-30 recalibration): a payload inside the designed
 * refresh cadence is LIVE — the dot must not flash 🟡 delayed just because the
 * next refresh hasn't landed yet. 🟡 DELAYED only when a cycle was actually
 * missed (payload age > LIVE_MIN = one cadence + 5 min margin). 🔴 STALE
 * (>120 min) unchanged: the pipeline has been silent for many cycles.
 */
(function (global) {
  'use strict';
  global.BSAHI_HEALTH_CONFIG = {
    CADENCE_MIN: 30,   // designed snapshot refresh cadence (launchd, 1800s)
    LIVE_MIN: 35,      // one cadence + margin → payload within cadence = 🟢 live
    STALE_MIN: 120     // >120 min → 🔴 stale (unchanged)
  };
})(typeof window !== 'undefined' ? window : this);
