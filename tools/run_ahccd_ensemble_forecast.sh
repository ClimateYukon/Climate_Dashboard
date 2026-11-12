#!/usr/bin/env bash
# 1. Update forecasts independently from the daily AHCCD processing.
set -euo pipefail
DASHBOARD_DIR="/home/jschrode/jupyter/Apps/Climate_page/climate_static_dashboard"
PYTHON="/home/jschrode/miniconda3/envs/climate-latest/bin/python"

echo "Ensemble forecast update started: $(date -Is)"
cd "$DASHBOARD_DIR"
git pull --ff-only
"$PYTHON" tools/update_ahccd_ensemble_forecast.py

# 2. Only commit the forecast data, never pending AHCCD or manual changes.
git add data/interactive/ahccd_ensemble_forecasts/
if git diff --cached --quiet; then
    echo "No forecast JSON changes to publish."
else
    git commit -m "Update AHCCD ensemble temperature forecasts"
    git push
    echo "Forecast JSON committed and pushed."
fi

echo "Ensemble forecast update finished: $(date -Is)"
