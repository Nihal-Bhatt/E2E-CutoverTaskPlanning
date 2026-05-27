#!/usr/bin/env python3
"""Build dashboard.json from Cutover Run Sheet (SharePoint or local Excel)."""
from __future__ import annotations

import json
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SHAREPOINT_URL = (
    "https://resmedglobalaus.sharepoint.com/sites/E2EPlanningtransformation/"
    "Shared%20Documents/2.%20Phase%201/5.%20Technical%20Solutions%20"
    "Capabilities/Cutover/Cutover%20RunSheet_GTS.xlsx"
)
OUTPUT = ROOT / "data" / "dashboard.json"
CACHE_XLSX = ROOT / "data" / "_cache" / "Cutover RunSheet_GTS.xlsx"
SGT = timezone(timedelta(hours=8))


def load_tasks(path: Path) -> pd.DataFrame:
    df = pd.read_excel(path, sheet_name="Cutover Run Sheet", header=4)
    df = df[df["Rpt Flag Auto"] == "Y"].copy()
    df["status_key"] = df["Status"].replace(
        {"Complete": "completed", "In Progress": "inProgress", "Not Started": "notStarted"}
    )
    df["is_late"] = df["Late"] == "Y"
    return df


def fmt_date(val) -> str:
    if val is None or (isinstance(val, float) and pd.isna(val)):
        return ""
    if pd.isna(val):
        return ""
    if hasattr(val, "strftime"):
        return val.strftime("%Y-%m-%d")
    return str(val)


def task_records(df: pd.DataFrame) -> list[dict]:
    cols = [
        "Task Id",
        "Task Name",
        "Category",
        "Team",
        "Status",
        "Late",
        "Assignee",
        "Cutover Phase",
        "RAG",
        "Mand for GoLive",
        "Critical Path",
        "Planned End Date",
        "Planned Start Date",
    ]
    rows = []
    for _, r in df.iterrows():
        rows.append(
            {
                "id": str(r.get("Task Id", "") or ""),
                "name": str(r.get("Task Name", "") or ""),
                "category": str(r.get("Category", "") or ""),
                "team": (
                    str(r.get("Team", "") or "").strip()
                    if pd.notna(r.get("Team"))
                    and str(r.get("Team", "")).strip().lower() != "nan"
                    else ""
                ),
                "status": str(r.get("Status", "") or ""),
                "statusKey": str(r.get("status_key", "") or ""),
                "late": bool(r.get("is_late")),
                "assignee": str(r.get("Assignee", "") or ""),
                "phase": str(r.get("Cutover Phase", "") or "") or "Unspecified",
                "rag": str(r.get("RAG", "") or "") or "—",
                "mandGoLive": str(r.get("Mand for GoLive", "") or ""),
                "criticalPath": str(r.get("Critical Path", "") or ""),
                "plannedEnd": fmt_date(r.get("Planned End Date")),
                "plannedStart": fmt_date(r.get("Planned Start Date")),
            }
        )
    return rows


def aggregate_group(df: pd.DataFrame, column: str) -> list[dict]:
    rows: list[dict] = []
    for name, g in df.groupby(column, sort=False):
        if pd.isna(name) or str(name).strip() == "":
            continue
        ns = int((g["status_key"] == "notStarted").sum())
        ip = int((g["status_key"] == "inProgress").sum())
        co = int((g["status_key"] == "completed").sum())
        late = int(g["is_late"].sum())
        rows.append(
            {
                "name": str(name),
                "notStarted": ns,
                "inProgress": ip,
                "completed": co,
                "total": len(g),
                "delayed": late,
            }
        )
    rows.sort(key=lambda r: r["total"], reverse=True)
    return rows


def overall_row(df: pd.DataFrame) -> dict:
    ns = int((df["status_key"] == "notStarted").sum())
    ip = int((df["status_key"] == "inProgress").sum())
    co = int((df["status_key"] == "completed").sum())
    late = int(df["is_late"].sum())
    return {
        "name": "Overall",
        "notStarted": ns,
        "inProgress": ip,
        "completed": co,
        "total": len(df),
        "delayed": late,
    }


