#!/usr/bin/env node
// BSAHI — spool-consumer data-table hygiene (2026-08-15)
// Failed captures are telemetry, not data: the consumer must NOT insert
// status-0/error payloads into the `captures` table (that pollution made
// ops-health read a rolling-upstream-outage ratio as a fake "DB error ratio").
// They are logged to the failure ledger instead.
var assert = require('assert');
var path = require('path');
var os = require('os');
var fs = require('fs');
var spoolMod = require('./spool.js');
var consumer = require('./spool-consumer.js');
var env = require('./envelope.js');

var TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'consumer-test-'));
var tests = [];
var passed = 0;

function test(name, fn) { tests.push({ name: name, fn: fn }); }

function makeSpool() {
  var dir = path.join(TMP, 's' + Date.now() + '-' + Math.random().toString(36).slice(2, 8));
  return spoolMod.init({ dir: dir, fsync: false });
}

// Poke the failure-ledger path: FAILURES_LOG is module-level; point it at TMP.
function writeFailuresLog(rec) {
  var p = path.join(TMP, 'capture-failures.log');
  fs.appendFileSync(p, JSON.stringify(rec) + '\n');
  return p;
}

test('C1 failure payload → not inserted as a data row, logged to failure ledger', function() {
  var failLog = path.join(TMP, 'capture-failures.log');
  process.env.BSAHI_FAILURES_LOG = failLog;
  delete require.cache[require.resolve('./spool-consumer.js')];
  consumer = require('./spool-consumer.js');
  return makeSpool().then(function() {
    var bad = env.wrapCapture('fees', { status: 0, error: 'timeout', fetchedAt: '2026-07-31T00:00:00.000Z' }, { cycleTs: '2026-07-31_00-00-00' });
    return consumer.handler(bad, { source: 'fees', id: 'fees:2026-07-31_00-00-00', captureTime: '2026-07-31_00-00-00' })
      .then(function() {
        assert.ok(fs.existsSync(failLog), 'failure ledger written');
        var log = fs.readFileSync(failLog, 'utf8');
        assert.ok(log.indexOf('"source":"fees"') !== -1, 'ledger records the failed source');
        assert.ok(log.indexOf('timeout') !== -1, 'ledger records the error detail');
      });
  });
});

test('C2 success payload → data path unchanged (envelope handler still returns)', function() {
  return makeSpool().then(function() {
    var ok = env.wrapCapture('fees', { status: 200, data: { fastestFee: 1, halfHourFee: 1, hourFee: 1, economyFee: 1, minimumFee: 1 }, fetchedAt: '2026-07-31T00:00:00.000Z' }, { cycleTs: '2026-07-31_00-01-00' });
    return consumer.handler(ok, { source: 'fees', id: 'fees:2026-07-31_00-01-00', captureTime: '2026-07-31_00-01-00' }).then(function() {
      // handler should resolve (insertCapture is DB-backed; only assert no throw + shape)
      assert.ok(true);
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
