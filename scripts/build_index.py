#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Build data/index.json and data/indicators.json for the static climate dashboard.

Expected plot folder structure:

plots/<plot_id>/
  preview.png
  full.png
  metadata.json

Each metadata.json should include at minimum:
  id
  title
  subtitle or community
  description
  preview_image
  full_image

For the indicator/community hierarchy, include:
  indicator_id
  indicator_title
  indicator_description
"""

from __future__ import annotations

import json
from pathlib import Path
from collections import defaultdict

ROOT = Path(__file__).resolve().parents[1]
PLOTS_DIR = ROOT / "plots"
DATA_DIR = ROOT / "data"
INDEX_PATH = DATA_DIR / "index.json"
INDICATORS_PATH = DATA_DIR / "indicators.json"

DEFAULT_INDICATOR_ID = "uncategorized"
DEFAULT_INDICATOR_TITLE = "Uncategorized plots"


def read_json(path: Path) -> dict:
    return json.loads(path.read_text())


def write_json(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")


def normalize_metadata(meta: dict, folder: Path) -> dict:
    plot_id = meta.get("id") or folder.name
    meta["id"] = plot_id

    meta.setdefault("indicator_id", DEFAULT_INDICATOR_ID)
    meta.setdefault("indicator_title", DEFAULT_INDICATOR_TITLE)
    meta.setdefault("indicator_description", "Climate plots generated from verified outputs.")

    meta.setdefault("preview_image", f"plots/{folder.name}/preview.png")
    meta.setdefault("full_image", f"plots/{folder.name}/full.png")
    meta.setdefault("community", meta.get("subtitle", ""))
    meta.setdefault("tags", [])

    if isinstance(meta["tags"], str):
        meta["tags"] = [meta["tags"]]

    return meta


def build() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    plots = []

    if PLOTS_DIR.exists():
        for metadata_path in sorted(PLOTS_DIR.glob("*/metadata.json")):
            folder = metadata_path.parent
            meta = normalize_metadata(read_json(metadata_path), folder)
            plots.append(meta)

    plots.sort(
        key=lambda item: (
            str(item.get("indicator_order", 9999)),
            str(item.get("indicator_title", "")),
            str(item.get("community", item.get("subtitle", ""))),
            str(item.get("title", "")),
        )
    )

    grouped = defaultdict(list)
    for plot in plots:
        grouped[plot["indicator_id"]].append(plot)

    indicators = []
    for indicator_id, items in grouped.items():
        first = items[0]
        tags = []
        for item in items:
            for tag in item.get("tags", []):
                if tag not in tags:
                    tags.append(tag)

        indicators.append(
            {
                "id": indicator_id,
                "title": first.get("indicator_title", indicator_id),
                "description": first.get("indicator_description", ""),
                "source": first.get("source", ""),
                "preview_image": first.get("indicator_preview_image") or first.get("preview_image"),
                "plot_count": len(items),
                "tags": tags,
                "order": first.get("indicator_order", 9999),
            }
        )

    indicators.sort(key=lambda item: (item.get("order", 9999), item.get("title", "")))

    write_json(INDEX_PATH, plots)
    write_json(INDICATORS_PATH, indicators)

    print(f"Wrote {INDEX_PATH} with {len(plots)} plot(s)")
    print(f"Wrote {INDICATORS_PATH} with {len(indicators)} indicator(s)")


if __name__ == "__main__":
    build()
