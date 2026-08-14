#!/usr/bin/env node
// BSAHI — GitHub Actions Research Data Producer (Mac-Independence Phase 1 + 2)
// Regenerates the research-tier public mirrors from PUBLIC APIs ONLY (no spool,
// no local DB, no Core RPC) so the research tier survives the local Mac being
// off. Runs on a GH runner every 30 min via .github/workflows/research-data.yml.
//
// Files produced (same shapes the pages consume — see each builder):
//   data/bip110.json               — live bit-4 signaling window snapshot
//   data/bip110_daily.json         — daily observed bit-4 signaling share
//   data/hashrate.json             — currentHashrate history (EH/s)
//   data/block_interval.json       — rolling 10-block interval (avg/min/max)
//   data/mempool_fee_histogram.json— latest mempool fee-RATE histogram
//   data/fee_history_blocks.json   — per-block avg fees + USD (last 144 blocks)
//   data/adoption.json             — SegWit/Taproot/Legacy usage + honest TPS
//   data/sccr*.json + the frozen   — SCCR (Phase 2; run via `--only sccr`):
//     capture                       refreshes research/reproduce/input/
//                                   fee_history_capture.json from the public 24h
//                                   fee endpoint, then runs
//                                   tools/research/sccr_live.py --frozen
//                                   (360-min staleness gate = daily cadence)
//
// `--only <name>[,name...]` runs a subset of targets (the workflow's SCCR step
// uses `--only sccr`); the default no-arg invocation is the Phase-1 target set.
//
// Staleness gate (two-writer solution): the GH writer is the CANONICAL writer
// for these files (the local agent no longer writes them). Before fetching,
// each target's freshness timestamp (observedAt / generated_at) is compared to
// its threshold — if the committed file is fresher than the threshold the
// source is SKIPPED (no fetch, no write, no churn). A non-200 / network error
// never writes: the last good committed version is left in place and the
// failure is logged (the staleness gate surfaces it on the next run).
//
// Same writeOnChange pattern as 19-web-snapshot-agent.js / generate_viz_data.js
// (sha1 compare to avoid churn).
var path = require('path');
var https = require('https');
var fs = require('fs');
var { exec } = require('child_process');

var REPO = path.resolve(__dirname, '..');
var DATA_DIR = path.join(REPO, 'data');

var MAX_WEIGHT_WU = 4000000;   // consensus block weight limit
var THEORETICAL_MAX_TPS = 7.0; // documented reference only — never rendered as measured

/* ── tiny helpers ────────────────────────────────────────────────────────── */
function loadJson(p, fb) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return fb; } }
function sha1(s) { return require('crypto').createHash('sha1').update(s).digest('hex'); }

function writeOnChange(name, data, dir) {
  // dir is optional — defaults to DATA_DIR. Phase 2 uses it to write the SCCR
  // frozen capture + provenance meta into research/reproduce/input/ (same
  // sha1-compare, no-churn behavior as the data/ mirrors).
  var d = dir || DATA_DIR;
  fs.mkdirSync(d, { recursive: true });
  var p = path.join(d, name);
  var blob = JSON.stringify(data, null, 2) + '\n';
  var changed = true;
  if (fs.existsSync(p)) {
    try { changed = sha1(fs.readFileSync(p, 'utf8')) !== sha1(blob); } catch (e) {}
  }
  if (changed) fs.writeFileSync(p, blob);
  return changed;
}

/* fetchUrl(url, timeoutMs) → Promise<{status, data, fetchedAt}>
 * Same contract as the capture agent's helper: data = parsed JSON when the
 * body is JSON, else the RAW text body (the blockstream tip-hash hop returns
 * a bare hex string). Required by collectBlockAdoption in
 * tools/data-engineering/block-adoption-collect.js. */
