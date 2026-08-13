#!/usr/bin/env node
// BSAHI — block_adoption collector (SegWit / Taproot / Legacy usage)
// Real per-block adoption data from mempool.space, no fabrication:
//   1. tip hash (blockstream.info, fast single-host hop)
//   2. walk the last 10 blocks via previousblockhash, fetching each block's
//      summary (extras.segwitTotalTxs / segwitTotalSize / segwitTotalWeight —
//      authoritative SegWit share = segwitTotalTxs / tx_count)
//   3. per block: /api/block/:hash/txids (ALL txids in one call) → pick a
//      deterministic UNIFORM subsample (25 txs, seeded per capture so each
//      cycle samples a different rotating slice) → /api/tx/:txid each, classify
//      spends by vin[].prevout.scriptpubkey_type:
//        v1_p2tr                      -> taproot spend
//        v0_p2wpkh / v0_p2wsh         -> segwit spend
//        anything else                -> legacy spend
//   Taproot share is a bounded SAMPLE and is labeled as such in every consumer.
//   (mempool.space /api/block/:hash/txs ignores start_index — always the first
//   25 txs — so uniform coverage requires the txids + per-tx fetch path.)
//
// Request budget per cycle: 1 (tip) + 10 (summary) + 10 (txids) + 250 (per-tx)
// ≈ 271 sequential requests (~268 to mempool.space), 80–100ms polite spacing —
// trivial against the hourly cadence.
//
// Rate-limit (HTTP 429) handling: every hop treats any non-200 as a soft
// failure and aborts/degrades gracefully — the walk stops at the first
// non-200 block summary, the per-tx sampler silently skips non-200 txids,
// and the whole capture returns {status:0, error} (never throws), so a 429
// just yields a failed capture record that the agent backoffs (retries: 0).
var HEX64 = /^[0-9a-f]{64}$/i;

function delay(ms) {
  return new Promise(function (res) { setTimeout(res, ms); });
}

/* Mulberry32 PRNG — deterministic within a capture (seeded), varied across
 * captures (seed = time), so repeated cycles cover different subsamples. */
