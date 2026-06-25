#!/usr/bin/env python3
# -*- coding: utf-8 -*-

# 1. Imports
import json
import re
import pathlib
import datetime
import numpy as np
import pandas as pd
import xarray as xr


# 2. Paths
DASHBOARD_DIR = pathlib.Path("/home/jschrode/jupyter/Code/Apps/Climate_page/climate_static_dashboard")

AHCCD_ROOT = pathlib.Path("/STORE/Apps_Data/AHCCD_v2")
AHCCD_PUBLISHED_DIR = AHCCD_ROOT / "published"
POINTER = AHCCD_ROOT / "current.txt"

OUTPUT_DIR = DASHBOARD_DIR / "data" / "interactive" / "ahccd_temperature"
STATIONS_DIR = OUTPUT_DIR / "stations"
MANIFEST_PATH = OUTPUT_DIR / "manifest.json"


# 3. Settings
BASELINE_START = 1981
BASELINE_END = 2010
EXTREME_Q = 0.99

# Keep this as WHITEHORSE A while testing. Change to None later to export all stations.
STATIONS_TO_EXPORT = None


# 4. Helper functions
def slugify_station_name(name):
    text = str(name).strip().upper()
    text = re.sub(r"[^A-Z0-9]+", "_", text)
    text = re.sub(r"_+", "_", text).strip("_")
    return text or "STATION"


def clean_float_list(values):
    arr = np.asarray(values, dtype=float).reshape(-1)
    out = []

    for value in arr:
        if np.isfinite(value):
            out.append(round(float(value), 3))
        else:
            out.append(None)

    return out


def resolve_latest_ahccd_file():
    if POINTER.exists():
        pointer_text = POINTER.read_text().strip()
        pointer_path = pathlib.Path(pointer_text)

        if pointer_path.is_absolute() and pointer_path.exists():
            return pointer_path

        root_candidate = AHCCD_ROOT / pointer_path
        if root_candidate.exists():
            return root_candidate

        published_candidate = AHCCD_PUBLISHED_DIR / pointer_path.name
        if published_candidate.exists():
            return published_candidate

    files = sorted(
        AHCCD_PUBLISHED_DIR.glob("full_AHCCD_filled_with_stats_*.nc"),
        key=lambda path: path.name,
        reverse=True,
    )

    if not files:
        raise FileNotFoundError(f"No AHCCD files found in {AHCCD_PUBLISHED_DIR}")

    return files[0]


def decode_station_names(ds):
    station_count = int(ds.sizes.get("station", 0))

    if "station_name" not in ds.coords and "station_name" not in ds.data_vars:
        return [str(value) for value in ds["station"].values]

    arr = np.asarray(ds["station_name"].values)

    def one_to_str(value):
        if isinstance(value, bytes):
            return value.decode("utf-8", errors="ignore").replace("\x00", "").strip()
        return str(value).replace("\x00", "").strip()

    if arr.ndim == 1 and arr.shape[0] == station_count:
        return [one_to_str(value) for value in arr]

    if arr.ndim == 2:
        if arr.shape[0] == station_count:
            return ["".join(one_to_str(value) for value in row).strip() for row in arr]

        if arr.shape[1] == station_count:
            return ["".join(one_to_str(value) for value in col).strip() for col in arr.T]

    return [str(value) for value in ds["station"].values]


def climatology_to_times(ds_station, variable_name, times):
    times = times.where(times.dt.dayofyear != 366, drop=True)
    day_of_year = times.dt.dayofyear.values
    day_of_year = np.where(day_of_year == 366, 365, day_of_year)

    clim = (
        ds_station[f"clim_{variable_name}"]
        .sel(dayofyear=day_of_year)
        .rename({"dayofyear": "time"})
        .assign_coords(time=times)
        .squeeze(drop=True)
    )

    return clim


def percentile_lines(ds_station, q):
    time_all = ds_station.time

    reference_mask = (
        (time_all.dt.year >= BASELINE_START)
        & (time_all.dt.year <= BASELINE_END)
        & (time_all.dt.dayofyear != 366)
    )

    anomaly_reference = ds_station["anom_tas"].sel(time=reference_mask)

    q_high = anomaly_reference.groupby("time.dayofyear").quantile(q, dim="time")
    q_low = anomaly_reference.groupby("time.dayofyear").quantile(1 - q, dim="time")

    return q_low, q_high


def select_station(ds, station_name):
    station_values = np.asarray(ds["station_name"].values).astype(str)
    matches = np.where(station_values == station_name)[0]

    if len(matches) == 0:
        available = sorted([str(value) for value in station_values])
        raise ValueError(f"Station not found: {station_name}. Available examples: {available[:20]}")

    return ds.isel(station=int(matches[0])).squeeze(drop=True)


def record_to_times(ds_station, variable_name, day_of_year, export_times):
    return (
        ds_station[variable_name]
        .sel(dayofyear=day_of_year)
        .rename({"dayofyear": "time"})
        .assign_coords(time=export_times)
        .squeeze(drop=True)
    )


