"""Geracao simples de arquivo .docx sem dependencias externas."""

from __future__ import annotations

from pathlib import Path
from xml.sax.saxutils import escape
import zipfile


def _clean_markdown(line: str) -> tuple[str, str | None, bool]:
    text = line.strip()
    style = None
    bold = False
    if text.startswith("### "):
        style = "Heading3"
        bold = True
        text = text[4:]
    elif text.startswith("## "):
        style = "Heading2"
        bold = True
        text = text[3:]
    elif text.startswith("# "):
        style = "Heading1"
        bold = True
        text = text[2:]
    elif text.startswith("- "):
        text = "- " + text[2:]
    elif text.startswith("> "):
        text = "Aviso: " + text[2:]

    if text.startswith("**") and text.endswith("**"):
        bold = True
        text = text.strip("*")
    text = text.replace("**", "")
    return text, style, bold


def _paragraph(line: str) -> str:
    text, style, bold = _clean_markdown(line)
    props = ""
    if style:
        props += f'<w:pStyle w:val="{style}"/>'
    if props:
        props = f"<w:pPr>{props}</w:pPr>"
    run_props = "<w:rPr><w:b/></w:rPr>" if bold else ""
    escaped = escape(text)
    return f"<w:p>{props}<w:r>{run_props}<w:t>{escaped}</w:t></w:r></w:p>"


def markdown_to_docx(markdown_text: str, output_path: str | Path) -> Path:
    """Escreve um .docx basico que abre no Word/LibreOffice."""
    output = Path(output_path)
    output.parent.mkdir(parents=True, exist_ok=True)

    body = "\n".join(_paragraph(line) for line in markdown_text.splitlines())
    document_xml = f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    {body}
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>
"""

    content_types = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>
"""

    relationships = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>
"""

    with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("[Content_Types].xml", content_types)
        archive.writestr("_rels/.rels", relationships)
        archive.writestr("word/document.xml", document_xml)

    return output
