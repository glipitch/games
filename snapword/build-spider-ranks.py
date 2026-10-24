"""Extract the bundled OFL DM Sans at weight 800 into deterministic card ranks.

Requires fonttools. The output is checked in; normal site builds need only Node.
"""
import json
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.transformPen import TransformPen

root = Path(__file__).resolve().parent
font = TTFont(root.parent / "assets/fonts/dm-sans.ttf")
axes = {axis.axisTag: max(axis.minValue, min(axis.maxValue, {"wght": 800, "opsz": 24}.get(axis.axisTag, axis.defaultValue))) for axis in font["fvar"].axes}
font = instantiateVariableFont(font, axes)
glyphs, cmap = font.getGlyphSet(), font.getBestCmap()
cap_height = font["OS/2"].sCapHeight
outlines = {}
for label in ["A", *map(str, range(2, 11)), "J", "Q", "K"]:
    bounds = BoundsPen(glyphs)
    advance = 0
    for char in label:
        glyph = glyphs[cmap[ord(char)]]
        glyph.draw(TransformPen(bounds, (1, 0, 0, 1, advance, 0)))
        advance += glyph.width
    left, bottom, right, top = bounds.bounds
    sy = 28 / cap_height
    # Keep equal cap height. Only the two-digit ten needs a condensed width.
    sx = min(sy, (26 if label == "10" else 24) / (right - left))
    offset = (32 - (right - left) * sx) / 2 - left * sx
    path = SVGPathPen(glyphs, ntos=lambda value: str(round(value, 3)))
    advance = 0
    for char in label:
        glyph = glyphs[cmap[ord(char)]]
        glyph.draw(TransformPen(path, (sx, 0, 0, -sy, offset + advance * sx, 2 + cap_height * sy)))
        advance += glyph.width
    outlines[label] = path.getCommands()
(root / "asset-sources/rank-outlines.json").write_text(json.dumps(outlines, separators=(",", ":")) + "\n", encoding="utf-8")
