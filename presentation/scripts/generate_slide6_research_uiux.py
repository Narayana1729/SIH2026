import os
import math
from PIL import Image, ImageDraw, ImageFont

def generate_slide6_research_uiux(output_path="pyrosat_slide6_research_uiux.png"):
    # 16:9 Slide Dimensions (Ultra-HD: 2560 x 1440)
    W, H = 2560, 1440
    canvas = Image.new('RGB', (W, H), color='#FFFFFF')
    draw = ImageDraw.Draw(canvas)

    # Fonts
    f_bold = '/System/Library/Fonts/Supplemental/Arial Bold.ttf'
    f_reg = '/System/Library/Fonts/Supplemental/Arial.ttf'
    f_serif = '/System/Library/Fonts/Supplemental/Times New Roman Bold.ttf'
    if not os.path.exists(f_bold):
        f_bold = '/System/Library/Fonts/Helvetica.ttc'
        f_reg = '/System/Library/Fonts/Helvetica.ttc'
        f_serif = f_bold

    font_main_title = ImageFont.truetype(f_serif, 52)
    font_team = ImageFont.truetype(f_bold, 24)
    font_sih = ImageFont.truetype(f_bold, 26)
    font_node_sub = ImageFont.truetype(f_bold, 13)
    font_node_title = ImageFont.truetype(f_bold, 15)
    font_node_body = ImageFont.truetype(f_reg, 12)
    font_link = ImageFont.truetype(f_bold, 14)
    font_uiux = ImageFont.truetype(f_bold, 42)
    font_ui_title = ImageFont.truetype(f_bold, 18)
    font_ui_sub = ImageFont.truetype(f_reg, 13)
    font_footer = ImageFont.truetype(f_reg, 16)

    # -------------------------------------------------------------
    # 1. TOP HEADER & BRANDING (Matching reference)
    # -------------------------------------------------------------
    # Team Oval Badge on top-left
    draw.rounded_rectangle([(70, 38), (340, 114)], radius=38, outline='#0284C7', width=3, fill='#F0F9FF')
    draw.text((120, 50), "SIH 2026", font=font_team, fill='#0369A1')
    draw.text((110, 78), "Team Thinkers", font=ImageFont.truetype(f_reg, 17), fill='#0284C7')

    # Main Title
    draw.text((W // 2, 50), "RESEARCH AND REFERENCES", font=font_main_title, fill='#1E3A8A', anchor="mt")

    # SIH Brand Block on top-right
    draw.rounded_rectangle([(W - 380, 38), (W - 70, 118)], radius=12, outline='#E2E8F0', width=1, fill='#F8FAFC')
    draw.text((W - 360, 46), "SMART INDIA", font=font_sih, fill='#EA580C')
    draw.text((W - 360, 76), "HACKATHON 2026", font=font_sih, fill='#15803D')

    # Top Header Divider Line
    draw.line([(70, 132), (W - 70, 132)], fill='#CBD5E1', width=2)

    # -------------------------------------------------------------
    # 2. TOP HALF: 7 CONNECTED RESEARCH & REFERENCE NODES (WITH CHEMICALS & INDUSTRIES)
    # -------------------------------------------------------------
    nodes_data = [
        {
            "top_note": "NRT Thermal Hotspot Ingestion",
            "title": "NASA FIRMS Telemetry",
            "body": "VIIRS (375m) & MODIS (1km) dual-band spaceborne infrared active fire detections.",
            "link": "LINK"
        },
        {
            "top_note": "Sub-Pixel Planck Inversion",
            "title": "Dozier Pyrometry (1981)",
            "body": "Numerical dual-band radiance solver resolving flame temperature (Tf) & flame area (Af).",
            "link": "LINK"
        },
        {
            "top_note": "10m Surface Ground Truth",
            "title": "ESA WorldCover 10m",
            "body": "Sentinel-1/2 optical/radar LULC verifying built-up surfaces (Class 50) vs cropland.",
            "link": "LINK"
        },
        {
            "top_note": "2,000+ Facility Registry",
            "title": "GEM & World Bank GGFR",
            "body": "Curated database of all Indian refineries, petrochemical hubs, and routine flare stacks.",
            "link": "LINK"
        },
        {
            "top_note": "Hazard & Chemical Profiles",
            "title": "NOAA CAMEO & NIOSH",
            "body": "Chemical reactivity library, UN placards, and ERPG/IDLH toxic atmospheric exposure limits.",
            "link": "LINK"
        },
        {
            "top_note": "Atmospheric Dispersion",
            "title": "EPA / Briggs Plume Rise",
            "body": "Buoyant thermal plume rise coupled with Pasquill-Gifford Gaussian dispersion physics.",
            "link": "LINK"
        },
        {
            "top_note": "Tactical Standoff & Routing",
            "title": "NDRF & HazMat ERG",
            "body": "Emergency Response Guidebook chemical isolation perimeters & automated IAP dispatch.",
            "link": "LINK"
        }
    ]

    margin_x = 70
    total_w = W - 2 * margin_x
    n_nodes = len(nodes_data)
    node_spacing = 20
    node_w = (total_w - (n_nodes - 1) * node_spacing) // n_nodes  # ~328 px
    node_y = 195
    node_h = 360

    for i, nd in enumerate(nodes_data):
        nx = margin_x + i * (node_w + node_spacing)
        
        # 1. Top Subtitle Note (Above Node)
        draw.text((nx + node_w // 2, 160), nd["top_note"], font=font_node_sub, fill='#64748B', anchor="mt")

        # 2. Hexagonal / Rounded Card Container (Gold-sand tone matching reference)
        # Reference uses a soft sandy/gold tone #D4C3A3 or soft gold card
        draw.rounded_rectangle([(nx, node_y), (nx + node_w, node_y + node_h)], 
                               radius=18, fill='#FBF8F1', outline='#D6C7A8', width=2)

        # 3. Content Inside Node
        # Title
        draw.text((nx + node_w // 2, node_y + 35), nd["title"], font=font_node_title, fill='#453723', anchor="mt")
        draw.line([(nx + 30, node_y + 68), (nx + node_w - 30, node_y + 68)], fill='#E5DAC3', width=1)

        # Body Description
        # Simple word wrap
        words = nd["body"].split()
        lines = []
        curr = []
        for w in words:
            curr.append(w)
            if len(" ".join(curr)) > 26:
                lines.append(" ".join(curr[:-1]))
                curr = [w]
        if curr:
            lines.append(" ".join(curr))

        for l_idx, line in enumerate(lines[:5]):
            draw.text((nx + node_w // 2, node_y + 88 + l_idx * 24), line, font=font_node_body, fill='#5C4E38', anchor="mt")

        # Link Button / Pill at bottom of node
        pill_w, pill_h = 100, 36
        px0 = nx + (node_w - pill_w) // 2
        py0 = node_y + node_h - 55
        draw.rounded_rectangle([(px0, py0), (px0 + pill_w, py0 + pill_h)], radius=12, fill='#B89B6A')
        draw.text((px0 + pill_w // 2, py0 + pill_h // 2), nd["link"], font=font_link, fill='#FFFFFF', anchor="mm")

        # 4. Connecting Arrow to next node
        if i < n_nodes - 1:
            arr_x = nx + node_w + 3
            arr_y = node_y + node_h // 2
            # Forward Arrow
            draw.line([(arr_x, arr_y), (arr_x + 10, arr_y)], fill='#C5B495', width=2)
            draw.polygon([(arr_x + 14, arr_y), (arr_x + 8, arr_y - 5), (arr_x + 8, arr_y + 5)], fill='#C5B495')

    # -------------------------------------------------------------
    # 3. MIDDLE DIVIDER & UI/UX LABEL WITH CURVED POINTER
    # -------------------------------------------------------------
    mid_y = 600
    draw.line([(70, mid_y), (W - 250, mid_y)], fill='#CBD5E1', width=2)
    
    # "UI/UX" text badge on right matching reference
    draw.text((W - 170, mid_y - 25), "UI/UX", font=font_uiux, fill='#94A3B8')

    # Curved pointer arrow from "UI/UX" pointing down to the prototype
    draw.arc([(W - 220, mid_y + 15), (W - 140, mid_y + 95)], 90, 270, fill='#94A3B8', width=3)
    draw.polygon([(W - 180, mid_y + 98), (W - 192, mid_y + 88), (W - 192, mid_y + 108)], fill='#94A3B8')

    # -------------------------------------------------------------
    # 4. BOTTOM HALF: 3 OVERLAPPING LIVE PROTOTYPE SCREENSHOTS
    # -------------------------------------------------------------
    # Load actual project images
    img_globe_path = 'cesium_pyrosat_hud_globe.png'
    img_plume_path = 'gaussian_plume_hazard_rings.jpg'
    img_dispatch_path = 'sanitized_dispatch_modal.png'

    screen_y = 645
    screen_h = 715

    # Card 1 (Left): Cesium 3D Globe HUD (Width: 740)
    c1_x, c1_w = 70, 740
    draw.rounded_rectangle([(c1_x, screen_y), (c1_x + c1_w, screen_y + screen_h)], radius=16, fill='#0F172A', outline='#CBD5E1', width=2)
    if os.path.exists(img_globe_path):
        im_g = Image.open(img_globe_path).convert('RGB')
        im_g = im_g.resize((c1_w - 12, screen_h - 90), Image.Resampling.LANCZOS)
        canvas.paste(im_g, (c1_x + 6, screen_y + 6))
    draw.text((c1_x + 25, screen_y + screen_h - 65), "LIVE 3D GEOSPATIAL HUD (CESIUM WEBGL)", font=font_ui_title, fill='#38BDF8')
    draw.text((c1_x + 25, screen_y + screen_h - 38), "Full-globe thermal anomaly clustering across major Indian industrial corridors.", font=font_ui_sub, fill='#94A3B8')

    # Card 2 (Center): 3D Gaussian Plume & Hazard Rings (Width: 780)
    c2_x, c2_w = 850, 780
    draw.rounded_rectangle([(c2_x, screen_y), (c2_x + c2_w, screen_y + screen_h)], radius=16, fill='#0F172A', outline='#10B981', width=2)
    if os.path.exists(img_plume_path):
        im_p = Image.open(img_plume_path).convert('RGB')
        im_p = im_p.resize((c2_w - 12, screen_h - 90), Image.Resampling.LANCZOS)
        canvas.paste(im_p, (c2_x + 6, screen_y + 6))
    draw.text((c2_x + 25, screen_y + screen_h - 65), "3D TOXIC PLUME DISPERSION & EVACUATION RINGS", font=font_ui_title, fill='#34D399')
    draw.text((c2_x + 25, screen_y + screen_h - 38), "Dynamic atmospheric dispersion coupled with live Open-Meteo wind vectors.", font=font_ui_sub, fill='#94A3B8')

    # Card 3 (Right): NOAA CAMEO Chemical Dossier & Frontline Dispatch (Width: 780)
    c3_x, c3_w = 1670, 820
    draw.rounded_rectangle([(c3_x, screen_y), (c3_x + c3_w, screen_y + screen_h)], radius=16, fill='#0F172A', outline='#F59E0B', width=2)
    if os.path.exists(img_dispatch_path):
        im_d = Image.open(img_dispatch_path).convert('RGB')
        im_d = im_d.resize((c3_w - 12, screen_h - 90), Image.Resampling.LANCZOS)
        canvas.paste(im_d, (c3_x + 6, screen_y + 6))
    draw.text((c3_x + 25, screen_y + screen_h - 65), "CAMEO CHEMICAL DOSSIER & NDRF DISPATCH", font=font_ui_title, fill='#FBBF24')
    draw.text((c3_x + 25, screen_y + screen_h - 38), "Automated multi-agency Incident Action Plan (IAP) with chemical standoff directives.", font=font_ui_sub, fill='#94A3B8')

    # -------------------------------------------------------------
    # 5. FOOTER BAR
    # -------------------------------------------------------------
    draw.rectangle([(0, H - 45), (W, H)], fill='#0284C7')
    draw.text((70, H - 34), "@SIH Idea submission — PyroSat Satellite Thermal Intelligence System", 
              font=font_footer, fill='#FFFFFF')
    draw.text((W - 120, H - 34), "Slide 6", font=ImageFont.truetype(f_bold, 18), fill='#FFFFFF')

    canvas.save(output_path, quality=95)
    print(f"Slide 6 successfully generated and saved to: {output_path}")

if __name__ == '__main__':
    generate_slide6_research_uiux()
