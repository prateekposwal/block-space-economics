// ⚠️ DORMANT — DO NOT BUILD ON (marked 2026-08-14).
// This agent talks to a LOCAL Bitcoin Core RPC (getblockchaininfo / getblockstats /
// per-block fee percentiles / utxo_size_inc). The Core node in this environment
// has never synced (getblockchaininfo reports blocks:0 / pruneHeight:0), so the
// btc_rpc spool source has produced no usable records and the `transactions`
// SQLite table it was meant to feed has 0 rows. The tx-type question
// (segwit/legacy/taproot) is answered by the block_adoption capture source
// (tools/data-engineering/block-adoption-collect.js) with 1/100th the infra.
// Do NOT repoint new work here. Kept (not deleted) so old reports keep their
// provenance.
var http = require('http');
var fs = require('fs');
var path = require('path');

var RPC_CONFIG = {
  host: process.env.BTC_RPC_HOST || '127.0.0.1',
  port: parseInt(process.env.BTC_RPC_PORT, 10) || 8332,
  user: process.env.BTC_RPC_USER || 'bsahi',
  pass: process.env.BTC_RPC_PASS || 'bsahi',
};

var STATE_FILE = path.resolve(__dirname, '..', '..', 'captured-data', 'btc-rpc-state.json');
var state = { lastBlock: 0, totalCalls: 0 };

function loadState() {
  try { if (fs.existsSync(STATE_FILE)) state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); } catch (e) {}
}

function saveState() {
  try { fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2)); } catch (e) {}
}

function rpcCall(method, params) {
  return new Promise(function(resolve, reject) {
    var body = JSON.stringify({ jsonrpc: '1.0', id: 'bsahi-' + Date.now(), method: method, params: params || [] });
    var auth = Buffer.from(RPC_CONFIG.user + ':' + RPC_CONFIG.pass).toString('base64');
    var opts = {
      hostname: RPC_CONFIG.host,
      port: RPC_CONFIG.port,
      path: '/',
      method: 'POST',
      timeout: 30000,
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Basic ' + auth, 'Content-Length': Buffer.byteLength(body) },
    };
    var req = http.request(opts, function(res) {
      var data = '';
      res.on('data', function(c) { data += c; });
      res.on('end', function() {
        try {
          var parsed = JSON.parse(data);
          if (parsed.error) reject(new Error(parsed.error.message || 'RPC error'));
          else resolve(parsed.result);
        } catch (e) { reject(new Error('Parse error: ' + data.slice(0, 200))); }
      });
    });
    req.on('error', function(e) { reject(new Error('Connection: ' + e.message)); });
    req.on('timeout', function() { req.destroy(); reject(new Error('Timeout')); });
    req.write(body);
    req.end();
  });
}

async function getBlockchainInfo() {
  return await rpcCall('getblockchaininfo');
}

async function getMempoolInfo() {
  return await rpcCall('getmempoolinfo');
}

async function getBlockStats(hash) {
  return await rpcCall('getblockstats', [hash, ['avgfee', 'avgfeerate', 'maxfee', 'minfee', 'feerate_percentiles', 'subsidy', 'total_out', 'totalfee', 'utxo_size_inc', 'outs']]);
}

async function getBlock(hash) {
  return await rpcCall('getblock', [hash, 1]);
}

async function getBestBlockHash() {
  return await rpcCall('getbestblockhash');
}

async function getPeerInfo() {
  return await rpcCall('getpeerinfo');
}

