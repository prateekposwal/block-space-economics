var https = require('https');
var fs = require('fs');
var path = require('path');

var validateMod = require('./validate-capture.js');

function localTsString(d) {
  d = d || new Date();
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0') + '_' +
    String(d.getHours()).padStart(2, '0') + '-' +
    String(d.getMinutes()).padStart(2, '0') + '-' +
    String(d.getSeconds()).padStart(2, '0');
}


function chainFetch(ep, cfg) {
  // Chained capture: first URL's trimmed body substitutes ':hash' in subsequent URLs.
  var urls = ep.chain || [];
  var chainCfg = { timeoutMs: ep.timeoutMs || cfg.timeoutMs || 30000 };
  var cur = null;
  var firstBody = null; // first hop's body = the :hash substitution source (keep it, cur gets overwritten)
  var step = 0;
  function one(url) {
    return new Promise(function(resolve) {
      var u = new URL(url);
      var req = https.request({
        hostname: u.hostname, path: u.pathname + u.search, method: 'GET',
        timeout: chainCfg.timeoutMs, autoSelectFamily: true, headers: { 'User-Agent': 'BitcoinSahi/1.0' }
      }, function(res) {
        var body = '';
        var fetchedAt = new Date().toISOString();
        res.on('data', function(c) { body += c; });
        res.on('end', function() {
          resolve({ status: res.statusCode, data: body, rawBody: body, fetchedAt: fetchedAt });
        });
      });
      req.on('error', function(e) { resolve({ status: 0, error: e.message, fetchedAt: new Date().toISOString() }); });
      req.on('timeout', function() { req.destroy(); resolve({ status: 0, error: 'timeout', fetchedAt: new Date().toISOString() }); });
      req.end();
    });
  }
  function next() {
    if (step >= urls.length) return Promise.resolve(cur);
    var url = urls[step];
    if (step > 0 && cur && cur.rawBody && url.indexOf(':hash') !== -1) {
      url = url.replace(':hash', cur.rawBody.trim());
    }
    return one(url).then(function(r) {
      if (r.status === 0 || r.status >= 400) { r.step = step; return r; }
      cur = r;
      if (step === 0) firstBody = r.rawBody; // tip hash hop
      step++;
      return next();
    });
  }
  return next().then(function(r) {
    if (r && r.step !== undefined && r.status === 0) return r; // failed mid-chain
    // Final step: shape a capture object for the raw-block source.
    var hash = firstBody && /^[0-9a-f]{64}$/i.test(firstBody.trim()) ? firstBody.trim() : null;
    if (hash === null) return { status: 0, error: 'chain: invalid tip hash', fetchedAt: new Date().toISOString() };
    var rawHex = (cur && typeof cur.rawBody === 'string') ? cur.rawBody.trim() : '';
    if (!rawHex) return { status: 0, error: 'chain: empty raw block', fetchedAt: new Date().toISOString() };
    return { status: 200, data: { blockHash: hash, rawHex: rawHex, size: rawHex.length / 2, fetchedAt: cur.fetchedAt }, fetchedAt: cur.fetchedAt };
  });
}

function defaultFetch(ep, cfg) {
  if (ep.chain && ep.chain.length > 1) {
    return chainFetch(ep, cfg);
  }
  if (typeof ep.collect === 'function') {
    // Multi-request collector endpoint (block_adoption): a function that
    // composes several sequential fetches (with polite delays) into one
    // capture record. Kept out of the chain path because the walk is not a
    // linear :hash substitution — it walks previousblockhash and samples
    // per-tx script types.
    try {
      var c = ep.collect(fetchUrl, ep.timeoutMs || cfg.timeoutMs);
      if (c && typeof c.then === 'function') return c;
      return Promise.resolve({ status: 0, error: 'collect did not return a promise', fetchedAt: new Date().toISOString() });
    } catch (e) {
      return Promise.resolve({ status: 0, error: 'collect threw: ' + e.message, fetchedAt: new Date().toISOString() });
    }
  }
  return fetchUrl(ep.url, cfg.timeoutMs).then(function(res) {
    if (res.status !== 0 && res.status < 400) return res;
    // Primary failed — try fallbacks (single point of failure protection for the
    // mempool.space core series; added 2026-08-02).
    if (Array.isArray(ep.fallbacks) && ep.fallbacks.length) {
      var fbs = ep.fallbacks.slice();
      var attempt = function() {
        if (!fbs.length) return res;
        var fb = fbs.shift();
        return fetchUrl(fb.url, fb.timeoutMs || cfg.timeoutMs).then(function(r) {
          if (r.status === 0 || r.status >= 400) return attempt();
          if (typeof fb.adapt === 'function') {
            try {
              var adapted = fb.adapt(r.data);
              return { status: 200, data: adapted, fetchedAt: r.fetchedAt, source: fb.label || 'fallback' };
            } catch (e) {
              return attempt();
            }
          }
          return { status: r.status, data: r.data, fetchedAt: r.fetchedAt, source: fb.label || 'fallback' };
        });
      };
      return attempt();
    }
    return res;
  });
}

