// BSAHI — canonical 7-angle research agenda
// Single source of truth mapping each research angle to: its topic-signal key
// (for engagement_weight), the owning persona, gap status, and source coverage.
// Consumed by agent-15 (research-priority.json) and agent-14 (brief ordering).
// Angles carry an `umbrella` tag grouping them under the broader resource-pricing
// research question (P2.3): storage-pricing, fee-market, etc.
module.exports = [
  { id: 'fee-share-per-halving', title: 'Fee Share vs. Subsidy Across Halvings',
    topic: 'fees', persona_owner: 'Fees Analyst', has_gap: false,
    source_file: 'research/problem_statement.md',
    keywords: ['fee share', 'halving', 'subsidy', 'miner revenue', 'fee market'] },
  { id: 'lightning-externality', title: 'Lightning Network Externality on Block Demand',
    topic: 'lightning', persona_owner: 'Data Journalist', has_gap: true,
    source_file: null,
    keywords: ['lightning', 'ln', 'routing', 'channel', 'externality'] },
  { id: 'block-composition', title: 'Block Composition & Weight Economics',
    topic: 'blocks', persona_owner: 'Fees Analyst', has_gap: false,
    source_file: 'research/bip141_analysis.md',
    keywords: ['block', 'block size', 'block space', 'weight', 'segwit', 'witness'] },
  { id: 'fork-economics', title: 'Fork Economics & Activation Incentives',
    topic: 'fork', persona_owner: 'Protocol Researcher', has_gap: true,
    source_file: null,
    keywords: ['fork', 'activation', 'signaling', 'consensus change', 'bip'] },
  { id: 'causal-chain', title: 'Causal Chain: Fees -> Security -> Node Cost',
    topic: 'economy', persona_owner: 'Economics Analyst', has_gap: true,
    source_file: null,
    keywords: ['economy', 'incentive', 'causal', 'security budget', 'node cost'] },
  { id: 'permanence-vs-congestion', title: 'Permanence vs. Congestion: The Storage Externality',
    topic: 'cost', persona_owner: 'Research Engineer', has_gap: false,
    source_file: 'research/pruning_externality_analysis.md',
    umbrella: 'resource-pricing',
    keywords: ['cost', 'storage', 'pruning', 'permanence', 'ratio'] },
  { id: 'block-size-political-economy', title: 'Block Size: The Political Economy of a Consensus Parameter',
    topic: 'blocks', persona_owner: 'Protocol Researcher', has_gap: true,
    source_file: 'research/history-of-bitcoin.md',
    keywords: ['block size', 'capacity', 'political', 'economy', 'war'] }
];