function fetchUrl(url, timeoutMs) {
  return new Promise(function(resolve) {
    var u = new URL(url);
    var req = https.request({
      hostname: u.hostname, path: u.pathname + u.search, method: 'GET',
      timeout: timeoutMs || 30000,
      headers: { 'User-Agent': 'BitcoinSahi/1.0' }
    }, function(res) {
      var body = '';
      var fetchedAt = new Date().toISOString();
      res.on('data', function(c) { body += c; });
      res.on('end', function() {
        try { resolve({ status: res.statusCode, data: JSON.parse(body), fetchedAt: fetchedAt }); }
        catch (e) { resolve({ status: res.statusCode, data: body, fetchedAt: fetchedAt }); }
      });
    });
    req.on('error', function(e) { resolve({ status: 0, error: e.message, fetchedAt: new Date().toISOString() }); });
    req.on('timeout', function() { req.destroy(); resolve({ status: 0, error: 'timeout', fetchedAt: new Date().toISOString() }); });
    req.end();
  });
}

/* getJson — fetchUrl + require HTTP 200 + JSON body. */
function getJson(url, timeoutMs) {
  return fetchUrl(url, timeoutMs).then(function(r) {
    if (r.status !== 200) throw new Error('HTTP ' + r.status + ' for ' + url);
    if (typeof r.data !== 'object' || r.data === null) throw new Error('non-JSON body for ' + url);
    return r.data;
  });
}

/* freshness — age in minutes of a committed file's timestamp field.
 * Missing file / missing field / unparseable date → Infinity (stale). */
function freshAgeMin(p, field) {
  var d = loadJson(p, null);
  if (!d || !d[field]) return Infinity;
  var ts = Date.parse(d[field]);
  if (isNaN(ts)) return Infinity;
  return (Date.now() - ts) / 60000;
}

function round2(x) { return Math.round(x * 100) / 100; }

/* ── 1. BIP-110 live window + daily aggregation ──────────────────────────── */
var WINDOW_START = 961632;
var WINDOW_END = 963647;
var LOCK_IN = 963648;

function decodeBit4(version) { return Boolean(version & (1 << 4)); }

/* mergeDaily — exact monotone-union merge of the committed daily aggregation
 * with the live block sample.
 *
 * Invariant (proved in code comments): the committed bip110.json carries
 *   .height  = the highest height observed by the previous writer (local
 *              spool-era agent OR the previous GH run), and
 *   .daily[] = today.blocks/signaling = the EXACT distinct-height count of
 *              every observation so far (deduped by height; a block's version
 *              is immutable, so "signaling at a height" is permanent).
 * Because tips are monotone, every live height > committed.height is NEW (never
 * counted before) and every live height <= committed.height is already in the
 * committed counts. So the merge adds exactly the live heights above the
 * committed tip — no double-count, no loss, no fabricated heights. This holds
 * across GH restarts and even after a multi-day Mac outage (the catch-up is
 * exact). */
function mergeDaily(liveBlocks, observedAt, committedBip110, committedDailyFile) {
  var today = observedAt.slice(0, 10);
  var committedDaily = null;
  var committedHeight = null;
  if (committedDailyFile && Array.isArray(committedDailyFile.daily)) committedDaily = committedDailyFile.daily;
  if (committedBip110 && Array.isArray(committedBip110.daily)) committedDaily = committedDaily || committedBip110.daily;
  if (committedBip110 && typeof committedBip110.height === 'number') committedHeight = committedBip110.height;
  if (!committedDaily) committedDaily = [];

  var byDay = {};
  committedDaily.forEach(function(d) {
    // preserve the committed pct for past (complete) days — the chart renders p.pct
    if (d && d.day && d.day <= today) byDay[d.day] = { day: d.day, blocks: d.blocks, signaling: d.signaling, pct: d.pct };
  });

  var todayEntry = byDay[today] || { day: today, blocks: 0, signaling: 0 };
  var liveHeights = {};
  liveBlocks.forEach(function(b) {
    if (!b || typeof b.height !== 'number' || liveHeights[b.height]) return;
    liveHeights[b.height] = !!b.bit4;
  });

  if (committedHeight === null) {
    // No committed baseline (first ever run) — the live sample IS today's observation.
    var lc = Object.keys(liveHeights).length;
    var ls = 0;
    Object.keys(liveHeights).forEach(function(h) { if (liveHeights[h]) ls++; });
    todayEntry.blocks = Math.max(todayEntry.blocks || 0, lc);
    todayEntry.signaling = Math.max(todayEntry.signaling || 0, ls);
  } else {
    Object.keys(liveHeights).forEach(function(h) {
      if (Number(h) > committedHeight) {
        todayEntry.blocks++;
        if (liveHeights[h]) todayEntry.signaling++;
      }
    });
  }
  todayEntry.pct = todayEntry.blocks ? Math.round(todayEntry.signaling / todayEntry.blocks * 1000) / 10 : 0;
  byDay[today] = todayEntry;

  return Object.keys(byDay).sort().map(function(d) {
    var e = byDay[d];
    if (typeof e.pct !== 'number') e.pct = e.blocks ? Math.round(e.signaling / e.blocks * 1000) / 10 : 0;
    return e;
  });
}

