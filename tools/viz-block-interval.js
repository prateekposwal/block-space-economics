var REDUCED_MOTION = (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
var VIZ_BlockInterval = (function () {
  'use strict';

  var BG = '#1A1612', PANEL = '#231F19', BORDER = '#3A3228';
  var ACCENT = '#F7931A', TEXT = 'rgba(255,255,255,0.7)', MUTED = '#6A5D4E';

  var canvas = null, ctx = null, w = 0, h = 0, dpr = 1;
  var points = [];        // [{t, avg, min, max}]
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
    h = w < 480 ? 240 : 280;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function load() {
    fetch('/data/block_interval.json').then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(function (d) {
      points = (d && Array.isArray(d.points)) ? d.points.filter(function (p) {
        return p && typeof p.avg === 'number';
      }) : [];
      loaded = true;
      failed = !points.length;
      draw();
    }).catch(function () {
      loaded = true; failed = true; draw();
    });
  }

  function timeLabel(t) {
    var dt = new Date(t);
    if (isNaN(dt.getTime())) return '';
    var hh = String(dt.getUTCHours()).padStart(2, '0');
    var mm = String(dt.getUTCMinutes()).padStart(2, '0');
    return hh + ':' + mm;
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
    ctx.fillText('Rolling Block Interval — avg / min / max', 16, 12);
    ctx.fillStyle = MUTED;
    ctx.font = '11px -apple-system, sans-serif';
    ctx.fillText('10-block rolling window per capture (seconds). Band = min–max, line = average.', 16, 32);

    if (!loaded) { drawPending('Loading block-interval data…'); return; }
    if (failed || points.length < 2) { drawPending('🟡 Data pending — no block-interval captures yet'); return; }

    var padL = 44, padR = 12, padT = 56, padB = 26;
    var plotW = w - padL - padR;
    var plotH = h - padT - padB;
    if (plotW < 40 || plotH < 20) return;

    var maxV = 0;
    points.forEach(function (p) {
      if (p.max > maxV) maxV = p.max;
      if (p.avg > maxV) maxV = p.avg;
    });
    if (maxV <= 0) maxV = 600;
    maxV = Math.ceil(maxV / 300) * 300;   // round up to a clean 5-min grid

    var yBase = padT + plotH;
    function py(v) { return yBase - (v / maxV) * plotH; }
    function px(i) { return padL + (points.length <= 1 ? 0 : i / (points.length - 1)) * plotW; }

    // Y grid + labels (seconds)
    ctx.strokeStyle = 'rgba(58,50,40,0.6)';
    ctx.lineWidth = 1;
    var ySteps = isMobile() ? 4 : 6;
    for (var s = 0; s <= ySteps; s++) {
      var v = maxV * s / ySteps;
      var y = py(v);
      ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(w - padR, y); ctx.stroke();
      ctx.fillStyle = MUTED;
      ctx.font = '10px -apple-system, sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(Math.round(v) + 's', padL - 5, y);
    }

    // min–max band
    ctx.beginPath();
    for (var i = 0; i < points.length; i++) {
      var x1 = px(i);
      if (i === 0) ctx.moveTo(x1, py(points[i].max)); else ctx.lineTo(x1, py(points[i].max));
    }
    for (var j = points.length - 1; j >= 0; j--) {
      ctx.lineTo(px(j), py(points[j].min));
    }
    ctx.closePath();
    ctx.fillStyle = 'rgba(247,147,26,0.10)';
    ctx.fill();

    // avg line
    ctx.beginPath();
    for (var k = 0; k < points.length; k++) {
      var x2 = px(k);
      if (k === 0) ctx.moveTo(x2, py(points[k].avg)); else ctx.lineTo(x2, py(points[k].avg));
    }
    ctx.strokeStyle = ACCENT;
    ctx.lineWidth = 2;
    ctx.stroke();

    // max line (thin, muted) + min line
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (var a = 0; a < points.length; a++) {
      var x3 = px(a);
      if (a === 0) ctx.moveTo(x3, py(points[a].max)); else ctx.lineTo(x3, py(points[a].max));
    }
    ctx.stroke();
    ctx.beginPath();
    for (var b = 0; b < points.length; b++) {
      var x4 = px(b);
      if (b === 0) ctx.moveTo(x4, py(points[b].min)); else ctx.lineTo(x4, py(points[b].min));
    }
    ctx.stroke();

    // X time labels (first, ~1/3, ~2/3, last)
    ctx.fillStyle = MUTED;
    ctx.font = '10px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    var labelIdx = [0, Math.floor(points.length / 3), Math.floor(points.length * 2 / 3), points.length - 1];
    labelIdx.forEach(function (li, idx) {
      ctx.fillText(timeLabel(points[li].t), px(li), yBase + 6);
    });

    // Live point on the latest real capture
    var lp = points[points.length - 1];
    var lpX = px(points.length - 1);
    var lpY = py(lp.avg);
    var lpR = 3 + (REDUCED_MOTION ? 0 : Math.sin(Date.now() / 1000 * 2.2) * 1.6);
    ctx.beginPath();
    ctx.arc(lpX, lpY, lpR + 6, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(247,147,26,0.15)';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(lpX, lpY, lpR, 0, Math.PI * 2);
    ctx.fillStyle = ACCENT;
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = '9px -apple-system, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText(Math.round(lp.avg) + 's avg', lpX + 6, lpY - 2);

    // Legend
    ctx.fillStyle = TEXT;
    ctx.font = '10px -apple-system, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('— avg · – – min/max', w - padR, padT - 20);
  }

  function drawPending(msg) {
    ctx.fillStyle = TEXT;
    ctx.font = (isMobile() ? '12px' : '14px') + ' -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(msg, w / 2, h / 2 + 8);
  }

  function loop() {
    try { draw(); } catch (e) { if (window.console) console.error('VIZ_BlockInterval draw:', e); }
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
  module.exports = { VIZ_BlockInterval: VIZ_BlockInterval };
}
