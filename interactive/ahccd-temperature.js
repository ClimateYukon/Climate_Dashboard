// 1. Shared state
let manifest = null;
let stationData = null;

const DATA_ROOT = "../data/interactive/ahccd_temperature";
const DATA_CACHE_BUSTER = String(Date.now());

const monthNames = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const seasonDefinitions = {
  DJF: { label: "Winter (Dec-Feb)", months: [12, 1, 2] },
  MAM: { label: "Spring (Mar-May)", months: [3, 4, 5] },
  JJA: { label: "Summer (Jun-Aug)", months: [6, 7, 8] },
  SON: { label: "Fall (Sep-Nov)", months: [9, 10, 11] }
};


// 2. Utility functions
function withCacheBuster(path) {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}v=${DATA_CACHE_BUSTER}`;
}

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

function formatNumber(value, digits = 2) {
  if (!finiteValue(value)) {
    return "";
  }

  return Number(value).toFixed(digits);
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
  const startDate = new Date(`${startDateString}T00:00:00`);
  const endDate = new Date(`${endDateString}T00:00:00`);

  startDate.setDate(startDate.getDate() - 1);
  endDate.setDate(endDate.getDate() + 1);

  return [formatDate(startDate), formatDate(endDate)];
}

function safeDate(year, month, day) {
  const candidate = new Date(year, month - 1, day);

  if (candidate.getMonth() !== month - 1) {
    return new Date(year, month, 0);
  }

  return candidate;
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

  if (values.length === 0) return [-40, 40];

  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);

  const ymin = Math.floor((minValue - 2) / 5) * 5;
  const ymax = Math.ceil((maxValue + 2) / 5) * 5;

  return [ymin, ymax];
}

function baselineLabel() {
  return manifest.baseline || manifest.climatology_period || "reference period";
}

function getComparisonView() {
  const selected = document.querySelector("input[name='comparison-view']:checked");
  return selected ? selected.value : "average";
}


// 3. Period helpers
function seasonStartEnd(year, season) {
  if (season === "DJF") {
    return {
      start: new Date(year - 1, 11, 1),
      end: new Date(year, 2, 0)
    };
  }

  if (season === "MAM") {
    return {
      start: new Date(year, 2, 1),
      end: new Date(year, 5, 0)
    };
  }

  if (season === "JJA") {
    return {
      start: new Date(year, 5, 1),
      end: new Date(year, 8, 0)
    };
  }

  return {
    start: new Date(year, 8, 1),
    end: new Date(year, 11, 0)
  };
}

function selectedPeriod(mode, year, month, season) {
  const stationMaxDate = new Date(`${stationData.time[stationData.time.length - 1]}T00:00:00`);

  if (mode === "month") {
    const plotStart = new Date(year, month - 1, 1);
    const plotEnd = new Date(year, month, 0);
    const rankingEnd = (year === stationMaxDate.getFullYear() && month === stationMaxDate.getMonth() + 1)
      ? new Date(Math.min(plotEnd.getTime(), stationMaxDate.getTime()))
      : plotEnd;

    return {
      plotStart,
      plotEnd,
      rankingEnd,
      label: `${monthNames[month - 1]} ${year}`
    };
  }

  if (mode === "season") {
    const { start, end } = seasonStartEnd(year, season);
    const rankingEnd = (stationMaxDate >= start && stationMaxDate <= end)
      ? new Date(Math.min(end.getTime(), stationMaxDate.getTime()))
      : end;

    return {
      plotStart: start,
      plotEnd: end,
      rankingEnd,
      label: `${seasonDefinitions[season].label.replace(/\s*\(.+\)/, "")} ${year}`
    };
  }

  const plotEnd = stationMaxDate;
  const plotStart = new Date(plotEnd.getTime());
  plotStart.setDate(plotStart.getDate() - 364);

  return {
    plotStart,
    plotEnd,
    rankingEnd: plotEnd,
    label: "Last 365 days"
  };
}

function makeSelectedPeriodDates(mode, year, month, season) {
  const period = selectedPeriod(mode, year, month, season);
  return makeDateRange(period.plotStart, period.plotEnd);
}

function rankingWindowForYear(rankYear, selectedStartString, rankingEndString, mode, month, season) {
  const selectedStart = new Date(`${selectedStartString}T00:00:00`);
  const rankingEnd = new Date(`${rankingEndString}T00:00:00`);
  const dayCount = Math.round((rankingEnd - selectedStart) / 86400000) + 1;

  let start;

  if (mode === "month") {
    start = safeDate(rankYear, month, selectedStart.getDate());
  } else if (mode === "season") {
    start = seasonStartEnd(rankYear, season).start;
  } else {
    const end = safeDate(rankYear, rankingEnd.getMonth() + 1, rankingEnd.getDate());
    start = new Date(end.getTime());
    start.setDate(start.getDate() - dayCount + 1);
    return makeDateRange(start, end);
  }

  const end = new Date(start.getTime());
  end.setDate(end.getDate() + dayCount - 1);

  return makeDateRange(start, end);
}


// 4. Lookup and series
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
      p01_tasmin: data.p01_tasmin ? data.p01_tasmin[index] : null,
      p99_tasmin: data.p99_tasmin ? data.p99_tasmin[index] : null,
      p01_tasmax: data.p01_tasmax ? data.p01_tasmax[index] : null,
      p99_tasmax: data.p99_tasmax ? data.p99_tasmax[index] : null,
      tasmax_record: data.tasmax_record ? data.tasmax_record[index] : null,
      tasmin_record: data.tasmin_record ? data.tasmin_record[index] : null,
      tasmax_record_year: data.tasmax_record_year ? data.tasmax_record_year[index] : null,
      tasmin_record_year: data.tasmin_record_year ? data.tasmin_record_year[index] : null
    };

    byDate.set(dateString, record);
    byMonthDay.set(monthDayKey(dateString), record);
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
    p01_tasmin: [],
    p99_tasmin: [],
    p01_tasmax: [],
    p99_tasmax: [],
    tasmax_record: [],
    tasmin_record: [],
    tasmax_record_year: [],
    tasmin_record_year: [],
    day_class: []
  };

  periodDates.forEach((dateString) => {
    const exact = lookup.byDate.get(dateString);
    const fallback = lookup.byMonthDay.get(monthDayKey(dateString));

    out.tas.push(exact ? exact.tas : null);
    out.tasmin.push(exact ? exact.tasmin : null);
    out.tasmax.push(exact ? exact.tasmax : null);

    out.clim_tas.push(exact ? exact.clim_tas : (fallback ? fallback.clim_tas : null));
    out.clim_tasmin.push(exact ? exact.clim_tasmin : (fallback ? fallback.clim_tasmin : null));
    out.clim_tasmax.push(exact ? exact.clim_tasmax : (fallback ? fallback.clim_tasmax : null));

    out.p01_tas.push(exact ? exact.p01_tas : (fallback ? fallback.p01_tas : null));
    out.p99_tas.push(exact ? exact.p99_tas : (fallback ? fallback.p99_tas : null));
    out.p01_tasmin.push(exact ? exact.p01_tasmin : (fallback ? fallback.p01_tasmin : null));
    out.p99_tasmin.push(exact ? exact.p99_tasmin : (fallback ? fallback.p99_tasmin : null));
    out.p01_tasmax.push(exact ? exact.p01_tasmax : (fallback ? fallback.p01_tasmax : null));
    out.p99_tasmax.push(exact ? exact.p99_tasmax : (fallback ? fallback.p99_tasmax : null));

    out.tasmax_record.push(fallback ? fallback.tasmax_record : null);
    out.tasmin_record.push(fallback ? fallback.tasmin_record : null);
    out.tasmax_record_year.push(fallback ? fallback.tasmax_record_year : null);
    out.tasmin_record_year.push(fallback ? fallback.tasmin_record_year : null);
  });

  return out;
}

function classifyDay(series, index, comparisonView) {
  if (!finiteValue(series.tas[index])) {
    return "missing";
  }

  if (comparisonView === "average") {
    if (finiteValue(series.p01_tas[index]) && Number(series.tas[index]) < Number(series.p01_tas[index])) {
      return "cool";
    }

    if (finiteValue(series.p99_tas[index]) && Number(series.tas[index]) > Number(series.p99_tas[index])) {
      return "warm";
    }

    return "normal";
  }

  const lowExtreme = finiteValue(series.tasmin[index])
    && finiteValue(series.p01_tasmin[index])
    && Number(series.tasmin[index]) < Number(series.p01_tasmin[index]);

  const highExtreme = finiteValue(series.tasmax[index])
    && finiteValue(series.p99_tasmax[index])
    && Number(series.tasmax[index]) > Number(series.p99_tasmax[index]);

  if (lowExtreme && highExtreme) return "both";
  if (lowExtreme) return "cool";
  if (highExtreme) return "warm";
  return "normal";
}

function applyDayClasses(series, comparisonView) {
  series.day_class = series.x.map((_, index) => classifyDay(series, index, comparisonView));
}


// 5. Hover text
function formatYearValue(value) {
  if (!finiteValue(value)) {
    return "n/a";
  }

  return String(Math.round(Number(value)));
}

function makeHoverText(series, index, comparisonView) {
  if (!finiteValue(series.tas[index])) {
    return `<b>${series.x[index]}</b><br>No observation`;
  }

  let lines = [
    `<b>${series.x[index]}</b>`,
    "",
    "<b>Observed</b>",
    `High: ${formatNumber(series.tasmax[index], 1)} °C`,
    `Average: ${formatNumber(series.tas[index], 1)} °C`,
    `Low: ${formatNumber(series.tasmin[index], 1)} °C`,
    ""
  ];

  if (comparisonView === "average") {
    lines = lines.concat([
      "<b>Normal comparison</b>",
      `Normal average: ${formatNumber(series.clim_tas[index], 1)} °C`,
      `Extreme average range: ${formatNumber(series.p01_tas[index], 1)} to ${formatNumber(series.p99_tas[index], 1)} °C`,
      ""
    ]);
  } else {
    lines = lines.concat([
      "<b>Normal comparison</b>",
      `Normal low: ${formatNumber(series.clim_tasmin[index], 1)} °C`,
      `Normal high: ${formatNumber(series.clim_tasmax[index], 1)} °C`,
      `Extreme low threshold: ${formatNumber(series.p01_tasmin[index], 1)} °C`,
      `Extreme high threshold: ${formatNumber(series.p99_tasmax[index], 1)} °C`,
      ""
    ]);
  }

  lines = lines.concat([
    "<b>Records</b>",
    `Record high: ${formatNumber(series.tasmax_record[index], 1)} °C (${formatYearValue(series.tasmax_record_year[index])})`,
    `Record low: ${formatNumber(series.tasmin_record[index], 1)} °C (${formatYearValue(series.tasmin_record_year[index])})`
  ]);

  return lines.join("<br>");
}


// 6. Trace helpers
function makeBandTraces(x, lower, upper, fillcolor) {
  return [
    {
      x,
      y: upper,
      mode: "lines",
      line: { width: 0, color: "rgba(0,0,0,0)" },
      hoverinfo: "skip",
      showlegend: false,
      type: "scatter"
    },
    {
      x,
      y: lower,
      mode: "lines",
      line: { width: 0, color: "rgba(0,0,0,0)" },
      fill: "tonexty",
      fillcolor,
      hoverinfo: "skip",
      showlegend: false,
      type: "scatter"
    }
  ];
}

function addBackgroundBands(traces, series, comparisonView) {
  if (comparisonView === "average") {
    traces.push(...makeBandTraces(
      series.x,
      series.p01_tas,
      series.p99_tas,
      "rgba(120,130,140,0.24)"
    ));
    return;
  }

  traces.push(...makeBandTraces(
    series.x,
    series.p01_tasmin,
    series.clim_tasmin,
    "rgba(120,130,140,0.12)"
  ));

  traces.push(...makeBandTraces(
    series.x,
    series.clim_tasmin,
    series.clim_tasmax,
    "rgba(80,90,100,0.30)"
  ));

  traces.push(...makeBandTraces(
    series.x,
    series.clim_tasmax,
    series.p99_tasmax,
    "rgba(120,130,140,0.12)"
  ));
}

function makeObservedRangeTrace(series, className, color, opacity, comparisonView) {
  const x = [];
  const y = [];
  const text = [];

  series.x.forEach((dateString, index) => {
    if (
      series.day_class[index] === className
      && finiteValue(series.tasmin[index])
      && finiteValue(series.tasmax[index])
    ) {
      const hoverText = makeHoverText(series, index, comparisonView);
      x.push(dateString, dateString, null);
      y.push(series.tasmin[index], series.tasmax[index], null);
      text.push(hoverText, hoverText, null);
    }
  });

  return {
    x,
    y,
    mode: "lines",
    line: { color, width: 4 },
    opacity,
    text,
    hovertemplate: "%{text}<extra></extra>",
    showlegend: false,
    type: "scatter"
  };
}

function addExtremeMarkers(traces, series, comparisonView) {
  const coolX = [];
  const coolY = [];
  const coolText = [];
  const warmX = [];
  const warmY = [];
  const warmText = [];

  series.x.forEach((dateString, index) => {
    if (series.day_class[index] === "cool") {
      coolX.push(dateString);
      coolY.push(comparisonView === "average" ? series.tas[index] : series.tasmin[index]);
      coolText.push(makeHoverText(series, index, comparisonView));
    }

    if (series.day_class[index] === "warm") {
      warmX.push(dateString);
      warmY.push(comparisonView === "average" ? series.tas[index] : series.tasmax[index]);
      warmText.push(makeHoverText(series, index, comparisonView));
    }
  });

  traces.push({
    x: coolX,
    y: coolY,
    mode: "markers",
    marker: { size: 7, color: "#2b59d1", line: { width: 0.8, color: "white" } },
    text: coolText,
    hovertemplate: "%{text}<extra></extra>",
    showlegend: false,
    type: "scatter"
  });

  traces.push({
    x: warmX,
    y: warmY,
    mode: "markers",
    marker: { size: 7, color: "#d62828", line: { width: 0.8, color: "white" } },
    text: warmText,
    hovertemplate: "%{text}<extra></extra>",
    showlegend: false,
    type: "scatter"
  });
}

function addObservedRanges(traces, series, comparisonView, mode) {
  if (mode === "annual") {
    addExtremeMarkers(traces, series, comparisonView);
    return;
  }

  traces.push(makeObservedRangeTrace(series, "normal", "#d69b45", 0.35, comparisonView));
  traces.push(makeObservedRangeTrace(series, "cool", "#2b59d1", 0.80, comparisonView));
  traces.push(makeObservedRangeTrace(series, "warm", "#d62828", 0.80, comparisonView));
  traces.push(makeObservedRangeTrace(series, "both", "#6a00a8", 0.85, comparisonView));
}

function addRecordMarkers(traces, series) {
  traces.push({
    x: series.x,
    y: series.tasmax_record,
    mode: "markers",
    marker: {
      size: 4,
      symbol: "diamond",
      color: "rgba(170,0,0,0.45)",
      line: { width: 0.5, color: "white" }
    },
    text: series.tasmax_record_year.map(formatYearValue),
    hovertemplate: "<b>%{x|%b %-d}</b><br>Record high: %{y:.1f} °C<br>Year: %{text}<extra></extra>",
    showlegend: false,
    type: "scatter"
  });

  traces.push({
    x: series.x,
    y: series.tasmin_record,
    mode: "markers",
    marker: {
      size: 4,
      symbol: "diamond",
      color: "rgba(0,45,170,0.45)",
      line: { width: 0.5, color: "white" }
    },
    text: series.tasmin_record_year.map(formatYearValue),
    hovertemplate: "<b>%{x|%b %-d}</b><br>Record low: %{y:.1f} °C<br>Year: %{text}<extra></extra>",
    showlegend: false,
    type: "scatter"
  });
}


// 7. Legend and titles
function legendItem(label, styleType, color, options = {}) {
  const opacity = options.opacity === undefined ? 1 : options.opacity;
  const dash = options.dash || false;

  let swatchClass = "legend-swatch-line";
  let style = `border-top-color: ${color}; opacity: ${opacity};`;

  if (styleType === "band") {
    swatchClass = "legend-swatch-band";
    style = `background: ${color}; opacity: ${opacity};`;
  }

  if (styleType === "diamond") {
    swatchClass = "legend-swatch-diamond";
    style = `background: ${color}; opacity: ${opacity};`;
  }

  if (dash) {
    style += " border-top-style: dashed;";
  }

  return `<div class="legend-item"><span class="${swatchClass}" style="${style}"></span><span>${label}</span></div>`;
}

function updateGraphTitle(stationName, periodLabel, comparisonView) {
  const subtitle = comparisonView === "average"
    ? "Daily average compared with the historical daily-average extreme range"
    : "Daily lows and highs compared with normal and extreme values";

  document.getElementById("graph-title").innerHTML = `
    <div class="main-title">${stationName} Daily Temperatures - ${periodLabel}</div>
    <div class="sub-title">${subtitle}</div>
  `;
}

function updateLegend(comparisonView) {
  let historicalItems = "";
  let observedItems = "";
  let extremeItems = "";

  if (comparisonView === "average") {
    historicalItems = [
      legendItem("Extreme daily-average range", "band", "rgba(120,130,140,0.24)"),
      legendItem("Normal daily average", "line", "rgba(40,45,50,0.80)", { dash: true })
    ].join("");

    observedItems = [
      legendItem("Observed daily average", "line", "#c97912"),
      legendItem("Observed daily low-high", "line", "#d69b45", { opacity: 0.35 })
    ].join("");

    extremeItems = [
      legendItem("Extreme cool day", "line", "#2b59d1"),
      legendItem("Extreme warm day", "line", "#d62828")
    ].join("");
  } else {
    historicalItems = [
      legendItem("Normal daily low-high range", "band", "rgba(80,90,100,0.30)"),
      legendItem("Extreme low-high range", "band", "rgba(120,130,140,0.12)"),
      legendItem("Normal daily average", "line", "rgba(40,45,50,0.80)", { dash: true })
    ].join("");

    observedItems = [
      legendItem("Observed daily average", "line", "#c97912"),
      legendItem("Observed daily low-high", "line", "#d69b45", { opacity: 0.35 })
    ].join("");

    extremeItems = [
      legendItem("Extreme daily low", "line", "#2b59d1"),
      legendItem("Extreme daily high", "line", "#d62828")
    ].join("");
  }

  const recordItems = [
    legendItem("Record high", "diamond", "rgba(170,0,0,0.60)"),
    legendItem("Record low", "diamond", "rgba(0,45,170,0.60)")
  ].join("");

  document.getElementById("custom-legend").innerHTML = `
    <div><div class="legend-heading">Historical context</div>${historicalItems}</div>
    <div><div class="legend-heading">Observed temperatures</div>${observedItems}</div>
    <div><div class="legend-heading">Extremes</div>${extremeItems}</div>
    <div><div class="legend-heading">Records</div>${recordItems}</div>
  `;
}


// 8. Data loading
async function loadManifest() {
  const response = await fetch(withCacheBuster(`${DATA_ROOT}/manifest.json`), { cache: "no-store" });

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

  const response = await fetch(withCacheBuster(`../${stationInfo.data_file}`), { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`Could not load station file for ${stationInfo.name}. HTTP ${response.status}`);
  }

  stationData = await response.json();
}


// 9. Controls
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

  document.querySelectorAll("input[name='comparison-view']").forEach((element) => {
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


// 10. Ranking and summary
function meanFinite(values) {
  const finiteValues = values
    .filter((value) => finiteValue(value))
    .map(Number);

  if (finiteValues.length === 0) {
    return null;
  }

  return finiteValues.reduce((sum, value) => sum + value, 0) / finiteValues.length;
}

function computeRankingRows(mode, selectedYear, selectedMonth, selectedSeason, selectedPeriodDates, rankingEndDate) {
  const selectedStart = selectedPeriodDates[0];
  const rankingEnd = rankingEndDate;
  const selectedDayCount = Math.round(
    (new Date(`${rankingEnd}T00:00:00`) - new Date(`${selectedStart}T00:00:00`)) / 86400000
  ) + 1;

  const minDays = Math.max(1, Math.ceil(selectedDayCount * 0.85));
  const years = uniqueSortedYears(stationData.time);
  const rows = [];

  years.forEach((year) => {
    const comparisonDates = rankingWindowForYear(
      year,
      selectedStart,
      rankingEnd,
      mode,
      selectedMonth,
      selectedSeason
    );

    const comparisonSeries = valuesForPeriod(comparisonDates, stationData);
    const validTas = comparisonSeries.tas.filter(finiteValue);

    if (validTas.length < minDays) {
      return;
    }

    const averageTemperature = meanFinite(comparisonSeries.tas);
    const normalTemperature = meanFinite(comparisonSeries.clim_tas);

    if (averageTemperature !== null && normalTemperature !== null) {
      rows.push({
        Year: year,
        tas: averageTemperature,
        Deviation: averageTemperature - normalTemperature
      });
    }
  });

  rows.sort((a, b) => b.tas - a.tas);

  rows.forEach((row, index) => {
    row.Rank = index + 1;
  });

  return rows;
}

function nearbyRankingRows(rows, selectedYear, nRows = 7) {
  const selectedIndex = rows.findIndex((row) => row.Year === selectedYear);

  if (selectedIndex === -1) {
    return rows.slice(0, nRows);
  }

  const halfWindow = Math.floor(nRows / 2);
  let start = Math.max(0, selectedIndex - halfWindow);
  let end = start + nRows;

  if (end > rows.length) {
    end = rows.length;
    start = Math.max(0, end - nRows);
  }

  return rows.slice(start, end);
}

function countEvents(series) {
  let recordHigh = 0;
  let recordLow = 0;
  let extremeWarm = 0;
  let extremeCool = 0;
  let extremeHigh = 0;
  let extremeLow = 0;

  series.x.forEach((_, index) => {
    if (finiteValue(series.tasmax[index]) && finiteValue(series.tasmax_record[index]) && Number(series.tasmax[index]) >= Number(series.tasmax_record[index])) {
      recordHigh += 1;
    }

    if (finiteValue(series.tasmin[index]) && finiteValue(series.tasmin_record[index]) && Number(series.tasmin[index]) <= Number(series.tasmin_record[index])) {
      recordLow += 1;
    }

    if (finiteValue(series.tas[index]) && finiteValue(series.p99_tas[index]) && Number(series.tas[index]) > Number(series.p99_tas[index])) {
      extremeWarm += 1;
    }

    if (finiteValue(series.tas[index]) && finiteValue(series.p01_tas[index]) && Number(series.tas[index]) < Number(series.p01_tas[index])) {
      extremeCool += 1;
    }

    if (finiteValue(series.tasmax[index]) && finiteValue(series.p99_tasmax[index]) && Number(series.tasmax[index]) > Number(series.p99_tasmax[index])) {
      extremeHigh += 1;
    }

    if (finiteValue(series.tasmin[index]) && finiteValue(series.p01_tasmin[index]) && Number(series.tasmin[index]) < Number(series.p01_tasmin[index])) {
      extremeLow += 1;
    }
  });

  return {
    recordHigh,
    recordLow,
    extremeWarm,
    extremeCool,
    extremeHigh,
    extremeLow
  };
}

function updateSummaryAndRankingTable(mode, selectedYear, selectedMonth, selectedSeason, selectedStationName, selectedPeriodDates, rankingEndDate, series, comparisonView) {
  const summaryCard = document.getElementById("summary-card");
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
    selectedPeriodDates,
    rankingEndDate
  );

  tableBody.innerHTML = "";

  if (rows.length === 0) {
    summaryCard.style.display = "none";
    return;
  }

  const selectedRow = rows.find((row) => row.Year === selectedYear);

  if (!selectedRow) {
    summaryCard.style.display = "none";
    return;
  }

  const period = selectedPeriod(mode, selectedYear, selectedMonth, selectedSeason);
  const periodLabel = period.label;
  const anomalyAbs = Math.abs(selectedRow.Deviation).toFixed(2);
  const direction = selectedRow.Deviation >= 0 ? "warmer" : "cooler";
  const counts = countEvents(series);

  const line1 =
    `${periodLabel} is ${anomalyAbs} °C ${direction} than the ${baselineLabel()} normal at ${selectedStationName}. ` +
    `It ranks ${selectedRow.Rank}/${rows.length} among available years, where 1 is the warmest and ${rows.length} is the coolest.`;

  const line2 = `Records: ${counts.recordHigh} high, ${counts.recordLow} low.`;

  const line3 = comparisonView === "average"
    ? `Extreme temperature events: ${counts.extremeWarm} warm, ${counts.extremeCool} cool.`
    : `Extreme temperature events: ${counts.extremeHigh} high, ${counts.extremeLow} low.`;

  summaryCard.style.display = "block";
  summaryElement.innerHTML = `<p>${line1}</p><p>${line2}</p><p>${line3}</p>`;

  nearbyRankingRows(rows, selectedYear, 7).forEach((row) => {
    const tr = document.createElement("tr");

    if (row.Year === selectedYear) {
      tr.classList.add("selected-ranking-row");
    }

    const cells = [
      row.Rank,
      row.Year,
      formatNumber(row.tas, 2),
      formatNumber(row.Deviation, 2)
    ];

    cells.forEach((value) => {
      const td = document.createElement("td");
      td.textContent = value;
      tr.appendChild(td);
    });

    tableBody.appendChild(tr);
  });
}


// 11. Plot drawing
function monthlyTickSettings(series) {
  const firstDate = dateParts(series.x[0]);
  const lastDate = dateParts(series.x[series.x.length - 1]);
  const tickDays = [1, 5, 10, 15, 20, 25, 30];
  const tickvals = [];
  const ticktext = [];

  tickDays.forEach((day) => {
    if (day <= lastDate.day) {
      tickvals.push(formatDate(new Date(firstDate.year, firstDate.month - 1, day)));
      ticktext.push(String(day));
    }
  });

  return { tickvals, ticktext };
}

function updatePlot() {
  if (!stationData) return;

  const stationSelect = document.getElementById("station-select");
  const mode = document.getElementById("mode-select").value;
  const year = Number(document.getElementById("year-select").value);
  const month = Number(document.getElementById("month-select").value);
  const season = document.getElementById("season-select").value;
  const comparisonView = getComparisonView();

  document.getElementById("month-control").style.display = mode === "month" ? "flex" : "none";
  document.getElementById("season-control").style.display = mode === "season" ? "flex" : "none";

  const period = selectedPeriod(mode, year, month, season);
  const periodDates = makeDateRange(period.plotStart, period.plotEnd);
  const rankingEndDate = formatDate(period.rankingEnd);

  const series = valuesForPeriod(periodDates, stationData);
  applyDayClasses(series, comparisonView);

  const stationName = stationSelect.options[stationSelect.selectedIndex].text;

  updateGraphTitle(stationName, period.label, comparisonView);
  updateLegend(comparisonView);

  const traces = [];

  addBackgroundBands(traces, series, comparisonView);

  if (mode !== "annual") {
    addObservedRanges(traces, series, comparisonView, mode);
  }

  traces.push({
    x: series.x,
    y: series.clim_tas,
    mode: "lines",
    line: { width: 1.8, dash: "dash", color: "rgba(40,45,50,0.80)" },
    hoverinfo: "skip",
    showlegend: false,
    connectgaps: false,
    type: "scatter"
  });

  traces.push({
    x: series.x,
    y: series.tas,
    mode: "lines",
    line: { width: 3.0, color: "#c97912" },
    hovertemplate: "<b>%{x|%b %-d, %Y}</b><br>Observed daily average: %{y:.1f} °C<extra></extra>",
    showlegend: false,
    connectgaps: false,
    type: "scatter"
  });

  if (mode === "annual") {
    addObservedRanges(traces, series, comparisonView, mode);
  }

  addRecordMarkers(traces, series);

  const yRange = comparisonView === "average"
    ? finiteMinMax([
      series.tas,
      series.tasmin,
      series.tasmax,
      series.p01_tas,
      series.p99_tas,
      series.clim_tas,
      series.tasmax_record,
      series.tasmin_record
    ])
    : finiteMinMax([
      series.tas,
      series.tasmin,
      series.tasmax,
      series.clim_tasmin,
      series.clim_tasmax,
      series.p01_tasmin,
      series.p99_tasmax,
      series.tasmax_record,
      series.tasmin_record
    ]);

  let xaxis = {
    title: mode === "month" ? "Day of month" : "Date",
    range: series.x.length ? paddedDateRange(series.x[0], series.x[series.x.length - 1]) : undefined,
    showgrid: true,
    gridcolor: "rgba(0,0,0,0.08)",
    zeroline: false
  };

  let height = 500;

  if (mode === "month") {
    const ticks = monthlyTickSettings(series);
    xaxis = {
      ...xaxis,
      tickmode: "array",
      tickvals: ticks.tickvals,
      ticktext: ticks.ticktext
    };
  } else if (mode === "season") {
    height = 560;
    xaxis = {
      ...xaxis,
      dtick: 14 * 24 * 60 * 60 * 1000,
      tickformat: "%b %-d"
    };
  } else {
    height = 620;
    xaxis = {
      ...xaxis,
      dtick: "M1",
      tickformat: "%b"
    };
  }

  const layout = {
    height,
    xaxis,
    yaxis: {
      title: "Temperature (°C)",
      zeroline: true,
      zerolinecolor: "rgba(0,0,0,0.35)",
      showgrid: true,
      gridcolor: "rgba(0,0,0,0.10)",
      range: yRange
    },
    plot_bgcolor: "white",
    paper_bgcolor: "white",
    hovermode: "closest",
    showlegend: false,
    margin: {
      l: 70,
      r: 30,
      t: 30,
      b: 70
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
    stationName,
    periodDates,
    rankingEndDate,
    series,
    comparisonView
  );

  setStatus(
    `Data updated ${manifest.created}. Source period: ${manifest.time_min} to ${manifest.time_max}. Reference period: ${baselineLabel()}. Extreme values are outside the 1st-to-99th percentile range for that calendar day.`
  );
}


// 12. Startup
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
JS