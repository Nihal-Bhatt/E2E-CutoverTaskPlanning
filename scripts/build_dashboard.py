#!/usr/bin/env python3
"""Build dashboard.json from Cutover Run Sheet Excel."""
from __future__ import annotations

import json
import os
import sys
from collections import OrderedDict
from datetime import datetime, timezone, timedelta
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_XLSX = Path.home() / "Downloads" / "Cutover RunSheet_GTS (1).xlsx"
OUTPUT = ROOT / "data" / "dashboard.json"
SGT = timezone(timedelta(hours=8))


def load_tasks(path: Path) -> pd.DataFrame:
    df = pd.read_excel(path, sheet_name="Cutover Run Sheet", header=4)
    df = df[df["Rpt Flag Auto"] == "Y"].copy()
    df["status_key"] = df["Status"].replace(
        {"Complete": "completed", "In Progress": "inProgress", "Not Started": "notStarted"}
    )
    df["is_late"] = df["Late"] == "Y"
    return df


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


def build_payload(df: pd.DataFrame, source: str) -> dict:
    total = len(df)
    completed = int((df["status_key"] == "completed").sum())
    delayed = int(df["is_late"].sum())
    pct = round(100 * completed / total) if total else 0
    now_sgt = datetime.now(SGT)
    hour = int(now_sgt.strftime("%I"))
    status_as_of = f"{hour}:{now_sgt.strftime('%M')}{now_sgt.strftime('%p').lower()} SGT"

    by_category = [overall_row(df)] + aggregate_group(df, "Category")
    by_team = aggregate_group(df, "Team")

    late_tasks = (
        df[df["is_late"]][
            ["Task Id", "Task Name", "Category", "Team", "Status", "Assignee", "Planned End Date"]
        ]
        .fillna("")
        .to_dict(orient="records")
    )
    for row in late_tasks:
        if hasattr(row.get("Planned End Date"), "strftime"):
            row["Planned End Date"] = row["Planned End Date"].strftime("%Y-%m-%d")

    return {
        "meta": {
            "generatedAt": now_sgt.isoformat(),
            "statusAsOf": status_as_of,
            "source": source,
            "totalTasks": total,
            "completedTasks": completed,
            "delayedTasks": delayed,
            "pctComplete": pct,
            "title": f"Cutover Plan | {delayed} tasks are delayed; {pct}% tasks completed",
        },
        "byCategory": by_category,
        "byTeam": by_team,
        "lateTasks": late_tasks,
        "summary": {
            "notStarted": int((df["status_key"] == "notStarted").sum()),
            "inProgress": int((df["status_key"] == "inProgress").sum()),
            "completed": completed,
        },
    }


def main() -> None:
    xlsx = Path(os.environ.get("CUTOVER_XLSX", DEFAULT_XLSX))
    if not xlsx.exists():
        print(f"Excel not found: {xlsx}", file=sys.stderr)
        print("Set CUTOVER_XLSX=/path/to/file.xlsx", file=sys.stderr)
        sys.exit(1)

    df = load_tasks(xlsx)
    payload = build_payload(df, str(xlsx.name))
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(f"Wrote {OUTPUT} ({payload['meta']['totalTasks']} tasks)")


if __name__ == "__main__":
    main()
