var REDUCED_MOTION = (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
var VIZ_MempoolHist = (function () {
  'use strict';

  var BG = '#1A1612', PANEL = '#231F19', BORDER = '#3A3228';
  var ACCENT = '#F7931A', TEXT = 'rgba(255,255,255,0.7)', MUTED = '#6A5D4E';

  var canvas = null, ctx = null, w = 0, h = 0, dpr = 1;
  var bins = [];          // [{rate, vsize}] — fee-RATE buckets
  var loaded = false, failed = false;
  var raf = 0;

  function isMobile() { return w < 480; }

  function resize() {
    if (!canvas) return;
    var parent = canvas.parentElement;
    var pw = parent ? parent.clientWidth : 0;
    if (!pw || pw < 100) pw = 800;
    dpr = Math.min(window.devicePixelRatio || 1, 3);
    w = Math.min(pw, 1400);
    h = w < 480 ? 260 : 280;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function load() {
    fetch('/data/mempool_fee_histogram.json').then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(function (d) {
      bins = (d && Array.isArray(d.histogram)) ? d.histogram.filter(function (b) {
        return b && typeof b.rate === 'number' && typeof b.vsize === 'number';
      }) : [];
      loaded = true;
      failed = !bins.length;
      draw();
    }).catch(function () {
      loaded = true; failed = true; draw();
    });
  }

  function fmtVsize(v) {
    if (v >= 1000000) return (v / 1000000).toFixed(1) + 'M';
    if (v >= 1000) return (v / 1000).toFixed(0) + 'K';
    return String(v);
  }

  function draw() {
    if (!ctx) return;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = '#EADCC8';
    ctx.font = 'bold 15px -apple-system, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('Mempool Fee-Rate Histogram', 16, 12);
    ctx.fillStyle = MUTED;
    ctx.font = '11px -apple-system, sans-serif';
    ctx.fillText('vsize per fee-rate bucket (sat/vB). This is a fee histogram — NOT transaction age: age data is not captured by the pipeline.', 16, 32);

    if (!loaded) { drawPending('Loading mempool data…'); return; }
    if (failed) { drawPending('🟡 Data pending — no mempool fee histogram captured yet'); return; }

    var padL = 48, padR = 12, padT = 56, padB = 26;
    var plotW = w - padL - padR;
    var plotH = h - padT - padB;
    if (plotW < 40 || plotH < 20) return;

    // Fee rates run 0.2–11 sat/vB; log-ish scale reads better for the long tail.
    var maxVsize = 0;
    bins.forEach(function (b) { if (b.vsize > maxVsize) maxVsize = b.vsize; });
    if (maxVsize <= 0) maxVsize = 1;

    var yBase = padT + plotH;
    function py(v) { return yBase - (v / maxVsize) * plotH; }
    function px(i) { return padL + (bins.length <= 1 ? 0 : i / (bins.length - 1)) * plotW; }

    // Y grid + labels (vsize)
    ctx.strokeStyle = 'rgba(58,50,40,0.6)';
    ctx.lineWidth = 1;
    var ySteps = isMobile() ? 4 : 5;
    for (var s = 0; s <= ySteps; s++) {
      var v = maxVsize * s / ySteps;
      var y = py(v);
      ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(w - padR, y); ctx.stroke();
      ctx.fillStyle = MUTED;
      ctx.font = '10px -apple-system, sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(fmtVsize(v), padL - 5, y);
    }

    // Bars
    var barW = Math.max(1, Math.min(6, plotW / bins.length * 0.8));
    bins.forEach(function (b, i) {
      var bx = px(i);
      var barH = (b.vsize / maxVsize) * plotH;
      var t = b.vsize / maxVsize;
      ctx.fillStyle = 'rgba(' + Math.round(247 - t * 40) + ',' + Math.round(147 - t * 60) + ',26,' + (0.45 + t * 0.55) + ')';
      ctx.fillRect(bx - barW / 2, yBase - barH, barW, barH);
    });

    // X labels — a few rate ticks
    ctx.fillStyle = MUTED;
    ctx.font = '10px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    var tickIdx = [0, Math.floor(bins.length / 3), Math.floor(bins.length * 2 / 3), bins.length - 1];
    tickIdx.forEach(function (ti) {
      ctx.fillText(bins[ti].rate + ' s/vB', px(ti), yBase + 6);
    });

    // Stats line
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = TEXT;
    ctx.font = '10px -apple-system, sans-serif';
    var peakIdx = 0;
    for (var bi = 1; bi < bins.length; bi++) { if (bins[bi].vsize > bins[peakIdx].vsize) peakIdx = bi; }
    var midRate = bins[Math.floor(bins.length / 2)].rate;
    ctx.fillText('peak ' + fmtVsize(maxVsize) + ' vbytes at ' + (bins[peakIdx].rate < midRate ? 'low' : 'high') + ' fee rates', w - padR, padT - 18);
  }

  function drawPending(msg) {
    ctx.fillStyle = TEXT;
    ctx.font = (isMobile() ? '12px' : '14px') + ' -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(msg, w / 2, h / 2 + 8);
  }

  function loop() {
    try { draw(); } catch (e) { if (window.console) console.error('VIZ_MempoolHist draw:', e); }
    if (REDUCED_MOTION) return;
    raf = requestAnimationFrame(loop);
  }

  function init(canvasId) {
    canvas = document.getElementById(canvasId);
    if (!canvas) return;
    resize();
    window.addEventListener('resize', function () { resize(); });
    load();
    if (REDUCED_MOTION) { draw(); return; }
    raf = requestAnimationFrame(loop);
  }

  function destroy() {
    if (raf) cancelAnimationFrame(raf);
  }

  return { init: init, destroy: destroy, resize: resize };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { VIZ_MempoolHist: VIZ_MempoolHist };
}
