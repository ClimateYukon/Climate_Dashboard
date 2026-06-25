#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Build data/index.json and data/indicators.json from plot metadata and optional
interactive dashboard cards.

Supported plot structures:
  plots/<plot_id>/metadata.json
  plots/<indicator_id>/<plot_id>/metadata.json

Optional interactive cards:
  data/interactive_cards.json
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
INTERACTIVE_CARDS_PATH = DATA_DIR / "interactive_cards.json"


# 3. Helper functions
def read_json(path: Path):
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


def load_interactive_cards() -> list:
    if not INTERACTIVE_CARDS_PATH.exists():
        return []

    cards = read_json(INTERACTIVE_CARDS_PATH)

    if not isinstance(cards, list):
        raise ValueError(f"{INTERACTIVE_CARDS_PATH} must contain a JSON list.")

    return cards


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
        key=lambda item: (
            str(item.get("indicator_title", item.get("title", ""))).lower(),
            str(item.get("community", item.get("subtitle", ""))).lower(),
            str(item.get("id", "")).lower(),
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
        newest_item = sorted(
            items,
            key=lambda item: (
                get_update_date(item),
                str(item.get("title", "")).lower(),
                str(item.get("id", "")).lower(),
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

    # 9. Add optional interactive dashboard cards
    indicators.extend(load_interactive_cards())

    # 10. Sort main page cards by newest update first
    indicators = sorted(
        indicators,
        key=lambda item: (
            get_update_date(item),
            str(item.get("title", "")).lower(),
            str(item.get("subtitle", "")).lower(),
        ),
        reverse=True,
    )

    # 11. Write output files
    write_json(INDEX_PATH, plots)
    write_json(INDICATORS_PATH, indicators)

    print(f"Wrote {INDEX_PATH} with {len(plots)} plot(s).")
    print(f"Wrote {INDICATORS_PATH} with {len(indicators)} indicator/direct/interactive card(s).")


if __name__ == "__main__":
    main()
