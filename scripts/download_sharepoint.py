#!/usr/bin/env python3
"""Download Cutover run sheet from SharePoint via Microsoft Graph."""
from __future__ import annotations

import os
import sys
from pathlib import Path
from urllib.parse import quote

import requests

HOST = "resmedglobalaus.sharepoint.com"
SITE_PATH = "/sites/E2EPlanningtransformation"
FILE_PATH = (
    "Shared Documents/2. Phase 1/5. Technical Solutions Capabilities/"
    "Cutover/Cutover RunSheet_GTS.xlsx"
)

DEFAULT_SHAREPOINT_URL = (
    "https://resmedglobalaus.sharepoint.com/sites/E2EPlanningtransformation/"
    "Shared%20Documents/2.%20Phase%201/5.%20Technical%20Solutions%20"
    "Capabilities/Cutover/Cutover%20RunSheet_GTS.xlsx"
)


def download_via_graph(token: str, dest: Path) -> Path:
    dest.parent.mkdir(parents=True, exist_ok=True)
    headers = {"Authorization": f"Bearer {token}"}

    site_url = f"https://graph.microsoft.com/v1.0/sites/{HOST}:{SITE_PATH}"
    site_resp = requests.get(site_url, headers=headers, timeout=120)
    site_resp.raise_for_status()
    site_id = site_resp.json()["id"]

    encoded_path = quote(FILE_PATH)
    file_url = (
        f"https://graph.microsoft.com/v1.0/sites/{site_id}"
        f"/drive/root:/{encoded_path}:/content"
    )
    file_resp = requests.get(file_url, headers=headers, timeout=180)
    file_resp.raise_for_status()
    dest.write_bytes(file_resp.content)
    return dest


def main() -> None:
    token = os.environ.get("MS_GRAPH_TOKEN", "").strip()
    if not token:
        print("Set MS_GRAPH_TOKEN (Microsoft Graph access token with Files.Read)", file=sys.stderr)
        sys.exit(1)
    dest = Path(sys.argv[1] if len(sys.argv) > 1 else "data/_cache/Cutover RunSheet_GTS.xlsx")
    download_via_graph(token, dest)
    print(f"Downloaded to {dest}")


if __name__ == "__main__":
    main()
