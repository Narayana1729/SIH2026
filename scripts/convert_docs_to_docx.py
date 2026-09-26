import os
import re
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
from docx.oxml import OxmlElement, parse_xml
from docx.oxml.ns import nsdecls, qn

def set_cell_background(cell, fill_hex):
    tcPr = cell._tc.get_or_add_tcPr()
    shd = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{fill_hex}"/>')
    tcPr.append(shd)

def set_cell_margins(cell, top=100, bottom=100, left=150, right=150):
    tcPr = cell._tc.get_or_add_tcPr()
    tcMar = parse_xml(f'<w:tcMar {nsdecls("w")}><w:top w:w="{top}" w:type="dxa"/><w:bottom w:w="{bottom}" w:type="dxa"/><w:left w:w="{left}" w:type="dxa"/><w:right w:w="{right}" w:type="dxa"/></w:tcMar>')
    tcPr.append(tcMar)

def add_styled_heading(doc, text, level):
    h = doc.add_heading(level=level)
    run = h.add_run(text)
    h.paragraph_format.keep_with_next = True
    if level == 1:
        run.font.name = 'Calibri'
        run.font.size = Pt(20)
        run.font.bold = True
        run.font.color.rgb = RGBColor(15, 44, 89) # Deep Navy
        h.paragraph_format.space_before = Pt(16)
        h.paragraph_format.space_after = Pt(6)
    elif level == 2:
        run.font.name = 'Calibri'
        run.font.size = Pt(15)
        run.font.bold = True
        run.font.color.rgb = RGBColor(194, 65, 12) # Burnt Orange / Terracotta
        h.paragraph_format.space_before = Pt(14)
        h.paragraph_format.space_after = Pt(4)
    elif level == 3:
        run.font.name = 'Calibri'
        run.font.size = Pt(12)
        run.font.bold = True
        run.font.color.rgb = RGBColor(30, 58, 138)
        h.paragraph_format.space_before = Pt(10)
        h.paragraph_format.space_after = Pt(3)
    elif level == 4:
        run.font.name = 'Calibri'
        run.font.size = Pt(11)
        run.font.bold = True
        run.font.italic = True
        run.font.color.rgb = RGBColor(70, 70, 70)
        h.paragraph_format.space_before = Pt(8)
        h.paragraph_format.space_after = Pt(2)
    return h

def add_formatted_runs(paragraph, text):
    # Regex to handle bold, italic, code
    # Simple tokenization for markdown: `code`, **bold**, *italic*
    tokens = re.split(r'(\*\*.*?\*\*|\*.*?\*|`.*?`|\[.*?\]\(.*?\))', text)
    for token in tokens:
        if not token:
            continue
        if token.startswith('**') and token.endswith('**') and len(token) >= 4:
            run = paragraph.add_run(token[2:-2])
            run.font.bold = True
            run.font.name = 'Calibri'
            run.font.size = Pt(11)
        elif token.startswith('*') and token.endswith('*') and len(token) >= 2:
            run = paragraph.add_run(token[1:-1])
            run.font.italic = True
            run.font.name = 'Calibri'
            run.font.size = Pt(11)
        elif token.startswith('`') and token.endswith('`') and len(token) >= 2:
            run = paragraph.add_run(token[1:-1])
            run.font.name = 'Consolas'
            run.font.size = Pt(9.5)
            run.font.color.rgb = RGBColor(180, 40, 40)
        elif token.startswith('[') and '](' in token and token.endswith(')'):
            match = re.match(r'\[(.*?)\]\((.*?)\)', token)
            if match:
                link_text, url = match.groups()
                run = paragraph.add_run(link_text)
                run.font.name = 'Calibri'
                run.font.size = Pt(11)
                run.font.color.rgb = RGBColor(37, 99, 235)
                run.font.underline = True
            else:
                run = paragraph.add_run(token)
                run.font.name = 'Calibri'
                run.font.size = Pt(11)
        else:
            # clean math markers like $...$ or $$...$$
            clean_text = token.replace('$$', '').replace('$', '')
            run = paragraph.add_run(clean_text)
            run.font.name = 'Calibri'
            run.font.size = Pt(11)

