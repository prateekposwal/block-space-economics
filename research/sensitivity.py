import json
import os
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np

# Canonical centers from research/model-spec.json v2.0.0 (P1.8).
with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'model-spec.json')) as _f:
    Q = json.load(_f)['quantities']
SPEC_C = Q['C']['value']  # 925 pinned canonical node cost (USD/yr); component sum is 924.35

base = {
    'hw_cost': 500, 'hw_lifetime': 3, 'bw_monthly': 50,
    'node_watts': 150, 'elec_rate': 0.12,
    'insc_bytes': Q['I_bytes']['value'],     # 400  (spec)
    'insc_monthly': Q['I_rate']['value'],    # 100000 (spec)
    'utxo_life': Q['T']['value'],            # 10   (spec)
}

def compute(params):
    hw_a = params['hw_cost'] / params['hw_lifetime']
    bw_a = params['bw_monthly'] * 12
    kwh = params['node_watts'] * 24 * 365 / 1000
    el_a = kwh * params['elec_rate']
    total = hw_a + bw_a + el_a
    by = params['insc_bytes'] * params['insc_monthly'] * 12
    cpb = total / by
    return cpb * params['insc_bytes'] * params['utxo_life']

base_val = compute(base)

params = [
    ('insc_monthly', 'Inscription Volume', 0.60),
    ('node_watts', 'Node Power Draw', 0.40),
    ('bw_monthly', 'Bandwidth Cost', 0.35),
    ('hw_cost', 'Hardware Cost', 0.20),
    ('elec_rate', 'Electricity Rate', 0.20),
    ('insc_bytes', 'Inscription Size', 0.20),
    ('hw_lifetime', 'Hardware Lifespan', 0.15),
    ('utxo_life', 'UTXO Lifetime', 0.15),
]

names = []
lows = []
highs = []

for key, name, impact in params:
    p_low = base.copy()
    p_high = base.copy()
    p_low[key] = base[key] * 0.5
    p_high[key] = base[key] * 1.5
    low_val = compute(p_low)
    high_val = compute(p_high)
    names.append(name)
    lows.append(low_val)
    highs.append(high_val)

ranges = [abs(h - l) for h, l in zip(highs, lows)]
sorted_idx = np.argsort(ranges)

fig, ax = plt.subplots(figsize=(10, 6))
y_pos = np.arange(len(names))

for i, idx in enumerate(sorted_idx):
    ax.barh(y_pos[i], highs[idx] - base_val, left=base_val, height=0.6,
            color='#F7931A', alpha=0.7, edgecolor='white')
    ax.barh(y_pos[i], lows[idx] - base_val, left=base_val, height=0.6,
            color='#58A6FF', alpha=0.7, edgecolor='white')

ax.set_yticks(y_pos)
ax.set_yticklabels([names[i] for i in sorted_idx])
ax.axvline(x=base_val, color='#F0F6FC', linestyle='-', linewidth=1)
ax.set_xlabel('Storage Cost per Inscription (log scale)')
ax.set_title('Sensitivity Analysis — Parameter Impact on Storage Cost')
plt.tight_layout()
plt.savefig('/Users/prateekposwal/block-space-economics/research/sensitivity_chart.png', dpi=150, bbox_inches='tight')
print("Sensitivity chart saved")
