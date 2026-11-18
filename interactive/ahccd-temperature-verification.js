// 1. Read archived day-ahead forecasts from daily, immutable Git commits.
const forecastSkillCache = new Map();
let forecastSkillRequestId = 0;
function loadDay1Skill(stationId) {
  if (!forecastSkillCache.has(stationId)) {
    forecastSkillCache.set(stationId, fetch(
      withCacheBuster(`../data/interactive/ahccd_forecast_skill/${stationId}.json`),
      {cache: "no-store"}
    ).then((response) => {
      if (!response.ok) throw new Error(`Forecast archive: HTTP ${response.status}`);
      return response.json();
    }));
  }
  return forecastSkillCache.get(stationId);
}

// 2. Match the previous day's forecast to the following day's AHCCD observation.
async function updateDay1Verification(stationId, selectedKeys) {
  const requestId = ++forecastSkillRequestId;
  const skill = await loadDay1Skill(stationId);
  if (requestId !== forecastSkillRequestId ||
      document.getElementById("mode-select").value !== "forecast" ||
      document.getElementById("station-select").value !== stationId) return;

  const days = stationData.time.slice(-7);
  const observedByDate = new Map(stationData.time.map((d, i) => [d, stationData.tas[i]]));
  const skillByDate = new Map(skill.days.map((entry) => [entry.date, entry]));
  const observed = days.map((date) => observedByDate.get(date));
  const panel = document.getElementById("forecast-day1-summary");
  const forecastCount = days.filter((date) => skillByDate.has(date)).length;
  const traces = [{
    x: days, y: observed, type: "scatter", mode: "lines+markers", name: "Observed",
    line: {color: "#17212f", width: 4}, marker: {size: 8},
    hovertemplate: "%{x|%b %-d}<br>AHCCD: %{y:.1f} °C<extra></extra>"
  }];
  const rows = [];
  selectedKeys.forEach((key) => {
    const model = forecastModels.find((item) => item.key === key);
    const predicted = days.map((d) => skillByDate.get(d)?.models?.[key] ?? null);
    const errors = predicted.flatMap((value, i) =>
      finiteValue(value) && finiteValue(observed[i]) ? [value - observed[i]] : []
    );
    if (errors.length) {
      const mae = errors.reduce((sum, v) => sum + Math.abs(v), 0) / errors.length;
      const bias = errors.reduce((sum, v) => sum + v, 0) / errors.length;
      rows.push({label: model.label, color: model.color, mae, bias, n: errors.length});
    }
    traces.push({
      x: days, y: predicted, type: "scatter", mode: "lines+markers", name: model.label,
      line: {color: model.color, width: 2, dash: "dot"}, marker: {size: 6}, connectgaps: false,
      hovertemplate: `%{x|%b %-d}<br>${model.label}: %{y:.1f} °C<extra></extra>`
    });
  });
  if (document.getElementById("forecast-multimodel").checked) {
    const multi = days.map((date) => {
      const values = selectedKeys.map((key) => skillByDate.get(date)?.models?.[key])
        .filter(finiteValue);
      return values.length >= 2 ? values.reduce((sum, v) => sum + v, 0) / values.length : null;
    });
    const errors = multi.flatMap((value, i) =>
      finiteValue(value) && finiteValue(observed[i]) ? [value - observed[i]] : []
    );
    if (errors.length) {
      rows.push({
        label: "Multi-model", color: "#101827",
        mae: errors.reduce((sum, v) => sum + Math.abs(v), 0) / errors.length,
        bias: errors.reduce((sum, v) => sum + v, 0) / errors.length,
        n: errors.length
      });
      traces.push({
        x: days, y: multi, type: "scatter", mode: "lines+markers", name: "Multi-model (2+)",
        line: {color: "#101827", width: 2.5, dash: "dash"}, marker: {size: 6},
        connectgaps: false,
        hovertemplate: "%{x|%b %-d}<br>Multi-model: %{y:.1f} °C<extra></extra>"
      });
    }
  }
  Plotly.react("forecast-day1-graph", traces, {
    height: 370,
    xaxis: {title: "Observed date", type: "date", tickformat: "%b %-d", dtick: 86400000,
            showgrid: true, gridcolor: "rgba(0,0,0,.07)"},
    yaxis: {title: "Daily mean temperature (°C)", showgrid: true, gridcolor: "rgba(0,0,0,.1)"},
    legend: {orientation: "h", y: -0.2, x: 0.5, xanchor: "center", font: {size: 10}},
    margin: {l: 65, r: 16, t: 15, b: 80},
    paper_bgcolor: "white", plot_bgcolor: "white", hovermode: "x unified"
  }, {responsive: true, displaylogo: false});
  rows.sort((a, b) => a.mae - b.mae);
  panel.innerHTML = `<p><b>Day-ahead forecasts available for ${forecastCount} of the last 7 observed dates.</b> ` +
    `MAE is the mean absolute difference from station observations; bias is forecast minus observed.</p>` +
    (rows.length ? `<div class="forecast-day1-metrics">${rows.map((r) =>
      `<div class="forecast-day1-metric"><span style="color:${r.color}">●</span> ` +
      `<b>${r.label}</b><strong>${r.mae.toFixed(1)} °C MAE</strong>` +
      `<span>${r.bias >= 0 ? "+" : ""}${r.bias.toFixed(1)} °C bias · ${r.n}/7 days</span></div>`
    ).join("")}</div>` : `<p>Archived forecasts will appear after the first available download dates.</p>`);
}
