var fs = require('fs');
var path = require('path');
var child_process = require('child_process');
var https = require('https');

var DB_PATH = path.resolve(__dirname, '..', '..', 'captured-data', 'bsahi.db');
var RPC_ARGS = '-rpcuser=bsahi -rpcpassword=bsahi';

// Canonical spec (v2.0.0): research/model-spec.json supersedes methodology.json.
// CONFIG maps spec quantities to the script's param names; MODEL_VERSION drives
// report + DB row versioning.
var SPEC = require('../../research/model-spec.json');
var Q = SPEC.quantities;
var CONFIG = {
  nodeCostPerYear: Q.C.value,
  estimatedNodeCount: Q.N.value,
  yearsOfStorage: Q.T.value,
  avgBlockSizeBytes: Q.B_block.value
};
var MODEL_VERSION = SPEC.version;

function sqlQuery(sql) {
  try {
    var tmpFile = '/tmp/bsahi-sr-' + process.pid + '-' + Date.now() + '-' + Math.floor(Math.random()*1e9) + '.sql';
    fs.writeFileSync(tmpFile, '.mode json\n' + sql);
    var result = child_process.execSync('sqlite3 "' + DB_PATH + '" < "' + tmpFile + '"', { encoding: 'utf8', timeout: 10000, stdio: ['ignore', 'pipe', 'ignore'] });
    try { fs.unlinkSync(tmpFile); } catch (e) {}
    try { return JSON.parse(result); } catch (e) { return []; }
  } catch (e) { return []; }
}

function bitcoinCli(method, params) {
  try {
    var cmd = '~/.local/bin/bitcoin-cli ' + RPC_ARGS + ' ' + method;
    if (params) cmd += ' ' + params;
    return JSON.parse(child_process.execSync(cmd, { encoding: 'utf8', timeout: 15000, shell: '/bin/zsh' }));
  } catch (e) { return null; }
}

function computeRatio(txFeeSats, txBytes, replicationFactor, costPerBytePerYear, years, btcPriceUsd) {
  if (!txFeeSats || !txBytes || txBytes === 0 || !btcPriceUsd) return null;   // never fabricate a price
  // T enters ONLY here (model-spec.json v2.0.0); cb is horizon-free.
  var storageCostPerNode = txBytes * costPerBytePerYear * years;
  var totalNetworkCostUsd = storageCostPerNode * replicationFactor;
  var feeUsd = (txFeeSats / 100000000) * btcPriceUsd;
  return { ratio: totalNetworkCostUsd > 0 ? (feeUsd / totalNetworkCostUsd) : 0, storageCostUsd: totalNetworkCostUsd, feeUsd: feeUsd, feeBtc: txFeeSats / 100000000, txBytes: txBytes };
}

function computeFromFeeHistory(cfg) {
  cfg = cfg || CONFIG;
  var results = [];
  var data = null;
  // Reproducibility hook: SCCR_INPUT_FILE overrides the DB capture with a
  // frozen JSON input so external/cross-language reproduction reads the SAME
  // data as Python and C (see research/reproduce/cross_check.sh). Canonical
  // behavior (DB capture) is unchanged when the env var is absent.
  if (process.env.SCCR_INPUT_FILE) {
    try { data = JSON.parse(fs.readFileSync(process.env.SCCR_INPUT_FILE, 'utf8')); } catch (e) { data = null; }
  } else {
    var captures = sqlQuery("SELECT json_data FROM captures WHERE source='fee_history' ORDER BY captured_at DESC LIMIT 1");
    if (!captures || captures.length === 0) return results;
    try { data = JSON.parse(captures[0].json_data); } catch (e) { data = null; }
  }
  try {
    if (!Array.isArray(data)) return results;

    var costPerBytePerYear = cfg.nodeCostPerYear / (cfg.avgBlockSizeBytes * 365.25 * 24 * 6);
    var replicationFactor = cfg.estimatedNodeCount;

    for (var i = 0; i < data.length; i++) {
      var entry = data[i];
      var avgFees = entry.avgFees || 0;
      var btcPrice = entry.USD;
      if (!btcPrice) continue;   // missing price -> uncomputable; skip (was || 64000)
      var ratio = computeRatio(avgFees, cfg.avgBlockSizeBytes, replicationFactor, costPerBytePerYear, cfg.yearsOfStorage, btcPrice);
      if (ratio) {
        results.push({
          height: entry.avgHeight,
          ratio: ratio.ratio,
          storageCostUsd: ratio.storageCostUsd,
          feeUsd: ratio.feeUsd,
          feeBtc: ratio.feeBtc,
          txBytes: ratio.txBytes,
        });
      }
    }
  } catch (e) {}
  return results;
}

