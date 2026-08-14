#!/usr/bin/env node
// BSAHI — 16 Ops Health Watchdog
// 15-min health checks: spool accounting, DE agent liveness, orchestrator
// heartbeat, DE server health, DB error ratio. Alerts via webhook.
var path = require('path');
var fs = require('fs');
var https = require('https');
var http = require('http');

var REPO = path.resolve(__dirname, '..', '..');
var OUT_FILE = path.join(REPO, 'captured-data', 'ops-health.json');
var LOG_FILE = path.join(REPO, 'captured-data', 'ops-health.log');
var CHECK_INTERVAL_MS = 15 * 60 * 1000;
// DB error ratio is gated on a ROLLING window (default 24h) — a lifetime
// cumulative ratio can never recover after a historical outage, so it is the
// wrong signal for CURRENT ops health. Lifetime ratio still reported below.
// Override with env DB_ERROR_WINDOW_HOURS.
var DB_ERROR_WINDOW_HOURS = parseInt(process.env.DB_ERROR_WINDOW_HOURS, 10) || 24;

function log(msg) {
  var line = '[' + new Date().toISOString() + '] ' + msg;
  console.log(line);
  try { fs.appendFileSync(LOG_FILE, line + '\n'); } catch (e) {}
}

function loadJson(p, fb) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return fb; } }

function ageMinutes(ts) {
  if (!ts) return null;
  var t = new Date(ts).getTime();
  if (isNaN(t)) return null;
  return Math.round((Date.now() - t) / 60000);
}

function httpGet(url, timeout) {
  return new Promise(function(resolve) {
    try {
      var u = new URL(url);
      var mod = u.protocol === 'https:' ? https : http;
      var req = mod.request({ hostname: u.hostname, port: u.port || (u.protocol === 'https:' ? 443 : 80), path: u.pathname, method: 'GET', timeout: timeout || 5000 }, function(res) {
        var body = '';
        res.on('data', function(c) { body += c; });
        res.on('end', function() {
          var parsed = null;
          try { parsed = JSON.parse(body); } catch (e) {}
          resolve({ ok: res.statusCode >= 200 && res.statusCode < 400, status: res.statusCode, body: parsed });
        });
      });
      req.on('error', function(e) { resolve({ ok: false, status: 0, error: e.message }); });
      req.on('timeout', function() { req.destroy(); resolve({ ok: false, status: 0, error: 'timeout' }); });
      req.end();
    } catch (e) { resolve({ ok: false, status: 0, error: e.message }); }
  });
}

