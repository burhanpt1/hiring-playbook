#!/usr/bin/env python3
import json, re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EXPORTS = ROOT / "exports"
MANIFEST = ROOT / "manifest.json"

TARGETS = {
  "scale": r"^SCALE.*\.html$",
  "hire": r"^HIRE.*\.html$",
  "train": r"^TRAIN.*\.html$",
  "reflect": r"^REFLECT.*\.html$",
  "fire": r"^FIRE.*\.html$",
  "references": r"^References.*\.html$"
}

def newest(paths):
  return max(paths, key=lambda p: p.stat().st_mtime)

def main():
  EXPORTS.mkdir(exist_ok=True)
  files = list(EXPORTS.glob("*.html"))
  if not files: raise SystemExit("No exports found in ./exports")

  sections = {}
  for key, pattern in TARGETS.items():
    matched = [p for p in files if re.search(pattern, p.name, flags=re.I)]
    if matched:
      sections[key] = f"exports/{newest(matched).name}"

  # Require at least the four primary sections
  for req in ["scale","hire","train","reflect"]:
    if req not in sections:
      print(f"WARNING: no export matched {req.upper()}*")

  manifest = {
    "title": "Scale, Hire, Train, Reflect",
    "sections": sections
  }
  MANIFEST.write_text(json.dumps(manifest, indent=2), "utf-8")
  print("manifest.json written with keys:", ", ".join(sorted(sections.keys())))

if __name__ == "__main__":
  main()
