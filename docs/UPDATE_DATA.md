# Update dashboard data (simple — no Vercel / Azure)

The website reads **`data/dashboard.json`** from GitHub. It does **not** connect to SharePoint automatically (that would require IT app registration).

## After you edit the run sheet on SharePoint

1. Open the file in SharePoint and download a copy (or sync locally).
2. On your Mac, from the project folder:

```bash
cd /Users/Nihal_Bhatt/CutoverDashboard
export CUTOVER_XLSX="/path/to/Cutover RunSheet_GTS.xlsx"
.venv/bin/python scripts/build_dashboard.py
```

3. Commit and push:

```bash
git add data/dashboard.json
git commit -m "Update dashboard data from run sheet"
git push origin main
```

4. Wait ~2 minutes for GitHub Actions to deploy, then click **refresh** on the site (or hard-refresh the browser).

## SharePoint link on the dashboard

**Open run sheet in SharePoint** only opens the file in your browser (you sign in with ResMed). It does not update the dashboard by itself.

## Who can update?

Anyone with access to this GitHub repo can run the steps above. No extra registrations needed.
