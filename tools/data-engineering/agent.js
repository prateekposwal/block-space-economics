var fs = require('fs');
var path = require('path');
var { CONFIG } = require('./config.js');
var discover = require('./discover.js');
var integrate = require('./integrate.js');
var monitor = require('./monitor.js');
var report = require('./report.js');
var tracker = require('../../tools/agents/03-block-interval-tracker.js');
var btcRpc = require('../../tools/agents/06-bitcoin-core-rpc.js');
var digest = require('../../tools/agents/12-research-digest.js');
var publisher = require('../../tools/marketing/publisher.js');

var STATE = { lastRun: null, cycleCount: 0, discoveredSources: [], issues: [] };
var STATE_FILE = path.resolve(__dirname, '..', '..', CONFIG.agent.stateFile);

function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) STATE = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch (e) { STATE = { lastRun: null, cycleCount: 0, discoveredSources: [], issues: [] }; }
}

function saveState() {
  try {
    ensureDir(path.dirname(STATE_FILE));
    fs.writeFileSync(STATE_FILE, JSON.stringify(STATE, null, 2));
  } catch (e) { console.error('DE Agent: Failed to save state', e.message); }
}

function ensureDir(dir) { if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); }

function log(msg) {
  var ts = new Date().toISOString().replace('T', ' ').slice(0, 19);
  console.log('[DE Agent ' + ts + '] ' + msg);
}

