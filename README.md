# Cutover Run Sheet Dashboard

ResMed-branded web dashboard for **Cutover Run Sheet** task tracking (`Rpt Flag Auto` = Y, ~206 tasks).

**Live site:** https://nihal-bhatt.github.io/E2E-CutoverTaskPlanning/

## How data gets to the site (simple)

The dashboard reads **`data/dashboard.json`** on GitHub Pages. It does **not** pull SharePoint live (that needs IT app registration).

1. Edit the Excel file on [SharePoint](https://resmedglobalaus.sharepoint.com/sites/E2EPlanningtransformation/Shared%20Documents/2.%20Phase%201/5.%20Technical%20Solutions%20Capabilities/Cutover/Cutover%20RunSheet_GTS.xlsx).
2. Download the workbook.
3. Run `scripts/build_dashboard.py` → updates `data/dashboard.json`.
4. `git push` → site updates in ~2 minutes.

Details: **[docs/UPDATE_DATA.md](docs/UPDATE_DATA.md)**

The **refresh** icon on the site reloads the published JSON (after a push). The **SharePoint** link opens the file for editing only.

## Local preview

```bash
cd CutoverDashboard
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
export CUTOVER_XLSX="/path/to/Cutover RunSheet_GTS.xlsx"
.venv/bin/python scripts/build_dashboard.py
python3 -m http.server 8080
# http://localhost:8080
```

## Project layout

| Path | Purpose |
|------|---------|
| `index.html` | Dashboard |
| `js/dashboard.js` | Charts, team filter, detail pane |
| `data/dashboard.json` | Metrics (commit after each run sheet update) |
| `scripts/build_dashboard.py` | Excel → JSON |
| `.github/workflows/pages.yml` | Deploy to GitHub Pages |

## GitHub Pages setup

Settings → Pages → **Deploy from branch** → `gh-pages` → `/ (root)`.

Power BI queries: see `docs/` (`.pq`, `.m`, DAX).
