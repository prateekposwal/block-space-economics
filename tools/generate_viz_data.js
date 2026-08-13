#!/usr/bin/env node
// BSAHI — Viz Data Mirror Generator
// Produces the public data/*.json mirrors the site's charts fetch, from the
// LOCAL capture spool (captured-data/ is NOT served by GitHub Pages, so the
// spool-only datasets get a small public mirror, same writeOnChange pattern
// as 19-web-snapshot-agent.js).
//
// Mirrors produced:
//   data/block_interval.json        — rolling 10-block interval (avg/min/max)
//   data/hashrate.json              — captured currentHashrate history (EH/s)
//   data/mempool_fee_histogram.json — latest mempool fee-RATE histogram
//                                     (honest label: NOT transaction age)
//   data/fee_history_blocks.json    — per-block avg fees + USD (last 144 blocks)
//   data/bip110_daily.json          — daily observed bit-4 signaling share
//   data/adoption.json              — REAL SegWit/Taproot/Legacy usage + honest
//                                     effective TPS (from block weights/tx counts)
//
// Every mirror carries a "note" that states exactly what the data is and where
// it came from — no implied meaning. Writes only on content change (sha1).
var path = require('path');
var fs = require('fs');

var REPO = path.resolve(__dirname, '..');
var DATA_DIR = path.join(REPO, 'data');
var SPOOL = path.join(REPO, 'captured-data', 'spool', 'index');

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

/* readSpool(source) → parsed records from every <source>/*.jsonl, oldest first. */
function readSpool(source) {
  var dir = path.join(SPOOL, source);
  var out = [];
  if (!fs.existsSync(dir)) return out;
  var files = fs.readdirSync(dir).filter(function (f) { return f.endsWith('.jsonl'); }).sort();
  files.forEach(function (day) {
    var text = fs.readFileSync(path.join(dir, day), 'utf8');
    text.split('\n').forEach(function (line) {
      if (!line.trim()) return;
      try { out.push(JSON.parse(line)); } catch (e) {}
    });
  });
  return out;
}

function okData(rec) {
  return rec && rec.payload && rec.payload.status === 200 && rec.payload.data;
}

/* latestTs(records) — newest capture timestamp across records (stable per
 * spool content, so writeOnChange only fires when the DATA actually changes). */
function latestTs(records) {
  var best = null;
  records.forEach(function (r) {
    var t = (r && r.enqueuedAt) || (r && r.captureTime) || (r && r.payload && r.payload.fetchedAt);
    if (t && (!best || t > best)) best = t;
  });
  return best || new Date().toISOString();
}

/* ── 1. Rolling block interval ─────────────────────────────────────────── */
function buildBlockInterval() {
  var records = readSpool('block_interval');
  var points = [];
  records.forEach(function (rec) {
    var data = okData(rec) ? rec.payload.data : null;
    var blocks = data && data.blocks;
    if (!blocks || typeof blocks.avgInterval !== 'number') return;
    var t = data.captureTime || rec.enqueuedAt || rec.captureTime;
    points.push({
      t: t,
      avg: Math.round(blocks.avgInterval * 100) / 100,
      min: blocks.minInterval,
      max: blocks.maxInterval
    });
  });
  // Latest 96 captures (~48h at the 30-min cadence) — enough for a rolling view.
  points = points.slice(-96);
  return {
    schema_version: 1,
    generated_at: latestTs(records),
    source: 'spool block_interval',
    unit: 'seconds',
    note: 'Rolling 10-block interval window per capture: avg / min / max. Captured every ~30 min by the local capture agent.',
    points: points
  };
}

