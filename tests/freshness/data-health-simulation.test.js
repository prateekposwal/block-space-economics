#!/usr/bin/env node
/* Consumer-logic simulation for the BSAHI data-health freshness envelope.
 *
 * Drives the REAL js/data-health.js source (via a window-sandbox eval, exactly
 * as a browser would bind it) and the REAL js/data-health-config.js constants
 * across the full scenario matrix fixed on 2026-08-30:
 *
 *   fresh payload          → LIVE
 *   within-cadence 15-30m  → LIVE   (formerly false-🟡 under the old 15-min rule)
 *   missed cycle >35 min   → DELAYED (one 30-min cadence + 5-min margin)
 *   >120 min               → STALE
 *   legacy envelope only   → envelope fallback
 *   mixed frozen field     → payload_ts (oldest datum) → STALE + per-field ⚠
 *   config missing         → fallback constants are the canonical numbers
 *   config override        → consumers read the ONE source, not a copy
 *
 * Also guards the recurrence pattern: the old hardcoded 15/120 literals in the
 * inline page gates (index.html / live.html) must not reappear.
 */
var assert = require('assert');
var fs = require('fs');
var path = require('path');

var ROOT = path.resolve(__dirname, '..', '..');
var MIN = 60000;
var MIN_A = function (m) { return new Date(Date.now() - m * MIN).toISOString(); };

var cfg = require(path.join(ROOT, 'js/data-health-config.js')).BSAHI_HEALTH_CONFIG;
var dhSrc = fs.readFileSync(path.join(ROOT, 'js/data-health.js'), 'utf8');

// Browser-faithful binding: evaluate the real source with `window` = sandbox.
function loadDataHealth(sandbox) {
  new Function('window', dhSrc)(sandbox);
  return sandbox.BSAHIDataHealth;
}

var tests = [];
function test(name, fn) { tests.push({ name: name, fn: fn }); }

test('t1 canonical constants are the one source of truth', function () {
  assert.strictEqual(cfg.CADENCE_MIN, 30);
  assert.strictEqual(cfg.LIVE_MIN, 35);
  assert.strictEqual(cfg.STALE_MIN, 120);
});

// ── state matrix ───────────────────────────────────────────────────────────
var dh = loadDataHealth({ BSAHI_HEALTH_CONFIG: cfg });

test('t2 fresh payload → LIVE', function () {
  assert.strictEqual(dh.stateFor(MIN_A(5)), 'live');
});

test('t3 within-cadence 15-30 min → LIVE (was false-🟡 under 15-min rule)', function () {
  assert.strictEqual(dh.stateFor(MIN_A(20)), 'live');
  assert.strictEqual(dh.stateFor(MIN_A(30)), 'live');
});

test('t4 LIVE/DELAYED boundary — ≤35 live, >35 delayed', function () {
  assert.strictEqual(dh.stateFor(MIN_A(35)), 'live');   // exactly one cadence + margin
  assert.strictEqual(dh.stateFor(MIN_A(36)), 'delayed'); // a cycle was actually missed
});

test('t5 missed cycle → DELAYED', function () {
  assert.strictEqual(dh.stateFor(MIN_A(60)), 'delayed');
  assert.strictEqual(dh.stateFor(MIN_A(90)), 'delayed');
});

test('t6 >120 min → STALE', function () {
  assert.strictEqual(dh.stateFor(MIN_A(130)), 'stale');
  assert.strictEqual(dh.stateFor(MIN_A(1000)), 'stale');
});

test('t7 unknown / no timestamp → UNKNOWN', function () {
  assert.strictEqual(dh.stateFor(null), 'unknown');
  assert.strictEqual(dh.stateFor(''), 'unknown');
  assert.strictEqual(dh.stateFor('not-a-date'), 'unknown');
});

test('t8 legacy envelope fallback (no payload_ts) reads the envelope honestly', function () {
  assert.strictEqual(dh.stateFor(MIN_A(25)), 'live');    // fresh envelope → live
  assert.strictEqual(dh.stateFor(MIN_A(200)), 'stale');  // frozen envelope → stale
});

test('t9 mixed frozen field → payload_ts (oldest datum) drives STALE + per-field ⚠', function () {
  // A frozen per-field datum drags payload_ts to its age → the dot is STALE.
  assert.strictEqual(dh.stateFor(MIN_A(200)), 'stale');
  // Per-field ⚠ predicate (data-health.js refresh): field flagged when its
  // age > LIVE_MIN — the flag threshold must follow the recalibrated constant.
  assert.strictEqual(dh.ageMin(MIN_A(200)) > cfg.LIVE_MIN, true);   // frozen → ⚠
  assert.strictEqual(dh.ageMin(MIN_A(20)) > cfg.LIVE_MIN, false);   // fresh → no ⚠
  // All fields fresh → payload live, nothing flagged.
  assert.strictEqual(dh.stateFor(MIN_A(3)), 'live');
});

test('t10 page-gate regression guard — old hardcoded 15/120 literals are gone', function () {
  ['index.html', 'live.html'].forEach(function (f) {
    var t = fs.readFileSync(path.join(ROOT, f), 'utf8');
    assert.strictEqual(t.indexOf('ageMin > 15'), -1, f + ' still hardcodes the old 15-min delayed rule');
    assert.strictEqual(t.indexOf('ageMin > 120'), -1, f + ' still hardcodes the old 120-min stale rule');
    assert.notStrictEqual(t.indexOf('js/data-health-config.js'), -1, f + ' missing the canonical config include');
  });
  // The dot file itself must read the config too.
  assert.notStrictEqual(dhSrc.indexOf('global.BSAHI_HEALTH_CONFIG'), -1, 'data-health.js no longer reads the canonical config');
});

test('t11 config missing → fallback constants ARE the canonical numbers', function () {
  var dhBare = loadDataHealth({}); // no BSAHI_HEALTH_CONFIG on window
  assert.strictEqual(dhBare.stateFor(MIN_A(20)), 'live');   // fallback LIVE_MIN=35
  assert.strictEqual(dhBare.stateFor(MIN_A(36)), 'delayed');
  assert.strictEqual(dhBare.stateFor(MIN_A(130)), 'stale');
});

test('t12 config override → consumers read the ONE source, not a copy', function () {
  var dhAlt = loadDataHealth({ BSAHI_HEALTH_CONFIG: { CADENCE_MIN: 30, LIVE_MIN: 60, STALE_MIN: 240 } });
  assert.strictEqual(dhAlt.stateFor(MIN_A(50)), 'live');     // 50 < 60 → live under override
  assert.strictEqual(dhAlt.stateFor(MIN_A(61)), 'delayed');  // 61 > 60 → delayed under override
  assert.strictEqual(dhAlt.stateFor(MIN_A(241)), 'stale');
});

// ── runner (matches tests/marketing style) ─────────────────────────────────
var passed = 0;
var idx = 0;
function run() {
  function next() {
    if (idx >= tests.length) {
      console.log('\n' + passed + '/' + tests.length + ' tests passed');
      process.exit(passed === tests.length ? 0 : 1);
      return;
    }
    var t = tests[idx++];
    try { t.fn(); passed++; console.log('ok - ' + t.name); } catch (e) { console.log('FAIL - ' + t.name + ': ' + e.message); }
    next();
  }
  next();
}
run();
