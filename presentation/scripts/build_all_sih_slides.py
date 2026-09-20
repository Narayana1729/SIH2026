import pptx
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN
from pptx.enum.shapes import MSO_SHAPE

def build_all_slides():
    prs = Presentation('SIH2026-IDEA-Presentation-Format.pptx')

    DARK_BLUE = RGBColor(43, 91, 132)    # #2b5b84 for section headers
    HEADER_LINE = RGBColor(70, 130, 180)  # Steel blue line under title
    LINE_GRAY = RGBColor(185, 195, 205)   # Divider lines
    TEXT_BLACK = RGBColor(30, 30, 30)
    BOLD_BLACK = RGBColor(0, 0, 0)

    def clean_and_get_title(slide, title_text):
        shapes_to_remove = []
        title_shape = None
        for s in slide.shapes:
            if s.name == "TextBox 8":
                shapes_to_remove.append(s)
            elif "Title" in s.name and s.has_text_frame:
                title_shape = s
            elif "Oval" in s.name and s.has_text_frame:
                s.text_frame.text = "Thinkers"
                p = s.text_frame.paragraphs[0]
                p.alignment = PP_ALIGN.CENTER
                p.font.name = "Arial"
                p.font.size = Pt(14)
                p.font.bold = True
                p.font.color.rgb = BOLD_BLACK

        for s in shapes_to_remove:
            sp = s._element
            sp.getparent().remove(sp)

        if title_shape:
            title_shape.text_frame.clear()
            p = title_shape.text_frame.paragraphs[0]
            p.text = title_text
            p.alignment = PP_ALIGN.CENTER
            p.font.name = "Times New Roman"
            p.font.size = Pt(18 if len(title_text) < 40 else 16)
            p.font.bold = True
            p.font.color.rgb = BOLD_BLACK
            title_shape.left = Inches(1.8)
            title_shape.top = Inches(0.12)
            title_shape.width = Inches(8.8)
            title_shape.height = Inches(1.0)

        # Header horizontal line
        line_top = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0.28), Inches(1.18), Inches(12.75), Inches(0.02))
        line_top.fill.solid()
        line_top.fill.fore_color.rgb = HEADER_LINE
        line_top.line.fill.background()

    def add_section_header(tf, title):
        p = tf.paragraphs[0]
        p.text = title
        p.font.name = "Arial"
        p.font.size = Pt(12.5)
        p.font.bold = True
        p.font.underline = True
        p.font.color.rgb = DARK_BLUE
        p.space_after = Pt(4)

    def add_bullet(tf, prefix="", bold_text="", suffix="", pt_size=9.5, space_after=6):
        p = tf.add_paragraph()
        p.space_after = Pt(space_after)
        p.line_spacing = 1.15
        if prefix:
            r = p.add_run(); r.text = prefix; r.font.name = "Arial"; r.font.size = Pt(pt_size); r.font.color.rgb = TEXT_BLACK
        if bold_text:
            r = p.add_run(); r.text = bold_text; r.font.name = "Arial"; r.font.size = Pt(pt_size); r.font.bold = True; r.font.color.rgb = BOLD_BLACK
        if suffix:
            r = p.add_run(); r.text = suffix; r.font.name = "Arial"; r.font.size = Pt(pt_size); r.font.color.rgb = TEXT_BLACK

    # =========================================================================
    # SLIDE 2: IDEA TITLE & PROPOSED SOLUTION
    # =========================================================================
    slide2 = prs.slides[1]
    clean_and_get_title(slide2, "PyroSat: AI-Powered Satellite Thermal Anomaly & Sub-Pixel Inversion\nPlatform for Industrial Fire and Disaster Mitigation")

    # Lines on Slide 2
    v1 = slide2.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(5.95), Inches(1.22), Inches(0.015), Inches(1.42))
    v1.fill.solid(); v1.fill.fore_color.rgb = LINE_GRAY; v1.line.fill.background()
    h1 = slide2.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0.28), Inches(2.68), Inches(12.75), Inches(0.015))
    h1.fill.solid(); h1.fill.fore_color.rgb = LINE_GRAY; h1.line.fill.background()

    # 1. Problem
    tb = slide2.shapes.add_textbox(Inches(0.38), Inches(1.24), Inches(5.45), Inches(1.38))
    tf = tb.text_frame; tf.word_wrap = True; tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0
    add_section_header(tf, "Problem:")
    p = tf.add_paragraph()
    r = p.add_run(); r.text = "NASA FIRMS satellites detect heat, but "
    r.font.name = "Arial"; r.font.size = Pt(10); r.font.color.rgb = TEXT_BLACK
    r = p.add_run(); r.text = "cannot tell what is burning."
    r.font.name = "Arial"; r.font.size = Pt(10); r.font.bold = True; r.font.color.rgb = BOLD_BLACK
    r = p.add_run(); r.text = " Coarse 375m pixels mix routine refinery flares with runaway explosions and wildfires. In industrial corridors, this causes "
    r.font.name = "Arial"; r.font.size = Pt(10); r.font.color.rgb = TEXT_BLACK
    r = p.add_run(); r.text = "heavy false alarms, putting critical infrastructure and lives at risk."
    r.font.name = "Arial"; r.font.size = Pt(10); r.font.bold = True; r.font.color.rgb = BOLD_BLACK

    # 2. Our Idea
    tb = slide2.shapes.add_textbox(Inches(6.15), Inches(1.24), Inches(6.8), Inches(1.38))
    tf = tb.text_frame; tf.word_wrap = True; tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0
    add_section_header(tf, "Our Idea :")
    p = tf.add_paragraph()
    r = p.add_run(); r.text = "PyroSat is an AI-powered platform with a three-pillar approach "
    r.font.name = "Arial"; r.font.size = Pt(10); r.font.bold = True; r.font.color.rgb = BOLD_BLACK
    r = p.add_run(); r.text = "ensuring automated disaster intelligence when orbital feeds are ambiguous. It combines "
    r.font.name = "Arial"; r.font.size = Pt(10); r.font.color.rgb = TEXT_BLACK
    r = p.add_run(); r.text = "infrared flame physics, hierarchical ML, and 3D GIS maps "
    r.font.name = "Arial"; r.font.size = Pt(10); r.font.bold = True; r.font.color.rgb = BOLD_BLACK
    r = p.add_run(); r.text = "to deliver instant emergency alerts and toxic plume evacuation modeling."
    r.font.name = "Arial"; r.font.size = Pt(10); r.font.color.rgb = TEXT_BLACK

    # 3. Proposed Solution
    tb = slide2.shapes.add_textbox(Inches(0.38), Inches(2.78), Inches(5.45), Inches(4.0))
    tf = tb.text_frame; tf.word_wrap = True; tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0
    add_section_header(tf, "Proposed Solution :")
    add_bullet(tf, "• When satellite telemetry arrives, the system applies ", "Dual-Band Planck Pyrometry (Dozier Inversion)", " to calculate true flame temperature (Tf > 1200 K) and exact combustion area (Af in m²) from sub-pixel clutter.")
    add_bullet(tf, "• A ", "2-Stage Hierarchical ML Classifier", " automatically segregates routine refinery flares from industrial explosions, coal seam fires, and forest wildfires with explainable TreeSHAP.")
    add_bullet(tf, "• An integrated ", "3D GIS WebGL Command Dashboard", " drapes thermal hotspots, facility infrastructure, and real-time Gaussian toxic plume evacuation zones directly onto a live virtual globe for responders.")

    # 4. Innovation / Uniqueness
    tb = slide2.shapes.add_textbox(Inches(6.15), Inches(2.78), Inches(6.8), Inches(4.0))
    tf = tb.text_frame; tf.word_wrap = True; tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0
    add_section_header(tf, "Innovation/Uniqueness:")
    add_bullet(tf, "• ", "India's first sub-pixel pyrometry platform", " that solves Planck's radiation law on open satellite data, eliminating the need for expensive commercial satellite tasking.")
    add_bullet(tf, "• ", "Adversarial Skeptic AI Falsification Gate", " that actively attempts to disprove candidate alarms using physical invariants (solar glint rejection, Planck flame limits, operational baselines).")
    add_bullet(tf, "• ", "Transforms ambiguous thermal pixels into auditable physics metrics", " (radiant heat flux kW/m², flame area, combustion regime) with zero AI hallucination.")
    add_bullet(tf, "• ", "Dual Earth-observation grounding", " fusing ESA WorldCover 10m land-use and Sentinel-2 spectral indices to prevent false alarms in industrial complexes.")
    add_bullet(tf, "• ", "Live Atmospheric Toxic Plume Modeling", " coupling real-time wind vectors and CAMEO-NIOSH chemical registries to project 3-zone civilian evacuation corridors.")

    # =========================================================================
    # SLIDE 3: TECHNICAL APPROACH
    # =========================================================================
    slide3 = prs.slides[2]
    clean_and_get_title(slide3, "TECHNICAL APPROACH")

    v_line3 = slide3.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(4.35), Inches(1.22), Inches(0.015), Inches(5.45))
    v_line3.fill.solid(); v_line3.fill.fore_color.rgb = LINE_GRAY; v_line3.line.fill.background()
    h_line3 = slide3.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0.28), Inches(3.85), Inches(4.07), Inches(0.015))
    h_line3.fill.solid(); h_line3.fill.fore_color.rgb = LINE_GRAY; h_line3.line.fill.background()

    # Left-Top: Technologies Used
    tb = slide3.shapes.add_textbox(Inches(0.38), Inches(1.24), Inches(3.9), Inches(2.55))
    tf = tb.text_frame; tf.word_wrap = True; tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0
    add_section_header(tf, "Technologies & Tools:")
    add_bullet(tf, "• ", "AI/ML Core: ", "Python 3.11, LightGBM, Scikit-Learn, SciPy (Planck Optimization), Lundberg TreeSHAP DP.", pt_size=9)
    add_bullet(tf, "• ", "3D Geospatial Engine: ", "CesiumJS (WebGL 3D Globe), Vanilla ESNext, Vite, PostGIS Spatial Engine.", pt_size=9)
    add_bullet(tf, "• ", "Backend & API Gateway: ", "Node.js REST Gateway, Open-Meteo Realtime Atmospheric Stream, CAMEO/NIOSH DB.", pt_size=9)

    # Left-Bottom: Satellite Datasets
    tb = slide3.shapes.add_textbox(Inches(0.38), Inches(3.95), Inches(3.9), Inches(2.7))
    tf = tb.text_frame; tf.word_wrap = True; tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0
    add_section_header(tf, "Satellite & Data Sources:")
    add_bullet(tf, "• ", "Thermal Telemetry: ", "NASA FIRMS NRT (VIIRS 375m & MODIS 1km) dual-band radiance feeds.", pt_size=9)
    add_bullet(tf, "• ", "Surface Grounding: ", "ESA WorldCover 10m LULC raster & Sentinel-2 L2A (NDVI, NBR, SWIR ratios).", pt_size=9)
    add_bullet(tf, "• ", "Infrastructure Registry: ", "Global Energy Monitor (GEM) refineries, steel mills, LNG terminals & mines.", pt_size=9)

    # Right: Methodology & Pipeline
    tb = slide3.shapes.add_textbox(Inches(4.55), Inches(1.24), Inches(8.35), Inches(5.45))
    tf = tb.text_frame; tf.word_wrap = True; tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0
    add_section_header(tf, "Methodology & Implementation Pipeline:")
    add_bullet(tf, "1. Ingestion & Pre-Flight Validation: ", "Automated multi-sensor stream ingestion with quality filtering, geospatial normalization, and coordinate precision bounding.", suffix="", pt_size=9.0, space_after=4)
    add_bullet(tf, "2. Dozier Dual-Band Pyrometry Inversion: ", "Solves simultaneous Planck radiation non-linear equations across MWIR (4µm) and LWIR (11µm) bands to decouple sub-pixel flame temperature (Tf) and combustion area (Af).", suffix="", pt_size=9.0, space_after=4)
    add_bullet(tf, "3. Hierarchical ML Segregation: ", "Stage-1 classifies Industrial vs. Non-Industrial. Stage-2 segregates discrete subclasses (Refinery Flare, Industrial Disaster, Wildfire, Stubble Burn, Coal Seam Fire).", suffix="", pt_size=9.0, space_after=4)
    add_bullet(tf, "4. Adversarial Skeptic AI Falsification: ", "Executes 5 physical invariant gates (solar glint rejection, Planck flame thresholding, canopy fuel divergence, operational baselines, sensor glitches) to actively disprove false positives.", suffix="", pt_size=9.0, space_after=4)
    add_bullet(tf, "5. Exact Lundberg TreeSHAP Explainability: ", "Computes local Shapley values via exact polynomial dynamic programming, ensuring additive efficiency (sum(phi) + base = f(x)) to guarantee verifiable provenance.", suffix="", pt_size=9.0, space_after=4)
    add_bullet(tf, "6. Atmospheric Dispersion & Tactical Dispatch: ", "Computes Pasquill-Gifford Gaussian plumes with Briggs buoyancy rise and live wind vectors, auto-generating Incident Action Plans (IAPs) for first responders.", suffix="", pt_size=9.0, space_after=4)

    # =========================================================================
    # SLIDE 4: FEASIBILITY AND VIABILITY
    # =========================================================================
    slide4 = prs.slides[3]
    clean_and_get_title(slide4, "FEASIBILITY AND VIABILITY")

    v_line4 = slide4.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(5.95), Inches(1.22), Inches(0.015), Inches(5.45))
    v_line4.fill.solid(); v_line4.fill.fore_color.rgb = LINE_GRAY; v_line4.line.fill.background()
    h_line4 = slide4.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0.28), Inches(3.9), Inches(5.67), Inches(0.015))
    h_line4.fill.solid(); h_line4.fill.fore_color.rgb = LINE_GRAY; h_line4.line.fill.background()

    # Left-Top: Feasibility
    tb = slide4.shapes.add_textbox(Inches(0.38), Inches(1.24), Inches(5.45), Inches(2.6))
    tf = tb.text_frame; tf.word_wrap = True; tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0
    add_section_header(tf, "Feasibility Analysis:")
    add_bullet(tf, "• ", "Open-Data Architecture: ", "Zero dependence on costly commercial tasking; runs entirely on free, open NASA FIRMS, ESA Copernicus, and Open-Meteo feeds.", pt_size=9.5)
    add_bullet(tf, "• ", "Tested Operational Prototype: ", "Full-stack system already implemented with 185+ passing automated tests, deterministic benchmark replay engine, and SHA-256 integrity checksums across 6 canonical Indian disaster scenarios.", pt_size=9.5)
    add_bullet(tf, "• ", "Low Hardware Footprint: ", "Efficient TreeSHAP DP and Dozier solvers run in sub-second inference on standard edge or cloud servers.", pt_size=9.5)

    # Left-Bottom: Challenges
    tb = slide4.shapes.add_textbox(Inches(0.38), Inches(4.0), Inches(5.45), Inches(2.65))
    tf = tb.text_frame; tf.word_wrap = True; tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0
    add_section_header(tf, "Potential Challenges & Risks:")
    add_bullet(tf, "• ", "Cloud & Monsoon Obscuration: ", "Dense cloud cover attenuates thermal infrared emissions from orbit.", pt_size=9.5)
    add_bullet(tf, "• ", "Orbital Revisit Latencies: ", "Sun-synchronous satellite passes leave gaps of 3-6 hours between revisits.", pt_size=9.5)
    add_bullet(tf, "• ", "Reflective Solar Glint: ", "Highly reflective metal industrial roofs can mimic daytime thermal hotspots.", pt_size=9.5)

    # Right: Strategies for Overcoming
    tb = slide4.shapes.add_textbox(Inches(6.15), Inches(1.24), Inches(6.8), Inches(5.45))
    tf = tb.text_frame; tf.word_wrap = True; tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0
    add_section_header(tf, "Strategies for Overcoming Challenges:")
    add_bullet(tf, "• ", "Multi-Constellation Satellite Fusion: ", "Combines VIIRS NOAA-20, NOAA-21, Suomi-NPP, and MODIS Aqua/Terra across complementary orbital nodes, reducing revisit latency.", pt_size=9.5)
    add_bullet(tf, "• ", "Sentinel-2 Scene Classification (SCL): ", "Integrates cloud probability and cirrus masks to quarantine obstructed pixels without generating false-negative alerts.", pt_size=9.5)
    add_bullet(tf, "• ", "90-Day Spatio-Temporal Persistence Memory: ", "Maintains historical heat baselines at known facilities, filtering out static solar glint while instantly flagging genuine flaring surges.", pt_size=9.5)
    add_bullet(tf, "• ", "Multi-Band Invariant Ratio Verification: ", "Uses MWIR/LWIR radiance ratios and night-pass observations to reject non-combustion thermal reflections.", pt_size=9.5)

    # =========================================================================
    # SLIDE 5: IMPACT AND BENEFITS
    # =========================================================================
    slide5 = prs.slides[4]
    clean_and_get_title(slide5, "IMPACT AND BENEFITS")

    v_line5 = slide5.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(5.95), Inches(1.22), Inches(0.015), Inches(5.45))
    v_line5.fill.solid(); v_line5.fill.fore_color.rgb = LINE_GRAY; v_line5.line.fill.background()
    h_line5 = slide5.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0.28), Inches(3.9), Inches(5.67), Inches(0.015))
    h_line5.fill.solid(); h_line5.fill.fore_color.rgb = LINE_GRAY; h_line5.line.fill.background()

    # Left-Top: Target Audience
    tb = slide5.shapes.add_textbox(Inches(0.38), Inches(1.24), Inches(5.45), Inches(2.6))
    tf = tb.text_frame; tf.word_wrap = True; tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0
    add_section_header(tf, "Target Audience & Stakeholders:")
    add_bullet(tf, "• ", "Disaster Management Authorities: ", "National & State Disaster Authorities (NDMA, SDMA, NDRF battalions).", pt_size=9.5)
    add_bullet(tf, "• ", "Environmental & Safety Regulators: ", "Central & State Pollution Control Boards (CPCB, SPCB, PESO).", pt_size=9.5)
    add_bullet(tf, "• ", "Industrial Facility Operators: ", "Safety Operations Centers at refineries, chemical hubs, and steel plants.", pt_size=9.5)
    add_bullet(tf, "• ", "Forest & Wilderness Services: ", "Forest Protection Divisions guarding national parks and biosphere reserves.", pt_size=9.5)

    # Left-Bottom: Social & Economic
    tb = slide5.shapes.add_textbox(Inches(0.38), Inches(4.0), Inches(5.45), Inches(2.65))
    tf = tb.text_frame; tf.word_wrap = True; tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0
    add_section_header(tf, "Social & Economic Benefits:")
    add_bullet(tf, "• ", "Life Safety in Toxic Corridors: ", "Proactive evacuation isopleths protect civilian settlements downwind of chemical disasters.", pt_size=9.5)
    add_bullet(tf, "• ", "Asset & Infrastructure Protection: ", "Detects abnormal flare blowouts before uncontained catastrophic refinery explosions occur.", pt_size=9.5)
    add_bullet(tf, "• ", "Slashes False Alarm Overhead: ", "Eliminates wasteful emergency mobilization caused by routine flaring misidentifications.", pt_size=9.5)

    # Right: Environmental & Governance
    tb = slide5.shapes.add_textbox(Inches(6.15), Inches(1.24), Inches(6.8), Inches(5.45))
    tf = tb.text_frame; tf.word_wrap = True; tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0
    add_section_header(tf, "Environmental & Governance Benefits:")
    add_bullet(tf, "• ", "Industrial Emissions Compliance Auditing: ", "Provides empirical, continuous satellite monitoring of permitted vs. illegal flaring and fugitive emissions across India's industrial belts.", pt_size=9.5)
    add_bullet(tf, "• ", "Forest Boundary Encroachment Warning: ", "Geodesic buffer engine computes real-time threat distance to protected wilderness reserves, stopping wildfires before boundary penetration.", pt_size=9.5)
    add_bullet(tf, "• ", "Data-Driven Emergency Governance: ", "Standardizes emergency response with automated Incident Action Plans (IAPs), HazMat UN placards, and immediate responder coordination.", pt_size=9.5)
    add_bullet(tf, "• ", "Climate & Methane Mitigation: ", "Quantifies high-temperature industrial combustion volumes to support national carbon accounting and fugitive methane reduction targets.", pt_size=9.5)

    # =========================================================================
    # SLIDE 6: RESEARCH AND REFERENCES
    # =========================================================================
    slide6 = prs.slides[5]
    clean_and_get_title(slide6, "RESEARCH AND REFERENCES")

    v_line6 = slide6.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(5.95), Inches(1.22), Inches(0.015), Inches(5.45))
    v_line6.fill.solid(); v_line6.fill.fore_color.rgb = LINE_GRAY; v_line6.line.fill.background()

    # Left: Research Papers
    tb = slide6.shapes.add_textbox(Inches(0.38), Inches(1.24), Inches(5.45), Inches(5.45))
    tf = tb.text_frame; tf.word_wrap = True; tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0
    add_section_header(tf, "Research & Scientific Literature:")
    add_bullet(tf, "• ", "Dozier, J. (1981): ", "\"A method for satellite identification of surface temperature fields of subpixel resolving scale.\" Remote Sensing of Environment, 11(1), 221-229. [Physical basis for sub-pixel Planck inversion]", pt_size=9)
    add_bullet(tf, "• ", "Lundberg, S. M., & Lee, S.-I. (2017): ", "\"A Unified Approach to Interpreting Model Predictions.\" NeurIPS 30. [Exact polynomial TreeSHAP dynamic programming algorithm]", pt_size=9)
    add_bullet(tf, "• ", "Pasquill, F. (1961) & Briggs, G. A. (1975): ", "\"Atmospheric Diffusion & Plume Rise Predictions.\" US Atomic Energy Commission. [Gaussian dispersion & buoyant plume model]", pt_size=9)
    add_bullet(tf, "• ", "Giglio, L., et al. (2016): ", "\"The Collection 6 MODIS active fire detection algorithm and fire products.\" Remote Sensing of Environment, 178, 31-41.", pt_size=9)
    add_bullet(tf, "• ", "Wooster, M. J., et al. (2005): ", "\"Retrieval of biomass combustion rates and total heat output using Fire Radiative Power (FRP).\" J. Geophys. Res.", pt_size=9)

    # Right: Data Sources & Standards
    tb = slide6.shapes.add_textbox(Inches(6.15), Inches(1.24), Inches(6.8), Inches(5.45))
    tf = tb.text_frame; tf.word_wrap = True; tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0
    add_section_header(tf, "Operational Datasets, APIs & Standards:")
    add_bullet(tf, "• ", "NASA FIRMS Telemetry API: ", "Near Real-Time thermal anomaly detections from VIIRS (S-NPP, NOAA-20, NOAA-21) and MODIS (Terra/Aqua). https://firms.modaps.eosdis.nasa.gov/", pt_size=9)
    add_bullet(tf, "• ", "ESA WorldCover 10m: ", "Global 10m Land Use / Land Cover (LULC) classification based on Sentinel-1 and Sentinel-2 data. European Space Agency.", pt_size=9)
    add_bullet(tf, "• ", "Copernicus Sentinel-2 Level-2A: ", "Bottom-of-Atmosphere (BOA) surface reflectance for spectral indices (NDVI, NBR, SWIR ratios).", pt_size=9)
    add_bullet(tf, "• ", "NOAA / EPA CAMEO Chemical Database: ", "Hazard profiles, toxic isolation distances, IDLH, ERPG, and AEGL concentration thresholds.", pt_size=9)
    add_bullet(tf, "• ", "Open-Meteo Atmospheric Weather API: ", "High-resolution real-time boundary layer wind vectors (speed, direction) and ambient surface temperatures.", pt_size=9)

    # Save to both target files
    prs.save('SIH2026_PyroSat_Submission.pptx')
    prs.save('SIH2026-IDEA-Presentation-Format.pptx')
    print("SUCCESS: All slides populated with exact layout, dashed dividers, bold keywords, and formatting!")

if __name__ == '__main__':
    build_all_slides()