function fetchUrl(url, timeoutMs) {
  return new Promise(function(resolve) {
    var u = new URL(url);
    var req = https.request({
      hostname: u.hostname,
      path: u.pathname + u.search,
      method: 'GET',
      timeout: timeoutMs,
      autoSelectFamily: true, // 2026-08-02: Happy Eyeballs — race v4/v6; network fluctuates per-host
      headers: { 'User-Agent': 'BitcoinSahi/1.0' }
    }, function(res) {
      var body = '';
      var fetchedAt = new Date().toISOString();
      res.on('data', function(c) { body += c; });
      res.on('end', function() {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body), fetchedAt: fetchedAt });
        } catch (e) {
          resolve({ status: res.statusCode, data: body, fetchedAt: fetchedAt });
        }
      });
    });
    req.on('error', function(e) {
      resolve({ status: 0, error: e.message, fetchedAt: new Date().toISOString() });
    });
    req.on('timeout', function() {
      req.destroy();
      resolve({ status: 0, error: 'timeout', fetchedAt: new Date().toISOString() });
    });
    req.end();
  });
}

function createCaptureAgent(opts) {
  var spool = opts.spool;
  var endpoints = opts.endpoints || [];
  var fetch = opts.fetch || function(ep) { return defaultFetch(ep, cfg); };
  var validate = opts.validate || validateMod;
  var cfg = opts.config || {};
  var mirrorDir = opts.mirrorDir || path.join(__dirname, '..', '..', 'captured-data');
  var now = opts.now || function() { return new Date(); };
  var logger = opts.logger || function() {};

  var baseMs = (cfg.baseIntervalMinutes || 60) * 60 * 1000;
  var degradedMul = cfg.degradedMultiplier || 2;
  var recoveryMul = cfg.recoveryMultiplier || 1.5;
  var recoveryCycles = cfg.recoveryCycles || 2;
  var maxMissed = cfg.maxMissedCycles || 3;

  var state = {
    running: false,
    tasks: {},
    lastCycleTs: null,
    combined: {},
    summary: null
  };

  function defaultCfg() {
    return {
      baseIntervalMinutes: cfg.baseIntervalMinutes || 60,
      timeoutMs: cfg.timeoutMs || 15000,
      degradedMultiplier: degradedMul,
      recoveryMultiplier: recoveryMul,
      recoveryCycles: recoveryCycles,
      maxMissedCycles: maxMissed
    };
  }

  function cleanTmpFiles() {
    if (!fs.existsSync(mirrorDir)) return;
    fs.readdirSync(mirrorDir).forEach(function(f) {
      if (f.indexOf('.tmp-') === 0) {
        try { fs.unlinkSync(path.join(mirrorDir, f)); } catch (e) {}
      }
    });
  }

  function computeBackoff(degraded, recoveryCountdown) {
    var delay = baseMs;
    if (degraded) delay = delay * degradedMul;
    if (recoveryCountdown > 0) delay = delay * recoveryMul;
    return delay;
  }

  function ensureTask(ep) {
    var source = ep.key;
    if (state.tasks[source]) return state.tasks[source];
    if (!validate.registry || !validate.registry.get(source)) {
      if (!validate.registry) validate.registry = require('./schemas/registry.js');
      if (!validate.registry.get(source)) {
        logger('capture-agent: no schema for source ' + source + ' — refusing to fetch');
        state.tasks[source] = { source: source, ep: ep, refused: true };
        return state.tasks[source];
      }
    }
    var task = {
      source: source,
      ep: ep,
      cursor: null,
      nextRunAt: now().getTime(),
      inFlight: false,
      consecutiveFails: 0,
      recoveryCountdown: 0,
      missedCycles: 0,
      expectedIntervalMinutes: cfg.baseIntervalMinutes || 60
    };
    state.tasks[source] = task;
    spool.cursor(source).then(function(cur) {
      task.cursor = cur;
      if (cur && cur.lastSeen) {
        var ageMs = now().getTime() - new Date(cur.lastSeen).getTime();
        if (ageMs <= baseMs * 1.5) {
          task.nextRunAt = now().getTime() + baseMs;
          return;
        }
        task.missedCycles = Math.min(Math.floor(ageMs / baseMs), maxMissed);
        task.nextRunAt = now().getTime();
        logger('capture-agent: ' + source + ' stale (' + Math.floor(ageMs / 60000) + 'min) — immediate catch-up');
      }
    });
    return task;
  }

  function writeMirror(cycleTs, source, capture) {
    if (!state.combined[cycleTs]) {
      state.combined[cycleTs] = { captureTime: now().toISOString(), endpoints: {} };
    }
    var combined = state.combined[cycleTs];
    combined.endpoints[source] = capture;
    if (capture.error) {
      if (!combined.errors) combined.errors = [];
      combined.errors.push(source + ': ' + capture.error);
    }
    var tmpFile = path.join(mirrorDir, '.tmp-' + cycleTs + '.json');
    var finalFile = path.join(mirrorDir, cycleTs + '.json');
    fs.writeFileSync(tmpFile, JSON.stringify(combined, null, 2));
    fs.renameSync(tmpFile, finalFile);
  }

  function handleResult(task, cycleTs, capture) {
    var source = task.source;
    writeMirror(cycleTs, source, capture);
    var wr = validate.wrapAndValidate(source, capture, {
      cycleTs: cycleTs,
      producer: 'capture-agent',
      producerVersion: '1.0.0'
    });
    if (!wr.ok) {
      task.consecutiveFails++;
      task.recoveryCountdown = 0;
      return validate.quarantine(spool, wr.payload, wr.reasons)
        .then(function() {
          validate.logViolation(source, cycleTs, wr.reasons, 'capture-agent', null);
          return spool.updateCursor(source, cycleTs, new Error('schemaViolation: ' + wr.reasons.join('; ')), { advance: false, missedCycles: task.missedCycles + 1, expectedIntervalMinutes: task.expectedIntervalMinutes });
        })
        .then(function() { return { status: 'violated', source: source }; });
    }
    if (capture.status === 0 || capture.error !== undefined) {
      // Kintsugi capture-failure pattern (matches agent-06 btc_rpc precedent,
      // 2026-08-14): a FAILED fetch is telemetry, not data. It must NOT be
      // enqueued into the spool — that path writes status=0 rows into the
      // `captures` data table, which ops-health then misread as a "DB error
      // ratio" (a 24h rolling outage inflates it even after recovery). The
      // failure is durably recorded in the mirror file (writeMirror above) and
      // the spool cursor (lastError / missedCycles / status degraded).
      task.consecutiveFails++;
      task.recoveryCountdown = 0;
      return spool.updateCursor(source, cycleTs, new Error(capture.error || 'fetch failed'), { advance: false, missedCycles: task.missedCycles + 1, expectedIntervalMinutes: task.expectedIntervalMinutes })
        .then(function() { return { status: 'errored', source: source }; });
    }
    var wasDegraded = task.consecutiveFails > 0;
    task.consecutiveFails = 0;
    if (wasDegraded) task.recoveryCountdown = recoveryCycles;
    return spool.enqueue(source, wr.payload, { captureTime: cycleTs, day: cycleTs.slice(0, 10), producer: 'capture-agent' })
      .then(function() {
        task.missedCycles = 0;
        return spool.updateCursor(source, cycleTs, null, { expectedIntervalMinutes: task.expectedIntervalMinutes });
      })
      .then(function() { return { status: 'captured', source: source }; });
  }

  function runCycle() {
    if (state.running) return Promise.resolve({ skipped: true });
    state.running = true;
    cleanTmpFiles();
    var cycleTs = localTsString(now());
    state.lastCycleTs = cycleTs;

    var tasks = [];
    endpoints.forEach(function(ep) {
      tasks.push(ensureTask(ep));
    });

    var active = tasks.filter(function(t) { return !t.refused; });

    var results = {
      cycleTs: cycleTs,
      total: active.length,
      captured: 0,
      skipped: 0,
      inFlight: 0,
      violated: 0,
      quarantined: 0,
      errored: 0,
      duplicates: 0,
      refused: tasks.filter(function(t) { return t.refused; }).length
    };

    var ops = active.map(function(task) {
      if (now().getTime() < task.nextRunAt) { results.skipped++; return Promise.resolve({ status: 'skipped', source: task.source }); }
      if (task.inFlight) { results.inFlight++; return Promise.resolve({ status: 'inFlight', source: task.source }); }
      task.inFlight = true;
      return fetch(task.ep).then(function(capture) {
        return handleResult(task, cycleTs, capture);
      }).then(function(r) {
        results[r.status] = (results[r.status] || 0) + 1;
        var degraded = task.consecutiveFails > 0;
        // S3b: stamp the ACTUAL schedule into the cursor — degraded interval is 2x.
        var currentInterval = cfg.baseIntervalMinutes || 60;
        if (degraded) currentInterval = currentInterval * degradedMul;
        task.expectedIntervalMinutes = currentInterval;
        task.nextRunAt = now().getTime() + computeBackoff(degraded, task.recoveryCountdown);
        if (task.recoveryCountdown > 0) task.recoveryCountdown--;
        return r;
      }).finally(function() {
        task.inFlight = false;
      });
    });

    return Promise.all(ops).then(function() {
      state.summary = results;
      state.running = false;
      delete state.combined[cycleTs];
      return results;
    });
  }

  function start() {
    runCycle().then(function() {});
    var interval = setInterval(function() {
      runCycle().then(function() {});
    }, baseMs);
    state._interval = interval;
    return state;
  }

  function stop() {
    if (state._interval) { clearInterval(state._interval); state._interval = null; }
    state.running = false;
    return state;
  }

  return { start: start, stop: stop, runCycle: runCycle, state: state };
}

module.exports = { createCaptureAgent: createCaptureAgent, localTsString: localTsString, defaultFetch: defaultFetch };
