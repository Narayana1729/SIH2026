import os
from PIL import Image, ImageDraw, ImageFont, ImageOps

def draw_round_rect(draw, bbox, radius, fill=None, outline=None, width=1):
    draw.rounded_rectangle(bbox, radius=radius, fill=fill, outline=outline, width=width)

def draw_orthogonal_arrow(draw, points, color="#334155", width=2, arrow_size=6, font=None, label=None, label_pos=None):
    # points is list of (x, y) coordinates forming right angles
    for j in range(len(points) - 1):
        p1 = points[j]
        p2 = points[j+1]
        draw.line([p1, p2], fill=color, width=width)
    
    # Draw arrow head at the last segment
    p_last = points[-1]
    p_prev = points[-2]
    
    if p_last[0] > p_prev[0]: # Right
        draw.polygon([(p_last[0], p_last[1]), (p_last[0] - arrow_size * 2, p_last[1] - arrow_size), (p_last[0] - arrow_size * 2, p_last[1] + arrow_size)], fill=color)
    elif p_last[0] < p_prev[0]: # Left
        draw.polygon([(p_last[0], p_last[1]), (p_last[0] + arrow_size * 2, p_last[1] - arrow_size), (p_last[0] + arrow_size * 2, p_last[1] + arrow_size)], fill=color)
    elif p_last[1] > p_prev[1]: # Down
        draw.polygon([(p_last[0], p_last[1]), (p_last[0] - arrow_size, p_last[1] - arrow_size * 2), (p_last[0] + arrow_size, p_last[1] - arrow_size * 2)], fill=color)
    elif p_last[1] < p_prev[1]: # Up
        draw.polygon([(p_last[0], p_last[1]), (p_last[0] - arrow_size, p_last[1] + arrow_size * 2), (p_last[0] + arrow_size, p_last[1] + arrow_size * 2)], fill=color)

    if label and label_pos and font:
        draw.text(label_pos, label, font=font, fill="#1E293B")

