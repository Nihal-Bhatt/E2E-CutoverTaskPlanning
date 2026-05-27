# Cutover Run Sheet Dashboard

ResMed-branded web dashboard for **Cutover Run Sheet** task tracking. Data is built from the Excel run sheet (same logic as Power BI: `Rpt Flag Auto` = Y, ~206 tasks).

![Dashboard preview](assets/resmed-logo.png)

## Quick start (local)

```bash
cd CutoverDashboard
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt

# Point to your Excel file (or default ~/Downloads/Cutover RunSheet_GTS (1).xlsx)
export CUTOVER_XLSX="/path/to/Cutover RunSheet_GTS.xlsx"
.venv/bin/python scripts/build_dashboard.py

# Serve locally
python3 -m http.server 8080
# Open http://localhost:8080
```

## Project layout

| Path | Purpose |
|------|---------|
| `index.html` | Dashboard page |
| `css/styles.css` | ResMed black / blue / purple theme |
| `js/dashboard.js` | Renders charts from JSON |
| `data/dashboard.json` | Generated metrics (commit this for GitHub Pages) |
| `scripts/build_dashboard.py` | Excel → JSON |
| `assets/resmed-logo.png` | Header logo |
| `.github/workflows/pages.yml` | Build & GitHub Pages deploy |

## GitHub Pages

1. Push this repo to GitHub.
2. **Settings → Pages → Build and deployment → GitHub Actions**.
3. On push to `main`, the workflow deploys the site.
4. Optional: set repo variable `CUTOVER_XLSX` in Actions if you add the workbook to the runner (usually commit `data/dashboard.json` instead).

Refresh data before push:

```bash
.venv/bin/python scripts/build_dashboard.py
git add data/dashboard.json && git commit -m "Update dashboard data"
```

## SharePoint

The dashboard does not read SharePoint live in the browser. Refresh flow:

1. Update the Excel file on SharePoint.
2. Download or sync locally → run `build_dashboard.py` → commit `dashboard.json` (or automate via GitHub Actions + Microsoft Graph later).

## Power BI

See `docs/` for Power Query (`.pq`, `.m`) and DAX (`dax-measures.txt`) if you use Power BI instead of or alongside this site.

## Brand colors

| Token | Hex | Use |
|-------|-----|-----|
| Background | `#000000` | Page |
| Blue | `#0096D6` | In progress |
| Purple | `#7D51A1` | Accents |
| Magenta | `#C51B7D` | Completed KPI |
| Red | `#E31B23` | Delayed |
| Not started | `#C4B5E8` | Bar segment |
| Completed bar | `#2D1B4E` | Bar segment |
