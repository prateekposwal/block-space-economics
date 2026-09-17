var VIZ = (function() {
  var anims = {};
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

  function start(id, drawFn, interval) {
    interval = interval || 50;
    _drawFns[id] = { fn: drawFn, interval: interval };
    if (REDUCED) { // render one static frame, don't loop
      try {
        var el = document.getElementById(id);
        if (el) drawFn(el.getContext('2d'), el.width, el.height, Date.now() / 1000);
      } catch (e) {}
      return;
    }
    if (anims[id]) clearInterval(anims[id]);
    anims[id] = setInterval(function() {
      var el = document.getElementById(id);
      if (!el) return;
      var ctx = el.getContext('2d');
      var w = el.width = el.clientWidth || window.innerWidth;
      var h = el.height = el.clientHeight || window.innerHeight;
      try { drawFn(ctx, w, h, Date.now() / 1000); } catch(e) {}
    }, interval);
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

  function pauseAll() {
    Object.keys(anims).forEach(function(id) {
      if (anims[id]) clearInterval(anims[id]);
    });
  }

  function resumeAll() {
    Object.keys(_drawFns).forEach(function(id) {
      var entry = _drawFns[id];
      if (entry) start(id, entry.fn, entry.interval);
    });
  }

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
