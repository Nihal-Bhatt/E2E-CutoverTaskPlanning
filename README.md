# Cutover Run Sheet Dashboard

ResMed-branded web dashboard for **Cutover Run Sheet** task tracking. Data is built from the Excel run sheet (same logic as Power BI: `Rpt Flag Auto` = Y, ~206 tasks).

![Dashboard preview](assets/resmed-logo.png)

## Tabs

| Page | URL |
|------|-----|
| **Overview** | `index.html` — KPIs, category/team charts |
| **Gantt** | `gantt.html` — timeline by category, expand for tasks, red = delayed |

## Live SharePoint refresh (backend)

GitHub Pages cannot call SharePoint directly. For **one-click Refresh** without opening GitHub Actions, deploy the API on **Vercel** and set `apiRefreshUrl` in `js/config.js`.

Full setup: **[docs/SHAREPOINT_BACKEND.md](docs/SHAREPOINT_BACKEND.md)**

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

### One-time setup (fixes deploy 404)

1. Push code to `main` and wait for the **Build and deploy dashboard** workflow to finish (green).
2. Open [Pages settings](https://github.com/Nihal-Bhatt/E2E-CutoverTaskPlanning/settings/pages).
3. Under **Build and deployment** → **Source**, choose **Deploy from a branch**.
4. **Branch:** `gh-pages` → folder **`/ (root)`** → **Save**.
5. Open the site (after 1–2 minutes):  
   **https://nihal-bhatt.github.io/E2E-CutoverTaskPlanning/**

If deploy failed before: re-run the workflow from the **Actions** tab after step 4.

### Updates

On each push to `main`, Actions rebuilds and updates `gh-pages`.

Refresh data before push:

```bash
.venv/bin/python scripts/build_dashboard.py
git add data/dashboard.json && git commit -m "Update dashboard data"
```

## SharePoint (source of truth)

**Run sheet:** [Cutover RunSheet_GTS.xlsx](https://resmedglobalaus.sharepoint.com/sites/E2EPlanningtransformation/Shared%20Documents/2.%20Phase%201/5.%20Technical%20Solutions%20Capabilities/Cutover/Cutover%20RunSheet_GTS.xlsx) — linked in the dashboard header.

The website reads `data/dashboard.json` (not SharePoint directly in the browser). Refresh:

### Option A — Pull from SharePoint (recommended for automation)

1. Register an Azure AD app with **Files.Read.All** (application) or use a delegated token.
2. Add GitHub secret **`MS_GRAPH_TOKEN`** (valid Graph access token).
3. Push to `main` — Actions runs `build_dashboard.py` every 6 hours and on each push.

Local:

```bash
export MS_GRAPH_TOKEN="your-token"
export SHAREPOINT_URL="https://resmedglobalaus.sharepoint.com/sites/..."
.venv/bin/python scripts/build_dashboard.py
```

### Option B — Manual (no Graph token)

1. Download the file from SharePoint.
2. `CUTOVER_XLSX=/path/to/Cutover RunSheet_GTS.xlsx .venv/bin/python scripts/build_dashboard.py`
3. `git add data/dashboard.json && git push`

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
