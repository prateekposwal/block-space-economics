var http = require('http');
var path = require('path');
var { CONFIG } = require('./config.js');
var monitor = require('./monitor.js');
var report = require('./report.js');
var agent = require('./agent.js');
var researchRunner = require('../../tools/research/runner.js');

var PORT = process.env.PORT || 3456;
var agentRunning = false;

function jsonResponse(res, data, status) {
  res.writeHead(status || 200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(data, null, 2));
}

var server = http.createServer(function(req, res) {
  var u = new URL(req.url, 'http://localhost');
  var route = u.pathname;

  if (route === '/health') {
    jsonResponse(res, { status: 'ok', agent: agentRunning ? 'running' : 'stopped', uptime: process.uptime() });

  } else if (route === '/status') {
    var agentState = agent.getState ? agent.getState() : {};
    jsonResponse(res, {
      agent: CONFIG.agent.name,
      cycles: agentState.cycleCount || 0,
      lastRun: agentState.lastRun,
      issues: agentState.issues || [],
      endpoints: CONFIG.endpoints.length,
      discoveredSources: (agentState.discoveredSources || []).length,
    });

  } else if (route === '/endpoints') {
    jsonResponse(res, { endpoints: CONFIG.endpoints });

  } else if (route === '/check') {
    monitor.checkAllEndpoints(CONFIG.endpoints).then(function(result) {
      jsonResponse(res, result);
    }).catch(function(e) {
      jsonResponse(res, { error: e.message }, 500);
    });

  } else if (route === '/report') {
    report.generateDailyReport().then(function(r) {
      jsonResponse(res, { report: r });
    }).catch(function(e) {
      jsonResponse(res, { error: e.message }, 500);
    });

  } else if (route === '/quality') {
    var q = monitor.getDataQualityScore ? monitor.getDataQualityScore() : { score: 0 };
    jsonResponse(res, q);

  } else if (route === '/start') {
    if (!agentRunning) {
      agent.start();
      agentRunning = true;
    }
    jsonResponse(res, { status: 'started' });

  } else if (route === '/research') {
    var rs = researchRunner.getState ? researchRunner.getState() : {};
    jsonResponse(res, { cycles: rs.cycleCount || 0, lastRun: rs.lastRun, agents: 5, report: 'reports/research/' + (rs.lastRun ? new Date(rs.lastRun).toISOString().slice(0, 10) + '.md' : 'none') });

  } else if (route === '/research/run') {
    researchRunner.runCycle().then(function(results) {
      jsonResponse(res, { ok: true, agents: results.length, findings: results.reduce(function(s, r) { return s + r.findings.length; }, 0) });
    }).catch(function(e) {
      jsonResponse(res, { error: e.message }, 500);
    });

  } else if (route === '/research/notes') {
    var rn = require('../../tools/research/notes.js');
    jsonResponse(res, rn.getSummary());

  } else if (route === '/feed.xml') {
    var feedPath = path.resolve(__dirname, '..', '..', 'docs', 'feed.xml');
    if (require('fs').existsSync(feedPath)) {
      res.writeHead(200, { 'Content-Type': 'application/rss+xml' });
      res.end(require('fs').readFileSync(feedPath, 'utf8'));
    } else {
      res.writeHead(404);
      res.end('No feed yet');
    }

  } else if (route === '/publish') {
    var publisher = require('../../tools/marketing/publisher.js');
    jsonResponse(res, publisher.getStats());

  } else if (route === '/publish/run') {
    var publisher = require('../../tools/marketing/publisher.js');
    publisher.runCycle().then(function(results) {
      jsonResponse(res, { ok: true, posted: results.length, details: results });
    }).catch(function(e) {
      jsonResponse(res, { error: e.message }, 500);
    });

  } else if (route === '/employees') {
    var emps = require('../../tools/marketing/employees.js');
    jsonResponse(res, emps.getEmployees());

  } else if (route === '/employees/onboard') {
    var emps = require('../../tools/marketing/employees.js');
    var params = u.searchParams;
    var empId = params.get('id') || 'satoshi';
    emps.onboardEmployee(empId, params.get('browser') || 'chromium').then(function(r) {
      jsonResponse(res, r);
    }).catch(function(e) {
      jsonResponse(res, { error: e.message }, 500);
    });

  } else if (route === '/employees/run') {
    var emps = require('../../tools/marketing/employees.js');
    emps.runAllEmployees().then(function(r) {
      jsonResponse(res, { ok: true, results: r });
    }).catch(function(e) {
      jsonResponse(res, { error: e.message }, 500);
    });

  } else if (route === '/beta/register' && req.method === 'POST') {
    var bbody = '';
    req.on('data', function(c) { bbody += c; });
    req.on('end', function() {
      try {
        var bdata = JSON.parse(bbody);
        var betaMgr = require('../../tools/agents/27-beta-manager.js');
        var br = betaMgr.register(bdata.email, bdata.name, bdata.product, bdata.source || 'beta.html');
        jsonResponse(res, br);
      } catch (e) {
        jsonResponse(res, { ok: false, error: e.message }, 500);
      }
    });

  } else if (route === '/beta/status') {
    var betaMgr = require('../../tools/agents/27-beta-manager.js');
    jsonResponse(res, betaMgr.refreshStatus());

  } else if (route === '/beta/verify') {
    var betaMgr = require('../../tools/agents/27-beta-manager.js');
    var vk = u.searchParams.get('key');
    jsonResponse(res, betaMgr.verifyKey(vk));

  } else if (route === '/admin') {
    // Serve the local admin UI (from local-admin.html, NOT on the public site).
    try {
      var html = require('fs').readFileSync(path.join(__dirname, '..', '..', 'local-admin.html'), 'utf8');
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(html);
    } catch (e) { jsonResponse(res, { error: 'local-admin.html missing' }, 500); }

  } else if (route === '/admin/dashboard') {
    // Admin dashboard aggregate (architect's view). Key-protected — no default key;
    // the ADMIN_KEY env MUST be set or admin endpoints are disabled entirely.
    var adminKey = process.env.ADMIN_KEY;
    if (!adminKey) { jsonResponse(res, { error: 'admin disabled — set ADMIN_KEY env' }, 503); }
    else {
      var ak = u.searchParams.get('key');
      if (ak !== adminKey) { jsonResponse(res, { error: 'unauthorized' }, 401); }
      else {
        try {
          var betaMgr = require('../../tools/agents/27-beta-manager.js');
          var beta = betaMgr.refreshStatus();
          var betaUsers = betaMgr.list();
          var db = require('../db/init.js');
          var caps = db.query('SELECT count(*) c FROM captures');
          var findings = db.query("SELECT count(*) c FROM research_findings");
          var blockStats = db.query('SELECT count(*) c FROM block_stats');
          var nodeGeo = db.query('SELECT count(*) c FROM node_geo');
          var health = null;
          try {
            var spoolPath = require('path').join(__dirname, '..', '..', 'captured-data', 'de-agent-state.json');
            health = JSON.parse(require('fs').readFileSync(spoolPath, 'utf8'));
          } catch (e) {}
          jsonResponse(res, {
            generated_at: new Date().toISOString(),
            beta: { registered: beta.registered, cap: beta.cap, waitlist: beta.waitlist, open: beta.open, free_months: beta.free_months },
            beta_users: betaUsers,
            data: { captures: caps[0].c, findings: findings[0].c, block_stats: blockStats[0].c, node_geo: nodeGeo[0].c },
            roi: (function() {
              try { return require('../../tools/agents/28-roi-tracker.js').refresh(); }
              catch (e) { return { error: e.message }; }
            })(),
            health: health ? { cycle: health.cycleCount, lastRun: health.lastRun, m4: health.m4 } : null
          });
        } catch (e) { jsonResponse(res, { error: e.message }, 500); }
      }
    }

  } else if (route === '/admin/beta') {
    var adminKey = process.env.ADMIN_KEY;
    if (!adminKey) { jsonResponse(res, { error: 'admin disabled — set ADMIN_KEY env' }, 503); }
    else {
      var ak2 = u.searchParams.get('key');
      if (ak2 !== adminKey) { jsonResponse(res, { error: 'unauthorized' }, 401); }
      else {
        var betaMgr = require('../../tools/agents/27-beta-manager.js');
        jsonResponse(res, { users: betaMgr.list() });
      }
    }

  } else if (route === '/research/notes/add' && req.method === 'POST') {
    var body = '';
    req.on('data', function(c) { body += c; });
    req.on('end', function() {
      try {
        var data = JSON.parse(body);
        var child = require('child_process');
        var result = child.execSync('node tools/research/add-note.js "' + data.section + '" "' + data.note + '"', { encoding: 'utf8', timeout: 5000 });
        jsonResponse(res, { ok: true, message: result.trim() });
      } catch (e) {
        jsonResponse(res, { error: e.message }, 400);
      }
    });

  } else if (route === '/post-log.json') {
    var postLogPath = path.resolve(__dirname, '..', '..', 'captured-data', 'post-log.json');
    if (require('fs').existsSync(postLogPath)) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(require('fs').readFileSync(postLogPath, 'utf8'));
    } else { jsonResponse(res, { posts: [] }); }

  } else if (route === '/spool/stats') {
    require('./spool.js').init().then(function(s) { return s.stats(); }).then(function(st) {
      jsonResponse(res, st);
    }).catch(function(e) { jsonResponse(res, { error: e.message }, 500); });

  } else if (route === '/spool/sources') {
    require('./spool.js').init().then(function(s) { return s.stats(); }).then(function(st) {
      jsonResponse(res, { sources: st.perSource, stale: st.staleSources });
    }).catch(function(e) { jsonResponse(res, { error: e.message }, 500); });

  } else if (route === '/spool/resolve') {
    var spSrc = u.searchParams.get('source');
    var spDay = u.searchParams.get('day');
    if (!spSrc || !spDay) { jsonResponse(res, { error: 'source and day required' }, 400); }
    else {
      require('./spool.js').init().then(function(s) { return s.resolve(spSrc, spDay); }).then(function(entries) {
        jsonResponse(res, { source: spSrc, day: spDay, entries: entries });
      }).catch(function(e) { jsonResponse(res, { error: e.message }, 500); });
    }

  } else if (route === '/spool/consume') {
    var consumer = require('./spool-consumer.js');
    consumer.drainAll().then(function() { return require('./spool.js').init(); })
      .then(function(s) { return s.stats(); })
      .then(function(st) { jsonResponse(res, st); })
      .catch(function(e) { jsonResponse(res, { error: e.message }, 500); });

  } else {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<!doctype html><html><head><title>BSAHI — Live Dashboard</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{background:#1A1612;color:#E8E5E0;font-family:-apple-system,sans-serif;padding:40px;max-width:900px;margin:0 auto;}h1{color:#F7931A;font-size:32px;}h2{color:#F7931A;font-size:20px;margin-top:32px;border-bottom:1px solid #2A2622;padding-bottom:8px;}a{color:#F7931A;text-decoration:none;}a:hover{text-decoration:underline;}ul{list-style:none;padding:0;}li{padding:6px 0;}li:before{content:"⬡ ";color:#F7931A;}pre{background:#2A2622;padding:16px;border-radius:8px;overflow-x:auto;margin:12px 0;}.cards{display:grid;gap:12px;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));margin:16px 0;}.card{background:#2A2622;border-radius:8px;padding:16px;border:1px solid #3A3632;}.card .num{font-size:24px;color:#F7931A;font-weight:700;}.card .label{font-size:12px;color:#8B8580;margin-top:4px;}hr{border:none;border-top:1px solid #2A2622;margin:24px 0;}.badge{display:inline-block;background:#1A1612;padding:2px 8px;border-radius:4px;font-size:11px;color:#F7931A;border:1px solid #3A3632;margin:2px;}</style></head><body><h1>⬡ BSAHI</h1><p style="color:#8B8580;margin-bottom:24px;">Block Space Research — Autonomous Data & Publishing Engine</p><div class="cards" id="live-cards"><div class="card"><div class="num" id="emp-count">—</div><div class="label">Employees</div></div><div class="card"><div class="num" id="post-count">—</div><div class="label">Total Posts</div></div><div class="card"><div class="num" id="nostr-count">—</div><div class="label">Nostr Events</div></div><div class="card"><div class="num" id="uptime">—</div><div class="label">Uptime</div></div></div><h2>⬡ Systems</h2><ul><li><a href="/health">Health Check</a></li><li><a href="/status">Status</a></li><li><a href="/endpoints">Data Endpoints</a></li><li><a href="/check">Check All</a></li><li><a href="/report">Daily Report</a></li><li><a href="/research">Research</a></li></ul><h2>⬡ Publishing</h2><ul><li><a href="/publish">Nostr Identity & Stats</a></li><li><a href="/publish/run">Run Publish Cycle</a></li><li><a href="/feed.xml">RSS Feed</a></li></ul><h2>⬡ Team</h2><ul><li><a href="/employees">Employee List</a></li><li><a href="/employees/onboard?id=satoshi">Onboard Employee</a></li><li><a href="/employees/run">Run All Employees</a></li><li><a href="/team">Team Dashboard</a></li></ul><h2>⬡ Quick Links</h2><ul><li><a href="https://snort.social/p/44744d037e50a4f3bc6b44b9ca7c5a3f52e68b0f70789696ccb7e28e274d2d61">BSAHI on Nostr (Snort)</a> <span class="badge">live</span></li><li><a href="https://bitcoinsahi.com">bitcoinsahi.com</a> <span class="badge">GitHub Pages</span></li></ul><hr/><p style="color:#4A4642;font-size:12px;">DE Server • Port ' + PORT + ' • ' + new Date().toISOString().slice(0,10) + '</p><script>(function(){fetch("/health").then(r=>r.json()).then(d=>{document.getElementById("uptime").textContent=Math.floor(d.uptime/60)+"m"});fetch("/employees").then(r=>r.json()).then(d=>{if(d){document.getElementById("emp-count").textContent=d.filter(function(e){return e.onboarded}).length+"/"+d.length;var p=0;d.forEach(function(e){p+=e.totalPosts||0});document.getElementById("post-count").textContent=p}});fetch("/publish").then(r=>r.json()).then(d=>{if(d){document.getElementById("nostr-count").textContent=d.totalPosts||0}}}).catch(function(){})})();</script></body></html>');
  }
});

// Loopback-only: this is a LOCAL admin/ops server. Binding 127.0.0.1 means the
// unauthenticated endpoints can't be reached from the LAN — architect-only.
server.listen(PORT, '127.0.0.1', function() {
  console.log('DE Server running on http://localhost:' + PORT);
  // AUTO_START: launchd KeepAlive restarts must self-heal the agent.
  // Set AUTO_START=1 in the plist env (or default to on for autonomous mode).
  if (process.env.AUTO_START !== '0') {
    if (!agentRunning) {
      agent.start();
      agentRunning = true;
      console.log('DE Agent auto-started (AUTO_START)');
    }
  }
});

module.exports = server;
