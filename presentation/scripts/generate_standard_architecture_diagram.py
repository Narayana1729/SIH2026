import matplotlib.pyplot as plt
import matplotlib.patches as patches
import os

def create_architecture_diagram():
    # Set up figure
    fig, ax = plt.subplots(figsize=(10, 14), dpi=300)
    fig.patch.set_facecolor('#FFFFFF')
    ax.set_facecolor('#FFFFFF')
    ax.set_xlim(0, 100)
    ax.set_ylim(0, 140)
    ax.axis('off')

    # Colors
    c_blue = '#1E40AF'       # Primary header
    c_box_bg = '#F8FAFC'     # Clean card bg
    c_border = '#334155'     # Dark border
    c_accent_blue = '#0284C7'
    c_accent_green = '#16A34A'
    c_accent_amber = '#D97706'
    c_accent_purple = '#9333EA'
    c_accent_red = '#DC2626'
    c_text_dark = '#0F172A'
    c_text_muted = '#475569'

    # Helper: Rounded Box
    def draw_box(x, y, w, h, bg=c_box_bg, border=c_border, lw=1.5, radius=1.5, linestyle='-'):
        box = patches.FancyBboxPatch(
            (x, y), w, h,
            boxstyle=f"round,pad=0.2,rounding_size={radius}",
            facecolor=bg, edgecolor=border, linewidth=lw, linestyle=linestyle, zorder=3
        )
        ax.add_patch(box)

    # -------------------------------------------------------------
    # 1. SECTION: DATA INGESTION
    # -------------------------------------------------------------
    ax.text(50, 134, "DATA INGESTION", ha='center', va='center',
            fontsize=15, fontweight='bold', color=c_blue)

    # 3 Ingestion Boxes
    ingest_boxes = [
        {"x": 8,  "w": 24, "title": "NASA FIRMS", "sub": "VIIRS 375m & MODIS\nThermal Radiance"},
        {"x": 38, "w": 24, "title": "Satellite Feeds", "sub": "Sentinel-2 (10m)\n+ Open-Meteo Winds"},
        {"x": 68, "w": 24, "title": "OSM + Industrial GIS", "sub": "2,000+ MAH Plants\n& Industrial Boundaries"}
    ]

    for b in ingest_boxes:
        draw_box(b["x"], 120, b["w"], 9, bg='#F1F5F9', border='#64748B', radius=1.5)
        ax.text(b["x"] + b["w"]/2, 126, b["title"], ha='center', va='center',
                fontsize=11, fontweight='bold', color=c_text_dark, zorder=4)
        ax.text(b["x"] + b["w"]/2, 122.5, b["sub"], ha='center', va='center',
                fontsize=8, color=c_text_muted, zorder=4)

    # Connect Ingestion to Data Processing
    for b in ingest_boxes:
        ax.plot([b["x"] + b["w"]/2, b["x"] + b["w"]/2], [120, 117], color=c_border, lw=1.5, zorder=2)
    ax.plot([20, 80], [117, 117], color=c_border, lw=1.5, zorder=2)
    ax.annotate('', xy=(50, 112), xytext=(50, 117),
                arrowprops=dict(arrowstyle="-|>", color=c_border, lw=1.5, mutation_scale=12), zorder=2)

    # -------------------------------------------------------------
    # 2. SECTION: DATA PROCESSING (Dashed Box)
    # -------------------------------------------------------------
    draw_box(10, 93, 80, 19, bg='#FFFFFF', border='#475569', lw=1.5, radius=2.5, linestyle='--')
    ax.text(50, 104.5, "DATA\nPROCESSING", ha='center', va='center',
            fontsize=12, fontweight='bold', color=c_text_dark, zorder=4)

    # 4 Items inside Data Processing
    ax.text(25, 108, "[*] Hotspot Extraction", ha='center', va='center', fontsize=9.5, fontweight='bold', color=c_accent_blue, zorder=4)
    ax.text(25, 105, "Dual-band pixel extraction", ha='center', va='center', fontsize=7.5, color=c_text_muted, zorder=4)

    ax.text(25, 98.5, "[*] Geospatial Filtering", ha='center', va='center', fontsize=9.5, fontweight='bold', color=c_accent_amber, zorder=4)
    ax.text(25, 95.5, "Geodesic industrial buffers", ha='center', va='center', fontsize=7.5, color=c_text_muted, zorder=4)

    ax.text(75, 108, "[*] Image Preprocessing", ha='center', va='center', fontsize=9.5, fontweight='bold', color=c_accent_green, zorder=4)
    ax.text(75, 105, "SCL cloud mask & 10m LULC", ha='center', va='center', fontsize=7.5, color=c_text_muted, zorder=4)

    ax.text(75, 98.5, "[*] Historical Baseline", ha='center', va='center', fontsize=9.5, fontweight='bold', color=c_accent_purple, zorder=4)
    ax.text(75, 95.5, "90-day flare persistence", ha='center', va='center', fontsize=7.5, color=c_text_muted, zorder=4)

    # Connect Data Processing to the 3 Feature Boxes
    ax.plot([50, 50], [93, 89], color=c_border, lw=1.5, zorder=2)
    ax.plot([20, 80], [89, 89], color=c_border, lw=1.5, zorder=2)
    for px in [20, 50, 80]:
        ax.annotate('', xy=(px, 85), xytext=(px, 89),
                    arrowprops=dict(arrowstyle="-|>", color=c_border, lw=1.5, mutation_scale=12), zorder=2)

    # -------------------------------------------------------------
    # 3. SECTION: THREE PARALLEL FEATURE EXTRACTION BOXES
    # -------------------------------------------------------------
    feature_boxes = [
        {
            "x": 8, "w": 24, "title": "Temporal Analysis",
            "items": ["- Persistence tracking", "- FRP trends over time", "- Burn duration index"]
        },
        {
            "x": 38, "w": 24, "title": "Physical & Spectral",
            "items": ["- Planck Pyrometry (Tf)", "- Sub-pixel area (Af)", "- MWIR / LWIR ratios"]
        },
        {
            "x": 68, "w": 24, "title": "Geospatial Context",
            "items": ["- OSM infrastructure", "- ESA 10m land cover", "- Distance to MAH units"]
        }
    ]

    for fb in feature_boxes:
        draw_box(fb["x"], 66, fb["w"], 19, bg='#F8FAFC', border='#475569', radius=2)
        ax.text(fb["x"] + fb["w"]/2, 82, fb["title"], ha='center', va='center',
                fontsize=10, fontweight='bold', color=c_text_dark, zorder=4)
        ax.plot([fb["x"] + 2, fb["x"] + fb["w"] - 2], [79, 79], color='#CBD5E1', lw=1, zorder=4)
        for i, it in enumerate(fb["items"]):
            ax.text(fb["x"] + 3, 75.5 - (i * 3.5), it, ha='left', va='center',
                    fontsize=8, color=c_text_muted, zorder=4)

    # Connect 3 Feature Boxes to AI Fusion Box
    for fb in feature_boxes:
        ax.plot([fb["x"] + fb["w"]/2, fb["x"] + fb["w"]/2], [66, 62], color=c_border, lw=1.5, zorder=2)
    ax.plot([20, 80], [62, 62], color=c_border, lw=1.5, zorder=2)
    ax.annotate('', xy=(50, 57), xytext=(50, 62),
                arrowprops=dict(arrowstyle="-|>", color=c_border, lw=1.5, mutation_scale=12), zorder=2)

    # -------------------------------------------------------------
    # 4. SECTION: AI FUSION & MULTI-SOURCE ML
    # -------------------------------------------------------------
    draw_box(30, 48, 40, 9, bg='#EFF6FF', border='#2563EB', lw=1.8, radius=2)
    ax.text(50, 53.8, "AI Fusion & Multi-Source ML", ha='center', va='center',
            fontsize=11.5, fontweight='bold', color='#1E40AF', zorder=4)
    ax.text(50, 50.2, "Hierarchical LightGBM + Physics Confidence Gating", ha='center', va='center',
            fontsize=8, color='#3B82F6', zorder=4)

    # 3 Decision Branches
    ax.plot([50, 50], [48, 44], color=c_border, lw=1.5, zorder=2)
    ax.plot([20, 80], [44, 44], color=c_border, lw=1.5, zorder=2)

    branches = [
        {"x": 20, "label": "Source Classification\n(Industrial vs Wildfire)"},
        {"x": 50, "label": "Persistent Source Filter\n(Routine Refinery Flare)"},
        {"x": 80, "label": "Anomaly & Blowout Detector\n(Runaway Fire Incident)"}
    ]

    for br in branches:
        ax.annotate('', xy=(br["x"], 39), xytext=(br["x"], 44),
                    arrowprops=dict(arrowstyle="-|>", color=c_border, lw=1.5, mutation_scale=10), zorder=2)
        ax.text(br["x"], 41.5, br["label"], ha='center', va='center',
                fontsize=7.5, fontweight='bold', color='#475569', zorder=4,
                bbox=dict(boxstyle='round,pad=0.2', facecolor='#FFFFFF', edgecolor='#CBD5E1', lw=0.8))

    # Connect 3 branches down to Risk Box
    for br in branches:
        ax.plot([br["x"], br["x"]], [37, 34], color=c_border, lw=1.5, zorder=2)
    ax.plot([20, 80], [34, 34], color=c_border, lw=1.5, zorder=2)
    ax.annotate('', xy=(50, 29.5), xytext=(50, 34),
                arrowprops=dict(arrowstyle="-|>", color=c_border, lw=1.5, mutation_scale=12), zorder=2)

    # -------------------------------------------------------------
    # 5. SECTION: RISK & EXPLAIN SCORE / ALERT
    # -------------------------------------------------------------
    draw_box(30, 21.5, 40, 8, bg='#FFFBEB', border='#D97706', lw=1.6, radius=2)
    ax.text(50, 26.5, "RISK + Explain Score / Alert", ha='center', va='center',
            fontsize=11, fontweight='bold', color='#B45309', zorder=4)
    ax.text(50, 23.5, "3D Gaussian Plume Dispersion + TreeSHAP Local Attributions", ha='center', va='center',
            fontsize=7.5, color='#92400E', zorder=4)

    # Connect Risk to GIS Dashboard
    ax.annotate('', xy=(50, 16.5), xytext=(50, 21.5),
                arrowprops=dict(arrowstyle="-|>", color=c_border, lw=1.5, mutation_scale=12), zorder=2)

    # -------------------------------------------------------------
    # 6. SECTION: GIS DASHBOARD & OPERATIONAL DISPATCH
    # -------------------------------------------------------------
    draw_box(20, 2.5, 60, 14, bg='#F8FAFC', border='#0F172A', lw=1.8, radius=2.5)
    ax.text(50, 13.5, "GIS Dashboard & Tactical Dispatch", ha='center', va='center',
            fontsize=11.5, fontweight='bold', color=c_text_dark, zorder=4)
    ax.text(50, 10.8, "Cesium 3D Digital Twin  |  Historical Heatmaps  |  1-Click NDRF Plan", ha='center', va='center',
            fontsize=8, color=c_text_muted, zorder=4)

    # 4 Status Pills with drawn circular dots
    pills = [
        {"x": 28, "color": '#DC2626', "label": "Critical Alert"},
        {"x": 42, "color": '#EA580C', "label": "High Risk"},
        {"x": 56, "color": '#CA8A04', "label": "Monitor"},
        {"x": 70, "color": '#16A34A', "label": "Normal"}
    ]
    for p in pills:
        # Draw dot
        circle = patches.Circle((p["x"] - 4.5, 6.2), 0.7, facecolor=p["color"], edgecolor='none', zorder=5)
        ax.add_patch(circle)
        ax.text(p["x"], 6.2, p["label"], ha='center', va='center',
                fontsize=8, fontweight='bold', color=c_text_dark, zorder=4,
                bbox=dict(boxstyle='round,pad=0.25', facecolor='#FFFFFF', edgecolor='#CBD5E1', lw=0.8))

    # Save output
    out_dir = os.path.join(os.path.dirname(__file__), '..', 'assets')
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, 'system_architecture_diagram.png')
    plt.tight_layout()
    plt.savefig(out_path, dpi=300, bbox_inches='tight', facecolor='#FFFFFF')
    plt.close()
    print(f"Architecture diagram successfully saved to: {out_path}")

if __name__ == '__main__':
    create_architecture_diagram()
