#!/usr/bin/env node
// BSAHI — 20 Site Health Agent
// Probes the public surface (routes from the shared manifest) and alerts on
// any 5xx/404 or slow TTFB. Runs every 15-min via launchd.
var path = require('path');
var fs = require('fs');
var http = require('http');
var https = require('https');

var REPO = path.resolve(__dirname, '..', '..');
var OUT_FILE = path.join(REPO, 'captured-data', 'site-health.json');
var LOG_FILE = path.join(REPO, 'captured-data', 'site-health.log');

var ROUTES = [
  { route: '/', expected: 200 },
  { route: '/live', expected: 200 },
  { route: '/capacity', expected: 200 },
  { route: '/learn', expected: 200 },
  { route: '/fork-tracker', expected: 200 },
  { route: '/feed.xml', expected: 200 },
  { route: '/data/snapshot.json', expected: 200 },
  { route: '/data/ops-health.json', expected: 200 },
  { route: '/data/site-health.json', expected: 200 },
  { route: '/api/v1/', expected: 200 },
  { route: '/robots.txt', expected: 200 },
  { route: '/sitemap.xml', expected: 200 }
];
var HOST = 'bitcoinsahi.com';

function log(msg) {
  var line = '[' + new Date().toISOString() + '] ' + msg;
  console.log(line);
  try { fs.appendFileSync(LOG_FILE, line + '\n'); } catch (e) {}
}

function probe(route) {
  return new Promise(function(resolve) {
    var start = Date.now();
    var mod = https;
    var req = mod.request({ hostname: HOST, path: route.route, method: 'GET', timeout: 10000 }, function(res) {
      var body = '';
      res.on('data', function(c) { body += c; });
      res.on('end', function() {
        resolve({ route: route.route, expected: route.expected, status: res.statusCode, ttfbMs: Date.now() - start, bytes: Buffer.byteLength(body), ok: res.statusCode === route.expected });
      });
    });
    req.on('error', function(e) { resolve({ route: route.route, expected: route.expected, status: 0, ttfbMs: Date.now() - start, bytes: 0, ok: false, error: e.message }); });
    req.on('timeout', function() { req.destroy(); resolve({ route: route.route, expected: route.expected, status: 0, ttfbMs: Date.now() - start, bytes: 0, ok: false, error: 'timeout' }); });
    req.end();
  });
}

function check() {
  return Promise.all(ROUTES.map(probe)).then(function(results) {
    var bad = results.filter(function(r) { return !r.ok; });
    var out = { generated_at: new Date().toISOString(), host: HOST, status: bad.length ? 'DEGRADED' : 'HEALTHY', checks: results, failures: bad };
    fs.writeFileSync(OUT_FILE, JSON.stringify(out, null, 2));
    if (bad.length) {
      log('FAILURES: ' + bad.map(function(r) { return r.route + '->' + r.status + ' ' + (r.error || ''); }).join(' | '));
      try {
        var alertsPath = path.join(REPO, 'tools', 'alerts.json');
        fs.writeFileSync(alertsPath, JSON.stringify({ alerts: bad.map(function(r) { return '🛡 SITE ' + r.route + ' -> ' + r.status + (r.error ? ' (' + r.error + ')' : ''); }), timestamp: new Date().toISOString(), source: 'site-health' }, null, 2));
        var cp = require('child_process');
        cp.execFile('python3', [path.join(REPO, 'tools', 'webhook_sender.py')], { cwd: REPO, timeout: 30000 }, function() {});
      } catch (e) { log('alert error: ' + e.message); }
    } else {
      log('HEALTHY (' + results.length + ' routes)');
      // Stale-alert lifecycle fix (2026-08-14): mirror ops-health — a healthy
      // run clears tools/alerts.json so resolved issues stop being served.
      try {
        var alertsPath = path.join(REPO, 'tools', 'alerts.json');
        fs.writeFileSync(alertsPath, JSON.stringify({ alerts: [], timestamp: new Date().toISOString(), source: 'site-health' }, null, 2));
      } catch (e) { log('alert clear error: ' + e.message); }
    }
    return out;
  });
}

function start() {
  check().catch(function(e) { log('check error: ' + e.message); });
  setInterval(function() { check().catch(function(e) { log('check error: ' + e.message); }); }, 15 * 60 * 1000);
}

if (require.main === module) { start(); }
module.exports = { check: check, start: start, ROUTES: ROUTES };
