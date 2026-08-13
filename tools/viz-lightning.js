var REDUCED_MOTION = (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
// Lightning Network interactive node graph
var VIZ_Lightning = (function() {
  var canvas, ctx, w = 800, h = 400;
  var nodes = [];
  var links = [];
  var stats = { capacity: 0, nodes: 0, channels: 0 };
  var mouseX = -1, mouseY = -1, hoverNode = null;
  var tooltipEl = null;
  var animId = null;
  var frameCount = 0;

  function isMobile() { return w < 480; }

  function init(canvasId) {
    canvas = document.getElementById(canvasId);
    if (!canvas) return;
    ctx = canvas.getContext('2d');
    resize();

    tooltipEl = document.createElement('div');
    tooltipEl.style.cssText = 'position:fixed;pointer-events:none;background:rgba(0,0,0,0.88);color:#e8e3dc;padding:8px 12px;border-radius:6px;font:12px/1.4 -apple-system,sans-serif;border:1px solid rgba(255,255,255,0.08);z-index:9999;display:none;max-width:260px;';
    document.body.appendChild(tooltipEl);

    canvas.addEventListener('mousemove', function(e) {
      mouseX = e.clientX;
      mouseY = e.clientY;
    });
    canvas.addEventListener('mouseleave', function() {
      mouseX = -1;
      mouseY = -1;
      hoverNode = null;
      tooltipEl.style.display = 'none';
    });

    canvas.addEventListener('touchstart', function(e) {
      e.preventDefault();
      var t = e.touches[0];
      mouseX = t.clientX;
      mouseY = t.clientY;
    }, { passive: false });
    canvas.addEventListener('touchmove', function(e) {
      e.preventDefault();
      var t = e.touches[0];
      mouseX = t.clientX;
      mouseY = t.clientY;
    }, { passive: false });
    canvas.addEventListener('touchend', function() {
      setTimeout(function() {
        mouseX = -1;
        mouseY = -1;
        hoverNode = null;
        tooltipEl.style.display = 'none';
      }, 2000);
    });

    window.addEventListener('resize', resize);

    buildNodes();

    if (typeof DATA_ENGINE !== 'undefined') {
      DATA_ENGINE.onUpdate(function() {
        var d = DATA_ENGINE.get().lightning || {};
        stats.capacity = d.total_capacity || 0;
        stats.nodes = d.node_count || 0;
        stats.channels = d.channel_count || 0;
        if (stats.nodes > 0) reconcileNodeCount(stats.nodes);
      });
    }

    loop();
  }

  function resize() {
    // Width from the parent (responsive); height from a fixed design value per
    // viewport. NEVER derive height from the parent's rect: the parent's height
    // is driven by this canvas's own style.height, so that approach inflates
    // the canvas on every resize (runaway growth).
    var parent = canvas.parentElement;
    var pw = parent ? parent.clientWidth : 0;
    if (!pw || pw < 100) pw = window.innerWidth || 800;
    w = canvas.width = Math.min(pw, 1600);
    h = canvas.height = isMobile() ? 340 : 480;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
  }

  function buildNodes() {
    var d = {};
    if (typeof DATA_ENGINE !== 'undefined') {
      var _de = DATA_ENGINE.get ? DATA_ENGINE.get() : null;
      d = (_de && _de.lightning) || {};
    }
    stats.capacity = d.total_capacity || 0;
    stats.nodes = d.node_count || 0;
    stats.channels = d.channel_count || 0;

    // HONEST RENDER: we do NOT have per-node/per-channel graph topology captured,
    // so we never fabricate nodes. The canvas shows real aggregate stats + a clear
    // "network graph not captured" state (integrity rule: no fabricated "live" data).
    nodes = [];
    links = [];
    // Pull a small real-sample representation only from captured fields we actually
    // hold (tor/clearnet/unannounced split) so the visual is grounded, not random.
    var split = d.breakdown || {};
    var buckets = [
      { label: 'Tor', value: d.tor_nodes || 0, color: '#3FB950' },
      { label: 'Clearnet', value: d.clearnet_nodes || 0, color: '#D29922' },
      { label: 'Unannounced', value: d.unannounced_nodes || 0, color: '#8B949E' }
    ];
    var haveSplit = buckets.some(function(b) { return b.value > 0; });
    var total = buckets.reduce(function(a, b) { return a + (b.value || 0); }, 0) || stats.nodes;
    if (haveSplit && total > 0) {
      // One representative dot per 100 real nodes, sized by real bucket share.
      var scale = Math.min(60, Math.max(8, Math.round(total / 250)));
      buckets.forEach(function(b) {
        var n = Math.max(0, Math.round((b.value / total) * scale));
        for (var i = 0; i < n; i++) {
          nodes.push({
            id: nodes.length,
            label: b.label,
            pubkey: '',
            alias: b.label + ' node (real data)',
            channels: b.value > 0 ? Math.max(1, Math.round(b.value / (n || 1) / 10)) : 0,
            capacity: stats.capacity / (total || 1),
            avgFeeRate: 10,
            x: Math.random() * (w || 800),
            y: Math.random() * (h || 400),
            vx: (Math.random() - 0.5) * 0.3,
            vy: (Math.random() - 0.5) * 0.3,
            bucketColor: b.color
          });
        }
      });
    }
    stats.nodes = total || stats.nodes;
    stats.split = buckets;
    stats.fabricated = false;
    return stats;
  }

  function reconcileNodeCount(targetCount) {
    // No-op: we never fabricate nodes. Called by DATA_ENGINE updates to refresh
    // aggregate stats from real data only.
    var _de2 = (typeof DATA_ENGINE !== 'undefined' && DATA_ENGINE.get) ? DATA_ENGINE.get() : null;
    var d = (_de2 && _de2.lightning) || {};
    stats.capacity = d.total_capacity || stats.capacity;
    stats.nodes = d.node_count || stats.nodes;
    stats.channels = d.channel_count || stats.channels;
    if (d.tor_nodes || d.clearnet_nodes || d.unannounced_nodes) {
      stats.split = [
        { label: 'Tor', value: d.tor_nodes || 0, color: '#3FB950' },
        { label: 'Clearnet', value: d.clearnet_nodes || 0, color: '#D29922' },
        { label: 'Unannounced', value: d.unannounced_nodes || 0, color: '#8B949E' }
      ];
    }
  }

  function feeColor(fee) {
    var p = Math.min(1, fee / 50);
    if (p < 0.5) {
      var t = p / 0.5;
      return { r: Math.round(63 + (210 - 63) * t), g: Math.round(185 + (170 - 185) * t), b: Math.round(80 + (80 - 80) * t) };
    } else {
      var t = (p - 0.5) / 0.5;
      return { r: Math.round(210 + (248 - 210) * t), g: Math.round(170 + (81 - 170) * t), b: Math.round(80 + (73 - 80) * t) };
    }
  }

  function loop() { try {
    var t = Date.now() / 1000;
    var repulsion = isMobile() ? 20000 : 40000;
    var attraction = 0.001;
    var damping = 0.98;
    var maxSpeed = 1.5;
    var skipPhysics = isMobile() && (frameCount % 2 === 0);

    for (var i = 0; i < nodes.length; i++) {
      var a = nodes[i];
      var fx = 0, fy = 0;

      // Repulsion between all pairs
      if (!skipPhysics) {
        for (var j = 0; j < nodes.length; j++) {
          if (i === j) continue;
          var b = nodes[j];
          var dx = a.x - b.x;
          var dy = a.y - b.y;
          var dist = Math.sqrt(dx * dx + dy * dy) + 1;
          fx += (dx / dist) * repulsion / (dist * dist);
          fy += (dy / dist) * repulsion / (dist * dist);
        }
      }

      // Attraction along links
      for (var k = 0; k < links.length; k++) {
        if (links[k].source === i) {
          var target = nodes[links[k].target];
          if (!target) continue;
          dx = target.x - a.x;
          dy = target.y - a.y;
          dist = Math.sqrt(dx * dx + dy * dy) || 1;
          fx += dx * attraction;
          fy += dy * attraction;
        } else if (links[k].target === i) {
          target = nodes[links[k].source];
          if (!target) continue;
          dx = target.x - a.x;
          dy = target.y - a.y;
          dist = Math.sqrt(dx * dx + dy * dy) || 1;
          fx += dx * attraction;
          fy += dy * attraction;
        }
      }

      // Orbital drift — slow rotation around center
      var cx = w / 2, cy = h / 2;
      var dxc = a.x - cx, dyc = a.y - cy;
      var distc = Math.sqrt(dxc * dxc + dyc * dyc) || 1;
      var orbitStrength = 0.02;
      fx += -dyc / distc * orbitStrength * distc * 0.01;
      fy += dxc / distc * orbitStrength * distc * 0.01;

      // Weak centering force
      fx += (cx - a.x) * 0.0005;
      fy += (cy - a.y) * 0.0005;

      a.vx = (a.vx + fx) * damping;
      a.vy = (a.vy + fy) * damping;

      var speed = Math.sqrt(a.vx * a.vx + a.vy * a.vy);
      if (speed > maxSpeed) {
        a.vx = (a.vx / speed) * maxSpeed;
        a.vy = (a.vy / speed) * maxSpeed;
      }

      a.x += a.vx;
      a.y += a.vy;

      // Contain within bounds
      var margin = 60;
      if (a.x < margin) a.x = margin;
      if (a.x > w - margin) a.x = w - margin;
      if (a.y < margin) a.y = margin;
      if (a.y > h - margin) a.y = h - margin;
    }

    // Draw
    ctx.fillStyle = '#1A1612';
    ctx.fillRect(0, 0, w, h);

    // Subtle radial gradient
    var grad = ctx.createRadialGradient(w/2, h/2, 0, w/2, h/2, Math.max(w, h) * 0.6);
    grad.addColorStop(0, 'rgba(255,200,150,0.04)');
    grad.addColorStop(0.5, 'rgba(255,180,100,0.02)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Draw links
    var maxChan = 1;
    for (var i = 0; i < nodes.length; i++) {
      if (nodes[i].channels > maxChan) maxChan = nodes[i].channels;
    }

    for (var i = 0; i < links.length; i++) {
      var src = nodes[links[i].source];
      var tgt = nodes[links[i].target];
      if (!src || !tgt) continue;

      var cf = feeColor(links[i].feeRate);
      var density = Math.min(1, links[i].capacity / 5000000);
      var opacity = 0.08 + density * 0.35;

      ctx.beginPath();
      ctx.moveTo(src.x, src.y);
      ctx.lineTo(tgt.x, tgt.y);
      ctx.strokeStyle = 'rgba(' + cf.r + ',' + cf.g + ',' + cf.b + ',' + opacity + ')';
      ctx.lineWidth = 1 + density * 2;
      ctx.stroke();

      // Animated pulse along channel
      var pulsePhase = (t + i * 0.7) % 2;
      if (pulsePhase < 1) {
        var ppx = src.x + (tgt.x - src.x) * pulsePhase;
        var ppy = src.y + (tgt.y - src.y) * pulsePhase;
        ctx.beginPath();
        ctx.arc(ppx, ppy, 2 + density * 1.5, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(' + cf.r + ',' + cf.g + ',' + cf.b + ',' + (0.3 + density * 0.4) + ')';
        ctx.fill();
      }
    }

    // Draw nodes
    hoverNode = null;
    var maxSize = isMobile() ? 14 : 20, minSize = isMobile() ? 3 : 4;

    // Honest node color: bucket share (Tor/Clearnet/Unannounced) from real data.
    function nodeColor(n) {
      if (n.bucketColor) return n.bucketColor;
      var c = { r: 139, g: 148, b: 158 };
      return c;
    }

    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      var size = minSize + (n.channels / maxChan) * (maxSize - minSize);
      var cf = { r: 139, g: 148, b: 158 };
      var bc = nodeColor(n);
      cf.r = bc.r; cf.g = bc.g; cf.b = bc.b;
      var baseOpacity = 0.7;

      // Check hover
      if (mouseX >= 0 && mouseY >= 0) {
        var rect = canvas.getBoundingClientRect();
        var scaleX = w / rect.width;
        var scaleY = h / rect.height;
        var cx = (mouseX - rect.left) * scaleX;
        var cy = (mouseY - rect.top) * scaleY;
        var d = Math.sqrt((n.x - cx) * (n.x - cx) + (n.y - cy) * (n.y - cy));
        if (d < size + 6) {
          hoverNode = n;
          baseOpacity = 1;
        }
      }

      // Glow
      var glowSize = size * (1 + Math.sin(t * 1.5 + i) * 0.15);
      ctx.beginPath();
      ctx.arc(n.x, n.y, glowSize * 1.8, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(' + cf.r + ',' + cf.g + ',' + cf.b + ',' + (0.06 + Math.sin(t * 2 + i * 0.5) * 0.03 + 0.03) + ')';
      ctx.fill();

      // Main circle
      ctx.beginPath();
      ctx.arc(n.x, n.y, glowSize, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(' + cf.r + ',' + cf.g + ',' + cf.b + ',' + baseOpacity + ')';
      ctx.fill();

      // Border
      ctx.strokeStyle = 'rgba(255,255,255,0.1' + (hoverNode === n ? '5' : '') + ')';
      ctx.lineWidth = hoverNode === n ? 1.5 : 0.5;
      ctx.stroke();
    }

    // Hovered node highlight ring
    if (hoverNode) {
      var n = hoverNode;
      var size = minSize + (n.channels / maxChan) * (maxSize - minSize);
      ctx.beginPath();
      ctx.arc(n.x, n.y, size + 5, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Draw connections to hovered node
      for (var i = 0; i < links.length; i++) {
        if (links[i].source === n.id || links[i].target === n.id) {
          var other = links[i].source === n.id ? nodes[links[i].target] : nodes[links[i].source];
          if (!other) continue;
          ctx.beginPath();
          ctx.moveTo(n.x, n.y);
          ctx.lineTo(other.x, other.y);
          ctx.strokeStyle = 'rgba(255,255,255,0.15)';
          ctx.lineWidth = 1;
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(other.x, other.y, 3, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(255,255,255,0.2)';
          ctx.fill();
        }
      }

      // Update tooltip
      tooltipEl.style.display = 'block';
      tooltipEl.style.left = Math.min(mouseX + 16, window.innerWidth - (isMobile() ? 200 : 270)) + 'px';
      tooltipEl.style.top = Math.min(mouseY + 16, window.innerHeight - (isMobile() ? 130 : 160)) + 'px';
      var capBtc = (n.capacity / 100000000).toFixed(4);
      tooltipEl.innerHTML =
        '<b>' + n.alias + '</b><br>' +
        '<span style="color:#8b8680;font-size:11px">Network graph topology not captured — node represents a real aggregate share</span><br>' +
        '<span style="color:#ffd8a8">Share bucket: ' + n.label + '</span>';
    } else {
      tooltipEl.style.display = 'none';
    }

    // Stats label — total capacity, node count, channel count
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = (isMobile() ? '10px' : '12px') + ' -apple-system, sans-serif';
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(14, 14, isMobile() ? 300 : 430, 42);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    var capBtc = (stats.capacity / 100000000).toFixed(1);
    ctx.fillText('Capacity: ' + capBtc + ' BTC | Nodes: ' + stats.nodes + ' | Channels: ' + stats.channels, 16, 16);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillText('Real network stats — graph topology not captured', 16, 38);

    // Honest empty state: no captured network data at all.
    if (stats.nodes === 0 && nodes.length === 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.font = (isMobile() ? '12px' : '14px') + ' -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('No network data captured yet — stats appear when the pipeline captures the next snapshot', w / 2, h / 2);
    }

    // Legend — desktop: right column; mobile: BELOW the stats label (the
    // old w-200 placement covered the 300px stats box on narrow screens).
    var lx = isMobile() ? 14 : w - 200;
    var ly = isMobile() ? 64 : 16;
    var lw = isMobile() ? 320 : 140;

    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(lx - 8, ly - 6, lw + 16, 80);
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    ctx.strokeRect(lx - 8, ly - 6, lw + 16, 80);

    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = '10px -apple-system, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillText('Node color = real split', lx, ly);

    // Tor
    ctx.fillStyle = 'rgb(63,185,80)';
    ctx.fillRect(lx, ly + 14, 10, 10);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillText('Tor (' + (stats.split ? stats.split[0].value : '—') + ')', lx + 14, ly + 14);

    // Clearnet
    ctx.fillStyle = 'rgb(210,170,80)';
    ctx.fillRect(lx, ly + 28, 10, 10);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillText('Clearnet (' + (stats.split ? stats.split[1].value : '—') + ')', lx + 14, ly + 28);

    // Unannounced
    ctx.fillStyle = 'rgb(139,148,158)';
    ctx.fillRect(lx, ly + 42, 10, 10);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillText('Unannounced (' + (stats.split ? stats.split[2].value : '—') + ')', lx + 14, ly + 42);

    // Node size hint
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillText('○ size = share in bucket', lx, ly + 60);

    // Vignette
    var vig = ctx.createRadialGradient(w/2, h/2, h*0.15, w/2, h/2, h*0.85);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,0.35)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, w, h);

    frameCount++;
    } catch (e) {}
    animId = REDUCED_MOTION ? 0 : requestAnimationFrame(loop);
  }

  return { init: init, resize: resize };
})();
