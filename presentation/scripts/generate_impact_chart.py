import matplotlib.pyplot as plt
import numpy as np
import matplotlib.patches as patches

def create_before_after_chart(output_path="impact_before_after.png"):
    fig, ax = plt.subplots(figsize=(10.0, 4.2), dpi=300)
    ax.set_xlim(0, 100)
    ax.set_ylim(0, 42)
    ax.axis('off')

    # Color definitions
    c_before_bg = '#FEF2F2'      # Light Red
    c_before_border = '#F87171'
    c_before_bar = '#EF4444'     # Crimson Red
    c_after_bg = '#F0FDF4'       # Light Green
    c_after_border = '#4ADE80'
    c_after_bar = '#10B981'      # Emerald Green

    # Title header
    ax.text(50, 39.5, "OPERATIONAL IMPACT: BEFORE vs. AFTER IMPLEMENTATION", 
            fontsize=12, fontweight='bold', color='#1E293B', ha='center')
    ax.text(50, 37.0, "Benchmarking Traditional Remote Sensing Workflows against PyroSat Real-Time Intelligence", 
            fontsize=8.5, color='#64748B', ha='center')

    # Column 1: BEFORE Card (Left)
    r_before = patches.FancyBboxPatch((3, 2), 45, 33, boxstyle="round,pad=0.8,rounding_size=1.2",
                                     facecolor=c_before_bg, edgecolor=c_before_border, linewidth=1.8)
    ax.add_patch(r_before)

    # Column 2: AFTER Card (Right)
    r_after = patches.FancyBboxPatch((52, 2), 45, 33, boxstyle="round,pad=0.8,rounding_size=1.2",
                                    facecolor=c_after_bg, edgecolor=c_after_border, linewidth=1.8)
    ax.add_patch(r_after)

    # Headers for Cards
    ax.text(25.5, 32.5, "BEFORE (Status Quo / FIRMS Alone)", fontsize=10.5, fontweight='bold', color='#B91C1C', ha='center')
    ax.text(74.5, 32.5, "AFTER (With PyroSat Platform)", fontsize=10.5, fontweight='bold', color='#047857', ha='center')

    # Metrics comparison list
    # Format: (Title, Before_Text, Before_Val_Pct, After_Text, After_Val_Pct, Y_Pos)
    metrics = [
        ("False Alarm Rate (Industrial Belts)", "78% (Flares flagged as runaway fires)", 78, "8% (Physics & LULC filtered)", 8, 25.5),
        ("Incident Triage & Alert Latency", "45 - 90 mins (Manual ground calls)", 85, "< 30 seconds (Automated dispatch)", 10, 18.5),
        ("Chemical Plume & Toxic Awareness", "0% (Zero wind or gas modeling)", 0, "100% (3-Zone Gaussian isopleths)", 100, 11.5),
        ("Disaster Provenance & Verification", "Black-box (Heuristic scores)", 20, "Exact TreeSHAP (Auditable provenance)", 95, 4.5),
    ]

    for title, b_text, b_val, a_text, a_val, y in metrics:
        # Title in center or over bars
        ax.text(25.5, y + 4.2, title, fontsize=8.2, fontweight='bold', color='#334155', ha='center')
        ax.text(74.5, y + 4.2, title, fontsize=8.2, fontweight='bold', color='#334155', ha='center')

        # BEFORE: Background Bar & Filled Bar
        bg_b = patches.FancyBboxPatch((6, y + 1.2), 39, 2.2, boxstyle="round,pad=0.1,rounding_size=0.4",
                                      facecolor='#FEE2E2', edgecolor='none')
        ax.add_patch(bg_b)
        if b_val > 0:
            fill_b = patches.FancyBboxPatch((6, y + 1.2), 39 * (b_val / 100.0), 2.2, boxstyle="round,pad=0.1,rounding_size=0.4",
                                           facecolor=c_before_bar, edgecolor='none')
            ax.add_patch(fill_b)
        ax.text(6.5, y - 0.7, b_text, fontsize=7.2, fontweight='bold', color='#991B1B')

        # AFTER: Background Bar & Filled Bar
        bg_a = patches.FancyBboxPatch((55, y + 1.2), 39, 2.2, boxstyle="round,pad=0.1,rounding_size=0.4",
                                      facecolor='#DCFCE7', edgecolor='none')
        ax.add_patch(bg_a)
        if a_val > 0:
            fill_a = patches.FancyBboxPatch((55, y + 1.2), 39 * (a_val / 100.0), 2.2, boxstyle="round,pad=0.1,rounding_size=0.4",
                                           facecolor=c_after_bar, edgecolor='none')
            ax.add_patch(fill_a)
        ax.text(55.5, y - 0.7, a_text, fontsize=7.2, fontweight='bold', color='#065F46')

    # Center VS Badge
    c_vs = patches.Circle((50, 18.5), radius=3.2, facecolor='#1E293B', edgecolor='white', linewidth=2.5)
    ax.add_patch(c_vs)
    ax.text(50, 18.5, "VS", fontsize=9.5, fontweight='bold', color='white', ha='center', va='center')

    plt.subplots_adjust(left=0, right=1, top=1, bottom=0)
    plt.savefig(output_path, dpi=300, bbox_inches='tight', facecolor='white')
    plt.close()
    print(f"Chart saved to {output_path}")

if __name__ == '__main__':
    create_before_after_chart()
