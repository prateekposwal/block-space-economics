import json
import os
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.ticker as mticker
import numpy as np

# Values sourced from research/model-spec.json v2.0.0 (P1.9).
with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'model-spec.json')) as _f:
    Q = json.load(_f)['quantities']
L_INSC = Q['L_insc']['value']  # 0.00770292 lifetime storage cost per inscription (USD)
C = Q['C']['value']            # 925 canonical annual node cost (USD/yr)

plt.rcParams.update({
    'font.family': 'sans-serif',
    'font.size': 11,
    'axes.facecolor': '#f8f9fa',
    'figure.facecolor': '#f8f9fa',
    'axes.edgecolor': '#dee2e6',
    'axes.grid': True,
    'grid.alpha': 0.3,
    'grid.color': '#adb5bd',
})

fig = plt.figure(figsize=(14, 10))

# ── Panel 1: Annual node cost breakdown ──
ax1 = fig.add_subplot(2, 2, 1)
labels = ['Hardware\n(depreciation)', 'Bandwidth', 'Electricity']
sizes = [166.67, 600.00, 157.68]
colors = ['#4a6fa5', '#dd6b4b', '#47b39c']
explode = (0.02, 0.02, 0.02)
wedges, texts, autotexts = ax1.pie(
    sizes, labels=labels, autopct='%1.0f%%',
    colors=colors, explode=explode, startangle=90,
    textprops={'fontsize': 9}, pctdistance=0.75,
    wedgeprops={'linewidth': 1, 'edgecolor': '#f8f9fa'}
)
ax1.set_title(f'Annual Full Node Cost: ${C:.0f}/yr', fontweight='bold', fontsize=13, pad=10)

# ── Panel 2: Fee vs storage cost comparison (log scale) ──
ax2 = fig.add_subplot(2, 2, 2)
categories = ['Modeled\nstorage cost\n(10yr)', 'Current fee\n(low activity)', 'Current fee\n(moderate)', 'Peak fee\n(inscription mania)']
values = [L_INSC, 0.06, 0.50, 25.00]
bar_colors = ['#47b39c', '#4a6fa5', '#dd6b4b', '#c0392b']
bars = ax2.bar(range(len(categories)), values, color=bar_colors, width=0.6, edgecolor='white', linewidth=1.2)
ax2.set_yscale('log')
ax2.set_ylabel('USD per inscription (log scale)', fontsize=10)
ax2.set_xticks(range(len(categories)))
ax2.set_xticklabels(categories, fontsize=8)
ax2.set_title('Inscription Fee vs Storage Cost', fontweight='bold', fontsize=13, pad=10)
for bar, val in zip(bars, values):
    ax2.text(bar.get_x() + bar.get_width()/2, bar.get_height()*1.1,
             f'${val:.3f}' if val < 1 else f'${val:.0f}',
             ha='center', va='bottom', fontsize=8, fontweight='bold')
ax2.set_ylim(bottom=0.001, top=80)

# Annotations showing ratio
ax2.annotate('', xy=(0, L_INSC), xytext=(1, 0.06),
             arrowprops=dict(arrowstyle='<->', color='#666', lw=1.5))
ax2.text(0.5, 0.02, '~8×', ha='center', fontsize=8, color='#666', fontweight='bold')

ax2.annotate('', xy=(0, L_INSC), xytext=(4, 25),
             arrowprops=dict(arrowstyle='<->', color='#666', lw=1.5))
ax2.text(2, 0.5, '~3,000×', ha='center', fontsize=8, color='#666', fontweight='bold')

# ── Panel 3: UTXO set growth from inscriptions ──
ax3 = fig.add_subplot(2, 2, 3)
months = np.arange(1, 13)
low_volume = 50_000 * 400 / 1e9  # GB per month
high_volume = 300_000 * 400 / 1e9
base_volume = 100_000 * 400 / 1e9

low_growth = np.cumsum(np.full(12, low_volume))
high_growth = np.cumsum(np.full(12, high_volume))
base_growth = np.cumsum(np.full(12, base_volume))

ax3.fill_between(months, low_growth, high_growth, alpha=0.15, color='#4a6fa5')
ax3.plot(months, low_growth, '--', color='#4a6fa5', linewidth=1, label='50K/mo (low)')
ax3.plot(months, high_growth, '--', color='#4a6fa5', linewidth=1, label='300K/mo (high)')
ax3.plot(months, base_growth, '-', color='#c0392b', linewidth=2.5, label='100K/mo (base)')
ax3.set_xlabel('Months', fontsize=10)
ax3.set_ylabel('Cumulative UTXO data (GB)', fontsize=10)
ax3.set_title('UTXO Set Growth from Inscriptions', fontweight='bold', fontsize=13, pad=10)
ax3.legend(fontsize=8, framealpha=0.8)
ax3.set_xticks(months)
ax3.set_xticklabels([f'M{m}' for m in months], fontsize=7)

# Annotate 12-month values
ax3.annotate(f'{base_growth[-1]:.1f} GB/yr', xy=(12, base_growth[-1]),
             xytext=(8, base_growth[-1]*1.2),
             arrowprops=dict(arrowstyle='->', color='#c0392b'),
             fontsize=8, color='#c0392b', fontweight='bold')

# ── Panel 4: Ratio comparison ──
ax4 = fig.add_subplot(2, 2, 4)
scenarios = ['Low\nactivity', 'Moderate\nactivity', 'Peak\ninscription\nmania']
fee_vs_storage = [8, 65, 3250]
bar_colors2 = ['#47b39c', '#dd6b4b', '#c0392b']
bars2 = ax4.bar(range(len(scenarios)), fee_vs_storage, color=bar_colors2, width=0.5, edgecolor='white', linewidth=1.2)
ax4.set_xticks(range(len(scenarios)))
ax4.set_xticklabels(scenarios, fontsize=8)
ax4.set_ylabel('× ratio (fee ÷ storage cost)', fontsize=10)
ax4.set_title('Fee-to-Storage-Cost Ratio', fontweight='bold', fontsize=13, pad=10)
for bar, val in zip(bars2, fee_vs_storage):
    ax4.text(bar.get_x() + bar.get_width()/2, bar.get_height()*1.02,
             f'{val}×', ha='center', va='bottom', fontsize=10, fontweight='bold')
# Reference line
ax4.axhline(y=1, color='#666', linestyle=':', linewidth=0.8, label=f'Storage cost = ${L_INSC:.4f}')
ax4.text(2.3, 1.5, 'Storage cost', fontsize=7, color='#666')
ax4.set_ylim(bottom=0, top=3800)

plt.suptitle('Bitcoin Block Space — The Permanence Externality',
             fontsize=16, fontweight='bold', y=0.98)
fig.text(0.5, 0.01,
         'Research: bitcoinsahi.com  ·  Discussion: reddit.com/r/BitcoinEngineering',
         ha='center', fontsize=8, color='#666')

plt.tight_layout(rect=[0, 0.03, 1, 0.95])
plt.savefig('/Users/prateekposwal/block-space-economics/research/chart_dashboard.png',
            dpi=200, bbox_inches='tight', facecolor='#f8f9fa')
print("Dashboard chart saved")