function computeFromBlockStats() {
  var results = [];
  var blocks = sqlQuery("SELECT height, avg_fee_sats, size, fee_percentiles FROM block_stats ORDER BY height DESC LIMIT 10");
  for (var i = 0; i < blocks.length; i++) {
    var b = blocks[i];
    var size = b.size || CONFIG.avgBlockSizeBytes;
    var costPerBytePerYear = CONFIG.nodeCostPerYear / (size * 365.25 * 24 * 6);
    var replicationFactor = CONFIG.estimatedNodeCount;
    var ratio = computeRatio(b.avg_fee_sats, size, replicationFactor, costPerBytePerYear, CONFIG.yearsOfStorage);
    if (ratio) {
      results.push({
        height: b.height,
        ratio: ratio.ratio,
        storageCostBtc: ratio.storageCostUsd,
        feeBtc: ratio.feeBtc,
        txBytes: size,
        feePercentiles: b.fee_percentiles,
      });
    }
  }
  return results;
}

function generateReport() {
  // Frozen-input mode (SCCR_INPUT_FILE set): pure external reproduction — no DB
  // access, no research_findings insert, no report file written into the clone.
  // Canonical live-DB behavior is unchanged when the env var is absent.
  var FROZEN_MODE = !!process.env.SCCR_INPUT_FILE;
  var feeHistoryRatios = computeFromFeeHistory();
  var blockStatsRatios = FROZEN_MODE ? [] : computeFromBlockStats();

  var lines = [];
  lines.push('# Storage Cost Coverage Ratio Report');
  lines.push('Generated: ' + new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC');
  lines.push('Methodology version: ' + MODEL_VERSION + ' (research/model-spec.json)');
  lines.push('');
  lines.push('## Thesis');
  lines.push('');
  lines.push('Bitcoin\'s fee market prices short-term competition for block inclusion. This report measures');
  lines.push('whether those fees also cover the long-term storage burden imposed on the network.');
  lines.push('');
  lines.push('**Storage Cost Coverage Ratio** = Transaction Fee (BTC) / (Bytes × Replication Factor × Cost per Byte per Year × Years)');
  lines.push('');
  lines.push('A ratio > 1.0 means the fee exceeds estimated storage cost. A ratio < 1.0 means the network');
  lines.push('subsidizes storage beyond what the fee covers.');
  lines.push('');

  lines.push('## Parameters');
  lines.push('');
  lines.push('| Parameter | Value |');
  lines.push('|-----------|-------|');
  lines.push('| Node cost per year | $' + CONFIG.nodeCostPerYear + ' |');
  lines.push('| Estimated full nodes | ' + CONFIG.estimatedNodeCount.toLocaleString() + ' |');
  lines.push('| Storage horizon | ' + CONFIG.yearsOfStorage + ' years |');
  lines.push('| Avg block size | ' + (CONFIG.avgBlockSizeBytes / 1000000).toFixed(1) + ' MB |');
  lines.push('| Methodology version | ' + MODEL_VERSION + ' |');
  lines.push('');

  if (feeHistoryRatios.length > 0) {
    var ratios = feeHistoryRatios.map(function(r) { return r.ratio; });
    var avgRatio = ratios.reduce(function(a, b) { return a + b; }, 0) / ratios.length;
    var minRatio = Math.min.apply(null, ratios);
    var maxRatio = Math.max.apply(null, ratios);

    lines.push('## Results (from 24h fee history)');
    lines.push('');
    lines.push('| Metric | Value |');
    lines.push('|--------|-------|');
    lines.push('| Blocks sampled | ' + feeHistoryRatios.length + ' |');
    lines.push('| Avg coverage ratio | ' + avgRatio.toFixed(4) + ' |');
    lines.push('| Min ratio | ' + minRatio.toFixed(4) + ' |');
    lines.push('| Max ratio | ' + maxRatio.toFixed(4) + ' |');
    lines.push('| Interpretation | ' + (avgRatio > 1 ? 'Fees EXCEED storage cost' : 'Fees BELOW storage cost') + ' |');
    lines.push('');

    var below1 = ratios.filter(function(r) { return r < 1; }).length;
    var pctBelow = (below1 / ratios.length * 100).toFixed(1);
    lines.push('- ' + pctBelow + '% of blocks have fees covering less than 1× the estimated ' + CONFIG.yearsOfStorage + '-year storage cost');
    lines.push('');

    lines.push('### Ratio Distribution (last 24h)');
    lines.push('');
    lines.push('```');
    var buckets = [0, 0.1, 0.5, 1, 2, 5, 10, Infinity];
    var bucketLabels = ['<0.1', '0.1-0.5', '0.5-1', '1-2', '2-5', '5-10', '10+'];
    for (var b = 0; b < buckets.length - 1; b++) {
      var count = ratios.filter(function(r) { return r >= buckets[b] && r < buckets[b + 1]; }).length;
      var bar = '';
      for (var bi = 0; bi < Math.round(count / ratios.length * 50); bi++) bar += '█';
      lines.push(bucketLabels[b].padEnd(8) + ' ' + bar + ' (' + count + ')');
    }
    lines.push('```');
    lines.push('');
  }

  if (blockStatsRatios.length > 0) {
    lines.push('## Results (from Bitcoin Core block stats)');
    lines.push('');
    lines.push('| Height | Ratio | Fee (BTC) | Storage Cost (BTC) | Size |');
    lines.push('|--------|-------|-----------|-------------------|------|');
    for (var i = 0; i < blockStatsRatios.length; i++) {
      var r = blockStatsRatios[i];
      lines.push('| ' + r.height + ' | ' + r.ratio.toFixed(4) + ' | ' + r.feeBtc.toFixed(6) + ' | ' + r.storageCostBtc.toFixed(6) + ' | ' + (r.txBytes / 1000).toFixed(0) + ' KB |');
    }
    lines.push('');
  }

  lines.push('## Discussion');
  lines.push('');
  if (feeHistoryRatios.length > 0) {
    var avgR = feeHistoryRatios.reduce(function(a, b) { return a + b.ratio; }, 0) / feeHistoryRatios.length;
    if (avgR > 1) {
      lines.push('Average ratio of ' + avgR.toFixed(2) + ' suggests that current fees generally cover the estimated');
      lines.push(CONFIG.yearsOfStorage + '-year storage cost across the network. However, this is an average —');
      lines.push('individual blocks with low fee volume may fall below the threshold.');
    } else {
      lines.push('Average ratio of ' + avgR.toFixed(2) + ' suggests that current fees do NOT fully cover the estimated');
      lines.push(CONFIG.yearsOfStorage + '-year storage cost across the network. The difference represents an');
      lines.push('unpriced externality borne by node operators.');
    }
  }
  lines.push('');
  lines.push('### Caveats');
  lines.push('');
  lines.push('- Node count N = ' + CONFIG.estimatedNodeCount.toLocaleString() + ' (measured reachable nodes (validating; a floor), a lower bound). Actual count varies.');
  lines.push('- Node costs vary by hardware, bandwidth, electricity.');
  lines.push('- Storage horizon of ' + CONFIG.yearsOfStorage + ' years is an assumption. Some nodes prune earlier, some keep archival data forever.');
  lines.push('- Block size is averaged. Individual blocks vary significantly.');
  lines.push('- Marginal bandwidth-propagation cost is bounded analytically, not measured: model-spec v2.1.0 bw_cost_per_year_node ≈ $3.94/yr per node at a $0.05/GB retail proxy (working-paper §5.5).');
  lines.push('- Computed under methodology v' + MODEL_VERSION + ' (research/model-spec.json). Param changes bump the version; ratio moves without param changes are fee-regime signal.');
  lines.push('');
  lines.push('## Next Steps');
  lines.push('');
  lines.push('- DONE (2026-08-04): per-block UTXO growth is live — getblockstats → utxo_size_inc persisted to block_stats (schema + spool-consumer + backfill); avg ~29.9 KB/block across 165 backfilled heights. Next: price the UTXO delta.');
  lines.push('- Track ratio over time to identify trends across fee regimes');
  lines.push('- Correlate with BIP-110 signaling data to measure impact of data restrictions');
  lines.push('- Publish as reproducible research note');
  lines.push('');
  lines.push('---');
  lines.push('*Bitcoin Sahi Research — Storage Cost Coverage Ratio*');

  var dateStr = new Date().toISOString().slice(0, 10);
  var filePath = null;
  if (!FROZEN_MODE) {
    var reportDir = path.resolve(__dirname, '..', '..', 'reports', 'research');
    if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });
    filePath = path.join(reportDir, 'storage-ratio-' + dateStr + '.md');
    fs.writeFileSync(filePath, lines.join('\n'));
  }

  // Persist the flagship finding into research_findings (first-class DB row).
  // Skipped in frozen-input mode: no DB is expected to exist in an external clone.
  try { if (!FROZEN_MODE) {
    var avgRatio = feeHistoryRatios.length > 0 ? (feeHistoryRatios.reduce(function(a, b) { return a + b.ratio; }, 0) / feeHistoryRatios.length).toFixed(4) : 'N/A';
    var pctBelow = feeHistoryRatios.length > 0 ? (feeHistoryRatios.filter(function(r) { return r.ratio < 1; }).length / feeHistoryRatios.length * 100).toFixed(1) + '%' : 'N/A';
    var db = require('../db/init.js');
    db.insertResearchFinding(
      'Storage Ratio',
      'Storage Cost Coverage Ratio: ' + avgRatio + ' (v' + MODEL_VERSION + ')',
      'Fees fall below the estimated ' + CONFIG.yearsOfStorage + '-year storage cost in ' + pctBelow + ' of sampled blocks — an unpriced permanence externality.',
      JSON.stringify({ version: MODEL_VERSION, params: CONFIG, blocks: feeHistoryRatios.length, avgRatio: avgRatio }),
      0.95, 'storage-externality', 'reports/research/storage-ratio-' + dateStr + '.md', 0
    );
  } } catch (e) { if (!FROZEN_MODE) console.log('storage-ratio insert failed:', e.message); }

  return { filePath: filePath, blocks: feeHistoryRatios.length, avgRatio: feeHistoryRatios.length > 0 ? (feeHistoryRatios.reduce(function(a, b) { return a + b.ratio; }, 0) / feeHistoryRatios.length).toFixed(4) : 'N/A', belowThreshold: feeHistoryRatios.length > 0 ? (feeHistoryRatios.filter(function(r) { return r.ratio < 1; }).length / feeHistoryRatios.length * 100).toFixed(1) + '%' : 'N/A', frozenMode: FROZEN_MODE };
}

