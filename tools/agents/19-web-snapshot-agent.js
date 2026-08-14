#!/usr/bin/env node
// BSAHI — 19 Web Snapshot Agent
// Generates the public snapshot for the GH-Actions tier from the local spool +
// tools data (richer than the runner-safe fallback). Writes docs/data/*.json,
// optionally auto-commits via plain git. Runs 30-min via launchd.
var path = require('path');
var fs = require('fs');
var { exec } = require('child_process');

var REPO = path.resolve(__dirname, '..', '..');
var DATA_DIR = path.join(REPO, 'data');
var STATE_FILE = path.join(REPO, 'captured-data', 'web-snapshot-state.json');

function loadJson(p, fb) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return fb; } }
function sha1(s) { return require('crypto').createHash('sha1').update(s).digest('hex'); }

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

function run() {
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

  // Live price / height / mempool from the latest data-engine mirror (the local
  // capture agent has them; previously hardcoded null meant the public snapshot
  // served empty price/height on the rich path).
  var latestMirror = loadJson(path.join(REPO, 'captured-data', 'latest.json'), null);
  var mirror = {};
  try {
    var capDir = path.join(REPO, 'captured-data');
    var files = fs.existsSync(capDir) ? fs.readdirSync(capDir).filter(function(f) { return /^\d{4}-\d{2}-\d{2}_/.test(f) && f.endsWith('.json'); }).sort() : [];
    if (files.length) mirror = loadJson(path.join(capDir, files[files.length - 1]), {});
  } catch (e) {}
  var ep = mirror.endpoints || {};
  function epData(key) { return (ep[key] && ep[key].data) || null; }
  var price = epData('btc_price');
  var height = epData('block_height');
  var mempool = epData('mempool');

  var snapshot = {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    freshness_min: 0,
    fees: (function() {
      // 5-tier fee object from the spool's live 'fees' capture (authoritative);
      // fall back to the forecast's fastest fee only if the spool is empty.
      var fees = {};
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
          }
        }
      } catch (e) {}
      if (fees.fastestFee === undefined && fc && fc.latest_fastest_fee !== undefined) fees.fastestFee = fc.latest_fastest_fee;
      return fees;
    })(),
    btc_price: (price && price.USD) || null,
    block_height: (typeof height === 'object') ? (height.block_height !== undefined ? height.block_height : (height.height !== undefined ? height.height : null)) : height,
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

  // Live SCCR dashboard + static API files (/sccr/latest, /sccr/history).
  // Runs the python live writer; its outputs are read below so they ship with
  // this snapshot commit even if the writer writes before we copy.
  try {
    exec('python3 tools/research/sccr_live.py', { cwd: REPO, timeout: 30000 }, function (err, so, se) {
      if (err) { console.error('sccr_live failed:', (se || '').slice(0, 200)); return; }
      ['sccr.json', 'sccr_latest.json', 'sccr_history.json'].forEach(function (f) {
        var d = loadJson(path.join(DATA_DIR, f), null);
        if (d) writeOnChange(f, d);
      });
    });
  } catch (e) { console.error('sccr_live exec error:', e.message); }

  fs.writeFileSync(STATE_FILE, JSON.stringify({ lastRun: new Date().toISOString(), historyPoints: history.length, posts: snapshot.totalPosts }, null, 2));

  // Viz-data mirrors REMOVED (2026-08-14 — Mac-independence Phase 1): the six
  // research mirrors (block_interval, hashrate, mempool_fee_histogram,
  // fee_history_blocks, bip110_daily, adoption) are now owned by the GitHub
  // Actions research producer (.github/workflows/research-data.yml →
  // tools/generate_research_data.js, public APIs) so the research tier stays
  // fresh even when this Mac is off. Local spool capture keeps running; this
  // agent no longer mirrors those files (single-writer, no conflicts).

  // Optional auto-commit — BLOCKING execSync so process.exit(0) cannot kill the child.
  // Conflict-safe: validates JSON first, and on rebase conflict KEEPS our freshly
  // regenerated data (--ours) then continues — never aborts into a conflicted state.
  if (process.argv.indexOf('--commit') !== -1) {
    // Pre-commit JSON integrity gate — a failed rebase previously shipped conflict
    // markers into data/. Validate BEFORE any git operation.
    try {
      ['snapshot.json', 'latest.json', 'alerts.json', 'fee_history.json'].forEach(function (f) {
        var p = path.join(DATA_DIR, f);
        var t = fs.readFileSync(p, 'utf8');
        if (t.indexOf('<<<<<<<') !== -1 || t.indexOf('=======') !== -1 || t.indexOf('>>>>>>>') !== -1) {
          throw new Error('conflict markers in ' + f);
        }
        JSON.parse(t);
      });
    } catch (e) {
      console.error('snapshot JSON validation failed — NOT committing:', e.message);
      return snapshot;
    }
    try {
      var syncCmd = 'git add data/ && git diff --cached --quiet || (git -c user.name="bsahi-snapshot-bot" -c user.email="snapshot@bitcoinsahi.com" commit -m "chore: public snapshot ' + new Date().toISOString().slice(0, 16) + '" && ';
      // Conflict-safe sync: pull/rebase, and on conflict RESOLVE the rebase in-place
      // (keep our freshly-regenerated data via --ours, then continue) — never reset
      // --hard, never abort into a conflicted state, never swallow a failure.
      syncCmd += '(git pull --rebase --autostash origin main 2>/dev/null && echo pull-ok) || { echo "pull conflict — resolving in place"; git checkout --ours data/ 2>/dev/null; git add data/; git -c user.name="bsahi-snapshot-bot" -c user.email="snapshot@bitcoinsahi.com" -c core.editor=true commit --no-edit --allow-empty -m "chore: resolve snapshot conflict ' + new Date().toISOString().slice(0, 16) + '" 2>/dev/null; git rebase --continue 2>/dev/null || git commit --no-edit 2>/dev/null; }; ';
      syncCmd += 'git push)';
      require('child_process').execSync(
        syncCmd,
        { cwd: REPO, timeout: 120000, stdio: 'inherit' }
      );
    } catch (e) {
      console.error('snapshot commit failed:', e.message);
    }
  }
  if (require.main === module) console.log('web-snapshot: ' + history.length + ' history pts, ' + snapshot.totalPosts + ' posts');
  return snapshot;
}

if (require.main === module) { run(); process.exit(0); }
module.exports = { run: run, writeOnChange: writeOnChange };
