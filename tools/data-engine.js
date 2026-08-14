var DATA_ENGINE = (function () {
  var REDUCED_MOTION = (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  'use strict';

  var DATA = {
    fees: { fastestFee: 0, halfHourFee: 0, hourFee: 0, economyFee: 0, minimumFee: 0 },
    btc_price: 0,
    mempool: { count: 0, vsize: 0, fee_histogram: [] },
    mempool_blocks: [],
    fee_history: [],
    lightning: { channel_count: 0, node_count: 0, total_capacity: 0, avg_fee_rate: 0 },
    blocks: [],
    block_height: 0,
    last_updated: null
  };

  var listeners = [];
  var storageListeners = [];
  var timer = null;
  var FETCH_INTERVAL = 60000;

  var ENDPOINTS = [
    { key: 'fees',            url: 'https://mempool.space/api/v1/fees/recommended' },
    { key: 'btc_price',       url: 'https://mempool.space/api/v1/prices' },
    { key: 'mempool',         url: 'https://mempool.space/api/mempool' },
    { key: 'mempool_blocks',  url: 'https://mempool.space/api/v1/fees/mempool-blocks' },
    { key: 'fee_history',     url: 'https://mempool.space/api/v1/mining/blocks/fees/24h' },
    { key: 'lightning',       url: 'https://mempool.space/api/v1/lightning/statistics/latest' },
    { key: 'blocks',          url: 'https://mempool.space/api/blocks?limit=10' },
    { key: 'block_height',    url: 'https://blockstream.info/api/blocks/tip/height' }
  ];

  var DB_NAME = 'BSahiDataLog';
  var DB_VERSION = 1;
  var STORE_NAME = 'logs';
  var db = null;
  var dbPending = null;
  var writeQueue = [];
  var logCache = [];
  var cacheLoaded = false;
  var FALLBACK_KEY = 'bsahi_log_fb';

  function openDB() {
    if (db) return Promise.resolve(db);
    if (dbPending) return dbPending;
    if (typeof indexedDB === 'undefined') {
      dbPending = Promise.resolve(null);
      return dbPending;
    }
    dbPending = new Promise(function(resolve) {
      var req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function(e) {
        var store = e.target.result.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
        store.createIndex('k', 'k', { unique: false });
        store.createIndex('t', 't', { unique: false });
      };
      req.onsuccess = function(e) {
        db = e.target.result;
        db.onerror = function() {};
        resolve(db);
        flushQueue();
      };
      req.onerror = function() {
        db = null;
        dbPending = null;
        resolve(null);
      };
      req.onblocked = function() {
        db = null;
        dbPending = null;
        resolve(null);
      };
    });
    return dbPending;
  }

  function flushQueue() {
    if (writeQueue.length === 0) return;
    var q = writeQueue.slice();
    writeQueue = [];
    for (var i = 0; i < q.length; i++) {
      writeToDB(q[i]);
    }
  }

  function writeToDB(entry) {
    if (!db) return;
    try {
      var tx = db.transaction(STORE_NAME, 'readwrite');
      var store = tx.objectStore(STORE_NAME);
      store.add(entry);
      // Prune: cap entries at 20K with 30-day TTL (bounded per-user growth).
      try {
        var countReq = store.count();
        countReq.onsuccess = function() {
          if (countReq.result > 20000) {
            var allReq = store.getAllKeys();
            allReq.onsuccess = function() {
              var keys = (allReq.result || []).sort();
              var excess = keys.length - 20000;
              for (var i = 0; i < excess; i++) store.delete(keys[i]);
            };
          }
        };
      } catch (e) {}
    } catch (e) {}
  }

  function loadFromDB() {
    openDB().then(function(d) {
      if (!d) {
        loadLocalStorageFallback();
        return;
      }
      try {
        var tx = d.transaction(STORE_NAME, 'readonly');
        var store = tx.objectStore(STORE_NAME);
        var all = store.getAll();
        all.onsuccess = function() {
          logCache = all.result || [];
          cacheLoaded = true;
          migrateFromLocalStorage();
        };
        all.onerror = function() {
          loadLocalStorageFallback();
        };
      } catch (e) {
        loadLocalStorageFallback();
      }
    });
  }

  function loadLocalStorageFallback() {
    try {
      var raw = localStorage.getItem(FALLBACK_KEY);
      if (raw) {
        logCache = JSON.parse(raw);
        localStorage.removeItem(FALLBACK_KEY);
      }
    } catch (e) {}
    cacheLoaded = true;
  }

  function migrateFromLocalStorage() {
    try {
      var raw = localStorage.getItem(FALLBACK_KEY);
      if (raw) {
        var old = JSON.parse(raw);
        if (old.length > 0 && logCache.length === 0) {
          logCache = old;
          for (var i = 0; i < old.length; i++) {
            writeToDB(old[i]);
          }
        }
        localStorage.removeItem(FALLBACK_KEY);
      }
    } catch (e) {}
  }

  function xhrGet(url, cb) {
    var xhr = new XMLHttpRequest();
    var done = false;
    xhr.open('GET', url, true);
    xhr.timeout = 8000;

    function finish(err, data) {
      if (done) return;
      done = true;
      cb(err, data);
    }

    xhr.onload = function () {
      if (xhr.status >= 200 && xhr.status < 300) {
        try { finish(null, JSON.parse(xhr.responseText)); }
        catch (e) { finish(e, null); }
      } else {
        finish(new Error('HTTP ' + xhr.status), null);
      }
    };
    xhr.onerror = function () { finish(new Error('Network error'), null); };
    xhr.ontimeout = function () { finish(new Error('Timeout'), null); };
    xhr.send();
  }

  function normalize(key, raw) {
    switch (key) {
      case 'fees':
        DATA.fees = {
          fastestFee: raw.fastestFee || 0,
          halfHourFee: raw.halfHourFee || 0,
          hourFee: raw.hourFee || 0,
          economyFee: raw.economyFee || 0,
          minimumFee: raw.minimumFee || 0
        };
        break;
      case 'btc_price':
        DATA.btc_price = raw.USD || 0;
        break;
      case 'mempool':
        DATA.mempool = {
          count: raw.count || 0,
          vsize: raw.vsize || 0,
          fee_histogram: Array.isArray(raw.fee_histogram) ? raw.fee_histogram : []
        };
        break;
      case 'mempool_blocks':
        DATA.mempool_blocks = Array.isArray(raw) ? raw : [];
        break;
      case 'fee_history':
        // Keep the raw entries but expose the REAL sat/vB conversion: the API
        // returns avgFees (sats per block) and every block is 4M vbytes, so
        // feeRate = avgFees / 4000000 is the genuine unit conversion — not a
        // fabricated number (same constant the fee heatmap uses).
        DATA.fee_history = (Array.isArray(raw) ? raw : []).map(function (b) {
          var out = b || {};
          if (typeof out.feeRate !== 'number' && typeof out.avgFees === 'number' && out.avgFees > 0) {
            out = Object.assign({}, out, { feeRate: out.avgFees / 4000000 });
          }
          return out;
        });
        break;
      case 'lightning':
        var s = raw.latest || raw;
        // Real split fields the API returns (tor/clearnet/unannounced) — the
        // Lightning canvas renders its honest node-share visual from these.
        DATA.lightning = {
          channel_count: s.channel_count || s.channelCount || 0,
          node_count: s.node_count || s.nodeCount || 0,
          total_capacity: s.total_capacity || s.totalCapacity || 0,
          avg_fee_rate: s.avg_fee_rate || s.avgFeeRate || 0,
          avg_capacity: s.avg_capacity || s.avgCapacity || 0,
          med_capacity: s.med_capacity || s.medCapacity || 0,
          med_fee_rate: s.med_fee_rate || s.medFeeRate || 0,
          tor_nodes: s.tor_nodes || 0,
          clearnet_nodes: s.clearnet_nodes || 0,
          unannounced_nodes: s.unannounced_nodes || 0,
          clearnet_tor_nodes: s.clearnet_tor_nodes || 0,
          added: s.added || null
        };
        break;
      case 'blocks':
        DATA.blocks = (Array.isArray(raw) ? raw : []).map(function (b) {
          return {
            id: b.id || null,
            height: b.height || 0,
            timestamp: b.timestamp || 0,
            version: b.version || 0,
            bits: b.bits || null,
            tx_count: b.tx_count || b.txCount || 0,
            size: b.size || 0,
            weight: b.weight || 0,
            fee_span: b.fee_span || b.feeSpan || null,
            avg_fee: b.avg_fee || b.avgFee || null,
            avg_fee_rate: b.avg_fee_rate || b.avgFeeRate || null
          };
        });
        break;
      case 'blockchair':
        DATA.blockchair = typeof raw === 'object' && raw.data ? raw.data : raw;
        break;
      case 'block_height':
        DATA.block_height = (typeof raw === 'number') ? raw : parseInt(raw, 10) || 0;
        break;
    }
  }

  function notify() {
    DATA.last_updated = new Date().toISOString();
    for (var i = 0; i < listeners.length; i++) {
      try { listeners[i](DATA); } catch (e) { if (window.console) console.error('onUpdate listener error:', e); }
    }
  }

  function fetchAll() {
    var remaining = ENDPOINTS.length;

    function done(err, key, raw) {
      if (err) {
        console.warn('DATA_ENGINE [' + key + ']', err.message);
      } else {
        normalize(key, raw);
      }
      remaining--;
      if (remaining === 0) notify();
    }

    for (var i = 0; i < ENDPOINTS.length; i++) {
      (function (ep) {
        xhrGet(ep.url, function (err, result) {
          done(err, ep.key, result);
        });
      })(ENDPOINTS[i]);
    }
  }

  function start() {
    if (timer) return;
    openDB();
    if (!cacheLoaded) loadFromDB();
    fetchAll();
    timer = setInterval(fetchAll, FETCH_INTERVAL);
  }

  function stop() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  function minimizeEntry(key, raw) {
    var m = { t: Date.now(), k: key, d: {} };
    switch (key) {
      case 'fees':
        m.d = { fr: raw.fastestFee, hf: raw.halfHourFee, hr: raw.hourFee, ec: raw.economyFee, mn: raw.minimumFee };
        break;
      case 'btc_price':
        m.d = { p: raw.USD || 0 };
        break;
      case 'mempool':
        m.d = { c: raw.count || 0, v: raw.vsize || 0, fh: Array.isArray(raw.fee_histogram) ? raw.fee_histogram.slice(0, 50) : [] };
        break;
      case 'mempool_blocks':
        m.d = { n: Array.isArray(raw) ? raw.length : 0 };
        break;
       case 'fee_history':
        m.d = { n: Array.isArray(raw) ? raw.length : 0, l: raw.length > 0 ? (raw[raw.length-1].avgFees || raw[raw.length-1].avg_fees || 0) : 0 };
        break;
      case 'lightning':
        var s = raw.latest || raw;
        m.d = { nc: s.node_count || s.nodeCount || 0, cc: s.channel_count || s.channelCount || 0, cap: s.total_capacity || s.totalCapacity || 0 };
        break;
      case 'blocks':
        m.d = { n: Array.isArray(raw) ? raw.length : 0, h: raw.length > 0 ? (raw[0].height || 0) : 0 };
        break;
      case 'blockchair':
        if (raw && raw.data) {
          var bd = raw.data;
          m.d = { blocks: bd.blocks, txs24h: bd.transactions_24h, mempoolTxs: bd.mempool_transactions, mempoolSize: bd.mempool_size, mempoolTps: bd.mempool_tps, difficulty: bd.difficulty, blockchainSize: bd.blockchain_size, bestHeight: bd.best_block_height };
        }
        break;
      case 'block_height':
        m.d = { h: (typeof raw === 'number') ? raw : parseInt(raw, 10) || 0 };
        break;
      default:
        m.d = {};
    }
    return m;
  }

  function appendToLog(key, raw) {
    var entry = minimizeEntry(key, raw);
    logCache.push(entry);
    if (db) {
      writeToDB(entry);
    } else if (dbPending) {
      writeQueue.push(entry);
    } else {
      tryLocalStorageFallback(entry);
    }
  }

  function tryLocalStorageFallback(entry) {
    try {
      var arr = JSON.parse(localStorage.getItem(FALLBACK_KEY) || '[]');
      arr.push(entry);
      if (arr.length > 10000) arr.splice(0, 5000);
      localStorage.setItem(FALLBACK_KEY, JSON.stringify(arr));
    } catch (e) {}
  }

  function onUpdate(callback) {
    if (typeof callback === 'function') listeners.push(callback);
  }

  function onStorageWarning(callback) {
    if (typeof callback === 'function') storageListeners.push(callback);
  }

  function get() {
    return DATA;
  }

  function getLog() {
    return logCache;
  }

  function clearLog() {
    logCache = [];
    if (db) {
      try {
        var tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).clear();
      } catch (e) {}
    }
    try { localStorage.removeItem(FALLBACK_KEY); } catch (e) {}
  }

  function checkStorage() {
    try {
      var est = new Blob([JSON.stringify(logCache)]).size;
    } catch (e) {
      var est = logCache.length * 80;
    }
    var pct = 0;
    if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
      navigator.storage.estimate().then(function(q) {
        var qpct = q.quota > 0 ? Math.round(q.usage / q.quota * 100) : 0;
        for (var i = 0; i < storageListeners.length; i++) {
          try { storageListeners[i]({ entries: logCache.length, bytes: est, quotaPct: qpct }); } catch (e) {}
        }
      }).catch(function() {});
    }
    return { entries: logCache.length, bytes: est };
  }

  function getLogStats() {
    if (logCache.length === 0) return { entries: 0, firstEntry: null, days: 0, keys: {}, storage: checkStorage() };
    var first = logCache[0].t;
    var keys = {};
    for (var i = 0; i < logCache.length; i++) {
      var k = logCache[i].k;
      keys[k] = (keys[k] || 0) + 1;
    }
    return {
      entries: logCache.length,
      firstEntry: first,
      days: Math.round((Date.now() - first) / 86400000 * 10) / 10,
      keys: keys,
      storage: checkStorage()
    };
  }

  function exportLogCSV() {
    if (logCache.length === 0) return '';
    var csv = 'timestamp,source,data\n';
    for (var i = 0; i < logCache.length; i++) {
      var e = logCache[i];
      csv += new Date(e.t).toISOString() + ',' + e.k + ',"' + JSON.stringify(e.d).replace(/"/g, '""') + '"\n';
      if (csv.length > 5000000) break;
    }
    return csv;
  }

  function exportLogJSON() {
    return JSON.stringify(logCache, null, 2);
  }

  var originalNormalize = normalize;
  normalize = function(key, raw) {
    originalNormalize(key, raw);
    appendToLog(key, raw);
  };

  try { openDB(); } catch (e) {}
  try {
    var lfd = loadFromDB();
    if (lfd && typeof lfd.catch === 'function') lfd.catch(function() {});
  } catch (e) {}

  return {
    start: start, stop: stop, onUpdate: onUpdate, get: get,
    getLog: getLog, clearLog: clearLog, getLogStats: getLogStats,
    exportLogCSV: exportLogCSV, exportLogJSON: exportLogJSON,
    checkStorage: checkStorage, onStorageWarning: onStorageWarning
  };
})();
