# Static Climate Plot Dashboard

This is a simple static website for publishing verified climate plots as cards.
It is designed for GitHub Pages and does not require Dash, Shiny, Python hosting, or a database.

## Folder structure

```text
climate-dashboard-static/
  index.html              # Card gallery page
  plot.html               # Full plot page
  style.css               # Site styling
  app.js                  # Loads data/index.json and builds the site
  data/
    index.json            # List of cards to show
  plots/
    sample_temperature_card/
      preview.png         # Small image used on the card
      full.png            # Full-size image shown on click
      metadata.json       # Metadata for this plot
  scripts/
    build_index.py        # Optional helper to rebuild data/index.json from metadata.json files
  .nojekyll               # Makes GitHub Pages serve files as-is
```

## How to use

1. Create a GitHub repository, for example `climate-dashboard-static`.
2. Copy these files into the repository.
3. Replace the sample plot folder with your real plot folders.
4. For each plot, include:
   - `preview.png`
   - `full.png`
   - `metadata.json`
5. Rebuild the index:

```bash
python scripts/build_index.py
```

6. Commit and push.
7. In GitHub, go to **Settings > Pages** and publish from your main branch.

## Plot folder example

```text
plots/whitehorse_a_past_365_days_temperature/
  preview.png
  full.png
  metadata.json
```

Example metadata:

```json
{
  "id": "whitehorse_a_past_365_days_temperature",
  "title": "Past 365 days temperature",
  "subtitle": "Whitehorse A",
  "description": "Daily mean, minimum, and maximum temperature for the past 365 days compared with the 1981-2010 normal.",
  "date_label": "Updated 2026-05-30",
  "source": "AHCCD + ECCC daily observations + ERA5 gap filling",
  "preview_image": "plots/whitehorse_a_past_365_days_temperature/preview.png",
  "full_image": "plots/whitehorse_a_past_365_days_temperature/full.png",
  "category": "Temperature",
  "station": "Whitehorse A",
  "last_updated": "2026-05-30"
}
```

## Notes

- This is a static website. It cannot truly scan folders in the browser.
- `scripts/build_index.py` scans `plots/*/metadata.json` and writes `data/index.json`.
- The public website reads `data/index.json` and builds the cards.
- For now, publish PNG previews and PNG full plots. You can add interactive Plotly HTML later if needed.