function buildBip110() {
  return getJson('https://mempool.space/api/blocks?limit=10', 30000).then(function(blocks) {
    if (!Array.isArray(blocks) || !blocks.length) throw new Error('no blocks from mempool.space');
    var observedAt = new Date().toISOString();
    var height = blocks[0].height;
    var inWindow = height >= WINDOW_START && height <= WINDOW_END;
    var passedLockIn = height >= LOCK_IN;
    var out = {
      ok: true,
      height: height,
      window: { start: WINDOW_START, end: WINDOW_END, lockIn: LOCK_IN, inWindow: inWindow, passedLockIn: passedLockIn,
                blocksUntilLockIn: Math.max(0, LOCK_IN - height) },
      signaling: [],
      windowTotal: 0,
      windowSignaling: 0,
      observedAt: observedAt,
      signalingSharePct: 0
    };
    blocks.forEach(function(b) {
      var bit4 = decodeBit4(b.version);
      out.signaling.push({ height: b.height, version: b.version, versionHex: '0x' + b.version.toString(16).padStart(8, '0'), bit4: bit4 });
      out.windowTotal++;
      if (bit4) out.windowSignaling++;
    });
    out.signalingSharePct = out.windowTotal ? Math.round(out.windowSignaling / out.windowTotal * 1000) / 10 : 0;

    var committedBip110 = loadJson(path.join(DATA_DIR, 'bip110.json'), null);
    var committedDaily = loadJson(path.join(DATA_DIR, 'bip110_daily.json'), null);
    var daily = mergeDaily(blocks, observedAt, committedBip110, committedDaily);

    out.daily = daily;
    out.thresholdPct = 55;
    out.source = 'GitHub Actions (public API mempool.space /api/blocks?limit=10)';

    var dailyMirror = {
      schema_version: 1,
      generated_at: observedAt,
      source: 'GitHub Actions (public API mempool.space /api/blocks?limit=10)',
      thresholdPct: 55,
      note: 'Observed bit-4 signaling share per day from live block samples (deduped by height; heights are permanent, so the daily union is exact across runs). BIP-110 lock-in requires 55% within a 2016-block period. Produced by GitHub Actions — survives the local Mac being off.',
      daily: daily
    };
    return { files: [{ name: 'bip110.json', data: out }, { name: 'bip110_daily.json', data: dailyMirror }], detail: 'height=' + height + ' signaling=' + out.signalingSharePct + '%' };
  });
}

/* ── 2. Hashrate history ─────────────────────────────────────────────────── */
function buildHashrate() {
  return getJson('https://mempool.space/api/v1/mining/hashrate/24h', 45000).then(function(data) {
    if (typeof data.currentHashrate !== 'number') throw new Error('hashrate: currentHashrate missing');
    var committed = loadJson(path.join(DATA_DIR, 'hashrate.json'), null);
    var points = (committed && Array.isArray(committed.points)) ? committed.points.slice() : [];
    points.push({ t: new Date().toISOString(), eh: round2(data.currentHashrate / 1e18) });
    points = points.slice(-240);
    return {
      files: [{ name: 'hashrate.json', data: {
        schema_version: 1,
        generated_at: new Date().toISOString(),
        source: 'GitHub Actions (public API mempool.space /api/v1/mining/hashrate/24h)',
        unit: 'EH/s',
        note: 'Instantaneous network hashrate (currentHashrate) captured by GitHub Actions (public API), converted H/s → EH/s.',
        points: points
      } }],
      detail: 'currentHashrate=' + round2(data.currentHashrate / 1e18) + ' EH/s'
    };
  });
}

