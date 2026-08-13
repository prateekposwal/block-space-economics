var fs = require('fs');
var path = require('path');

var SOURCES = ['fees', 'btc_price', 'mempool', 'mempool_blocks', 'fee_history', 'lightning', 'blocks', 'block_height', 'block_hash', 'raw_block_tip', 'coinpaprika', 'fear_greed', 'blockchair', 'mining_pools', 'difficulty', 'hashrate', 'mempool_recent', 'block_adoption'];

function loadModule(name) {
  var mod = require('./' + name + '.js');
  return {
    schema: mod.schema,
    validate: mod.validate
  };
}

function loadAll() {
  var out = {};
  SOURCES.forEach(function(name) {
    try { out[name] = loadModule(name); }
    catch (e) { throw new Error('Failed to load schema ' + name + ': ' + e.message); }
  });
  return out;
}

function list() {
  var mods = loadAll();
  return Object.keys(mods).map(function(k) { return mods[k].schema; });
}

function get(source) {
  var mods = loadAll();
  return mods[source] || null;
}

function init() {
  var mods = loadAll();
  var snapshot = {
    generatedAt: new Date().toISOString(),
    count: Object.keys(mods).length,
    schemas: Object.keys(mods).map(function(k) {
      return { name: mods[k].schema.name, source: mods[k].schema.source, major: mods[k].schema.major, minor: mods[k].schema.minor, protocolDoc: mods[k].schema.protocolDoc };
    })
  };
  var outPath = path.resolve(__dirname, '..', '..', '..', 'captured-data', 'spool', 'schemas.json');
  if (!fs.existsSync(path.dirname(outPath))) fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(snapshot, null, 2));
  return snapshot;
}

module.exports = { SOURCES: SOURCES, loadAll: loadAll, list: list, get: get, init: init };