function check() {
  var issues = [];
  var checks = {};
  return Promise.all([
    // spool
    require('../data-engineering/spool.js').init().then(function(s) { return s.stats(); }).catch(function(e) { return null; }),
    // de server (http on localhost)
    httpGet('http://localhost:3456/health', 5000),
    // db error ratio
    (function() {
      try {
        var db = require('../db/init.js');
        // Rolling-window signal (current health) + lifetime for transparency.
        var winTotal = db.query("SELECT COUNT(*) AS c FROM captures WHERE captured_at >= datetime('now', '-" + DB_ERROR_WINDOW_HOURS + " hours')");
        var winErrs = db.query("SELECT COUNT(*) AS c FROM captures WHERE status = 0 AND captured_at >= datetime('now', '-" + DB_ERROR_WINDOW_HOURS + " hours')");
        var total = db.query("SELECT COUNT(*) AS c FROM captures");
        var errs = db.query("SELECT COUNT(*) AS c FROM captures WHERE status = 0");
        return Promise.resolve({
          total: total && total[0] ? total[0].c : 0,
          errs: errs && errs[0] ? errs[0].c : 0,
          windowTotal: winTotal && winTotal[0] ? winTotal[0].c : 0,
          windowErrs: winErrs && winErrs[0] ? winErrs[0].c : 0,
          windowHours: DB_ERROR_WINDOW_HOURS
        });
      } catch (e) { return Promise.resolve(null); }
    })()
  ]).then(function(results) {
    var spoolStats = results[0];
    var server = results[1];
    var dbStats = results[2];

    checks.spool = spoolStats ? { accountingOk: spoolStats.accountingOk, pending: spoolStats.totals.pending, dead: spoolStats.totals.dead, stale: spoolStats.staleSources.length } : { error: 'spool init failed' };
    if (!spoolStats || !spoolStats.accountingOk || spoolStats.totals.dead > 0) issues.push('SPOOL: accounting/dead issue');
    if (spoolStats && spoolStats.staleSources.length > 0) issues.push('SPOOL: stale sources: ' + spoolStats.staleSources.join(','));

    checks.de_server = server ? { ok: server.ok, status: server.status, agent: server.body ? server.body.agent : null } : { error: 'no response' };
    if (!server || !server.ok) issues.push('DE SERVER: unhealthy');
    else if (server.body && server.body.agent === 'stopped') issues.push('DE SERVER: agent STOPPED (server up, agent down)');

    var deState = loadJson(path.join(REPO, 'captured-data', 'de-agent-state.json'), null);
    var agentAge = deState && deState.lastRun ? ageMinutes(new Date(deState.lastRun).getTime() > 0 ? new Date(deState.lastRun).toISOString() : null) : null;
    checks.de_agent = { lastRunAgeMin: agentAge };
    if (agentAge !== null && agentAge > 90) issues.push('DE AGENT: last run ' + agentAge + ' min ago');

    var hb = loadJson(path.join(REPO, 'captured-data', 'orchestrator-heartbeat.json'), null);
    var hbAge = hb ? ageMinutes(hb.at) : null;
    checks.orchestrator = { heartbeatAgeMin: hbAge, phase: hb ? hb.phase : null };
    if (hbAge !== null && hbAge > 60) issues.push('ORCHESTRATOR: heartbeat ' + hbAge + ' min ago');

    var winRatio = dbStats && dbStats.windowTotal > 0 ? Math.round(dbStats.windowErrs / dbStats.windowTotal * 100) : 0;
    var errRatio = dbStats && dbStats.total > 0 ? Math.round(dbStats.errs / dbStats.total * 100) : 0;
    checks.db = dbStats ? { errorRatioPct: winRatio, windowHours: dbStats.windowHours, windowTotal: dbStats.windowTotal, windowErrs: dbStats.windowErrs, lifetimeErrorRatioPct: errRatio, total: dbStats.total, errs: dbStats.errs } : { error: 'db query failed' };
    if (winRatio > 20) issues.push('DB: error ratio ' + winRatio + '% (last ' + DB_ERROR_WINDOW_HOURS + 'h) > 20%');

    var out = {
      generated_at: new Date().toISOString(),
      status: issues.length ? 'DEGRADED' : 'HEALTHY',
      issues: issues,
      checks: checks
    };
    fs.writeFileSync(OUT_FILE, JSON.stringify(out, null, 2));

    if (issues.length) {
      log('ISSUES: ' + issues.join(' | '));
      try {
        var sender = require('child_process');
        fs.writeFileSync(path.join(REPO, 'tools', 'alerts.json'), JSON.stringify({ alerts: issues.map(function(i) { return '🛡 ' + i; }), timestamp: new Date().toISOString(), source: 'ops-health' }, null, 2));
        sender.execFile('python3', [path.join(REPO, 'tools', 'webhook_sender.py')], { cwd: REPO, timeout: 30000 }, function(err, stdout, stderr) {
          if (err) log('alert send FAILED: ' + (err.message || '') + ' ' + (stderr || '').trim());
          else log('alert sent: ' + (stdout || '').trim().split('\n')[0]);
        });
      } catch (e) { log('alert send error: ' + e.message); }
    } else {
      // Stale-alert lifecycle fix (2026-08-14): a healthy run must CLEAR the
      // alerts file, otherwise a resolved issue stays in the public
      // data/alerts.json + snapshot alerts array indefinitely.
      log('HEALTHY');
      try {
        fs.writeFileSync(path.join(REPO, 'tools', 'alerts.json'), JSON.stringify({ alerts: [], timestamp: new Date().toISOString(), source: 'ops-health' }, null, 2));
      } catch (e) { log('alert clear error: ' + e.message); }
    }
    return out;
  });
}

function start() {
  check().catch(function(e) { log('check error: ' + e.message); });
  setInterval(function() { check().catch(function(e) { log('check error: ' + e.message); }); }, CHECK_INTERVAL_MS);
}

if (require.main === module) { start(); }
module.exports = { check: check, start: start };
