var CONFIG = {
  brand: 'BSAHI',
  product: 'Bitcoin Sahi',
  url: 'https://bitcoinsahi.com',
  tagline: 'Block space research & decision platform',
  email: 'prateek@bitcoinsahi.com',
  github: 'github.com/prateekposwal/block-space-economics',
  
  platforms: {
    linkedin: { enabled: true, url: 'https://linkedin.com/in/prateekposwal' },
    twitter: { enabled: true, handle: '@PrateekPoswal' },
    reddit: { enabled: true, subreddits: ['r/Bitcoin', 'r/BitcoinEngineering', 'r/CryptoTechnology'] },
    bitcoinOptech: { enabled: true, url: 'https://bitcoinops.org' },
  },

  contentTypes: {
    article: { minWords: 800, maxWords: 2000, tone: 'professional' },
    twitterThread: { minTweets: 3, maxTweets: 6, tone: 'conversational' },
    linkedinPost: { minWords: 200, maxWords: 600, tone: 'professional' },
    redditPost: { minWords: 300, maxWords: 1000, tone: 'conversational' },
    redditReply: { minWords: 50, maxWords: 300, tone: 'helpful' },
    comment: { minWords: 30, maxWords: 150, tone: 'helpful' },
  },

  topics: [
    'Bitcoin fee market analysis',
    'Storage Cost Coverage Ratio',
    'Block space economics',
    'BIP-110 and data restrictions',
    'Lightning Network capacity',
    'Bitcoin node distribution',
    'Settlement capacity',
    'Mempool dynamics',
    'Mining pool concentration',
  ]
};

if (typeof module !== 'undefined') module.exports = { CONFIG };
