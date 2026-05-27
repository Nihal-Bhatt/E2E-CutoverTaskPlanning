/** Shared data loading: static JSON or live SharePoint via Vercel API */

async function fetchStaticJson() {
  const res = await fetch(`data/dashboard.json?t=${Date.now()}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Could not load dashboard.json (${res.status})`);
  return res.json();
}

async function fetchLiveFromApi() {
  const api = window.DASHBOARD_CONFIG?.apiRefreshUrl;
  if (!api) return null;
  const url = api.includes("?") ? `${api}&t=${Date.now()}` : `${api}?t=${Date.now()}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `API refresh failed (${res.status})`);
  }
  return res.json();
}

/** Initial page load — fast static file */
async function loadDashboardData() {
  return fetchStaticJson();
}

/** User clicked Refresh — prefer live SharePoint API when configured */
async function refreshDashboardData() {
  const api = window.DASHBOARD_CONFIG?.apiRefreshUrl;
  if (api) {
    return fetchLiveFromApi();
  }
  return fetchStaticJson();
}

function hasLiveRefresh() {
  return Boolean(window.DASHBOARD_CONFIG?.apiRefreshUrl);
}
