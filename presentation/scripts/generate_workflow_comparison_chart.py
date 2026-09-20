import os
from PIL import Image, ImageDraw, ImageFont

def generate_defensible_workflow_chart(output_path="workflow_comparison_defensible.png"):
    # High-resolution canvas: 2200 x 1350
    W, H = 2200, 1350
    canvas = Image.new('RGB', (W, H), color='#FFFFFF')
    draw = ImageDraw.Draw(canvas)

    # Font Setup
    font_bold_path = '/System/Library/Fonts/Supplemental/Arial Bold.ttf'
    font_reg_path = '/System/Library/Fonts/Supplemental/Arial.ttf'
    if not os.path.exists(font_bold_path):
        font_bold_path = '/System/Library/Fonts/Helvetica.ttc'
        font_reg_path = '/System/Library/Fonts/Helvetica.ttc'

    font_title = ImageFont.truetype(font_bold_path, 46)
    font_header = ImageFont.truetype(font_bold_path, 26)
    font_legend = ImageFont.truetype(font_reg_path, 24)
    font_metric_name = ImageFont.truetype(font_bold_path, 28)
    font_bar_text = ImageFont.truetype(font_bold_path, 22)
    font_pill_title = ImageFont.truetype(font_bold_path, 26)
    font_pill_sub = ImageFont.truetype(font_reg_path, 20)

    # 1. Main Title
    draw.text((W // 2 - 620, 50), "Incident Management in India — Current Workflow vs. PyroSat", 
              font=font_title, fill='#0F172A')

    # 2. Table Column Headers & Legend
    draw.text((100, 140), "Metric Measured", font=font_header, fill='#64748B')

    # Legend: Current Workflow (Red)
    draw.rounded_rectangle([(700, 138), (735, 173)], radius=6, fill='#F87171')
    draw.text((750, 140), "Current Workflow", font=font_legend, fill='#334155')

    # Legend: PyroSat System (Green)
    draw.rounded_rectangle([(1030, 138), (1065, 173)], radius=6, fill='#10B981')
    draw.text((1080, 140), "PyroSat System", font=font_legend, fill='#334155')

    # Rightmost Column Header: "Capability Added"
    draw.rounded_rectangle([(1720, 125), (2100, 185)], radius=12, fill='#ECFDF5', outline='#A7F3D0', width=2)
    draw.text((1770, 140), "Capability Added", font=ImageFont.truetype(font_bold_path, 25), fill='#065F46')

    # Header Divider Line
    draw.line([(100, 205), (2100, 205)], fill='#E2E8F0', width=2)

    # 3. Five Defensible Evidence-Backed Rows
    rows_data = [
        {
            "metric": "Detection-to-Alert\nLatency",
            "icon": "clock",
            "current_text": "Satellite-pass & processing dependent",
            "current_len": 720,
            "pyrosat_text": "Automated near-real-time processing (<15 min pipeline)",
            "pyrosat_len": 960,
            "pill_main": "Faster Detection",
            "pill_sub": "Automated NRT Triage"
        },
        {
            "metric": "Industrial\nFalse Alarms",
            "icon": "alert",
            "current_text": "Raw thermal anomalies (hotspot ≠ necessarily fire)",
            "current_len": 890,
            "pyrosat_text": "Physics + spectral + spatial + contextual verification",
            "pyrosat_len": 970,
            "pill_main": "Fewer False Positives",
            "pill_sub": "Multi-Evidence Grounding"
        },
        {
            "metric": "Multi-Agency\nResponse",
            "icon": "people",
            "current_text": "Manual coordination across administrative layers",
            "current_len": 830,
            "pyrosat_text": "Automated incident dossier & alerts (<30s pipeline benchmark)",
            "pyrosat_len": 1050,
            "pill_main": "Shorter Response Chain",
            "pill_sub": "Instant Digital Routing"
        },
        {
            "metric": "Satellite\nObservation Gaps",
            "icon": "sat",
            "current_text": "Dependent on fixed polar satellite overpasses",
            "current_len": 780,
            "pyrosat_text": "Multi-source + temporal memory + orbit prediction",
            "pyrosat_len": 920,
            "pill_main": "Reduced Blind Windows",
            "pill_sub": "Multi-Sensor Fusion"
        },
        {
            "metric": "Hazard Standoff\nEstimation",
            "icon": "shield",
            "current_text": "Manual / limited post-hoc assessment",
            "current_len": 670,
            "pyrosat_text": "Automated Gaussian plume & wind-driven dispersion",
            "pyrosat_len": 950,
            "pill_main": "Rapid Hazard Estimation",
            "pill_sub": "Dynamic Evacuation Rings"
        }
    ]

    row_start_y = 230
    row_h = 215

    for i, d in enumerate(rows_data):
        ry = row_start_y + i * row_h
        
        # Subtle horizontal divider
        if i > 0:
            draw.line([(100, ry - 15), (2100, ry - 15)], fill='#F1F5F9', width=2)

        # Icon Circle on Left
        icon_cx, icon_cy = 150, ry + 75
        draw.ellipse([(icon_cx - 45, icon_cy - 45), (icon_cx + 45, icon_cy + 45)], 
                     fill='#EFF6FF', outline='#BFDBFE', width=2)

        # Draw Clean Minimal Vector Icon based on type
        if d["icon"] == "clock":
            draw.ellipse([(icon_cx - 24, icon_cy - 24), (icon_cx + 24, icon_cy + 24)], outline='#1E40AF', width=3)
            draw.line([(icon_cx, icon_cy), (icon_cx, icon_cy - 16)], fill='#1E40AF', width=3)
            draw.line([(icon_cx, icon_cy), (icon_cx + 12, icon_cy)], fill='#1E40AF', width=3)
        elif d["icon"] == "alert":
            draw.polygon([(icon_cx, icon_cy - 24), (icon_cx - 24, icon_cy + 20), (icon_cx + 24, icon_cy + 20)], 
                         outline='#B91C1C', fill='#FEE2E2', width=3)
            draw.line([(icon_cx, icon_cy - 10), (icon_cx, icon_cy + 6)], fill='#B91C1C', width=3)
            draw.ellipse([(icon_cx - 2, icon_cy + 11), (icon_cx + 2, icon_cy + 15)], fill='#B91C1C')
        elif d["icon"] == "people":
            draw.ellipse([(icon_cx - 10, icon_cy - 22), (icon_cx + 10, icon_cy - 2)], fill='#1E40AF')
            draw.ellipse([(icon_cx - 22, icon_cy - 2), (icon_cx + 22, icon_cy + 24)], fill='#1E40AF')
        elif d["icon"] == "sat":
            draw.rectangle([(icon_cx - 8, icon_cy - 8), (icon_cx + 8, icon_cy + 8)], fill='#1E40AF')
            draw.line([(icon_cx - 22, icon_cy), (icon_cx + 22, icon_cy)], fill='#1E40AF', width=3)
            draw.line([(icon_cx, icon_cy - 22), (icon_cx, icon_cy + 22)], fill='#1E40AF', width=3)
        elif d["icon"] == "shield":
            draw.polygon([(icon_cx, icon_cy - 24), (icon_cx + 22, icon_cy - 12), 
                          (icon_cx + 22, icon_cy + 10), (icon_cx, icon_cy + 24), 
                          (icon_cx - 22, icon_cy + 10), (icon_cx - 22, icon_cy - 12)], 
                         fill='#DCFCE7', outline='#15803D', width=3)
            draw.line([(icon_cx - 8, icon_cy), (icon_cx - 2, icon_cy + 7), (icon_cx + 10, icon_cy - 8)], 
                      fill='#15803D', width=3)

        # Metric Name
        draw.text((220, ry + 40), d["metric"], font=font_metric_name, fill='#1E293B')

        # Bars Container Base X
        bar_base_x = 550

        # Bar 1: Current Workflow (Coral / Red)
        b1_y = ry + 25
        draw.rounded_rectangle([(bar_base_x, b1_y), (bar_base_x + d["current_len"], b1_y + 44)], 
                               radius=8, fill='#F87171')
        draw.text((bar_base_x + 20, b1_y + 9), d["current_text"], font=font_bar_text, fill='#FFFFFF')

        # Bar 2: PyroSat System (Emerald / Green)
        b2_y = ry + 82
        draw.rounded_rectangle([(bar_base_x, b2_y), (bar_base_x + d["pyrosat_len"], b2_y + 44)], 
                               radius=8, fill='#10B981')
        draw.text((bar_base_x + 20, b2_y + 9), d["pyrosat_text"], font=font_bar_text, fill='#FFFFFF')

        # Rightmost Column: "Capability Added" Pill Card
        pill_x = 1720
        pill_y = ry + 25
        pill_w = 380
        pill_h = 100
        draw.rounded_rectangle([(pill_x, pill_y), (pill_x + pill_w, pill_y + pill_h)], 
                               radius=16, fill='#F0FDF4', outline='#86EFAC', width=2)
        
        # Pill Text
        draw.text((pill_x + 35, pill_y + 18), d["pill_main"], font=font_pill_title, fill='#065F46')
        draw.text((pill_x + 35, pill_y + 54), d["pill_sub"], font=font_pill_sub, fill='#15803D')

    # Save final canvas
    canvas.save(output_path, quality=95)
    print(f"Defensible workflow comparison chart saved to: {output_path}")

if __name__ == '__main__':
    generate_defensible_workflow_chart()
