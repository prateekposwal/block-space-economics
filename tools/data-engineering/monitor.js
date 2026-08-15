var https = require('https');
var fs = require('fs');
var path = require('path');

var ERROR_HISTORY_FILE = path.join(__dirname, '..', '..', 'captured-data', 'monitor-error-history.json');
var MAX_WINDOW = 12;

function loadErrorHistory() {
  try { return JSON.parse(fs.readFileSync(ERROR_HISTORY_FILE, 'utf8')); }
  catch (e) { return { rounds: [] }; }
}

function saveErrorHistory(history) {
  try {
    if (!fs.existsSync(path.dirname(ERROR_HISTORY_FILE))) fs.mkdirSync(path.dirname(ERROR_HISTORY_FILE), { recursive: true });
    fs.writeFileSync(ERROR_HISTORY_FILE, JSON.stringify(history, null, 2));
  } catch (e) {}
}

function getTimeoutMs(endpoint) {
  // 2026-08-02: hard fetch timeout is now decoupled from the health threshold.
  // maxLatency = healthy threshold; timeoutMs = how long we wait before aborting.
  if (endpoint.timeoutMs) return endpoint.timeoutMs;
  return (endpoint.maxLatency || 3000) + 2000;
}

function fetchEndpoint(url, timeout) {
  return new Promise(function(resolve) {
    timeout = timeout || 10000;
    try {
      var u = new URL(url);
      var opts = { hostname: u.hostname, path: u.pathname + u.search, method: 'GET', timeout: timeout, autoSelectFamily: true, headers: { 'User-Agent': 'DataEngineMonitor/1.0' } }; // autoSelectFamily (Happy Eyeballs) — 2026-08-02: network fluctuates (blockstream/blockchair/alternative.me black-hole v6; mempool.space v4 dropped intermittently). Race v4/v6, use whichever connects.
      var start = Date.now();
      var req = https.request(opts, function(res) {
        var body = '';
        res.on('data', function(c) { body += c; });
        res.on('end', function() {
          resolve({ ok: res.statusCode >= 200 && res.statusCode < 400, status: res.statusCode, latency: Date.now() - start, body: body, size: Buffer.byteLength(body, 'utf-8'), contentType: res.headers['content-type'] || '' });
        });
      });
      req.on('error', function(e) { resolve({ ok: false, status: 0, latency: Date.now() - start, size: 0, error: e.message }); });
      req.on('timeout', function() { req.destroy(); resolve({ ok: false, status: 0, latency: Date.now() - start, size: 0, error: 'timeout' }); });
      req.end();
    } catch (e) { resolve({ ok: false, status: 0, latency: 0, size: 0, error: e.message }); }
  });
}

function fetchChain(endpoint, timeout) {
  // Multi-step chain: first URL's body (trimmed) is used to substitute ':hash' in later URLs.
  // Used for raw_block_tip: tip hash → raw block (same host keeps it fast and single-tenant).
  var urls = endpoint.chain || [];
  var cur = null;
  var step = 0;
  function next() {
    if (step >= urls.length) {
      // Last step succeeded — return its result as the endpoint result.
      return Promise.resolve(cur);
    }
    var url = urls[step];
    if (step > 0 && cur && cur.body && url.indexOf(':hash') !== -1) {
      url = url.replace(':hash', cur.body.trim());
    }
    var start = Date.now();
    return fetchEndpoint(url, timeout).then(function(r) {
      if (!r.ok) { r.step = step; return r; }
      cur = r;
      step++;
      return next();
    }).catch(function(e) {
      return { ok: false, status: 0, latency: Date.now() - start, size: 0, error: 'chain:' + e.message, step: step };
    });
  }
  return next();
}

