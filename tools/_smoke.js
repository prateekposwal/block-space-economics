#!/usr/bin/env node
/* BSAHI page smoke test — the regression tripwire.
 *
 * Stubs document/canvas/DATA_ENGINE/fetch and loads EVERY page's inline script
 * plus every viz module in a VM context (top-level vars become window props,
 * exactly like browser globals), then asserts:
 *   A) no uncaught exception during script load + boot sequence
 *   B) DATA_ENGINE listeners never throw when data flows
 *   C) the miner animation loop survives the empty-data state and draws the
 *      real chart once fee_history arrives (the dead-loop regression)
 *
 * Usage: node tools/_smoke.js [rootDir]   (default: repo root)
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = process.argv[2] || path.join(__dirname, '..');
const DATA = {};
try {
  DATA.block_interval = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/block_interval.json'), 'utf8'));
  DATA.hashrate = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/hashrate.json'), 'utf8'));
  DATA.mempool_fee_histogram = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/mempool_fee_histogram.json'), 'utf8'));
  DATA.fee_history_blocks = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/fee_history_blocks.json'), 'utf8'));
  DATA.bip110_daily = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/bip110_daily.json'), 'utf8'));
  DATA.snapshot = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/snapshot.json'), 'utf8'));
} catch (e) { console.error('cannot load data mirrors:', e.message); process.exit(1); }

let failures = 0, checks = 0;
function check(name, ok, detail) {
  checks++;
  if (!ok) failures++;
  console.log((ok ? '  PASS ' : '  FAIL ') + name + (detail ? ' — ' + detail : ''));
}

// ---------------------------------------------------------------- stubs
function makeCtx(id) {
  const grad = { addColorStop: () => {} };
  const count = { fills: 0, texts: 0 };
  const ctx = {
    _count: count,
    canvas: null, scale: () => {}, clearRect: () => {}, fillRect: () => { count.fills++; },
    strokeRect: () => {}, beginPath: () => {}, moveTo: () => {}, lineTo: () => {},
    closePath: () => {}, fill: () => {}, stroke: () => {}, arc: () => {},
    fillText: () => { count.texts++; }, createRadialGradient: () => grad,
    createLinearGradient: () => grad, setLineDash: () => {}, setTransform: () => {},
    save: () => {}, restore: () => {}, translate: () => {}, rotate: () => {},
    quadraticCurveTo: () => {}, drawImage: () => {},
    getImageData: () => ({ data: new Uint8ClampedArray(4) }),
    measureText: () => ({ width: 10 }),
    fillStyle: '', strokeStyle: '', lineWidth: 1, globalAlpha: 1, font: '',
    textAlign: '', textBaseline: '', shadowColor: '', shadowBlur: 0
  };
  return ctx;
}

function makeEl(id) {
  const el = {
    id, width: 800, height: 400, style: {}, clientWidth: 800, clientHeight: 400,
    parentElement: null, parentNode: null, nextSibling: null, className: '', textContent: '', innerHTML: '', href: '',
    setAttribute: () => {}, getAttribute: () => null,
    appendChild: () => {}, insertBefore: () => {}, remove: () => {}, click: () => {},
    addEventListener: () => {}, removeEventListener: () => {},
    classList: { add: () => {}, remove: () => {}, toggle: () => {} },
    getBoundingClientRect: () => ({ width: 800, height: 700, left: 0, top: 0 }),
    getContext: () => { if (!el._ctx) el._ctx = makeCtx(id); return el._ctx; },
    _ctx: null
  };
  return el;
}

const listeners = {};
const domById = {};
const rafQueue = [];
let rafCount = 0;

function makeEnv() {
  const env = {};
  env.console = console;
  env.setTimeout = setTimeout; env.clearTimeout = clearTimeout;
  env.setInterval = () => 0; env.clearInterval = () => {};
  env.requestAnimationFrame = (fn) => { rafCount++; rafQueue.push(fn); return rafCount; };
  env.cancelAnimationFrame = () => {};
  env.AbortSignal = { timeout: () => ({}) };
  env.Blob = class {};
  env.URL = { createObjectURL: () => 'blob:x', revokeObjectURL: () => {} };
  env.atob = (s) => Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('binary');
  env.btoa = (s) => Buffer.from(s).toString('base64');
  env.location = { href: 'https://bitcoinsahi.com/live', hostname: 'bitcoinsahi.com', origin: 'https://bitcoinsahi.com', pathname: '/live' };
  env.navigator = { storage: undefined, serviceWorker: undefined };
  const ls = {};
  env.localStorage = { getItem: k => (k in ls ? ls[k] : null), setItem: (k, v) => { ls[k] = String(v); }, removeItem: k => { delete ls[k]; } };
  env.sessionStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
  env.indexedDB = undefined;
  env.WebSocket = function () { this.onmessage = null; this.onclose = null; this.onerror = null; };
  env.XMLHttpRequest = function () {
    this.open = () => {}; this.timeout = 0; this.status = 0; this.responseText = '';
    this.send = () => { setTimeout(() => this.onerror && this.onerror(), 0); };
  };
  env.fetch = (url) => new Promise((resolve, reject) => {
    const u = String(url);
    setTimeout(() => {
      const hit = (body) => resolve({ ok: true, json: () => Promise.resolve(body) });
      if (u.includes('data/block_interval.json')) return hit(DATA.block_interval);
      if (u.includes('data/hashrate.json')) return hit(DATA.hashrate);
      if (u.includes('data/mempool_fee_histogram.json')) return hit(DATA.mempool_fee_histogram);
      if (u.includes('data/fee_history_blocks.json')) return hit(DATA.fee_history_blocks);
      if (u.includes('data/bip110_daily.json')) return hit(DATA.bip110_daily);
      if (u.includes('data/snapshot.json')) return hit(DATA.snapshot);
      if (u.includes('data/bip110.json')) return hit({ ok: true, height: 962200, window: { start: 961632, end: 963647, lockIn: 963648, blocksUntilLockIn: 1448, inWindow: true }, signaling: [], signalingSharePct: 2, windowTotal: 100, windowSignaling: 2, observedAt: new Date().toISOString() });
      if (u.includes('data/sccr_history.json')) return hit({ payload: [{ date: '2026-08-13', avg_sccr: 0.24, below_1x_pct: 100 }] });
      if (u.includes('data/sccr.json')) return hit({ N: 5000, generated_at: new Date().toISOString() });
      if (u.includes('mempool.space') || u.includes('blockstream.info')) return resolve({ ok: false, status: 0 });
      return hit({});
    }, 0);
  });
  env.matchMedia = () => ({ matches: false });
  env.performance = { now: () => Date.now() };
  env.devicePixelRatio = 1;
  env.innerWidth = 1440; env.innerHeight = 900;
  env.addEventListener = (t, fn) => { (listeners[t] = listeners[t] || []).push(fn); };
  env.removeEventListener = () => {};
  env.dispatchEvent = (t) => { (listeners[t] || []).slice().forEach(fn => fn()); };

  env.document = {
    readyState: 'loading',
    hidden: false,
    documentElement: { clientWidth: 1440, clientHeight: 900 },
    title: '',
    body: { appendChild: () => {}, getAttribute: () => null, style: {} },
    head: { appendChild: () => {} },
    getElementById: (id) => {
      if (!domById[id]) { domById[id] = makeEl(id); domById[id].parentElement = { clientWidth: 800, getBoundingClientRect: () => ({ width: 800, height: 700 }) }; }
      return domById[id];
    },
    querySelector: () => null,
    querySelectorAll: () => { const a = []; a.forEach = () => {}; return a; },
    createElement: (tag) => { const e = makeEl(tag); e.tag = tag; return e; },
    createTextNode: () => ({}),
    addEventListener: (t, fn) => { (listeners[t] = listeners[t] || []).push(fn); },
    removeEventListener: () => {}
  };

  const engListeners = [];
  env.DATA_ENGINE = {
    start: () => {}, stop: () => {},
    onUpdate: (cb) => engListeners.push(cb),
    get: () => env._engineData,
    getLog: () => [], clearLog: () => {},
    getLogStats: () => ({ entries: 0, firstEntry: null, days: 0, keys: {}, storage: { entries: 0, bytes: 0 } }),
    exportLogCSV: () => '', exportLogJSON: () => '[]',
    checkStorage: () => ({ entries: 0, bytes: 0 }),
    onStorageWarning: () => {}
  };
  env._engineData = {
    fees: { fastestFee: 0, halfHourFee: 0, hourFee: 0, economyFee: 0, minimumFee: 0 },
    btc_price: 0, mempool: { count: 0, vsize: 0, fee_histogram: [] }, mempool_blocks: [],
    fee_history: [], lightning: { channel_count: 0, node_count: 0, total_capacity: 0, avg_fee_rate: 0 },
    blocks: [], block_height: 0, last_updated: null
  };
  env._engListeners = engListeners;
  env.window = env; // window IS the global object, like a browser page
  return env;
}

function extractInline(htmlPath) {
  const html = fs.readFileSync(htmlPath, 'utf8');
  const out = [];
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/g;
  let m;
  while ((m = re.exec(html))) {
    const attrs = m[1] || '';
    if (/\bsrc\s*=/i.test(attrs)) continue;                       // external — loaded separately
    const type = /\btype\s*=\s*["']([^"']*)["']/i.exec(attrs);
    if (type && type[1] && !/javascript/i.test(type[1])) continue;  // ld+json etc — skip
    const code = m[2];
    if (/serviceWorker/i.test(code)) continue;                      // sw registration — not needed
    out.push(code);
  }
  return out;
}

function run(root, label) {
  console.log('\n=== SMOKE ' + label + ' ===');
  for (const k of Object.keys(domById)) delete domById[k];
  Object.keys(listeners).forEach(k => delete listeners[k]);
  rafQueue.length = 0; rafCount = 0;
  const env = makeEnv();
  const ctx = vm.createContext(env);

  const pageOrder = ['live.html', 'index.html', 'story.html', 'fork-tracker.html', 'capacity.html'];
  const vizOrder = ['data-engine.js', 'viz-core.js', 'viz-fees.js', 'viz-send.js', 'viz-lightning.js', 'viz-exchange.js',
    'viz-node.js', 'viz-miner.js', 'viz-research.js', 'viz-block-interval.js', 'viz-hashrate.js',
    'viz-fee-heatmap.js', 'viz-mempool-hist.js', 'viz-developer.js', 'viz-bip110.js'];

  try {
    for (const f of vizOrder) {
      const p = path.join(root, 'tools', f);
      if (fs.existsSync(p)) vm.runInContext(fs.readFileSync(p, 'utf8') + '\n//# sourceURL=' + f, ctx);
    }
    for (const page of pageOrder) {
      const p = path.join(root, page);
      if (!fs.existsSync(p)) continue;
      for (const code of extractInline(p)) {
        vm.runInContext(code + '\n//# sourceURL=' + page + '#inline', ctx);
      }
    }
    check('all scripts load without throwing', true);
  } catch (e) {
    check('all scripts load without throwing', false, e.message);
    return;
  }

  // boot
  let bootErr = null;
  try {
    env.document.readyState = 'interactive';
    (listeners['DOMContentLoaded'] || []).slice().forEach(fn => fn());
    (listeners['load'] || []).slice().forEach(fn => fn());
  } catch (e) { bootErr = e.message; }
  check('boot (DOMContentLoaded/load) without throwing', !bootErr, bootErr || '');

  // A) window props that the page expects to exist (module registration intact)
  const expected = ['VIZ', 'VIZ_Send', 'VIZ_Lightning', 'VIZ_Exchange', 'VIZ_Node', 'VIZ_Miner',
    'VIZ_Research', 'VIZ_BlockInterval', 'VIZ_Hashrate', 'VIZ_FeeHeatmap', 'VIZ_MempoolHist', 'VIZ_Fees',
    'VIZ_Developer', 'VIZ_Bip110', 'DATA_ENGINE'];
  const missing = expected.filter(n => !(n in env));
  check('all viz modules registered on window', missing.length === 0, missing.join(', '));

  // B) listeners must not throw when live data flows
  env._engineData.fee_history = [
    { timestamp: Date.now() / 1000, avgFees: 7000000 },
    { timestamp: Date.now() / 1000 - 600, avgFees: 5000000 },
    { timestamp: Date.now() / 1000 - 1200, avgFees: 9000000 }
  ];
  env._engineData.btc_price = 64000;
  env._engineData.fees = { fastestFee: 2, halfHourFee: 1, hourFee: 1, economyFee: 1, minimumFee: 1 };
  env._engineData.mempool = { count: 20000, vsize: 90000000, fee_histogram: [[1, 500], [2, 300]] };
  env._engineData.block_height = 962193;
  let listenerErr = null;
  for (const cb of env._engListeners.slice()) { try { cb(env._engineData); } catch (e) { listenerErr = e.message; break; } }
  check('DATA_ENGINE listeners do not throw on update', !listenerErr, listenerErr || '');

  // C) miner loop survives empty-data init and renders the real chart after
  //    data arrives. Count the miner canvas draw calls after running rAF ticks.
  const minerCtx = domById['viz-miner'] && domById['viz-miner']._ctx;
  const beforeTicks = rafCount;
  // run a bounded number of rAF ticks
  let guard = 0;
  while (rafQueue.length && guard++ < 60) {
    const fns = rafQueue.splice(0);
    for (const fn of fns) { try { fn(); } catch (e) { check('rAF tick does not throw', false, e.message); return; } }
  }
  const minerScheduled = rafCount > beforeTicks;
  check('miner loop keeps scheduling frames (not dead after empty-data init)', minerScheduled);
  const fills = minerCtx ? minerCtx._count.fills : 0;
  const texts = minerCtx ? minerCtx._count.texts : 0;
  check('miner canvas drew real chart content (fills>2, texts>2)', fills > 2 && texts > 2, 'fills=' + fills + ' texts=' + texts);

  // D) every new chart module rendered something (fetch mirrors resolved)
  const chartIds = ['viz-block-interval', 'viz-hashrate', 'viz-fee-heatmap', 'viz-mempool-hist', 'viz-bip110-daily', 'viz-lightning'];
  const blank = chartIds.filter(id => { const e = domById[id]; return !e || !e._ctx || (e._ctx._count.fills + e._ctx._count.texts) === 0; });
  check('new chart canvases drew (mirror data reached draw())', blank.length === 0, 'blank: ' + blank.join(','));

  console.log((failures === 0 ? '  ▶ PASS' : '  ▶ FAIL') + ' — ' + label + ' (' + checks + ' checks)');
}

const beforeRoot = '/var/folders/gp/cdz5rt_s51l5531582d062kc0000gn/T/opencode/before';
run(ROOT, 'AFTER (fixed)');
if (fs.existsSync(beforeRoot)) run(beforeRoot, 'BEFORE (git HEAD)');
console.log('\nTOTAL FAILURES: ' + failures);
process.exit(failures > 0 ? 1 : 0);
