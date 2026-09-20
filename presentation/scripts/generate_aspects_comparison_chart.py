import matplotlib.pyplot as plt
import numpy as np
import os

def generate_aspects_comparison_chart(output_path="crisis_vs_smart_system_barchart.png"):
    # --- Categories from the 2nd Graph (Incident Management & Technical Metrics) ---
    categories = [
        "Detection-to-Alert Latency",
        "Industrial False Alarms",
        "Multi-Agency Response Delay",
        "Satellite Observation Gaps",
        "Hazard Standoff Guesswork"
    ]

    # Values: Current Workflow (High Bottleneck/Crisis) vs PyroSat System (Drastically Reduced)
    # False alarms are way less in PyroSat (25% -> 6%)!
    current_values = [40, 25, 20, 10, 5]   # Blue bars (Current Workflow)
    system_values  = [15, 6, 5, 3, 1]     # Grey bars (With PyroSat System)

    # "Why We Are Better" explanations matching the 2nd graph's Capability Added pills
    advantages = [
        ("Faster Detection", "Automated NRT Triage (<15 min pipeline)"),
        ("Fewer False Positives", "Planck pyrometry & 10m LULC filter false glints"),
        ("Shorter Response Chain", "Instant digital routing (<30s automated dossier)"),
        ("Reduced Blind Windows", "Multi-sensor fusion + predicted satellite passes"),
        ("Rapid Hazard Estimation", "Dynamic atmospheric Gaussian plume dispersion")
    ]

    # --- Layout Setup ---
    # Invert order so top item appears at top of the Y-axis
    categories_plot = categories[::-1]
    current_plot = current_values[::-1]
    system_plot = system_values[::-1]
    advantages_plot = advantages[::-1]

    y = np.arange(len(categories_plot))
    bar_height = 0.35  # Thickness of bars

    # Create figure with 2 subplots: Left for bars, Right for "Why We Are Better"
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(11.8, 5.2), dpi=300, 
                                   gridspec_kw={'width_ratios': [1.55, 1.05], 'wspace': 0.06})
    fig.patch.set_facecolor('white')
    ax1.set_facecolor('white')
    ax2.set_facecolor('white')

    # Exact color matching from referral code
    c_blue = "#2176D2"
    c_grey = "#85888A"

    # Draw horizontal bars on ax1 (Blue: Current Workflow, Grey: With PyroSat System)
    rects_blue = ax1.barh(y - bar_height/2, current_plot, height=bar_height, color=c_blue, label="Current Workflow")
    rects_grey = ax1.barh(y + bar_height/2, system_plot, height=bar_height, color=c_grey, label="With PyroSat System")

    # Data value labels next to bars
    for rect in rects_blue:
        w = rect.get_width()
        ax1.text(w + 0.8, rect.get_y() + rect.get_height()/2, f"{int(w)}%",
                 va='center', ha='left', fontsize=8.5, color="#222222", fontweight="bold")

    for rect in rects_grey:
        w = rect.get_width()
        ax1.text(w + 0.8, rect.get_y() + rect.get_height()/2, f"{int(w)}%",
                 va='center', ha='left', fontsize=8.5, color="#222222", fontweight="bold")

    # Axis and Grid Styling for ax1
    ax1.set_yticks(y)
    ax1.set_yticklabels(categories_plot, fontsize=9.5, fontweight="bold", color="#222222")
    ax1.set_xlabel("Relative Operational Delay & Bottleneck Burden (%)", fontsize=9, fontweight="bold", color="#222222", labelpad=8)
    ax1.set_xlim(0, 46)

    # Gridlines
    ax1.set_axisbelow(True)
    ax1.grid(axis='both', color='#EBEBEB', linestyle='-', linewidth=0.9)

    # Frame spines for ax1
    for spine in ['top', 'right']:
        ax1.spines[spine].set_visible(False)
    for spine in ['left', 'bottom']:
        ax1.spines[spine].set_color('#888888')
        ax1.spines[spine].set_linewidth(0.8)

    # Legend (top right)
    ax1.legend(frameon=True, edgecolor='#D0D0D0', facecolor='#FFFFFF', loc='upper right', fontsize=8.5)
    ax1.set_title("Incident Management: Current Workflow vs. PyroSat", fontsize=11, fontweight="bold", color="#0F2942", pad=14)

    # --- Right Subplot: "Why We Are Better" Cards ---
    ax2.set_xlim(0, 1)
    ax2.set_ylim(-0.6, len(categories_plot) - 0.4)
    ax2.axis('off')  # Hide axis lines and ticks
    ax2.set_title("Why We Are Better (PyroSat Advantage)", fontsize=11, fontweight="bold", color="#1D4ED8", pad=14)

    # Draw rounded cards for each row aligned with y
    for idx, (title, desc) in enumerate(advantages_plot):
        y_pos = idx
        # Draw pill card
        ax2.text(0.04, y_pos + 0.12, title, va='center', ha='left', fontsize=9, fontweight='bold', color='#1D4ED8',
                 bbox=dict(boxstyle="round,pad=0.5,rounding_size=0.25",
                           facecolor="#F0F7FF", edgecolor="#BFDBFE", linewidth=1.2))
        ax2.text(0.04, y_pos - 0.16, desc, va='center', ha='left', fontsize=7.8, color='#475569')

    plt.savefig(output_path, dpi=300, bbox_inches='tight', facecolor='white')
    plt.close()
    print(f"Graph generated successfully and saved to: {output_path}")

if __name__ == '__main__':
    generate_aspects_comparison_chart()
