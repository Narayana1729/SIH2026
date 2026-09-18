import sys
import pptx
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN
from pptx.enum.shapes import MSO_SHAPE

def build_presentation():
    prs = Presentation('SIH2026-IDEA-Presentation-Format.pptx')

    # Color palette
    NAVY = RGBColor(30, 64, 110)
    DARK_BLUE = RGBColor(43, 91, 132)
    TEXT_BLACK = RGBColor(20, 20, 20)
    LINE_GRAY = RGBColor(180, 195, 210)
    HEADER_LINE = RGBColor(70, 130, 180)

    # 1. Update team name in Oval on all slides
    for idx, slide in enumerate(prs.slides):
        for s in slide.shapes:
            if 'Oval' in s.name and s.has_text_frame:
                s.text_frame.text = "Thinkers"
                p = s.text_frame.paragraphs[0]
                p.alignment = PP_ALIGN.CENTER
                p.font.name = "Arial"
                p.font.size = Pt(14)
                p.font.bold = True
                p.font.color.rgb = RGBColor(0, 0, 0)

    # -------------------------------------------------------------
    # SLIDE 2: IDEA TITLE & PROPOSED SOLUTION
    # -------------------------------------------------------------
    slide2 = prs.slides[1]

    # Clean existing placeholder text box
    shapes_to_remove = []
    for s in slide2.shapes:
        if s.name == "TextBox 8":
            shapes_to_remove.append(s)
        elif s.name == "Title 1" and s.has_text_frame:
            s.text_frame.clear()
            p = s.text_frame.paragraphs[0]
            p.text = "PyroSat: AI-Powered Satellite Thermal Anomaly & Sub-Pixel Inversion\nPlatform for Industrial Fire and Disaster Mitigation"
            p.alignment = PP_ALIGN.CENTER
            p.font.name = "Times New Roman"
            p.font.size = Pt(17)
            p.font.bold = True
            p.font.color.rgb = RGBColor(0, 0, 0)
            s.left = Inches(1.8)
            s.top = Inches(0.12)
            s.width = Inches(8.8)
            s.height = Inches(1.0)

    for s in shapes_to_remove:
        sp = s._element
        sp.getparent().remove(sp)

    # Add header divider line
    line_top = slide2.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0.28), Inches(1.18), Inches(12.75), Inches(0.02))
    line_top.fill.solid()
    line_top.fill.fore_color.rgb = HEADER_LINE
    line_top.line.fill.background()

    # Vertical divider line for top section (Problem vs Our Idea)
    v_line_top = slide2.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(5.95), Inches(1.22), Inches(0.015), Inches(1.42))
    v_line_top.fill.solid()
    v_line_top.fill.fore_color.rgb = LINE_GRAY
    v_line_top.line.fill.background()

    # Horizontal divider line separating top & bottom sections
    h_line_mid = slide2.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0.28), Inches(2.68), Inches(12.75), Inches(0.015))
    h_line_mid.fill.solid()
    h_line_mid.fill.fore_color.rgb = LINE_GRAY
    h_line_mid.line.fill.background()

    # Top-Left: Problem
    tb_prob = slide2.shapes.add_textbox(Inches(0.38), Inches(1.25), Inches(5.45), Inches(1.35))
    tf_prob = tb_prob.text_frame
    tf_prob.word_wrap = True
    tf_prob.margin_left = tf_prob.margin_right = tf_prob.margin_top = tf_prob.margin_bottom = 0

    p_h = tf_prob.paragraphs[0]
    p_h.text = "Problem:"
    p_h.font.name = "Arial"
    p_h.font.size = Pt(13)
    p_h.font.bold = True
    p_h.font.underline = True
    p_h.font.color.rgb = DARK_BLUE
    p_h.space_after = Pt(4)

    p_b1 = tf_prob.add_paragraph()
    r = p_b1.add_run(); r.text = "GNSS & NASA FIRMS satellites detect heat, but "
    r.font.name = "Arial"; r.font.size = Pt(10.5); r.font.color.rgb = TEXT_BLACK
    r = p_b1.add_run(); r.text = "cannot tell what is burning."
    r.font.name = "Arial"; r.font.size = Pt(10.5); r.font.bold = True; r.font.color.rgb = RGBColor(0,0,0)
    
    r = p_b1.add_run(); r.text = " Coarse 375m pixels mix routine refinery flares with runaway explosions and wildfires. In industrial corridors, this causes "
    r.font.name = "Arial"; r.font.size = Pt(10.5); r.font.color.rgb = TEXT_BLACK
    
    r = p_b1.add_run(); r.text = "heavy false alarms, putting critical infrastructure and lives at risk."
    r.font.name = "Arial"; r.font.size = Pt(10.5); r.font.bold = True; r.font.color.rgb = RGBColor(0,0,0)

    # Top-Right: Our Idea
    tb_idea = slide2.shapes.add_textbox(Inches(6.15), Inches(1.25), Inches(6.8), Inches(1.35))
    tf_idea = tb_idea.text_frame
    tf_idea.word_wrap = True
    tf_idea.margin_left = tf_idea.margin_right = tf_idea.margin_top = tf_idea.margin_bottom = 0

    p_h2 = tf_idea.paragraphs[0]
    p_h2.text = "Our Idea :"
    p_h2.font.name = "Arial"
    p_h2.font.size = Pt(13)
    p_h2.font.bold = True
    p_h2.font.underline = True
    p_h2.font.color.rgb = DARK_BLUE
    p_h2.space_after = Pt(4)

    p_b2 = tf_idea.add_paragraph()
    r = p_b2.add_run(); r.text = "PyroSat is an AI-powered platform with a three-pillar approach "
    r.font.name = "Arial"; r.font.size = Pt(10.5); r.font.bold = True; r.font.color.rgb = RGBColor(0,0,0)
    
    r = p_b2.add_run(); r.text = "ensuring automated disaster intelligence when orbital feeds are ambiguous. It combines "
    r.font.name = "Arial"; r.font.size = Pt(10.5); r.font.color.rgb = TEXT_BLACK
    
    r = p_b2.add_run(); r.text = "infrared flame physics, hierarchical ML, and 3D GIS maps "
    r.font.name = "Arial"; r.font.size = Pt(10.5); r.font.bold = True; r.font.color.rgb = RGBColor(0,0,0)
    
    r = p_b2.add_run(); r.text = "to deliver instant emergency alerts and evacuation modeling."
    r.font.name = "Arial"; r.font.size = Pt(10.5); r.font.color.rgb = TEXT_BLACK

    # Bottom-Left: Proposed Solution
    tb_sol = slide2.shapes.add_textbox(Inches(0.38), Inches(2.82), Inches(5.45), Inches(3.95))
    tf_sol = tb_sol.text_frame
    tf_sol.word_wrap = True
    tf_sol.margin_left = tf_sol.margin_right = tf_sol.margin_top = tf_sol.margin_bottom = 0

    p_hs = tf_sol.paragraphs[0]
    p_hs.text = "Proposed Solution :"
    p_hs.font.name = "Arial"
    p_hs.font.size = Pt(13)
    p_hs.font.bold = True
    p_hs.font.underline = True
    p_hs.font.color.rgb = DARK_BLUE
    p_hs.space_after = Pt(6)

    sol_bullets = [
        ("• When satellite telemetry arrives, the system applies ",
         "Dual-Band Planck Pyrometry (Dozier Inversion)",
         " to calculate true flame temperature (Tf > 1200 K) and exact combustion area (Af in m²) from sub-pixel clutter."),
        ("• A ",
         "2-Stage Hierarchical ML Classifier",
         " automatically segregates routine refinery flares from industrial explosions, coal seam fires, and forest wildfires with explainable TreeSHAP."),
        ("• An integrated ",
         "3D GIS WebGL Command Dashboard",
         " drapes thermal hotspots, facility infrastructure, and real-time Gaussian toxic plume evacuation zones directly onto a live virtual globe for responders.")
    ]

    for prefix, bold_text, suffix in sol_bullets:
        p = tf_sol.add_paragraph()
        p.space_after = Pt(8)
        p.line_spacing = 1.15
        r = p.add_run(); r.text = prefix; r.font.name = "Arial"; r.font.size = Pt(10); r.font.color.rgb = TEXT_BLACK
        r = p.add_run(); r.text = bold_text; r.font.name = "Arial"; r.font.size = Pt(10); r.font.bold = True; r.font.color.rgb = RGBColor(0,0,0)
        r = p.add_run(); r.text = suffix; r.font.name = "Arial"; r.font.size = Pt(10); r.font.color.rgb = TEXT_BLACK

    # Bottom-Right: Innovation / Uniqueness
    tb_inn = slide2.shapes.add_textbox(Inches(6.15), Inches(2.82), Inches(6.8), Inches(3.95))
    tf_inn = tb_inn.text_frame
    tf_inn.word_wrap = True
    tf_inn.margin_left = tf_inn.margin_right = tf_inn.margin_top = tf_inn.margin_bottom = 0

    p_hi = tf_inn.paragraphs[0]
    p_hi.text = "Innovation/Uniqueness:"
    p_hi.font.name = "Arial"
    p_hi.font.size = Pt(13)
    p_hi.font.bold = True
    p_hi.font.underline = True
    p_hi.font.color.rgb = DARK_BLUE
    p_hi.space_after = Pt(6)

    inn_bullets = [
        ("• ",
         "India's first sub-pixel pyrometry platform",
         " that solves Planck's radiation law on open satellite data, eliminating the need for expensive commercial satellite tasking."),
        ("• ",
         "Transforms ambiguous thermal pixels into auditable physics metrics",
         " (radiant heat flux kW/m², flame area, combustion regime) with zero AI hallucination."),
        ("• ",
         "Dual Earth-observation grounding",
         " fusing ESA WorldCover 10m land-use and Sentinel-2 spectral indices to prevent false alarms in industrial complexes."),
        ("• ",
         "Live Atmospheric Toxic Plume Modeling",
         " coupling real-time wind vectors and CAMEO-NIOSH chemical registries to project 3-zone civilian evacuation corridors.")
    ]

    for prefix, bold_text, suffix in inn_bullets:
        p = tf_inn.add_paragraph()
        p.space_after = Pt(7)
        p.line_spacing = 1.15
        r = p.add_run(); r.text = prefix; r.font.name = "Arial"; r.font.size = Pt(10); r.font.color.rgb = TEXT_BLACK
        r = p.add_run(); r.text = bold_text; r.font.name = "Arial"; r.font.size = Pt(10); r.font.bold = True; r.font.color.rgb = RGBColor(0,0,0)
        r = p.add_run(); r.text = suffix; r.font.name = "Arial"; r.font.size = Pt(10); r.font.color.rgb = TEXT_BLACK

    prs.save('SIH2026_PyroSat_Submission.pptx')
    prs.save('SIH2026-IDEA-Presentation-Format.pptx')
    print("Successfully built Slide 2!")

if __name__ == '__main__':
    build_presentation()