function checkEndpoint(endpoint, retriesLeft) {
  var maxLatency = endpoint.maxLatency || getTimeoutMs(endpoint);
  var timeout = getTimeoutMs(endpoint);
  var attempt = function() {
    var fetch = (endpoint.chain && endpoint.chain.length > 1) ? fetchChain(endpoint, timeout) : fetchEndpoint(endpoint.url, timeout);
    return fetch.then(function(res) {
      var ok = res.ok && res.latency <= maxLatency;
      return {
        key: endpoint.key,
        ok: ok,
        latency: res.latency,
        status: res.status,
        size: res.size,
        error: res.error || (res.ok ? null : (res.status ? ('HTTP ' + res.status) : 'unhealthy')) ,
        checkedAt: new Date().toISOString(),
        dataAge: res.ok ? 'current' : 'stale',
        step: res.step,
      };
    });
  };
  // Per-endpoint override: heavy endpoints declare retries:0 (their timeouts are already generous);
  // global default comes from CONFIG.monitoring.retries.
  if (endpoint.retries !== undefined) retriesLeft = endpoint.retries;
  else if (retriesLeft === undefined) retriesLeft = 1;
  return attempt().then(function(r) {
    if (!r.ok && retriesLeft > 0 && r.error === 'timeout') {
      // Transient-slow tolerance: retry once before recording a failure.
      return new Promise(function(resolve) { setTimeout(resolve, 1000); })
        .then(attempt)
        .then(function(r2) { if (!r2.ok) r2.retried = true; return r2; });
    }
    return r;
  });
}

function checkAllEndpoints(endpoints) {
  if (!Array.isArray(endpoints) || endpoints.length === 0) {
    return Promise.resolve({ results: {}, healthy: 0, unhealthy: 0, total: 0, timestamp: new Date().toISOString() });
  }
  var cfg = {};
  try { cfg = require('./config.js').CONFIG; } catch (e) {}
  var CONCURRENCY = (cfg && cfg.monitoring && cfg.monitoring.concurrency) || 4;
  var retries = (cfg && cfg.monitoring && cfg.monitoring.retries !== undefined) ? cfg.monitoring.retries : 1;

  // Bounded-concurrency pool: was Promise.all (13+ simultaneous) which saturated the
  // mempool.space CDN and caused whole-host timeout cascades. Now 4 at a time.
  var tasks = endpoints.map(function(ep) {
    return function() { return checkEndpoint(ep, retries).then(function(r) { return { key: ep.key, result: r }; }); };
  });
  var results = [];
  var idx = 0;
  function next() {
    if (idx >= tasks.length) return Promise.resolve();
    var task = tasks[idx++];
    return task().then(function(r) {
      results.push(r);
      return next();
    });
  }
  var runners = [];
  for (var i = 0; i < Math.min(CONCURRENCY, tasks.length); i++) runners.push(next());
  return Promise.all(runners).then(function() {
    var healthy = 0, unhealthy = 0;
    var resultsMap = {};
    results.forEach(function(item) {
      resultsMap[item.key] = item.result;
      if (item.result.ok) { healthy++; } else { unhealthy++; }
    });
    return { results: resultsMap, healthy: healthy, unhealthy: unhealthy, total: endpoints.length, timestamp: new Date().toISOString() };
  });
}

