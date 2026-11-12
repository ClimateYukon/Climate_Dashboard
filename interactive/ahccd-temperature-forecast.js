// 1. Models and UI controls. No changes to historical ranking logic.
const forecastModels = [
  {key: "ecmwf", label: "ECMWF IFS", color: "#215ba8", band: "rgba(33,91,168,.13)", core: true},
  {key: "gefs", label: "NOAA GEFS", color: "#8f43b1", band: "rgba(143,67,177,.13)", core: true},
  {key: "geps", label: "Canada GEPS", color: "#17805f", band: "rgba(23,128,95,.13)", core: true},
  {key: "aifs", label: "ECMWF AIFS (AI)", color: "#0094aa", band: "rgba(0,148,170,.13)", core: true},
  {key: "icon", label: "DWD ICON", color: "#a16c08", band: "rgba(161,108,8,.13)", core: false},
  {key: "ukmo", label: "UK MOGREPS-G", color: "#bf4177", band: "rgba(191,65,119,.13)", core: false},
  {key: "google", label: "WeatherNext 2 (AI)", color: "#c14e30", band: "rgba(193,78,48,.13)", core: false}
];
let forecastRequestId = 0;
const forecastCache = new Map();

const modelChoices = document.getElementById("forecast-model-options");
modelChoices.innerHTML = forecastModels.map((m) => `
  <label class="forecast-model-choice" id="forecast-label-${m.key}">
    <input type="checkbox" data-forecast-model="${m.key}" checked>
    <span class="forecast-color" style="background:${m.color}"></span>
    ${m.label}
  </label>
`).join("");

function checkedModelKeys(forecast) {
  return forecastModels.filter((m) =>
    document.querySelector(`[data-forecast-model="${m.key}"]`).checked && forecast.models[m.key]
  ).map((m) => m.key);
}
function refreshForecast() {
  if (document.getElementById("mode-select").value === "forecast") {
    updateForecastPlot().catch((error) => {
      showError(error.message);
      setStatus("Forecast could not be drawn.");
    });
  }
}
modelChoices.addEventListener("change", refreshForecast);
document.getElementById("forecast-bands").addEventListener("change", refreshForecast);
document.getElementById("forecast-multimodel").addEventListener("change", refreshForecast);
function setForecastSelection(selectAll) {
  forecastModels.forEach((m) => {
    const input = document.querySelector(`[data-forecast-model="${m.key}"]`);
    input.checked = !input.disabled && (selectAll || m.core);
  });
  refreshForecast();
}
document.getElementById("forecast-select-all").addEventListener("click", () => setForecastSelection(true));
document.getElementById("forecast-select-core").addEventListener("click", () => setForecastSelection(false));