async function runCycle() {
  var start = Date.now();
  STATE.cycleCount++;
  log('Cycle ' + STATE.cycleCount + ' started');

  // Step 1: Check all current endpoints
  log('Checking ' + CONFIG.endpoints.length + ' endpoints...');
  var health = await monitor.checkAllEndpoints(CONFIG.endpoints);
  var healthyCount = health.healthy || 0;
  var unhealthyCount = health.unhealthy || 0;
  log('Endpoints: ' + healthyCount + '/' + CONFIG.endpoints.length + ' healthy' + (unhealthyCount > 0 ? ', ' + unhealthyCount + ' unhealthy' : ''));

  // Step 2: Check data freshness
  var freshness = monitor.getFreshnessReport ? await monitor.getFreshnessReport('captured-data') : { sources: {} };
  log('Freshness checked');

  // Step 2b: M3 dual-write — envelope bridge + fate-shared capture agent (one shared spool)
  try {
    var spoolMod = require('./spool.js');
    var spool = await spoolMod.init();
    if (CONFIG.capture.bridge) {
      var spoolBridge = require('./spool-bridge.js');
      var ingestResult = await spoolBridge.ingestOnce(spool);
      log('Spool: scanned=' + ingestResult.scanned + ' new=' + ingestResult.newFiles +
          ' ingested=' + ingestResult.ingested + ' validated=' + ingestResult.validated +
          ' violated=' + ingestResult.violated + ' failed=' + ingestResult.failed.length);
    }
    if (CONFIG.capture.mirror) {
      var capAgent = require('./capture-agent.js').createCaptureAgent(
        { spool: spool, endpoints: CONFIG.endpoints, config: CONFIG.capture });
      var capResult = await capAgent.runCycle();
      log('Capture-agent: cycle=' + capResult.cycleTs + ' captured=' + capResult.captured +
          ' skipped=' + capResult.skipped + ' violated=' + capResult.violated + ' errored=' + capResult.errored);
    }
  } catch (e) { log('Step 2b error: ' + e.message); }

  // Step 3: Check Bitcoin Core node (if running)
  try {
    var btcResult = await btcRpc.run();
    if (btcResult.ok) {
      var bp = btcResult.blockchain;
      log('Bitcoin Core: ' + bp.blocks + ' blocks, ' + btcResult.blocks.length + ' fee stats, ' + btcResult.peerCount + ' peers');
      if (btcResult.blocks.length > 0) {
        var latest = btcResult.blocks[0];
        if (latest.feePercentiles && latest.feePercentiles.length === 5) {
          log('  Fee percentiles (p10/p25/p50/p75/p90): ' + latest.feePercentiles.map(function(v) { return (v / 1000).toFixed(1); }).join('/') + ' sat/vB');
        }
      }
    }
  } catch (e) { log('Bitcoin Core: offline (' + e.message + ')'); }

  // Step 4: Run block interval tracker
  try {
    var blockMetrics = tracker.track ? await tracker.track() : null;
    if (blockMetrics) {
      log('Block intervals: ' + (blockMetrics.blocks ? blockMetrics.blocks.avgInterval + 's avg' : 'N/A'));
    }
  } catch (e) { log('Tracker error: ' + e.message); }

  // Step 4a: Run derived-metrics agent (05) — fills the 01-12 numbering gap
  try {
    var derived = require('../../tools/agents/05-derived-metrics.js');
    await derived.run();
    log('Derived metrics: computed + enqueued');
  } catch (e) { log('Derived metrics error: ' + e.message); }

  // Step 4c: Node geo distribution (11) — daily (time-based, robust to restarts).
  try {
    var _d = new Date();
    var _day = _d.toISOString().slice(0, 10);
    if (STATE.lastNodeGeoDay !== _day) {
      var nodeGeo = require('../../tools/agents/11-node-geo.js');
      await nodeGeo.run();
      STATE.lastNodeGeoDay = _day;
      log('Node geo: distribution refreshed');
    }
  } catch (e) { log('Node geo error: ' + e.message); }

  // Step 4d: Node census (25) — real getnodeaddresses count; daily.
  // Time-based gate (not cycle-count): runs once per calendar day, robust to
  // DE-server restarts that reset cycleCount and previously skipped days.
  try {
    var _now = new Date();
    var _today = _now.toISOString().slice(0, 10);
    if (STATE.lastNodeCensusDay !== _today) {
      var nodeCensus = require('../../tools/agents/25-node-census.js');
      var census = await nodeCensus.run();
      STATE.lastNodeCensusDay = _today;
      log('Node census: ' + (census.totalKnownAddresses || 0) + ' known addresses');
    }
  } catch (e) { log('Node census error: ' + e.message); }

  // Step 4e: BIP-110 signaling capture (26) — EVERY cycle while the mandatory
  // window is live (blocks 961632-963647, lock-in <= 963648). One-time natural
  // experiment; capture stops mattering after lock-in. Expected interval 60 min.
  try {
    var bip110 = require('../../tools/agents/26-bip110-signal.js');
    var bip = await bip110.run();
    log('BIP-110: height=' + bip.height + ' signaling=' + (bip.signalingSharePct || 0) + '% bit4 (window=' + (bip.window ? bip.window.inWindow : 'n/a') + ')');
  } catch (e) { log('BIP-110 capture error: ' + e.message); }

  // Step 4f: Research runner (5 fetcher agents) — daily (time-based, robust).
  try {
    var _r = new Date();
    var _rd = _r.toISOString().slice(0, 10);
    if (STATE.lastResearchDay !== _rd) {
      var researchRunner = require('../../tools/research/runner.js');
      await researchRunner.runCycle();
      STATE.lastResearchDay = _rd;
      log('Research runner: 5 fetcher agents cycled');
    }
  } catch (e) { log('Research runner error: ' + e.message); }

  // Step 4b: Research content pipeline (14) + topic intelligence (15)
  try {
    var rc = require('../../tools/agents/14-research-content-pipeline.js');
    await rc.run();
    log('Research content pipeline: briefs generated');
  } catch (e) { log('Research content pipeline error: ' + e.message); }
  try {
    var ti = require('../../tools/agents/15-topic-intelligence.js');
    await ti.run();
    log('Topic intelligence: refreshed');
  } catch (e) { log('Topic intelligence error: ' + e.message); }

  // Step 4: Get quality score
  var quality = { score: 0 };
  try {
    quality = monitor.getDataQualityScore ? await monitor.getDataQualityScore(health) : { score: 0 }; // single-pass: reuse step-1 health round (2026-08-02)
  } catch (e) { quality = { score: 0 }; }
  log('Data quality score: ' + (quality.score || 'N/A') + '/100');

  // Step 4: Every 24 hours, run discovery
  var doDiscovery = STATE.cycleCount === 1 || (STATE.lastRun && (Date.now() - STATE.lastRun) > CONFIG.discovery.searchIntervalHours * 3600000);
  if (doDiscovery && CONFIG.discovery.enabled) {
    log('Running API discovery...');
    try {
      var newSources = await discover.searchForNewSources();
      if (newSources && newSources.length > 0) {
        var unknown = discover.findNewEndpoints(CONFIG.endpoints);
        if (unknown && unknown.length > 0) {
          log('Found ' + unknown.length + ' new potential sources');
          STATE.discoveredSources = unknown;
          for (var i = 0; i < unknown.length && i < CONFIG.discovery.maxNewSources; i++) {
            var src = unknown[i];
            // S3/flagged: belt-and-suspenders gate — only high-confidence api sources stage.
            if (!(src.confidence >= 0.7) || src.type !== 'api') {
              log('  SKIP (not stageable): ' + (src.name || src.url) + ' type=' + src.type + ' conf=' + src.confidence);
              continue;
            }
            var endpoint = { key: src.key || src.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, ''), url: src.url, name: src.name, type: src.type, category: src.category || 'discovered' };
            log('  Testing: ' + endpoint.name + ' (' + endpoint.url + ')');
            var testResult = await integrate.testEndpoint(endpoint);
            if (testResult.ok) {
              var staged = integrate.stageEndpoint(endpoint);
              log('  Staged for review: ' + (staged || endpoint.key));
            }
          }
        } else {
          log('No new sources found');
        }
      }
    } catch (e) { log('Discovery error: ' + e.message); }
  }

  // Step 5: Check for issues
  STATE.issues = [];
  if (unhealthyCount > 0) STATE.issues.push(unhealthyCount + ' endpoints unhealthy');
  if (quality.score < 60) STATE.issues.push('Data quality score below 60 (' + quality.score + ')');
  if (freshness && freshness.sources) {
    var staleCount = 0;
    var staleThreshold = require('./config.js').staleAfterMinutes();
    for (var k in freshness.sources) {
      if (freshness.sources[k] && freshness.sources[k].ageMinutes > staleThreshold) staleCount++;
    }
    if (staleCount > 0) STATE.issues.push(staleCount + ' sources stale (>' + staleThreshold + 'min old)');
  }

  // Step 6: Generate reports
  if (STATE.cycleCount % 4 === 0 || STATE.issues.length > 0) {
    log('Generating reports...');
    try {
      var dailyReport = await report.generateDailyReport();
      if (dailyReport) {
        await report.reportToTelos(dailyReport);
        await report.reportToArchitect(dailyReport);
        log('Reports saved');
      }
      // Session continuity: auto-append AGENTS.md handoff + decision-log trace
      try {
        report.appendSessionHandoff({ state: STATE });
        log('Session handoff appended to AGENTS.md');
      } catch (e) { log('Session handoff error: ' + e.message); }
      // Research report (17) + publishing queue (18)
      try {
        var rg = require('../../tools/agents/17-report-generator.js');
        await rg.run();
        var pq = require('../../tools/agents/18-publishing-queue.js');
        await pq.run();
        log('Research report + publishing queue generated');
      } catch (e) { log('Research report/publishing-queue error: ' + e.message); }
      // Generate research digest every 4 cycles (daily at 60min cycle)
      if (STATE.cycleCount % 4 === 0) {
        try {
          log('Generating research digest...');
          digest.saveDigest();
          log('Digest saved to reports/digest/reddit-' + new Date().toISOString().slice(0, 10) + '.md');
        } catch (e) { log('Digest error: ' + e.message); }
      } else {
        try {
          // M8: staleness guard — regenerate if digest older than 30h
          var digestDir = path.resolve(__dirname, '..', '..', 'reports', 'digest');
          if (fs.existsSync(digestDir)) {
            var newest = null;
            fs.readdirSync(digestDir).forEach(function(f) {
              var fp = path.join(digestDir, f);
              var st = fs.statSync(fp);
              if (!newest || st.mtimeMs > newest.mtimeMs) newest = { mtimeMs: st.mtimeMs, file: f };
            });
            if (newest && (Date.now() - newest.mtimeMs) > 30 * 3600 * 1000) {
              log('Digest stale (>30h) — regenerating');
              digest.saveDigest();
            }
          }
        } catch (e) { log('Digest staleness check error: ' + e.message); }
      }
    } catch (e) { log('Report error: ' + e.message); }
  }

  // Step 7: Run Nostr publisher (every cycle = hourly) — Browser engine
  // (Chrome browser post engine) removed 2026-08-29; Nostr-only path retained.
  try {
    var pubStart = Date.now();
    var pubResult = await publisher.runCycle();
    var pubElapsed = Math.round((Date.now() - pubStart) / 1000);
    log('Publisher: ' + pubResult.length + ' posts in ' + pubElapsed + 's');
    publisher.generateRSSFeed();
    publisher.generateReport();
  } catch (e) { log('Publisher error: ' + e.message); }

  // Step 7b: Drain spool into SQLite + run spool-backed forecast and alerts
  try {
    var consumer = require('./spool-consumer.js');
    var cResult = await consumer.drainAll();
    log('Consumer: drained spool into SQLite');
  } catch (e) { log('Consumer error: ' + e.message); }
  try {
    var spoolMod2 = require('./spool.js');
    var spool2 = await spoolMod2.init();
    var st = await spool2.stats();
    if (STATE.cycleCount % 24 === 0 || st.queueBytes > 5 * 1024 * 1024) {
      var comp = await spool2.compact();
      log('Compaction: removed=' + comp.removed + ' kept=' + comp.kept);
    }
    // M4 gate recorder: accumulate consecutive clean cycles post-monitor-fix.
    // Gate scope = CORE capture path (CONFIG.endpoints keys). Aux agent sources
    // (block_interval, btc_rpc, derived_metrics, research_findings) are derived/
    // agent-generated and are not part of the legacy-bridge capture path.
    var qualityNow = quality && quality.score ? quality.score : 0;
    var coreKeys = CONFIG.endpoints.map(function(e) { return e.key; });
    var coreStale = (st.staleSources || []).filter(function(s) { return coreKeys.indexOf(s) !== -1; });
    var corePending = 0;
    coreKeys.forEach(function(k) {
      if (st.perSource[k]) corePending += st.perSource[k].pending || 0;
    });
    var clean = st.accountingOk && corePending === 0 && coreStale.length === 0 && st.totals.dead === 0 && qualityNow >= 80;
    STATE.m4 = STATE.m4 || { cleanCycles: 0, lastGateCheck: null, bridgeFlipped: false };
    if (clean) {
      STATE.m4.cleanCycles = (STATE.m4.cleanCycles || 0) + 1;
    } else {
      STATE.m4.cleanCycles = 0;
    }
    STATE.m4.lastGateCheck = new Date().toISOString();
    log('M4 gate: cleanCycles=' + STATE.m4.cleanCycles + '/7 (bridge=' + (CONFIG.capture.bridge ? 'on' : 'off') + ', quality=' + qualityNow + ', coreStale=[' + coreStale.join(',') + '])');
    if (STATE.m4.cleanCycles >= 7 && CONFIG.capture.bridge && !STATE.m4.bridgeFlipped) {
      CONFIG.capture.bridge = false;
      STATE.m4.bridgeFlipped = true;
      STATE.m4.bridgeDisabledAt = new Date().toISOString();
      var flipLine = 'M4 COMPLETE: bridge disabled at ' + STATE.m4.bridgeDisabledAt + ' after ' + STATE.m4.cleanCycles + ' clean cycles';
      log('==============================================');
      log(flipLine);
      log('==============================================');
      STATE.m4Event = { type: 'M4_COMPLETE', at: STATE.m4.bridgeDisabledAt, cleanCycles: STATE.m4.cleanCycles };
      try { report.appendSessionHandoff({ state: STATE, m4Event: STATE.m4Event, force: true }); }
      catch (e) { log('Handoff on M4 flip failed: ' + e.message); }
      try {
        var archFile = path.join(__dirname, '..', '..', 'reports', 'architect', 'DE-' + new Date().toISOString().slice(0, 10) + '.md');
        fs.appendFileSync(archFile, '\n\n## M4 COMPLETE\n- ' + flipLine + '\n');
      } catch (e) { log('Architect append on M4 flip failed: ' + e.message); }
    }
    saveState();
  } catch (e) { log('Compaction error: ' + e.message); }
  try {
    var alertDispatcher = require('../../tools/agents/13-alert-dispatcher.js');
    await alertDispatcher.run();
    log('Alert dispatcher: forecast + alerts + index self-heal');
  } catch (e) { log('Alert dispatcher error: ' + e.message); }

  STATE.lastRun = Date.now();
  saveState();
  var elapsed = Math.round((Date.now() - start) / 1000);
  log('Cycle ' + STATE.cycleCount + ' complete in ' + elapsed + 's');

  if (STATE.issues.length > 0) {
    log('ISSUES: ' + STATE.issues.join(' | '));
  }
}

