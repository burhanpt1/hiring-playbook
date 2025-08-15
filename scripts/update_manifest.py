#!/usr/bin/env python3
"""
Update manifest.json to point to the most recent .html file in ./exports/
Selection is by modification time (newest wins).

Usage:
  python scripts/update_manifest.py
"""
from __future__ import annotations
import json, os, sys, time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EXPORTS = ROOT / "exports"
MANIFEST = ROOT / "manifest.json"

def latest_export() -> Path:
    htmls = [p for p in EXPORTS.glob("*.html") if p.is_file()]
    if not htmls:
        raise SystemExit("No .html files found in ./exports")
    htmls.sort(key=lambda p: p.stat().st_mtime, reverse=True)
    return htmls[0]

def main():
    EXPORTS.mkdir(parents=True, exist_ok=True)
    latest = latest_export()
    manifest = {}
    if MANIFEST.exists():
        try:
            manifest = json.loads(MANIFEST.read_text("utf-8"))
        except Exception:
            manifest = {}
    manifest.setdefault("title", "Playbook")
    manifest["export_html"] = f"exports/{latest.name}"
    MANIFEST.write_text(json.dumps(manifest, indent=2), "utf-8")
    print("manifest.json ->", manifest["export_html"])

if __name__ == "__main__":
    main()
