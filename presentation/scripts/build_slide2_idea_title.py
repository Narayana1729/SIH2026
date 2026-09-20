import os
import pptx
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.shapes import MSO_SHAPE

def find_asset(name):
    script_dir = os.path.dirname(os.path.abspath(__file__))
    candidates = [
        name,
        os.path.join('presentation', 'assets', name),
        os.path.join(script_dir, '..', 'assets', name),
        os.path.join(script_dir, name)
    ]
    for c in candidates:
        if os.path.exists(c):
            return c
    return name

def find_ppt(name):
    script_dir = os.path.dirname(os.path.abspath(__file__))
    candidates = [
        name,
        os.path.join(script_dir, '..', '..', name),
        os.path.join(script_dir, '..', name),
        os.path.join(script_dir, name)
    ]
    for c in candidates:
        if os.path.exists(c):
            return c
    return name

def build_slide2_idea_title():
    DARK_NAVY = RGBColor(15, 23, 42)        # #0F172A
    CARD_DARK = RGBColor(30, 41, 59)        # #1E293B
    BORDER_DARK = RGBColor(51, 65, 85)      # #334155
    AMBER_GOLD = RGBColor(245, 158, 11)     # #F59E0B
    CYAN_BLUE = RGBColor(56, 189, 248)      # #38BDF8
    WHITE = RGBColor(248, 250, 252)         # #F8FAFC
    HEADER_LINE = RGBColor(70, 130, 180)    # Steel blue
    TEXT_MUTED = RGBColor(100, 116, 139)    # #64748B
    TEXT_CHARCOAL = RGBColor(51, 65, 85)    # #334155

    # Rich Risk vs Solution Colors (Matching Image 2)
    RED_BG = RGBColor(254, 242, 242)        # #FEF2F2
    RED_BORDER = RGBColor(254, 205, 211)    # #FECDD3
    RED_TITLE = RGBColor(153, 27, 27)       # #991B1B
    RED_BADGE = RGBColor(225, 29, 72)       # #E11D48

    GREEN_BG = RGBColor(240, 253, 244)      # #F0FDF4
    GREEN_BORDER = RGBColor(187, 247, 208)  # #BBF7D0
    GREEN_TITLE = RGBColor(22, 101, 52)     # #166534
    GREEN_BADGE = RGBColor(22, 163, 74)     # #16A34A

    for ppt_base in ['SIH2026_PyroSat_Submission.pptx', 'SIH2026-IDEA-Presentation-Format.pptx']:
        ppt_path = find_ppt(ppt_base)
        if not os.path.exists(ppt_path):
            continue
        prs = Presentation(ppt_path)
        slide2 = prs.slides[1]

        # 1. Clean previous content shapes (preserve template header elements)
        shapes_to_delete = []
        for s in slide2.shapes:
            if s.name in ["Rectangle 8", "Slide Number Placeholder 5", "Footer Placeholder 6", "Oval 9", "Picture 10"]:
                continue
            shapes_to_delete.append(s)

        for s in shapes_to_delete:
            sp = s._element
            sp.getparent().remove(sp)

        # 2. Header Section: Idea Title & Tagline
        tb_title = slide2.shapes.add_textbox(Inches(1.8), Inches(0.10), Inches(8.8), Inches(1.02))
        tf_title = tb_title.text_frame
        tf_title.word_wrap = True
        tf_title.margin_top = tf_title.margin_bottom = tf_title.margin_left = tf_title.margin_right = 0
        
        p_title1 = tf_title.paragraphs[0]
        p_title1.text = "PyroSat: AI-Powered Satellite Thermal Intelligence"
        p_title1.alignment = PP_ALIGN.CENTER
        p_title1.font.name = "Arial"
        p_title1.font.size = Pt(17)
        p_title1.font.bold = True
        p_title1.font.color.rgb = DARK_NAVY
        p_title1.space_after = Pt(2)

        p_title2 = tf_title.add_paragraph()
        p_title2.text = "Precision Sub-Pixel Pyrometry, Industrial Fire Segregation & Real-Time Toxic Plume Defense for India"
        p_title2.alignment = PP_ALIGN.CENTER
        p_title2.font.name = "Arial"
        p_title2.font.size = Pt(9.5)
        p_title2.font.bold = True
        p_title2.font.color.rgb = RGBColor(71, 85, 105)

        # Underline divider under header
        l_top = slide2.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0.38), Inches(1.18), Inches(12.56), Inches(0.02))
        l_top.fill.solid(); l_top.fill.fore_color.rgb = HEADER_LINE; l_top.line.fill.background()

        # ---------------------------------------------------------------------
        # 3. LEFT COLUMN: 3 High-Impact Cards + Working Prototype Badge
        # ---------------------------------------------------------------------
        left_x = Inches(0.38)
        left_w = Inches(3.68)
        card_start_y = Inches(1.26)

        left_cards_data = [
            {
                "tag": "Real-World Issue:",
                "tag_color": AMBER_GOLD,
                "text": "Coarse 375m satellite thermal pixels cannot distinguish routine industrial flaring from runaway chemical explosions or crop stubble, causing severe operational blindness.",
                "h": Inches(1.16)
            },
            {
                "tag": "Why Important:",
                "tag_color": AMBER_GOLD,
                "text": "India houses 2,000+ Major Accident Hazard (MAH) chemical plants near dense cities. Delayed alerts risk thousands of lives and ₹10,000+ Cr in damages annually.",
                "h": Inches(1.16)
            },
            {
                "tag": "Proposed Solution:",
                "tag_color": CYAN_BLUE,
                "text": "PyroSat calculates exact sub-pixel flame temperature (Tf > 1100 K) via Planck pyrometry, eliminates false alarms with 10m ESA ground truth, and projects live 3D evacuation zones.",
                "h": Inches(1.22)
            }
        ]

        curr_y = card_start_y
        for c in left_cards_data:
            card_bg = slide2.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left_x, curr_y, left_w, c["h"])
            card_bg.fill.solid(); card_bg.fill.fore_color.rgb = CARD_DARK
            card_bg.line.color.rgb = BORDER_DARK
            card_bg.line.width = Pt(1)

            tb_c = slide2.shapes.add_textbox(left_x + Inches(0.12), curr_y + Inches(0.08), left_w - Inches(0.24), c["h"] - Inches(0.14))
            tf_c = tb_c.text_frame
            tf_c.word_wrap = True
            tf_c.margin_left = tf_c.margin_right = tf_c.margin_top = tf_c.margin_bottom = 0

            p_t = tf_c.paragraphs[0]
            p_t.text = c["tag"]
            p_t.font.name = "Arial"
            p_t.font.size = Pt(9.5)
            p_t.font.bold = True
            p_t.font.color.rgb = c["tag_color"]
            p_t.space_after = Pt(2)

            p_b = tf_c.add_paragraph()
            p_b.text = c["text"]
            p_b.font.name = "Arial"
            p_b.font.size = Pt(7.8)
            p_b.font.color.rgb = WHITE

            curr_y += c["h"] + Inches(0.11)

        # Working Prototype Callout Card
        proto_h = Inches(1.58)
        proto_bg = slide2.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left_x, curr_y, left_w, proto_h)
        proto_bg.fill.solid(); proto_bg.fill.fore_color.rgb = RGBColor(240, 249, 255)
        proto_bg.line.color.rgb = RGBColor(186, 230, 253)
        proto_bg.line.width = Pt(1.2)

        tb_proto = slide2.shapes.add_textbox(left_x + Inches(0.14), curr_y + Inches(0.08), left_w - Inches(0.28), proto_h - Inches(0.14))
        tf_proto = tb_proto.text_frame
        tf_proto.word_wrap = True
        tf_proto.margin_left = tf_proto.margin_right = tf_proto.margin_top = tf_proto.margin_bottom = 0

        p_ph = tf_proto.paragraphs[0]
        p_ph.text = "⚡ Working Prototype & Live Links:"
        p_ph.font.name = "Arial"
        p_ph.font.size = Pt(9)
        p_ph.font.bold = True
        p_ph.font.color.rgb = RGBColor(3, 105, 161)
        p_ph.space_after = Pt(3)

        p_pl1 = tf_proto.add_paragraph()
        r_pl1 = p_pl1.add_run()
        r_pl1.text = "🔗 Live Cloud Platform: sri-pyrosat.onrender.com"
        r_pl1.hyperlink.address = "https://sri-pyrosat.onrender.com"
        r_pl1.font.name = "Arial"
        r_pl1.font.size = Pt(7.8)
        r_pl1.font.bold = True
        r_pl1.font.underline = True
        r_pl1.font.color.rgb = RGBColor(2, 132, 199)
        p_pl1.space_after = Pt(3)

        p_pl2 = tf_proto.add_paragraph()
        r_pl2 = p_pl2.add_run()
        r_pl2.text = "🔗 Technical Defense & Benchmark Replay: GROUND_TRUTH_DEFENSE"
        r_pl2.font.name = "Arial"
        r_pl2.font.size = Pt(7.5)
        r_pl2.font.color.rgb = RGBColor(71, 85, 105)

        # ---------------------------------------------------------------------
        # 4. CENTER COLUMN: 3D 4-Layer Orbital-to-Ground Architecture Image
        # ---------------------------------------------------------------------
        center_x = Inches(4.22)
        center_w = Inches(4.88)

        tb_ctitle = slide2.shapes.add_textbox(center_x, Inches(1.22), center_w, Inches(0.26))
        tf_ctitle = tb_ctitle.text_frame
        tf_ctitle.margin_left = tf_ctitle.margin_right = tf_ctitle.margin_top = tf_ctitle.margin_bottom = 0
        p_ct = tf_ctitle.paragraphs[0]
        p_ct.text = "PROPOSED SOLUTION: 4-LAYER ORBITAL-TO-GROUND ARCHITECTURE"
        p_ct.alignment = PP_ALIGN.CENTER
        p_ct.font.name = "Arial"
        p_ct.font.size = Pt(8.8)
        p_ct.font.bold = True
        p_ct.font.color.rgb = RGBColor(30, 58, 138)

        hero_img = find_asset("orbital_to_ground_4layers.jpg")
        img_top = Inches(1.48)
        img_w = Inches(4.88)
        img_h = Inches(4.23)

        if os.path.exists(hero_img):
            slide2.shapes.add_picture(hero_img, center_x, img_top, width=img_w, height=img_h)

        cap_y = img_top + img_h + Inches(0.06)
        cap_h = Inches(0.96)
        cap_bg = slide2.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, center_x, cap_y, center_w, cap_h)
        cap_bg.fill.solid(); cap_bg.fill.fore_color.rgb = RGBColor(248, 250, 252)
        cap_bg.line.color.rgb = RGBColor(203, 213, 225)
        cap_bg.line.width = Pt(1)

        tb_cap = slide2.shapes.add_textbox(center_x + Inches(0.12), cap_y + Inches(0.06), center_w - Inches(0.24), cap_h - Inches(0.12))
        tf_cap = tb_cap.text_frame
        tf_cap.word_wrap = True
        tf_cap.margin_left = tf_cap.margin_right = tf_cap.margin_top = tf_cap.margin_bottom = 0

        p_cp1 = tf_cap.paragraphs[0]
        p_cp1.text = "⚡ Full-Stack Orbital Intelligence Pipeline:"
        p_cp1.font.name = "Arial"
        p_cp1.font.size = Pt(8.5)
        p_cp1.font.bold = True
        p_cp1.font.color.rgb = RGBColor(30, 58, 138)
        p_cp1.space_after = Pt(2)

        p_cp2 = tf_cap.add_paragraph()
        p_cp2.text = "Space Telemetry (VIIRS) ➔ Sub-Pixel Planck Pyrometry (Tf > 1100K) ➔ 10m ESA Land-Cover Ground Truth ➔ 3D Gaussian Plume Evacuation & NDRF Dispatch."
        p_cp2.font.name = "Arial"
        p_cp2.font.size = Pt(7.3)
        p_cp2.font.color.rgb = TEXT_CHARCOAL

        # ---------------------------------------------------------------------
        # 5. RIGHT COLUMN: Rich Illustrated Risk vs Solution Cards (Matching Image 2)
        # ---------------------------------------------------------------------
        right_x = Inches(9.26)
        right_w = Inches(3.70)

        # Title for right column
        tb_rtitle = slide2.shapes.add_textbox(right_x, Inches(1.22), right_w, Inches(0.26))
        tf_rtitle = tb_rtitle.text_frame
        tf_rtitle.margin_left = tf_rtitle.margin_right = tf_rtitle.margin_top = tf_rtitle.margin_bottom = 0
        p_rt = tf_rtitle.paragraphs[0]
        p_rt.text = "CRITICAL RISK   vs   PYROSAT SOLUTION"
        p_rt.alignment = PP_ALIGN.CENTER
        p_rt.font.name = "Arial"
        p_rt.font.size = Pt(8.8)
        p_rt.font.bold = True
        p_rt.font.color.rgb = RGBColor(153, 27, 27)

        # 4 Illustrated Comparison Rows
        cards_pairs = [
            {
                "num": "01",
                "risk_title": "Coarse 375m Pixels",
                "risk_desc": "Thermal hotspots blurred over large areas, hiding true fire temp & size.",
                "risk_img": find_asset("thumb_risk_1.png"),
                "sol_title": "Sub-Pixel Planck (Tf, Af)",
                "sol_desc": "Dual-band IR physics extracts flame temp (Tf > 1100 K) & exact burning area.",
                "sol_img": find_asset("thumb_sol_1.png"),
            },
            {
                "num": "02",
                "risk_title": "Routine Flares False Alarms",
                "risk_desc": "Normal industrial flaring and persistent heat sources trigger false alarms.",
                "risk_img": find_asset("thumb_risk_2.png"),
                "sol_title": "2-Stage ML Shield",
                "sol_desc": "10m ESA Sentinel-1/2 & 2,000+ plant database filter routine flaring.",
                "sol_img": find_asset("thumb_sol_2.png"),
            },
            {
                "num": "03",
                "risk_title": "Blind Toxic Gas Spread",
                "risk_desc": "No prediction of how poisonous gas drifts, putting communities in path of cloud.",
                "risk_img": find_asset("thumb_risk_3.png"),
                "sol_title": "3D Gaussian Plume Rings",
                "sol_desc": "Live wind vectors & dispersion equations project 3D Red/Yellow/Green hazard zones.",
                "sol_img": find_asset("thumb_sol_3.png"),
            },
            {
                "num": "04",
                "risk_title": "Delayed Agency Response",
                "risk_desc": "Information shared late via calls, slowing down response & increasing impact.",
                "risk_img": find_asset("thumb_risk_4.png"),
                "sol_title": "1-Click Automated IAP",
                "sol_desc": "Automated Incident Action Plan with location alerts & WhatsApp dispatch.",
                "sol_img": find_asset("thumb_sol_4.png"),
            }
        ]

        curr_card_y = Inches(1.50)
        card_h = Inches(1.23)
        col_w = Inches(1.72)
        arrow_w = Inches(0.24)

        for pair in cards_pairs:
            # === LEFT: RED RISK CARD ===
            r_box = slide2.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, right_x, curr_card_y, col_w, card_h)
            r_box.fill.solid(); r_box.fill.fore_color.rgb = RED_BG
            r_box.line.color.rgb = RED_BORDER
            r_box.line.width = Pt(1)

            # Risk Thumbnail
            if os.path.exists(pair["risk_img"]):
                slide2.shapes.add_picture(pair["risk_img"], right_x + Inches(0.06), curr_card_y + Inches(0.06), width=Inches(0.44), height=Inches(0.32))

            # Risk Header with Badge
            tb_rh = slide2.shapes.add_textbox(right_x + Inches(0.53), curr_card_y + Inches(0.04), col_w - Inches(0.56), Inches(0.38))
            tf_rh = tb_rh.text_frame; tf_rh.word_wrap = True; tf_rh.margin_left = tf_rh.margin_right = tf_rh.margin_top = tf_rh.margin_bottom = 0
            p_rh = tf_rh.paragraphs[0]
            p_rh.text = f"{pair['num']}  {pair['risk_title']}"
            p_rh.font.name = "Arial"
            p_rh.font.size = Pt(7.2)
            p_rh.font.bold = True
            p_rh.font.color.rgb = RED_TITLE

            # Risk Description
            tb_rd = slide2.shapes.add_textbox(right_x + Inches(0.06), curr_card_y + Inches(0.42), col_w - Inches(0.12), card_h - Inches(0.46))
            tf_rd = tb_rd.text_frame; tf_rd.word_wrap = True; tf_rd.margin_left = tf_rd.margin_right = tf_rd.margin_top = tf_rd.margin_bottom = 0
            p_rd = tf_rd.paragraphs[0]
            p_rd.text = pair["risk_desc"]
            p_rd.font.name = "Arial"
            p_rd.font.size = Pt(6.4)
            p_rd.font.color.rgb = RGBColor(75, 85, 99)

            # === MIDDLE: CONNECTING ARROW ===
            tb_arr = slide2.shapes.add_textbox(right_x + col_w, curr_card_y + Inches(0.42), arrow_w, Inches(0.30))
            tf_arr = tb_arr.text_frame; tf_arr.margin_left = tf_arr.margin_right = tf_arr.margin_top = tf_arr.margin_bottom = 0
            p_arr = tf_arr.paragraphs[0]
            p_arr.text = "➔"
            p_arr.alignment = PP_ALIGN.CENTER
            p_arr.font.name = "Arial"
            p_arr.font.size = Pt(11)
            p_arr.font.bold = True
            p_arr.font.color.rgb = TEXT_MUTED

            # === RIGHT: GREEN SOLUTION CARD ===
            sol_x = right_x + col_w + arrow_w
            s_box = slide2.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, sol_x, curr_card_y, col_w, card_h)
            s_box.fill.solid(); s_box.fill.fore_color.rgb = GREEN_BG
            s_box.line.color.rgb = GREEN_BORDER
            s_box.line.width = Pt(1)

            # Solution Thumbnail
            if os.path.exists(pair["sol_img"]):
                slide2.shapes.add_picture(pair["sol_img"], sol_x + Inches(0.06), curr_card_y + Inches(0.06), width=Inches(0.44), height=Inches(0.32))

            # Solution Header with Badge
            tb_sh = slide2.shapes.add_textbox(sol_x + Inches(0.53), curr_card_y + Inches(0.04), col_w - Inches(0.56), Inches(0.38))
            tf_sh = tb_sh.text_frame; tf_sh.word_wrap = True; tf_sh.margin_left = tf_sh.margin_right = tf_sh.margin_top = tf_sh.margin_bottom = 0
            p_sh = tf_sh.paragraphs[0]
            p_sh.text = f"{pair['num']}  {pair['sol_title']}"
            p_sh.font.name = "Arial"
            p_sh.font.size = Pt(7.2)
            p_sh.font.bold = True
            p_sh.font.color.rgb = GREEN_TITLE

            # Solution Description
            tb_sd = slide2.shapes.add_textbox(sol_x + Inches(0.06), curr_card_y + Inches(0.42), col_w - Inches(0.12), card_h - Inches(0.46))
            tf_sd = tb_sd.text_frame; tf_sd.word_wrap = True; tf_sd.margin_left = tf_sd.margin_right = tf_sd.margin_top = tf_sd.margin_bottom = 0
            p_sd = tf_sd.paragraphs[0]
            p_sd.text = pair["sol_desc"]
            p_sd.font.name = "Arial"
            p_sd.font.size = Pt(6.4)
            p_sd.font.color.rgb = RGBColor(55, 65, 81)

            curr_card_y += card_h + Inches(0.08)

        prs.save(ppt_path)
        print(f"Successfully updated Slide 2 in {ppt_path} with Illustrated Risk vs Solution Cards!")

if __name__ == '__main__':
    build_slide2_idea_title()
