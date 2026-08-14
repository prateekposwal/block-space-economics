var REDUCED_MOTION = (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
// Bitcoin Sahi — Living Fee Visualization
// Obviously alive — particles float, numbers animate, bars flow

var VIZ_Fees = (function() {
  var canvas, ctx, w = 0, h = 0;
  var bars = [];
  var particles = [];
  var BLOCK_VBYTES = 4000000; // consensus vbytes per block — REAL sat/vB conversion
  // Seeds at 0 (2026-08-14 honesty fix: was a fabricated 3 sat/vB) — rendered
  // neutral until a REAL fee arrives, never a plausible default.
  var displayFee = 0;
  var targetFee = 0;
  var hasRealFee = false;
  var scrollOffset = 0;
  var bottomMargin = 90;

  function init(canvasId) {
    canvas = document.getElementById(canvasId);
    if (!canvas) return;
    ctx = canvas.getContext('2d');
    resize();
    window.addEventListener('resize', resize);
    
    DATA_ENGINE.onUpdate(function() {
      var data = DATA_ENGINE.get().fee_history || [];
      var fees = DATA_ENGINE.get().fees || {};
      if (typeof fees.fastestFee === 'number' && fees.fastestFee > 0) {
        targetFee = fees.fastestFee;
        hasRealFee = true;
      }

      for (var i = 0; i < Math.min(data.length, 144); i++) {
        var entry = data[data.length - 1 - i];
        // REAL sat/vB: normalized feeRate when present, else avgFees ÷ 4M vbytes.
        var feeRate = (typeof entry.feeRate === 'number' && entry.feeRate > 0) ? entry.feeRate
          : (typeof entry.avgFeeRate === 'number' && entry.avgFeeRate > 0) ? entry.avgFeeRate
          : (typeof entry.avgFees === 'number' && entry.avgFees > 0) ? entry.avgFees / BLOCK_VBYTES : 0;
        if (feeRate > 0) hasRealFee = true;
        feeRate = Math.min(500, Math.max(0.1, feeRate));
        if (!bars[i]) bars[i] = { fee: 1, h: 0, age: 0 };
        bars[i].targetFee = feeRate;
        bars[i].age = bars[i].age || 0;
      }
    });
    
    DATA_ENGINE.start();
    
    setInterval(function() { if (REDUCED_MOTION) return;
      var count = w < 480 ? 1 : w < 768 ? 2 : 3;
      var maxBarArea = h - bottomMargin;
      var speedMultiplier = 1 + (displayFee / 50) * 1.5;
      for (var i = 0; i < count; i++) {
        // Color derives from the REAL current fee — never a fabricated rate.
        var p = Math.min(1, displayFee / 50);
        particles.push({
          x: Math.random() * (w || 800),
          y: maxBarArea + (Math.random() * 40),
          vx: (Math.random() - 0.5) * 0.3 * speedMultiplier,
          vy: -(Math.random() * 0.5 + 0.2) * speedMultiplier,
          r: Math.round(p * 248 + (1-p) * 63),
          g: Math.round((1-p) * 185 + p * 81),
          b: Math.round((1-p) * 80 + p * 73),
          life: 1,
          size: Math.random() * 4 + 1.5
        });
      }
    }, 30);

    loop();
  }

  function resize() {
    var dpr = window.devicePixelRatio || 1;
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
  }

  function loop() {
    var t = Date.now() / 1000;
    var maxBarArea = h - bottomMargin;
    
    // Smooth fee display
    displayFee += (targetFee - displayFee) * 0.05;
    scrollOffset = (scrollOffset + 0.4) % 1;
    
    // Clamp
    if (Math.abs(displayFee - targetFee) < 0.01) displayFee = targetFee;
    
    // Update bars
    for (var i = 0; i < bars.length; i++) {
      var b = bars[i];
      b.fee += (b.targetFee - b.fee) * 0.03;
      b.h = (b.fee / 50) * maxBarArea * 0.9;
      b.age++;
    }

    // Draw background
    ctx.fillStyle = '#1A1612';
    ctx.fillRect(0, 0, w, h);
    
    // Ambient glow
    var pct = Math.min(1, displayFee / 50);
    var ar = Math.round(pct * 248 + (1-pct) * 63);
    var ag = Math.round((1-pct) * 185 + pct * 81);
    var ab = Math.round((1-pct) * 80 + pct * 73);
    var pulseSpeed = displayFee > 20 ? 2.0 : displayFee > 10 ? 1.0 : 0.5;
    var aglow = Math.sin(t * pulseSpeed) * 0.04 + 0.06;
    ctx.fillStyle = 'rgba(' + ar + ',' + ag + ',' + ab + ',' + aglow + ')';
    ctx.fillRect(0, 0, w, h);

    // Draw bars
    var bw = w / 144;
    for (var i = 0; i < bars.length; i++) {
      var b = bars[i];
      if (b.h < 2) continue;
      var x = w - ((i + scrollOffset) * bw);
      var barH = b.h;
      var y = maxBarArea - barH;
      var p = Math.min(1, b.fee / 50);
      var r = Math.round(p * 248 + (1-p) * 63);
      var g = Math.round((1-p) * 185 + p * 81);
      var bl = Math.round((1-p) * 80 + p * 73);
      var glow = Math.min(0.35, 0.05 + 0.3 * Math.exp(-b.age / 15));
      
      ctx.fillStyle = 'rgba(' + r + ',' + g + ',' + bl + ',' + glow + ')';
      ctx.fillRect(x - 2, y - 4, bw + 4, barH + 8);
      ctx.fillStyle = 'rgb(' + r + ',' + g + ',' + bl + ')';
      ctx.fillRect(x, y, Math.max(2, bw), barH);
    }

    // Draw floating particles
    for (var i = particles.length - 1; i >= 0; i--) {
      var p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.005;
      if (p.life <= 0) { particles.splice(i, 1); continue; }
      ctx.globalAlpha = p.life;
      ctx.fillStyle = 'rgb(' + p.r + ',' + p.g + ',' + p.b + ')';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Fee counter — big, centered, smooth; neutral while data is pending
    var feeText = hasRealFee ? displayFee.toFixed(0) : '--';
    var feeColor = !hasRealFee ? 'rgba(155,139,120,0.9)' : displayFee > 20 ? '#F85149' : displayFee > 10 ? '#D29922' : '#3FB950';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    var feeFontSize = Math.min(120, Math.max(48, w * 0.2));
    var counterY = w < 480 ? h * 0.35 : h / 2 - 70;

    ctx.font = feeFontSize + 'px -apple-system, sans-serif';
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillText(feeText, w/2 + 3, counterY + 3);
    
    ctx.fillStyle = feeColor;
    ctx.fillText(feeText, w/2, counterY);
    
    var labelFontSize = w < 480 ? '14px' : '18px';
    ctx.font = labelFontSize + ' -apple-system, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.fillText('sat/vB — fastest fee', w/2, counterY + Math.round(feeFontSize * 0.68));

    var f = displayFee;
    var narrative = '';
    if (!hasRealFee) narrative = 'Fee data pending — renders when the first capture arrives';
    else if (f < 3) narrative = 'Lowest fees — best time to send';
    else if (f < 5) narrative = 'Fees are low — good to send';
    else if (f < 10) narrative = 'Moderate fees — economy rate OK';
    else if (f < 20) narrative = 'Fees elevated — consider waiting';
    else if (f < 50) narrative = 'High fees — wait if you can';
    else narrative = 'Very high fees — not a good time to send';

    var narrativeFontSize = w < 480 ? '12px' : '16px';
    ctx.font = narrativeFontSize + ' -apple-system, sans-serif';
    var narrativeOpacity = 0.4 + Math.sin(t * 1.5) * 0.1;
    ctx.fillStyle = 'rgba(255,255,255,' + Math.max(0.2, Math.min(0.6, narrativeOpacity)) + ')';
    ctx.fillText(narrative, w/2, counterY + Math.round(feeFontSize * 0.68 + (w < 480 ? 24 : 30)));

    // Vignette
    var grad = ctx.createRadialGradient(w/2, h/2, h*0.2, w/2, h/2, h*0.9);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.4)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    if (!REDUCED_MOTION) requestAnimationFrame(loop);
  }

  function getFeeAt(idx) {
    if (idx < 0 || idx >= bars.length) return null;
    return bars[idx].fee || null;
  }

  return { init: init, getFeeAt: getFeeAt };
})();
