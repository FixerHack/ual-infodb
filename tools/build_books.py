"""Збирає assets/library-data-2.js з tools/books/*.py.

Кожен файл у tools/books/ визначає:
  AUTH = {"Ім'я Автора": ("роль", ["біо", ...])}
  BOOKS = [(id, назва, автор, жанр, видавництво, рік, сторінок, isbn, перекладач, коротко, [абзаци опису])]
Обкладинка: assets/library/<id>-front.jpg (або .svg — заглушка з tools/placeholder_cover.py).
python3 tools/build_books.py
"""
import json, os, re, runpy, glob

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
TR = dict(zip("абвгґдеєжзиіїйклмнопрстуфхцчшщьюя'’",
              ["a","b","v","h","g","d","e","ie","zh","z","y","i","i","i","k","l","m","n","o","p","r","s","t","u","f","kh","ts","ch","sh","shch","","iu","ia","",""]))

def slug(name):
    return re.sub(r"[^a-z0-9]+", "-", "".join(TR.get(c, c) for c in name.lower())).strip("-")

auth, books, seen = {}, [], set()
for f in sorted(glob.glob(os.path.join(ROOT, "tools", "books", "*.py"))):
    d = runpy.run_path(f)
    auth.update(d.get("AUTH", {}))
    for b in d["BOOKS"]:
        bid, title, author, genre, pub, year, pages, isbn, tr, short, desc = b
        assert bid not in seen, bid
        seen.add(bid)
        front = next((f"assets/library/{bid}-front.{e}" for e in ("jpg", "svg")
                      if os.path.exists(os.path.join(ROOT, "assets", "library", f"{bid}-front.{e}"))), None)
        if not front:  # немає фото в магазинах — робимо заглушку
            import placeholder_cover, zlib
            colors = ["#3b3f8f", "#7a2e3a", "#2f5d50", "#6b4c2a", "#34495e", "#5b3a70", "#8a5a1c", "#24506b"]
            name = author if not author.startswith("@") else ""
            placeholder_cover.make(bid, title, name, colors[zlib.crc32(bid.encode()) % len(colors)])
            front = f"assets/library/{bid}-front.svg"
            print("заглушка:", bid)
        aid = author[1:] if author.startswith("@") else slug(author) if author else ""
        o = {"id": bid, "title": title, "authorId": aid, "genre": genre}
        for k, v in (("publisher", pub), ("year", year), ("pages", pages), ("isbn", isbn), ("translator", tr)):
            if v: o[k] = int(v) if k in ("year", "pages") and str(v).isdigit() else v
        if front.endswith(".jpg"):  # альбомний/квадратний формат — показуємо цілком
            import subprocess
            out = subprocess.run(["sips", "-g", "pixelWidth", "-g", "pixelHeight", os.path.join(ROOT, front)], capture_output=True, text=True).stdout
            w, h = (int(x) for x in re.findall(r"pixel\w+: (\d+)", out))
            if w / h > 0.85: o["ratio"] = f"{w} / {h}"
        o.update(front=front, short=short, description=desc)
        books.append(o)
        if author and not author.startswith("@"):
            auth.setdefault(author, ("", []))

authors = {}
for name, (role, bio) in auth.items():
    authors[slug(name)] = {"name": name, "role": role, "bio": bio}

js = ("// Згенеровано tools/build_books.py з tools/books/*.py — правити там.\n"
      "Object.assign(AUTHORS, " + json.dumps(authors, ensure_ascii=False, indent=1) + ");\n"
      "BOOKS.push(..." + json.dumps(books, ensure_ascii=False, indent=1) + ");\n")
open(os.path.join(ROOT, "assets", "library-data-2.js"), "w", encoding="utf-8").write(js)
print(len(books), "книжок,", len(authors), "авторів")
