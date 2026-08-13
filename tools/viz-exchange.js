var REDUCED_MOTION = (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
var VIZ_Exchange = (function() {
  var canvas, ctx, w = 0, h = 0;
  // Data inputs seed at 0 — real engine values replace them on first update.
  // (2026-08-14 honesty fix: seeds were fabricated 3 sat/vB / $60,000 and the
  // chart rendered plausible dollar savings from invented inputs. Now missing
  // data renders '—' via dataReady below.)
  var economyFee = 0;
  var displayEconomyFee = 0;
  var btcPrice = 0;
  var displayBtcPrice = 0;
  var batchDiscount = 0.60;
  var isDragging = false;
  var tooltipData = null;

  function isMobile() { return w < 480; }

  function init(canvasId) {
    canvas = document.getElementById(canvasId);
    if (!canvas) return;
    ctx = canvas.getContext('2d');
    resize();
    window.addEventListener('resize', resize);

    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('mouseleave', onMouseUp);

    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd);
    canvas.addEventListener('touchcancel', onTouchEnd);

    if (typeof DATA_ENGINE !== 'undefined') {
      var de = DATA_ENGINE;
      var data = de.get();
      if (data.fees && data.fees.economyFee) economyFee = data.fees.economyFee;
      if (data.btc_price) btcPrice = data.btc_price;
      de.onUpdate(function() {
        var d = de.get();
        if (d && d.fees && d.fees.economyFee) economyFee = d.fees.economyFee;
        if (d && d.btc_price) btcPrice = d.btc_price;
      });
    }

    loop();
  }

  function resize() {
    var r = VIZ.responsiveSize(canvas, isMobile() ? 520 : 560);
    w = r.w;
    h = r.h;
    ctx = r.ctx;
  }

  function draw() {
    displayEconomyFee += (economyFee - displayEconomyFee) * 0.05;
    displayBtcPrice += (btcPrice - displayBtcPrice) * 0.05;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#1A1612';
    ctx.fillRect(0, 0, w, h);

    var t = Date.now() / 1000;
    var mob = isMobile();
    // Honest gate: dollar figures only render when REAL fee + price arrived.
    var dataReady = displayBtcPrice > 0 && displayEconomyFee > 0;
    function usd(v) { return dataReady ? '$' + v.toFixed(0) : '—'; }

    var individualCost = 150 * displayEconomyFee * displayBtcPrice / 100000000;
    var batchedCost = (80 + 1000 * 18) * displayEconomyFee * displayBtcPrice / 100000000;
    var savings = individualCost * 1000 - batchedCost;
    var efficiency = individualCost > 0 ? ((individualCost * 1000 - batchedCost) / (individualCost * 1000) * 100) : 0;
    efficiency = Math.min(100, Math.max(0, efficiency));

    ctx.fillStyle = '#EADCC8';
    ctx.font = mob ? 'bold 14px -apple-system, sans-serif' : 'bold 18px -apple-system, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(mob ? '\u26A1 Savings Forge' : '\u26A1 Savings Forge \u2014 Batch vs Individual', 30, 14);
    if (!mob) {
      ctx.font = '12px -apple-system, sans-serif';
      ctx.fillStyle = '#6A5D4E';
      ctx.fillText('Batching transforms many small costs into one efficient transaction', 30, 40);
    }

    var centerX = w * 0.5;
    var poolY = mob ? 170 : 240;
    var streamCount = mob ? 3 : 5;

    for (var i = 0; i < streamCount; i++) {
      var spread = Math.min(mob ? 200 : 300, w * 0.25);
      var startX = centerX - spread / 2 + (spread / Math.max(1, streamCount - 1)) * i;
      var startY = mob ? 60 : 80;
      startY += Math.sin(i * 0.7) * (mob ? 8 : 20);
      var midX = centerX + (i - Math.floor(streamCount / 2)) * (mob ? 10 : 15);
      var midY = mob ? 110 : 160;

      var alpha = 0.15 + (i / streamCount) * 0.2;
      ctx.strokeStyle = 'rgba(248,81,73,' + alpha + ')';
      ctx.lineWidth = 1.5 + (i / streamCount) * (mob ? 1.5 : 2);
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.quadraticCurveTo(midX, midY, centerX, poolY - (mob ? 10 : 20));
      ctx.stroke();

      var cost = individualCost * (i + 1) * 200;
      ctx.fillStyle = 'rgba(248,81,73,0.5)';
      ctx.font = mob ? '7px -apple-system, sans-serif' : '9px -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(usd(cost), startX, startY - 4);
    }

    var poolRadius = (mob ? 35 : 50) + Math.sin(t * 1.5) * 3;
    ctx.shadowColor = 'rgba(59,163,93,0.5)';
    ctx.shadowBlur = (mob ? 15 : 25) + Math.sin(t * 1.5) * (mob ? 4 : 8);
    ctx.fillStyle = 'rgba(59,163,93,0.15)';
    ctx.beginPath();
    ctx.arc(centerX, poolY, poolRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = mob ? 6 : 10;
    ctx.fillStyle = 'rgba(59,163,93,0.08)';
    ctx.beginPath();
    ctx.arc(centerX, poolY, poolRadius * 0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#3BA35D';
    ctx.font = mob ? 'bold 16px -apple-system, sans-serif' : 'bold 22px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(usd(savings), centerX, poolY - (mob ? 4 : 6));
    ctx.font = mob ? '8px -apple-system, sans-serif' : '10px -apple-system, sans-serif';
    ctx.fillStyle = 'rgba(59,163,93,0.7)';
    ctx.fillText('saved', centerX, poolY + (mob ? 12 : 16));

    ctx.font = mob ? '8px -apple-system, sans-serif' : '10px -apple-system, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(248,81,73,0.6)';
    ctx.textAlign = 'right';
    ctx.fillText('Individual: ' + usd(individualCost * 1000), centerX - poolRadius - (mob ? 10 : 20), poolY);
    ctx.fillStyle = 'rgba(59,163,93,0.6)';
    ctx.textAlign = 'left';
    ctx.fillText('Batched: ' + usd(batchedCost), centerX + poolRadius + (mob ? 10 : 20), poolY);

    var barY = poolY + poolRadius + (mob ? 20 : 30);
    var barX = mob ? 30 : 60;
    var barW = w - barX * 2;
    var barH = mob ? 16 : 20;

    ctx.fillStyle = '#231F19';
    ctx.strokeStyle = '#3A3228';
    VIZ.roundRect(ctx, barX, barY, barW, barH, 10);
    ctx.fill();
    ctx.stroke();

    var fillW = Math.max(0, (efficiency / 100) * (barW - 4));
    ctx.fillStyle = efficiency > 70 ? '#3BA35D' : efficiency > 40 ? '#D4762A' : '#C0392B';
    VIZ.roundRect(ctx, barX + 2, barY + 2, fillW, barH - 4, 8);
    ctx.fill();

    ctx.fillStyle = '#1A1612';
    ctx.font = mob ? 'bold 8px -apple-system, sans-serif' : 'bold 10px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(dataReady ? efficiency.toFixed(0) + '% savings via batching' : '— data pending —', barX + barW / 2, barY + barH / 2);

    var statsY = barY + barH + (mob ? 12 : 20);
    var statsData = [
      { value: economyFee + ' sat/vB', label: 'Current Fee', color: '#D4933A' },
      { value: '1000', label: 'Batch Size', color: '#58A6FF' },
      { value: efficiency.toFixed(0) + '%', label: 'Efficiency', color: '#3BA35D' },
    ];

    if (mob) {
      for (var i = 0; i < 3; i++) {
        var cardW = w - 60;
        var cardH = 36;
        var cy = statsY + i * (cardH + 6);
        ctx.fillStyle = '#231F19';
        ctx.strokeStyle = '#3A3228';
        VIZ.roundRect(ctx, 30, cy, cardW, cardH, 8);
        ctx.fill();
        ctx.stroke();
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.font = 'bold 16px -apple-system, sans-serif';
        ctx.fillStyle = statsData[i].color;
        ctx.fillText(statsData[i].value, 44, cy + cardH / 2);
        ctx.font = '10px -apple-system, sans-serif';
        ctx.fillStyle = '#6A5D4E';
        ctx.fillText(statsData[i].label, 130, cy + cardH / 2);
      }
    } else {
      var cardW = Math.min(180, (w - 100) / 3);
      var cardGap = Math.max(8, (w - 100 - cardW * 3) / 2);
      for (var i = 0; i < 3; i++) {
        var cx = 50 + i * (cardW + cardGap);
        ctx.fillStyle = '#231F19';
        ctx.strokeStyle = '#3A3228';
        VIZ.roundRect(ctx, cx, statsY, cardW, 70, 10);
        ctx.fill();
        ctx.stroke();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = 'bold 24px -apple-system, sans-serif';
        ctx.fillStyle = statsData[i].color;
        ctx.fillText(statsData[i].value, cx + cardW / 2, statsY + 28);
        ctx.font = '10px -apple-system, sans-serif';
        ctx.fillStyle = '#6A5D4E';
        ctx.fillText(statsData[i].label, cx + cardW / 2, statsY + 54);
      }
    }

    var footerY = mob ? statsY + 118 : 460;
    var footerH = mob ? 30 : 36;
    ctx.fillStyle = '#231F19';
    ctx.strokeStyle = '#3A3228';
    VIZ.roundRect(ctx, mob ? 30 : 50, footerY, w - (mob ? 60 : 100), footerH, 8);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#6A5D4E';
    ctx.font = mob ? '9px -apple-system, sans-serif' : '11px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      'Each stream = 200 withdrawals \u00B7 Batching ' + economyFee + ' sat/vB at ' + (btcPrice > 0 ? '$' + btcPrice.toLocaleString() : 'current price'),
      w / 2,
      footerY + footerH / 2
    );

    if (isDragging && tooltipData) {
      ctx.fillStyle = 'rgba(26,22,18,0.9)';
      VIZ.roundRect(ctx, tooltipData.tx - 60, tooltipData.ty - 30, 120, 40, 8);
      ctx.fill();
      ctx.strokeStyle = '#3A3228';
      ctx.stroke();
      ctx.fillStyle = '#EADCC8';
      ctx.font = '11px -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Discount: ' + Math.round(batchDiscount * 100) + '%', tooltipData.tx, tooltipData.ty - 5);
      ctx.fillStyle = '#3BA35D';
      ctx.font = '9px -apple-system, sans-serif';
      ctx.fillText('Savings: ' + usd(savings * batchDiscount / 0.6), tooltipData.tx, tooltipData.ty + 10);
    }

    if (!mob) {
      ctx.fillStyle = 'rgba(106,93,78,0.4)';
      ctx.font = '9px -apple-system, sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      ctx.fillText('Drag to adjust discount', w - 16, h - 8);
    }
  }

  function loop() { try { draw(); } catch (e) {}
    if (!REDUCED_MOTION) requestAnimationFrame(loop);
  }

  function getPos(e) {
    var rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function onMouseDown(e) {
    isDragging = true;
    updateTooltip(getPos(e));
  }

  function onMouseMove(e) {
    if (!isDragging) return;
    var pos = getPos(e);
    updateBatchDiscount(pos);
    updateTooltip(pos);
  }

  function updateBatchDiscount(pos) {
    var pct = pos.x / w;
    batchDiscount = Math.max(0.1, Math.min(1.0, 0.3 + pct * 0.7));
  }

  function updateTooltip(pos) {
    tooltipData = { tx: pos.x, ty: pos.y < h / 2 ? h / 2 + 40 : h / 2 - 40 };
  }

  function onMouseUp() { isDragging = false; tooltipData = null; }

  function onTouchStart(e) {
    e.preventDefault();
    isDragging = true;
    var t = e.touches[0];
    var rect = canvas.getBoundingClientRect();
    updateTooltip({ x: t.clientX - rect.left, y: t.clientY - rect.top });
  }

  function onTouchMove(e) {
    e.preventDefault();
    if (!isDragging) return;
    var t = e.touches[0];
    var rect = canvas.getBoundingClientRect();
    var pos = { x: t.clientX - rect.left, y: t.clientY - rect.top };
    updateBatchDiscount(pos);
    updateTooltip(pos);
  }

  function onTouchEnd() { isDragging = false; tooltipData = null; }

  return { init: init, resize: resize };
})();