function getFreshnessReport(dataDir) {
  var report = { sources: {}, oldest: null, newest: null };
  if (!fs.existsSync(dataDir)) return report;

  // Primary: spool cursor freshness (single source of truth after M3/Top-5).
  try {
    var spool = require('./spool.js');
    return spool.init().then(function(s) { return s.stats(); }).then(function(st) {
      var now = Date.now();
      var oldestMs = Infinity, newestMs = 0;
      var spoolRoot = path.join(__dirname, '..', '..', 'captured-data', 'spool');
      var curDir = path.join(spoolRoot, 'cursors');
      var cursorFiles = [];
      if (fs.existsSync(curDir)) cursorFiles = fs.readdirSync(curDir).filter(function(f) { return f.endsWith('.json'); });
      cursorFiles.forEach(function(f) {
        var src = f.replace('.json', '');
        try {
          var cur = JSON.parse(fs.readFileSync(path.join(curDir, f), 'utf8'));
          // Retired source (agent-06 btc_rpc, 2026-08-14): a deliberately dormant
          // source's cursor never advances — its staleness is by design, not a
          // defect. Skip it so it doesn't drain the quality score / alert.
          if (cur.retired === true) return;
          var lastSeenMs = new Date(cur.lastSeen).getTime();
          var ageMinutes = Math.round((now - lastSeenMs) / 60000);
          // 2026-08-02: honor per-source cadence. Sources like node_census legitimately
          // run daily (expectedIntervalMinutes stored in the cursor); a single global
          // staleAfterMinutes made a healthy daily census look stale and cost quality
          // score points. Base threshold = global staleAfterMinutes, raised for slow
          // sources to their own expected interval + grace (census is 60*24 = daily).
          var expectedMin = cur.expectedIntervalMinutes || 0;
          var bound = require('./config.js').staleAfterMinutes();
          if (expectedMin > 0) bound = Math.max(bound, expectedMin + 60);
          var healthy = ageMinutes <= bound;
          report.sources[src] = { lastCapture: cur.lastCycleTs || null, ageMinutes: ageMinutes, healthy: healthy };
          if (lastSeenMs < oldestMs) oldestMs = lastSeenMs;
          if (lastSeenMs > newestMs) newestMs = lastSeenMs;
        } catch (e) {}
      });
      report.oldest = oldestMs === Infinity ? null : new Date(oldestMs).toISOString();
      report.newest = newestMs === 0 ? null : new Date(newestMs).toISOString();
      if (Object.keys(report.sources).length > 0) return report;
      return rootFileFreshness(dataDir, report);
    }).catch(function() { return rootFileFreshness(dataDir, report); });
  } catch (e) {
    return rootFileFreshness(dataDir, report);
  }
}

function rootFileFreshness(dataDir, report) {
  var entries;
  try { entries = fs.readdirSync(dataDir); } catch (e) { return report; }
  var sourceMap = {};
  entries.forEach(function(entry) {
    var fullPath = path.join(dataDir, entry);
    var stat;
    try { stat = fs.statSync(fullPath); } catch (e) { return; }
    if (!stat.isFile()) return;
    if (!/^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.json$/.test(entry)) return;
    var parts = entry.split('-');
    var sourceKey = parts[0] || 'unknown';
    var captureTime = stat.mtimeMs;
    if (!sourceMap[sourceKey] || captureTime > sourceMap[sourceKey].mtime) {
      sourceMap[sourceKey] = { file: entry, mtime: captureTime, mtimeDate: stat.mtime };
    }
  });
  var now = Date.now();
  var oldestMs = Infinity, newestMs = 0;
  Object.keys(sourceMap).forEach(function(key) {
    var info = sourceMap[key];
    var ageMinutes = Math.round((now - info.mtime) / 60000);
    report.sources[key] = { lastCapture: info.mtimeDate.toISOString(), ageMinutes: ageMinutes, healthy: ageMinutes <= require('./config.js').staleAfterMinutes() };
    if (info.mtime < oldestMs) { oldestMs = info.mtime; }
    if (info.mtime > newestMs) { newestMs = info.mtime; }
  });
  report.oldest = oldestMs === Infinity ? null : new Date(oldestMs).toISOString();
  report.newest = newestMs === 0 ? null : new Date(newestMs).toISOString();
  return report;
}

