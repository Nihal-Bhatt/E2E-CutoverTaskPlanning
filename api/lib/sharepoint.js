const HOST = "resmedglobalaus.sharepoint.com";
const SITE_PATH = "/sites/E2EPlanningtransformation";
const FILE_PATH =
  "Shared Documents/2. Phase 1/5. Technical Solutions Capabilities/Cutover/Cutover RunSheet_GTS.xlsx";

async function getAccessToken() {
  if (process.env.MS_GRAPH_TOKEN) {
    return process.env.MS_GRAPH_TOKEN;
  }

  const tenant = process.env.AZURE_TENANT_ID;
  const clientId = process.env.AZURE_CLIENT_ID;
  const clientSecret = process.env.AZURE_CLIENT_SECRET;
  if (!tenant || !clientId || !clientSecret) {
    throw new Error(
      "Missing credentials: set AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET (or MS_GRAPH_TOKEN)"
    );
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials",
  });

  const res = await fetch(
    `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`,
    { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body }
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Azure AD token failed: ${res.status} ${err}`);
  }
  const json = await res.json();
  return json.access_token;
}

async function downloadRunSheet() {
  const token = await getAccessToken();
  const headers = { Authorization: `Bearer ${token}` };

  const siteRes = await fetch(
    `https://graph.microsoft.com/v1.0/sites/${HOST}:${SITE_PATH}`,
    { headers }
  );
  if (!siteRes.ok) throw new Error(`Graph site lookup failed: ${siteRes.status}`);
  const siteId = (await siteRes.json()).id;

  const encoded = encodeURI(FILE_PATH);
  const fileRes = await fetch(
    `https://graph.microsoft.com/v1.0/sites/${siteId}/drive/root:/${encoded}:/content`,
    { headers }
  );
  if (!fileRes.ok) throw new Error(`Graph file download failed: ${fileRes.status}`);
  return Buffer.from(await fileRes.arrayBuffer());
}

module.exports = { downloadRunSheet, getAccessToken };
