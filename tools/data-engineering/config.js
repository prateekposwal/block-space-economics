var CONFIG = {
  agent: {
    name: 'Data Engineer v1',
    cycleMinutes: 60,
    reportDir: 'reports/data-engineering',
    stateFile: 'captured-data/de-agent-state.json',
  },
  discovery: {
    enabled: true,
    searchIntervalHours: 24,
    maxNewSources: 5,
    sources: [
      { name: 'BitcoinOps', url: 'https://bitcoinops.org/en/newsletters/', type: 'newsletter' },
      { name: 'DelvingBitcoin', url: 'https://delvingbitcoin.org/', type: 'forum' },
      { name: 'BitcoinDevMailingList', url: 'https://lists.linuxfoundation.org/pipermail/bitcoin-dev/', type: 'mailinglist' },
      { name: 'MempoolSpace', url: 'https://mempool.space/api/v1/services', type: 'api-index' },
      { name: 'BlockstreamInfo', url: 'https://blockstream.info/api/', type: 'api' },
      { name: 'GitHubBitcoin', url: 'https://api.github.com/search/repositories?q=bitcoin+api&sort=updated', type: 'github' },
      { name: 'NerdVana', url: 'https://www.nerd.vana.com/', type: 'blog' },
    ],
  },
  integration: {
    enabled: true,
    stagingDir: 'captured-data/staging',
    maxRetries: 3,
    testBeforeDeploy: true,
  },
  monitoring: {
    checkIntervalMinutes: 15,
    freshnessMaxAgeMinutes: 30,
    staleAfterMinutes: 0,
    errorThreshold: 5,
    latencyWarningMs: 3000,
    reportOnFailure: true,
    concurrency: 4,      // max parallel endpoint checks (was unbounded -> saturated mempool.space CDN)
    retries: 1,          // retry once before marking an endpoint unhealthy (transient-slow tolerance)
  },
  capture: {
    baseIntervalMinutes: 60,
    timeoutMs: 30000,    // raised from 15000 — mempool.space heavy endpoints verified at 5–28s under load
    degradedMultiplier: 2,
    recoveryMultiplier: 1.5,
    recoveryCycles: 2,
    maxMissedCycles: 3,
    mirror: true,
    bridge: true
  },
  reporting: {
    formats: ['markdown', 'json'],
    maxReportAge: 7,
    slackWebhook: null,
  },
  // NOTE on timeouts vs latency: `maxLatency` = HEALTH THRESHOLD (ok if latency <= maxLatency).
  // `timeoutMs` = HARD FETCH TIMEOUT (how long the monitor waits before aborting). These are
  // decoupled now. Before the 2026-08-02 fix they were conflated, so mempool.space slow periods
  // (verified 5–28s) blew through the 5–7s effective timeout and flamed every endpoint at once.
  endpoints: [
    // ── Priority 1: core site data (fees / price / mempool) ──────────────────────────
    // Fallbacks added 2026-08-02: mempool.space is the primary but if it dies the whole
    // core series dies — blockstream/blockchair serve as failover, adapted to the schemas.
    { key: 'fees',            url: 'https://mempool.space/api/v1/fees/recommended',         method: 'GET', category: 'fees',     priority: 1, maxLatency: 5000,  timeoutMs: 25000,
      fallbacks: [ { label: 'blockstream-fee-estimates', url: 'https://blockstream.info/api/fee-estimates', timeoutMs: 15000,
        adapt: function(d) {
          // blockstream returns {targetBlocks: feeSatPerVb} — map to the mempool.space schema.
          return {
            fastestFee: Math.round(d['1'] || d['2'] || 0),
            halfHourFee: Math.round(d['3'] || d['4'] || d['6'] || 0),
            hourFee: Math.round(d['6'] || d['12'] || d['24'] || 0),
            economyFee: Math.round(d['24'] || d['144'] || 0),
            minimumFee: Math.round(d['144'] || d['1008'] || 0)
          };
        } } ] },
    { key: 'btc_price',       url: 'https://mempool.space/api/v1/prices',                  method: 'GET', category: 'price',    priority: 1, maxLatency: 5000,  timeoutMs: 25000,
      fallbacks: [ { label: 'blockchair-stats', url: 'https://api.blockchair.com/bitcoin/stats', timeoutMs: 15000,
        adapt: function(d) {
          var price = (d.data && d.data.market_price_usd) || 0;
          return { time: Math.floor(Date.now() / 1000), USD: Math.round(price), EUR: 0, GBP: 0, CAD: 0, CHF: 0, AUD: 0, JPY: 0 };
        } } ] },
    { key: 'mempool',         url: 'https://mempool.space/api/mempool',                    method: 'GET', category: 'mempool',  priority: 1, maxLatency: 5000,  timeoutMs: 25000,
      fallbacks: [ { label: 'blockstream-mempool', url: 'https://blockstream.info/api/mempool', timeoutMs: 15000 } ] }, // identical shape (count/vsize/total_fee/fee_histogram)

    // ── Priority 1: fee market history / feerate distribution ────────────────────────
    { key: 'mempool_blocks',  url: 'https://mempool.space/api/v1/fees/mempool-blocks',     method: 'GET', category: 'fees',     priority: 1, maxLatency: 8000,  timeoutMs: 30000 },
    { key: 'fee_history',     url: 'https://mempool.space/api/v1/mining/blocks/fees/24h',  method: 'GET', category: 'fees',     priority: 1, maxLatency: 8000,  timeoutMs: 30000 },

    // ── Priority 2: block headers / raw block data ───────────────────────────────────
    // blocks = last 10 block headers incl. id (hash), height, tx_count, size, weight, difficulty, pool.
    { key: 'blocks',          url: 'https://mempool.space/api/blocks?limit=10',            method: 'GET', category: 'blocks',   priority: 2, maxLatency: 8000,  timeoutMs: 30000 },
    { key: 'block_height',    url: 'https://blockstream.info/api/blocks/tip/height',       method: 'GET', category: 'blocks',   priority: 2, maxLatency: 15000, timeoutMs: 30000 }, // blockstream CDN intermittently throttles — headroom 2026-08-02
    { key: 'block_hash',      url: 'https://blockstream.info/api/blocks/tip/hash',         method: 'GET', category: 'blocks',   priority: 2, maxLatency: 15000, timeoutMs: 30000 }, // NEW 2026-08-02: tip header hash; CDN throttles intermittently
    // raw_block_tip = FULL raw block of the tip (all headers + txs), chained: blockstream tip hash → blockstream raw.
    // Verified 2026-08-02: ~7s when healthy (28s via mempool.space — hence same-host chain).
    { key: 'raw_block_tip',   url: 'https://blockstream.info/api/blocks/tip/hash',         method: 'GET', category: 'blocks',   priority: 2, maxLatency: 60000, timeoutMs: 60000, retries: 0,
      chain: [ 'https://blockstream.info/api/blocks/tip/hash', 'https://blockstream.info/api/block/:hash/raw' ] }, // NEW 2026-08-02: full raw block capture; retries:0 keeps monitor rounds bounded

    // ── Priority 2: mining / lightning ───────────────────────────────────────────────
    { key: 'difficulty',      url: 'https://mempool.space/api/v1/difficulty-adjustment',   method: 'GET', category: 'mining',   priority: 2, maxLatency: 8000,  timeoutMs: 25000 },
    { key: 'mining_pools',    url: 'https://mempool.space/api/v1/mining/pools/weekly',     method: 'GET', category: 'mining',   priority: 2, maxLatency: 30000, timeoutMs: 45000, retries: 0 }, // verified 13–20s when healthy
    { key: 'hashrate',        url: 'https://mempool.space/api/v1/mining/hashrate/24h',     method: 'GET', category: 'mining',   priority: 2, maxLatency: 30000, timeoutMs: 45000, retries: 0 }, // NEW 2026-08-02: 24h hashrate (was a gap); verified 18s+ under CDN load
    { key: 'lightning',       url: 'https://mempool.space/api/v1/lightning/statistics/latest', method: 'GET', category: 'lightning', priority: 2, maxLatency: 8000, timeoutMs: 30000 },
    { key: 'mempool_recent',  url: 'https://mempool.space/api/mempool/recent',             method: 'GET', category: 'mempool',  priority: 2, maxLatency: 30000, timeoutMs: 45000, retries: 0 }, // NEW 2026-08-02: tx-level mempool snapshot (fee/vsize/value per tx)

    // ── Priority 3: cross-checks / sentiment ─────────────────────────────────────────
    { key: 'coinpaprika',     url: 'https://api.coinpaprika.com/v1/coins/btc-bitcoin',     method: 'GET', category: 'price',    priority: 3, maxLatency: 10000, timeoutMs: 20000 },
    { key: 'fear_greed',      url: 'https://api.alternative.me/fng/',                     method: 'GET', category: 'sentiment', priority: 3, maxLatency: 10000, timeoutMs: 20000 }, // verified 4s+ when healthy
    { key: 'blockchair',      url: 'https://api.blockchair.com/bitcoin/stats',             method: 'GET', category: 'general',  priority: 3, maxLatency: 10000, timeoutMs: 25000 }, // carries blockchain_size, outputs (UTXO proxy), hashrate
  ],

  // Dead external sources — verified 404/DOA 2026-08-02, NOT monitored (honest documentation,
  // equivalents already covered above):
  //   - blockchain.info/q/utxocount  → 404 (API retired). UTXO proxy = blockchair `outputs` + mempool_tx count.
  //   - ordinals.com/api/stats       → 404 (API retired). Inscription coverage = research/inscription pipeline.
  //   - wickedsmartbitcoin.com/api/bip110 → 404 (host dead). SUPERSEDED 2026-08-10: BIP-110 signaling is now captured LIVE via agent-26 (mempool.space version bits) — the mandatory-signaling window (961632-963647) is a one-time governance natural experiment. The "~0.1% DOA" note predated the window.
  deadSources: [
    { key: 'utxo_count_blockchain_info', url: 'https://blockchain.info/q/utxocount',  status: 404, replacement: 'blockchair.outputs + mempool.mempool_tx_count' },
    { key: 'ordinals_stats',             url: 'https://ordinals.com/api/stats',       status: 404, replacement: 'research/fetch_inscription_stats.py pipeline' },
    { key: 'bip110_signal',              url: 'https://wickedsmartbitcoin.com/api/bip110', status: 404, replacement: 'LIVE capture via agent-26 (mempool.space version bits) — mandatory-signaling window 961632-963647, lock-in <= 963648' },
  ],
};

function staleAfterMinutes() {
  if (CONFIG.monitoring.staleAfterMinutes > 0) return CONFIG.monitoring.staleAfterMinutes;
  return Math.max(2 * (CONFIG.capture.baseIntervalMinutes || CONFIG.agent.cycleMinutes || 60), 30);
}

if (typeof module !== 'undefined') module.exports = { CONFIG, staleAfterMinutes };
