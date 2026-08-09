#!/usr/bin/env node
// BSAHI — BIP-110 Signaling Capture (version-bits during the mandatory window)
// Captures version-bit signaling (bit 4) from live mempool.space blocks.
// The mandatory-signaling window (blocks 961632-963647, lock-in <= 963648) is a
// one-time natural experiment in Bitcoin governance: "who can change the valid-state
// transition rules, under what coordination threshold?" (governance-boundary program).
// This source records the ACTUAL signaling behavior during the window.
var path = require('path');
var https = require('https');

var REPO = path.resolve(__dirname, '..', '..');

function getJson(url, timeoutMs) {
  return new Promise(function(resolve) {
    var req = https.get(url, function(res) {
      var data = '';
      res.on('data', function(c) { data += c; });
      res.on('end', function() {
        try { resolve({ ok: true, data: JSON.parse(data) }); }
        catch (e) { resolve({ ok: false, error: 'parse: ' + e.message }); }
      });
    });
    req.setTimeout(timeoutMs || 30000, function() { req.destroy(); resolve({ ok: false, error: 'timeout' }); });
    req.on('error', function(e) { resolve({ ok: false, error: e.message }); });
  });
}

function decodeBit4(version) {
  return Boolean(version & (1 << 4));
}

async function run() {
  var out = { ok: false, height: null, window: null, signaling: [], windowTotal: 0, windowSignaling: 0, observedAt: new Date().toISOString() };

  // BIP-110 mandatory-signaling window (verified from BIP text)
  var WINDOW_START = 961632;
  var WINDOW_END = 963647;
  var LOCK_IN = 963648;

  var res = await getJson('https://mempool.space/api/blocks?limit=10', 30000);
  if (!res.ok) { out.error = res.error; return out; }
  var blocks = res.data;
  if (!Array.isArray(blocks) || !blocks.length) { out.error = 'no blocks'; return out; }

  out.height = blocks[0].height;
  var inWindow = out.height >= WINDOW_START && out.height <= WINDOW_END;
  var passedLockIn = out.height >= LOCK_IN;
  out.window = { start: WINDOW_START, end: WINDOW_END, lockIn: LOCK_IN, inWindow: inWindow, passedLockIn: passedLockIn,
                 blocksUntilLockIn: Math.max(0, LOCK_IN - out.height) };

  // Sample the last 10 blocks
  blocks.forEach(function(b) {
    var bit4 = decodeBit4(b.version);
    out.signaling.push({ height: b.height, version: b.version, versionHex: '0x' + format(b.version), bit4: bit4 });
    out.windowTotal++;
    if (bit4) out.windowSignaling++;
  });

  // Recent-window signaling share (last 10 blocks)
  out.signalingSharePct = Math.round(out.windowSignaling / out.windowTotal * 1000) / 10;
  out.ok = true;

  var spoolMod = require('../data-engineering/spool.js');
  var now = new Date();
  var ts = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0') + '_' + String(now.getHours()).padStart(2, '0') + '-' + String(now.getMinutes()).padStart(2, '0') + '-' + String(now.getSeconds()).padStart(2, '0');
  var day = ts.slice(0, 10);
  var spool = await spoolMod.init();
  var result = await spool.enqueue('bip110_signal', {
    status: out.ok ? 200 : 0,
    data: out,
    fetchedAt: new Date().toISOString()
  }, { captureTime: ts, day: day, producer: 'bip110-capture', expectedIntervalMinutes: 60 });

  if (require.main === module) {
    console.log('bip110: height=' + out.height + ' inWindow=' + inWindow + ' signaling=' + out.signalingSharePct + '% (bit4) ' + (result.ok ? 'enqueued' : 'duplicate'));
  }
  return out;
}

function format(v) { return v.toString(16).padStart(8, '0'); }

if (require.main === module) { run().then(function() { process.exit(0); }).catch(function(e) { console.error(e); process.exit(1); }); }

module.exports = { run: run, decodeBit4: decodeBit4 };
