// 1. Shared state
let manifest = null;
let stationData = null;

const DATA_ROOT = "../data/interactive/ahccd_temperature";
const DATA_CACHE_BUSTER = String(Date.now());

function withCacheBuster(path) {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}v=${DATA_CACHE_BUSTER}`;
}

const monthNames = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const seasonDefinitions = {
  DJF: { label: "Winter (DJF)", months: [12, 1, 2] },
  MAM: { label: "Spring (MAM)", months: [3, 4, 5] },
  JJA: { label: "Summer (JJA)", months: [6, 7, 8] },
  SON: { label: "Fall (SON)", months: [9, 10, 11] }
};


// 2. Utility functions
function showError(message) {
  const errorBox = document.getElementById("error-box");
  errorBox.textContent = message;
  errorBox.style.display = "block";
}

function setStatus(message) {
  document.getElementById("data-status").textContent = message;
}

function dateParts(dateString) {
  const parts = dateString.split("-").map(Number);
  return { year: parts[0], month: parts[1], day: parts[2] };
}

function formatDate(dateValue) {
  const year = dateValue.getFullYear();
  const month = String(dateValue.getMonth() + 1).padStart(2, "0");
  const day = String(dateValue.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function monthDayKey(dateString) {
  const d = dateParts(dateString);
  return `${String(d.month).padStart(2, "0")}-${String(d.day).padStart(2, "0")}`;
}

function monthToSeason(monthNumber) {
  if ([12, 1, 2].includes(monthNumber)) return "DJF";
  if ([3, 4, 5].includes(monthNumber)) return "MAM";
  if ([6, 7, 8].includes(monthNumber)) return "JJA";
  return "SON";
}

function uniqueSortedYears(times) {
  return [...new Set(times.map((dateString) => dateParts(dateString).year))]
    .sort((a, b) => a - b);
}

function populateSelect(selectElement, options, selectedValue) {
  selectElement.innerHTML = "";

  options.forEach((option) => {
    const element = document.createElement("option");
    element.value = option.value;
    element.textContent = option.label;

    if (selectedValue !== undefined && String(option.value) === String(selectedValue)) {
      element.selected = true;
    }

    selectElement.appendChild(element);
  });
}

function finiteValue(value) {
  return value !== null && value !== undefined && Number.isFinite(Number(value));
}

function finiteMinMax(arrays) {
  const values = [];

  arrays.forEach((array) => {
    array.forEach((value) => {
      if (finiteValue(value)) {
        values.push(Number(value));
      }
    });
  });

  if (values.length === 0) return null;

  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const padding = Math.max(1.2, 0.08 * (maxValue - minValue));

  return [minValue - padding, maxValue + padding];
}

function makeDateRange(startDate, endDate) {
  const dates = [];
  const current = new Date(startDate.getTime());

  while (current <= endDate) {
    dates.push(formatDate(current));
    current.setDate(current.getDate() + 1);
  }

  return dates;
}
function paddedDateRange(startDateString, endDateString) {
  const startDate = new Date(startDateString + "T00:00:00");
  const endDate = new Date(endDateString + "T00:00:00");

  startDate.setDate(startDate.getDate() - 1);
  endDate.setDate(endDate.getDate() + 1);

  return [formatDate(startDate), formatDate(endDate)];
}
function makeSelectedPeriodDates(mode, year, month, season) {
  if (mode === "month") {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);
    return makeDateRange(startDate, endDate);
  }

  if (mode === "season") {
    if (season === "DJF") {
      return makeDateRange(new Date(year - 1, 11, 1), new Date(year, 2, 0));
    }

    if (season === "MAM") {
      return makeDateRange(new Date(year, 2, 1), new Date(year, 5, 0));
    }

    if (season === "JJA") {
      return makeDateRange(new Date(year, 5, 1), new Date(year, 8, 0));
    }

    if (season === "SON") {
      return makeDateRange(new Date(year, 8, 1), new Date(year, 11, 0));
    }
  }

  if (mode === "annual") {
    const requestedEndDate = new Date(year, month, 0);
    const dataMaxDate = new Date(manifest.time_max + "T00:00:00");
    const endDate = requestedEndDate <= dataMaxDate ? requestedEndDate : dataMaxDate;

    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 364);

    return makeDateRange(startDate, endDate);
  }

  return [];
}

function makeLookup(data) {
  const byDate = new Map();
  const byMonthDay = new Map();

  data.time.forEach((dateString, index) => {
    const record = {
      tas: data.tas[index],
      tasmin: data.tasmin[index],
      tasmax: data.tasmax[index],
      clim_tas: data.clim_tas[index],
      clim_tasmin: data.clim_tasmin[index],
      clim_tasmax: data.clim_tasmax[index],
      p01_tas: data.p01_tas[index],
      p99_tas: data.p99_tas[index],
      tasmax_record: data.tasmax_record ? data.tasmax_record[index] : null,
      tasmin_record: data.tasmin_record ? data.tasmin_record[index] : null,
      tasmax_record_year: data.tasmax_record_year ? data.tasmax_record_year[index] : null,
      tasmin_record_year: data.tasmin_record_year ? data.tasmin_record_year[index] : null
    };

    byDate.set(dateString, record);

    const key = monthDayKey(dateString);

    if (!byMonthDay.has(key)) {
      byMonthDay.set(key, record);
    }

    const d = dateParts(dateString);

    if (d.year >= 1981 && d.year <= 2010) {
      byMonthDay.set(key, record);
    }
  });

  return { byDate, byMonthDay };
}

function valuesForPeriod(periodDates, data) {
  const lookup = makeLookup(data);

  const out = {
    x: periodDates,
    tas: [],
    tasmin: [],
    tasmax: [],
    clim_tas: [],
    clim_tasmin: [],
    clim_tasmax: [],
    p01_tas: [],
    p99_tas: [],
    tasmax_record: [],
    tasmin_record: [],
    tasmax_record_year: [],
    tasmin_record_year: [],
    warm_extreme_x: [],
    warm_extreme_y: [],
    cold_extreme_x: [],
    cold_extreme_y: []
  };

  periodDates.forEach((dateString) => {
    const exact = lookup.byDate.get(dateString);
    const fallback = lookup.byMonthDay.get(monthDayKey(dateString));

    const p01Value = exact ? exact.p01_tas : (fallback ? fallback.p01_tas : null);
    const p99Value = exact ? exact.p99_tas : (fallback ? fallback.p99_tas : null);

    out.tas.push(exact ? exact.tas : null);
    out.tasmin.push(exact ? exact.tasmin : null);
    out.tasmax.push(exact ? exact.tasmax : null);

    out.clim_tas.push(exact ? exact.clim_tas : (fallback ? fallback.clim_tas : null));
    out.clim_tasmin.push(exact ? exact.clim_tasmin : (fallback ? fallback.clim_tasmin : null));
    out.clim_tasmax.push(exact ? exact.clim_tasmax : (fallback ? fallback.clim_tasmax : null));

    out.p01_tas.push(p01Value);
    out.p99_tas.push(p99Value);

    out.tasmax_record.push(fallback ? fallback.tasmax_record : null);
    out.tasmin_record.push(fallback ? fallback.tasmin_record : null);
    out.tasmax_record_year.push(fallback ? fallback.tasmax_record_year : null);
    out.tasmin_record_year.push(fallback ? fallback.tasmin_record_year : null);

    if (exact && finiteValue(exact.tas) && finiteValue(p99Value) && Number(exact.tas) > Number(p99Value)) {
      out.warm_extreme_x.push(dateString);
      out.warm_extreme_y.push(exact.tas);
    }

    if (exact && finiteValue(exact.tas) && finiteValue(p01Value) && Number(exact.tas) < Number(p01Value)) {
      out.cold_extreme_x.push(dateString);
      out.cold_extreme_y.push(exact.tas);
    }
  });

  return out;
}

function makeSegmentedFillTraces(x, lower, upper, name, fillcolor) {
  const traces = [];
  let startIndex = null;
  let showLegend = true;

  for (let index = 0; index < x.length; index += 1) {
    const isValid = finiteValue(lower[index]) && finiteValue(upper[index]);

    if (isValid && startIndex === null) {
      startIndex = index;
    }

    const isLast = index === x.length - 1;

    if (startIndex !== null && (!isValid || isLast)) {
      const endIndex = isValid && isLast ? index : index - 1;

      if (endIndex >= startIndex) {
        const xSegment = x.slice(startIndex, endIndex + 1);
        const lowerSegment = lower.slice(startIndex, endIndex + 1);
        const upperSegment = upper.slice(startIndex, endIndex + 1);

        traces.push({
          x: xSegment.concat([...xSegment].reverse()),
          y: lowerSegment.concat([...upperSegment].reverse()),
          fill: "toself",
          fillcolor: fillcolor,
          line: { color: "rgba(255,255,255,0)", width: 0 },
          hoverinfo: "skip",
          name: name,
          showlegend: showLegend,
          type: "scatter"
        });

        showLegend = false;
      }

      startIndex = null;
    }
  }

  return traces;
}


// 3. Data loading
async function loadManifest() {
  const response = await fetch(`${DATA_ROOT}/manifest.json`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Could not load manifest.json. HTTP ${response.status}`);
  }
  return response.json();
}