async function run() {
  loadState();
  var start = Date.now();
  var results = { ok: false, error: null, blockchain: null, mempool: null, blocks: [], peerCount: 0 };

  try {
    // Test connection
    var info = await getBlockchainInfo();
    results.blockchain = {
      chain: info.chain,
      blocks: info.blocks,
      headers: info.headers,
      bestBlockHash: info.bestblockhash,
      difficulty: info.difficulty,
      sizeOnDisk: info.size_on_disk,
      pruned: info.pruned,
      pruneHeight: info.pruneheight || 0,
      verificationProgress: info.verificationprogress,
    };

    // Get mempool info
    var mempool = await getMempoolInfo();
    results.mempool = {
      size: mempool.size,
      bytes: mempool.bytes,
      usage: mempool.usage,
      maxmempool: mempool.maxmempool,
      mempoolminfee: mempool.mempoolminfee,
    };

    // Get peer info
    try {
      var peers = await getPeerInfo();
      results.peerCount = peers.length;
    } catch (e) { results.peerCount = 0; }

    // Get latest block stats with fee percentiles
    var bestHash = info.bestblockhash;

    // Also get previous 2 blocks for context
    var hashes = [bestHash];
    var currentHash = bestHash;
    for (var i = 0; i < 2; i++) {
      try {
        var block = await getBlock(currentHash);
        if (block && block.previousblockhash) {
          hashes.push(block.previousblockhash);
          currentHash = block.previousblockhash;
        }
      } catch (e) { break; }
    }

    for (var i = 0; i < hashes.length; i++) {
      try {
        var stats = await getBlockStats(hashes[i]);
        var blockData = await getBlock(hashes[i]);
        var blockHeight = info.blocks - i;
        results.blocks.push({
          height: blockHeight,
          hash: hashes[i],
          time: blockData ? blockData.time : 0,
          txCount: blockData ? blockData.nTx : 0,
          size: blockData ? blockData.size : 0,
          weight: blockData ? blockData.weight : 0,
          avgFee: stats.avgfee || 0,
          avgFeeRate: stats.avgfeerate || 0,
          maxFee: stats.maxfee || 0,
          minFee: stats.minfee || 0,
          medFee: stats.medfee || 0,
          feePercentiles: stats.feerate_percentiles || [],
          subsidy: stats.subsidy || 0,
          totalFee: stats.totalfee || 0,
          totalOut: stats.total_out || 0,
          utxoSizeInc: stats.utxo_size_inc || 0,
          outputs: stats.outs || 0,
        });
      } catch (e) {
        console.warn('Block ' + hashes[i] + ' stats error: ' + e.message);
      }
    }

    results.ok = true;
    state.lastBlock = info.blocks;
    state.lastRun = Date.now();
    state.totalCalls++;
    saveState();

  } catch (e) {
    results.error = e.message;
    results.ok = false;
  }

  results.elapsed = Date.now() - start;

  // Save to captured-data
  var now = new Date();
  var ts = now.toISOString().replace(/:/g, '-').replace(/\..+/, '');
  var dateDir = now.toISOString().slice(0, 10);
  var outDir = path.resolve(__dirname, '..', '..', 'captured-data', 'btc-rpc', dateDir);
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  var filePath = path.join(outDir, ts + '.json');
  fs.writeFileSync(filePath, JSON.stringify(results, null, 2));

  // DORMANT agent (2026-08-14): the local Core node never syncs, so run()
  // enqueuing status:0 rows every cycle was polluting the captures table with
  // guaranteed ECONNREFUSED failures (the ops-health DB error-ratio source).
  // Only enqueue REAL captures — offline state stays in the result file above.
  if (results.ok) {
    try {
      var spoolMod = require('../data-engineering/spool.js');
      spoolMod.init().then(function(spool) {
        var localTs = ts.slice(0, 19).replace(/:/g, '-');
        var cycleTs = localTs.slice(0, 10) + '_' + localTs.slice(11);
        return spool.enqueue('btc_rpc', { status: 200, data: results }, { captureTime: cycleTs, day: dateDir, producer: 'agent-06', expectedIntervalMinutes: 60 });
      }).catch(function(e) { console.error('[rpc] spool enqueue error:', e.message); });
    } catch (e) { console.error('[rpc] spool unavailable:', e.message); }
  }

  return results;
}

if (require.main === module) {
  run().then(function(r) {
    if (r.ok) console.log('Bitcoin Core RPC: ' + r.blockchain.blocks + ' blocks, ' + r.blocks.length + ' block stats, ' + r.peerCount + ' peers, ' + r.elapsed + 'ms');
    else console.log('Bitcoin Core RPC: OFFLINE — ' + r.error);
    process.exit(r.ok ? 0 : 1);
  }).catch(function(e) {
    console.log('Bitcoin Core RPC: FAILED — ' + e.message);
    process.exit(1);
  });
}

module.exports = { run: run, getState: function() { return state; } };