/* ── 3. Rolling block interval ───────────────────────────────────────────── */
function buildBlockInterval() {
  return getJson('https://mempool.space/api/blocks?limit=5', 30000).then(function(blocks) {
    if (!Array.isArray(blocks) || blocks.length < 2) throw new Error('block_interval: need >=2 blocks');
    var intervals = [];
    for (var i = 0; i < blocks.length - 1; i++) {
      var iv = blocks[i].timestamp - blocks[i + 1].timestamp;
      if (iv > 0) intervals.push(iv);
    }
    if (!intervals.length) throw new Error('block_interval: no positive intervals');
    var avg = intervals.reduce(function(a, b) { return a + b; }, 0) / intervals.length;
    var min = Math.min.apply(null, intervals);
    var max = Math.max.apply(null, intervals);
    var committed = loadJson(path.join(DATA_DIR, 'block_interval.json'), null);
    var points = (committed && Array.isArray(committed.points)) ? committed.points.slice() : [];
    points.push({ t: new Date().toISOString(), avg: Math.round(avg * 100) / 100, min: min, max: max });
    points = points.slice(-96);
    return {
      files: [{ name: 'block_interval.json', data: {
        schema_version: 1,
        generated_at: new Date().toISOString(),
        source: 'GitHub Actions (public API mempool.space /api/blocks?limit=5)',
        unit: 'seconds',
        note: 'Rolling 10-block interval window per capture: avg / min / max. Captured by GitHub Actions (public API) every ~60 min.',
        points: points
      } }],
      detail: 'avg=' + Math.round(avg * 100) / 100 + 's'
    };
  });
}

/* ── 4. Mempool fee histogram (latest) ───────────────────────────────────── */
function buildMempoolHist() {
  return getJson('https://mempool.space/api/mempool', 30000).then(function(data) {
    if (!Array.isArray(data.fee_histogram)) throw new Error('mempool: fee_histogram missing');
    var now = new Date().toISOString();
    return {
      files: [{ name: 'mempool_fee_histogram.json', data: {
        schema_version: 1,
        generated_at: now,
        source: 'GitHub Actions (public API mempool.space /api/mempool)',
        capturedAt: now,
        unit: 'fee rate sat/vB → vsize',
        note: 'Fee-RATE histogram of the mempool (vsize per fee-rate bucket). This is NOT a transaction-age histogram — age data is not captured by the pipeline. Fetched live by GitHub Actions.',
        count: data.count || 0,
        vsize: data.vsize || 0,
        histogram: data.fee_histogram.map(function(h) {
          return { rate: Math.round(h[0] * 100000) / 100000, vsize: h[1] };
        })
      } }],
      detail: 'count=' + (data.count || 0)
    };
  });
}

/* ── 5. Per-block fee history (avgFees + USD, last 144 blocks) ───────────── */
function buildFeeHistoryBlocks() {
  return getJson('https://mempool.space/api/v1/mining/blocks/fees/24h', 45000).then(function(rows) {
    if (!Array.isArray(rows) || !rows.length) throw new Error('fee_history: empty 24h series');
    var byHeight = {};
    rows.forEach(function(b) {
      if (!b || typeof b.avgHeight !== 'number') return;
      byHeight[b.avgHeight] = {
        h: b.avgHeight,
        t: b.timestamp,
        avgFees: typeof b.avgFees === 'number' ? b.avgFees : null,
        usd: typeof b.USD === 'number' ? b.USD : null
      };
    });
    var blocks = Object.keys(byHeight).map(function(k) { return byHeight[k]; })
      .sort(function(a, b) { return a.t - b.t; })
      .slice(-144);
    return {
      files: [{ name: 'fee_history_blocks.json', data: {
        schema_version: 1,
        generated_at: new Date().toISOString(),
        source: 'GitHub Actions (public API mempool.space /api/v1/mining/blocks/fees/24h)',
        unit: 'avgFees in sats per block, usd in $ per BTC',
        note: 'Per-block average fees (sats) and BTC price at capture, last 144 blocks (~24h). Deduped by block height. Fetched live from mempool.space by GitHub Actions.',
        blocks: blocks
      } }],
      detail: blocks.length + ' blocks (tip h=' + blocks[blocks.length - 1].h + ')'
    };
  });
}