def rag_summary(df: pd.DataFrame) -> list[dict]:
    rows = []
    for name, g in df.groupby("RAG", dropna=False):
        label = str(name) if pd.notna(name) and str(name).strip() else "—"
        rows.append({"name": label, "total": len(g), "delayed": int(g["is_late"].sum())})
    rows.sort(key=lambda r: r["total"], reverse=True)
    return rows


def build_payload(df: pd.DataFrame, source_label: str) -> dict:
    total = len(df)
    completed = int((df["status_key"] == "completed").sum())
    delayed = int(df["is_late"].sum())
    pct = round(100 * completed / total) if total else 0
    now_sgt = datetime.now(SGT)
    hour = int(now_sgt.strftime("%I"))
    status_as_of = f"{hour}:{now_sgt.strftime('%M')}{now_sgt.strftime('%p').lower()} SGT"

    tasks = task_records(df)
    sharepoint_url = os.environ.get("SHAREPOINT_URL", DEFAULT_SHAREPOINT_URL)

    return {
        "meta": {
            "title": "Cutover Tracking",
            "subtitle": f"{delayed} tasks are delayed, {pct}% tasks completed",
            "statusAsOf": status_as_of,
            "generatedAt": now_sgt.isoformat(),
            "source": source_label,
            "sharepointUrl": sharepoint_url,
            "githubRepo": os.environ.get(
                "GITHUB_REPOSITORY", "Nihal-Bhatt/E2E-CutoverTaskPlanning"
            ),
            "workflowFile": "pages.yml",
            "totalTasks": total,
            "completedTasks": completed,
            "delayedTasks": delayed,
            "pctComplete": pct,
            "mandGoLive": int((df["Mand for GoLive"] == "Yes").sum()),
            "criticalPath": int((df["Critical Path"] == "Yes").sum()),
        },
        "tasks": tasks,
        "byCategory": [overall_row(df)] + aggregate_group(df, "Category"),
        "byTeam": aggregate_group(df, "Team"),
        "byPhase": aggregate_group(
            df.assign(
                phase=df["Cutover Phase"]
                .fillna("Unspecified")
                .astype(str)
                .replace({"": "Unspecified", "nan": "Unspecified"})
            ),
            "phase",
        ),
        "byRag": rag_summary(df),
        "lateTasks": [t for t in tasks if t["late"]],
        "summary": {
            "notStarted": int((df["status_key"] == "notStarted").sum()),
            "inProgress": int((df["status_key"] == "inProgress").sum()),
            "completed": completed,
        },
    }


def resolve_excel_path() -> tuple[Path, str]:
    env_path = os.environ.get("CUTOVER_XLSX", "").strip()
    if env_path and Path(env_path).exists():
        return Path(env_path), Path(env_path).name

    default = Path.home() / "Downloads" / "Cutover RunSheet_GTS (1).xlsx"
    if default.exists():
        return default, default.name

    if CACHE_XLSX.exists():
        return CACHE_XLSX, "cached workbook"

    raise FileNotFoundError(
        "Excel not found. Set CUTOVER_XLSX=/path/to/Cutover RunSheet_GTS.xlsx "
        "(download from SharePoint first)."
    )


def main() -> None:
    try:
        xlsx, label = resolve_excel_path()
    except FileNotFoundError as e:
        if OUTPUT.exists():
            print(f"Warning: {e}. Keeping existing {OUTPUT}", file=sys.stderr)
            return
        print(e, file=sys.stderr)
        sys.exit(1)

    df = load_tasks(xlsx)
    payload = build_payload(df, label)
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(f"Wrote {OUTPUT} ({payload['meta']['totalTasks']} tasks) from {label}")


if __name__ == "__main__":
    main()
