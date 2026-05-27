#!/usr/bin/env python3
"""Validate Cutover Run Sheet counts against expected dashboard totals."""
import sys
from pathlib import Path

import pandas as pd


def main() -> None:
    path = Path(sys.argv[1] if len(sys.argv) > 1 else "")
    if not path.exists():
        print("Usage: validate_counts.py <path-to-Cutover RunSheet_GTS.xlsx>")
        sys.exit(1)

    df = pd.read_excel(path, sheet_name="Cutover Run Sheet", header=4)
    df = df[df["Rpt Flag Auto"] == "Y"]

    total = len(df)
    complete = (df["Status"] == "Complete").sum()
    late = (df["Late"] == "Y").sum()
    pct = round(100 * complete / total) if total else 0

    print(f"Reportable tasks: {total}")
    print(f"Status:\n{df['Status'].value_counts().to_string()}")
    print(f"Late (Y): {late}")
    print(f"Percent complete: {pct}%")
    print("\nDelayed by category:")
    for cat, g in df.groupby("Category"):
        n = (g["Late"] == "Y").sum()
        if n:
            print(f"  {cat}: {n}")
    print("\nDelayed by team:")
    for team, g in df.groupby("Team"):
        n = (g["Late"] == "Y").sum()
        if n:
            print(f"  {team}: {n}")


if __name__ == "__main__":
    main()
