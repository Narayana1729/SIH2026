import os
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageOps

def create_halfpage_methodology():
    # Dimensions: 2400 x 1220 (2:1 aspect ratio, fits cleanly in half-page slides)
    W, H = 2400, 1220
    canvas = Image.new('RGB', (W, H), color='#070D18')
    draw = ImageDraw.Draw(canvas)

    # Fonts
    font_path = '/System/Library/Fonts/Supplemental/Arial.ttf'
    font_title = ImageFont.truetype(font_path, 42)
    font_subtitle = ImageFont.truetype(font_path, 22)
    font_step = ImageFont.truetype(font_path, 18)
    font_card_title = ImageFont.truetype(font_path, 24)
    font_card_sub = ImageFont.truetype(font_path, 18)
    font_body = ImageFont.truetype(font_path, 16)
    font_badge = ImageFont.truetype(font_path, 14)

    # 1. Top Header Banner
    draw.rectangle([(0, 0), (W, 110)], fill='#0A1324')
    draw.line([(0, 110), (W, 110)], fill='#1E293B', width=2)

    # Header Text
    draw.text((60, 22), "PYROSAT — METHODOLOGY & SYSTEM IMPLEMENTATION", font=font_title, fill='#38BDF8')
    draw.text((60, 72), "End-to-End Operational Pipeline: Live Satellite Telemetry Ingestion to Tactical Frontline Dispatch", font=font_subtitle, fill='#94A3B8')

    # Status Pill on Top Right
    draw.rounded_rectangle([(W - 360, 36), (W - 60, 78)], radius=20, fill='#022C22', outline='#10B981', width=1)
    draw.ellipse([(W - 340, 52), (W - 328, 64)], fill='#10B981')
    draw.text((W - 316, 47), "LIVE PRODUCTION HUD", font=font_badge, fill='#34D399')

    # Load Source Images
    hud_globe = Image.open('cesium_pyrosat_hud_globe.png').convert('RGB')
    plume_img = Image.open('gaussian_plume_hazard_rings.jpg').convert('RGB')
    dispatch_img = Image.open('sanitized_dispatch_modal.png').convert('RGB')

    # Card layout parameters
    margin_x = 60
    card_spacing = 32
    num_cards = 4
    total_spacing = card_spacing * (num_cards - 1)
    card_w = (W - 2 * margin_x - total_spacing) // num_cards  # ~524 px
    card_y = 138
    card_h = 1040

    steps_data = [
        {
            "step": "STEP 01",
            "title": "SATELLITE INGESTION",
            "sub": "NASA FIRMS Telemetry",
            "accent": "#0284C7",
            "bg": "#0B1528",
            "tag": "INPUT TELEMETRY",
            "bullet1": "• VIIRS 375m & MODIS 1km NRT infrared feeds",
            "bullet2": "• Instant coordinate mapping on Cesium 3D Globe"
        },
        {
            "step": "STEP 02",
            "title": "ML SEGREGATION",
            "sub": "2-Stage Filter & Pyrometry",
            "accent": "#D97706",
            "bg": "#0F1A2A",
            "tag": "PHYSICS + CLASSIFIER",
            "bullet1": "• Flame temp (1,380°C) & FRP (3.0 MW) extraction",
            "bullet2": "• Segregates flares from wildfires & farm burning"
        },
        {
            "step": "STEP 03",
            "title": "PLUME DISPERSION",
            "sub": "Gaussian Plume & Exclusion",
            "accent": "#9333EA",
            "bg": "#0D1627",
            "tag": "HAZARD MODELING",
            "bullet1": "• Directional toxic plume driven by live wind vectors",
            "bullet2": "• Concentric evacuation rings & community buffers"
        },
        {
            "step": "STEP 04",
            "title": "TACTICAL DISPATCH",
            "sub": "Multi-Agency First Response",
            "accent": "#DC2626",
            "bg": "#121424",
            "tag": "ACTIONABLE DISPATCH",
            "bullet1": "• Automated SMS & WhatsApp tactical payload",
            "bullet2": "• Instant routing to NDRF Hazmat & District Fire"
        }
    ]

    for i, s in enumerate(steps_data):
        cx = margin_x + i * (card_w + card_spacing)
        
        # Draw Card Outer Background
        draw.rounded_rectangle([(cx, card_y), (cx + card_w, card_y + card_h)], radius=16, fill=s["bg"], outline=s["accent"], width=2)
        
        # Header inside Card
        draw.rounded_rectangle([(cx + 20, card_y + 20), (cx + 110, card_y + 46)], radius=6, fill='#1E293B', outline=s["accent"], width=1)
        draw.text((cx + 28, card_y + 24), s["step"], font=font_step, fill=s["accent"])
        
        # Tag on right
        draw.rounded_rectangle([(cx + card_w - 180, card_y + 20), (cx + card_w - 20, card_y + 46)], radius=6, fill='#0F172A', outline='#334155', width=1)
        draw.text((cx + card_w - 168, card_y + 25), s["tag"], font=font_badge, fill='#94A3B8')

        # Titles
        draw.text((cx + 22, card_y + 58), s["title"], font=font_card_title, fill='#F8FAFC')
        draw.text((cx + 22, card_y + 88), s["sub"], font=font_card_sub, fill='#94A3B8')

        # Divider line
        draw.line([(cx + 20, card_y + 120), (cx + card_w - 20, card_y + 120)], fill='#1E293B', width=1)

        # Image Container
        img_box_x = cx + 18
        img_box_y = card_y + 132
        img_box_w = card_w - 36
        img_box_h = 750

        draw.rounded_rectangle([(img_box_x - 1, img_box_y - 1), (img_box_x + img_box_w + 1, img_box_y + img_box_h + 1)], radius=10, fill='#040810', outline='#334155', width=1)

        # Generate step specific image
        if i == 0:
            # Crop Globe over India + FIRMS Points
            c1 = hud_globe.crop((360, 42, 790, 490))
            c1 = c1.resize((img_box_w, img_box_h), Image.Resampling.LANCZOS)
            canvas.paste(c1, (img_box_x, img_box_y))
            
            # Add an overlay tag in the corner of image
            overlay_w, overlay_h = 240, 44
            draw.rounded_rectangle([(img_box_x + 12, img_box_y + 12), (img_box_x + 12 + overlay_w, img_box_y + 12 + overlay_h)], radius=6, fill='#0B1528', outline='#38BDF8', width=1)
            draw.text((img_box_x + 22, img_box_y + 24), "NASA FIRMS (VIIRS/MODIS)", font=font_badge, fill='#38BDF8')

        elif i == 1:
            # Composite Step 2: Top filter bar + Target acquired info card + CAMEO card
            step2_img = Image.new('RGB', (img_box_w, img_box_h), color='#08101E')
            s2_draw = ImageDraw.Draw(step2_img)
            
            # Crop Segregation Bar
            bar_crop = hud_globe.crop((262, 10, 735, 62)) # Bar
            bar_w = img_box_w - 24
            bar_h = int(bar_crop.height * (bar_w / bar_crop.width))
            bar_crop = bar_crop.resize((bar_w, bar_h), Image.Resampling.LANCZOS)
            step2_img.paste(bar_crop, (12, 24))
            
            s2_draw.text((16, 95), "ACTIVE HIERARCHICAL SEGREGATION", font=font_badge, fill='#F59E0B')

            # Crop Target Acquired Card
            target_crop = hud_globe.crop((12, 85, 335, 215))
            target_w = img_box_w - 24
            target_h = int(target_crop.height * (target_w / target_crop.width))
            target_crop = target_crop.resize((target_w, target_h), Image.Resampling.LANCZOS)
            step2_img.paste(target_crop, (12, 130))

            # Crop HazMat card from right side of hud_globe
            haz_crop = hud_globe.crop((748, 85, 985, 335))
            haz_w = img_box_w - 24
            haz_h = int(haz_crop.height * (haz_w / haz_crop.width))
            haz_crop = haz_crop.resize((haz_w, haz_h), Image.Resampling.LANCZOS)
            step2_img.paste(haz_crop, (12, 140 + target_h))

            canvas.paste(step2_img, (img_box_x, img_box_y))

        elif i == 2:
            # Step 3: Top-Down Plume Image with Concentric Hazard Rings
            c3 = plume_img.crop((150, 100, 874, 824))
            c3 = c3.resize((img_box_w, img_box_h), Image.Resampling.LANCZOS)
            canvas.paste(c3, (img_box_x, img_box_y))
            
            # Badge overlay
            draw.rounded_rectangle([(img_box_x + 12, img_box_y + 12), (img_box_x + 280, img_box_y + 56)], radius=6, fill='#0B1528', outline='#A855F7', width=1)
            draw.text((img_box_x + 22, img_box_y + 24), "GAUSSIAN DISPERSION MODEL", font=font_badge, fill='#C084FC')

        elif i == 3:
            # Step 4: Sanitized Tactical Dispatch Modal
            c4 = dispatch_img.crop((70, 50, 930, 970))
            c4 = c4.resize((img_box_w, img_box_h), Image.Resampling.LANCZOS)
            canvas.paste(c4, (img_box_x, img_box_y))

        # Bottom Bullets under Image
        text_y = img_box_y + img_box_h + 16
        draw.text((cx + 20, text_y), s["bullet1"], font=font_body, fill='#CBD5E1')
        draw.text((cx + 20, text_y + 28), s["bullet2"], font=font_body, fill='#94A3B8')

        # Connecting Chevron Arrows between cards
        if i < num_cards - 1:
            arrow_cx = cx + card_w + (card_spacing // 2)
            arrow_cy = card_y + (card_h // 2)
            draw.line([(arrow_cx - 8, arrow_cy - 16), (arrow_cx + 8, arrow_cy)], fill='#38BDF8', width=4)
            draw.line([(arrow_cx + 8, arrow_cy), (arrow_cx - 8, arrow_cy + 16)], fill='#38BDF8', width=4)

    # Save Composite Image
    output_path = "pyrosat_methodology_live_halfpage.png"
    canvas.save(output_path, quality=95)
    print(f"Generated: {output_path} successfully ({W}x{H})")

if __name__ == "__main__":
    create_halfpage_methodology()
