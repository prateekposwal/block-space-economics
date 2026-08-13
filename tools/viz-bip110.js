var REDUCED_MOTION = (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
var VIZ_Bip110 = (function () {
  'use strict';

  var BG = '#1A1612', PANEL = '#231F19', BORDER = '#3A3228';
  var ACCENT = '#F7931A', TEXT = 'rgba(255,255,255,0.7)', MUTED = '#6A5D4E';
  var THRESHOLD = 55;

  var canvas = null, ctx = null, w = 0, h = 0, dpr = 1;
  var days = [];           // [{label, pct}]
  var loaded = false;
  var failed = false;
  var raf = 0;

  var MIRROR_URL = '/data/bip110_daily.json';
  var FALLBACK_URL = '/data/bip110.json';

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
    fetch(MIRROR_URL).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(function (d) {
      var list = (d && Array.isArray(d.daily)) ? d.daily : [];
      if (!list.length) { loaded = true; failed = true; draw(); return; }
      days = list.map(function (p) {
        return { label: (p.day || '').slice(5), pct: p.pct, blocks: p.blocks, signaling: p.signaling };
      });
      loaded = true;
      draw();
    }).catch(function () {
      // Fallback: bip110.json carries the same daily aggregation from the agent.
      return fetch(FALLBACK_URL).then(function (r) { return r.json(); }).then(function (d) {
        var list = (d && Array.isArray(d.daily)) ? d.daily : [];
        if (!list.length) { loaded = true; failed = true; draw(); return; }
        days = list.map(function (p) {
          return { label: (p.day || '').slice(5), pct: p.pct, blocks: p.blocks, signaling: p.signaling };
        });
        loaded = true;
        draw();
      }).catch(function () {
        loaded = true; failed = true; draw();
      });
    });
  }

  function draw() {
    if (!ctx) return;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, w, h);

    // Title
    ctx.fillStyle = '#EADCC8';
    ctx.font = 'bold 15px -apple-system, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('BIP-110 Daily Signaling — Bit 4 Share', 16, 12);
    ctx.fillStyle = MUTED;
    ctx.font = '11px -apple-system, sans-serif';
    ctx.fillText('Observed share of sampled blocks per day · threshold 55%', 16, 32);

    if (!loaded) {
      drawPending('Loading signaling data…');
      return;
    }
    if (failed || !days.length) {
      drawPending('🟡 Data pending — no BIP-110 captures yet');
      return;
    }

    var padL = 34, padR = 10, padT = 56, padB = 26;
    var plotW = w - padL - padR;
    var plotH = h - padT - padB;
    if (plotW < 40 || plotH < 20) return;

    var maxY = 100;
    var yTop = padT, yBase = padT + plotH;
    function py(v) { return yBase - (v / maxY) * plotH; }

    // Y grid + labels (0, 25, 50, 75, 100 + the 55% threshold)
    ctx.strokeStyle = 'rgba(58,50,40,0.6)';
    ctx.lineWidth = 1;
    [0, 25, 50, 75, 100].forEach(function (v) {
      var y = py(v);
      ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(w - padR, y); ctx.stroke();
      ctx.fillStyle = MUTED;
      ctx.font = '10px -apple-system, sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(v + '%', padL - 5, y);
    });

    // 55% threshold line (dashed, labelled)
    var yT = py(THRESHOLD);
    ctx.strokeStyle = 'rgba(248,81,73,0.85)';
    ctx.setLineDash([5, 4]);
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(padL, yT); ctx.lineTo(w - padR, yT); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#F85149';
    ctx.font = '10px -apple-system, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('55% lock-in threshold', padL + 4, yT - 4);

    // Bars
    var n = days.length;
    var slot = plotW / n;
    var barW = Math.max(4, Math.min(38, slot * 0.6));
    days.forEach(function (d, i) {
      var cx = padL + slot * i + slot / 2;
      var barH = (d.pct / maxY) * plotH;
      ctx.fillStyle = d.pct >= THRESHOLD ? '#3BA35D' : ACCENT;
      ctx.fillRect(cx - barW / 2, yBase - barH, barW, barH);
      // value on top of bar
      if (d.pct > 0) {
        ctx.fillStyle = TEXT;
        ctx.font = '10px -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(d.pct + '%', cx, yBase - barH - 3);
      }
      // day label
      ctx.fillStyle = MUTED;
      ctx.textBaseline = 'top';
      ctx.fillText(d.label, cx, yBase + 6);
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
    if (REDUCED_MOTION) { draw(); return; }
    draw();
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
  module.exports = { VIZ_Bip110: VIZ_Bip110 };
}
