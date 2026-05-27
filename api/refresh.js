const { downloadRunSheet } = require("./lib/sharepoint");
const { buildPayloadFromBuffer } = require("./lib/excelToDashboard");

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

module.exports = async (req, res) => {
  Object.entries(CORS).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const buffer = await downloadRunSheet();
    const payload = buildPayloadFromBuffer(buffer, {
      sharepointUrl: process.env.SHAREPOINT_URL,
      githubRepo: process.env.GITHUB_REPOSITORY || "Nihal-Bhatt/E2E-CutoverTaskPlanning",
    });

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json(payload);
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      error: err.message || "Refresh failed",
      hint: "Configure Azure AD app credentials on Vercel (see docs/SHAREPOINT_BACKEND.md)",
    });
  }
};
