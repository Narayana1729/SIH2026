import os
import math
from PIL import Image, ImageDraw, ImageFont

def generate_impact_benefits_slide(output_path="pyrosat_impact_and_benefits_slide.png"):
    # 16:9 Slide Dimensions (Ultra-HD: 2560 x 1440)
    W, H = 2560, 1440
    canvas = Image.new('RGB', (W, H), color='#FFFFFF')
    draw = ImageDraw.Draw(canvas)

    # Fonts
    font_bold_path = '/System/Library/Fonts/Supplemental/Arial Bold.ttf'
    font_reg_path = '/System/Library/Fonts/Supplemental/Arial.ttf'
    if not os.path.exists(font_bold_path):
        font_bold_path = '/System/Library/Fonts/Helvetica.ttc'
        font_reg_path = '/System/Library/Fonts/Helvetica.ttc'

    font_main_title = ImageFont.truetype(font_bold_path, 52)
    font_team = ImageFont.truetype(font_bold_path, 24)
    font_sih = ImageFont.truetype(font_bold_path, 26)

    font_node_num = ImageFont.truetype(font_bold_path, 26)
    font_center_title = ImageFont.truetype(font_bold_path, 18)
    font_item_title = ImageFont.truetype(font_bold_path, 22)
    font_item_desc = ImageFont.truetype(font_reg_path, 16)

    font_section_title = ImageFont.truetype(font_bold_path, 21)
    font_hook_title = ImageFont.truetype(font_bold_path, 23)
    font_hook_sub = ImageFont.truetype(font_reg_path, 15)
    font_footer = ImageFont.truetype(font_reg_path, 16)

    # -------------------------------------------------------------
    # 1. TOP HEADER & LOGOS
    # -------------------------------------------------------------
    # Team Oval Badge on top-left
    draw.rounded_rectangle([(70, 38), (330, 114)], radius=35, outline='#0284C7', width=3, fill='#F0F9FF')
    draw.text((105, 50), "SIH 2026", font=font_team, fill='#0369A1')
    draw.text((100, 78), "Team PyroSat", font=ImageFont.truetype(font_reg_path, 17), fill='#0284C7')

    # Main Title
    draw.text((710, 50), "IMPACT AND BENEFITS", font=font_main_title, fill='#1E3A8A')

    # SIH Brand Block on top-right
    draw.rounded_rectangle([(W - 380, 38), (W - 70, 118)], radius=12, outline='#E2E8F0', width=1, fill='#F8FAFC')
    draw.text((W - 360, 46), "SMART INDIA", font=font_sih, fill='#EA580C')
    draw.text((W - 360, 76), "HACKATHON 2026", font=font_sih, fill='#15803D')

    # Header Divider
    draw.line([(70, 132), (W - 70, 132)], fill='#CBD5E1', width=2)

    # -------------------------------------------------------------
    # 2. LEFT SIDE: CIRCULAR DIAL FOR IMPACTS & BENEFITS
    # -------------------------------------------------------------
    CX, CY = 745, 760
    R_ORBIT = 265
    R_CENTER = 100

    # Dashed Orbit Ring
    num_dashes = 64
    for i in range(num_dashes):
        if i % 2 == 0:
            a1 = (i / num_dashes) * 2 * math.pi
            a2 = ((i + 0.8) / num_dashes) * 2 * math.pi
            p1 = (CX + R_ORBIT * math.cos(a1), CY + R_ORBIT * math.sin(a1))
            p2 = (CX + R_ORBIT * math.cos(a2), CY + R_ORBIT * math.sin(a2))
            draw.line([p1, p2], fill='#94A3B8', width=3)

    # Central Circle Split
    draw.pieslice([(CX - R_CENTER, CY - R_CENTER), (CX + R_CENTER, CY + R_CENTER)], 90, 270, fill='#1E293B')
    draw.pieslice([(CX - R_CENTER, CY - R_CENTER), (CX + R_CENTER, CY + R_CENTER)], 270, 90, fill='#0284C7')
    draw.line([(CX, CY - R_CENTER), (CX, CY + R_CENTER)], fill='#FFFFFF', width=4)

    # Center Text
    draw.text((CX - 90, CY - 11), "IMPACTS", font=font_center_title, fill='#FFFFFF')
    draw.text((CX + 10, CY - 11), "BENEFITS", font=font_center_title, fill='#FFFFFF')

    # Spaced Y positions for the 4 rows (230px spacing)
    y_positions = [280, 520, 760, 1000]

    # 4 Impacts (Left)
    impacts_data = [
        {
            "num": "1",
            "title": "Automated NRT Detection",
            "desc": "Ingests automated LANCE VIIRS & MODIS\npasses to deliver near-real-time\nanomaly triage (<15 min pipeline).",
            "text_x": 70
        },
        {
            "num": "2",
            "title": "Multi-Evidence Verification",
            "desc": "Filters non-combustion thermal sources\nusing sub-pixel Dozier pyrometry,\n10m LULC & empirical registries.",
            "text_x": 70
        },
        {
            "num": "3",
            "title": "Downwind Toxic Plume",
            "desc": "Estimates downwind toxic dispersion\nusing Briggs plume rise physics &\nlive atmospheric wind vectors.",
            "text_x": 70
        },
        {
            "num": "4",
            "title": "Automated Tactical Dispatch",
            "desc": "Generates actionable incident dossiers\nin <30s pipeline benchmark for direct\nmulti-agency responder routing.",
            "text_x": 70
        }
    ]

    # Calculate Node X positions on orbit for each Y position
    # (x - CX)^2 + (y - CY)^2 = R_ORBIT^2 => x = CX - sqrt(R^2 - dy^2)
    for idx, d in enumerate(impacts_data):
        ty = y_positions[idx]
        ny = ty + 35  # Center node with text block
        dy = ny - CY
        # Ensure within radius
        dx = math.sqrt(max(0, R_ORBIT**2 - dy**2)) if abs(dy) < R_ORBIT else 50
        nx = CX - dx

        # Node Circle
        draw.ellipse([(nx - 30, ny - 30), (nx + 30, ny + 30)], fill='#CBD5E1', outline='#475569', width=3)
        draw.text((nx - 8, ny - 15), d["num"], font=font_node_num, fill='#0F172A')

        # Text Content (Left side)
        draw.text((d["text_x"], ty), d["title"], font=font_item_title, fill='#1E3A8A')
        draw.text((d["text_x"], ty + 30), d["desc"], font=font_item_desc, fill='#334155')

    # 4 Benefits (Right)
    benefits_data = [
        {
            "num": "1",
            "title": "Safety & Life Protection",
            "desc": "Protects frontline responders & nearby\ncommunities with ERPG/IDLH standoff\nperimeters and instant evacuation zones.",
            "text_x": 1070
        },
        {
            "num": "2",
            "title": "Economic & Asset Defense",
            "desc": "Mitigates crores in plant, refinery, &\npipeline damage by containing minor\nflare triggers before multi-day crises.",
            "text_x": 1070
        },
        {
            "num": "3",
            "title": "Environmental Protection",
            "desc": "Curbs severe greenhouse emissions from\nstubborn coal-seam fires, flare leaks,\nand uncontrolled crop stubble burns.",
            "text_x": 1070
        },
        {
            "num": "4",
            "title": "Sovereign Dual-Use Tech",
            "desc": "Empowers Indian agencies (NTRO, NDRF,\nFSI) with a zero-licensing 3D digital\ntwin and tactical AGNI Voice AI.",
            "text_x": 1070
        }
    ]

    for idx, d in enumerate(benefits_data):
        ty = y_positions[idx]
        ny = ty + 35
        dy = ny - CY
        dx = math.sqrt(max(0, R_ORBIT**2 - dy**2)) if abs(dy) < R_ORBIT else 50
        nx = CX + dx

        # Node Circle
        draw.ellipse([(nx - 30, ny - 30), (nx + 30, ny + 30)], fill='#0284C7', outline='#0369A1', width=3)
        draw.text((nx - 8, ny - 15), d["num"], font=font_node_num, fill='#FFFFFF')

        # Text Content (Right side)
        draw.text((d["text_x"], ty), d["title"], font=font_item_title, fill='#0284C7')
        draw.text((d["text_x"], ty + 30), d["desc"], font=font_item_desc, fill='#334155')

    # -------------------------------------------------------------
    # 3. VERTICAL DIVIDER BAR
    # -------------------------------------------------------------
    sep_x = 1530
    draw.rectangle([(sep_x, 155), (sep_x + 10, H - 65)], fill='#64748B')
    for y_dash in range(165, H - 75, 48):
        draw.rectangle([(sep_x + 2, y_dash), (sep_x + 8, y_dash + 24)], fill='#F8FAFC')

    # -------------------------------------------------------------
    # 4. RIGHT SIDE TOP: HORIZONTAL COMPARATIVE BAR CHART
    # -------------------------------------------------------------
    chart_x = 1575
    chart_y = 150
    chart_w = 915
    chart_h = 560

    # Chart Container
    draw.rounded_rectangle([(chart_x, chart_y), (chart_x + chart_w, chart_y + chart_h)], 
                           radius=16, fill='#F8FAFC', outline='#E2E8F0', width=2)

    # Chart Title & Legend
    draw.text((chart_x + 25, chart_y + 18), "Current Workflow vs. PyroSat Capability", 
              font=font_section_title, fill='#0F172A')

    draw.rectangle([(chart_x + 575, chart_y + 22), (chart_x + 595, chart_y + 36)], fill='#0284C7')
    draw.text((chart_x + 602, chart_y + 20), "Current Workflow", font=ImageFont.truetype(font_reg_path, 15), fill='#334155')
    draw.rectangle([(chart_x + 735, chart_y + 22), (chart_x + 755, chart_y + 36)], fill='#10B981')
    draw.text((chart_x + 762, chart_y + 20), "With PyroSat", font=ImageFont.truetype(font_reg_path, 15), fill='#334155')

    # Comparative Metrics (Horizontal Bars)
    metrics = [
        ("Detection Latency", 85, 20, "Pass & Processing Dependent", "Automated NRT (<15m)"),
        ("False Alarms", 80, 25, "Raw Thermal Anomaly", "Physics + Context Verified"),
        ("Response Chain", 75, 15, "Manual Inter-Agency Calls", "<30s Pipeline Dossier"),
        ("Observation Gaps", 85, 30, "Overpass Dependent Gaps", "Multi-Source + Temporal Memory"),
        ("Hazard Estimation", 90, 20, "Manual / Static Guesswork", "Automated Gaussian Plume")
    ]

    bar_start_y = chart_y + 65
    bar_row_h = 95
    bar_max_w = 440
    bar_base_x = chart_x + 230

    for i, (label, val_base, val_pyro, text_base, text_pyro) in enumerate(metrics):
        ry = bar_start_y + i * bar_row_h
        
        # Metric Label
        draw.text((chart_x + 25, ry + 12), label, font=ImageFont.truetype(font_bold_path, 16), fill='#1E293B')

        # Baseline Bar (Blue)
        bw1 = int((val_base / 100.0) * bar_max_w)
        draw.rounded_rectangle([(bar_base_x, ry + 2), (bar_base_x + bw1, ry + 24)], radius=4, fill='#0284C7')
        draw.text((bar_base_x + bw1 + 12, ry + 3), text_base, font=ImageFont.truetype(font_bold_path, 15), fill='#0284C7')

        # PyroSat Bar (Green)
        bw2 = int((val_pyro / 100.0) * bar_max_w)
        draw.rounded_rectangle([(bar_base_x, ry + 28), (bar_base_x + bw2, ry + 50)], radius=4, fill='#10B981')
        draw.text((bar_base_x + bw2 + 12, ry + 29), text_pyro, font=ImageFont.truetype(font_bold_path, 15), fill='#047857')

        # Subtle separator
        if i < len(metrics) - 1:
            draw.line([(chart_x + 20, ry + 64), (chart_x + chart_w - 20, ry + 64)], fill='#E2E8F0', width=1)

    # -------------------------------------------------------------
    # 5. RIGHT SIDE BOTTOM: TRANSITION HOOK
    # -------------------------------------------------------------
    hook_x = 1575
    hook_y = 735
    hook_w = 915
    hook_h = 630

    draw.rounded_rectangle([(hook_x, hook_y), (hook_x + hook_w, hook_y + hook_h)], 
                           radius=16, fill='#F8FAFC', outline='#E2E8F0', width=2)

    # Hook Title
    draw.text((hook_x + 30, hook_y + 22), "From Raw Thermal Dots  —>  Tactical 3D Action", 
              font=font_hook_title, fill='#1E3A8A')
    draw.text((hook_x + 30, hook_y + 56), "Bridging spaceborne sensor blind spots with automated real-time intelligence", 
              font=font_hook_sub, fill='#64748B')

    # Actual project screenshots
    img_left_path = 'crop_thermal_ir.png'
    img_right_path = 'gaussian_plume_hazard_rings.jpg'

    img_box_y = hook_y + 98
    img_box_h = 475
    img_box_w = 370

    # Left Image Box
    draw.rounded_rectangle([(hook_x + 30, img_box_y), (hook_x + 30 + img_box_w, img_box_y + img_box_h)],
                           radius=12, fill='#0F172A', outline='#CBD5E1', width=2)
    if os.path.exists(img_left_path):
        try:
            im1 = Image.open(img_left_path).convert('RGB')
            im1 = im1.resize((img_box_w - 12, img_box_h - 75), Image.Resampling.LANCZOS)
            canvas.paste(im1, (hook_x + 36, img_box_y + 6))
        except Exception:
            pass
    draw.text((hook_x + 50, img_box_y + img_box_h - 52), "RAW LEO THERMAL HOTSPOTS", 
              font=ImageFont.truetype(font_bold_path, 16), fill='#FFFFFF')
    draw.text((hook_x + 50, img_box_y + img_box_h - 28), "Delayed, ambiguous & unverified points", 
              font=ImageFont.truetype(font_reg_path, 13), fill='#94A3B8')

    # Big Center Arrow
    arrow_cx = hook_x + 440
    arrow_cy = img_box_y + 215
    draw.polygon([(arrow_cx - 20, arrow_cy - 25), 
                  (arrow_cx + 15, arrow_cy - 25), 
                  (arrow_cx + 15, arrow_cy - 40), 
                  (arrow_cx + 45, arrow_cy), 
                  (arrow_cx + 15, arrow_cy + 40), 
                  (arrow_cx + 15, arrow_cy + 25), 
                  (arrow_cx - 20, arrow_cy + 25)], fill='#EA580C')

    # Right Image Box
    right_box_x = hook_x + 510
    draw.rounded_rectangle([(right_box_x, img_box_y), (right_box_x + img_box_w, img_box_y + img_box_h)],
                           radius=12, fill='#0F172A', outline='#10B981', width=2)
    if os.path.exists(img_right_path):
        try:
            im2 = Image.open(img_right_path).convert('RGB')
            im2 = im2.resize((img_box_w - 12, img_box_h - 75), Image.Resampling.LANCZOS)
            canvas.paste(im2, (right_box_x + 6, img_box_y + 6))
        except Exception:
            pass
    draw.text((right_box_x + 20, img_box_y + img_box_h - 52), "3D PLUME & DISPATCH ACTION", 
              font=ImageFont.truetype(font_bold_path, 16), fill='#34D399')
    draw.text((right_box_x + 20, img_box_y + img_box_h - 28), "Real-time toxic cone & responder routing", 
              font=ImageFont.truetype(font_reg_path, 13), fill='#94A3B8')

    # -------------------------------------------------------------
    # 6. FOOTER BAR
    # -------------------------------------------------------------
    draw.rectangle([(0, H - 45), (W, H)], fill='#0284C7')
    draw.text((70, H - 34), "@SIH Idea Submission — PyroSat Satellite Thermal Intelligence System", 
              font=font_footer, fill='#FFFFFF')
    draw.text((W - 120, H - 34), "Slide 5", font=ImageFont.truetype(font_bold_path, 18), fill='#FFFFFF')

    canvas.save(output_path, quality=95)
    print(f"Slide image successfully generated and saved to: {output_path}")

if __name__ == '__main__':
    generate_impact_benefits_slide()