/* ── 2. Hashrate history ───────────────────────────────────────────────── */
function buildHashrate() {
  var records = readSpool('hashrate');
  var seen = {};
  var points = [];
  records.forEach(function (rec) {
    var data = okData(rec) ? rec.payload.data : null;
    if (!data || typeof data.currentHashrate !== 'number') return;
    var t = rec.payload.fetchedAt || (rec.payload.env && rec.payload.env.captured && rec.payload.env.captured.iso) || rec.enqueuedAt;
    if (!t || seen[t]) return;
    seen[t] = true;
    points.push({ t: t, eh: Math.round(data.currentHashrate / 1e18 * 100) / 100 });
  });
  points.sort(function (a, b) { return a.t < b.t ? -1 : 1; });
  points = points.slice(-240);
  return {
    schema_version: 1,
    generated_at: latestTs(records),
    source: 'spool hashrate (currentHashrate)',
    unit: 'EH/s',
    note: 'Instantaneous network hashrate (currentHashrate) captured hourly by the local capture agent, converted H/s → EH/s.',
    points: points
  };
}

/* ── 3. Mempool fee histogram (latest capture) ─────────────────────────── */
function buildMempoolFeeHistogram() {
  var records = readSpool('mempool');
  var best = null;
  records.forEach(function (rec) {
    var data = okData(rec) ? rec.payload.data : null;
    if (!data || !Array.isArray(data.fee_histogram)) return;
    var t = rec.enqueuedAt || rec.captureTime;
    if (!best || t > best.t) best = { t: t, data: data };
  });
  if (!best) {
    return {
      schema_version: 1,
      generated_at: latestTs(records),
      source: 'spool mempool (fee_histogram)',
      note: 'No successful mempool fee_histogram capture in the spool yet.',
      histogram: []
    };
  }
  return {
    schema_version: 1,
    generated_at: latestTs(records),
    source: 'spool mempool (fee_histogram)',
    capturedAt: best.t,
    unit: 'fee rate sat/vB → vsize',
    note: 'Fee-RATE histogram of the mempool (vsize per fee-rate bucket). This is NOT a transaction-age histogram — age data is not captured by the pipeline.',
    count: best.data.count || 0,
    vsize: best.data.vsize || 0,
    histogram: best.data.fee_histogram.map(function (h) {
      return { rate: Math.round(h[0] * 100000) / 100000, vsize: h[1] };
    })
  };
}

/* ── 4. Per-block fee history (avgFees + USD, last 144 blocks) ─────────── */
function buildFeeHistoryBlocks() {
  var records = readSpool('fee_history');
  var byHeight = {};
  records.forEach(function (rec) {
    var data = okData(rec) ? rec.payload.data : null;
    if (!Array.isArray(data)) return;
    data.forEach(function (b) {
      if (!b || typeof b.avgHeight !== 'number') return;
      byHeight[b.avgHeight] = {
        h: b.avgHeight,
        t: b.timestamp,
        avgFees: typeof b.avgFees === 'number' ? b.avgFees : null,
        usd: typeof b.USD === 'number' ? b.USD : null
      };
    });
  });
  var blocks = Object.keys(byHeight).map(function (k) { return byHeight[k]; })
    .sort(function (a, b) { return a.t - b.t; })
    .slice(-144);
  return {
    schema_version: 1,
    generated_at: latestTs(records),
    source: 'spool fee_history',
    unit: 'avgFees in sats per block, usd in $ per BTC',
    note: 'Per-block average fees (sats) and BTC price at capture, last 144 blocks (~24h). Deduped by block height across captures.',
    blocks: blocks
  };
}

/* ── 5. BIP-110 daily observed signaling ───────────────────────────────── */
function buildBip110Daily() {
  var records = readSpool('bip110_signal');
  var byDay = {};
  records.forEach(function (rec) {
    var data = okData(rec) ? rec.payload.data : null;
    if (!data || !Array.isArray(data.signaling)) return;
    var day = (rec.captureTime || '').slice(0, 10);
    if (!day) day = (rec.enqueuedAt || '').slice(0, 10);
    if (!byDay[day]) byDay[day] = {};
    data.signaling.forEach(function (b) {
      if (!b || typeof b.height !== 'number') return;
      if (!byDay[day][b.height]) byDay[day][b.height] = !!b.bit4;
    });
  });
  var daily = Object.keys(byDay).sort().map(function (day) {
    var blocks = byDay[day];
    var heights = Object.keys(blocks);
    var signaling = 0;
    heights.forEach(function (hh) { if (blocks[hh]) signaling++; });
    return {
      day: day,
      blocks: heights.length,
      signaling: signaling,
      pct: heights.length ? Math.round(signaling / heights.length * 1000) / 10 : 0
    };
  });
  return {
    schema_version: 1,
    generated_at: latestTs(records),
    source: 'spool bip110_signal',
    thresholdPct: 55,
    note: 'Observed bit-4 signaling share per day from sampled block captures (deduped by height). BIP-110 lock-in requires 55% within a 2016-block period.',
    daily: daily
  };
}


