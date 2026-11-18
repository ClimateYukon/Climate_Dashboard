#!/usr/bin/env python3
"""Create verifiable next-calendar-day forecasts from daily Git snapshots."""
# 1. Load station IDs and daily historical forecast commits.
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
import json
import subprocess
import sys

REPO = Path('/FOME/jupyter/Apps/Climate_page/climate_static_dashboard')
OUTPUT = Path(sys.argv[1]) if len(sys.argv) > 1 else REPO
SOURCE = 'data/interactive/ahccd_ensemble_forecasts'
MANIFEST = json.loads((REPO / 'data/interactive/ahccd_temperature/manifest.json').read_text())
STATIONS = [station['id'] for station in MANIFEST['stations']]
FIRST_FILE = f'{SOURCE}/{STATIONS[0]}.json'
revisions = subprocess.check_output(
    ['git', '-C', str(REPO), 'log', '-n', '35', '--format=%H', '--', FIRST_FILE],
    text=True,
).splitlines()

# 2. Recover the actual forecast downloaded on each previous local date.
archived = {}
for revision in [None, *revisions]:
    if revision is None:
        first = json.loads((REPO / FIRST_FILE).read_text())
    else:
        first = json.loads(subprocess.check_output(
            ['git', '-C', str(REPO), 'show', f'{revision}:{FIRST_FILE}'], text=True
        ))
    issued = first['issue_date_local']
    if issued in archived:
        continue
    archived[issued] = {}
    for station in STATIONS:
        path = f'{SOURCE}/{station}.json'
        if revision is None:
            archived[issued][station] = json.loads((REPO / path).read_text())
        else:
            archived[issued][station] = json.loads(subprocess.check_output(
                ['git', '-C', str(REPO), 'show', f'{revision}:{path}'], text=True
            ))

# 3. Extract forecasts for the following local calendar day, not hindcasts.
folder = OUTPUT / 'data/interactive/ahccd_forecast_skill'
folder.mkdir(parents=True, exist_ok=True)
for station in STATIONS:
    records = []
    for issued, group in archived.items():
        target = (date.fromisoformat(issued) + timedelta(days=1)).isoformat()
        snapshot = group[station]
        predicted = {}
        for model_key, model in snapshot['models'].items():
            lookup = dict(zip(model['time'], model['mean']))
            value = lookup.get(target)
            if value is not None:
                predicted[model_key] = float(value)
        if predicted:
            records.append({
                'date': target,
                'issue_date_local': issued,
                'downloaded_utc': snapshot['updated_utc'],
                'models': predicted,
            })
    records = sorted(records, key=lambda item: item['date'])[-21:]
    result = {
        'station_id': station,
        'generated_utc': datetime.now(timezone.utc).isoformat(timespec='seconds'),
        'meaning': 'Forecast snapshot downloaded on the preceding local calendar day',
        'days': records,
    }
    (folder / f'{station}.json').write_text(json.dumps(result, indent=2) + '\n')
    print(f'{station:34} {len(records)} day-ahead snapshots')
print('Forecast snapshots available:', ', '.join(sorted(archived)))
