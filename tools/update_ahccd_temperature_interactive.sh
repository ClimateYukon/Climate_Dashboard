#!/usr/bin/env bash

# 1. Stop on command errors and failed pipes
set -eo pipefail

# 2. Paths
DASHBOARD_DIR="/home/jschrode/jupyter/Code/Apps/Climate_page/climate_static_dashboard"
LOG_DIR="${DASHBOARD_DIR}/logs"
LOG_FILE="${LOG_DIR}/update_ahccd_temperature_interactive.log"

# 3. Prepare logging
mkdir -p "${LOG_DIR}"
exec >> "${LOG_FILE}" 2>&1

echo "============================================================"
echo "Started AHCCD interactive temperature update: $(date -Is)"

# 4. Load conda
source "$(conda info --base)/etc/profile.d/conda.sh"
conda activate climate

# 5. Move to dashboard repository
cd "${DASHBOARD_DIR}"

# 6. Regenerate static interactive JSON
python tools/export_ahccd_temperature_interactive.py

# 7. Show updated manifest date for logs
python - <<'PY'
import json
from pathlib import Path

manifest_path = Path("data/interactive/ahccd_temperature/manifest.json")
manifest = json.loads(manifest_path.read_text())

print("Manifest:", manifest_path)
print("Created:", manifest.get("created"))
print("Time min:", manifest.get("time_min"))
print("Time max:", manifest.get("time_max"))
print("Source file:", manifest.get("source_file"))
print("Station count:", len(manifest.get("stations", [])))
PY

# 8. Commit only if files changed
git add data/interactive/ahccd_temperature/

if git diff --cached --quiet; then
  echo "No AHCCD interactive temperature data changes to commit."
else
  git commit -m "Update AHCCD interactive temperature data"
  git push
  echo "Committed and pushed AHCCD interactive temperature data update."
fi

echo "Finished AHCCD interactive temperature update: $(date -Is)"
