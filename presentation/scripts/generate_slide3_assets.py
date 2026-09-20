import matplotlib.pyplot as plt
import matplotlib.patches as patches

def create_flowchart(output_path="slide3_flowchart.png"):
    fig, ax = plt.subplots(figsize=(11.0, 3.5), dpi=300)
    ax.set_xlim(0, 112)
    ax.set_ylim(0, 35)
    ax.axis('off')

    # Color Palette matching reference
    c_firms_bg = '#FFEBE6'      # Coral/Reddish like GNSS in reference
    c_firms_border = '#EA580C'
    c_pnt_bg = '#DCFCE7'        # Mint green
    c_pnt_border = '#16A34A'
    c_purple_bg = '#F5F3FF'     # Purple container
    c_purple_border = '#9333EA'
    c_step_bg = '#FDF2F8'       # Pinkish steps
    c_step_border = '#DB2777'
    c_sim_bg = '#F0F9FF'        # Light blue container on right
    c_sim_border = '#0284C7'
    c_sim_step_bg = '#E0F2FE'
    c_sim_step_border = '#38BDF8'

    # Title label above right container
    ax.text(92.5, 33.6, "Atmospheric Dispersion & Tactical Simulation", fontsize=8.5, fontweight='bold', color='#0369A1', ha='center')

    # 1. Left Orange Box: FIRMS & SATELLITE TELEMETRY
    r1 = patches.FancyBboxPatch((2, 17.5), 16.0, 12.0, boxstyle="round,pad=0.5,rounding_size=1.0",
                                facecolor=c_firms_bg, edgecolor=c_firms_border, linewidth=1.5)
    ax.add_patch(r1)
    ax.text(10.0, 25.8, "NASA FIRMS\nTelemetry", fontsize=10, fontweight='bold', color='#9A3412', ha='center', va='center')
    ax.text(10.0, 20.8, "VIIRS 375m & MODIS 1km\nNRT Radiance Feeds", fontsize=6.8, color='#7C2D12', ha='center', va='center')

    # 2. Top Green Box: Ground Surface Context (LULC)
    r2 = patches.FancyBboxPatch((23.0, 24.0), 16.0, 5.8, boxstyle="round,pad=0.4,rounding_size=0.8",
                                facecolor=c_pnt_bg, edgecolor=c_pnt_border, linewidth=1.4)
    ax.add_patch(r2)
    ax.text(31.0, 27.5, "ESA WorldCover & Sentinel-2", fontsize=7.2, fontweight='bold', color='#15803D', ha='center', va='center')
    ax.text(31.0, 25.5, "10m LULC & Spectral Grounding", fontsize=6.2, color='#14532D', ha='center', va='center')

    # 3. Middle Green Box: Dozier Pyrometry
    r3 = patches.FancyBboxPatch((23.0, 14.0), 16.0, 7.2, boxstyle="round,pad=0.4,rounding_size=0.8",
                                facecolor='#ECFDF5', edgecolor='#059669', linewidth=1.4)
    ax.add_patch(r3)
    ax.text(31.0, 18.8, "Dozier Pyrometry", fontsize=8.2, fontweight='bold', color='#065F46', ha='center', va='center')
    ax.text(31.0, 16.0, "Planck Radiation Solver\n(Tf > 1200K, Af in m²)", fontsize=6.4, color='#047857', ha='center', va='center')

    # 4. Bottom Gray Box: Industrial DB
    r4 = patches.FancyBboxPatch((23.0, 3.2), 16.0, 8.2, boxstyle="round,pad=0.4,rounding_size=0.8",
                                facecolor='#F1F5F9', edgecolor='#64748B', linewidth=1.4)
    ax.add_patch(r4)
    ax.text(31.0, 9.0, "GEM Industrial Registry", fontsize=7.2, fontweight='bold', color='#334155', ha='center', va='center')
    ax.text(31.0, 5.8, "Refineries, Steel Mills,\nLNG Terminals & Mines", fontsize=6.2, color='#475569', ha='center', va='center')

    # 5. Purple Container: Hierarchical ML & XAI Core
    c_purp = patches.FancyBboxPatch((43.5, 2.0), 22.5, 28.5, boxstyle="round,pad=0.6,rounding_size=1.2",
                                   facecolor=c_purple_bg, edgecolor=c_purple_border, linewidth=1.5)
    ax.add_patch(c_purp)
    ax.text(54.7, 28.8, "Hierarchical ML & Explainability", fontsize=8.2, fontweight='bold', color='#6B21A8', ha='center')

    # Steps inside Purple Container
    steps = [
        ("Feature Extraction & Fusion", "FRP, Brightness Temp, NDVI, Land Cover", 22.8),
        ("Stage-1: Binary Segregation", "Industrial vs. Non-Industrial Anomaly", 17.3),
        ("Stage-2: Subclass Classifier", "Refinery Flare vs Disaster vs Wildfire", 11.8),
        ("Lundberg TreeSHAP DP", "Exact Polynomial Local Attributions", 6.3),
    ]

    for title, desc, y in steps:
        sp = patches.FancyBboxPatch((44.8, y), 20, 4.3, boxstyle="round,pad=0.3,rounding_size=0.6",
                                    facecolor=c_step_bg, edgecolor=c_step_border, linewidth=1.1)
        ax.add_patch(sp)
        ax.text(54.8, y + 2.7, title, fontsize=7.2, fontweight='bold', color='#9D174D', ha='center')
        ax.text(54.8, y + 1.1, desc, fontsize=5.8, color='#831843', ha='center')

    # Down arrows inside purple container
    for ya in [22.6, 17.1, 11.6]:
        ax.annotate('', xy=(54.8, ya - 0.7), xytext=(54.8, ya),
                    arrowprops=dict(arrowstyle='->', color='#BE185D', lw=1.2))

    # 6. Blue Container on Right: Plume & Dispatch (Starts at x=73.5)
    c_sim = patches.FancyBboxPatch((73.5, 2.0), 36.5, 30.0, boxstyle="round,pad=0.6,rounding_size=1.2",
                                  facecolor=c_sim_bg, edgecolor=c_sim_border, linewidth=1.5)
    ax.add_patch(c_sim)

    # Blocks inside blue container
    b1 = patches.FancyBboxPatch((75.5, 22.8), 15.0, 5.8, boxstyle="round,pad=0.4,rounding_size=0.6",
                                facecolor=c_sim_step_bg, edgecolor=c_sim_step_border, linewidth=1.1)
    ax.add_patch(b1)
    ax.text(83.0, 26.6, "Open-Meteo API", fontsize=7.5, fontweight='bold', color='#0369A1', ha='center')
    ax.text(83.0, 24.6, "Live Wind & Boundary Layer", fontsize=6.0, color='#075985', ha='center')

    b2 = patches.FancyBboxPatch((93.0, 22.8), 15.0, 5.8, boxstyle="round,pad=0.4,rounding_size=0.6",
                                facecolor=c_sim_step_bg, edgecolor=c_sim_step_border, linewidth=1.1)
    ax.add_patch(b2)
    ax.text(100.5, 26.6, "Briggs Buoyancy", fontsize=7.5, fontweight='bold', color='#0369A1', ha='center')
    ax.text(100.5, 24.6, "Plume Rise Formulation", fontsize=6.0, color='#075985', ha='center')

    b3 = patches.FancyBboxPatch((75.5, 13.8), 15.0, 5.8, boxstyle="round,pad=0.4,rounding_size=0.6",
                                facecolor=c_sim_step_bg, edgecolor=c_sim_step_border, linewidth=1.1)
    ax.add_patch(b3)
    ax.text(83.0, 17.6, "Pasquill-Gifford", fontsize=7.5, fontweight='bold', color='#0369A1', ha='center')
    ax.text(83.0, 15.6, "Gaussian Dispersion Model", fontsize=6.0, color='#075985', ha='center')

    b4 = patches.FancyBboxPatch((93.0, 13.8), 15.0, 5.8, boxstyle="round,pad=0.4,rounding_size=0.6",
                                facecolor=c_sim_step_bg, edgecolor=c_sim_step_border, linewidth=1.1)
    ax.add_patch(b4)
    ax.text(100.5, 17.6, "CAMEO / NIOSH", fontsize=7.5, fontweight='bold', color='#0369A1', ha='center')
    ax.text(100.5, 15.6, "Chemical Hazard Library", fontsize=6.0, color='#075985', ha='center')

    b_out = patches.FancyBboxPatch((76.5, 4.2), 30.5, 6.2, boxstyle="round,pad=0.5,rounding_size=0.8",
                                   facecolor='#FEF08A', edgecolor='#CA8A04', linewidth=1.4)
    ax.add_patch(b_out)
    ax.text(91.7, 8.4, "CesiumJS 3D HUD & Tactical Dispatch", fontsize=8.2, fontweight='bold', color='#854D0E', ha='center')
    ax.text(91.7, 6.0, "Automated Incident Action Plans (IAPs) & Evacuation Corridors", fontsize=6.2, color='#713F12', ha='center')

    # Arrows inside Blue container
    ax.annotate('', xy=(93.0, 25.7), xytext=(90.5, 25.7), arrowprops=dict(arrowstyle='->', color='#0284C7', lw=1.2))
    ax.annotate('', xy=(83.0, 19.6), xytext=(83.0, 22.8), arrowprops=dict(arrowstyle='->', color='#0284C7', lw=1.2))
    ax.annotate('', xy=(100.5, 19.6), xytext=(100.5, 22.8), arrowprops=dict(arrowstyle='->', color='#0284C7', lw=1.2))
    ax.annotate('', xy=(91.7, 10.4), xytext=(83.0, 13.8), arrowprops=dict(arrowstyle='->', color='#0284C7', lw=1.2))
    ax.annotate('', xy=(91.7, 10.4), xytext=(100.5, 13.8), arrowprops=dict(arrowstyle='->', color='#0284C7', lw=1.2))

    # Connecting Arrows across main modules
    # 1. FIRMS -> LULC
    ax.annotate('', xy=(23.0, 26.5), xytext=(18.0, 25.5), arrowprops=dict(arrowstyle='->', color='#EA580C', lw=1.3))
    # 2. FIRMS -> Dozier
    ax.annotate('', xy=(23.0, 17.6), xytext=(18.0, 22.0), arrowprops=dict(arrowstyle='->', color='#EA580C', lw=1.3))
    ax.text(19.8, 20.8, "Radiance", fontsize=5.8, color='#C2410C', fontweight='bold', rotation=-30)
    # 3. FIRMS -> Industrial DB
    ax.annotate('', xy=(23.0, 8.5), xytext=(18.0, 19.5), arrowprops=dict(arrowstyle='->', color='#EA580C', lw=1.3))

    # Dozier / LULC / DB -> ML Core
    ax.annotate('', xy=(43.5, 24.5), xytext=(39.0, 26.5), arrowprops=dict(arrowstyle='->', color='#16A34A', lw=1.3))
    ax.annotate('', xy=(43.5, 17.6), xytext=(39.0, 17.6), arrowprops=dict(arrowstyle='->', color='#059669', lw=1.3))
    ax.text(40.5, 18.5, "Tf, Af", fontsize=6.2, color='#047857', fontweight='bold')
    ax.annotate('', xy=(43.5, 11.5), xytext=(39.0, 7.5), arrowprops=dict(arrowstyle='->', color='#64748B', lw=1.3))

    # ML Core -> Plume / Dispatch
    ax.annotate('', xy=(73.5, 16.5), xytext=(66.0, 16.5), arrowprops=dict(arrowstyle='->', color='#9333EA', lw=1.4))
    ax.text(69.75, 18.0, "Disaster Alert", fontsize=6.2, color='#7E22CE', fontweight='bold', ha='center')

    plt.subplots_adjust(left=0, right=1, top=1, bottom=0)
    plt.savefig(output_path, dpi=300, bbox_inches='tight', facecolor='white')
    plt.close()
    print(f"Flowchart saved to {output_path}")