/* ── 6. SegWit / Taproot / Legacy adoption ───────────────────────────────── */
// Reuses the REAL collector (tools/data-engineering/block-adoption-collect.js):
// blockstream tip → mempool.space block summaries (extras.segwitTotalTxs is
// authoritative) → /txids → uniformly-sampled per-tx spend classification.
// Public APIs only — the same logic the local capture agent runs.
// Taproot subsamples ACCUMULATE across GH runs in _state.bySample (each run's
// sample is a different seeded uniform draw of the tip block, so summing them
// grows coverage exactly like the local spool accumulation did).
var collectMod = require('./data-engineering/block-adoption-collect.js');

function buildAdoption() {
  return collectMod.collectBlockAdoption(fetchUrl, 30000).then(function(capture) {
    if (!capture || capture.status !== 200) throw new Error('adoption capture failed: ' + ((capture && capture.error) || 'status ' + (capture && capture.status)));
    var data = capture.data;
    if (!data || !Array.isArray(data.blocks) || !data.blocks.length) throw new Error('adoption: no blocks walked');

    var byHeight = {};
    data.blocks.forEach(function(b) {
      if (!b || typeof b.height !== 'number') return;
      byHeight[b.height] = { h: b.height, ts: b.timestamp, tx: b.tx_count, weight: b.weight, segwit: b.segwitTotalTxs };
    });

    var committed = loadJson(path.join(DATA_DIR, 'adoption.json'), null);
    var bySample = {};
    if (committed && committed._state && committed._state.bySample) {
      Object.keys(committed._state.bySample).forEach(function(k) { bySample[k] = committed._state.bySample[k]; });
    }
    var smp = data.taprootSample;
    var tipH = data.tipHeight;
    if (smp && typeof smp.txsSampled === 'number' && smp.txsSampled > 0 && tipH != null) {
      if (!bySample[tipH]) bySample[tipH] = { height: tipH, txs: 0, nonCoinbase: 0, taproot: 0, segwit: 0, legacy: 0, unclassified: 0, captures: 0 };
      var agg = bySample[tipH];
      agg.txs += smp.txsSampled; agg.nonCoinbase += smp.nonCoinbase;
      agg.taproot += smp.taprootSpends; agg.segwit += smp.segwitSpends;
      agg.legacy += smp.legacySpends; agg.unclassified += smp.unclassified;
      agg.captures++;
    }

    // Latest window: up to 24 distinct blocks (oldest -> newest) — the fresh walk gives tip+9.
    var heights = Object.keys(byHeight).map(Number).sort(function(a, b) { return b - a; }).slice(0, 24).reverse();
    var blocks = heights.map(function(h) { return byHeight[h]; });

    var txSum = 0, weightSum = 0, segwitSum = 0;
    blocks.forEach(function(b) { txSum += b.tx || 0; weightSum += b.weight || 0; segwitSum += (typeof b.segwit === 'number') ? b.segwit : 0; });

    var intervals = [];
    for (var i = 1; i < blocks.length; i++) {
      var dt = (blocks[i].ts || 0) - (blocks[i - 1].ts || 0);
      if (dt > 0) intervals.push(dt);
    }
    var avgInterval = intervals.length ? intervals.reduce(function(a, b) { return a + b; }, 0) / intervals.length : 600;

    var segwitPct = txSum > 0 && segwitSum >= 0 ? Math.round(segwitSum / txSum * 1000) / 10 : null;
    var legacyPct = segwitPct !== null ? Math.round((100 - segwitPct) * 10) / 10 : null;

    var tTaproot = 0, tNonCb = 0, rounds = 0;
    Object.keys(bySample).forEach(function(h) { var a = bySample[h]; tTaproot += a.taproot; tNonCb += a.nonCoinbase; rounds += a.captures; });
    var taprootPct = tNonCb > 0 ? Math.round(tTaproot / tNonCb * 1000) / 10 : null;
    if (taprootPct !== null && segwitPct !== null && taprootPct > segwitPct) taprootPct = segwitPct;

    var effectiveTps = avgInterval > 0 && blocks.length > 0 ? Math.round(txSum / (blocks.length * avgInterval) * 100) / 100 : null;
    var weightUtil = blocks.length ? Math.round(weightSum / blocks.length / MAX_WEIGHT_WU * 10000) / 100 : null;
    var newestTs = capture.fetchedAt || new Date().toISOString();

    return {
      files: [{ name: 'adoption.json', data: {
        schema_version: 1,
        generated_at: newestTs,
        source: 'GitHub Actions (public API: blockstream.info tip + mempool.space /api/v1/block/:hash, /api/block/:hash/txids, /api/tx/:txid)',
        available: true,
        date: newestTs.slice(0, 10),
        note: 'SegWit share = extras.segwitTotalTxs / tx_count (authoritative, mempool.space block summary). Legacy = 100 - SegWit. Taproot = share of uniformly-sampled spends with a v1_p2tr (P2TR) input (' + tNonCb + ' sampled non-coinbase txs, ' + rounds + ' GH capture rounds, aggregated across runs; labeled sampled, not exhaustive; P2SH-wrapped segwit counts as legacy). Effective TPS = total tx / (N blocks x avg block interval) from real blocks — NOT an invented constant; theoretical max 7 TPS kept only as a reference. Weight utilization = avg block weight / 4M WU. Produced by GitHub Actions — survives the local Mac being off.',
        blocks_sampled: blocks.length,
        heights: heights,
        tx_count: txSum,
        segwit_pct: segwitPct,
        taproot_pct: taprootPct,
        taproot_sample_size: tNonCb,
        legacy_pct: legacyPct,
        weight_utilization_pct: weightUtil,
        avg_block_interval_s: Math.round(avgInterval * 100) / 100,
        effective_tps: effectiveTps,
        theoretical_max_tps: THEORETICAL_MAX_TPS,
        per_block: blocks.map(function(b) { return { h: b.h, tx: b.tx, weight: b.weight, segwit_txs: b.segwit }; }),
        _state: { bySample: bySample }
      } }],
      detail: 'blocks=' + blocks.length + ' segwit=' + segwitPct + '% taproot=' + taprootPct + '% (sample=' + tNonCb + ')'
    };
  });
}

