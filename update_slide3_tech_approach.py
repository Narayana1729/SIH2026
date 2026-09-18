import pptx
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN
from pptx.enum.shapes import MSO_SHAPE

for filename in ['SIH2026-IDEA-Presentation-Format.pptx', 'SIH2026_PyroSat_Submission.pptx']:
    prs = Presentation(filename)
    slide3 = prs.slides[2]

    # 1. Clean dynamic shapes on slide 3
    shapes_to_delete = []
    for s in slide3.shapes:
        if s.name in ["Rectangle 9", "Slide Number Placeholder 5", "Footer Placeholder 6", "Oval 10", "Picture 11"]:
            continue
        if s.name == "Title 1":
            continue
        shapes_to_delete.append(s)

    for s in shapes_to_delete:
        sp = s._element
        sp.getparent().remove(sp)

    # 2. Fix Oval
    for s in slide3.shapes:
        if s.name == "Oval 10" and s.has_text_frame:
            s.text_frame.clear()
            s.text_frame.margin_left = s.text_frame.margin_right = 0
            p = s.text_frame.paragraphs[0]
            p.text = "Thinkers"
            p.alignment = PP_ALIGN.CENTER
            p.font.name = "Arial"
            p.font.size = Pt(11)
            p.font.bold = True
            p.font.color.rgb = RGBColor(0, 0, 0)

    # 3. Title
    for s in slide3.shapes:
        if s.name == "Title 1" and s.has_text_frame:
            s.text_frame.clear()
            p = s.text_frame.paragraphs[0]
            p.text = "TECHNICAL APPROACH"
            p.alignment = PP_ALIGN.CENTER
            p.font.name = "Times New Roman"
            p.font.size = Pt(18)
            p.font.bold = True
            p.font.color.rgb = RGBColor(0, 0, 0)
            s.left = Inches(1.8)
            s.top = Inches(0.12)
            s.width = Inches(8.8)
            s.height = Inches(1.0)

    DARK_BLUE = RGBColor(43, 91, 132)     # #2b5b84
    HEADER_LINE = RGBColor(70, 130, 180)
    LINE_GRAY = RGBColor(190, 200, 210)
    TEXT_BLACK = RGBColor(35, 35, 35)
    BOLD_BLACK = RGBColor(0, 0, 0)
    BOX_BG = RGBColor(245, 248, 252)
    BOX_BORDER = RGBColor(180, 205, 230)
    CARD_BG = RGBColor(225, 238, 250)      # Light blue shaded box like reference
    CARD_BORDER = RGBColor(147, 197, 253)
    RED_BOLD = RGBColor(220, 38, 38)

    # Header underline
    l_top = slide3.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0.28), Inches(1.18), Inches(12.75), Inches(0.02))
    l_top.fill.solid(); l_top.fill.fore_color.rgb = HEADER_LINE; l_top.line.fill.background()

    # Vertical divider line separating Left & Right (dashed look via thin solid line)
    v_line = slide3.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(3.60), Inches(1.22), Inches(0.015), Inches(5.45))
    v_line.fill.solid(); v_line.fill.fore_color.rgb = LINE_GRAY; v_line.line.fill.background()

    # Horizontal divider line in right column
    h_line = slide3.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(3.60), Inches(4.55), Inches(9.43), Inches(0.015))
    h_line.fill.solid(); h_line.fill.fore_color.rgb = LINE_GRAY; h_line.line.fill.background()

    # -------------------------------------------------------------
    # LEFT COLUMN: Hardware & Software (Width = 3.25 in)
    # -------------------------------------------------------------
    tb_left = slide3.shapes.add_textbox(Inches(0.35), Inches(1.24), Inches(3.20), Inches(5.40))
    tf_left = tb_left.text_frame
    tf_left.word_wrap = True
    tf_left.margin_left = tf_left.margin_right = tf_left.margin_top = tf_left.margin_bottom = 0

    p_hl = tf_left.paragraphs[0]
    p_hl.text = "Hardware & Software"
    p_hl.font.name = "Arial"
    p_hl.font.size = Pt(12)
    p_hl.font.bold = True
    p_hl.font.color.rgb = BOLD_BLACK
    p_hl.space_after = Pt(5)

    specs = [
        ("• ", "NASA FIRMS Telemetry:", " VIIRS (375m) & MODIS (1km) dual-band NRT infrared radiance."),
        ("• ", "Sentinel-2 & ESA LULC:", " 10m land-cover & Level-2A surface reflectance (NDVI/SWIR)."),
        ("• ", "SciPy (Planck Pyrometry):", " Dual-band Dozier inversion solving flame temp & area."),
        ("• ", "LightGBM & TreeSHAP:", " 2-stage hierarchical ML classifier with exact local Shapley XAI."),
        ("• ", "CesiumJS (WebGL 3D):", " Virtual 3D globe rendering terrain, 3D tiles & hazard layers."),
        ("• ", "Open-Meteo & Plume Model:", " Pasquill-Gifford dispersion with live wind vectors."),
        ("• ", "FastAPI & Node.js Gateway:", " Sub-second REST inference API & SSE real-time alerting."),
        ("• ", "PostGIS Spatial Database:", " Industrial infrastructure & boundary threat engine.")
    ]

    for bullet_symbol, bold_lead, desc in specs:
        p = tf_left.add_paragraph()
        p.space_after = Pt(5.5)
        p.line_spacing = 1.12
        r = p.add_run(); r.text = bullet_symbol; r.font.name = "Arial"; r.font.size = Pt(8.5); r.font.color.rgb = TEXT_BLACK
        r = p.add_run(); r.text = bold_lead; r.font.name = "Arial"; r.font.size = Pt(8.5); r.font.bold = True; r.font.color.rgb = BOLD_BLACK
        r = p.add_run(); r.text = desc; r.font.name = "Arial"; r.font.size = Pt(8.5); r.font.color.rgb = TEXT_BLACK

    # -------------------------------------------------------------
    # RIGHT COLUMN - TOP: FLOW CHART
    # -------------------------------------------------------------
    # Header
    tb_fc = slide3.shapes.add_textbox(Inches(3.80), Inches(1.24), Inches(2.5), Inches(0.4))
    tf_fc = tb_fc.text_frame; tf_fc.margin_left = tf_fc.margin_right = tf_fc.margin_top = tf_fc.margin_bottom = 0
    p_fc = tf_fc.paragraphs[0]
    p_fc.text = "FLOW CHART"
    p_fc.font.name = "Arial"
    p_fc.font.size = Pt(12)
    p_fc.font.bold = True
    p_fc.font.underline = True
    p_fc.font.color.rgb = DARK_BLUE

    # Placeholder Box for Flowchart
    box_fc = slide3.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(3.80), Inches(1.60), Inches(9.10), Inches(2.80))
    box_fc.fill.solid(); box_fc.fill.fore_color.rgb = BOX_BG
    box_fc.line.color.rgb = BOX_BORDER; box_fc.line.width = Pt(1.5)
    tf_box = box_fc.text_frame
    tf_box.word_wrap = True
    p_box = tf_box.paragraphs[0]
    p_box.alignment = PP_ALIGN.CENTER
    p_box.text = "\n[ INSERT SYSTEM ARCHITECTURE / INGESTION-TO-DISPATCH FLOWCHART IMAGE HERE ]"
    p_box.font.name = "Arial"; p_box.font.size = Pt(11); p_box.font.bold = True; p_box.font.color.rgb = RGBColor(100, 116, 139)
    p_sub = tf_box.add_paragraph()
    p_sub.alignment = PP_ALIGN.CENTER
    p_sub.text = "(NASA FIRMS ➔ Dozier Planck Inversion ➔ 2-Stage ML Classifier ➔ TreeSHAP ➔ Gaussian Plume ➔ IAP Dispatch)"
    p_sub.font.name = "Arial"; p_sub.font.size = Pt(9.5); p_sub.font.color.rgb = RGBColor(148, 163, 184)

    # -------------------------------------------------------------
    # RIGHT COLUMN - BOTTOM: 3 LAYER APPROACH & GITHUB INFO CARD
    # -------------------------------------------------------------
    # Sub-heading for 3-Layer Approach
    tb_3l = slide3.shapes.add_textbox(Inches(3.80), Inches(4.62), Inches(3.5), Inches(0.35))
    tf_3l = tb_3l.text_frame; tf_3l.margin_left = tf_3l.margin_right = tf_3l.margin_top = tf_3l.margin_bottom = 0
    p_3l = tf_3l.paragraphs[0]
    p_3l.text = "3 LAYER APPROACH"
    p_3l.font.name = "Arial"
    p_3l.font.size = Pt(11)
    p_3l.font.bold = True
    p_3l.font.underline = True
    p_3l.font.color.rgb = DARK_BLUE

    # Placeholder Box for 3-Layer Approach Image
    box_3l = slide3.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(3.80), Inches(4.95), Inches(3.90), Inches(1.70))
    box_3l.fill.solid(); box_3l.fill.fore_color.rgb = BOX_BG
    box_3l.line.color.rgb = BOX_BORDER; box_3l.line.width = Pt(1.5)
    tf_3lb = box_3l.text_frame
    tf_3lb.word_wrap = True
    p_3lb = tf_3lb.paragraphs[0]
    p_3lb.alignment = PP_ALIGN.CENTER
    p_3lb.text = "\n[ INSERT 3-LAYER ARCHITECTURE MOCKUP ]"
    p_3lb.font.name = "Arial"; p_3lb.font.size = Pt(10); p_3lb.font.bold = True; p_3lb.font.color.rgb = RGBColor(100, 116, 139)
    p_3ls = tf_3lb.add_paragraph()
    p_3ls.alignment = PP_ALIGN.CENTER
    p_3ls.text = "L1: Sensing ➔ L2: Physics/ML ➔ L3: Dispatch"
    p_3ls.font.name = "Arial"; p_3ls.font.size = Pt(8.5); p_3ls.font.color.rgb = RGBColor(148, 163, 184)

    # Right Card: GitHub Link & Status (Matching the reference blue shaded box!)
    card = slide3.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(7.90), Inches(4.75), Inches(5.00), Inches(1.90))
    card.fill.solid(); card.fill.fore_color.rgb = CARD_BG
    card.line.color.rgb = CARD_BORDER; card.line.width = Pt(1.5)
    tf_card = card.text_frame
    tf_card.word_wrap = True
    tf_card.margin_left = tf_card.margin_right = tf_card.margin_top = tf_card.margin_bottom = Inches(0.12)

    p_c1 = tf_card.paragraphs[0]
    p_c1.space_after = Pt(3)
    r = p_c1.add_run(); r.text = "GitHub link: "; r.font.name = "Arial"; r.font.size = Pt(11); r.font.bold = True; r.font.color.rgb = BOLD_BLACK
    r = p_c1.add_run(); r.text = "https://github.com/Narayana1729/SIH2026.git"; r.font.name = "Arial"; r.font.size = Pt(10.5); r.font.underline = True; r.font.color.rgb = RGBColor(29, 78, 216)

    p_c2 = tf_card.add_paragraph()
    p_c2.space_after = Pt(10)
    r = p_c2.add_run(); r.text = "Live Dashboard: "; r.font.name = "Arial"; r.font.size = Pt(11); r.font.bold = True; r.font.color.rgb = BOLD_BLACK
    r = p_c2.add_run(); r.text = "http://localhost:8080 (Cesium 3D WebGL HUD)"; r.font.name = "Arial"; r.font.size = Pt(10); r.font.color.rgb = DARK_BLUE

    p_c3 = tf_card.add_paragraph()
    r = p_c3.add_run(); r.text = "Above 80% of the prototype is completed"; r.font.name = "Arial"; r.font.size = Pt(12.5); r.font.bold = True; r.font.color.rgb = RED_BOLD

    prs.save(filename)
    print(f"Updated Slide 3 (Technical Approach) for {filename} successfully!")
