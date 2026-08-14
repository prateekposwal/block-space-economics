var fs = require('fs');
var path = require('path');
var child_process = require('child_process');
var { CONFIG } = require('./config.js');

var DB_PATH = path.resolve(__dirname, '..', '..', 'captured-data', 'bsahi.db');
var OUT_DIR = path.resolve(__dirname, '..', '..', 'reports', 'marketing');

function ensureDir(dir) { if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); }
function today() { return new Date().toISOString().slice(0, 10); }
function now() { return new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC'; }

function sqlQuery(sql) {
  try {
    var tmp = '/tmp/bsahi-mkt-' + Date.now() + '.sql';
    fs.writeFileSync(tmp, '.mode json\n' + sql);
    var r = child_process.execSync('sqlite3 "' + DB_PATH + '" < "' + tmp + '"', { encoding: 'utf8', timeout: 10000 });
    try { fs.unlinkSync(tmp); } catch (e) {}
    try { return JSON.parse(r); } catch (e) { return []; }
  } catch (e) { return []; }
}

// ─── Data Fetchers ───

function getLatestFee() {
  var d = sqlQuery("SELECT json_extract(json_data, '$.fastestFee') as f, json_extract(json_data, '$.economyFee') as e FROM captures WHERE source='fees' ORDER BY captured_at DESC LIMIT 1");
  return d.length > 0 ? { fastest: d[0].f || '--', economy: d[0].e || '--' } : { fastest: '--', economy: '--' };
}

function getFeeTrend24h() {
  var d = sqlQuery("SELECT ROUND(AVG(json_extract(json_data, '$.fastestFee')), 1) as avg FROM captures WHERE source='fees' AND captured_at >= datetime('now', '-1 day')");
  return d.length > 0 ? d[0].avg : '--';
}

function getMempoolStats() {
  var d = sqlQuery("SELECT json_extract(json_data, '$.count') as c FROM captures WHERE source='mempool' ORDER BY captured_at DESC LIMIT 1");
  return d.length > 0 ? (d[0].c || 0) : 0;
}

function getBlockCount() {
  var d = sqlQuery("SELECT json_extract(json_data, '$.blocks') as b FROM captures WHERE source='blockchair' ORDER BY captured_at DESC LIMIT 1");
  if (d.length > 0 && d[0].b) return d[0].b;
  var d2 = sqlQuery("SELECT MAX(height) as h FROM block_stats");
  return d2.length > 0 && d2[0].h ? d2[0].h : '960K';
}

function getNodeDistribution() {
  return sqlQuery("SELECT country, COUNT(*) as c FROM node_geo GROUP BY country ORDER BY c DESC LIMIT 5");
}

// LIVE node census (N): the node_census capture source (agent-25) writes the
// authoritative getnodeaddresses count. Falls back to a neutral phrase so
// marketing copy never ships a hardcoded stale figure (U4 fix, 2026-08-14).
function getLiveNodeCount() {
  try {
    var d = sqlQuery("SELECT json_extract(json_data, '$.totalKnownAddresses') as n FROM captures WHERE source='node_census' AND json_data NOT LIKE '%capture failed%' ORDER BY captured_at DESC LIMIT 1");
    if (d.length > 0 && d[0].n) return Number(d[0].n);
  } catch (e) {}
  return null;
}

function nodeCountPhrase() {
  var n = getLiveNodeCount();
  if (n) return n.toLocaleString() + ' reachable nodes (live census)';
  return 'the live node census (see /capacity)';
}

function getStorageRatio() {
  // Canonical source = the LIVE SCCR writer output (data/sccr.json, maintained
  // by tools/research/sccr_live.py). The storage-ratio-*.md report is a
  // historical snapshot and MUST NOT be used for fresh marketing copy — that
  // was the root of the stale 0.0149/27,800 claims (U4 fix, 2026-08-14).
  try {
    var livePath = path.resolve(__dirname, '..', '..', 'data', 'sccr.json');
    if (fs.existsSync(livePath)) {
      var live = JSON.parse(fs.readFileSync(livePath, 'utf8'));
      if (live && live.avg_sccr != null) return String(live.avg_sccr);
    }
  } catch (e) {}
  try {
    var dir = path.resolve(__dirname, '..', '..', 'reports', 'research');
    var files = fs.readdirSync(dir).filter(function(f) { return f.startsWith('storage-ratio-'); }).sort();
    if (files.length > 0) {
      var content = fs.readFileSync(path.join(dir, files[files.length - 1]), 'utf8');
      var m = content.match(/Avg coverage ratio \| ([\d.]+)/);
      if (m) return m[1];
    }
  } catch (e) {}
  return '--';
}

function getTopPools() {
  var d = sqlQuery("SELECT json_extract(json_data, '$.pools') as pools FROM captures WHERE source='mining_pools' ORDER BY captured_at DESC LIMIT 1");
  if (d.length > 0 && d[0].pools) {
    try {
      var pools = JSON.parse(d[0].pools);
      return pools.slice(0, 3).map(function(p) { return p.name || 'Unknown'; });
    } catch (e) {}
  }
  return [];
}

function getLNStats() {
  var d = sqlQuery("SELECT json_extract(json_data, '$.latest.node_count') as nc, json_extract(json_data, '$.latest.channel_count') as cc, json_extract(json_data, '$.latest.total_capacity') as cap FROM captures WHERE source='lightning' ORDER BY captured_at DESC LIMIT 1");
  if (d.length > 0 && d[0].nc) return { nodes: d[0].nc, channels: d[0].cc, capacity: (d[0].cap || 0) / 100000000 };
  return { nodes: '--', channels: '--', capacity: '--' };
}

function getBackfillCount() {
  var dir = path.resolve(__dirname, '..', '..', 'captured-data', 'backfill');
  try { return fs.readdirSync(dir).reduce(function(acc, d) {
    try { return acc + fs.readdirSync(path.join(dir, d)).filter(function(f) { return f.endsWith('.json'); }).length; } catch (e) { return acc; }
  }, 0); } catch (e) { return 0; }
}

// ─── Content Generators ───

function generateMediumArticle(topic) {
  var f = getLatestFee();
  var trend = getFeeTrend24h();
  var mp = getMempoolStats();
  var blocks = getBlockCount();
  var ratio = getStorageRatio();
  var ln = getLNStats();
  var nodes = getNodeDistribution();
  var pools = getTopPools();
  var backfill = getBackfillCount();

  var title = '';
  var body = '';
  var date = today();

  if (topic === 'fee') {
    title = 'Bitcoin Fees Are ' + f.fastest + ' sat/vB — What That Actually Means';
    body = '## Current State\n\n';
    body += 'Bitcoin\'s fastest fee is **' + f.fastest + ' sat/vB** right now. The 24-hour average is **' + trend + ' sat/vB**.\n\n';
    body += 'The mempool holds **' + mp.toLocaleString() + '** unconfirmed transactions — about **' + Math.round(mp / 600) + '** transactions entering per second.\n\n';
    body += '## The Misunderstood Metric\n\n';
    body += 'Most people look at fees and ask "is this high or low?" The better question is: **does this fee cover the cost it imposes on the network?**\n\n';
    body += 'Our Storage Cost Coverage Ratio currently stands at **' + ratio + '** — meaning current fees cover only ' + (parseFloat(ratio) * 100).toFixed(1) + '% of the estimated 10-year storage cost across the Bitcoin node network.\n\n';
    body += '## Why This Matters\n\n';
    body += 'Every transaction is stored by every full node for years (or indefinitely). The fee is paid once. The storage obligation persists. This gap — between one-time fees and permanent storage — is an open research question.\n\n';
    body += 'We\'re building the data infrastructure to measure it: **' + backfill + '** data points collected, **' + blocks.toLocaleString() + '** blocks analyzed, nodes across **' + nodes.length + '** countries.\n\n';
    body += '---\n\n';
    body += '*Built with Bitcoin Sahi — open source block space research platform.*\n';
    body += '[' + CONFIG.url + '](' + CONFIG.url + ')';
  }

  else if (topic === 'storage') {
    title = 'The Storage Cost Coverage Ratio: Do Bitcoin Fees Cover Node Costs?';
    body = '## A Simple Question\n\n';
    body += 'Bitcoin transaction fees are paid once. But the data those transactions create is stored by **' + nodeCountPhrase() + '** for **years or decades**.\n\n';
    body += 'Does the fee cover the cost?\n\n';
    body += '## What We Measured\n\n';
    body += 'We defined the **Storage Cost Coverage Ratio** as:\n\n';
    body += '> Fee (USD) / (Bytes × Nodes × Cost per Byte × Years)\n\n';
    body += 'Current result: **' + ratio + '**\n\n';
    body += 'This means fees cover only **' + (parseFloat(ratio) * 100).toFixed(1) + '%** of the estimated 10-year storage burden.\n\n';
    body += '## The Data Behind It\n\n';
    body += '- **' + backfill + '** API captures in SQLite\n';
    body += '- **' + blocks.toLocaleString() + '** blocks analyzed\n';
    body += '- **' + mp.toLocaleString() + '** current mempool transactions\n';
    body += '- **' + ln.nodes + '** Lightning nodes\n';
    body += '- **' + ln.capacity.toFixed(0) + ' BTC** locked in Lightning channels\n\n';
    if (pools.length > 0) body += 'Top mining pools: ' + pools.join(', ') + '\n\n';
    body += '## This Is an Open Question\n\n';
    body += 'We\'re not claiming the fee market is broken. We\'re providing the first empirical framework to measure whether it prices storage — a question the literature has not yet answered.\n\n';
    body += '---\n\n';
    body += '*First published on Bitcoin Sahi. Methodology and data: [bsahi.com/learn](' + CONFIG.url + '/learn)*';
  }

  else if (topic === 'network') {
    title = 'Bitcoin\'s Network: ' + nodeCountPhrase() + ' Across ' + nodes.length + ' Countries';
    body = '## The Physical Bitcoin\n\n';
    body += 'Bitcoin isn\'t just code. It\'s **' + blocks.toLocaleString() + ' blocks**, **' + ln.nodes + ' Lightning nodes**, and **' + backfill + ' data points** we\'ve collected from our own node.\n\n';
    body += '## Current Network State\n\n';
    body += '- Block height: ' + blocks.toLocaleString() + '\n';
    body += '- Fastest fee: ' + f.fastest + ' sat/vB (24h avg: ' + trend + ')\n';
    body += '- Mempool: ' + mp.toLocaleString() + ' transactions\n';
    body += '- Lightning: ' + ln.nodes + ' nodes, ' + ln.channels + ' channels, ' + ln.capacity.toFixed(0) + ' BTC capacity\n\n';
    body += '## Geographic Distribution\n\n';
    for (var i = 0; i < nodes.length; i++) {
      body += (i+1) + '. **' + nodes[i].country + '**: ' + nodes[i].c + ' reachable nodes\n';
    }
    body += '\nThis data comes from our own Bitcoin Core node\'s `getnodeaddresses` RPC, geo-located via ip-api.com.\n\n';
    body += '---\n\n';
    body += '*Live dashboard: [bsahi.com/capacity](' + CONFIG.url + '/capacity)*';
  }

  return { title: title, body: body, date: date };
}

function generateTweetThread(topic) {
  var f = getLatestFee();
  var mp = getMempoolStats();
  var ratio = getStorageRatio();
  var blocks = getBlockCount();
  var ln = getLNStats();
  var backfill = getBackfillCount();
  var nodes = getNodeDistribution();

  var tweets = [];

  if (topic === 'fee' || topic === 'all') {
    tweets.push('1/ Bitcoin\'s fastest fee is **' + f.fastest + ' sat/vB** right now. But here\'s what most people miss about how fees actually work.\n\nA short thread on the economics of block space.');
    tweets.push('2/ Fees are an auction for **scarce block space**. Every ~10 minutes, miners select the highest-paying transactions. If you want in faster, you bid higher.\n\nBut there\'s a less discussed side: **storage permanence.**');
    tweets.push('3/ Every transaction is stored by ' + nodeCountPhrase() + ' forever. The fee is paid once. The storage cost persists for years.\n\nWe built a metric called the **Storage Cost Coverage Ratio** to measure this gap.');
    tweets.push('4/ Current ratio: **' + ratio + '**\n\nMeaning: fees cover only **' + (parseFloat(ratio) * 100).toFixed(1) + '%** of the estimated 10-year storage cost.\n\nThis is an open research question — not a conclusion. We\'re publishing the data and methodology.\n\n' + CONFIG.url + '/learn');
  }

  if (topic === 'network' || topic === 'all') {
    if (tweets.length > 0) tweets.push('');
    tweets.push('Bitcoin\'s network right now:\n\n⛓ ' + blocks.toLocaleString() + ' blocks\n⚡ ' + ln.nodes + ' LN nodes\n🌍 ' + nodes.length + ' countries\n📡 ' + backfill + ' data captures\n💰 ' + f.fastest + ' sat/vB fastest fee\n\nAll live at ' + CONFIG.url);
  }

  return tweets;
}

function generateLinkedInPost(topic) {
  var f = getLatestFee();
  var ratio = getStorageRatio();
  var mp = getMempoolStats();
  var blocks = getBlockCount();
  var ln = getLNStats();
  var backfill = getBackfillCount();
  var nodes = getNodeDistribution();

  var post = '';

  if (topic === 'fee') {
    post = 'Bitcoin\'s fee market is the most sophisticated congestion pricing mechanism in the digital asset world. It allocates ~7 MB of block space per day among thousands of competing transactions.\n\n';
    post += 'But it only prices **congestion** — not **permanence**.\n\n';
    post += 'Every transaction is stored by ' + nodeCountPhrase() + ' forever. The fee is paid once. The storage persists for years.\n\n';
    post += 'Our Storage Cost Coverage Ratio measures this gap.\n\n';
    post += 'Current ratio: ' + ratio + ' — meaning fees cover ' + (parseFloat(ratio) * 100).toFixed(1) + '% of 10-year storage cost.\n\n';
    post += 'Open research question. Reproducible methodology. Published at ' + CONFIG.url + '/learn';
  }

  else if (topic === 'project') {
    post = 'I built Bitcoin Sahi — a block space research platform — from scratch, alone.\n\n';
    post += 'What it does:\n';
    post += '• Tracks 13 data sources + our own Bitcoin Core node\n';
    post += '• ' + backfill + ' API captures in SQLite\n';
    post += '• 7 persona-driven decision tabs\n';
    post += '• Real-time Bitcoin Weather\n';
    post += '• Node distribution across ' + nodes.length + ' countries\n';
    post += '• Published research: Storage Cost Coverage Ratio\n\n';
    post += 'All open source at ' + CONFIG.github + '\n';
    post += 'Live at ' + CONFIG.url;
  }

  return post;
}

// ─── Content Calendar ───

var CALENDAR = [
  { day: 1, topic: 'fee', platform: 'linkedin', type: 'post' },
  { day: 1, topic: 'fee', platform: 'twitter', type: 'thread' },
  { day: 2, topic: 'storage', platform: 'medium', type: 'article' },
  { day: 3, topic: 'network', platform: 'reddit', type: 'post' },
  { day: 4, topic: 'fee', platform: 'linkedin', type: 'post' },
  { day: 5, topic: 'project', platform: 'twitter', type: 'thread' },
  { day: 6, topic: 'storage', platform: 'linkedin', type: 'post' },
  { day: 7, topic: 'network', platform: 'twitter', type: 'thread' },
];

function generateContent(dayOffset) {
  dayOffset = dayOffset || 0;
  var date = new Date();
  date.setDate(date.getDate() + dayOffset);
  var dayOfWeek = date.getDay();
  var calendarDay = ((Math.floor(date.getTime() / 86400000) % 7) + 1);

  var items = CALENDAR.filter(function(c) { return c.day === calendarDay; });
  if (items.length === 0) items = [CALENDAR[0]];

  var results = [];
  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    var content = null;
    if (item.platform === 'twitter') {
      var tweets = generateTweetThread(item.topic);
      content = tweets.join('\n\n---\n\n');
    } else if (item.platform === 'linkedin') {
      content = generateLinkedInPost(item.topic);
    } else if (item.platform === 'medium') {
      var article = generateMediumArticle(item.topic);
      content = article.title + '\n\n' + article.body;
    } else if (item.platform === 'reddit') {
      var a = generateMediumArticle(item.topic);
      content = a.body;
    }
    results.push({
      date: date.toISOString().slice(0, 10),
      platform: item.platform,
      topic: item.topic,
      content: content
    });
  }
  return results;
}

