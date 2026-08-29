#!/usr/bin/env node
// BSAHI — 19 Web Snapshot Agent
// Generates the public snapshot for the GH-Actions tier from the local spool +
// tools data (richer than the runner-safe fallback). Writes docs/data/*.json,
// optionally auto-commits via plain git. Runs 30-min via launchd.
var path = require('path');
var fs = require('fs');

var REPO = path.resolve(__dirname, '..', '..');
var DATA_DIR = path.join(REPO, 'data');
var STATE_FILE = path.join(REPO, 'captured-data', 'web-snapshot-state.json');

function loadJson(p, fb) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return fb; } }
function sha1(s) { return require('crypto').createHash('sha1').update(s).digest('hex'); }


// Live API fetch — public endpoints only (same sources as generate_snapshot.py
// on the GH-runner tier). Replaces the dead local data-engine mirror
// (captured-data/*.json, frozen since 2026-08-22 when the DE server died):
// the snapshot payload must stay live even while the local mirror is down.
// Node 18+ global fetch; every source fails independently (a dead endpoint
// degrades that one field, never the whole snapshot).
function liveGet(apiPath) {
  var url = 'https://mempool.space' + apiPath;
  return global.fetch(url, { signal: AbortSignal.timeout(15000) }).then(function(r) {
    if (!r.ok) throw new Error('HTTP ' + r.status + ' from ' + url);
    return r.json();
  });
}
function liveGetText(apiPath) {
  var url = 'https://blockstream.info' + apiPath;
  return global.fetch(url, { signal: AbortSignal.timeout(15000) }).then(function(r) {
    if (!r.ok) throw new Error('HTTP ' + r.status + ' from ' + url);
    return r.text();
  });
}

// fetchLivePayload() → { fees, price, height, mempool } with a per-field fetch
// timestamp (ISO). Every field resolves independently: a failure leaves that
// field null so the caller falls back to the local mirror/spool.
function fetchLivePayload() {
  var tsNow = function() { return new Date().toISOString(); };
  var out = { fees: null, fees_ts: null, price: null, price_ts: null, height: null, height_ts: null, mempool: null, mempool_ts: null };
  var chain = Promise.resolve();
  // fees (5-tier) — mempool.space /api/v1/fees/recommended
  chain = chain.then(function() {
    return liveGet('/api/v1/fees/recommended').then(function(d) {
      var fees = {};
      ['fastestFee', 'halfHourFee', 'hourFee', 'economyFee', 'minimumFee'].forEach(function(k) {
        if (d[k] !== undefined && d[k] !== null) fees[k] = d[k];
      });
      out.fees = fees;
      out.fees_ts = tsNow();
    }).catch(function(e) { console.error('live fees fetch failed:', (e && e.message) || e); });
  });
  // price — mempool.space /api/v1/prices (USD)
  chain = chain.then(function() {
    return liveGet('/api/v1/prices').then(function(d) {
      out.price = d;
      out.price_ts = tsNow();
    }).catch(function(e) { console.error('live price fetch failed:', (e && e.message) || e); });
  });
  // height — blockstream first, mempool.space fallback (same order as generate_snapshot.py)
  chain = chain.then(function() {
    return liveGetText('/api/blocks/tip/height').then(function(t) {
      out.height = parseInt(t, 10);
      out.height_ts = tsNow();
    }).catch(function() {
      return liveGet('/api/blocks/tip/height').then(function(d) {
        out.height = parseInt(d, 10);
        out.height_ts = tsNow();
      }).catch(function(e) { console.error('live height fetch failed:', (e && e.message) || e); });
    });
  });
  // mempool count — mempool.space /api/mempool
  chain = chain.then(function() {
    return liveGet('/api/mempool').then(function(d) {
      out.mempool = d;
      out.mempool_ts = tsNow();
    }).catch(function(e) { console.error('live mempool fetch failed:', (e && e.message) || e); });
  });
  return chain.then(function() { return out; });
}

function writeOnChange(name, data) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  var p = path.join(DATA_DIR, name);
  var blob = JSON.stringify(data, null, 2) + '\n';
  var changed = true;
  if (fs.existsSync(p)) {
    try { changed = sha1(fs.readFileSync(p, 'utf8')) !== sha1(blob); } catch (e) {}
  }
  if (changed) fs.writeFileSync(p, blob);
  return changed;
}

