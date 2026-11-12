#!/usr/bin/env python3
"""Refresh public AHCCD station ensemble forecasts (seven models, 12 stations)."""

# 1. Imports and paths
from datetime import datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo
import json
import re

import numpy as np
import requests
import urllib3
import xarray as xr

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
REPO = Path('/home/jschrode/jupyter/Apps/Climate_page/climate_static_dashboard')
DATA = REPO / 'data/interactive/ahccd_temperature'
API = 'https://ensemble-api.open-meteo.com/v1/ensemble'
LOCAL_TZ = 'America/Whitehorse'
REQUEST_DATE = datetime.now(ZoneInfo(LOCAL_TZ)).date().isoformat()
DOWNLOADED_UTC = datetime.now(timezone.utc).isoformat(timespec='seconds')

MODELS = {
    'ecmwf': ('ecmwf_ifs025_ensemble', 15, 'ECMWF IFS'),
    'gefs': ('ncep_gefs05', 22, 'NOAA GEFS 0.5'),
    'geps': ('cmc_gem_geps', 16, 'ECCC GEPS'),
    'aifs': ('ecmwf_aifs025_ensemble', 15, 'ECMWF AIFS'),
    'icon': ('dwd_icon_global_eps', 8, 'DWD ICON-EPS'),
    'ukmo': ('ukmo_global_ensemble_20km', 8, 'UK MOGREPS-G'),
    'google': ('google_weathernext2_ensemble', 15, 'Google WeatherNext 2'),
}

# 2. Station coordinates from the same AHCCD NetCDF used by the dashboard
manifest = json.loads((DATA / 'manifest.json').read_text())
stations = manifest['stations']

def slug(value):
    if isinstance(value, bytes):
        value = value.decode('utf-8')
    return re.sub(r'[^A-Z0-9]+', '_', str(value).upper()).strip('_')

with xr.open_dataset(manifest['source_file']) as ds:
    station_indices = {slug(v): i for i, v in enumerate(ds['station_name'].values)}
    coords = {
        s['id']: (
            float(ds['latitude'].isel(station=station_indices[s['id']]).item()),
            float(ds['longitude'].isel(station=station_indices[s['id']]).item()),
            float(ds['elevation'].isel(station=station_indices[s['id']]).item()),
        )
        for s in stations
    }

locations = {
    'latitude': ','.join(str(coords[s['id']][0]) for s in stations),
    'longitude': ','.join(str(coords[s['id']][1]) for s in stations),
    'elevation': ','.join(str(coords[s['id']][2]) for s in stations),
}
results = {
    s['id']: {
        'station_id': s['id'],
        'station_name': s['name'],
        'updated_utc': DOWNLOADED_UTC,
        'issue_date_local': REQUEST_DATE,
        'daily_timezone': LOCAL_TZ,
        'models': {},
        'errors': {},
    }
    for s in stations
}

# 3. Fetch each ensemble for all stations; compute means and member P10/P90
session = requests.Session()

def floats(values):
    return [round(float(v), 2) if np.isfinite(v) else None for v in values]

for model_key, (api_model, days, label) in MODELS.items():
    try:
        response = session.get(
            API,
            params={
                **locations,
                'models': api_model,
                'daily': 'temperature_2m_mean',
                'forecast_days': days,
                'timezone': LOCAL_TZ,
                'temperature_unit': 'celsius',
            },
            verify=False,  # Junix network requires this for the external API.
            timeout=180,
        )
        response.raise_for_status()
        payloads = response.json()
        if not isinstance(payloads, list):
            payloads = [payloads]
        if len(payloads) != len(stations):
            raise ValueError(f'Expected {len(stations)} station responses; received {len(payloads)}')

        current_model = {}
        for station, payload in zip(stations, payloads):
            daily = payload['daily']
            keys = sorted(k for k in daily if k.startswith('temperature_2m_mean_member'))
            if not keys:
                raise ValueError(f'{api_model} returned no ensemble member temperatures')
            values = np.asarray([daily[k] for k in keys], dtype=float)
            valid = np.isfinite(values).any(axis=0)
            mean = np.full(values.shape[1], np.nan)
            p10 = np.full(values.shape[1], np.nan)
            p90 = np.full(values.shape[1], np.nan)
            mean[valid] = np.nanmean(values[:, valid], axis=0)
            p10[valid] = np.nanpercentile(values[:, valid], 10, axis=0)
            p90[valid] = np.nanpercentile(values[:, valid], 90, axis=0)
            current_model[station['id']] = {
                'label': label,
                'api_model': api_model,
                'member_count': len(keys),
                'time': daily['time'],
                'mean': floats(mean),
                'p10': floats(p10),
                'p90': floats(p90),
                'model_latitude': payload['latitude'],
                'model_longitude': payload['longitude'],
                'model_elevation_m': payload.get('elevation'),
            }
        for s in stations:
            results[s['id']]['models'][model_key] = current_model[s['id']]
        print(f'{label}: {len(keys)} ensemble members, {len(daily["time"])} days, {len(stations)} stations')
    except (requests.RequestException, ValueError, KeyError, TypeError, IndexError) as exc:
        print(f'{label}: unavailable ({str(exc)[:200]})')
        for s in stations:
            results[s['id']]['errors'][model_key] = str(exc)

# 4. Write new forecast files only when the download was usable
available = len(results[stations[0]['id']]['models'])
if available < 2:
    raise RuntimeError(f'Only {available} ensemble(s) retrieved. Existing published forecasts kept unchanged.')

folder = REPO / 'data/interactive/ahccd_ensemble_forecasts'
folder.mkdir(parents=True, exist_ok=True)
for station in stations:
    destination = folder / f'{station["id"]}.json'
    temporary = destination.with_suffix('.json.tmp')
    temporary.write_text(json.dumps(results[station['id']], indent=2, allow_nan=False) + '\n')
    temporary.replace(destination)

print(f'Forecast update complete: {available}/7 models for {len(stations)} stations; retrieved {DOWNLOADED_UTC} UTC')
