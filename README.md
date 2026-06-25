# Static Climate Plot Dashboard

This repository contains a static website for publishing curated Yukon climate plots and interactive climate tools.

The site is designed for GitHub Pages. It does not require Dash, Shiny, Python hosting, a database, or a backend server.

## Folder structure

Climate_Dashboard/
  index.html                 Main dashboard page
  indicator.html             Indicator gallery page
  plot.html                  Individual plot page

  assets/
    css/
      style.css              Site styling
    js/
      app.js                 Main dashboard JavaScript

  data/
    index.json               Plot index generated from plot metadata
    indicators.json          Main dashboard card index
    interactive_cards.json   Metadata for interactive dashboard cards
    interactive/             Data used by interactive tools

  interactive/
    ahccd-temperature.html
    ahccd-temperature.js
    ahccd-temperature-preview.png

  plots/
    annual_temperature_anomalies/
    kcibr_weather_forecast/
    monthly_temperature_rankings/
    seasonal_temperature_anomalies/

  tools/
    build_index.py
    export_ahccd_temperature_interactive.py
    update_ahccd_temperature_interactive.sh

  .nojekyll
  .gitignore
  README.md

## What is required for the website to run

The public website needs only these static files and folders:

index.html
indicator.html
plot.html
assets/
data/
interactive/
plots/
.nojekyll

The tools/ folder is not required by the browser, but it is kept in the repository because it is used to rebuild or update the dashboard outputs.

## Updating the dashboard index

After adding, editing, or removing plot metadata, rebuild the dashboard indexes with:

python tools/build_index.py

This updates:

data/index.json
data/indicators.json

## Testing locally

From the repository root, run:

python -m http.server 8080

On Junix/JupyterHub, the proxy URL usually looks like:

https://junix.ynet.gov.yk.ca/user/jschrode/proxy/8080/

The trailing slash is important.

## GitHub Pages

This site should be published from the repository root on the main branch.

## Notes

Generated checkpoint folders such as .ipynb_checkpoints/ should not be committed.