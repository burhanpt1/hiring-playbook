# Playbook Wrapper

Constraints satisfied:
- No edits to the exported HTML.
- All styling and behavior is decoupled (external CSS/JS).
- Automated pipeline updates which HTML file is displayed when you drop a new export.

## Structure
- `index.html` — wrapper shell (entry for GitHub Pages).
- `styles.css` — decoupled CSS.
- `main.js` — fetches the export, strips inline styles, applies UX features.
- `manifest.json` — points to the current export file.
- `exports/` — place your exported `.html` file(s) here.
- `scripts/update-manifest.mjs` — selects the latest `.html` in `/exports` and updates `manifest.json`.
- `.github/workflows/deploy.yml` — CI to publish to Pages.

## How to use
1. Push this folder to a GitHub repo as the root of `main`.
2. Enable GitHub Pages for the repo (Source: GitHub Actions).
3. To update the book, drop a new `.html` export into `/exports` and push. The workflow auto-points `manifest.json` to the most recent `.html` by modification time.
4. No change to the export file is required.

## Reader UX
- Sticky, searchable sidebar TOC (built from `h1–h3`).
- Smooth scrolling + keyboard navigation (← →).
- Scroll progress bar.
- Client-side search with highlighting.
- Dark/light toggle with persistence.
- Self-links on headings.
- Clean typography, tables, code, and images.
