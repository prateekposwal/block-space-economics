/* BSAHI data-health — shared public data-freshness badge.
 * One dot for every data page: 🟢 live (≤35 min — inside the designed 30-min
 * refresh cadence + margin) / 🟡 delayed (35–120 min — a cycle was missed) /
 * 🔴 stale (>120 min or snapshot unreachable) / ⚪ unknown (no timestamp).
 *
 * FRESHNESS SEMANTICS (2026-08-30, gap #3): the snapshot's payload age
 * (payload_ts — oldest per-field datum) drives the dot, NOT the envelope
 * (generated_at). A fresh envelope over a frozen payload is a lie the dot
 * used to tell; a payload stamp can be absent (legacy snapshots), in which
 * case the envelope age is the signal.
 *
 * Mounts into an element with id="data-health" if present, else into the first
 * [data-health-target] element, else creates one in the page header. The target
 * may list extra per-dataset freshness checks via data-health-extra:
 *   data-health-extra="/data/sccr.json:generated_at /data/bip110.json:observedAt"
 * Each extra dataset's age is surfaced in the tooltip/title (the dot color is
 * driven by the primary snapshot.json signal). Missing/stale extras add a ⚠ note.
 *
 * PUBLIC (not beta-gated) — this is data health, not the member gate.
 * Read-only: never redirects, never calls BSAHIGate, no localStorage.
 * Degrades gracefully: fetch failure → 🔴 stale (never a silent green).
 */
