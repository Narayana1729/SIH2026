import os
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageOps

def create_methodology_diagram():
    # Dimensions: 2700 x 1060 (Wide, clean, pure technical architecture)
    W, H = 2700, 1060
    canvas = Image.new('RGB', (W, H), color='#FFFFFF')
    draw = ImageDraw.Draw(canvas)

    # Fonts
    f_bold = '/System/Library/Fonts/Supplemental/Arial Bold.ttf'
    f_reg = '/System/Library/Fonts/Supplemental/Arial.ttf'

    font_num = ImageFont.truetype(f_bold, 22)
    font_col_title = ImageFont.truetype(f_bold, 24)
    font_col_sub = ImageFont.truetype(f_reg, 16)
    font_item_title = ImageFont.truetype(f_bold, 17)
    font_item_desc = ImageFont.truetype(f_reg, 14)
    font_box_title = ImageFont.truetype(f_bold, 17)
    font_box_text = ImageFont.truetype(f_reg, 15)
    font_pill = ImageFont.truetype(f_bold, 14)

    # Load User Images
    im_ir = Image.open('crop_thermal_ir.png').convert('RGB')
    im_plume = Image.open('crop_plume_rings.jpg').convert('RGB')
    im_globe_raw = Image.open('crop_india_globe.png').convert('RGB')
    im_disp = Image.open('crop_dispatch_modal_sanitized.png').convert('RGB')

    # Crop globe over India
    # crop_india_globe.png is (1024, 509)
    im_globe = im_globe_raw.crop((350, 35, 785, 485))

    # Column configuration
    margin_x = 45
    card_spacing = 26
    num_cards = 6
    card_w = (W - 2 * margin_x - (card_spacing * (num_cards - 1))) // num_cards  # ~388 px
    card_y = 40
    card_h = 980

    cols = [
        {
            "num": "1",
            "title": "Data Ingestion",
            "sub": "Open satellite & auxiliary data",
            "bg": "#F4F9FF",
            "border": "#BFDBFE",
            "num_bg": "#2563EB",
            "pill": "Real-time / Periodic Updates",
            "pill_bg": "#EFF6FF",
            "pill_border": "#BFDBFE",
            "pill_text": "#1E40AF"
        },
        {
            "num": "2",
            "title": "Thermal Analysis",
            "sub": "Physical inversion & pyrometry",
            "bg": "#FFFBF5",
            "border": "#FED7AA",
            "num_bg": "#EA580C",
            "pill": "Convert Signal to Physical Parameters",
            "pill_bg": "#FFF7ED",
            "pill_border": "#FED7AA",
            "pill_text": "#9A3412"
        },
        {
            "num": "3",
            "title": "AI & Geospatial",
            "sub": "Classify, contextualize & explain",
            "bg": "#FAF7FF",
            "border": "#E9D5FF",
            "num_bg": "#9333EA",
            "pill": "From Detection to Actionable Intel",
            "pill_bg": "#F5F3FF",
            "pill_border": "#DDD6FE",
            "pill_text": "#6B21A8"
        },
        {
            "num": "4",
            "title": "Impact Modeling",
            "sub": "Simulate atmospheric dispersion",
            "bg": "#F4FDF7",
            "border": "#BBF7D0",
            "num_bg": "#16A34A",
            "pill": "Simulate Atmospheric Dispersion",
            "pill_bg": "#F0FDF4",
            "pill_border": "#BBF7D0",
            "pill_text": "#15803D"
        },
        {
            "num": "5",
            "title": "Visualization",
            "sub": "Interactive geospatial platform",
            "bg": "#F0F9FF",
            "border": "#BAE6FD",
            "num_bg": "#0284C7",
            "pill": "Nationwide Situational Awareness",
            "pill_bg": "#E0F2FE",
            "pill_border": "#BAE6FD",
            "pill_text": "#0369A1"
        },
        {
            "num": "6",
            "title": "Alerts & Response",
            "sub": "Enable faster, informed action",
            "bg": "#F8F6FF",
            "border": "#DDD6FE",
            "num_bg": "#4F46E5",
            "pill": "From Insights to On-Ground Action",
            "pill_bg": "#EEF2FF",
            "pill_border": "#C7D2FE",
            "pill_text": "#3730A3"
        }
    ]

    for i, c in enumerate(cols):
        cx = margin_x + i * (card_w + card_spacing)
        
        # 1. Main Column Background Card
        draw.rounded_rectangle([(cx, card_y), (cx + card_w, card_y + card_h)], radius=18, fill=c["bg"], outline=c["border"], width=2)
        
        # 2. Header: Circle Number + Title + Subtitle
        circ_x = cx + 20
        circ_y = card_y + 20
        circ_d = 40
        draw.ellipse([(circ_x, circ_y), (circ_x + circ_d, circ_y + circ_d)], fill=c["num_bg"])
        draw.text((circ_x + 14, circ_y + 7), c["num"], font=font_num, fill="#FFFFFF")
        
        draw.text((circ_x + circ_d + 14, circ_y + 4), c["title"], font=font_col_title, fill="#0F172A")
        draw.text((circ_x + circ_d + 14, circ_y + 32), c["sub"], font=font_col_sub, fill="#64748B")
        
        # Divider
        draw.line([(cx + 20, card_y + 78), (cx + card_w - 20, card_y + 78)], fill=c["border"], width=1)

        # Content Area: y from card_y + 90 to card_y + card_h - 70
        content_y = card_y + 94
        inner_w = card_w - 36
        inner_x = cx + 18

        if i == 0:
            # ── COLUMN 1: DATA INGESTION ──
            import textwrap
            items = [
                ("NASA FIRMS", "(VIIRS 375m & MODIS 1km)", "Near-real-time dual-band thermal infrared hotspots (MWIR 4µm, LWIR 11µm)", "#0284C7"),
                ("ESA Copernicus", "(Sentinel-2 MSI)", "10m land-cover (LULC) grounding & multi-spectral surface reflectance (NDVI/NBR)", "#059669"),
                ("Weather Telemetry", "(Open-Meteo API)", "Live boundary-layer wind vectors (speed & direction), ambient temperature & pressure", "#D97706"),
                ("Industrial Database", "(2,000+ Indian Facilities)", "Curated GEM, GGFR, & CEA registry of refineries, steel mills, LNG & power stations", "#7C3AED")
            ]
            box_h = 175
            for item_idx, (t_bold, t_sub, t_desc, accent_color) in enumerate(items):
                by = content_y + item_idx * (box_h + 16)
                draw.rounded_rectangle([(inner_x, by), (inner_x + inner_w, by + box_h)], radius=12, fill="#FFFFFF", outline=c["border"], width=1)
                
                # Left colored accent indicator
                draw.rounded_rectangle([(inner_x + 10, by + 12), (inner_x + 14, by + box_h - 12)], radius=2, fill=accent_color)
                
                draw.text((inner_x + 24, by + 14), t_bold, font=font_item_title, fill="#0F172A")
                draw.text((inner_x + 24, by + 36), t_sub, font=font_col_sub, fill=accent_color)
                
                # Wrapped description with proper word breaks
                lines = textwrap.wrap(t_desc, width=36)
                for line_idx, line in enumerate(lines):
                    draw.text((inner_x + 24, by + 68 + line_idx * 22), line, font=font_item_desc, fill="#475569")

        elif i == 1:
            # ── COLUMN 2: THERMAL ANALYSIS ──
            # Embedded user image: crop_thermal_ir.png (crop out top 50px of parameters label)
            im_ir_clean = im_ir.crop((0, 52, im_ir.width, im_ir.height))
            img_h = 240
            c_ir = im_ir_clean.resize((inner_w, img_h), Image.Resampling.LANCZOS)
            canvas.paste(c_ir, (inner_x, content_y))
            draw.rounded_rectangle([(inner_x, content_y), (inner_x + inner_w, content_y + img_h)], radius=10, outline=c["border"], width=1)
            
            # Down arrow
            arrow_y = content_y + img_h + 18
            draw.line([(cx + card_w // 2, arrow_y), (cx + card_w // 2, arrow_y + 30)], fill="#EA580C", width=3)
            draw.polygon([(cx + card_w // 2 - 8, arrow_y + 26), (cx + card_w // 2 + 8, arrow_y + 26), (cx + card_w // 2, arrow_y + 38)], fill="#EA580C")
            
            # Sub-pixel Pyrometry Box
            pyr_y = arrow_y + 48
            pyr_h = 420
            draw.rounded_rectangle([(inner_x, pyr_y), (inner_x + inner_w, pyr_y + pyr_h)], radius=14, fill="#FFFFFF", outline="#FDBA74", width=2)
            
            draw.text((inner_x + 16, pyr_y + 18), "Planck / Dozier Pyrometry", font=font_box_title, fill="#C2410C")
            draw.text((inner_x + 16, pyr_y + 44), "Dual-Band Sub-Pixel Inversion", font=font_col_sub, fill="#EA580C")
            draw.line([(inner_x + 16, pyr_y + 72), (inner_x + inner_w - 16, pyr_y + 72)], fill="#FED7AA", width=1)

            pyr_bullets = [
                ("Equation Solved:", "L(λ) = p·B(λ, Tf) + (1-p)·B(λ, Tb)"),
                ("Numerical Optimization:", "SciPy L-BFGS-B non-linear solver"),
                ("True Flame Temp (Tf):", "Resolves kinetic heat (>1200 K)"),
                ("Sub-Pixel Area (Af):", "Decouples 10m² flame from 375m pixel"),
                ("Radiant Heat Flux:", "True combustion flux (kW/m²)")
            ]
            for b_idx, (b_lead, b_val) in enumerate(pyr_bullets):
                by = pyr_y + 86 + b_idx * 64
                draw.text((inner_x + 16, by), b_lead, font=font_item_title, fill="#1E293B")
                draw.text((inner_x + 16, by + 24), b_val, font=font_item_desc, fill="#64748B")

        elif i == 2:
            # ── COLUMN 3: AI & GEOSPATIAL ANALYSIS ──
            ai_items = [
                ("Hierarchical ML Classifier", "2-Stage Multi-Modal Model", [
                    "• Stage 1: Binary Industrial Segregator",
                    "• Stage 2: Fine-Grained Hazard Classifier",
                    "• Flares vs Blazes vs Stubble vs Wildfire"
                ], "#7C3AED"),
                ("Facility Geospatial Matching", "Spatial Grounding & Buffers", [
                    "• 5km Haversine Proximity Buffering",
                    "• GEM, GGFR, & Power Plant Association",
                    "• 90-Day Spatiotemporal Baseline Verification"
                ], "#2563EB"),
                ("Explainable AI (TreeSHAP)", "Exact Lundberg DP Attribution", [
                    "• True Local Feature Waterfall Explanations",
                    "• Additivity: sum(phi_i) + phi_0 == f(x)",
                    "• Verifies physics features over proximity"
                ], "#059669")
            ]
            box_h = 236
            for a_idx, (a_title, a_sub, a_lines, a_col) in enumerate(ai_items):
                by = content_y + a_idx * (box_h + 20)
                draw.rounded_rectangle([(inner_x, by), (inner_x + inner_w, by + box_h)], radius=12, fill="#FFFFFF", outline=c["border"], width=1)
                
                # Left accent
                draw.rounded_rectangle([(inner_x + 10, by + 12), (inner_x + 14, by + box_h - 12)], radius=2, fill=a_col)
                
                draw.text((inner_x + 24, by + 14), a_title, font=font_item_title, fill="#0F172A")
                draw.text((inner_x + 24, by + 36), a_sub, font=font_col_sub, fill=a_col)
                draw.line([(inner_x + 24, by + 62), (inner_x + inner_w - 18, by + 62)], fill="#F1F5F9", width=1)

                for l_idx, line in enumerate(a_lines):
                    draw.text((inner_x + 24, by + 74 + l_idx * 30), line, font=font_item_desc, fill="#334155")

        elif i == 3:
            # ── COLUMN 4: IMPACT MODELING ──
            # Embedded user image: crop_plume_rings.jpg
            img_h = 360
            c_plume = im_plume.resize((inner_w, img_h), Image.Resampling.LANCZOS)
            canvas.paste(c_plume, (inner_x, content_y))
            draw.rounded_rectangle([(inner_x, content_y), (inner_x + inner_w, content_y + img_h)], radius=12, outline=c["border"], width=2)
            
            # Badge overlay on image
            draw.rounded_rectangle([(inner_x + 10, content_y + 10), (inner_x + 250, content_y + 40)], radius=6, fill=(15, 23, 42, 230), outline="#22C55E", width=1)
            draw.text((inner_x + 20, content_y + 16), "LIVE GAUSSIAN PLUME HUD", font=font_pill, fill="#4ADE80")

            # Dispersion Model Detail Box
            disp_y = content_y + img_h + 16
            disp_h = 370
            draw.rounded_rectangle([(inner_x, disp_y), (inner_x + inner_w, disp_y + disp_h)], radius=14, fill="#FFFFFF", outline="#86EFAC", width=2)
            
            draw.text((inner_x + 16, disp_y + 16), "Gaussian Plume Dispersion", font=font_box_title, fill="#15803D")
            draw.text((inner_x + 16, disp_y + 40), "Pasquill-Gifford + Briggs Buoyancy", font=font_col_sub, fill="#16A34A")
            draw.line([(inner_x + 16, disp_y + 68), (inner_x + inner_w - 16, disp_y + 68)], fill="#DCFCE7", width=1)

            plume_bullets = [
                ("Live Wind Vectors:", "Open-Meteo boundary layer wind direction & speed"),
                ("Briggs Plume Rise:", "Convective thermal buoyancy scaled directly by FRP"),
                ("Dynamic Cordon Rings:", "Concentric Immediate, Perimeter & Community zones"),
                ("CAMEO / NIOSH Chemical:", "Hazard profile: SO2, VOCs, & evacuation perimeters")
            ]
            for b_idx, (b_lead, b_val) in enumerate(plume_bullets):
                by = disp_y + 80 + b_idx * 68
                draw.text((inner_x + 16, by), b_lead, font=font_item_title, fill="#0F172A")
                draw.text((inner_x + 16, by + 22), b_val, font=font_item_desc, fill="#475569")

        elif i == 4:
            # ── COLUMN 5: VISUALIZATION & INTELLIGENCE ──
            # Embedded user image: crop_india_globe.png (cropped around India)
            img_h = 360
            c_globe = im_globe.resize((inner_w, img_h), Image.Resampling.LANCZOS)
            canvas.paste(c_globe, (inner_x, content_y))
            draw.rounded_rectangle([(inner_x, content_y), (inner_x + inner_w, content_y + img_h)], radius=12, outline=c["border"], width=2)
            
            # Badge overlay on globe
            draw.rounded_rectangle([(inner_x + 10, content_y + 10), (inner_x + 240, content_y + 40)], radius=6, fill=(15, 23, 42, 230), outline="#38BDF8", width=1)
            draw.text((inner_x + 20, content_y + 16), "CESIUMJS 3D DIGITAL TWIN", font=font_pill, fill="#38BDF8")

            # Globe Platform Detail Box
            dt_y = content_y + img_h + 16
            dt_h = 370
            draw.rounded_rectangle([(inner_x, dt_y), (inner_x + inner_w, dt_y + dt_h)], radius=14, fill="#FFFFFF", outline="#7DD3FC", width=2)
            
            draw.text((inner_x + 16, dt_y + 16), "CesiumJS Geospatial HUD", font=font_box_title, fill="#0369A1")
            draw.text((inner_x + 16, dt_y + 40), "Real-time Nationwide Digital Twin", font=font_col_sub, fill="#0284C7")
            draw.line([(inner_x + 16, dt_y + 68), (inner_x + inner_w - 16, dt_y + 68)], fill="#E0F2FE", width=1)

            globe_bullets = [
                ("Nationwide Hotspot Map:", "Color-coded thermal anomaly clustering over India"),
                ("Segregation HUD Filters:", "Instant toggling: Industrial, Flares, Agri, Wildfires"),
                ("Facility Threat Matrix:", "Industrial proximity & chemical hazard overlay"),
                ("90-Day Radiative Baseline:", "Tracks operational baseline vs runaway surges")
            ]
            for b_idx, (b_lead, b_val) in enumerate(globe_bullets):
                by = dt_y + 80 + b_idx * 68
                draw.text((inner_x + 16, by), b_lead, font=font_item_title, fill="#0F172A")
                draw.text((inner_x + 16, by + 22), b_val, font=font_item_desc, fill="#475569")

        elif i == 5:
            # ── COLUMN 6: ALERTS & RESPONSE ──
            # Embedded user image: crop_dispatch_modal_sanitized.png
            img_h = 360
            c_disp = im_disp.resize((inner_w, img_h), Image.Resampling.LANCZOS)
            canvas.paste(c_disp, (inner_x, content_y))
            draw.rounded_rectangle([(inner_x, content_y), (inner_x + inner_w, content_y + img_h)], radius=12, outline=c["border"], width=2)
            
            # Badge overlay on modal
            draw.rounded_rectangle([(inner_x + 10, content_y + 10), (inner_x + 230, content_y + 40)], radius=6, fill=(15, 23, 42, 230), outline="#818CF8", width=1)
            draw.text((inner_x + 20, content_y + 16), "TACTICAL DISPATCH MODAL", font=font_pill, fill="#A5B4FC")

            # Dispatch Detail Box
            disp_box_y = content_y + img_h + 16
            disp_box_h = 370
            draw.rounded_rectangle([(inner_x, disp_box_y), (inner_x + inner_w, disp_box_y + disp_box_h)], radius=14, fill="#FFFFFF", outline="#C7D2FE", width=2)
            
            draw.text((inner_x + 16, disp_box_y + 16), "Tactical First Response", font=font_box_title, fill="#3730A3")
            draw.text((inner_x + 16, disp_box_y + 40), "Multi-Agency Emergency Network", font=font_col_sub, fill="#4F46E5")
            draw.line([(inner_x + 16, disp_box_y + 68), (inner_x + inner_w - 16, disp_box_y + 68)], fill="#EEF2FF", width=1)

            resp_bullets = [
                ("Targeted Emergency Units:", "NDRF Hazmat, District Fire (101), Trauma ICU (108)"),
                ("Fast2SMS Live Gateway:", "Direct SMS broadcast with coordinates & plume radius"),
                ("Automated Incident Plans:", "Complete IAP documentation with CAMEO suppression directives"),
                ("Masked Dispatch Channel:", "Encrypted responder lines & secure verified tokens")
            ]
            for b_idx, (b_lead, b_val) in enumerate(resp_bullets):
                by = disp_box_y + 80 + b_idx * 68
                draw.text((inner_x + 16, by), b_lead, font=font_item_title, fill="#0F172A")
                draw.text((inner_x + 16, by + 22), b_val, font=font_item_desc, fill="#475569")

        # Bottom Pill Badge in each Column
        pill_y = card_y + card_h - 52
        pill_h = 38
        draw.rounded_rectangle([(inner_x, pill_y), (inner_x + inner_w, pill_y + pill_h)], radius=19, fill=c["pill_bg"], outline=c["pill_border"], width=1)
        # Center pill text
        p_bbox = font_pill.getbbox(c["pill"])
        pw = p_bbox[2] - p_bbox[0]
        draw.text((inner_x + (inner_w - pw) // 2, pill_y + 9), c["pill"], font=font_pill, fill=c["pill_text"])

        # Connecting Arrows between Columns
        if i < num_cards - 1:
            arr_x = cx + card_w + (card_spacing // 2)
            arr_y = card_y + 360
            draw.line([(arr_x - 8, arr_y - 12), (arr_x + 6, arr_y)], fill="#94A3B8", width=3)
            draw.line([(arr_x + 6, arr_y), (arr_x - 8, arr_y + 12)], fill="#94A3B8", width=3)

    # Save Output Image
    output_path = "pyrosat_authentic_methodology_architecture.png"
    canvas.save(output_path, quality=95)
    print(f"Generated clean methodology infographic successfully: {output_path} ({W}x{H})")

if __name__ == "__main__":
    create_methodology_diagram()