function run() { return runAsync.apply(this, arguments); }

async function runAsync() {
  // Forecast (spool-backed)
  var fc = loadJson(path.join(REPO, 'tools', 'fee_forecast.json'), null);
  // Alerts
  var alerts = loadJson(path.join(REPO, 'tools', 'alerts.json'), { alerts: [] });
  // Fee history from spool index
  var history = [];
  var idxDir = path.join(REPO, 'captured-data', 'spool', 'index', 'fees');
  if (fs.existsSync(idxDir)) {
    fs.readdirSync(idxDir).filter(function(f) { return f.endsWith('.jsonl'); }).sort().slice(-7).forEach(function(day) {
      fs.readFileSync(path.join(idxDir, day), 'utf8').split('\n').forEach(function(line) {
        if (!line.trim()) return;
        try {
          var rec = JSON.parse(line);
          var data = (rec.payload || {}).data;
          if (data && data.fastestFee !== undefined) {
            history.push({ date: rec.captureTime ? rec.captureTime.slice(0, 10) : null, fastestFee: data.fastestFee });
          }
        } catch (e) {}
      });
    });
  }
  // Posts count
  var postLog = loadJson(path.join(REPO, 'captured-data', 'post-log.json'), { posts: [] });

  let live; // assigned under the async wrapper below
  // Live-first payload (public APIs). The local data-engine mirror
  // (captured-data/latest.json + latest capture file) is the FALLBACK — kept
  // so the snapshot still degrades to last-known values rather than nulls if
  // every public API is unreachable, but it is NEVER the primary source (that
  // is what froze the payload when the DE server died on 2026-08-22).
  var latestMirror = loadJson(path.join(REPO, 'captured-data', 'latest.json'), null);
  var mirror = {};
  try {
    var capDir = path.join(REPO, 'captured-data');
    var files = fs.existsSync(capDir) ? fs.readdirSync(capDir).filter(function(f) { return /^\d{4}-\d{2}-\d{2}_/.test(f) && f.endsWith('.json'); }).sort() : [];
    if (files.length) mirror = loadJson(path.join(capDir, files[files.length - 1]), {});
  } catch (e) {}
  var mirrorCaptureTs = mirror.captureTime || null;   // honest fallback timestamp
  var ep = mirror.endpoints || {};
  function epData(key) { return (ep[key] && ep[key].data) || null; }

  // Resolve live payload (await inside runAsync). If a live field is null,
  // fall back to the mirror (last capture) with its captureTime as the honest
  // per-field timestamp — a stale fallback must record its real age, not "now".
  live = null;
  try { live = await fetchLivePayload(); } catch (e) { console.error('live payload fetch failed:', (e && e.message) || e); }
  var price = null, height = null, mempool = null, fees = null;
  var fees_ts = null, price_ts = null, height_ts = null, mempool_ts = null;
  if (live) {
    price = live.price || null;
    height = live.height !== null && live.height !== undefined ? live.height : null;
    mempool = live.mempool || null;
    fees = live.fees || null;
    fees_ts = live.fees_ts || null;
    price_ts = live.price_ts || null;
    height_ts = live.height_ts || null;
    mempool_ts = live.mempool_ts || null;
  }
  // Fallbacks (per-field, honest ts): mirror/spool data with the capture time.
  if (price === null || price === undefined) {
    var mp = epData('btc_price');
    if (mp) { price = mp; price_ts = mirrorCaptureTs; }
  }
  if (height === null || height === undefined) {
    var mh = epData('block_height');
    if (mh) { height = (typeof mh === 'object') ? (mh.block_height !== undefined ? mh.block_height : (mh.height !== undefined ? mh.height : null)) : mh; height_ts = mirrorCaptureTs; }
  }
  if (mempool === null || mempool === undefined) {
    var mm = epData('mempool');
    if (mm) { mempool = mm; mempool_ts = mirrorCaptureTs; }
  }
  if (fees === null || fees === undefined) {
    // spool-last fees fallback (authoritative when live API is down)
    fees = {};
    try {
      var feeDir = path.join(REPO, 'captured-data', 'spool', 'index', 'fees');
      var feeFiles = fs.existsSync(feeDir) ? fs.readdirSync(feeDir).filter(function(f) { return f.endsWith('.jsonl'); }).sort() : [];
      if (feeFiles.length) {
        var lines = fs.readFileSync(path.join(feeDir, feeFiles[feeFiles.length - 1]), 'utf8').trim().split('\n');
        var last = lines.length ? JSON.parse(lines[lines.length - 1]) : null;
        var fd = last && last.payload && last.payload.data ? last.payload.data : null;
        if (fd) {
          ['fastestFee', 'halfHourFee', 'hourFee', 'economyFee', 'minimumFee'].forEach(function(k) {
            if (fd[k] !== undefined && fd[k] !== null) fees[k] = fd[k];
          });
          // enqueuedAt is ISO (parseable); captureTime is BSAHI dashed format
          // ("2026-08-22_00-02-20") — prefer the ISO field for honest age math.
          fees_ts = last.enqueuedAt || (last.captureTime ? last.captureTime.replace('_', 'T').replace(/-(\d{2})-(\d{2})$/, ':$1:$2') : null) || mirrorCaptureTs;
        }
      }
    } catch (e) {}
    if (fees.fastestFee === undefined && fc && fc.latest_fastest_fee !== undefined) fees.fastestFee = fc.latest_fastest_fee;
  }
  // Aggregate honest payload timestamp: the OLDEST per-field datum bounds the
  // payload (a single frozen field must not green-light the whole snapshot).
  var fieldTs = [fees_ts, price_ts, height_ts, mempool_ts].filter(function(x) { return x && !isNaN(new Date(x).getTime()); });
  var payload_ts = fieldTs.length ? fieldTs.sort()[0] : null;

  var snapshot = {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    freshness_min: 0,
    // Honest payload stamps (gap #3): payload_ts = oldest per-field datum time;
    // per-field *_ts record each source's effective capture time. Consumers
    // (js/data-health.js) judge freshness by payload_ts, not the envelope.
    payload_ts: payload_ts,
    fees_ts: fees_ts,
    price_ts: price_ts,
    height_ts: height_ts,
    mempool_ts: mempool_ts,
    fees: fees,
    btc_price: (price && price.USD) || null,
    block_height: height,
    mempool_tx: (mempool && mempool.count) || null,
    forecast: fc ? fc.forecast : [],
    alerts: (alerts && alerts.alerts) || [],
    history: history,
    totalPosts: (postLog.posts || []).length
  };

  writeOnChange('snapshot.json', snapshot);
  writeOnChange('latest.json', { latest: '/data/snapshot.json', generated_at: snapshot.generated_at });
  if (fc) writeOnChange('fee_forecast.json', fc);
  writeOnChange('alerts.json', alerts);
  if (history.length) writeOnChange('fee_history.json', history);

  // Public health mirrors (U3, 2026-08-14): ops-health.json + site-health.json
  // are written hourly by agents 16/20 into captured-data/ but were never served
  // publicly. Mirror them into data/ so the static GitHub Pages site can serve
  // /data/ops-health.json + /data/site-health.json (and /status.html can read
  // them). Same writeOnChange pattern as the rest of this agent.
  var opsHealth = loadJson(path.join(REPO, 'captured-data', 'ops-health.json'), null);
  if (opsHealth) writeOnChange('ops-health.json', opsHealth);
  var siteHealth = loadJson(path.join(REPO, 'captured-data', 'site-health.json'), null);
  if (siteHealth) writeOnChange('site-health.json', siteHealth);

  fs.writeFileSync(STATE_FILE, JSON.stringify({ lastRun: new Date().toISOString(), historyPoints: history.length, posts: snapshot.totalPosts }, null, 2));

  // Viz-data mirrors REMOVED (2026-08-14 — Mac-independence Phase 1 + 2): the
  // six research mirrors (block_interval, hashrate, mempool_fee_histogram,
  // fee_history_blocks, bip110_daily, adoption) AND the SCCR files
  // (sccr.json/sccr_latest.json/sccr_history.json — formerly written by this
  // agent running sccr_live.py against the local DB) are now owned by the
  // GitHub Actions research producer (.github/workflows/research-data.yml →
  // tools/generate_research_data.js, public APIs → sccr_live.py --frozen) so
  // the research tier stays fresh even when this Mac is off. Local spool
  // capture keeps running; this agent no longer mirrors those files
  // (single-writer, no conflicts).

  // Optional auto-commit — BLOCKING execSync so process.exit(0) cannot kill the child.
  // Conflict-safe: validates JSON first, and on rebase conflict KEEPS our freshly
  // regenerated data (--ours) then continues — never aborts into a conflicted state.
  if (process.argv.indexOf('--commit') !== -1) {
    // Pre-commit JSON integrity gate — a failed rebase previously shipped conflict
    // markers into data/. Validate BEFORE any git operation.
    // Single canonical data-integrity gate (json.parse + conflict markers) —
    // the SAME script the GitHub Actions workflows call. Pattern-first fix: the
    // old ad-hoc check validated only 4 files and MISSED sccr*.json, letting a
    // stash-pop conflict ship markers into data/. One gate, reused everywhere.
    try {
      require('child_process').execFileSync('python3', [path.join(REPO, 'tools', 'validate_data_json.py')], { cwd: REPO, stdio: 'inherit' });
    } catch (e) {
      console.error('snapshot data validation failed — NOT committing:', (e.message || ''));
      return snapshot;
    }
    try {
      // SSH keepalives for github.com — this 8GB box's slow loose-store
      // enumeration used to idle-timeout mid-fetch/mid-push (early EOF,
      // index-pack fail). The env var is EXPORTED so every git subcommand in
      // this shell line (add/commit/pull/push) inherits it; a plain prefix
      // would apply to the first command only.
      var syncCmd = "export GIT_SSH_COMMAND='ssh -o ServerAliveInterval=15 -o ServerAliveCountMax=4'; ";
      // Stage + commit data/ only when something actually changed (existing behavior).
      syncCmd += 'git add data/ && git diff --cached --quiet || (git -c user.name="bsahi-snapshot-bot" -c user.email="snapshot@bitcoinsahi.com" commit -m "chore: public snapshot ' + new Date().toISOString().slice(0, 16) + '"); ';
      // Conflict-safe sync: pull/rebase, and on conflict RESOLVE the rebase in-place
      // (keep our freshly-regenerated data via --ours, then continue) — never reset
      // --hard, never abort into a conflicted state, never swallow a failure.
      // Runs EVERY cycle (not only when data/ changed) so a drifted origin is
      // fast-forwarded/replayed before the retry push — keeps the push
      // non-force and fast-forward-only.
      syncCmd += '(git pull --rebase --autostash origin main 2>/dev/null && echo pull-ok) || { echo "pull conflict — resolving in place"; git checkout --ours data/ 2>/dev/null; git add data/; git -c user.name="bsahi-snapshot-bot" -c user.email="snapshot@bitcoinsahi.com" -c core.editor=true commit --no-edit --allow-empty -m "chore: resolve snapshot conflict ' + new Date().toISOString().slice(0, 16) + '" 2>/dev/null; git rebase --continue 2>/dev/null || git commit --no-edit 2>/dev/null; }; ';
      // Explicit refspec push (never force). Runs EVERY cycle so a previously
      // failed push is RETRIED even when data/ is unchanged. A push failure is
      // non-fatal: logged, local commits kept, next cycle retries them — the
      // || echo keeps execSync from throwing (exit 0), so the agent never
      // reports "snapshot commit failed" for a purely-transient push error.
      syncCmd += 'git push origin main || echo "push failed — will retry next cycle (local commits kept)"';
      require('child_process').execSync(
        syncCmd,
        { cwd: REPO, timeout: 300000, stdio: 'inherit' }
      );
    } catch (e) {
      console.error('snapshot commit failed:', e.message);
    }
  }
  if (require.main === module) console.log('web-snapshot: ' + history.length + ' history pts, ' + snapshot.totalPosts + ' posts');
  return snapshot;
}

if (require.main === module) { run().then(function() { process.exit(0); }).catch(function(e) { console.error('web-snapshot run failed:', e); process.exit(1); }); }
module.exports = { run: run, writeOnChange: writeOnChange };