function getErrorReport(endpoints, round) {
  // 1 round per cycle + 12-round sliding window (stabilizes vs transient 3-round noise).
  // `round` (optional) is a precomputed checkAllEndpoints result — avoids a 2nd full
  // endpoint pass in the hourly cycle (3 passes/cycle -> 1 pass/cycle, 2026-08-02).
  var useRound = round || { results: {}, healthy: 0, unhealthy: 0, total: 0 };
  return (round ? Promise.resolve(round) : checkAllEndpoints(endpoints)).then(function(round) {
    var history = loadErrorHistory();
    var okMap = {};
    Object.keys(round.results).forEach(function(key) { okMap[key] = round.results[key].ok; });
    history.rounds.push({ at: new Date().toISOString(), ok: okMap });
    history.rounds = history.rounds.slice(-MAX_WINDOW);
    saveErrorHistory(history);

    var errorCounts = {};
    var totalErrors = 0;
    var totalChecks = 0;
    history.rounds.forEach(function(r) {
      Object.keys(r.ok).forEach(function(key) {
        totalChecks++;
        if (!r.ok[key]) {
          errorCounts[key] = (errorCounts[key] || 0) + 1;
          totalErrors++;
        }
      });
    });
    var errorRate = totalChecks > 0 ? (totalErrors / totalChecks) * 100 : 0;
    var recommendation = 'healthy';
    if (errorRate >= 20) { recommendation = 'critical'; }
    else if (errorRate >= 5) { recommendation = 'investigate'; }
    return { errors: errorCounts, totalErrors: totalErrors, errorRate: Math.round(errorRate * 100) / 100, recommendation: recommendation };
  });
}

function getDataQualityScore(precomputedHealth) {
  var endpoints = [];
  try {
    var configPath = path.join(__dirname, 'config.js');
    if (fs.existsSync(configPath)) {
      var cfg = require('./config');
      if (cfg && cfg.CONFIG && Array.isArray(cfg.CONFIG.endpoints)) {
        endpoints = cfg.CONFIG.endpoints;
      }
    }
  } catch (e) {}
  var healthPromise = precomputedHealth ? Promise.resolve(precomputedHealth) : checkAllEndpoints(endpoints);
  return healthPromise.then(function(healthResult) {
    var healthyCount = healthResult.healthy;
    var totalCount = healthResult.total;
    var dataDir = path.join(__dirname, '..', '..', 'captured-data');
    if (!fs.existsSync(dataDir)) {
      dataDir = path.join(process.cwd(), 'captured-data');
    }
    return Promise.resolve(getFreshnessReport(dataDir)).then(function(freshness) {
    var coverageScore = totalCount > 0 ? Math.round((healthyCount / totalCount) * 20) : 0;
    var freshnessScore = 0;
    var sourceKeys = Object.keys(freshness.sources);
    if (sourceKeys.length > 0) {
      var healthySources = 0;
      sourceKeys.forEach(function(k) { if (freshness.sources[k].healthy) healthySources++; });
      freshnessScore = Math.round((healthySources / sourceKeys.length) * 30);
    }
    return getErrorReport(endpoints, healthResult).then(function(errorReport) {
      var reliabilityScore = 0;
      if (errorReport.errorRate < 5) { reliabilityScore = 30; }
      else if (errorReport.errorRate < 10) { reliabilityScore = 20; }
      else if (errorReport.errorRate < 20) { reliabilityScore = 10; }
      var latencyScores = [];
      endpoints.forEach(function(ep) {
        var r = healthResult.results[ep.key];
        if (!r) return;
        // 2026-08-02: latency is scored RELATIVE to each endpoint's configured health bound
        // (maxLatency). A 19s mempool_recent with maxLatency 30s is healthy; the old fixed
        // 2s/4s buckets made every legitimately-slow endpoint score 0 even when healthy.
        var bound = ep.maxLatency || getTimeoutMs(ep);
        if (r.latency <= bound * 0.4) { latencyScores.push(20); }
        else if (r.latency <= bound) { latencyScores.push(10); }
        else { latencyScores.push(0); }
      });
      var latencyScore = latencyScores.length > 0 ? Math.round(latencyScores.reduce(function(a, b) { return a + b; }, 0) / latencyScores.length) : 0;
      var totalScore = freshnessScore + reliabilityScore + latencyScore + coverageScore;
      if (totalScore > 100) totalScore = 100;
      return {
        score: totalScore,
        components: { freshness: freshnessScore, reliability: reliabilityScore, latency: latencyScore, coverage: coverageScore },
      };
    });
    });
  });
}

module.exports = { checkAllEndpoints: checkAllEndpoints, checkEndpoint: checkEndpoint, getFreshnessReport: getFreshnessReport, getErrorReport: getErrorReport, getDataQualityScore: getDataQualityScore };
