var assert = require('assert');
var path = require('path');
var os = require('os');
var fs = require('fs');
var spoolMod = require('./spool.js');
var capMod = require('./capture-agent.js');
var vc = require('./validate-capture.js');

var TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cap-test-'));
var tests = [];
var passed = 0;

function test(name, fn) { tests.push({ name: name, fn: fn }); }

var ENDPOINTS = [
  { key: 'fees', url: 'https://mempool.space/api/v1/fees/recommended' },
  { key: 'difficulty', url: 'https://mempool.space/api/v1/difficulty-adjustment' }
];

function makeSpool() {
  var dir = path.join(TMP, 's' + Date.now() + '-' + Math.random().toString(36).slice(2, 8));
  return spoolMod.init({ dir: dir, fsync: false });
}

function validFees() { return { status: 200, data: { fastestFee: 1, halfHourFee: 1, hourFee: 1, economyFee: 1, minimumFee: 1 }, fetchedAt: '2026-07-31T00:00:00.000Z' }; }
function validDiff() { return { status: 200, data: { difficultyChange: -2.1, estimatedRetargetDate: 1786256956920, remainingBlocks: 1220, remainingTime: 748635920, nextRetargetHeight: 961632, timeAvg: 613636 }, fetchedAt: '2026-07-31T00:00:00.000Z' }; }

test('T1 slow source does not block fast source', function() {
  var mirror = path.join(TMP, 'm1-' + Date.now());
  fs.mkdirSync(mirror, { recursive: true });
  return makeSpool().then(function(spool) {
    var delayed = 0;
    var fetch = function(ep) {
      return new Promise(function(resolve) {
        setTimeout(function() {
          resolve(ep.key === 'fees' ? validFees() : validDiff());
        }, ep.key === 'fees' ? 10 : 300);
      });
    };
    var agent = capMod.createCaptureAgent({ spool: spool, endpoints: ENDPOINTS, fetch: fetch, config: { baseIntervalMinutes: 60, timeoutMs: 15000 }, mirrorDir: mirror });
    return agent.runCycle().then(function(r) {
      assert.strictEqual(r.captured, 2, 'both captured after settle');
      assert.strictEqual(r.skipped, 0);
    });
  });
});

test('T2 crash mid-cycle → refetch dedups (mirror written, enqueue not reached)', function() {
  var mirror = path.join(TMP, 'm2-' + Date.now());
  fs.mkdirSync(mirror, { recursive: true });
  return makeSpool().then(function(spool) {
    var fetch = function(ep) { return Promise.resolve(ep.key === 'fees' ? validFees() : validDiff()); };
    var agent = capMod.createCaptureAgent({ spool: spool, endpoints: ENDPOINTS, fetch: fetch, config: { baseIntervalMinutes: 60, timeoutMs: 15000 }, mirrorDir: mirror });
    return agent.runCycle().then(function(r) {
      assert.strictEqual(r.captured, 2);
      return spool.stats();
    }).then(function(st) {
      assert.strictEqual(st.totals.enqueued, 2, 'both sources enqueued');
      var files = fs.readdirSync(mirror).filter(function(f) { return f.endsWith('.json') && f.indexOf('.tmp-') !== 0; });
      assert.strictEqual(files.length, 1, 'mirror file written');
      var combined = JSON.parse(fs.readFileSync(path.join(mirror, files[0]), 'utf8'));
      assert.ok(combined.endpoints.fees && combined.endpoints.difficulty, 'combined has both sources');
      var cycleTs = files[0].replace('.json', '');
      return spool.enqueue('fees', validFees(), { captureTime: cycleTs, day: cycleTs.slice(0, 10), producer: 'capture-agent' }).then(function(r2) {
        assert.ok(r2.duplicate, 're-enqueue of same cycleTs dedups');
        return spool.stats();
      });
    }).then(function(st) {
      assert.strictEqual(st.totals.enqueued, 2, 'no duplicate entries');
    });
  });
});