/* ── 7. SCCR (Storage Cost Coverage Ratio) — Mac-Independence Phase 2 ────── */
// SCCR was the last Mac-bound research metric (sccr_live.py read the LOCAL
// SQLite DB). GH now owns it. The public 24h fee endpoint returns per-block
// {avgHeight, timestamp, avgFees, USD} — the EXACT schema of the frozen
// reproducibility capture — so this builder:
//   (1) refreshes research/reproduce/input/fee_history_capture.json (the frozen
//       capture; bare-array schema preserved — a wrapper object would break the
//       Array.isArray guards in the C/JS/Python reproduce consumers, so refresh
//       provenance goes to a sibling .meta file instead),
//   (2) runs tools/research/sccr_live.py --frozen (the canonical writer) to
//       produce data/sccr.json + sccr_latest.json + sccr_history.json in the
//       same shapes live mode writes.
// Runs via `--only sccr` (workflow step, 360-min staleness gate = daily).
function runPython(script, args) {
  return new Promise(function (resolve, reject) {
    var cmd = 'python3 ' + [script].concat(args).map(function (a) { return "'" + a + "'"; }).join(' ');
    exec(cmd, { cwd: REPO, timeout: 60000 }, function (err, so, se) {
      if (err) reject(new Error(((se || '').trim() || (so || '').trim() || err.message).slice(0, 300)));
      else resolve(so);
    });
  });
}

