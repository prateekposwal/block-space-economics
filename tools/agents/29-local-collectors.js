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
  // Safety net: if the cloud SCCR tier stalls, produce a fresh reading locally.
  // Inert whenever the committed sccr.json is < 2h old, so never a second writer.
  { name: 'sccr_fallback',        script: 'tools/research/sccr_fallback.py',        args: [], every: 1800, timeoutS: 600 },
  { name: 'node_census',          script: 'tools/research/node_census_capture.py',   args: [], every: 86400, timeoutS: 1500 },
  { name: 'utxo_state_measure',   script: 'tools/research/utxo_state_measure.py',    args: [], every: 21600, timeoutS: 600 },
  { name: 'inbound_census',       script: 'tools/research/inbound_census.py',        args: [], every: 3600,  timeoutS: 300 },
  // Bridge backing-ratio watchtower. Placed BEFORE the slow fetchers on purpose:
  // detecting an in-flight bridge exploit is time-critical, and a long job
  // earlier in the list (block_propagation has been observed running ~47 min
  // past its 300s timeout) starves everything after it for the whole cycle.
  // 231s measured (20 Esplora custody lookups + 5-RPC supply consensus); keep
  // real headroom so a slow Esplora day cannot turn it into a FAILED cycle.
  { name: 'bridge_reserves',      script: 'tools/research/bridge_reserves.py',       args: [], every: 900, timeoutS: 600 },
  { name: 'addrman_churn',        script: 'tools/research/addrman_churn.py',         args: [], every: 43200, timeoutS: 600 },
  { name: 'seed_census',          script: 'tools/research/seed_census.py',           args: [], every: 43200, timeoutS: 600 },
  { name: 'pool_concentration',   script: 'tools/research/pool_concentration.py',    args: [], every: 86400, timeoutS: 900 },
  { name: 'perblock_validation',  script: 'tools/research/perblock_validation.py',   args: ['--samples', '12'], every: 1800, timeoutS: 900 },
  // Population-geography program. The three SOURCES are cached and rate-limit
  // safe; contribution_ratio only JOINS them, so it runs last.
  { name: 'node_geography',       script: 'tools/research/node_geography.py',        args: ['--fetch'], every: 21600, timeoutS: 300 },
  { name: 'block_propagation',    script: 'tools/research/block_propagation.py',     args: ['--fetch', '--detail', '5'], every: 3600, timeoutS: 300 },
  { name: 'mining_geography',     script: 'tools/research/mining_geography.py',      args: [], every: 86400, timeoutS: 120 },
  { name: 'contribution_ratio',   script: 'tools/research/contribution_ratio.py',    args: [], every: 3600, timeoutS: 120 },
  // Safety net: the com.bsahi.blockwatch daemon owns first-party relay capture,
  // but rebuild its site JSON from the log even if that daemon is down.
  { name: 'peer_relay_build',     script: 'tools/research/block_first_seen.py',      args: ['--build-only'], every: 1800, timeoutS: 120 },
  // Measured validation cost, harvested from the live reindex log (first-party).
  // Keeps filling in later eras as the reindex advances toward the tip.
  { name: 'validation_cost',      script: 'tools/research/validation_cost.py',       args: ['--sample'], every: 1800, timeoutS: 300 },
  // Re-apply offline geo/ASN to the newest crawl (no dialing) so data/node_crawl.json
  // always carries country/ASN even if the crawl ran without the geo DB.
  // 'best' = most complete raw crawl, not merely the newest: a small manual run
  // must not overwrite the published census aggregate.
  { name: 'node_crawl_enrich',    script: 'tools/net/node_crawler.py',               args: ['--enrich-raw', 'best'], every: 3600, timeoutS: 180 },
  // Self-hosted robust BTC/USD reference rate (median across independent venues).
  { name: 'price_index',          script: 'tools/research/price_index.py',           args: [], every: 900, timeoutS: 120 },
  // Mining-geography reachability evidence: pool stratum endpoints + CDN fronting.
  // D5: keep gossiping our census IPv6 so peers add it to addrman and dial us.
  // Inert unless the tunnel is fresh; advertises once ev 30 min (~2 min per run).
  { name: 'advertise',           cmd: ['bash', 'tools/net/advertise.sh'], every: 1800, timeoutS: 420 },
  // One-shot: applies the node quality upgrade the moment the reindex finishes
  // (idle until then, and forever after via its marker file).
  { name: 'node_upgrade',         script: 'tools/net/apply_node_upgrade.py',       args: [], every: 900, timeoutS: 420 },
  // Reports the two transitions we're waiting on: IBD cleared, and the first
  // measured block-relay participation number. Fires once each; cheap.
  { name: 'ibd_watch',           script: 'tools/research/ibd_watch.py',            args: [], every: 900, timeoutS: 60 },
  // D5: is the private/non-listening census endpoint actually live + reachable?
  { name: 'd5_status',           script: 'tools/net/d5_status.py',                 args: [], every: 1800, timeoutS: 180 },
  { name: 'pool_infrastructure',  script: 'tools/net/pool_infrastructure.py',        args: [], every: 86400, timeoutS: 300 },
  // Base-layer audit of off-chain bridge incidents. The windows are static, so a
  // daily re-run just keeps the anchors/timestamps fresh and picks up any incident
  // added to INCIDENTS. ~3m40s (it walks the chain to anchor each timestamp).
  { name: 'base_layer_audit',     script: 'tools/research/base_layer_audit.py',      args: [], every: 86400, timeoutS: 600 },
  // Clearnet distinct-IP census from a public-IP VPS (see
  // research/inbound-census-vps.md). Inert until ~/.bsahi/vps-census.conf exists.
  { name: 'vps_census_pull', cmd: ['bash', 'tools/net/vps_census_pull.sh'], every: 3600,
    requires: path.join(os.homedir(), '.bsahi', 'vps-census.conf') }
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

