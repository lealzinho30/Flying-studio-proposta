#!/usr/bin/env python3
"""Adiciona margem de segurança nos PNGs da marca (evita aparência de logo recortada)."""
from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "web" / "assets"
# Export original sem margem (uma vez) → flying_logo_source.png; não sobrescrever depois.
SRC = ASSETS / "flying_logo_source.png"
if not SRC.exists():
    SRC = ASSETS / "flying_logo_hi.png"

# Margens em pixels na versão 610×238 (proporcionais ao redimensionar).
PAD_HI = dict(top=32, right=24, bottom=24, left=20)


def _content_bbox(im: Image.Image) -> tuple[int, int, int, int]:
    rgba = im.convert("RGBA")
    px = rgba.load()
    w, h = rgba.size
    minx, miny, maxx, maxy = w, h, 0, 0
    found = False
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a < 16:
                continue
            if r > 245 and g > 245 and b > 245:
                continue
            found = True
            minx = min(minx, x)
            miny = min(miny, y)
            maxx = max(maxx, x)
            maxy = max(maxy, y)
    if not found:
        return 0, 0, w, h
    return minx, miny, maxx + 1, maxy + 1


def add_padding(im: Image.Image, *, top: int, right: int, bottom: int, left: int) -> Image.Image:
    im = im.convert("RGBA")
    w, h = im.size
    out = Image.new("RGBA", (w + left + right, h + top + bottom), (255, 255, 255, 255))
    out.paste(im, (left, top), im)
    return out.convert("RGB")


def main() -> int:
    if not SRC.exists():
        print(f"Fonte não encontrada: {SRC}")
        return 1

    base = Image.open(SRC)
    padded = add_padding(base, **PAD_HI)

    destinos_hi = [
        ROOT / "web" / "assets" / "flying_logo_hi.png",
        ROOT / "web" / "assets" / "flying_logo_header_exact.png",
    ]
    for d in destinos_hi:
        padded.save(d, optimize=True)
        print(f"OK {d} ({padded.size[0]}×{padded.size[1]})")

    # Versão menor para Python / referência (~50%)
    small = padded.resize((305, round(padded.size[1] * 305 / padded.size[0])), Image.Resampling.LANCZOS)
    for d in [
        ROOT / "web" / "assets" / "flying_logo.png",
        ROOT / "flying" / "flying_logo.png",
    ]:
        small.save(d, optimize=True)
        print(f"OK {d} ({small.size[0]}×{small.size[1]})")

    x0, y0, x1, y1 = _content_bbox(padded)
    print(
        f"Margens após ajuste (hi): topo={y0}, esq={x0}, "
        f"dir={padded.size[0]-x1}, baixo={padded.size[1]-y1}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