def export_station(ds, station_name, station_id, output_file):
    ds_station = select_station(ds, station_name)

    time_values = pd.to_datetime(ds_station.time.values)
    valid_mask = time_values.dayofyear != 366
    export_times = time_values[valid_mask]

    ds_station = ds_station.isel(time=valid_mask)

    export_time_da = xr.DataArray(
        export_times,
        dims="time",
        coords={"time": export_times},
    )

    day_of_year = export_time_da.dt.dayofyear.values
    day_of_year = np.where(day_of_year == 366, 365, day_of_year)

    climatology_tas = climatology_to_times(ds_station, "tas", export_time_da)
    climatology_tasmin = climatology_to_times(ds_station, "tasmin", export_time_da)
    climatology_tasmax = climatology_to_times(ds_station, "tasmax", export_time_da)

    q_low, q_high = percentile_lines(ds_station, EXTREME_Q)

    p_low_anomaly = (
        q_low.sel(dayofyear=day_of_year)
        .rename({"dayofyear": "time"})
        .assign_coords(time=export_time_da)
        .squeeze(drop=True)
    )

    p_high_anomaly = (
        q_high.sel(dayofyear=day_of_year)
        .rename({"dayofyear": "time"})
        .assign_coords(time=export_time_da)
        .squeeze(drop=True)
    )

    p01_tas = climatology_tas + p_low_anomaly
    p99_tas = climatology_tas + p_high_anomaly

    tasmax_record = record_to_times(ds_station, "tasmax_record", day_of_year, export_times)
    tasmin_record = record_to_times(ds_station, "tasmin_record", day_of_year, export_times)
    tasmax_record_year = record_to_times(ds_station, "tasmax_record_year", day_of_year, export_times)
    tasmin_record_year = record_to_times(ds_station, "tasmin_record_year", day_of_year, export_times)

    station_export = {
        "id": station_id,
        "name": station_name,
        "time": [value.strftime("%Y-%m-%d") for value in export_times],
        "tas": clean_float_list(ds_station["tas"].values),
        "tasmin": clean_float_list(ds_station["tasmin"].values),
        "tasmax": clean_float_list(ds_station["tasmax"].values),
        "clim_tas": clean_float_list(climatology_tas.values),
        "clim_tasmin": clean_float_list(climatology_tasmin.values),
        "clim_tasmax": clean_float_list(climatology_tasmax.values),
        "p01_tas": clean_float_list(p01_tas.values),
        "p99_tas": clean_float_list(p99_tas.values),
        "tasmax_record": clean_float_list(tasmax_record.values),
        "tasmin_record": clean_float_list(tasmin_record.values),
        "tasmax_record_year": clean_float_list(tasmax_record_year.values),
        "tasmin_record_year": clean_float_list(tasmin_record_year.values),
    }

    with output_file.open("w", encoding="utf-8") as file:
        json.dump(station_export, file, ensure_ascii=False, separators=(",", ":"))


# 5. Main
def main():
    STATIONS_DIR.mkdir(parents=True, exist_ok=True)

    source_file = resolve_latest_ahccd_file()

    with xr.open_dataset(source_file, engine="netcdf4", mode="r") as ds:
        ds = ds.load()

    station_names = decode_station_names(ds)
    ds = ds.assign_coords(station_name=("station", np.asarray(station_names, dtype=str)))

    for variable_name in ["tas", "tasmin", "tasmax"]:
        filled_variable = f"{variable_name}_filled"
        if variable_name not in ds and filled_variable in ds:
            ds[variable_name] = ds[filled_variable]

    required_variables = [
        "tas",
        "tasmin",
        "tasmax",
        "clim_tas",
        "clim_tasmin",
        "clim_tasmax",
        "anom_tas",
        "tasmax_record",
        "tasmin_record",
        "tasmax_record_year",
        "tasmin_record_year",
    ]

    missing_variables = [variable for variable in required_variables if variable not in ds]
    if missing_variables:
        raise ValueError(f"Missing required variables: {missing_variables}")

    available_stations = sorted([str(value) for value in np.unique(ds["station_name"].values)])

    if STATIONS_TO_EXPORT is None:
        stations = available_stations
    else:
        stations = STATIONS_TO_EXPORT

    time_values = pd.to_datetime(ds.time.values)
    valid_time_values = time_values[time_values.dayofyear != 366]

    manifest_stations = []

    for station_name in stations:
        station_id = slugify_station_name(station_name)
        station_file = STATIONS_DIR / f"{station_id}.json"

        export_station(
            ds=ds,
            station_name=station_name,
            station_id=station_id,
            output_file=station_file,
        )

        manifest_stations.append({
            "id": station_id,
            "name": station_name,
            "data_file": f"data/interactive/ahccd_temperature/stations/{station_id}.json",
        })

    manifest = {
        "created": datetime.date.today().isoformat(),
        "source_file": str(source_file),
        "baseline": f"{BASELINE_START}-{BASELINE_END}",
        "extreme_quantile": EXTREME_Q,
        "time_min": str(valid_time_values.min().date()),
        "time_max": str(valid_time_values.max().date()),
        "stations": manifest_stations,
    }

    with MANIFEST_PATH.open("w", encoding="utf-8") as file:
        json.dump(manifest, file, ensure_ascii=False, indent=2)

    print(f"Saved manifest: {MANIFEST_PATH}")
    print(f"Saved station files: {STATIONS_DIR}")
    print(f"Source file: {source_file}")
    print(f"Stations exported: {len(manifest_stations)}")
    print(f"Time range: {manifest['time_min']} to {manifest['time_max']}")


if __name__ == "__main__":
    main()