async function buildSccr() {
  var FROZEN_DIR = path.join(REPO, 'research', 'reproduce', 'input');
  var rows = await getJson('https://mempool.space/api/v1/mining/blocks/fees/24h', 45000);
  if (!Array.isArray(rows) || rows.length < 100) throw new Error('sccr: need >=100 blocks from 24h series, got ' + (Array.isArray(rows) ? rows.length : typeof rows));
  var byHeight = {};
  rows.forEach(function (b) {
    if (!b || typeof b.avgHeight !== 'number' || typeof b.timestamp !== 'number') return;
    byHeight[b.avgHeight] = {
      avgHeight: b.avgHeight,
      timestamp: b.timestamp,           // unix seconds — the endpoint provides it per block
      avgFees: typeof b.avgFees === 'number' ? b.avgFees : null,
      USD: typeof b.USD === 'number' ? b.USD : null
    };
  });
  // Degenerate rows (avgFees <= 0 — e.g. a zero-fee block) are dropped so the
  // frozen file matches what compute() actually uses (`if not fee_sats: continue`
  // in sccr_live.py / reproduce.py). The original freeze had no such rows; keeping
  // them would make the C reproduction implementation (which counts every avgFees
  // it finds, including 0 → ratio 0) disagree with JS/Python.
  var blocks = Object.keys(byHeight).map(function (k) { return byHeight[k]; })
    .filter(function (b) { return b.avgFees > 0; })                 // degenerate rows (avgFees<=0) dropped
    .sort(function (a, b) { return a.avgHeight - b.avgHeight; });   // ascending, deduped by height
  if (blocks.length < 100) throw new Error('sccr: only ' + blocks.length + ' usable blocks in 24h series');

  var now = new Date().toISOString();
  var firstH = blocks[0].avgHeight, lastH = blocks[blocks.length - 1].avgHeight;
  var frozenChanged = writeOnChange('fee_history_capture.json', blocks, FROZEN_DIR);
  var metaChanged = writeOnChange('fee_history_capture.meta.json', {
    schema: 'bsahi.fee-history-capture-meta/1',
    file: 'research/reproduce/input/fee_history_capture.json',
    generated_at: now,
    source: 'GitHub Actions (public API mempool.space /api/v1/mining/blocks/fees/24h) via tools/generate_research_data.js buildSccr',
    count: blocks.length,
    first_height: firstH,
    last_height: lastH,
    note: 'The capture file itself stays a bare array of {avgHeight, timestamp, avgFees, USD} so the C/JS/Python reproduce consumers keep parsing it unchanged; this meta file carries the refresh provenance the bare-array schema cannot.'
  }, FROZEN_DIR);

  // Canonical writer — frozen mode computes from the refreshed capture and
  // writes data/sccr.json + data/sccr_latest.json + data/sccr_history.json
  // (identical output shape/notes to live mode — same code path, same notes
  // string; only the capture source differs).
  await runPython(path.join(REPO, 'tools', 'research', 'sccr_live.py'), ['--frozen']);

  var files = ['sccr.json', 'sccr_latest.json', 'sccr_history.json'].map(function (f) {
    return { name: f, data: loadJson(path.join(DATA_DIR, f), null) };
  });
  if (!files[0].data) throw new Error('sccr_live.py --frozen produced no data/sccr.json');
  return {
    files: files,
    detail: 'frozen ' + blocks.length + ' blocks h' + firstH + '→h' + lastH +
            ' (capture ' + (frozenChanged ? 'wrote' : 'unchanged') + ', meta ' + (metaChanged ? 'wrote' : 'unchanged') +
            ') → sccr_live.py --frozen → avg_sccr=' + files[0].data.avg_sccr
  };
}

/* ── staleness gate + run ────────────────────────────────────────────────── */
// Thresholds: bip110* is a live event (30 min); hashrate / block_interval /
// mempool_hist / fee_history_blocks 60 min; adoption 120 min.
var TARGETS = [
  { name: 'bip110.json', tsField: 'observedAt', thresholdMin: 30, builder: buildBip110, pairs: ['bip110_daily.json'] },
  { name: 'hashrate.json', tsField: 'generated_at', thresholdMin: 60, builder: buildHashrate },
  { name: 'block_interval.json', tsField: 'generated_at', thresholdMin: 60, builder: buildBlockInterval },
  { name: 'mempool_fee_histogram.json', tsField: 'generated_at', thresholdMin: 60, builder: buildMempoolHist },
  { name: 'fee_history_blocks.json', tsField: 'generated_at', thresholdMin: 60, builder: buildFeeHistoryBlocks },
  { name: 'adoption.json', tsField: 'generated_at', thresholdMin: 120, builder: buildAdoption }
];