def create_three_layer_graphic(output_path="slide3_three_layers.png"):
    fig, ax = plt.subplots(figsize=(5.4, 2.3), dpi=300)
    ax.set_xlim(0, 54)
    ax.set_ylim(0, 23)
    ax.axis('off')

    # 3 Staggered Isometric Cards matching the reference!
    # Layer 1 (Top Left / Back, Olive Green)
    r_l1 = patches.FancyBboxPatch((2.0, 10.0), 16.5, 11.0, boxstyle="square,pad=0.0",
                                 facecolor='#435E4E', edgecolor='#2B3F34', linewidth=1.2)
    ax.add_patch(r_l1)

    # Layer 2 (Middle, Rust/Red-Brown)
    r_l2 = patches.FancyBboxPatch((4.5, 6.0), 16.5, 11.0, boxstyle="square,pad=0.0",
                                 facecolor='#8A3B31', edgecolor='#57221A', linewidth=1.2)
    ax.add_patch(r_l2)

    # Layer 3 (Bottom Front, Deep Navy Blue)
    r_l3 = patches.FancyBboxPatch((7.0, 2.0), 16.5, 11.0, boxstyle="square,pad=0.0",
                                 facecolor='#1E3A5F', edgecolor='#0E1E33', linewidth=1.2)
    ax.add_patch(r_l3)

    # Reference Style White Callout Boxes & Arrows
    # 1. Top Callout: INS equivalent -> L1 Multi-Sensor Ingestion
    ax.plot([14.5, 14.5, 25.0], [21.0, 21.5, 21.5], color='#2B3F34', lw=1.8)
    ax.annotate('', xy=(25.0, 21.5), xytext=(24.0, 21.5),
                arrowprops=dict(arrowstyle='->', color='#2B3F34', lw=1.8))
    b_l1 = patches.FancyBboxPatch((25.5, 19.0), 26.5, 4.4, boxstyle="square,pad=0.2",
                                 facecolor='white', edgecolor='#333333', linewidth=1.0)
    ax.add_patch(b_l1)
    ax.text(38.7, 21.6, "L1: Multi-Sensor Ingestion", fontsize=7.6, fontweight='bold', color='#111827', ha='center')
    ax.text(38.7, 19.8, "FIRMS NRT, Sentinel-2 & WorldCover", fontsize=6.0, color='#4B5563', ha='center')

    # 2. Middle Callout: LEO-PNT equivalent -> L2 Pyrometry & ML Core
    ax.plot([21.0, 25.0], [13.2, 13.2], color='#57221A', lw=1.8)
    ax.annotate('', xy=(25.0, 13.2), xytext=(24.0, 13.2),
                arrowprops=dict(arrowstyle='->', color='#57221A', lw=1.8))
    b_l2 = patches.FancyBboxPatch((25.5, 11.0), 26.5, 4.4, boxstyle="square,pad=0.2",
                                 facecolor='white', edgecolor='#333333', linewidth=1.0)
    ax.add_patch(b_l2)
    ax.text(38.7, 13.6, "L2: Pyrometry & ML Core", fontsize=7.6, fontweight='bold', color='#111827', ha='center')
    ax.text(38.7, 11.8, "Planck Inversion + LightGBM + TreeSHAP", fontsize=6.0, color='#4B5563', ha='center')

    # 3. Bottom Callout: GNSS equivalent -> L3 3D HUD & Dispatch
    ax.plot([23.5, 23.5, 25.0], [6.0, 5.0, 5.0], color='#0E1E33', lw=1.8)
    ax.annotate('', xy=(25.0, 5.0), xytext=(24.0, 5.0),
                arrowprops=dict(arrowstyle='->', color='#0E1E33', lw=1.8))
    b_l3 = patches.FancyBboxPatch((25.5, 2.8), 26.5, 4.4, boxstyle="square,pad=0.2",
                                 facecolor='white', edgecolor='#333333', linewidth=1.0)
    ax.add_patch(b_l3)
    ax.text(38.7, 5.4, "L3: 3D HUD & Tactical Dispatch", fontsize=7.6, fontweight='bold', color='#111827', ha='center')
    ax.text(38.7, 3.6, "CesiumJS Digital Twin & Plume IAP", fontsize=6.0, color='#4B5563', ha='center')

    plt.subplots_adjust(left=0, right=1, top=1, bottom=0)
    plt.savefig(output_path, dpi=300, bbox_inches='tight', facecolor='white')
    plt.close()
    print(f"Three layers diagram saved to {output_path}")

if __name__ == "__main__":
    create_flowchart()
    create_three_layer_graphic()
