import pptx
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN
from pptx.enum.shapes import MSO_SHAPE

for filename in ['SIH2026-IDEA-Presentation-Format.pptx', 'SIH2026_PyroSat_Submission.pptx']:
    prs = Presentation(filename)
    slide2 = prs.slides[1]

    # 1. Keep only original template shapes: delete all dynamically added textboxes/rectangles
    # Original template shapes on slide 2: Title, Oval, Picture (SIH logo), Footer, Slide Number, bottom blue bar
    shapes_to_delete = []
    for s in slide2.shapes:
        # Keep essential template items
        if s.name in ["Rectangle 8", "Slide Number Placeholder 5", "Footer Placeholder 6", "Oval 9", "Picture 10"]:
            continue
        if s.name == "Title 1":
            continue
        shapes_to_delete.append(s)

    for s in shapes_to_delete:
        sp = s._element
        sp.getparent().remove(sp)

    # 2. Fix Oval: ensure "Thinkers" fits on ONE line (11.5 pt font)
    for s in slide2.shapes:
        if s.name == "Oval 9" and s.has_text_frame:
            s.text_frame.clear()
            s.text_frame.margin_left = s.text_frame.margin_right = 0
            p = s.text_frame.paragraphs[0]
            p.text = "Thinkers"
            p.alignment = PP_ALIGN.CENTER
            p.font.name = "Arial"
            p.font.size = Pt(11)
            p.font.bold = True
            p.font.color.rgb = RGBColor(0, 0, 0)

    # 3. Clean & set Title
    for s in slide2.shapes:
        if s.name == "Title 1" and s.has_text_frame:
            s.text_frame.clear()
            p = s.text_frame.paragraphs[0]
            p.text = "PyroSat: AI-Powered Satellite Thermal Anomaly & Sub-Pixel Inversion\nPlatform for Industrial Fire and Disaster Mitigation"
            p.alignment = PP_ALIGN.CENTER
            p.font.name = "Times New Roman"
            p.font.size = Pt(16.5)
            p.font.bold = True
            p.font.color.rgb = RGBColor(0, 0, 0)
            s.left = Inches(1.8)
            s.top = Inches(0.12)
            s.width = Inches(8.8)
            s.height = Inches(1.0)

    DARK_BLUE = RGBColor(43, 91, 132)
    HEADER_LINE = RGBColor(70, 130, 180)
    LINE_GRAY = RGBColor(185, 195, 205)
    TEXT_BLACK = RGBColor(35, 35, 35)
    BOLD_BLACK = RGBColor(0, 0, 0)

    # 4. Draw ONE set of divider lines
    # Top header line
    l_top = slide2.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0.28), Inches(1.18), Inches(12.75), Inches(0.02))
    l_top.fill.solid(); l_top.fill.fore_color.rgb = HEADER_LINE; l_top.line.fill.background()

    # Mid horizontal line
    l_mid = slide2.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0.28), Inches(2.68), Inches(12.75), Inches(0.015))
    l_mid.fill.solid(); l_mid.fill.fore_color.rgb = LINE_GRAY; l_mid.line.fill.background()

    # Top vertical divider between Problem & Our Idea
    l_vtop = slide2.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(5.95), Inches(1.22), Inches(0.015), Inches(1.42))
    l_vtop.fill.solid(); l_vtop.fill.fore_color.rgb = LINE_GRAY; l_vtop.line.fill.background()

    # 5. Top-Left: Problem (SINGLE clean textbox)
    tb_prob = slide2.shapes.add_textbox(Inches(0.38), Inches(1.25), Inches(5.40), Inches(1.35))
    tf_prob = tb_prob.text_frame
    tf_prob.word_wrap = True
    tf_prob.margin_left = tf_prob.margin_right = tf_prob.margin_top = tf_prob.margin_bottom = 0

    p_hp = tf_prob.paragraphs[0]
    p_hp.text = "Problem:"
    p_hp.font.name = "Arial"
    p_hp.font.size = Pt(12.5)
    p_hp.font.bold = True
    p_hp.font.underline = True
    p_hp.font.color.rgb = DARK_BLUE
    p_hp.space_after = Pt(4)

    p_bp = tf_prob.add_paragraph()
    p_bp.line_spacing = 1.15
    r = p_bp.add_run(); r.text = "NASA FIRMS satellites detect heat, but "
    r.font.name = "Arial"; r.font.size = Pt(10); r.font.color.rgb = TEXT_BLACK
    r = p_bp.add_run(); r.text = "cannot tell what is burning."
    r.font.name = "Arial"; r.font.size = Pt(10); r.font.bold = True; r.font.color.rgb = BOLD_BLACK
    r = p_bp.add_run(); r.text = " Coarse 375m pixels mix routine refinery flares with runaway chemical explosions and wildfires. In industrial corridors, this causes "
    r.font.name = "Arial"; r.font.size = Pt(10); r.font.color.rgb = TEXT_BLACK
    r = p_bp.add_run(); r.text = "heavy false alarms, putting critical infrastructure and lives at risk."
    r.font.name = "Arial"; r.font.size = Pt(10); r.font.bold = True; r.font.color.rgb = BOLD_BLACK

    # 6. Top-Right: Our Idea (SINGLE clean textbox)
    tb_idea = slide2.shapes.add_textbox(Inches(6.15), Inches(1.25), Inches(6.80), Inches(1.35))
    tf_idea = tb_idea.text_frame
    tf_idea.word_wrap = True
    tf_idea.margin_left = tf_idea.margin_right = tf_idea.margin_top = tf_idea.margin_bottom = 0

    p_hi = tf_idea.paragraphs[0]
    p_hi.text = "Our Idea :"
    p_hi.font.name = "Arial"
    p_hi.font.size = Pt(12.5)
    p_hi.font.bold = True
    p_hi.font.underline = True
    p_hi.font.color.rgb = DARK_BLUE
    p_hi.space_after = Pt(4)

    p_bi = tf_idea.add_paragraph()
    p_bi.line_spacing = 1.15
    r = p_bi.add_run(); r.text = "PyroSat is an AI-powered platform with a three-pillar approach "
    r.font.name = "Arial"; r.font.size = Pt(10); r.font.bold = True; r.font.color.rgb = BOLD_BLACK
    r = p_bi.add_run(); r.text = "ensuring automated disaster intelligence when orbital feeds are ambiguous. It combines "
    r.font.name = "Arial"; r.font.size = Pt(10); r.font.color.rgb = TEXT_BLACK
    r = p_bi.add_run(); r.text = "infrared flame physics, hierarchical ML, and 3D GIS maps "
    r.font.name = "Arial"; r.font.size = Pt(10); r.font.bold = True; r.font.color.rgb = BOLD_BLACK
    r = p_bi.add_run(); r.text = "to deliver instant emergency alerts and toxic plume evacuation modeling."
    r.font.name = "Arial"; r.font.size = Pt(10); r.font.color.rgb = TEXT_BLACK

    # 7. Bottom-Left: Proposed Solution (Width = 4.20 in)
    tb_sol = slide2.shapes.add_textbox(Inches(0.38), Inches(2.78), Inches(4.20), Inches(4.0))
    tf_sol = tb_sol.text_frame
    tf_sol.word_wrap = True
    tf_sol.margin_left = tf_sol.margin_right = tf_sol.margin_top = tf_sol.margin_bottom = 0

    p_hs = tf_sol.paragraphs[0]
    p_hs.text = "Proposed Solution :"
    p_hs.font.name = "Arial"
    p_hs.font.size = Pt(12.5)
    p_hs.font.bold = True
    p_hs.font.underline = True
    p_hs.font.color.rgb = DARK_BLUE
    p_hs.space_after = Pt(6)

    sol_bullets = [
        ("• When satellite telemetry arrives, the system applies ",
         "Dual-Band Planck Pyrometry",
         " to calculate true flame temperature (Tf > 1200 K) and exact fire area from sub-pixel clutter."),
        ("• A ",
         "2-Stage Hierarchical ML Classifier",
         " automatically segregates routine refinery flares from industrial explosions and forest wildfires."),
        ("• An integrated ",
         "3D GIS WebGL Command Dashboard",
         " drapes thermal hotspots and real-time Gaussian toxic plume evacuation zones onto a live virtual globe.")
    ]

    for prefix, bold_text, suffix in sol_bullets:
        p = tf_sol.add_paragraph()
        p.space_after = Pt(7)
        p.line_spacing = 1.15
        r = p.add_run(); r.text = prefix; r.font.name = "Arial"; r.font.size = Pt(9.5); r.font.color.rgb = TEXT_BLACK
        r = p.add_run(); r.text = bold_text; r.font.name = "Arial"; r.font.size = Pt(9.5); r.font.bold = True; r.font.color.rgb = BOLD_BLACK
        r = p.add_run(); r.text = suffix; r.font.name = "Arial"; r.font.size = Pt(9.5); r.font.color.rgb = TEXT_BLACK

    # 8. Bottom-Right: Innovation / Uniqueness (Left = 8.75 in, Width = 4.20 in)
    # Leaves center space from 4.60 in to 8.70 in (over 4.1 inches) completely free!
    tb_inn = slide2.shapes.add_textbox(Inches(8.75), Inches(2.78), Inches(4.20), Inches(4.0))
    tf_inn = tb_inn.text_frame
    tf_inn.word_wrap = True
    tf_inn.margin_left = tf_inn.margin_right = tf_inn.margin_top = tf_inn.margin_bottom = 0

    p_hi = tf_inn.paragraphs[0]
    p_hi.text = "Innovation/Uniqueness:"
    p_hi.font.name = "Arial"
    p_hi.font.size = Pt(12.5)
    p_hi.font.bold = True
    p_hi.font.underline = True
    p_hi.font.color.rgb = DARK_BLUE
    p_hi.space_after = Pt(6)

    inn_bullets = [
        ("• ", "India's first sub-pixel pyrometry platform", " to detect industrial fires."),
        ("• ", "Converts raw heat pixels into physical flame data", " (temperature & burning area) with zero AI hallucination."),
        ("• ", "Dual-satellite land grounding", " uses 10m ESA land-cover and Sentinel-2 data to eliminate false alarms at industrial plants."),
        ("• ", "Live Toxic Plume Dispersion Engine", " combines real-time wind and chemical data to map evacuation zones for first responders.")
    ]

    for prefix, bold_text, suffix in inn_bullets:
        p = tf_inn.add_paragraph()
        p.space_after = Pt(7)
        p.line_spacing = 1.15
        r = p.add_run(); r.text = prefix; r.font.name = "Arial"; r.font.size = Pt(9.5); r.font.color.rgb = TEXT_BLACK
        r = p.add_run(); r.text = bold_text; r.font.name = "Arial"; r.font.size = Pt(9.5); r.font.bold = True; r.font.color.rgb = BOLD_BLACK
        r = p.add_run(); r.text = suffix; r.font.name = "Arial"; r.font.size = Pt(9.5); r.font.color.rgb = TEXT_BLACK

    prs.save(filename)
    print(f"Cleaned and rebuilt slide 2 for {filename}!")
