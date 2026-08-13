var REDUCED_MOTION = (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
var VIZ_Hashrate = (function () {
  'use strict';

  var BG = '#1A1612', PANEL = '#231F19', BORDER = '#3A3228';
  var ACCENT = '#F7931A', TEXT = 'rgba(255,255,255,0.7)', MUTED = '#6A5D4E';

  var canvas = null, ctx = null, w = 0, h = 0, dpr = 1;
  var points = [];        // [{t, eh}]
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
    fetch('/data/hashrate.json').then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(function (d) {
      points = (d && Array.isArray(d.points)) ? d.points.filter(function (p) {
        return p && typeof p.eh === 'number';
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
    ctx.fillText('Network Hashrate — captured history (EH/s)', 16, 12);
    ctx.fillStyle = MUTED;
    ctx.font = '11px -apple-system, sans-serif';
    ctx.fillText('Instantaneous currentHashrate per capture · 1 EH/s = 10¹⁸ H/s', 16, 32);

    if (!loaded) { drawPending('Loading hashrate data…'); return; }
    if (failed || points.length < 2) { drawPending('🟡 Data pending — no hashrate captures yet'); return; }

    var padL = 48, padR = 12, padT = 56, padB = 26;
    var plotW = w - padL - padR;
    var plotH = h - padT - padB;
    if (plotW < 40 || plotH < 20) return;

    var minV = Infinity, maxV = 0;
    points.forEach(function (p) {
      if (p.eh < minV) minV = p.eh;
      if (p.eh > maxV) maxV = p.eh;
    });
    if (!isFinite(minV)) minV = 0;
    if (maxV === 0) maxV = 1;
    var span = maxV - minV;
    if (span < maxV * 0.1) { minV = Math.max(0, minV - span * 0.5); maxV = maxV + span * 0.5; span = maxV - minV; }
    if (span === 0) span = 1;

    var yBase = padT + plotH;
    function py(v) { return yBase - ((v - minV) / span) * plotH; }
    function px(i) { return padL + (points.length <= 1 ? 0 : i / (points.length - 1)) * plotW; }

    // Y grid + labels (EH/s)
    ctx.strokeStyle = 'rgba(58,50,40,0.6)';
    ctx.lineWidth = 1;
    var ySteps = isMobile() ? 4 : 5;
    for (var s = 0; s <= ySteps; s++) {
      var v = minV + span * s / ySteps;
      var y = py(v);
      ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(w - padR, y); ctx.stroke();
      ctx.fillStyle = MUTED;
      ctx.font = '10px -apple-system, sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(v.toFixed(0), padL - 5, y);
    }

    // Area fill
    ctx.beginPath();
    for (var i = 0; i < points.length; i++) {
      var x1 = px(i);
      if (i === 0) ctx.moveTo(x1, py(points[i].eh)); else ctx.lineTo(x1, py(points[i].eh));
    }
    ctx.lineTo(px(points.length - 1), yBase);
    ctx.lineTo(px(0), yBase);
    ctx.closePath();
    ctx.fillStyle = 'rgba(247,147,26,0.08)';
    ctx.fill();

    // Line
    ctx.beginPath();
    for (var k = 0; k < points.length; k++) {
      var x2 = px(k);
      if (k === 0) ctx.moveTo(x2, py(points[k].eh)); else ctx.lineTo(x2, py(points[k].eh));
    }
    ctx.strokeStyle = ACCENT;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Last value label
    var last = points[points.length - 1];
    ctx.fillStyle = ACCENT;
    ctx.font = 'bold 11px -apple-system, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText(last.eh.toFixed(1) + ' EH/s', px(points.length - 1) + 6, py(last.eh) - 2);

    // X time labels
    ctx.fillStyle = MUTED;
    ctx.font = '10px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    var labelIdx = [0, Math.floor(points.length / 3), Math.floor(points.length * 2 / 3), points.length - 1];
    labelIdx.forEach(function (li) {
      ctx.fillText(timeLabel(points[li].t), px(li), yBase + 6);
    });
  }

  function drawPending(msg) {
    ctx.fillStyle = TEXT;
    ctx.font = (isMobile() ? '12px' : '14px') + ' -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(msg, w / 2, h / 2 + 8);
  }

  function loop() {
    try { draw(); } catch (e) { if (window.console) console.error('VIZ_Hashrate draw:', e); }
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
  module.exports = { VIZ_Hashrate: VIZ_Hashrate };
}
