#!/usr/bin/env python3
"""
Copy an input HTML into ./exports with a timestamped name, then update manifest.json.

Usage:
  python scripts/ingest.py /path/to/input.html [--title "My Title"]

Behavior:
  - Validates the source file ends with .html
  - Copies to ./exports/<basename>-<YYYYMMDD-HHMMSS>.html (to avoid collisions)
  - Runs update_manifest.py afterwards
"""
from __future__ import annotations
import argparse, shutil, sys
from pathlib import Path
from datetime import datetime
import json
import subprocess
import os

ROOT = Path(__file__).resolve().parents[1]
EXPORTS = ROOT / "exports"
MANIFEST = ROOT / "manifest.json"

def main():
    p = argparse.ArgumentParser()
    p.add_argument("html", help="Path to the exported HTML file")
    p.add_argument("--title", help="Optional site title to write into manifest.json")
    args = p.parse_args()

    src = Path(args.html).expanduser().resolve()
    if not src.exists() or src.suffix.lower() != ".html":
        sys.exit("Input must be an existing .html file")

    EXPORTS.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    dst = EXPORTS / f"{src.stem}-{stamp}.html"
    shutil.copyfile(src, dst)

    # Update manifest
    subprocess.check_call([sys.executable, str(ROOT / "scripts" / "update_manifest.py")])
        # Update manifest
    subprocess.check_call([sys.executable, str(ROOT / "scripts" / "update_manifest.py")])
    # Build sections.json
    subprocess.check_call([sys.executable, str(ROOT / "scripts" / "sectionize.py")])


    # Optional: set title
    if args.title:
        manifest = json.loads(MANIFEST.read_text("utf-8"))
        manifest["title"] = args.title
        MANIFEST.write_text(json.dumps(manifest, indent=2), "utf-8")
        print("manifest.json title ->", args.title)

    print("Ingested ->", dst.relative_to(ROOT))

if __name__ == "__main__":
    main()
