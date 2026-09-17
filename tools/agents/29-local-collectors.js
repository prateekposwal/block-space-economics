#!/usr/bin/env node
/**
 * BSAHI local collectors — a persistent, launchd-managed replacement for the
 * ephemeral /tmp/supervise_*.sh loops.
 *
 * Why this exists: the population / per-block / UTXO instruments used to run in
 * plain `nohup` shell loops under /tmp. macOS clears /tmp on reboot and those
 * loops die on logout, with nothing to restart them — so capture stopped
 * silently while the site kept serving the last values. The canonical N source
 * (node_census_capture.py) and mining_concentration.py had no scheduler at all.
 *
 * Design: launchd invokes this every 15 min (StartInterval). It reads a
 * per-instrument "last run" state file and runs only what is due. launchd will
 * not start a second instance while one is still running, so a long crawl can't
 * overlap. Every instrument is best-effort: one failure never blocks the rest.
 *
 * State:  ~/.bsahi/collector-state.json   (outside the repo, never committed)
 * Log:    ~/Library/Logs/bsahi-collectors.log
 */
'use strict';
var path = require('path');
var fs = require('fs');
var os = require('os');
var cp = require('child_process');

var REPO = path.join(__dirname, '..', '..');
var STATE_DIR = path.join(os.homedir(), '.bsahi');
var STATE = path.join(STATE_DIR, 'collector-state.json');
var LOG = path.join(os.homedir(), 'Library', 'Logs', 'bsahi-collectors.log');

// name -> { script, args, every (s), timeoutS }
// ORDER MATTERS: they run sequentially and launchd will not start an overlapping
// instance, so the critical instruments go first and the slowest goes last. A
// slow instrument can otherwise block the whole cycle (observed: perblock can
// run 20+ min against rate-limited public APIs, delaying the N source).
var SCHEDULE = [
  { name: 'node_census',          script: 'tools/research/node_census_capture.py',   args: [], every: 86400, timeoutS: 1500 },
  { name: 'utxo_state_measure',   script: 'tools/research/utxo_state_measure.py',    args: [], every: 21600, timeoutS: 600 },
  { name: 'inbound_census',       script: 'tools/research/inbound_census.py',        args: [], every: 3600,  timeoutS: 300 },
  { name: 'addrman_churn',        script: 'tools/research/addrman_churn.py',         args: [], every: 43200, timeoutS: 600 },
  { name: 'seed_census',          script: 'tools/research/seed_census.py',           args: [], every: 43200, timeoutS: 600 },
  { name: 'pool_concentration',   script: 'tools/research/pool_concentration.py',    args: [], every: 86400, timeoutS: 900 },
  { name: 'perblock_validation',  script: 'tools/research/perblock_validation.py',   args: ['--samples', '12'], every: 1800, timeoutS: 900 }
];

var TIMEOUT_MS = 30 * 60 * 1000;  // generous: a btcnodes crawl can be slow

function stamp() { return new Date().toISOString().replace('T', ' ').slice(0, 19); }

function log(msg) {
  var line = stamp() + ' ' + msg;
  console.log(line);
  try { fs.appendFileSync(LOG, line + '\n'); } catch (e) { /* logging is best-effort */ }
}

function readState() {
  try { return JSON.parse(fs.readFileSync(STATE, 'utf8')); } catch (e) { return {}; }
}

function writeState(s) {
  try { fs.mkdirSync(STATE_DIR, { recursive: true }); fs.writeFileSync(STATE, JSON.stringify(s, null, 2)); }
  catch (e) { log('state write failed: ' + e.message); }
}

function main() {
  var state = readState();
  var now = Math.floor(Date.now() / 1000);
  var ran = 0, failed = 0;

  SCHEDULE.forEach(function (job) {
    var last = state[job.name] && state[job.name].last_run_epoch;
    if (last && (now - last) < job.every) return;   // not due

    var scriptPath = path.join(REPO, job.script);
    if (!fs.existsSync(scriptPath)) { log(job.name + ': script missing, skipped'); return; }

    var t0 = Date.now();
    try {
      cp.execFileSync('python3', [scriptPath].concat(job.args), {
        cwd: REPO, timeout: (job.timeoutS || TIMEOUT_MS / 1000) * 1000, stdio: ['ignore', 'pipe', 'pipe']
      });
      var dt = ((Date.now() - t0) / 1000).toFixed(0);
      log(job.name + ': OK (' + dt + 's)');
      state[job.name] = { last_run_epoch: now, last_ok_epoch: now, last_status: 'ok', last_s: Number(dt) };
      ran++;
    } catch (e) {
      var dtf = ((Date.now() - t0) / 1000).toFixed(0);
      var tail = String((e.stderr || e.stdout || e.message || '')).trim().split('\n').slice(-2).join(' | ').slice(0, 200);
      log(job.name + ': FAILED after ' + dtf + 's — ' + tail);
      // Record the attempt so a hard-failing job retries on its normal cadence,
      // not every 15 min.
      state[job.name] = { last_run_epoch: now, last_ok_epoch: (state[job.name] || {}).last_ok_epoch || null, last_status: 'failed', last_s: Number(dtf) };
      failed++;
    }
  });

  writeState(state);
  if (ran || failed) log('cycle: ' + ran + ' ok, ' + failed + ' failed');
  return 0;
}

if (require.main === module) process.exit(main());
