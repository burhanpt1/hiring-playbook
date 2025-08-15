# Replace the GitHub Actions flow with a local Python-driven workflow.
# - Remove .github/workflows
# - Add scripts/update_manifest.py (pure Python replacement)
# - Add scripts/ingest.py to copy an input HTML into /exports, stamp it, and update manifest
# - Add scripts/build.py to produce a clean /dist ready for static hosting (optional)
# - Update README with the local workflow
# - Re-zip deliverable

import os, shutil, json, zipfile, textwrap, datetime, pathlib

root = "./"
scripts_dir = os.path.join(root, "scripts")
exports_dir = os.path.join(root, "exports")

# Remove GitHub Actions workflow if present
gha_dir = os.path.join(root, ".github")
if os.path.exists(gha_dir):
    shutil.rmtree(gha_dir)

# Create update_manifest.py
update_manifest_py = r'''#!/usr/bin/env python3
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
'''
with open(os.path.join(scripts_dir, "update_manifest.py"), "w", encoding="utf-8") as f:
    f.write(update_manifest_py)

# Create ingest.py
ingest_py = r'''#!/usr/bin/env python3
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

    # Optional: set title
    if args.title:
        manifest = json.loads(MANIFEST.read_text("utf-8"))
        manifest["title"] = args.title
        MANIFEST.write_text(json.dumps(manifest, indent=2), "utf-8")
        print("manifest.json title ->", args.title)

    print("Ingested ->", dst.relative_to(ROOT))

if __name__ == "__main__":
    main()
'''
with open(os.path.join(scripts_dir, "ingest.py"), "w", encoding="utf-8") as f:
    f.write(ingest_py)

# Create build.py for optional dist folder (copies as-is; Pages can serve root or /docs)
build_py = r'''#!/usr/bin/env python3
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
'''
with open(os.path.join(scripts_dir, "build.py"), "w", encoding="utf-8") as f:
    f.write(build_py)

# Update README with local workflow
readme_path = os.path.join(root, "README.md")
readme = open(readme_path, "r", encoding="utf-8").read()

readme_local = """
## Local workflow (no GitHub Actions)

### One-time
- Put these files at your repo root (or any static host).
- Ensure `scripts/` is kept in the repo (do not gitignore it).

### For each new export
1. Place your exported HTML anywhere on your machine.
2. Run:  
   `python scripts/ingest.py /path/to/input.html --title "Playbook Title"` (title optional)
   - This copies the file into `./exports/` with a timestamped name and updates `manifest.json`.
3. Optional: `python scripts/build.py` to assemble a clean `./dist` folder.
4. Deploy:
   - If using GitHub Pages without Actions: set Pages to serve from the repository **root** or from **/docs**.  
     - If serving from root, commit and push the root files and `exports/`.  
     - If serving from /docs, move the contents of `./dist` to `./docs` and push.
   - Any static host works: upload the same files.

### What not to ignore
- Keep `scripts/`, `manifest.json`, and the files inside `exports/` under version control. They are required for deployment.
"""

open(readme_path, "w", encoding="utf-8").write(readme + readme_local)

# Make scripts executable-ish (not necessary on Windows/Pages, but fine locally)
for name in ["update_manifest.py", "ingest.py", "build.py"]:
    p = os.path.join(scripts_dir, name)
    os.chmod(p, 0o755)


