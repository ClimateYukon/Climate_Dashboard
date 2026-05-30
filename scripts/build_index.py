#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Build data/index.json and data/indicators.json from all metadata.json files
under plots/, including nested folders.

Supported structures:
  plots/<plot_id>/metadata.json
  plots/<indicator_id>/<plot_id>/metadata.json
"""

import json
from pathlib import Path
from collections import defaultdict


REPO_DIR = Path(__file__).resolve().parents[1]
PLOTS_DIR = REPO_DIR / "plots"
DATA_DIR = REPO_DIR / "data"

INDEX_PATH = DATA_DIR / "index.json"
INDICATORS_PATH = DATA_DIR / "indicators.json"


def read_json(path: Path) -> dict:
    return json.loads(path.read_text())


def write_json(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")


def main() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    metadata_files = sorted(PLOTS_DIR.rglob("metadata.json"))

    plots = []
    for metadata_file in metadata_files:
        try:
            item = read_json(metadata_file)
        except Exception as error:
            print(f"Skipping invalid metadata: {metadata_file} | {error}")
            continue

        if "id" not in item:
            print(f"Skipping metadata without id: {metadata_file}")
            continue

        item["_metadata_path"] = str(metadata_file.relative_to(REPO_DIR))
        plots.append(item)

    # Sort for stable output.
    plots = sorted(
        plots,
        key=lambda x: (
            str(x.get("indicator_title", x.get("title", ""))).lower(),
            str(x.get("community", x.get("subtitle", ""))).lower(),
            str(x.get("id", "")).lower(),
        ),
    )

    # Group community-based plots by indicator_id.
    grouped = defaultdict(list)
    direct_cards = []

    for item in plots:
        indicator_id = item.get("indicator_id")
        community = item.get("community")

        if indicator_id and community:
            grouped[indicator_id].append(item)
        else:
            direct_cards.append(item)

    indicators = []

    for indicator_id, items in grouped.items():
        first = items[0]

        # Use first item as preview, but represent the whole group.
        indicators.append({
            "id": indicator_id,
            "card_type": "indicator",
            "title": first.get("indicator_title", first.get("title", indicator_id)),
            "subtitle": f"{len(items)} communities",
            "description": first.get(
                "indicator_description",
                first.get("description", "Community plots generated from verified outputs."),
            ),
            "date_label": first.get("date_label", ""),
            "source": first.get("source", ""),
            "preview_image": first.get("preview_image", ""),
            "tags": sorted(set(tag for item in items for tag in item.get("tags", []))),
            "plot_count": len(items),
            "href": f"indicator.html?id={indicator_id}",
        })

    for item in direct_cards:
        indicators.append({
            "id": item.get("id"),
            "card_type": "direct",
            "title": item.get("title", item.get("id")),
            "subtitle": item.get("subtitle", ""),
            "description": item.get("description", ""),
            "date_label": item.get("date_label", ""),
            "source": item.get("source", ""),
            "preview_image": item.get("preview_image", ""),
            "tags": item.get("tags", []),
            "plot_count": 1,
            "href": f"plot.html?id={item.get('id')}",
        })

    indicators = sorted(
        indicators,
        key=lambda x: (str(x.get("title", "")).lower(), str(x.get("subtitle", "")).lower()),
    )

    write_json(INDEX_PATH, plots)
    write_json(INDICATORS_PATH, indicators)

    print(f"Wrote {INDEX_PATH} with {len(plots)} plot(s).")
    print(f"Wrote {INDICATORS_PATH} with {len(indicators)} indicator/direct card(s).")


if __name__ == "__main__":
    main()