// SCCR (Phase 2) — kept OUT of the default run on purpose: the workflow runs it
// as its own explicit step (`--only sccr`) after the research-data step, so its
// freshness/commit cadence is visible and a Phase-1 target failure cannot mask
// it (and vice versa). SCCR is a DAILY metric: 360-min gate (refresh at most
// every 6h) instead of the 30-min schedule the workflow ticks on.
var SCCR_TARGET = { name: 'sccr.json', tsField: 'generated_at', thresholdMin: 360, builder: buildSccr, pairs: ['sccr_latest.json', 'sccr_history.json'] };
var ALL_TARGETS = TARGETS.concat([SCCR_TARGET]);

function pad(s, n) { s = String(s); while (s.length < n) s += ' '; return s; }

async function run() {
  var results = [];
  var stats = { wrote: 0, unchanged: 0, skipped: 0, failed: 0 };
  // --only <name>[,name...]: subset filter (matches target file names or their
  // stem, e.g. `--only sccr` or `--only sccr.json`). Absent → the Phase-1
  // target set (TARGETS); SCCR is opt-in via --only by design.
  var only = [];
  var av = process.argv.slice(2);
  for (var a = 0; a < av.length; a++) {
    if (av[a] === '--only' && av[a + 1]) only = av[a + 1].split(',').map(function (x) { return x.trim(); }).filter(Boolean);
  }
  var targets = only.length
    ? ALL_TARGETS.filter(function (t) { return only.indexOf(t.name) !== -1 || only.indexOf(t.name.replace(/\.json$/, '')) !== -1; })
    : TARGETS;
  for (var i = 0; i < targets.length; i++) {
    var t = targets[i];
    var p = path.join(DATA_DIR, t.name);
    var age = freshAgeMin(p, t.tsField);
    if (age < t.thresholdMin) {
      results.push({ name: t.name, status: 'skip', detail: 'fresh ' + Math.round(age) + 'm < ' + t.thresholdMin + 'm' });
      stats.skipped++;
      (t.pairs || []).forEach(function(pair) {
        results.push({ name: pair, status: 'skip', detail: 'paired with ' + t.name + ' (fresh)' });
        stats.skipped++;
      });
      continue;
    }
    try {
      var out = await t.builder();
      out.files.forEach(function(f) {
        var changed = writeOnChange(f.name, f.data);
        results.push({ name: f.name, status: changed ? 'wrote' : 'unchanged', detail: out.detail || '' });
        if (changed) stats.wrote++; else stats.unchanged++;
      });
      // paired files (bip110_daily.json) — mark as handled by the paired builder
      (t.pairs || []).forEach(function(pair) {
        if (results.filter(function(r) { return r.name === pair; }).length === 0) {
          results.push({ name: pair, status: 'skip', detail: 'paired with ' + t.name + ' (fresh)' });
          stats.skipped++;
        }
      });
    } catch (e) {
      results.push({ name: t.name, status: 'failed', detail: (e && e.message) || String(e) });
      stats.failed++;
      console.error('research-data: ' + t.name + ' FAILED — ' + ((e && e.message) || e) + ' (committed version preserved; staleness gate will retry)');
    }
  }
  console.log('── research-data run ───────────────────────────────────────');
  results.forEach(function(r) {
    console.log('  [' + pad(r.status, 9) + '] ' + r.name + (r.detail ? ' — ' + r.detail : ''));
  });
  console.log('  wrote=' + stats.wrote + ' unchanged=' + stats.unchanged + ' skipped(fresh)=' + stats.skipped + ' failed=' + stats.failed);
  return results;
}

if (require.main === module) {
  run().then(function() { process.exit(0); }).catch(function(e) { console.error('research-data fatal:', e); process.exit(1); });
}

module.exports = { run: run, writeOnChange: writeOnChange, mergeDaily: mergeDaily, decodeBit4: decodeBit4, fetchUrl: fetchUrl, buildSccr: buildSccr, TARGETS: TARGETS, SCCR_TARGET: SCCR_TARGET };