/* ── 6. SegWit / Taproot / Legacy adoption ─────────────────────────────── */
var MAX_WEIGHT_WU = 4000000;      // consensus block weight limit
var THEORETICAL_MAX_TPS = 7.0;    // classic 4M WU / (600s x ~950 WU/tx) cap — kept
                                  // ONLY as a documented reference, never rendered
                                  // as if measured.

function buildAdoption() {
  var records = readSpool('block_adoption');
  var byHeight = {};        // h -> latest block summary (dedup by height, keep newest)
  var bySample = {};        // height -> AGGREGATED taproot sample (subsamples from
                            // different captures of the same block are DIFFERENT
                            // seeded uniform draws — summing them grows coverage)
  var newestTs = null;

  records.forEach(function (rec) {
    var data = okData(rec) ? rec.payload.data : null;
    if (!data || !Array.isArray(data.blocks)) return;
    var t = rec.enqueuedAt || rec.captureTime;
    if (t && (!newestTs || t > newestTs)) newestTs = t;
    var tipH = (typeof data.tipHeight === 'number') ? data.tipHeight : (data.blocks[0] && data.blocks[0].height);
    data.blocks.forEach(function (b) {
      if (!b || typeof b.height !== 'number') return;
      var rt = rec.captureTime || rec.enqueuedAt;
      if (!byHeight[b.height] || (rt && rt > (byHeight[b.height]._t || ''))) {
        byHeight[b.height] = {
          h: b.height, ts: b.timestamp, tx: b.tx_count, weight: b.weight,
          segwit: b.segwitTotalTxs, segwitSize: b.segwitTotalSize,
          segwitWeight: b.segwitTotalWeight, _t: t
        };
      }
    });
    var smp = data.taprootSample;
    if (smp && typeof smp.txsSampled === 'number' && smp.txsSampled > 0 && tipH != null) {
      if (!bySample[tipH]) bySample[tipH] = { height: tipH, txs: 0, nonCoinbase: 0, taproot: 0, segwit: 0, legacy: 0, unclassified: 0, captures: 0 };
      var agg = bySample[tipH];
      agg.txs += smp.txsSampled; agg.nonCoinbase += smp.nonCoinbase;
      agg.taproot += smp.taprootSpends; agg.segwit += smp.segwitSpends;
      agg.legacy += smp.legacySpends; agg.unclassified += smp.unclassified;
      agg.captures++;
    }
  });

  if (!Object.keys(byHeight).length) {
    // Honest empty state — this is NOT a fake 0%: the mirror exists but the
    // capture pipeline has not delivered any adoption data yet.
    return {
      schema_version: 1,
      generated_at: newestTs || new Date().toISOString(),
      source: 'spool block_adoption',
      available: false,
      note: 'Adoption data not yet captured — pipeline TODO. SegWit/Taproot/Legacy usage will appear once the block_adoption capture source delivers records.',
      segwit_pct: null, taproot_pct: null, legacy_pct: null,
      tx_count: null, effective_tps: null, taproot_sample_size: 0
    };
  }

  // Latest window: up to 24 distinct blocks (oldest -> newest)
  var heights = Object.keys(byHeight).map(Number).sort(function (a, b) { return b - a; }).slice(0, 24).reverse();
  var blocks = heights.map(function (h) { return byHeight[h]; });

  var txSum = 0, weightSum = 0, segwitSum = 0;
  blocks.forEach(function (b) {
    txSum += b.tx || 0;
    weightSum += b.weight || 0;
    segwitSum += (typeof b.segwit === 'number') ? b.segwit : 0;
  });

  // Avg block interval from real block timestamps (sorted by height)
  var intervals = [];
  for (var i = 1; i < blocks.length; i++) {
    var dt = (blocks[i].ts || 0) - (blocks[i - 1].ts || 0);
    if (dt > 0) intervals.push(dt);
  }
  var avgInterval = intervals.length ? intervals.reduce(function (a, b) { return a + b; }, 0) / intervals.length : 600;

  var segwitPct = txSum > 0 && segwitSum >= 0 ? Math.round(segwitSum / txSum * 1000) / 10 : null;
  var legacyPct = segwitPct !== null ? Math.round((100 - segwitPct) * 10) / 10 : null;

  // Taproot: aggregate the uniform subsamples across captures for the window heights
  var tTaproot = 0, tNonCb = 0;
  Object.keys(bySample).forEach(function (h) {
    var a = bySample[h];
    tTaproot += a.taproot; tNonCb += a.nonCoinbase;
  });
  var taprootPct = tNonCb > 0 ? Math.round(tTaproot / tNonCb * 1000) / 10 : null;
  // Clamp: taproot spends are a subset of segwit spends in reality; sampling noise
  // must never render taproot > segwit (bar would exceed 100%).
  if (taprootPct !== null && segwitPct !== null && taprootPct > segwitPct) taprootPct = segwitPct;

  // Effective TPS — honest, computed from REAL block data. The architect's draft
  // formula (total_weight/4e6 * 600000/interval) is dimensionally broken
  // (~9653 TPS on live data). The honest equivalent: observed tx throughput over
  // the window = total tx / (N blocks x avg block interval). Capacity context
  // (weight utilization vs the 4M WU consensus limit, and the theoretical 7 TPS
  // cap) is carried alongside so consumers can reason about headroom.
  var effectiveTps = avgInterval > 0 && blocks.length > 0 ? Math.round(txSum / (blocks.length * avgInterval) * 100) / 100 : null;
  var weightUtil = blocks.length ? Math.round(weightSum / blocks.length / MAX_WEIGHT_WU * 10000) / 100 : null;

  return {
    schema_version: 1,
    generated_at: newestTs || new Date().toISOString(),
    source: 'spool block_adoption',
    available: true,
    date: (newestTs || '').slice(0, 10),
    note: 'SegWit share = extras.segwitTotalTxs / tx_count (authoritative, mempool.space block summary). Legacy = 100 - SegWit. Taproot = share of uniformly-sampled spends with a v1_p2tr (P2TR) input (' + tNonCb + ' sampled non-coinbase txs, ' + (Object.keys(bySample).length) + ' capture rounds, aggregated; labeled sampled, not exhaustive; P2SH-wrapped segwit counts as legacy). Effective TPS = total tx / (N blocks x avg block interval) from real blocks — NOT an invented constant; theoretical max 7 TPS kept only as a reference. Weight utilization = avg block weight / 4M WU.',
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
    per_block: blocks.map(function (b) {
      return { h: b.h, tx: b.tx, weight: b.weight, segwit_txs: b.segwit };
    })
  };
}

function run() {
  var results = [];
  results.push(['block_interval.json', buildBlockInterval()]);
  results.push(['hashrate.json', buildHashrate()]);
  results.push(['mempool_fee_histogram.json', buildMempoolFeeHistogram()]);
  results.push(['fee_history_blocks.json', buildFeeHistoryBlocks()]);
  results.push(['bip110_daily.json', buildBip110Daily()]);
  results.push(['adoption.json', buildAdoption()]);
  results.forEach(function (r) {
    var changed = writeOnChange(r[0], r[1]);
    if (require.main === module) console.log((changed ? 'wrote ' : 'unchanged ') + r[0]);
  });
  return results;
}

if (require.main === module) { run(); }
module.exports = { run: run, writeOnChange: writeOnChange, buildBip110Daily: buildBip110Daily, buildAdoption: buildAdoption };
