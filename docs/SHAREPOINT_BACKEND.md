# SharePoint backend refresh (no GitHub Actions page)

GitHub Pages is **static only** — it cannot call SharePoint from the browser without login.  
To let anyone click **Refresh** and pull live data **without leaving the dashboard**, deploy the **API on Vercel** (free tier is enough).

## Architecture

```text
User clicks Refresh
    → GET /api/refresh (Vercel serverless)
    → Azure AD app token (server secret)
    → Microsoft Graph downloads Cutover RunSheet_GTS.xlsx
    → Parse Excel → JSON returned to browser
    → Dashboard + Gantt update in place
```

The **SharePoint link** in the header still opens the file in SharePoint (users sign in with ResMed M365).  
Only the **API** uses an app registration — visitors do not need GitHub or Azure tokens.

---

## Step 1 — Azure AD app (IT / admin)

1. [Azure Portal](https://portal.azure.com) → **Microsoft Entra ID** → **App registrations** → **New registration**
2. Name: `Cutover Dashboard API`
3. Supported account types: **Single tenant** (ResMed only)
4. Register → note **Application (client) ID** and **Directory (tenant) ID**
5. **Certificates & secrets** → **New client secret** → copy the secret value
6. **API permissions** → **Add permission** → **Microsoft Graph** → **Application permissions**:
   - `Sites.Read.All` (or `Files.Read.All`)
7. **Grant admin consent** for ResMed tenant

---

## Step 2 — Deploy to Vercel

1. Sign in at [vercel.com](https://vercel.com) with GitHub
2. **Add New Project** → import `Nihal-Bhatt/E2E-CutoverTaskPlanning`
3. Framework: **Other** (static root + serverless `api/`)
4. **Environment variables** (Production):

| Variable | Value |
|----------|--------|
| `AZURE_TENANT_ID` | Directory (tenant) ID |
| `AZURE_CLIENT_ID` | Application (client) ID |
| `AZURE_CLIENT_SECRET` | Client secret |
| `SHAREPOINT_URL` | Full URL to Cutover RunSheet_GTS.xlsx |

5. Deploy → note URL e.g. `https://e2e-cutover-task-planning.vercel.app`

---

## Step 3 — Point the dashboard at the API

Edit `js/config.js`:

```javascript
window.DASHBOARD_CONFIG = {
  githubRepo: "Nihal-Bhatt/E2E-CutoverTaskPlanning",
  workflowFile: "pages.yml",
  defaultBranch: "main",
  apiRefreshUrl: "https://YOUR-PROJECT.vercel.app/api/refresh",
};
```

Commit and push. GitHub Pages site will call Vercel on refresh (CORS enabled).

**Optional:** Deploy the **whole app** on Vercel instead of GitHub Pages — then `apiRefreshUrl` can be `/api/refresh` (same origin).

---

## Step 4 — Test

1. Open dashboard → click refresh icon  
2. Toast: “Fetching from SharePoint…” then “Dashboard updated”  
3. No GitHub Actions tab should open  

If API fails, check Vercel **Functions** logs for Graph permission errors.

---

## GitHub Actions (optional)

Scheduled sync to `data/dashboard.json` on `main` can still run for users who only open GitHub Pages **without** clicking Refresh. Set secret `MS_GRAPH_TOKEN` on GitHub if you keep the workflow.

---

## Security notes

- Never put client secret in `config.js` or the repo — **Vercel env only**
- App registration uses **application** permissions (daemon), not user passwords
- Restrict Vercel project to your team if the API URL is public (anyone with URL can read run sheet data)