def convert_markdown_to_docx(md_path, docx_path, image_to_embed=None):
    with open(md_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    doc = Document()
    
    # Page Margins: 1 inch everywhere
    for section in doc.sections:
        section.top_margin = Inches(0.9)
        section.bottom_margin = Inches(0.9)
        section.left_margin = Inches(0.9)
        section.right_margin = Inches(0.9)
        
        # Header / Footer
        header = section.header
        hp = header.paragraphs[0]
        hp.text = "PyroSat — SIH 2026 | NTRO (SIH26162) | Team: Thinkers"
        hp.alignment = WD_ALIGN_PARAGRAPH.RIGHT
        hp.runs[0].font.name = 'Calibri'
        hp.runs[0].font.size = Pt(8.5)
        hp.runs[0].font.color.rgb = RGBColor(120, 120, 120)

    in_code_block = False
    code_lines = []
    in_table = False
    table_rows = []

    i = 0
    while i < len(lines):
        line = lines[i].rstrip('\r\n')
        
        # Code block check
        if line.strip().startswith('```'):
            if in_code_block:
                # Flush code block
                p = doc.add_paragraph()
                p.paragraph_format.left_indent = Inches(0.3)
                p.paragraph_format.space_before = Pt(4)
                p.paragraph_format.space_after = Pt(6)
                code_text = '\n'.join(code_lines)
                run = p.add_run(code_text)
                run.font.name = 'Consolas'
                run.font.size = Pt(9)
                run.font.color.rgb = RGBColor(40, 40, 40)
                code_lines = []
                in_code_block = False
            else:
                in_code_block = True
                code_lines = []
            i += 1
            continue

        if in_code_block:
            code_lines.append(line)
            i += 1
            continue

        # Table check
        if line.strip().startswith('|') and line.strip().endswith('|'):
            table_rows.append(line.strip())
            i += 1
            continue
        elif in_table or (len(table_rows) > 0 and not (line.strip().startswith('|') and line.strip().endswith('|'))):
            # Process table
            parsed_rows = []
            for r in table_rows:
                cells = [c.strip() for c in r.strip('|').split('|')]
                # skip separator row like |:---|:---|
                if all(re.match(r'^:?-+:?$', c) for c in cells if c):
                    continue
                parsed_rows.append(cells)
            
            if parsed_rows:
                num_cols = max(len(r) for r in parsed_rows)
                tbl = doc.add_table(rows=len(parsed_rows), cols=num_cols)
                tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
                tbl.autofit = True

                for row_idx, r_data in enumerate(parsed_rows):
                    row = tbl.rows[row_idx]
                    is_header = (row_idx == 0)
                    for col_idx, cell_value in enumerate(r_data):
                        if col_idx < num_cols:
                            cell = row.cells[col_idx]
                            cell.vertical_alignment = WD_ALIGN_VERTICAL.CENTER
                            set_cell_margins(cell, top=120, bottom=120, left=140, right=140)
                            p = cell.paragraphs[0]
                            p.paragraph_format.space_before = Pt(2)
                            p.paragraph_format.space_after = Pt(2)
                            
                            # Clean cell content (<br> to newline)
                            cleaned_value = cell_value.replace('<br>', '\n').replace('&nbsp;', ' ')
                            sub_lines = cleaned_value.split('\n')
                            for sub_idx, sub_l in enumerate(sub_lines):
                                if sub_idx > 0:
                                    p = cell.add_paragraph()
                                    p.paragraph_format.space_before = Pt(1)
                                    p.paragraph_format.space_after = Pt(1)
                                add_formatted_runs(p, sub_l)

                            if is_header:
                                set_cell_background(cell, "1E3A8A") # Navy header
                                for run in p.runs:
                                    run.font.bold = True
                                    run.font.color.rgb = RGBColor(255, 255, 255)
                            else:
                                if row_idx % 2 == 1:
                                    set_cell_background(cell, "F8FAFC") # light alternate
                                else:
                                    set_cell_background(cell, "FFFFFF")
            
            table_rows = []
            # do not continue, process the current line below

        # Empty line
        if not line.strip():
            i += 1
            continue

        # Horizontal rule
        if line.strip() in ['---', '***', '___']:
            p = doc.add_paragraph()
            p.paragraph_format.space_before = Pt(6)
            p.paragraph_format.space_after = Pt(6)
            run = p.add_run("―" * 55)
            run.font.color.rgb = RGBColor(200, 200, 200)
            i += 1
            continue

        # Headings
        if line.startswith('# '):
            add_styled_heading(doc, line[2:].strip(), 1)
            i += 1
            continue
        elif line.startswith('## '):
            add_styled_heading(doc, line[3:].strip(), 2)
            i += 1
            continue
        elif line.startswith('### '):
            add_styled_heading(doc, line[4:].strip(), 3)
            i += 1
            continue
        elif line.startswith('#### '):
            add_styled_heading(doc, line[5:].strip(), 4)
            i += 1
            continue

        # Bullet list
        if re.match(r'^\s*[-*]\s+', line):
            indent_level = len(re.match(r'^\s*', line).group(0)) // 2
            content = re.sub(r'^\s*[-*]\s+', '', line)
            p = doc.add_paragraph(style='List Bullet')
            p.paragraph_format.left_indent = Inches(0.25 * (indent_level + 1))
            p.paragraph_format.space_before = Pt(1)
            p.paragraph_format.space_after = Pt(2)
            add_formatted_runs(p, content)
            i += 1
            continue

        # Numbered list
        if re.match(r'^\s*\d+\.\s+', line):
            content = re.sub(r'^\s*\d+\.\s+', '', line)
            p = doc.add_paragraph(style='List Number')
            p.paragraph_format.space_before = Pt(1)
            p.paragraph_format.space_after = Pt(2)
            add_formatted_runs(p, content)
            i += 1
            continue

        # Blockquote
        if line.startswith('> '):
            p = doc.add_paragraph()
            p.paragraph_format.left_indent = Inches(0.4)
            p.paragraph_format.space_before = Pt(4)
            p.paragraph_format.space_after = Pt(4)
            run = p.add_run("┃ ")
            run.font.bold = True
            run.font.color.rgb = RGBColor(194, 65, 12)
            add_formatted_runs(p, line[2:].strip())
            i += 1
            continue

        # Standard paragraph
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(2)
        p.paragraph_format.space_after = Pt(4)
        p.paragraph_format.line_spacing = 1.15
        add_formatted_runs(p, line)
        i += 1

    # If image requested and exists, add image at appropriate section or at end
    if image_to_embed and os.path.exists(image_to_embed):
        doc.add_page_break()
        add_styled_heading(doc, "System Architecture Visual", 1)
        p = doc.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        doc.add_picture(image_to_embed, width=Inches(6.6))
        cap = doc.add_paragraph()
        cap.alignment = WD_ALIGN_PARAGRAPH.CENTER
        c_run = cap.add_run("Figure: PyroSat 5-Tier End-to-End System Architecture (NASA FIRMS -> Ingestion -> Physics -> Skeptic AI -> Command Cockpit)")
        c_run.font.name = 'Calibri'
        c_run.font.italic = True
        c_run.font.size = Pt(9.5)
        c_run.font.color.rgb = RGBColor(100, 100, 100)

    doc.save(docx_path)
    print(f"Generated: {docx_path}")

if __name__ == '__main__':
    base_dir = '/Users/srimannarayanadeevi/Vision/Firms/sih_docs'
    arch_img = os.path.join(base_dir, 'pyrosat_architecture_diagram.jpg')
    
    files_to_convert = [
        ('ABSTRACT.md', 'ABSTRACT.docx', None),
        ('CHALLENGES_AND_MITIGATIONS.md', 'CHALLENGES_AND_MITIGATIONS.docx', None),
        ('BUSINESS_MODEL_CANVAS.md', 'BUSINESS_MODEL_CANVAS.docx', None),
        ('ADDITIONAL_DOCS.md', 'ADDITIONAL_DOCS.docx', arch_img),
    ]
    
    for md_name, docx_name, img in files_to_convert:
        md_file = os.path.join(base_dir, md_name)
        docx_file = os.path.join(base_dir, docx_name)
        if os.path.exists(md_file):
            convert_markdown_to_docx(md_file, docx_file, img)

    # Also generate the ALL-IN-ONE MASTER SUBMISSION DOSSIER .docx
    full_pkg = '/Users/srimannarayanadeevi/Vision/Firms/PyroSat_SIH2026_Submission_Package.md'
    full_docx = os.path.join(base_dir, 'PyroSat_SIH2026_Complete_Submission_Dossier.docx')
    if os.path.exists(full_pkg):
        convert_markdown_to_docx(full_pkg, full_docx, arch_img)
