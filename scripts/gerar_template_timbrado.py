#!/usr/bin/env python3
"""Gera um DOCX timbrado inicial (cabeçalho/rodapé Flying) até o arquivo oficial ser importado."""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from docx import Document

from flying.docx_writer import _setup_footer, _setup_header

DESTINOS = [
    ROOT / "web" / "assets" / "TIMBRADO_FLYINGSTUDIO.docx",
    ROOT / "flying" / "papel_timbrado" / "TIMBRADO_FLYINGSTUDIO.docx",
]


def main() -> int:
    doc = Document()
    _setup_header(doc)
    _setup_footer(doc)
    doc.add_paragraph("")
    for dest in DESTINOS:
        dest.parent.mkdir(parents=True, exist_ok=True)
        doc.save(str(dest))
        print(f"OK: {dest}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
