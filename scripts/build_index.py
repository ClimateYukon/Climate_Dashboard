#!/usr/bin/env python3
"""
Build data/index.json from plots/*/metadata.json.

Run from the repository root:

    python scripts/build_index.py

This script is optional but recommended. GitHub Pages cannot scan folders by
itself, so the browser app reads data/index.json instead.
"""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PLOTS_DIR = ROOT / "plots"
OUT_PATH = ROOT / "data" / "index.json"

REQUIRED_FIELDS = ["id", "title", "preview_image", "full_image"]


def main() -> None:
    items = []

    for metadata_path in sorted(PLOTS_DIR.glob("*/metadata.json")):
        with metadata_path.open("r", encoding="utf-8") as f:
            item = json.load(f)

        missing = [field for field in REQUIRED_FIELDS if not item.get(field)]
        if missing:
            raise ValueError(f"{metadata_path} is missing required fields: {missing}")

        items.append(item)

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with OUT_PATH.open("w", encoding="utf-8") as f:
        json.dump(items, f, indent=2, ensure_ascii=False)
        f.write("\n")

    print(f"Wrote {OUT_PATH} with {len(items)} item(s).")


if __name__ == "__main__":
    main()
