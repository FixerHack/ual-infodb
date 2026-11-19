"""Обкладинка-заглушка (SVG) для книжки, фото якої немає в магазинах.

python3 tools/placeholder_cover.py <id> "<назва>" "<автор>" "<#колір>"
→ assets/library/<id>-front.svg
"""
import sys, textwrap, html, os

def make(book_id, title, author, color="#3b3f8f"):
    lines = textwrap.wrap(title.upper(), 13)[:7]
    size = 40 if len(lines) <= 3 else 32
    y0 = 300 - (len(lines) - 1) * size * 0.6
    t = "".join(
        f'<text x="200" y="{y0 + i * size * 1.2:.0f}" font-size="{size}">{html.escape(l)}</text>' for i, l in enumerate(lines))
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 600" width="400" height="600">
<rect width="400" height="600" fill="{color}"/>
<rect x="18" y="18" width="364" height="564" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="2"/>
<rect x="0" y="0" width="14" height="600" fill="#000" fill-opacity=".22"/>
<g fill="#fff" font-family="Georgia, 'Times New Roman', serif" font-weight="700" text-anchor="middle">{t}</g>
<text x="200" y="520" fill="#fff" fill-opacity=".85" font-family="Helvetica, Arial, sans-serif" font-size="22" text-anchor="middle">{html.escape(author)}</text>
<text x="200" y="80" fill="#e4f04a" font-family="Helvetica, Arial, sans-serif" font-size="16" letter-spacing="4" text-anchor="middle">БІБЛІОТЕКА УАЛ</text>
</svg>'''
    out = os.path.join(os.path.dirname(__file__), "..", "assets", "library", f"{book_id}-front.svg")
    with open(out, "w", encoding="utf-8") as f:
        f.write(svg)
    return out

if __name__ == "__main__":
    print(make(*sys.argv[1:5]))