function killTree(pid, signal) {
  // Negative pid = the whole process GROUP (requires detached:true below).
  try { process.kill(-pid, signal); }
  catch (e) { try { process.kill(pid, signal); } catch (e2) { /* already gone */ } }
}

/**
 * Run one job with a HARD timeout that actually kills.
 *
 * execFileSync's `timeout` only signals the direct child, then blocks waiting for
 * it to exit. If that child is parked in a syscall (a blocking network read with
 * no timeout), SIGTERM is deferred until the call returns — which may be never —
 * and the collector wedges. Observed: block_propagation ran 2,943s against a 300s
 * limit and starved every job behind it, including the bridge watchtower.
 *
 * So: spawn DETACHED (its own process group) and, on timeout, SIGTERM then
 * SIGKILL the group. SIGKILL cannot be caught or deferred, so the whole tree dies.
 * We also stop waiting if the child has exited but something inherited its stdio
 * pipes and is holding them open, which would otherwise hang 'close' forever.
 */
function runJob(job, argv) {
  return new Promise(function (resolve) {
    var limitMs = (job.timeoutS || TIMEOUT_MS / 1000) * 1000;
    var child;
    try {
      child = cp.spawn(argv[0], argv.slice(1), {
        cwd: REPO, detached: true, stdio: ['ignore', 'pipe', 'pipe']
      });
    } catch (e) {
      return resolve({ ok: false, timedOut: false, err: String((e && e.message) || e) });
    }

    var out = '', err = '', timedOut = false, settled = false, killTimer = null, exitTimer = null;

    function done(code, signal) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (killTimer) clearTimeout(killTimer);
      if (exitTimer) clearTimeout(exitTimer);
      resolve({ ok: !timedOut && code === 0, timedOut: timedOut, code: code, signal: signal, out: out, err: err });
    }

    child.stdout.on('data', function (d) { if (out.length < 8000) out += d; });
    child.stderr.on('data', function (d) { if (err.length < 8000) err += d; });

    var timer = setTimeout(function () {
      timedOut = true;
      killTree(child.pid, 'SIGTERM');
      killTimer = setTimeout(function () { killTree(child.pid, 'SIGKILL'); }, 5000);
    }, limitMs);

    // Child gone: give pipes a moment to flush, then stop waiting regardless.
    child.on('exit', function () { exitTimer = setTimeout(function () { done(null, null); }, 2000); });
    child.on('close', done);
    child.on('error', function (e) { err += String((e && e.message) || e); done(-1, null); });
  });
}

async function main() {
  var state = readState();
  var now = Math.floor(Date.now() / 1000);
  var ran = 0, failed = 0;

  for (var i = 0; i < SCHEDULE.length; i++) {
    var job = SCHEDULE[i];
    var last = state[job.name] && state[job.name].last_run_epoch;
    if (last && (now - last) < job.every) continue;             // not due
    if (job.requires && !fs.existsSync(job.requires)) continue; // not configured yet

    var argv;
    if (job.cmd) {
      argv = job.cmd.slice();
    } else {
      var scriptPath = path.join(REPO, job.script);
      if (!fs.existsSync(scriptPath)) { log(job.name + ': script missing, skipped'); continue; }
      argv = ['python3', scriptPath].concat(job.args);
    }

    var t0 = Date.now();
    var res = await runJob(job, argv);
    var dt = ((Date.now() - t0) / 1000).toFixed(0);

    if (res.ok) {
      log(job.name + ': OK (' + dt + 's)');
      state[job.name] = { last_run_epoch: now, last_ok_epoch: now, last_status: 'ok', last_s: Number(dt) };
      ran++;
    } else {
      var tail = String(res.err || res.out || '').trim().split('\n').slice(-2).join(' | ').slice(0, 200);
      var why = res.timedOut ? ('TIMEOUT after ' + dt + 's (group killed)') : ('FAILED after ' + dt + 's');
      log(job.name + ': ' + why + ' — ' + tail);
      // Record the attempt so a hard-failing job retries on its normal cadence,
      // not every 15 min.
      state[job.name] = { last_run_epoch: now, last_ok_epoch: (state[job.name] || {}).last_ok_epoch || null,
                          last_status: res.timedOut ? 'timeout' : 'failed', last_s: Number(dt) };
      failed++;
    }
    writeState(state);   // persist per job: a slow LAST job must not lose the rest
  }

  writeState(state);
  if (ran || failed) log('cycle: ' + ran + ' ok, ' + failed + ' failed');
  return 0;
}

if (require.main === module) main().then(function (code) { process.exit(code); });
