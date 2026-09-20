import matplotlib.pyplot as plt
import numpy as np

def generate_grouped_barchart(output_path="impact_comparison_barchart.png"):
    # Set figure size and dpi to match clean presentation slides
    fig, ax = plt.subplots(figsize=(8.5, 4.8), dpi=300)
    fig.patch.set_facecolor('white')
    ax.set_facecolor('white')

    # Categories and values
    categories = [
        "False Alarm\nFiltration",
        "Rapid Triage\n& Dispatch",
        "Toxic Plume\nModeling",
        "Explainable\nProvenance"
    ]
    
    # Scores out of 100%
    before_scores = [22, 15, 0, 20]     # 22% (78% false alarm), 15% speed (45-90min), 0% plume, 20% heuristics
    after_scores = [92, 96, 100, 95]    # 92% (8% false alarm), 96% (<30s), 100% (3-zone plume), 95% (TreeSHAP)

    x = np.arange(len(categories))
    width = 0.32  # Width of the bars

    # Colors: Red for Before, Green for After
    c_before = '#EF4444'  # Vibrant Red
    c_after = '#10B981'   # Emerald Green
    c_before_border = '#B91C1C'
    c_after_border = '#047857'

    # Plot bars with subtle border like reference
    rects1 = ax.bar(x - width/2, before_scores, width, label='Before (FIRMS Alone)', 
                    color=c_before, edgecolor=c_before_border, linewidth=1.2, zorder=3)
    rects2 = ax.bar(x + width/2, after_scores, width, label='After (With PyroSat)', 
                    color=c_after, edgecolor=c_after_border, linewidth=1.2, zorder=3)

    # Title matching reference style
    ax.set_title("Comparison Before and After Implementation", fontsize=14, fontweight='bold', color='#1E293B', pad=18)

    # Y-axis setup
    ax.set_ylim(0, 115)
    ax.set_ylabel("Effectiveness Score (%)", fontsize=11, fontweight='bold', color='#475569', labelpad=10)
    ax.set_yticks([0, 20, 40, 60, 80, 100])
    ax.set_yticklabels(['0%', '20%', '40%', '60%', '80%', '100%'], fontsize=10, color='#64748B')

    # X-axis setup
    ax.set_xticks(x)
    ax.set_xticklabels(categories, fontsize=10.5, fontweight='bold', color='#334155')

    # Horizontal Gridlines only (matching Image 2 style)
    ax.grid(axis='y', linestyle='-', color='#E2E8F0', linewidth=1.0, zorder=1)
    ax.set_axisbelow(True)

    # Clean borders (spines)
    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)
    ax.spines['left'].set_color('#CBD5E1')
    ax.spines['left'].set_linewidth(1.2)
    ax.spines['bottom'].set_color('#CBD5E1')
    ax.spines['bottom'].set_linewidth(1.2)

    # Add data labels on top of each bar
    def autolabel(rects, is_after=False):
        for rect in rects:
            height = rect.get_height()
            if height == 0:
                ax.annotate('0%',
                            xy=(rect.get_x() + rect.get_width() / 2, 1),
                            xytext=(0, 3),  # 3 points vertical offset
                            textcoords="offset points",
                            ha='center', va='bottom', fontsize=9.5, fontweight='bold', color='#B91C1C')
            else:
                color = '#065F46' if is_after else '#991B1B'
                ax.annotate(f'{height}%',
                            xy=(rect.get_x() + rect.get_width() / 2, height),
                            xytext=(0, 4),
                            textcoords="offset points",
                            ha='center', va='bottom', fontsize=9.5, fontweight='bold', color=color)

    autolabel(rects1, is_after=False)
    autolabel(rects2, is_after=True)

    # Legend at the bottom center (matching Image 2)
    ax.legend(loc='upper center', bbox_to_anchor=(0.5, -0.15), ncol=2, frameon=False, 
              fontsize=10.5, handlelength=1.2, handleheight=1.2)

    plt.tight_layout()
    plt.savefig(output_path, dpi=300, bbox_inches='tight', facecolor='white')
    plt.close()
    print(f"Grouped barchart saved to {output_path}")

if __name__ == '__main__':
    generate_grouped_barchart()
