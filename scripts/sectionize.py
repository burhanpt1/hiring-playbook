#!/usr/bin/env python3
"""
Build data/sections.json by splitting the current export (manifest.export_html)
into sections at each <h1>. No dependency on BeautifulSoup.
"""
from __future__ import annotations
import json, re
from pathlib import Path
from datetime import datetime

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "manifest.json"
DATA_DIR = ROOT / "data"

def slugify(s: str) -> str:
    s = s.lower()
    s = re.sub(r'[^a-z0-9\s\-]+', '', s)
    s = re.sub(r'\s+', '-', s).strip('-')
    return s or 'section'

def strip_tags(s: str) -> str:
    return re.sub(r'(?is)<[^>]+>', '', s).strip()

def split_by_h1(html: str):
    # Find all <h1> start positions with their complete tag content
    h1_iter = list(re.finditer(r'(?is)<h1\b[^>]*>.*?</h1\s*>', html))
    if not h1_iter:
        # Single synthetic section if no H1s
        title = "Document"
        return [{"title": title, "slug": slugify(title), "html": html}]

    sections = []
    for i, m in enumerate(h1_iter):
        start = m.start()
        end = h1_iter[i+1].start() if i+1 < len(h1_iter) else len(html)
        chunk = html[start:end]
        # Title is h1 inner text
        h1_inner = re.search(r'(?is)<h1\b[^>]*>(.*?)</h1\s*>', chunk).group(1)
        title = strip_tags(h1_inner) or f"Section {i+1}"
        sections.append({
            "title": title,
            "slug": slugify(title),
            "html": chunk
        })
    return sections

def main():
    if not MANIFEST.exists():
        raise SystemExit("manifest.json not found.")
    manifest = json.loads(MANIFEST.read_text("utf-8"))
    rel = manifest.get("export_html")
    if not rel:
        raise SystemExit("manifest.json missing 'export_html'.")
    export_path = (ROOT / rel).resolve()
    if not export_path.exists():
        raise SystemExit(f"Export not found: {export_path}")

    raw = export_path.read_text("utf-8", errors="ignore")
    sections = split_by_h1(raw)

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    out = {
        "source": rel,
        "generated_at": datetime.utcnow().isoformat() + "Z",
        "sections": sections
    }
    (DATA_DIR / "sections.json").write_text(json.dumps(out, ensure_ascii=False, indent=2), "utf-8")
    print(f"Wrote data/sections.json with {len(sections)} sections")

if __name__ == "__main__":
    main()