function start() {
  log('Starting — ' + CONFIG.agent.name);
  log('Cycle interval: ' + CONFIG.agent.cycleMinutes + ' minutes');
  log('Endpoints: ' + CONFIG.endpoints.length);
  ensureDir(path.resolve(__dirname, '..', '..', 'reports', 'data-engineering'));
  ensureDir(path.resolve(__dirname, '..', '..', 'reports', 'architect'));
  ensureDir(path.dirname(STATE_FILE));
  loadState();

  // M4 durability: config.js is a hardcoded module, so the in-memory flip would
  // evaporate on restart (and bridgeFlipped=true would block any re-flip).
  // Re-apply the persisted flip from state so the migration stays complete.
  if (STATE.m4 && STATE.m4.bridgeFlipped) {
    CONFIG.capture.bridge = false;
    log('M4: bridge remains disabled (persisted flip from ' + STATE.m4.bridgeDisabledAt + ')');
  }

  runCycle().catch(function(e) { log('Cycle error: ' + e.message); });
  setInterval(function() {
    runCycle().catch(function(e) { log('Cycle error: ' + e.message); });
  }, CONFIG.agent.cycleMinutes * 60 * 1000);
}

if (require.main === module) {
  start();
}

module.exports = { start: start, runCycle: runCycle, getState: function() { return STATE; } };