def generate_process_flow():
    W, H = 2000, 1150
    canvas = Image.new('RGB', (W, H), color='#FFFFFF')
    draw = ImageDraw.Draw(canvas)

    # Fonts
    f_bold = '/System/Library/Fonts/Supplemental/Arial Bold.ttf'
    f_reg = '/System/Library/Fonts/Supplemental/Arial.ttf'

    font_main_title = ImageFont.truetype(f_bold, 36)
    font_section_label = ImageFont.truetype(f_bold, 14)
    font_node_title = ImageFont.truetype(f_bold, 17)
    font_node_sub = ImageFont.truetype(f_reg, 13)
    font_line_label = ImageFont.truetype(f_bold, 13)
    font_badge = ImageFont.truetype(f_bold, 12)

    # 1. Main Title
    draw.text((80, 50), "PROCESS FLOW ARCHITECTURE", font=font_main_title, fill="#3B82F6")

    # Load Real User Images
    im_plume = Image.open('crop_plume_rings.jpg').convert('RGB')
    im_globe_raw = Image.open('crop_india_globe.png').convert('RGB')
    im_globe = im_globe_raw.crop((360, 35, 785, 485)) # India globe

    # -------------------------------------------------------------
    # TOP CONTAINER: INGESTION & CORE INVERSION (Border box like reference)
    # -------------------------------------------------------------
    box_x, box_y, box_w, box_h = 100, 130, 1240, 360
    draw_round_rect(draw, [(box_x, box_y), (box_x + box_w, box_y + box_h)], radius=12, fill="#FFFFFF", outline="#CBD5E1", width=2)
    draw.text((box_x + box_w - 240, box_y + 16), "SATELLITE & PHYSICAL PIPELINE", font=font_section_label, fill="#64748B")

    # Node 1: Satellite Ingestion (Circle with satellite)
    n1_cx, n1_cy = 280, 310
    draw.ellipse([(n1_cx - 85, n1_cy - 85), (n1_cx + 85, n1_cy + 85)], fill="#EFF6FF", outline="#3B82F6", width=2)
    # Satellite icon drawn simply
    draw.rounded_rectangle([(n1_cx - 24, n1_cy - 24), (n1_cx + 24, n1_cy + 24)], radius=6, fill="#2563EB")
    draw.rectangle([(n1_cx - 60, n1_cy - 12), (n1_cx - 30, n1_cy + 12)], fill="#0284C7", outline="#38BDF8", width=1) # Solar panel 1
    draw.rectangle([(n1_cx + 30, n1_cy - 12), (n1_cx + 60, n1_cy + 12)], fill="#0284C7", outline="#38BDF8", width=1) # Solar panel 2
    draw.line([(n1_cx - 30, n1_cy), (n1_cx - 24, n1_cy)], fill="#FFFFFF", width=3)
    draw.line([(n1_cx + 24, n1_cy), (n1_cx + 30, n1_cy)], fill="#FFFFFF", width=3)
    # Beams
    draw.line([(n1_cx, n1_cy + 24), (n1_cx - 15, n1_cy + 55)], fill="#EF4444", width=2)
    draw.line([(n1_cx, n1_cy + 24), (n1_cx + 15, n1_cy + 55)], fill="#EF4444", width=2)
    
    draw.text((n1_cx, n1_cy + 105), "NASA FIRMS Telemetry", font=font_node_title, fill="#0F172A", anchor="mt")
    draw.text((n1_cx, n1_cy + 128), "VIIRS (375m) & MODIS (1km)", font=font_node_sub, fill="#64748B", anchor="mt")

    # Arrow 1 -> 2
    draw.line([(400, n1_cy - 10), (460, n1_cy - 10)], fill="#334155", width=2)
    draw.polygon([(460, n1_cy - 10), (450, n1_cy - 16), (450, n1_cy - 4)], fill="#334155")
    draw.line([(400, n1_cy + 10), (460, n1_cy + 10)], fill="#334155", width=2)
    draw.polygon([(460, n1_cy + 10), (450, n1_cy + 4), (450, n1_cy + 16)], fill="#334155")
    draw.text((430, n1_cy - 30), "NRT Feeds", font=font_line_label, fill="#2563EB", anchor="mb")

    # Node 2: Planck / Dozier Pyrometry (Screen/Card)
    n2_cx, n2_cy = 680, 310
    draw_round_rect(draw, [(n2_cx - 115, n2_cy - 85), (n2_cx + 115, n2_cy + 85)], radius=10, fill="#FFF7ED", outline="#EA580C", width=3)
    # Inner flame card
    draw_round_rect(draw, [(n2_cx - 85, n2_cy - 65), (n2_cx + 85, n2_cy + 25)], radius=6, fill="#9A3412")
    draw.text((n2_cx, n2_cy - 48), "DOZIER PYROMETRY", font=font_badge, fill="#FDBA74", anchor="mt")
    draw.text((n2_cx, n2_cy - 26), "L(λ) = p·B(λ, Tf)", font=font_badge, fill="#FFFFFF", anchor="mt")
    draw.text((n2_cx, n2_cy - 4), "Tf > 1200 K", font=font_node_title, fill="#FED7AA", anchor="mt")
    
    draw.text((n2_cx, n2_cy + 40), "Physical Flame Temp (Tf)", font=font_node_title, fill="#9A3412", anchor="mt")
    draw.text((n2_cx, n2_cy + 62), "Sub-Pixel Area (Af m²)", font=font_node_sub, fill="#C2410C", anchor="mt")

    draw.text((n2_cx, n2_cy + 105), "Planck Inversion Solver", font=font_node_title, fill="#0F172A", anchor="mt")
    draw.text((n2_cx, n2_cy + 128), "Sub-Pixel Combustion Math", font=font_node_sub, fill="#64748B", anchor="mt")

    # Arrow 2 -> 3
    draw.line([(830, n1_cy - 10), (890, n1_cy - 10)], fill="#334155", width=2)
    draw.polygon([(890, n1_cy - 10), (880, n1_cy - 16), (880, n1_cy - 4)], fill="#334155")
    draw.line([(830, n1_cy + 10), (890, n1_cy + 10)], fill="#334155", width=2)
    draw.polygon([(890, n1_cy + 10), (880, n1_cy + 4), (880, n1_cy + 16)], fill="#334155")
    draw.text((860, n1_cy - 30), "Tf & Af", font=font_line_label, fill="#EA580C", anchor="mb")

    # Node 3: 2-Stage Hierarchical ML (Purple Card)
    n3_cx, n3_cy = 1100, 310
    draw_round_rect(draw, [(n3_cx - 105, n3_cy - 85), (n3_cx + 105, n3_cy + 85)], radius=16, fill="#FAF5FF", outline="#9333EA", width=3)
    # Inner chip
    draw_round_rect(draw, [(n3_cx - 70, n3_cy - 65), (n3_cx + 70, n3_cy + 25)], radius=10, fill="#7C3AED")
    draw.text((n3_cx, n3_cy - 52), "HIERARCHICAL", font=font_badge, fill="#E9D5FF", anchor="mt")
    draw.text((n3_cx, n3_cy - 32), "ML CLASSIFIER", font=font_node_title, fill="#FFFFFF", anchor="mt")
    draw.text((n3_cx, n3_cy - 4), "Stage 1 ➔ Stage 2", font=font_badge, fill="#DDD6FE", anchor="mt")

    draw.text((n3_cx, n3_cy + 40), "Industrial vs Wildfire", font=font_node_title, fill="#6B21A8", anchor="mt")
    draw.text((n3_cx, n3_cy + 62), "Lundberg TreeSHAP", font=font_node_sub, fill="#9333EA", anchor="mt")

    draw.text((n3_cx, n3_cy + 105), "AI Segregation Engine", font=font_node_title, fill="#0F172A", anchor="mt")
    draw.text((n3_cx, n3_cy + 128), "Facility Proximity + LULC", font=font_node_sub, fill="#64748B", anchor="mt")

    # -------------------------------------------------------------
    # TOP-RIGHT TARGET CIRCLE: CESIUMJS 3D HUD (Matching green circle in ref)
    # -------------------------------------------------------------
    hud_cx, hud_cy = 1680, 300
    draw.ellipse([(hud_cx - 160, hud_cy - 160), (hud_cx + 160, hud_cy + 160)], fill="#F0FDF4", outline="#10B981", width=3)
    
    # Embed India Globe in Monitor
    globe_w, globe_h = 230, 230
    c_globe = im_globe.resize((globe_w, globe_h), Image.Resampling.LANCZOS)
    
    # Create circular mask for globe
    mask = Image.new('L', (globe_w, globe_h), 0)
    draw_mask = ImageDraw.Draw(mask)
    draw_mask.ellipse([(0, 0), (globe_w, globe_h)], fill=255)
    canvas.paste(c_globe, (hud_cx - globe_w // 2, hud_cy - globe_h // 2 - 10), mask)
    
    # Checkmark shield badge
    draw.ellipse([(hud_cx + 70, hud_cy - 85), (hud_cx + 130, hud_cy - 25)], fill="#16A34A", outline="#FFFFFF", width=3)
    draw.line([(hud_cx + 88, hud_cy - 55), (hud_cx + 98, hud_cy - 45)], fill="#FFFFFF", width=4)
    draw.line([(hud_cx + 98, hud_cy - 45), (hud_cx + 115, hud_cy - 65)], fill="#FFFFFF", width=4)

    draw.text((hud_cx, hud_cy + 130), "3D DIGITAL TWIN HUD", font=font_node_title, fill="#0F172A", anchor="mt")
    draw.text((hud_cx, hud_cy + 152), "Interactive Geospatial Incident Map", font=font_node_sub, fill="#15803D", anchor="mt")

    # -------------------------------------------------------------
    # BOTTOM ROW: DISPATCH MOBILE, CLOUD WEATHER API, DISPERSION ENGINE
    # -------------------------------------------------------------

    # Node Bottom Left: Mobile Responder (Circle like reference)
    mob_cx, mob_cy = 280, 850
    draw.ellipse([(mob_cx - 95, mob_cy - 95), (mob_cx + 95, mob_cy + 95)], fill="#F0FDFA", outline="#0D9488", width=3)
    
    # Mobile device illustration
    draw_round_rect(draw, [(mob_cx - 36, mob_cy - 60), (mob_cx + 36, mob_cy + 60)], radius=10, fill="#115E59", outline="#5EEAD4", width=2)
    draw.rectangle([(mob_cx - 28, mob_cy - 45), (mob_cx + 28, mob_cy + 40)], fill="#042F2E")
    # SMS Alert icon
    draw.rectangle([(mob_cx - 20, mob_cy - 30), (mob_cx + 20, mob_cy - 24)], fill="#F59E0B")
    draw.rectangle([(mob_cx - 20, mob_cy - 18), (mob_cx + 12, mob_cy - 12)], fill="#5EEAD4")
    draw.rectangle([(mob_cx - 20, mob_cy - 6), (mob_cx + 16, mob_cy - 0)], fill="#5EEAD4")
    draw.text((mob_cx, mob_cy + 18), "SMS", font=font_badge, fill="#FDE047", anchor="mt")
    
    draw.text((mob_cx, mob_cy + 115), "Tactical Alert Dispatch", font=font_node_title, fill="#0F172A", anchor="mt")
    draw.text((mob_cx, mob_cy + 138), "NDRF & Fire Services (101) SMS", font=font_node_sub, fill="#0D9488", anchor="mt")

    # Node Bottom Center: Cloud API (Open-Meteo & Backend API)
    cloud_cx, cloud_cy = 760, 850
    # Cloud shape drawn with overlapping circles
    draw.ellipse([(cloud_cx - 100, cloud_cy - 50), (cloud_cx - 20, cloud_cy + 30)], fill="#F0F9FF", outline="#0284C7", width=2)
    draw.ellipse([(cloud_cx - 50, cloud_cy - 90), (cloud_cx + 50, cloud_cy + 10)], fill="#F0F9FF", outline="#0284C7", width=2)
    draw.ellipse([(cloud_cx + 10, cloud_cy - 60), (cloud_cx + 100, cloud_cy + 30)], fill="#F0F9FF", outline="#0284C7", width=2)
    draw.rectangle([(cloud_cx - 70, cloud_cy - 20), (cloud_cx + 70, cloud_cy + 30)], fill="#F0F9FF")
    draw.line([(cloud_cx - 70, cloud_cy + 30), (cloud_cx + 70, cloud_cy + 30)], fill="#0284C7", width=2)
    
    draw.text((cloud_cx, cloud_cy - 40), "WEATHER & HAZMAT API", font=font_badge, fill="#0369A1", anchor="mt")
    draw.text((cloud_cx, cloud_cy - 15), "Open-Meteo + CAMEO", font=font_node_title, fill="#0284C7", anchor="mt")
    draw.text((cloud_cx, cloud_cy + 10), "Live Boundary Wind Vectors", font=font_badge, fill="#64748B", anchor="mt")

    draw.text((cloud_cx, cloud_cy + 115), "Atmospheric Gateway", font=font_node_title, fill="#0F172A", anchor="mt")
    draw.text((cloud_cx, cloud_cy + 138), "Meteorology & Chemical Directives", font=font_node_sub, fill="#64748B", anchor="mt")

    # Node Bottom Right: Dispersion & Server Rack (Plume Model + Server)
    srv_cx, srv_cy = 1340, 850
    draw_round_rect(draw, [(srv_cx - 130, srv_cy - 120), (srv_cx + 130, srv_cy + 100)], radius=14, fill="#F8FAFC", outline="#475569", width=2)
    
    # Embed real Plume Thumbnail inside this box!
    plume_thumb_w, plume_thumb_h = 240, 140
    c_plume = im_plume.resize((plume_thumb_w, plume_thumb_h), Image.Resampling.LANCZOS)
    canvas.paste(c_plume, (srv_cx - plume_thumb_w // 2, srv_cy - 110))
    draw_round_rect(draw, [(srv_cx - plume_thumb_w // 2, srv_cy - 110), (srv_cx + plume_thumb_w // 2, srv_cy - 110 + plume_thumb_h)], radius=6, outline="#64748B", width=1)

    draw.text((srv_cx, srv_cy + 42), "Gaussian Plume Engine", font=font_node_title, fill="#0F172A", anchor="mt")
    draw.text((srv_cx, srv_cy + 64), "Briggs Buoyancy + Cordon Rings", font=font_node_sub, fill="#EA580C", anchor="mt")

    draw.text((srv_cx, srv_cy + 115), "Dispersion & Hazard Engine", font=font_node_title, fill="#0F172A", anchor="mt")
    draw.text((srv_cx, srv_cy + 138), "Dynamic Impact Zones (Immediate / Perimeter)", font=font_node_sub, fill="#64748B", anchor="mt")

    # -------------------------------------------------------------
    # ORTHOGONAL CONNECTING LINES WITH ARROWS & LABELS (Like reference!)
    # -------------------------------------------------------------

    # 1. From Top Container Node 3 down to Bottom Cloud API
    draw_orthogonal_arrow(
        draw,
        points=[(1100, 490), (1100, 680), (760, 680), (760, 770)],
        color="#334155",
        width=2,
        font=font_line_label,
        label="Event Coordinates (Lat, Lon)",
        label_pos=(860, 658)
    )

    # 2. From Cloud API to Dispersion Engine (Two bidirectional lines like reference!)
    # Top line: POST Request
    draw.line([(880, 830), (1190, 830)], fill="#334155", width=2)
    draw.polygon([(1190, 830), (1180, 824), (1180, 836)], fill="#334155")
    draw.text((1035, 808), "POST Boundary Wind & FRP", font=font_line_label, fill="#0F172A", anchor="mb")

    # Bottom line: Status Response
    draw.line([(1190, 870), (880, 870)], fill="#334155", width=2)
    draw.polygon([(880, 870), (890, 864), (890, 876)], fill="#334155")
    draw.text((1035, 878), "Plume Footprint & Rings", font=font_line_label, fill="#16A34A", anchor="mt")

    # 3. From Cloud API to Mobile Dispatch
    draw_orthogonal_arrow(
        draw,
        points=[(660, 850), (400, 850)],
        color="#334155",
        width=2,
        font=font_line_label,
        label="Fast2SMS Alert",
        label_pos=(480, 826)
    )

    # 4. From Dispersion Engine UP to Top-Right 3D Digital Twin HUD (Long line like ref!)
    draw_orthogonal_arrow(
        draw,
        points=[(1470, 850), (1680, 850), (1680, 480)],
        color="#334155",
        width=3,
        font=font_line_label,
        label="Render Live Plume & Incidents",
        label_pos=(1695, 660)
    )

    # Save Image
    output_path = "pyrosat_process_flow_architecture.png"
    canvas.save(output_path, quality=95)
    print(f"Generated process flow architecture successfully: {output_path} ({W}x{H})")

if __name__ == "__main__":
    generate_process_flow()
