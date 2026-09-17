var VIZ = (function() {
  var _drawFns = {};  // module-local registry — never self-reference VIZ inside the IIFE
  var REDUCED = (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  function create(id, opts) {
    opts = opts || {};
    var el = document.getElementById(id);
    if (!el) return null;
    var ctx = el.getContext('2d');
    var w = el.width = el.clientWidth || window.innerWidth;
    var h = el.height = opts.height || window.innerHeight;
    return { el: el, ctx: ctx, w: w, h: h };
  }

  // Only paint canvases that are actually on screen. /live runs ~13 painters at
  // 50ms; most are below the fold, so gating the draw on intersection removes
  // the majority of the main-thread work without changing what the user sees.
  var _vis = {};
  var _io = (typeof IntersectionObserver !== 'undefined')
    ? new IntersectionObserver(function (entries) {
        for (var i = 0; i < entries.length; i++) _vis[entries[i].target.id] = entries[i].isIntersecting;
      }, { rootMargin: '150px' })
    : null;

  // ONE rAF loop drives every canvas. /live used to create a setInterval per
  // painter (13 timers); a single loop that paints each canvas only when its
  // interval has elapsed — and only when it is on screen — removes that timer
  // churn and lets the browser coalesce all paints into one frame.
  var _rafId = null;
  var _running = false;
  var _last = {};   // id -> last paint timestamp

  function _tick(now) {
    if (!_running) return;
    var ids = Object.keys(_drawFns);
    for (var i = 0; i < ids.length; i++) {
      var id = ids[i], e = _drawFns[id];
      if (!e) continue;
      if (_vis[id] === false) continue;                       // off-screen
      if (now - (_last[id] || 0) < e.interval) continue;       // not due yet
      _last[id] = now;
      var el = document.getElementById(id);
      if (!el) continue;
      var ctx = el.getContext('2d');
      var w = el.width = el.clientWidth || window.innerWidth;
      var h = el.height = el.clientHeight || window.innerHeight;
      try { e.fn(ctx, w, h, now / 1000); } catch (err) {}
    }
    _rafId = requestAnimationFrame(_tick);
  }

  function _ensureLoop() {
    if (_running || typeof requestAnimationFrame === 'undefined') return;
    _running = true;
    _rafId = requestAnimationFrame(_tick);
  }

  function _stopLoop() {
    _running = false;
    if (_rafId && typeof cancelAnimationFrame !== 'undefined') cancelAnimationFrame(_rafId);
    _rafId = null;
  }

  function start(id, drawFn, interval) {
    interval = interval || 50;
    _drawFns[id] = { fn: drawFn, interval: interval };
    if (REDUCED) { // render one static frame, don't loop
      try {
        var el0 = document.getElementById(id);
        if (el0) drawFn(el0.getContext('2d'), el0.width, el0.height, Date.now() / 1000);
      } catch (e) {}
      return;
    }
    var _el = document.getElementById(id);
    if (_el && _io) _io.observe(_el);
    _ensureLoop();
  }

  function responsiveSize(canvas, maxHeight) {
    var parent = canvas.parentElement;
    var pw = parent ? parent.clientWidth : window.innerWidth;
    if (!pw || pw < 100) pw = window.innerWidth;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = Math.min(pw, 1600);
    var baseH = maxHeight || 350;
    var h = w < 480 ? Math.min(250, baseH) : w < 768 ? Math.min(350, baseH) : baseH;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    var ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    return { w: w, h: h, ctx: ctx };
  }

  function feeColor(fee) {
    var p = Math.min(1, Math.max(0, (fee || 0) / 50));
    return {
      r: Math.round(p * 248 + (1-p) * 63),
      g: Math.round((1-p) * 185 + p * 81),
      b: Math.round((1-p) * 80 + p * 73)
    };
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function pauseAll() { _stopLoop(); }
  function resumeAll() { if (!REDUCED) _ensureLoop(); }

  function register(id, fn, interval) {
    _drawFns[id] = { fn: fn, interval: interval || 50 };
  }

  // Auto-pause all canvas loops when the tab is hidden (performance + battery).
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', function() {
      if (document.hidden) pauseAll();
      else if (!REDUCED) resumeAll();
    });
  }

  return { create: create, start: start, responsiveSize: responsiveSize, feeColor: feeColor, roundRect: roundRect, pauseAll: pauseAll, resumeAll: resumeAll, register: register };
})();
