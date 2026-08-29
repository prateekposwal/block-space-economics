/* BSAHI Service Worker — precaches the static shell ONLY.
   Live data (/data/*, live_data.json) is network-first and never precached. */
var CACHE = 'bsahi-shell-v5';
var PRECACHE = [
  '/', '/live', '/learn', '/capacity', '/fork-tracker', '/research',
  '/story.html', '/articles.html', '/beta.html',
  '/tools/data-engine.js', '/tools/viz-core.js', '/tools/viz-fees.js',
  '/tools/viz-send.js', '/tools/viz-lightning.js', '/tools/viz-exchange.js',
  '/tools/viz-node.js', '/tools/viz-miner.js', '/tools/viz-research.js',
  '/tools/viz-developer.js', '/tools/viz-bip110.js', '/tools/viz-block-interval.js',
  '/tools/viz-hashrate.js', '/tools/viz-fee-heatmap.js', '/tools/viz-mempool-hist.js',
  '/js/beta-gate.js', '/js/beta-nav.js', '/js/data-health.js', '/js/data-health-config.js'
];

self.addEventListener('install', function(e) {
  e.waitUntil(caches.open(CACHE).then(function(c) { return c.addAll(PRECACHE); })
    .then(function() { return self.skipWaiting(); }));
});

self.addEventListener('activate', function(e) {
  e.waitUntil(caches.keys().then(function(keys) {
    return Promise.all(keys.filter(function(k) { return k !== CACHE; }).map(function(k) { return caches.delete(k); }));
  }).then(function() { return self.clients.claim(); }));
});

self.addEventListener('fetch', function(e) {
  if (e.request.method !== 'GET') return;
  var url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  var isData = /\/data\//.test(url.pathname) || /\/tools\/live_data\.json/.test(url.pathname);
  if (isData) {
    // Live data: network-first, cache fallback (never precached).
    e.respondWith(fetch(e.request).then(function(r) {
      var copy = r.clone();
      caches.open(CACHE).then(function(c) { c.put(e.request, copy); }).catch(function() {});
      return r;
    }).catch(function() { return caches.match(e.request); }));
    return;
  }
  // Shell (HTML + JS/CSS): NETWORK-FIRST with cache fallback. The old
  // cache-first strategy served the stale shell forever — returning users never
  // received deployed updates, which read as "live data is not updating".
  // Network-first guarantees deploys reach users on the next visit while the
  // cache still provides an offline fallback when the network fails.
  e.respondWith(fetch(e.request).then(function(r) {
    if (r && r.ok) {
      var copy = r.clone();
      caches.open(CACHE).then(function(c) { c.put(e.request, copy); }).catch(function() {});
    }
    return r;
  }).catch(function() {
    return caches.match(e.request).then(function(cached) { return cached || Response.error(); });
  }));
});