function saveContent(contentItems) {
  ensureDir(OUT_DIR);
  for (var i = 0; i < contentItems.length; i++) {
    var item = contentItems[i];
    var filename = item.date + '-' + item.platform + '-' + item.topic + '.md';
    var filepath = path.join(OUT_DIR, filename);
    var header = '---\nplatform: ' + item.platform + '\ntopic: ' + item.topic + '\ndate: ' + item.date + '\n---\n\n';
    fs.writeFileSync(filepath, header + item.content);
    console.log('  Saved: ' + filename);
  }
}

// ─── Generate Weekly Content Plan ───

function generateWeeklyPlan() {
  console.log('═══ Marketing Agent — Weekly Content Plan ═══\n');
  for (var d = 0; d < 7; d++) {
    var items = generateContent(d);
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      var preview = item.content.replace(/\n/g, ' ').substring(0, 80);
      console.log(item.date + ' | ' + item.platform.padEnd(10) + ' | ' + item.topic.padEnd(10) + ' | ' + preview + '...');
    }
  }
  console.log('\n═══ Generating full content... ═══\n');
  for (var d = 0; d < 7; d++) {
    var items = generateContent(d);
    saveContent(items);
  }
  console.log('\nDone. Content saved to ' + OUT_DIR);
}

// ─── Command-line interface ───

if (require.main === module) {
  var args = process.argv.slice(2);
  if (args[0] === '--plan' || args[0] === '-p') {
    generateWeeklyPlan();
  } else if (args[0] === '--today' || args[0] === '-t') {
    var items = generateContent(0);
    saveContent(items);
    console.log('\nToday\'s content ready at ' + OUT_DIR);
  } else {
    generateWeeklyPlan();
  }
}

module.exports = { generateContent: generateContent, generateTweetThread: generateTweetThread, generateLinkedInPost: generateLinkedInPost, generateMediumArticle: generateMediumArticle, generateWeeklyPlan: generateWeeklyPlan };