// 2. Date helpers, forecast data loading, model availability.
function shiftForecastDate(iso, offsetDays) {
  const date = new Date(`${iso}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}
function forecastDayRange(start, count) {
  return Array.from({length: count}, (_, i) => shiftForecastDate(start, i));
}
function modelDailyData(raw, startDate) {
  const byDate = new Map(raw.time.map((date, i) => [date, i]));
  const days = forecastDayRange(startDate, 21);
  return {
    time: days,
    mean: days.map((date) => byDate.has(date) ? raw.mean[byDate.get(date)] : null),
    p10: days.map((date) => byDate.has(date) ? raw.p10[byDate.get(date)] : null),
    p90: days.map((date) => byDate.has(date) ? raw.p90[byDate.get(date)] : null)
  };
}
function loadForecast(stationId) {
  if (!forecastCache.has(stationId)) {
    const promise = fetch(
      withCacheBuster(`../data/interactive/ahccd_ensemble_forecasts/${stationId}.json`),
      {cache: "no-store"}
    ).then((response) => {
      if (!response.ok) throw new Error(`Forecast file for ${stationId}: HTTP ${response.status}`);
      return response.json();
    });
    forecastCache.set(stationId, promise);
  }
  return forecastCache.get(stationId);
}
function showModelAvailability(forecast) {
  forecastModels.forEach((m) => {
    const input = document.querySelector(`[data-forecast-model="${m.key}"]`);
    const available = Boolean(forecast.models[m.key]);
    input.disabled = !available;
    document.getElementById(`forecast-label-${m.key}`).title = available
      ? m.label : (forecast.errors[m.key] || "Not available from Open-Meteo");
  });
  const available = Object.keys(forecast.models);
  const missing = forecastModels.filter((m) => !available.includes(m.key)).map((m) => m.label);
  document.getElementById("forecast-model-note").textContent = missing.length
    ? `Available: ${available.length}/7. Unavailable in this download: ${missing.join(", ")}. Each model has equal weight, not each member.`
    : "All seven models downloaded. Model averages and agreement give each selected model one vote, not each member.";
}

// 3. Readable daily agreement grouped into three 7-day rows.
function agreementDateLabel(isoDate) {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Intl.DateTimeFormat("en-CA", {
    month: "short", day: "numeric", timeZone: "UTC"
  }).format(new Date(Date.UTC(year, month - 1, day, 12)));
}
function drawAgreement(forecastDates, modelMeansByDate, climByDate) {
  const days = forecastDates.map((date) => {
    const clim = climByDate.get(date);
    const values = modelMeansByDate.get(date) || [];
    const hasNormal = finiteValue(clim);
    const above = hasNormal ? values.filter((v) => v.value > clim).length : 0;
    const below = hasNormal ? values.filter((v) => v.value < clim).length : 0;
    const equal = hasNormal ? values.length - above - below : 0;
    return {date, above, below, equal, total: values.length, hasNormal};
  });

  function dayTile(d) {
    const readableDate = agreementDateLabel(d.date);
    const informative = d.total >= 2 && d.hasNormal;
    let kind = "insufficient";
    let value = d.total === 0 ? "No data" : `${d.total} model${d.total === 1 ? "" : "s"}`;
    let status = "no agreement";
    if (informative) {
      if (d.above > d.below) {
        kind = d.above / d.total >= 0.75 ? "strong-above" : "lean-above";
        value = `${d.above}/${d.total}`;
        status = "above";
      } else if (d.below > d.above) {
        kind = d.below / d.total >= 0.75 ? "strong-below" : "lean-below";
        value = `${d.below}/${d.total}`;
        status = "below";
      } else {
        kind = "mixed";
        value = `${d.above}/${d.total}`;
        status = "split";
      }
    }
    const detail = informative
      ? `${d.date}: ${d.above} of ${d.total} selected model means above normal, ${d.below} below, ${d.equal} equal. Counts are not calibrated probabilities.`
      : `${d.date}: ${d.total} selected model(s) available. At least two models and a historical normal are required.`;
    return `<div class="agreement-day ${kind}" role="img" title="${detail}" aria-label="${detail}">` +
      `<span class="agreement-day-date">${readableDate}</span>` +
      `<span class="agreement-day-value">${value}</span>` +
      `<span class="agreement-day-status">${status}</span></div>`;
  }

  document.getElementById("forecast-agreement-strip").innerHTML = [0, 7, 14].map((start, week) => {
    const segment = days.slice(start, start + 7);
    const period = `${agreementDateLabel(segment[0].date)} to ${agreementDateLabel(segment[6].date)}`;
    return `<section class="agreement-week"><div class="agreement-week-label">Week ${week + 1} (${period})</div>` +
      `<div class="agreement-week-grid">${segment.map(dayTile).join("")}</div></section>`;
  }).join("");

  const informative = days.filter((d) => d.total >= 2 && d.hasNormal);
  const strongAbove = informative.filter((d) => d.above / d.total >= 0.75).length;
  const strongBelow = informative.filter((d) => d.below / d.total >= 0.75).length;
  document.getElementById("forecast-agreement-note").innerHTML =
    `<p><b>At least 75% model agreement:</b> ${strongAbove} days above normal, ${strongBelow} days below normal` +
    ` (${informative.length} days with at least 2 selected models). Each model counts once, regardless of the number of ensemble members.</p>`;
}

// 4. Draw the 31-day temperature chart with all selected model means.
async function updateForecastPlot() {
  const requestId = ++forecastRequestId;
  const stationSelect = document.getElementById("station-select");
  const stationId = stationSelect.value;
  const stationName = stationSelect.options[stationSelect.selectedIndex].text;
  setStatus("Loading multi-model ensemble forecasts...");
  const forecast = await loadForecast(stationId);
  if (requestId !== forecastRequestId ||
      document.getElementById("mode-select").value !== "forecast" ||
      stationSelect.value !== stationId) return;
  showModelAvailability(forecast);
  const selectedKeys = checkedModelKeys(forecast);
  if (!selectedKeys.length) {
    showError("Select at least one available ensemble model.");
    setStatus("Choose a model to display its forecast.");
    return;
  }

  const firstForecast = forecast.issue_date_local;
  const forecastDates = forecastDayRange(firstForecast, 21);
  const chartDates = forecastDayRange(shiftForecastDate(firstForecast, -10), 31);
  const series = valuesForPeriod(chartDates, stationData);
  const latestObserved = stationData.time[stationData.time.length - 1];
  const observedDates = chartDates.slice(0, 10);
  const observedTemps = series.tas.slice(0, 10).map((v, i) =>
    observedDates[i] <= latestObserved ? v : null
  );
  const climByDate = new Map(chartDates.map((date, i) => [date, series.clim_tas[i]]));
  const forecastByModel = new Map(selectedKeys.map((key) => [
    key, modelDailyData(forecast.models[key], firstForecast)
  ]));
  const modelMeansByDate = new Map(forecastDates.map((date, i) => [
    date, selectedKeys.flatMap((key) => {
      const value = forecastByModel.get(key).mean[i];
      return finiteValue(value) ? [{key, value:Number(value)}] : [];
    })
  ]));
  const multiValues = forecastDates.map((date) => {
    const values = modelMeansByDate.get(date).map((entry) => entry.value);
    return values.length >= 2 ? values.reduce((sum, v) => sum + v, 0) / values.length : null;
  });
  const multiCounts = forecastDates.map((date) => modelMeansByDate.get(date).length);
  const showBands = document.getElementById("forecast-bands").checked;
  const showMulti = document.getElementById("forecast-multimodel").checked;

  const traces = [
    ...makeBandTraces(series.x, series.p01_tas, series.p99_tas, "rgba(120,130,140,.18)")
  ];
  if (showBands) selectedKeys.forEach((key) => {
    const m = forecastModels.find((item) => item.key === key);
    const data = forecastByModel.get(key);
    traces.push(...makeBandTraces(data.time, data.p10, data.p90, m.band));
  });
  traces.push({
    x: series.x, y: series.clim_tas, type: "scatter", mode: "lines",
    line: {color: "#68737f", width: 2, dash: "dash"}, showlegend: false,
    connectgaps: false,
    hovertemplate: "%{x|%b %-d}<br>1991-2020 normal: %{y:.1f} C<extra></extra>"
  });
  traces.push({
    x: observedDates, y: observedTemps, type: "scatter", mode: "lines+markers",
    line: {color: "#c97912", width: 3.2}, marker: {size: 4}, showlegend: false,
    connectgaps: false,
    hovertemplate: "%{x|%b %-d}<br>Observed mean: %{y:.1f} C<extra></extra>"
  });
  selectedKeys.forEach((key) => {
    const m = forecastModels.find((item) => item.key === key);
    const data = forecastByModel.get(key);
    traces.push({
      x: data.time, y: data.mean, type: "scatter", mode: "lines",
      line: {color: m.color, width: 2.5}, showlegend: false, connectgaps: false,
      customdata: data.p10.map((p10, i) => [p10, data.p90[i]]),
      hovertemplate: `%{x|%b %-d}<br>${m.label}: %{y:.1f} C<br>Member P10-P90: %{customdata[0]:.1f} to %{customdata[1]:.1f} C<extra></extra>`
    });
  });
  if (showMulti) traces.push({
    x: forecastDates, y: multiValues, type: "scatter", mode: "lines",
    line: {color: "#101827", width: 4}, showlegend: false, connectgaps: false,
    customdata: multiCounts,
    hovertemplate: "%{x|%b %-d}<br>Multi-model mean: %{y:.1f} C<br>Contributing models: %{customdata}<extra></extra>"
  });

  const graphMinMax = finiteMinMax([
    series.p01_tas, series.p99_tas, series.clim_tas, observedTemps,
    ...selectedKeys.flatMap((key) => {
      const d = forecastByModel.get(key);
      return showBands ? [d.mean, d.p10, d.p90] : [d.mean];
    }),
    ...(showMulti ? [multiValues] : [])
  ]);
  Plotly.react("temperature-plot", traces, {
    height: 570,
    xaxis: {
      title: "Date", type: "date", range: paddedDateRange(chartDates[0], chartDates[30]),
      tickformat: "%b %-d", dtick: 5 * 86400000,
      showgrid: true, gridcolor: "rgba(0,0,0,.08)"
    },
    yaxis: {
      title: "Daily average temperature (C)", range: graphMinMax, zeroline: true,
      zerolinecolor: "rgba(0,0,0,.25)", showgrid: true, gridcolor: "rgba(0,0,0,.10)"
    },
    shapes: [{
      type: "line", x0: firstForecast, x1: firstForecast,
      y0: 0, y1: 1, yref: "paper", line: {color: "#526173", dash: "dot", width: 1.5}
    }],
    annotations: [{
      x: firstForecast, y: 1, xref: "x", yref: "paper", text: "Forecast",
      showarrow: false, xanchor: "left", yanchor: "bottom", font: {size: 11, color: "#526173"}
    }],
    plot_bgcolor: "white", paper_bgcolor: "white", hovermode: "x unified",
    showlegend: false, margin: {l: 72, r: 25, t: 40, b: 60}
  }, {responsive: true, displaylogo: false});

  // 5. Legend and outlook in the existing dashboard cards.
  document.getElementById("graph-title").innerHTML =
    `<div class="main-title">${stationName}: 10 days observed + 21 days forecast</div>` +
    `<div class="sub-title">Daily mean temperature, ${baselineLabel()} normal and independent ensemble guidance. Each line ends at the model's available horizon.</div>`;
  document.getElementById("custom-legend").innerHTML =
    legendItem("Historical P1-P99", "band", "rgba(120,130,140,.18)") +
    legendItem("Daily normal", "line", "#68737f", {dash: true}) +
    legendItem("Observed", "line", "#c97912") +
    selectedKeys.map((key) => {
      const m = forecastModels.find((item) => item.key === key);
      return legendItem(m.label, "line", m.color);
    }).join("") +
    (showMulti ? legendItem("Multi-model mean (2+)", "line", "#101827") : "") +
    (showBands ? legendItem("Member P10-P90", "band", "rgba(90,100,120,.20)") : "");

  drawAgreement(forecastDates, modelMeansByDate, climByDate);
  const weekly = [0, 7, 14].map((start, i) => {
    const values = multiValues.slice(start, start + 7)
      .map((v, j) => finiteValue(v) && finiteValue(climByDate.get(forecastDates[start + j]))
        ? v - climByDate.get(forecastDates[start + j]) : null);
    const avg = meanFinite(values);
    return `Days ${start + 1}-${start + 7}: ${avg === null ? "insufficient models" : `${avg >= 0 ? "+" : ""}${avg.toFixed(1)} C`} (${values.filter(finiteValue).length} days with 2+ models)`;
  });
  const modelInfo = selectedKeys.map((key) => {
    const model = forecast.models[key];
    const data = forecastByModel.get(key);
    const available = data.mean.filter(finiteValue).length;
    return `${model.label}: ${available} days, ${model.member_count} members`;
  });
  document.querySelector("#summary-card h2").textContent = "Multi-model forecast outlook";
  document.getElementById("temperature-summary").innerHTML =
    `<p><b>Equal-weight multi-model anomaly:</b> ${weekly.join("; ")} relative to ${baselineLabel()}.</p>` +
    `<p><b>Selected models:</b> ${modelInfo.join("; ")}.</p>` +
    `<p>Observed dates: ${chartDates[0]} to ${chartDates[9]}. Forecast dates: ${forecastDates[0]} to ${forecastDates[20]}. ` +
    `Forecasts and observed station temperatures have different sources and can have local biases, particularly during valley inversions. ` +
    `Forecast values never enter historical rankings. P10-P90 shows within-model member spread, not a calibrated confidence interval. ` +
    `The multi-model mean requires 2+ available selected models; the models are not fully independent.</p>`;
  document.getElementById("summary-card").style.display = "block";
  document.getElementById("error-box").style.display = "none";
  const todayParts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {timeZone: "America/Whitehorse", year: "numeric", month: "2-digit", day: "2-digit"})
      .formatToParts(new Date()).filter((p) => p.type !== "literal").map((p) => [p.type, p.value])
  );
  const todayIso = `${todayParts.year}-${todayParts.month}-${todayParts.day}`;
  const forecastAgeDays = (Date.parse(todayIso + "T00:00:00Z") -
    Date.parse(forecast.issue_date_local + "T00:00:00Z")) / 86400000;
  if (forecastAgeDays > 1) {
    showError(`Forecasts were retrieved on ${forecast.issue_date_local} and may now be outdated. Check the update status below.`);
  }
  setStatus(`Observed through ${latestObserved}. Ensemble download ${forecast.updated_utc} UTC. Forecast daily timezone ${forecast.daily_timezone}. ` +
    `Forecasts are retrieved daily by Junix.`);
}