function mulberry32(seed) {
  var a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    var t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* classifyVin(vin) — first-seen wins: taproot > segwit > legacy.
 * prevout.scriptpubkey_type is the spent output's script class. Known
 * limitation (honest): P2SH-wrapped segwit outputs report as 'p2sh' and
 * classify as legacy here — native segwit (the vast majority) is exact. */
function classifyVin(vin) {
  var taproot = false, segwit = false, seen = 0;
  for (var i = 0; i < vin.length; i++) {
    var v = vin[i] || {};
    if (v.is_coinbase) continue;
    var pv = v.prevout;
    if (!pv || !pv.scriptpubkey_type) continue;
    seen++;
    if (pv.scriptpubkey_type === 'v1_p2tr') taproot = true;
    else if (pv.scriptpubkey_type.indexOf('v0_') === 0) segwit = true;
  }
  if (taproot) return { kind: 'taproot', seen: seen };
  if (segwit) return { kind: 'segwit', seen: seen };
  return { kind: 'legacy', seen: seen };
}

var MAX_BLOCKS = 10;          // tip + 9 previous (20 block API calls/capture — trivial at hourly cadence)
var SAMPLE_PER_BLOCK = 25;   // uniformly-sampled txs per block (250 txs / capture)

/* collectBlockAdoption(fetchUrl, timeoutMs) -> Promise<capture>
 * fetchUrl is the capture-agent's https GET helper resolving
 * { status, data, fetchedAt } (data = parsed JSON or raw text body). */
function collectBlockAdoption(fetchUrl, timeoutMs) {
  var tmo = timeoutMs || 30000;
  var seed = Date.now();
  var sample = {
    blocksSampled: 0,
    txsSampled: 0,
    coinbase: 0,
    nonCoinbase: 0,
    taprootSpends: 0,
    segwitSpends: 0,
    legacySpends: 0,
    unclassified: 0
  };
  var blocks = [];
  var tipHash = null;
  var fetchedAt = new Date().toISOString();

  return fetchUrl('https://blockstream.info/api/blocks/tip/hash', tmo)
    .then(function (tip) {
      if (!tip || tip.status !== 200) return { status: 0, error: 'tip hash fetch failed' };
      tipHash = (tip.data || '').trim();
      if (!HEX64.test(tipHash)) return { status: 0, error: 'invalid tip hash: ' + String(tipHash).slice(0, 24) };
      return walk(tipHash, 0);
    })
    .then(function (walkErr) {
      if (walkErr) return walkErr;
      var pct = sample.nonCoinbase > 0 ? Math.round(sample.taprootSpends / sample.nonCoinbase * 1000) / 10 : null;
      return {
        status: 200,
        fetchedAt: fetchedAt,
        data: {
          tipHash: tipHash,
          tipHeight: blocks.length ? blocks[0].height : null,
          capturedAt: fetchedAt,
          blocks: blocks,
          taprootSample: {
            blocksSampled: sample.blocksSampled,
            txsSampled: sample.txsSampled,
            coinbase: sample.coinbase,
            nonCoinbase: sample.nonCoinbase,
            taprootSpends: sample.taprootSpends,
            segwitSpends: sample.segwitSpends,
            legacySpends: sample.legacySpends,
            unclassified: sample.unclassified,
            p2trPct: pct,
            method: 'mempool.space /api/block/:hash/txids + /api/tx/:txid — ' + SAMPLE_PER_BLOCK +
              ' uniformly-sampled txs per block (seeded subsample, changes each capture), vin[].prevout.scriptpubkey_type (v1_p2tr=taproot; v0_*=segwit; else legacy). P2SH-wrapped segwit reports as p2sh and counts as legacy. Sampled, not exhaustive.'
          }
        }
      };
    });

  function walk(hash, depth) {
    if (depth >= MAX_BLOCKS) return null;
    return fetchUrl('https://mempool.space/api/v1/block/' + hash, tmo)
      .then(function (det) {
        if (!det || det.status !== 200 || !det.data) return { status: 0, error: 'block detail failed at depth ' + depth };
        var d = det.data;
        var ex = d.extras || {};
        blocks.push({
          hash: d.id,
          height: d.height,
          timestamp: d.timestamp,
          tx_count: d.tx_count,
          size: d.size,
          weight: d.weight,
          segwitTotalTxs: (typeof ex.segwitTotalTxs === 'number') ? ex.segwitTotalTxs : null,
          segwitTotalSize: (typeof ex.segwitTotalSize === 'number') ? ex.segwitTotalSize : null,
          segwitTotalWeight: (typeof ex.segwitTotalWeight === 'number') ? ex.segwitTotalWeight : null
        });
        return sampleBlock(hash, d.tx_count || 0, seed + depth)
          .then(function () {
            sample.blocksSampled++;
            return d.previousblockhash ? delay(100).then(function () { return walk(d.previousblockhash, depth + 1); }) : null;
          });
      });
  }

  /* Uniform subsample: all txids in one call, pick SAMPLE_PER_BLOCK indices
   * spread via a seeded PRNG (skipping index 0 — the coinbase). */
  function sampleBlock(hash, txCount, seedForBlock) {
    return delay(100).then(function () {
      return fetchUrl('https://mempool.space/api/block/' + hash + '/txids', tmo);
    }).then(function (r) {
      if (!r || r.status !== 200 || !Array.isArray(r.data) || r.data.length < 2) return;
      var ids = r.data;
      var rng = mulberry32(seedForBlock);
      var picks = {};
      var guard = 0;
      while (Object.keys(picks).length < SAMPLE_PER_BLOCK && guard < SAMPLE_PER_BLOCK * 8) {
        guard++;
        var idx = 1 + Math.floor(rng() * (ids.length - 1)); // skip index 0 (coinbase)
        picks[idx] = ids[idx];
      }
      var chain = Promise.resolve();
      Object.keys(picks).forEach(function (idx) {
        chain = chain.then(function () {
          return delay(80).then(function () {
            return fetchUrl('https://mempool.space/api/tx/' + picks[idx], tmo).then(function (tr) {
              if (!tr || tr.status !== 200 || !tr.data) return;
              sample.txsSampled++;
              var vin = tr.data.vin || [];
              if (vin.length === 1 && vin[0].is_coinbase) { sample.coinbase++; return; }
              sample.nonCoinbase++;
              var c = classifyVin(vin);
              if (c.kind === 'taproot') sample.taprootSpends++;
              else if (c.kind === 'segwit') sample.segwitSpends++;
              else if (c.seen > 0) sample.legacySpends++;
              else sample.unclassified++;
            });
          });
        });
      });
      return chain;
    });
  }
}

module.exports = { collectBlockAdoption: collectBlockAdoption, classifyVin: classifyVin };