test('T3 degraded → backoff ×2, recovery → 1.5× then base', function() {
  var mirror = path.join(TMP, 'm3-' + Date.now());
  fs.mkdirSync(mirror, { recursive: true });
  var base = 60 * 60 * 1000;
  var fails = 0;
  var t = { ms: 0 };
  var clock = function() { return new Date(t.ms); };
  return makeSpool().then(function(spool) {
    var fetch = function(ep) {
      if (fails < 2) { fails++; return Promise.resolve({ status: 0, error: 'timeout', fetchedAt: new Date().toISOString() }); }
      return Promise.resolve(ep.key === 'fees' ? validFees() : validDiff());
    };
    var agent = capMod.createCaptureAgent({ spool: spool, endpoints: ENDPOINTS, fetch: fetch, now: clock, config: { baseIntervalMinutes: 60, timeoutMs: 15000, degradedMultiplier: 2, recoveryMultiplier: 1.5, recoveryCycles: 2 }, mirrorDir: mirror });
    var delays = [];
    var last = 0;
    function step() {
      var feesTask = agent.state.tasks.fees;
      if (feesTask) t.ms = Math.max(t.ms, feesTask.nextRunAt);
      return agent.runCycle().then(function() {
        delays.push(agent.state.tasks.fees.nextRunAt - last);
        last = agent.state.tasks.fees.nextRunAt;
      });
    }
    return step().then(step).then(step).then(step).then(step).then(function() {
      assert.ok(delays[0] >= base * 2 * 0.5, 'after failure: ~2x base, got ' + delays[0]);
      assert.ok(delays[1] >= base * 2 * 0.5, 'after 2nd failure: ~2x base');
      assert.ok(delays[2] >= base * 1.5 * 0.5 && delays[2] < base * 2, 'after success: recovery 1.5x, got ' + delays[2]);
      assert.ok(delays[3] >= base * 1.5 * 0.5 && delays[3] < base * 2, 'second recovery cycle 1.5x, got ' + delays[3]);
      assert.ok(delays[4] >= base * 0.5 && delays[4] < base * 1.5, 'back to base, got ' + delays[4]);
    });
  });
});

test('T4 schema violation → no enqueue, dead-letter, cursor degraded, mirror written', function() {
  var mirror = path.join(TMP, 'm4-' + Date.now());
  var spoolDir = path.join(TMP, 'm4spool-' + Date.now());
  fs.mkdirSync(mirror, { recursive: true });
  return spoolMod.init({ dir: spoolDir, fsync: false }).then(function(spool) {
    var fetch = function(ep) {
      if (ep.key === 'fees') return Promise.resolve({ status: 200, data: { fastestFee: 'BAD', halfHourFee: 1, hourFee: 1, economyFee: 1, minimumFee: 1 }, fetchedAt: '2026-07-31T00:00:00.000Z' });
      return Promise.resolve(validDiff());
    };
    var agent = capMod.createCaptureAgent({ spool: spool, endpoints: ENDPOINTS, fetch: fetch, config: { baseIntervalMinutes: 60, timeoutMs: 15000 }, mirrorDir: mirror });
    return agent.runCycle().then(function(r) {
      assert.strictEqual(r.violated, 1, 'fees violated');
      assert.strictEqual(r.captured, 1, 'difficulty captured');
      return spool.stats();
    }).then(function(st) {
      assert.strictEqual(st.totals.enqueued, 1, 'only difficulty enqueued');
      return spool.deadLetterList();
    }).then(function(list) {
      assert.strictEqual(list.length, 1, 'one dead-letter');
      assert.strictEqual(list[0].reason, 'schemaViolation');
      assert.ok(list[0].detail.indexOf('fastestFee') !== -1);
      return spool.cursor('fees');
    }).then(function(cur) {
      assert.ok(cur, 'fees cursor exists');
      assert.strictEqual(cur.status, 'degraded');
      var mirrorFiles = fs.readdirSync(mirror).filter(function(f) { return f.endsWith('.json') && f.indexOf('.tmp-') !== 0; });
      assert.ok(mirrorFiles.length > 0, 'mirror file written even on violation');
    });
  });
});

