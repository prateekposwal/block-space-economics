var REDUCED_MOTION = (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
var VIZ_Send = (function() {
  var canvas, ctx, w, h;
  var PAD = { top: 60, right: 150, bottom: 50, left: 70 };
  var bars = [];
  var economyFee = 0;
  var displayEconomyFee = 0;
  var displayBtcPrice = 0;
  var btcPrice = 0;
  var hoverIdx = -1;
  var mouseX = 0, mouseY = 0;

  function isMobile() { return w < 480; }

  function init(canvasId) {
    canvas = document.getElementById(canvasId);
    if (!canvas) return;
    ctx = canvas.getContext('2d');
    resize();
    window.addEventListener('resize', resize);
    canvas.addEventListener('mousemove', onMove);
    canvas.addEventListener('mouseleave', onLeave);
    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd);
    if (typeof DATA_ENGINE !== 'undefined') {
      DATA_ENGINE.onUpdate(function() {
        var s = DATA_ENGINE.get();
        bars = (s.fee_history || []).slice(-144);
        economyFee = s.fees.economyFee || 0;
        btcPrice = s.btc_price || 0;
      });
      displayEconomyFee = economyFee;
      displayBtcPrice = btcPrice;
    }
    tick();
  }

  function resize() {
    var r = VIZ.responsiveSize(canvas, 600);
    w = r.w;
    h = r.h;
    ctx = r.ctx;
    if (isMobile()) PAD.right = 80;
    else PAD.right = 120;
  }

  function onMove(e) {
    var r = canvas.getBoundingClientRect();
    mouseX = e.clientX - r.left;
    mouseY = e.clientY - r.top;
    var i = hitTest(mouseX, mouseY);
    if (i !== hoverIdx) { hoverIdx = i; }
  }

  function onLeave() { hoverIdx = -1; }

  function onTouchStart(e) {
    e.preventDefault();
    var r = canvas.getBoundingClientRect();
    var t = e.touches[0];
    mouseX = t.clientX - r.left;
    mouseY = t.clientY - r.top;
    var i = hitTest(mouseX, mouseY);
    if (i !== hoverIdx) { hoverIdx = i; }
  }

  function onTouchMove(e) {
    e.preventDefault();
    var r = canvas.getBoundingClientRect();
    var t = e.touches[0];
    mouseX = t.clientX - r.left;
    mouseY = t.clientY - r.top;
    var i = hitTest(mouseX, mouseY);
    if (i !== hoverIdx) { hoverIdx = i; }
  }

  function onTouchEnd() {
    setTimeout(function() { hoverIdx = -1; }, 2000);
  }

  function hitTest(mx) {
    var n = bars.length;
    if (n === 0) return -1;
    var cw = (w - PAD.left - PAD.right) / n;
    var i = Math.floor((mx - PAD.left) / cw);
    if (i < 0 || i >= n) return -1;
    return i;
  }

  function tick() {
    if (!ctx) return;
    try {
    displayEconomyFee += (economyFee - displayEconomyFee) * 0.05;
    displayBtcPrice += (btcPrice - displayBtcPrice) * 0.05;
    ctx.clearRect(0, 0, w, h);
    var n = bars.length;
    if (n === 0) {
      // Honest empty state: tell the visitor data is coming instead of a
      // blank canvas. Loop keeps running so the chart appears when the first
      // capture arrives.
      ctx.fillStyle = '#1A1612';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.font = (isMobile() ? '12px' : '14px') + ' -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Fee data pending — the chart renders when the first capture arrives', w / 2, h / 2);
      if (!REDUCED_MOTION) requestAnimationFrame(tick);
      return;
    }

    var cL = PAD.left, cR = w - PAD.right;
    var cT = PAD.top, cB = h - PAD.bottom;
    var cW = cR - cL, cH = cB - cT;

    var maxF = 1;
    for (var i = 0; i < n; i++) {
      var fr = (typeof bars[i].avgFeeRate === 'number') ? bars[i].avgFeeRate : 0; // REAL sat/vB
      if (fr > maxF) maxF = fr;
    }
    maxF = Math.ceil(maxF * 1.15) || 1;

    ctx.fillStyle = '#1A1612';
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = '#F0F0F0';
    ctx.font = (isMobile() ? '15px' : '18px') + ' -apple-system, "SF Pro Display", Helvetica, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('Last 24 Hours of Bitcoin Fees', cL, 16);

    ctx.strokeStyle = 'rgba(255,255,255,0.07)';
    ctx.lineWidth = 1;
    var ySteps = 5;
    for (var i = 0; i <= ySteps; i++) {
      var v = (maxF / ySteps) * i;
      var y = cB - (v / maxF) * cH;
      ctx.beginPath();
      ctx.moveTo(cL, y);
      ctx.lineTo(cR, y);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.font = (isMobile() ? '9px' : '11px') + ' -apple-system, Helvetica, sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(v < 1 ? v.toFixed(1) : v.toFixed(0), cL - 8, y);
    }

    ctx.save();
    ctx.translate(14, cT + cH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.font = (isMobile() ? '9px' : '11px') + ' -apple-system, Helvetica, sans-serif';
    ctx.fillText('sat/vB', 0, 0);
    ctx.restore();

    if (displayEconomyFee > 0) {
      var ecoY = cB - (displayEconomyFee / maxF) * cH;
      if (ecoY >= cT && ecoY <= cB) {
        ctx.strokeStyle = 'rgba(46, 160, 67, 0.5)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.moveTo(cL, ecoY);
        ctx.lineTo(cR, ecoY);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(46, 160, 67, 0.8)';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        ctx.font = '10px -apple-system, Helvetica, sans-serif';
        ctx.fillText('Economy ' + displayEconomyFee.toFixed(1) + ' sat/vB', cR + 6, ecoY - 2);
      }
    }

    var now = Date.now();
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '10px -apple-system, Helvetica, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (var i = 0; i <= 4; i++) {
      var t = now - (4 - i) * 6 * 3600000;
      var d = new Date(t);
      var hh = d.getHours();
      var a = hh >= 12 ? 'PM' : 'AM';
      hh = hh % 12 || 12;
      ctx.fillText(hh + a, cL + (i / 4) * cW, cB + 8);
    }

    var bw = cW / n;
    var waveT = Date.now() / 1000;
    for (var i = 0; i < n; i++) {
      var fr = (typeof bars[i].avgFeeRate === 'number') ? bars[i].avgFeeRate : 0; // REAL sat/vB
      var wave = Math.sin(waveT * 0.6 + i * 0.08) * 0.04 + 0.96;
      var bh = (fr / maxF) * cH * wave;
      var x = cL + i * bw;
      var y = cB - bh;
      var p = Math.min(1, fr / (maxF * 0.7));
      var r, g, b;
      if (p < 0.33) {
        var t = p / 0.33;
        r = Math.round(63 + t * (209 - 63));
        g = Math.round(185 + t * (190 - 185));
        b = Math.round(80 + t * (70 - 80));
      } else if (p < 0.66) {
        var t = (p - 0.33) / 0.33;
        r = Math.round(209 + t * (248 - 209));
        g = Math.round(190 + t * (144 - 190));
        b = Math.round(70 + t * (49 - 70));
      } else {
        var t = Math.min(1, (p - 0.66) / 0.34);
        r = 248;
        g = Math.round(144 - t * (144 - 81));
        b = Math.round(49 + t * (73 - 49));
      }
      var hi = (i === hoverIdx);
      if (hi) {
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.fillRect(x, cT, bw, cH);
      }
      ctx.globalAlpha = hi ? 1 : 0.8;
      ctx.fillStyle = 'rgb(' + r + ',' + g + ',' + b + ')';
      ctx.fillRect(Math.round(x) + 0.5, Math.round(y), Math.max(1, Math.round(bw) - 1), Math.round(bh));
      ctx.globalAlpha = 1;
    }

    var lx = cR + 10, ly = cT + 10;
    var items = [
      { label: 'Low', color: '#3FB950' },
      { label: 'Medium', color: '#D29922' },
      { label: 'High', color: '#F85149' }
    ];
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    for (var i = 0; i < items.length; i++) {
      var yy = ly + i * 22;
      ctx.fillStyle = items[i].color;
      ctx.fillRect(lx, yy, 10, 10);
      ctx.fillStyle = 'rgba(255,255,255,0.65)';
      ctx.font = (isMobile() ? '9px' : '11px') + ' -apple-system, Helvetica, sans-serif';
      ctx.fillText(items[i].label, lx + 16, yy + 5);
    }

    if (hoverIdx >= 0 && hoverIdx < n) {
      var e = bars[hoverIdx];
      var fr = (typeof e.avgFeeRate === 'number') ? e.avgFeeRate : null; // REAL sat/vB, '--' when absent
      var ts = e.timestamp != null ? e.timestamp : e.date ? new Date(e.date).getTime() / 1000 : 0;
      var d = new Date(ts * 1000);
      var feeUSD = (fr != null && btcPrice > 0) ? (fr * btcPrice) / 100000000 : null;
      var tw = isMobile() ? 180 : 210, th = 86;
      var tx = mouseX + 16, ty = mouseY - 12;
      if (tx + tw > w - 8) tx = mouseX - tw - 16;
      if (ty + th > h - 8) ty = h - th - 8;
      if (ty < 8) ty = 8;

      ctx.fillStyle = 'rgba(16,14,10,0.96)';
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.lineWidth = 1;
      VIZ.roundRect(ctx, tx, ty, tw, th, 6);
      ctx.fill();
      ctx.stroke();

      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.font = (isMobile() ? '9px' : '11px') + ' -apple-system, Helvetica, sans-serif';
      ctx.fillText(
        d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' +
        d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        tx + 12, ty + 10
      );
      ctx.fillStyle = '#F0F0F0';
      ctx.font = (isMobile() ? 'bold 15px' : 'bold 18px') + ' -apple-system, Helvetica, sans-serif';
      ctx.fillText(fr != null ? fr.toFixed(1) + ' sat/vB' : '--', tx + 12, ty + 28);
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.font = (isMobile() ? '10px' : '12px') + ' -apple-system, Helvetica, sans-serif';
      ctx.fillText(feeUSD != null ? '$' + feeUSD.toFixed(2) + ' USD/vB' : 'USD --', tx + 12, ty + 54);
    }

    } catch (e) {}
    if (!REDUCED_MOTION) requestAnimationFrame(tick);
  }

  return { init: init, resize: resize };
})();