(function (global) {
  'use strict';

  var SNAPSHOT_URL = '/data/snapshot.json';
  var REFRESH_MS = 120000;             // re-check every 2 min
  // Canonical thresholds — ONE source: js/data-health-config.js (loaded
  // before this file on every page). Fallbacks below are the SAME canonical
  // values so a missing config can never split the dot from the page gates.
  var CADENCE_MIN = 30;                // designed snapshot refresh cadence
  var LIVE_MIN = 35;                   // one cadence + margin → 🟢
  var STALE_MIN = 120;                 // >120 min → 🔴
  if (global.BSAHI_HEALTH_CONFIG) {
    if (global.BSAHI_HEALTH_CONFIG.CADENCE_MIN) CADENCE_MIN = global.BSAHI_HEALTH_CONFIG.CADENCE_MIN;
    if (global.BSAHI_HEALTH_CONFIG.LIVE_MIN) LIVE_MIN = global.BSAHI_HEALTH_CONFIG.LIVE_MIN;
    if (global.BSAHI_HEALTH_CONFIG.STALE_MIN) STALE_MIN = global.BSAHI_HEALTH_CONFIG.STALE_MIN;
  }

  var STATES = {
    live:    { dot: '🟢', color: '#3FB950', label: 'Live' },
    delayed: { dot: '🟡', color: '#D29922', label: 'Delayed' },
    stale:   { dot: '🔴', color: '#F85149', label: 'Stale' },
    unknown: { dot: '⚪', color: '#8B949E', label: 'Unknown' }
  };

  var el = null;          // the mounted badge element
  var extras = [];        // [{url, field}] per-dataset freshness probes
  var lastState = 'unknown';

  function ageMin(iso) {
    if (iso === null || iso === undefined || iso === '') return null;
    var t = new Date(iso).getTime();
    if (isNaN(t)) return null;
    return (Date.now() - t) / 60000;
  }

  /* stateFor(iso) → 'live' | 'delayed' | 'stale' | 'unknown' */
  function stateFor(iso) {
    var m = ageMin(iso);
    if (m === null || m === undefined) return 'unknown';
    if (m > STALE_MIN) return 'stale';
    if (m > LIVE_MIN) return 'delayed';
    return 'live';
  }

  function mount() {
    el = document.getElementById('data-health');
    if (!el) {
      var target = document.querySelector('[data-health-target]');
      if (target) {
        el = document.createElement('span');
        el.id = 'data-health';
        el.setAttribute('title', 'Data status');
        target.appendChild(el);
      } else {
        // No explicit target — place the dot in the header (nav area).
        el = document.createElement('span');
        el.id = 'data-health';
        el.setAttribute('title', 'Data status');
        var hosts = [
          document.querySelector('.header-inner .nav'),
          document.querySelector('#nav-links'),
          document.querySelector('.header-inner'),
          document.querySelector('.header'),
          document.body
        ];
        for (var i = 0; i < hosts.length; i++) {
          if (hosts[i]) { hosts[i].appendChild(el); break; }
        }
      }
    }
    el.style.fontSize = '0.85em';
    el.style.marginLeft = '8px';
    el.style.cursor = 'default';
    el.style.flexShrink = '0';
    // Nav alignment (2026-08-15): the dot mounts into flex containers
    // (.nav / .header-inner / .header) on every page. A bare text emoji rides
    // the text baseline and looks misaligned next to padded nav links. One
    // canonical rule here fixes all pages at once: center it in its flex row
    // and collapse the emoji line-height so it aligns with the nav items.
    el.style.alignSelf = 'center';
    el.style.lineHeight = '1';
    el.style.display = 'inline-flex';
    el.style.alignItems = 'center';
    el.setAttribute('data-health-state', lastState);

    // Per-dataset probes declared on the element or the page body.
    var spec = el.getAttribute('data-health-extra') ||
               document.body.getAttribute('data-health-extra') || '';
    spec.split(/\s+/).forEach(function(entry) {
      if (!entry) return;
      var parts = entry.split(':');
      if (parts.length < 1 || !parts[0]) return;
      extras.push({ url: parts[0], field: parts[1] || 'generated_at' });
    });
  }

  function fmtAge(m) {
    if (m === null || m === undefined) return 'unknown';
    if (m < 90) return Math.round(m) + ' min';
    return Math.round(m / 60) + ' h';
  }

  function render() {
    if (!el) return;
    var s = STATES[lastState] || STATES.unknown;
    el.textContent = s.dot;
    el.style.color = s.color;
    el.setAttribute('data-health-state', lastState);
  }

  /* setTitle(detail) — title = state label + snapshot age + per-dataset notes. */
  function setTitle(parts) {
    if (!el) return;
    var lines = parts.filter(Boolean);
    el.setAttribute('title', lines.join(' · '));
  }

  function probeExtra(entry, done) {
    global.fetch(entry.url).then(function(r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(function(d) {
      var iso = d && d[entry.field];
      var m = ageMin(iso);
      if (m === null || m === undefined) {
        done(entry.url + ' unknown age');
      } else if (m > STALE_MIN) {
        done('⚠ ' + entry.url + ' stale (' + fmtAge(m) + ')');
      } else {
        done(entry.url + ' ' + fmtAge(m));
      }
    }).catch(function() {
      done('⚠ ' + entry.url + ' unreachable');
    });
  }

  function refresh() {
    global.fetch(SNAPSHOT_URL).then(function(r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(function(s) {
      // Honest age source: payload_ts (oldest per-field datum) when present,
      // else the envelope (legacy snapshots without payload stamps). The dot
      // must never green-light a fresh envelope sitting on frozen data.
      var iso = (s && (s.payload_ts || s.generated_at)) || null;
      var st = stateFor(iso);
      var parts = [];
      if (st === 'unknown') {
        setState('unknown');
        parts.push('Snapshot: unknown age (no timestamp)');
      } else {
        setState(st);
        var label = (s && s.payload_ts) ? 'payload' : 'snapshot';
        parts.push(label + ': ' + fmtAge(ageMin(iso)));
        // Name the envelope honestly: cadence + LIVE/DELAYED thresholds, so
        // the tooltip says what the dot means, not just what it is.
        parts.push('refresh cadence ' + CADENCE_MIN + ' min · live ≤' + LIVE_MIN + ' min · delayed ' + LIVE_MIN + '–' + STALE_MIN + ' min');
        // Surface envelope-vs-payload divergence when both exist: a payload
        // stamp 3 min old next to an envelope 4 h old (or vice versa) must
        // read honestly in the tooltip.
        if (s && s.payload_ts && s.generated_at) {
          var envAge = ageMin(s.generated_at);
          if (envAge !== null) parts.push('envelope ' + fmtAge(envAge));
        }
        // Per-field honesty: surface any field older than the live threshold
        // so a single frozen source cannot hide behind the aggregate age.
        if (s && s.payload_ts) {
          ['fees_ts', 'price_ts', 'height_ts', 'mempool_ts'].forEach(function(k) {
            var fm = ageMin(s[k]);
            if (fm !== null && fm > LIVE_MIN) parts.push('⚠ ' + k.replace('_ts', '') + ' ' + fmtAge(fm) + ' old');
          });
        }
      }
      if (extras.length) {
        // Re-probe per-dataset freshness in parallel (dot color stays snapshot-driven).
        var notes = [];
        var pending = extras.length;
        extras.forEach(function(entry) {
          probeExtra(entry, function(note) {
            notes.push(note);
            pending--;
            if (pending === 0) setTitle(parts.concat(notes));
          });
        });
      } else {
        setTitle(parts);
      }
    }).catch(function() {
      // A failed snapshot fetch is a real signal — never a silent green.
      setState('stale');
      setTitle(['Snapshot: unreachable (pipeline check needed)']);
    });
  }

  /* setState(state) — public API so pages (e.g. the homepage's own snapshot
   * fetch) can drive the badge; the badge also self-refreshes on an interval. */
  function setState(state) {
    lastState = STATES[state] ? state : 'unknown';
    render();
    // Notify pages that embed their own status UI (e.g. the homepage state-bar)
    // so BOTH indicators always derive from the SAME snapshot state — identical,
    // never a green dot next to a yellow verdict.
    if (global.__onDataHealth && typeof global.__onDataHealth === 'function') {
      try { global.__onDataHealth(lastState); } catch (e) {}
    }
  }

  function init() {
    if (!el) mount();
    refresh();
    setInterval(refresh, REFRESH_MS);
  }

  global.BSAHIDataHealth = {
    setState: setState,
    getState: function() { return lastState; },
    refresh: refresh,
    stateFor: stateFor,
    ageMin: ageMin
  };

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  }
})(typeof window !== 'undefined' ? window : this);
