#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Build data/index.json and data/indicators.json from all metadata.json files
under plots/, including nested folders.

Supported structures:
  plots/<plot_id>/metadata.json
  plots/<indicator_id>/<plot_id>/metadata.json

Main page cards are sorted by update date, newest first.

Recommended metadata fields:
  "updated_date": "2026-06-24"
  "date_label": "Updated 2026-06-24"

If updated_date is missing, the script tries to extract the date from date_label.
"""

# 1. Imports
import json
import re
from pathlib import Path
from collections import defaultdict


# 2. Paths
REPO_DIR = Path(__file__).resolve().parents[1]
PLOTS_DIR = REPO_DIR / "plots"
DATA_DIR = REPO_DIR / "data"

INDEX_PATH = DATA_DIR / "index.json"
INDICATORS_PATH = DATA_DIR / "indicators.json"


# 3. Helper functions
def read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def get_update_date(item: dict) -> str:
    """
    Return an ISO-style date string, YYYY-MM-DD, for sorting.

    Priority:
      1. updated_date
      2. first YYYY-MM-DD date found in date_label

    Missing or invalid dates sort last.
    """
    updated_date = str(item.get("updated_date", "")).strip()

    if re.fullmatch(r"\d{4}-\d{2}-\d{2}", updated_date):
        return updated_date

    date_label = str(item.get("date_label", "")).strip()
    match = re.search(r"\d{4}-\d{2}-\d{2}", date_label)

    if match:
        return match.group(0)

    return "0000-00-00"


# 4. Main build process
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

    # 5. Sort plot index for stable output
    plots = sorted(
        plots,
        key=lambda x: (
            str(x.get("indicator_title", x.get("title", ""))).lower(),
            str(x.get("community", x.get("subtitle", ""))).lower(),
            str(x.get("id", "")).lower(),
        ),
    )

    # 6. Group community-based plots by indicator_id
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

    # 7. Build grouped indicator cards
    for indicator_id, items in grouped.items():
        # Use newest item in the group for the indicator card date and preview.
        newest_item = sorted(
            items,
            key=lambda x: (
                get_update_date(x),
                str(x.get("title", "")).lower(),
                str(x.get("id", "")).lower(),
            ),
            reverse=True,
        )[0]

        indicators.append({
            "id": indicator_id,
            "card_type": "indicator",
            "title": newest_item.get("indicator_title", newest_item.get("title", indicator_id)),
            "subtitle": f"{len(items)} communities",
            "description": newest_item.get(
                "indicator_description",
                newest_item.get("description", "Community plots generated from verified outputs."),
            ),
            "date_label": newest_item.get("date_label", ""),
            "updated_date": get_update_date(newest_item),
            "source": newest_item.get("source", ""),
            "preview_image": newest_item.get("preview_image", ""),
            "tags": sorted(set(tag for item in items for tag in item.get("tags", []))),
            "plot_count": len(items),
            "href": f"indicator.html?id={indicator_id}",
        })

    # 8. Build direct plot cards
    for item in direct_cards:
        indicators.append({
            "id": item.get("id"),
            "card_type": "direct",
            "title": item.get("title", item.get("id")),
            "subtitle": item.get("subtitle", ""),
            "description": item.get("description", ""),
            "date_label": item.get("date_label", ""),
            "updated_date": get_update_date(item),
            "source": item.get("source", ""),
            "preview_image": item.get("preview_image", ""),
            "tags": item.get("tags", []),
            "plot_count": 1,
            "href": f"plot.html?id={item.get('id')}",
        })

        # 9. Add manual interactive page cards
    indicators.append({
        "id": "ahccd_temperature",
        "card_type": "interactive",
        "title": "AHCCD temperature stations",
        "subtitle": "Interactive station dashboard",
        "description": "Explore AHCCD temperature records for Yukon stations.",
        "date_label": "Updated 2026-06-24",
        "updated_date": "2026-06-24",
        "source": "AHCCD",
        "preview_image": "interactive/ahccd-temperature-preview.png",
        "tags": ["temperature", "stations", "AHCCD", "interactive"],
        "plot_count": 1,
        "href": "interactive/ahccd-temperature.html",
    })

    # 9. Sort main page cards by newest update first
    indicators = sorted(
        indicators,
        key=lambda x: (
            get_update_date(x),
            str(x.get("title", "")).lower(),
            str(x.get("subtitle", "")).lower(),
        ),
        reverse=True,
    )

    # 10. Write output files
    write_json(INDEX_PATH, plots)
    write_json(INDICATORS_PATH, indicators)

    print(f"Wrote {INDEX_PATH} with {len(plots)} plot(s).")
    print(f"Wrote {INDICATORS_PATH} with {len(indicators)} indicator/direct card(s).")


if __name__ == "__main__":
    main()