async function loadStation(stationId) {
  const stationInfo = manifest.stations.find((station) => station.id === stationId);
  if (!stationInfo) {
    throw new Error(`Station not found in manifest: ${stationId}`);
  }

  const response = await fetch(`../${stationInfo.data_file}`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Could not load station file for ${stationInfo.name}. HTTP ${response.status}`);
  }

  stationData = await response.json();
}


// 4. Control setup
function setupControls() {
  const stationSelect = document.getElementById("station-select");
  const modeSelect = document.getElementById("mode-select");
  const monthSelect = document.getElementById("month-select");
  const seasonSelect = document.getElementById("season-select");

  const defaultStation = manifest.stations.find((station) => station.name === "WHITEHORSE A") || manifest.stations[0];

  populateSelect(
    stationSelect,
    manifest.stations.map((station) => ({ label: station.name, value: station.id })),
    defaultStation.id
  );

  populateSelect(
    modeSelect,
    [
      { label: "Month", value: "month" },
      { label: "Season", value: "season" },
      { label: "Last 365 days", value: "annual" }
    ],
    "month"
  );

  populateSelect(
    monthSelect,
    monthNames.map((name, index) => ({ label: name, value: index + 1 })),
    dateParts(manifest.time_max).month
  );

  populateSelect(
    seasonSelect,
    Object.keys(seasonDefinitions).map((seasonId) => ({
      label: seasonDefinitions[seasonId].label,
      value: seasonId
    })),
    monthToSeason(dateParts(manifest.time_max).month)
  );

  stationSelect.addEventListener("change", async () => {
    await loadStation(stationSelect.value);
    refreshYearSelect();
    updatePlot();
  });

  [modeSelect, monthSelect, seasonSelect].forEach((element) => {
    element.addEventListener("change", updatePlot);
  });
}

function refreshYearSelect() {
  const yearSelect = document.getElementById("year-select");
  const years = uniqueSortedYears(stationData.time);
  const latestYear = dateParts(manifest.time_max).year;
  const selectedYear = years.includes(latestYear) ? latestYear : years[years.length - 1];

  populateSelect(
    yearSelect,
    years.map((year) => ({ label: String(year), value: year })),
    selectedYear
  );

  yearSelect.onchange = updatePlot;
}



// 5. Summary and ranking table
function periodLabelForYear(mode, year, month, season) {
  if (mode === "month") {
    return `${monthNames[month - 1]} ${year}`;
  }

  if (mode === "season") {
    return `${seasonDefinitions[season].label} ${year}`;
  }

  return `365-day period ending in ${monthNames[month - 1]} ${year}`;
}

function periodDatesForComparisonYear(mode, comparisonYear, selectedMonth, selectedSeason, selectedPeriodDates) {
  if (mode === "month") {
    const startDate = new Date(comparisonYear, selectedMonth - 1, 1);
    const endDate = new Date(comparisonYear, selectedMonth, 0);
    return makeDateRange(startDate, endDate);
  }

  if (mode === "season") {
    return makeSelectedPeriodDates("season", comparisonYear, selectedMonth, selectedSeason);
  }

  if (mode === "annual") {
    const selectedEnd = selectedPeriodDates[selectedPeriodDates.length - 1];
    const selectedEndParts = dateParts(selectedEnd);

    const endDate = new Date(comparisonYear, selectedEndParts.month - 1, selectedEndParts.day);
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 364);

    return makeDateRange(startDate, endDate);
  }

  return [];
}

function meanFinite(values) {
  const finiteValues = values
    .filter((value) => value !== null && value !== undefined && value !== "")
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value));

  if (finiteValues.length === 0) {
    return null;
  }

  return finiteValues.reduce((sum, value) => sum + value, 0) / finiteValues.length;
}

function formatSigned(value, digits = 2) {
  if (!finiteValue(value)) {
    return "";
  }

  const numberValue = Number(value);
  const sign = numberValue > 0 ? "+" : "";
  return `${sign}${numberValue.toFixed(digits)}`;
}

function formatNumber(value, digits = 2) {
  if (!finiteValue(value)) {
    return "";
  }

  return Number(value).toFixed(digits);
}

function computeRankingRows(mode, selectedYear, selectedMonth, selectedSeason, selectedPeriodDates) {
  const years = uniqueSortedYears(stationData.time);
  const rows = [];

  years.forEach((year) => {
    const comparisonDates = periodDatesForComparisonYear(
      mode,
      year,
      selectedMonth,
      selectedSeason,
      selectedPeriodDates
    );

    const comparisonSeries = valuesForPeriod(comparisonDates, stationData);
    const averageTemperature = meanFinite(comparisonSeries.tas);

    if (averageTemperature !== null) {
      rows.push({
        Year: year,
        tas: averageTemperature
      });
    }
  });

  const baselineRows = rows.filter((row) => row.Year >= 1981 && row.Year <= 2010);
  const baselineMean = meanFinite(baselineRows.map((row) => row.tas));

  if (baselineMean === null) {
    return [];
  }

  rows.forEach((row) => {
    row.Deviation = row.tas - baselineMean;
  });

  rows.sort((a, b) => b.tas - a.tas);

  rows.forEach((row, index) => {
    row.Rank = index + 1;
  });

  return rows;
}

function nearbyRankingRows(rows, selectedYear, radius = 3) {
  const selectedIndex = rows.findIndex((row) => row.Year === selectedYear);

  if (selectedIndex === -1) {
    return rows.slice(0, 7);
  }

  const start = Math.max(0, selectedIndex - radius);
  const end = Math.min(rows.length, selectedIndex + radius + 1);

  return rows.slice(start, end);
}

function updateSummaryAndRankingTable(mode, selectedYear, selectedMonth, selectedSeason, selectedStationName, selectedPeriodDates) {
  const summaryElement = document.getElementById("temperature-summary");
  const tableElement = document.getElementById("ranking-table");

  if (!summaryElement || !tableElement) {
    return;
  }

  const tableBody = tableElement.querySelector("tbody");
  if (!tableBody) {
    return;
  }

  const rows = computeRankingRows(
    mode,
    selectedYear,
    selectedMonth,
    selectedSeason,
    selectedPeriodDates
  );

  tableBody.innerHTML = "";

  if (rows.length === 0) {
    summaryElement.textContent = "Not enough data are available to calculate a ranking for this period.";
    return;
  }

  const selectedRow = rows.find((row) => row.Year === selectedYear);

  if (!selectedRow) {
    summaryElement.textContent = "The selected year does not have enough data for this period.";
    return;
  }

  const periodLabel = periodLabelForYear(mode, selectedYear, selectedMonth, selectedSeason);
  const anomalyAbs = Math.abs(selectedRow.Deviation).toFixed(2);
  const rankText = `${selectedRow.Rank}/${rows.length}`;

  if (selectedRow.Deviation >= 0) {
    summaryElement.textContent =
      `${periodLabel} is ${anomalyAbs} °C warmer than the 1981-2010 normal at ${selectedStationName}. ` +
      `It ranks ${rankText} among available years, where 1 is the warmest.`;
  } else {
    summaryElement.textContent =
      `${periodLabel} is ${anomalyAbs} °C cooler than the 1981-2010 normal at ${selectedStationName}. ` +
      `It ranks ${rankText} among available years, where 1 is the warmest and ${rows.length} is the coolest.`;
  }

  const visibleRows = nearbyRankingRows(rows, selectedYear, 3);

  visibleRows.forEach((row) => {
    const tr = document.createElement("tr");

    if (row.Year === selectedYear) {
      tr.classList.add("selected-ranking-row");
    }

    const cells = [
      row.Rank,
      row.Year,
      formatNumber(row.tas, 2),
      formatSigned(row.Deviation, 2)
    ];

    cells.forEach((value) => {
      const td = document.createElement("td");
      td.textContent = value;
      tr.appendChild(td);
    });

    tableBody.appendChild(tr);
  });
}


// 5. Plot drawing
function updatePlot() {
  if (!stationData) return;

  const stationSelect = document.getElementById("station-select");
  const mode = document.getElementById("mode-select").value;
  const year = Number(document.getElementById("year-select").value);
  const month = Number(document.getElementById("month-select").value);
  const season = document.getElementById("season-select").value;

  document.getElementById("month-control").style.display = mode === "season" ? "none" : "flex";
  document.getElementById("season-control").style.display = mode === "season" ? "flex" : "none";

  const periodDates = makeSelectedPeriodDates(mode, year, month, season);
  const series = valuesForPeriod(periodDates, stationData);

  let periodLabel = "";

  if (mode === "month") {
    periodLabel = `${monthNames[month - 1]} ${year}`;
  } else if (mode === "season") {
    periodLabel = `${seasonDefinitions[season].label} ${year}`;
  } else {
    periodLabel = series.x.length ? `Last 365 days ending ${series.x[series.x.length - 1]}` : "Last 365 days";
  }

  const traces = [];

  traces.push(...makeSegmentedFillTraces(
    series.x,
    series.clim_tasmin,
    series.clim_tasmax,
    "Normal Temp Range",
    "rgba(128,128,128,0.2)"
  ));

  traces.push(...makeSegmentedFillTraces(
    series.x,
    series.tasmin,
    series.tasmax,
    "Daily Min-Max Range",
    "rgba(255,165,0,0.14)"
  ));

  traces.push(
    {
      x: series.x,
      y: series.clim_tas,
      mode: "lines",
      name: "Normal Avg Temp",
      line: { dash: "dashdot", width: 1, color: "black" },
      connectgaps: false,
      type: "scatter"
    },
    {
      x: series.x,
      y: series.clim_tasmax,
      mode: "lines",
      name: "Normal Max Temp",
      line: { dash: "dashdot", width: 1, color: "red" },
      connectgaps: false,
      type: "scatter"
    },
    {
      x: series.x,
      y: series.clim_tasmin,
      mode: "lines",
      name: "Normal Min Temp",
      line: { dash: "dashdot", width: 1, color: "blue" },
      connectgaps: false,
      type: "scatter"
    },
    {
      x: series.x,
      y: series.tas,
      mode: "lines",
      name: "Daily Avg Temp",
      line: { width: 2.2, color: "orange" },
      connectgaps: false,
      hovertemplate: "Daily avg: %{y:.1f}°C<extra></extra>",
      type: "scatter"
    },
    {
      x: series.x,
      y: series.p99_tas,
      mode: "lines",
      name: "99th %ile (avg)",
      line: { width: 1, dash: "longdash", color: "rgba(200,0,0,0.55)" },
      connectgaps: false,
      type: "scatter"
    },
    {
      x: series.x,
      y: series.p01_tas,
      mode: "lines",
      name: "1st %ile (avg)",
      line: { width: 1, dash: "longdash", color: "rgba(0,0,200,0.55)" },
      connectgaps: false,
      type: "scatter"
    }
  );

  if (mode === "month") {
    traces.push(
      {
        x: series.x,
        y: series.tasmax_record,
        mode: "markers",
        name: "Max Temp Record",
        marker: {
          size: 4,
          symbol: "diamond",
          color: "rgba(200,0,0,0.8)"
        },
        text: series.tasmax_record_year.map((value) => value === null ? "" : String(Math.round(Number(value)))),
        hovertemplate: "Record max %{y:.1f}°C (%{text})<extra></extra>",
        type: "scatter"
      },
      {
        x: series.x,
        y: series.tasmin_record,
        mode: "markers",
        name: "Min Temp Record",
        marker: {
          size: 4,
          symbol: "diamond",
          color: "rgba(0,0,200,0.8)"
        },
        text: series.tasmin_record_year.map((value) => value === null ? "" : String(Math.round(Number(value)))),
        hovertemplate: "Record min %{y:.1f}°C (%{text})<extra></extra>",
        type: "scatter"
      }
    );
  }

  if (series.warm_extreme_x.length > 0) {
    traces.push({
      x: series.warm_extreme_x,
      y: series.warm_extreme_y,
      mode: "markers",
      name: ">99th %ile",
      marker: {
        color: "red",
        size: 6,
        symbol: "triangle-up"
      },
      type: "scatter"
    });
  }

  if (series.cold_extreme_x.length > 0) {
    traces.push({
      x: series.cold_extreme_x,
      y: series.cold_extreme_y,
      mode: "markers",
      name: "<1st %ile",
      marker: {
        color: "blue",
        size: 6,
        symbol: "triangle-down"
      },
      type: "scatter"
    });
  }

  const yRange = finiteMinMax([
    series.tas,
    series.tasmin,
    series.tasmax,
    series.clim_tasmin,
    series.clim_tasmax,
    series.p01_tas,
    series.p99_tas,
    series.tasmax_record,
    series.tasmin_record
  ]);

  const layout = {
    title: {
      text: `${stationSelect.options[stationSelect.selectedIndex].text} Daily Temperatures - ${periodLabel}`,
      x: 0.5,
      font: { size: 17 }
    },
    xaxis: {
      title: "Date",
      range: series.x.length ? paddedDateRange(series.x[0], series.x[series.x.length - 1]) : undefined,
      showgrid: true,
      gridcolor: "rgba(0,0,0,0.1)"
    },
    yaxis: {
      title: "Temperature (°C)",
      zeroline: true,
      range: yRange
    },
    plot_bgcolor: "white",
    paper_bgcolor: "white",
    hovermode: "x unified",
    legend: {
      orientation: "h",
      x: 0.01,
      y: 1.03,
      xanchor: "left",
      yanchor: "top"
    },
    margin: {
      l: 60,
      r: 20,
      t: 130,
      b: 60
    }
  };

  const config = {
    responsive: true,
    displaylogo: false
  };

  Plotly.react("temperature-plot", traces, layout, config);

  updateSummaryAndRankingTable(
    mode,
    year,
    month,
    season,
    stationSelect.options[stationSelect.selectedIndex].text,
    series.x
  );

  setStatus(
    `Data updated ${manifest.created}. Source period: ${manifest.time_min} to ${manifest.time_max}. Baseline: ${manifest.baseline}.`
  );
}


// 6. Startup
async function start() {
  try {
    manifest = await loadManifest();
    setupControls();

    const defaultStation = manifest.stations.find((station) => station.name === "WHITEHORSE A") || manifest.stations[0];

    await loadStation(defaultStation.id);
    refreshYearSelect();
    updatePlot();
  } catch (error) {
    showError(error.message);
    setStatus("Data could not be loaded.");
  }
}

start();