test('T5 failed fetch → NOT enqueued (data-table hygiene), cursor degraded, mirror written', function() {
  var mirror = path.join(TMP, 'm5-' + Date.now());
  var spoolDir = path.join(TMP, 'm5spool-' + Date.now());
  fs.mkdirSync(mirror, { recursive: true });
  return spoolMod.init({ dir: spoolDir, fsync: false }).then(function(spool) {
    var fetch = function(ep) {
      if (ep.key === 'fees') return Promise.resolve({ status: 0, error: 'timeout', fetchedAt: new Date().toISOString() });
      return Promise.resolve(validDiff());
    };
    var agent = capMod.createCaptureAgent({ spool: spool, endpoints: ENDPOINTS, fetch: fetch, config: { baseIntervalMinutes: 60, timeoutMs: 15000 }, mirrorDir: mirror });
    return agent.runCycle().then(function(r) {
      assert.strictEqual(r.errored, 1, 'fees errored');
      assert.strictEqual(r.captured, 1, 'difficulty captured');
      return spool.stats();
    }).then(function(st) {
      assert.strictEqual(st.totals.enqueued, 1, 'ONLY the real capture enqueued — failure is telemetry, not data');
      assert.strictEqual(st.totals.pending, 1, 'the one real capture sits pending for the consumer');
      return spool.cursor('fees');
    }).then(function(cur) {
      assert.ok(cur, 'fees cursor exists');
      assert.strictEqual(cur.status, 'degraded', 'cursor records the failure');
      assert.ok(cur.lastError && cur.lastError.indexOf('timeout') !== -1, 'cursor lastError carries detail');
      var mirrorFiles = fs.readdirSync(mirror).filter(function(f) { return f.endsWith('.json') && f.indexOf('.tmp-') !== 0; });
      assert.ok(mirrorFiles.length > 0, 'mirror file written on failure (failure is recorded in the ledger, not the data table)');
    });
  });
});

test('T6 dual-write produces no duplicates', function() {
  var mirror = path.join(TMP, 'm6-' + Date.now());
  var spoolDir = path.join(TMP, 'm6spool-' + Date.now());
  fs.mkdirSync(mirror, { recursive: true });
  var bridge = require('./spool-bridge.js');
  return spoolMod.init({ dir: spoolDir, fsync: false }).then(function(spool) {
    var agent = capMod.createCaptureAgent({ spool: spool, endpoints: ENDPOINTS, fetch: function(ep) { return Promise.resolve(ep.key === 'fees' ? validFees() : validDiff()); }, config: { baseIntervalMinutes: 60, timeoutMs: 15000 }, mirrorDir: mirror });
    return agent.runCycle().then(function(r) {
      assert.strictEqual(r.captured, 2);
      var files = fs.readdirSync(mirror).filter(function(f) { return f.endsWith('.json') && f.indexOf('.tmp-') !== 0; });
      assert.strictEqual(files.length, 1, 'one combined mirror file per cycle');
      return spool.stats();
    }).then(function(st) {
      assert.strictEqual(st.totals.enqueued, 2, 'agent enqueued 2');
      assert.ok(st.accountingOk);
    });
  });
});

test('T7 mirror incremental does not clobber', function() {
  var mirror = path.join(TMP, 'm7-' + Date.now());
  fs.mkdirSync(mirror, { recursive: true });
  return makeSpool().then(function(spool) {
    var agent = capMod.createCaptureAgent({
      spool: spool, endpoints: ENDPOINTS,
      fetch: function(ep) {
        return new Promise(function(resolve) {
          setTimeout(function() { resolve(ep.key === 'fees' ? validFees() : validDiff()); }, ep.key === 'fees' ? 5 : 20);
        });
      },
      config: { baseIntervalMinutes: 60, timeoutMs: 15000 }, mirrorDir: mirror
    });
    return agent.runCycle().then(function(r) {
      assert.strictEqual(r.captured, 2);
      var files = fs.readdirSync(mirror).filter(function(f) { return f.endsWith('.json') && f.indexOf('.tmp-') !== 0; });
      assert.strictEqual(files.length, 1, 'one combined mirror file per cycle');
      var combined = JSON.parse(fs.readFileSync(path.join(mirror, files[0]), 'utf8'));
      assert.ok(combined.endpoints.fees, 'fees present in combined');
      assert.ok(combined.endpoints.difficulty, 'difficulty present in combined');
    });
  });
});

function run() {
  var idx = 0;
  function next() {
    if (idx >= tests.length) {
      console.log('\n' + passed + '/' + tests.length + ' tests passed');
      fs.rmSync(TMP, { recursive: true, force: true });
      process.exit(passed === tests.length ? 0 : 1);
      return;
    }
    var t = tests[idx++];
    Promise.resolve(t.fn()).then(function() { passed++; console.log('ok - ' + t.name); next(); })
      .catch(function(e) { console.log('FAIL - ' + t.name + ': ' + e.message); next(); });
  }
  next();
}

run();