function sensitivityGrid() {
  var rows = [];
  var base = CONFIG;
  var grid = {
    nodeCostPerYear: [600, 925, 1400],
    estimatedNodeCount: [30000, 60000, 100000],
    yearsOfStorage: [5, 10, 15],
    avgBlockSizeBytes: [1000000, 1500000, 2000000]
  };
  Object.keys(grid).forEach(function(k) {
    grid[k].forEach(function(v) {
      var p = {};
      Object.keys(base).forEach(function(b) { p[b] = base[b]; });
      p[k] = v;
      var ratios = computeFromFeeHistory(p);
      var avg = ratios.length ? ratios.reduce(function(a, b) { return a + b.ratio; }, 0) / ratios.length : 0;
      rows.push({ param: k, value: v, avgRatio: Math.round(avg * 10000) / 10000 });
    });
  });
  return rows;
}

if (require.main === module) {
  if (process.argv[2] === '--sensitivity') {
    console.log('Storage Cost Coverage Ratio — sensitivity grid (methodology v' + MODEL_VERSION + ')');
    console.log('param'.padEnd(20) + 'value'.padEnd(12) + 'avgRatio');
    sensitivityGrid().forEach(function(r) {
      console.log(r.param.padEnd(20) + String(r.value).padEnd(12) + r.avgRatio.toFixed(4));
    });
    process.exit(0);
  }
  var result = generateReport();
  console.log('Storage Cost Coverage Ratio Report');
  console.log(result.frozenMode ? '  File: (frozen-input reproduction — no report written)' : '  File: ' + result.filePath);
  console.log('  Methodology: v' + MODEL_VERSION);
  console.log('  Blocks sampled: ' + result.blocks);
  console.log('  Avg ratio: ' + result.avgRatio);
  console.log('  Below 1.0: ' + result.belowThreshold);
}

module.exports = { generateReport: generateReport, computeRatio: computeRatio, computeFromFeeHistory: computeFromFeeHistory, sensitivityGrid: sensitivityGrid };
