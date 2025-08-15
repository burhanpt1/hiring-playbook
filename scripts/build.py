#!/usr/bin/env python3
"""
Produce a clean ./dist folder for static hosting (optional).
Copies the site files and current export pointed to by manifest.json.

Usage:
  python scripts/build.py
"""
from __future__ import annotations
import json, shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "dist"
EXPORTS = ROOT / "exports"
MANIFEST = ROOT / "manifest.json"
ASSETS = ["index.html", "styles.css", "main.js", "manifest.json"]

def main():
    if not MANIFEST.exists():
        raise SystemExit("manifest.json is missing. Run scripts/update_manifest.py first.")
    manifest = json.loads(MANIFEST.read_text("utf-8"))
    target = manifest.get("export_html")
    if not target:
        raise SystemExit("manifest.json missing 'export_html'")
    DIST.mkdir(parents=True, exist_ok=True)
    # copy assets
    for a in ASSETS:
        shutil.copy2(ROOT / a, DIST / a)
    # copy export
    exp_src = ROOT / target
    (DIST / "exports").mkdir(exist_ok=True)
    shutil.copy2(exp_src, DIST / target)
    print("Built ./dist")

if __name__ == "__main__":
    main()
