"""Обкладинка-заглушка (SVG) для книжки, фото якої немає в магазинах.

python3 tools/placeholder_cover.py <id> "<назва>" "<автор>" "<#колір>"
→ assets/library/<id>-front.svg
"""
import sys, textwrap, html, os

W, INNER = 400, 300  # ширина обкладинки і ширина, в яку має влізти текст


def fit(text, max_size, min_size, max_lines, char_w):
    """Підбирає розмір шрифту й переноси, щоб текст не вилазив за рамку."""
    for size in range(max_size, min_size - 1, -2):
        per_line = max(6, int(INNER / (size * char_w)))
        lines = textwrap.wrap(text, per_line, break_long_words=False)
        if len(lines) <= max_lines and all(len(l) * size * char_w <= INNER for l in lines):
            return size, lines
    per_line = max(6, int(INNER / (min_size * char_w)))
    return min_size, textwrap.wrap(text, per_line)[:max_lines]


def make(book_id, title, author, color="#3b3f8f"):
    size, lines = fit(title.upper(), 40, 18, 9, 0.84)
    y0 = 290 - (len(lines) - 1) * size * 0.6
    t = "".join(f'<text x="200" y="{y0 + i * size * 1.2:.0f}" font-size="{size}">{html.escape(l)}</text>' for i, l in enumerate(lines))
    asize, alines = fit(author, 22, 13, 2, 0.6) if author else (22, [])
    a = "".join(f'<text x="200" y="{525 - (len(alines) - 1 - i) * asize * 1.25:.0f}" font-size="{asize}">{html.escape(l)}</text>' for i, l in enumerate(alines))
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 600" width="400" height="600">
<rect width="400" height="600" fill="{color}"/>
<rect x="18" y="18" width="364" height="564" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="2"/>
<rect x="0" y="0" width="14" height="600" fill="#000" fill-opacity=".22"/>
<g fill="#fff" font-family="Georgia, 'Times New Roman', serif" font-weight="700" text-anchor="middle">{t}</g>
<g fill="#fff" fill-opacity=".85" font-family="Helvetica, Arial, sans-serif" text-anchor="middle">{a}</g>
<text x="200" y="80" fill="#e4f04a" font-family="Helvetica, Arial, sans-serif" font-size="16" letter-spacing="4" text-anchor="middle">БІБЛІОТЕКА УАЛ</text>
</svg>'''
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets", "library", f"{book_id}-front.svg")
    with open(out, "w", encoding="utf-8") as f:
        f.write(svg)
    return out


if __name__ == "__main__":
    print(make(*sys.argv[1:5]))
