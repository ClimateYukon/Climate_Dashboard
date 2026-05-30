async function loadJson(path) {
  const response = await fetch(path, { cache: "no-cache" });
  if (!response.ok) {
    throw new Error(`Could not load ${path}: ${response.status}`);
  }
  return response.json();
}

function getParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

function normalize(text) {
  return String(text || "").toLowerCase();
}

function textMatches(item, query, fields) {
  if (!query) return true;
  const q = normalize(query);
  return fields.some((field) => {
    const value = item[field];
    if (Array.isArray(value)) return normalize(value.join(" ")).includes(q);
    return normalize(value).includes(q);
  });
}

function cardImage(src, title) {
  if (!src) return "";
  return `<img src="${src}" alt="${title || "Climate plot preview"}" loading="lazy" />`;
}

function renderIndicatorCard(indicator) {
  const href = `indicator.html?id=${encodeURIComponent(indicator.id)}`;
  const countLabel = indicator.plot_count === 1 ? "1 community" : `${indicator.plot_count || 0} communities`;
  const tags = (indicator.tags || []).slice(0, 4).map((tag) => `<span>${tag}</span>`).join("");

  return `
    <article class="card">
      <a href="${href}" class="card-link" aria-label="Open ${indicator.title}">
        <div class="card-image">${cardImage(indicator.preview_image, indicator.title)}</div>
        <div class="card-body">
          <p class="card-kicker">${countLabel}</p>
          <h2>${indicator.title || indicator.id}</h2>
          <p>${indicator.description || ""}</p>
          <div class="tag-row">${tags}</div>
        </div>
      </a>
    </article>
  `;
}

function renderPlotCard(plot) {
  const href = `plot.html?id=${encodeURIComponent(plot.id)}`;
  const tags = (plot.tags || []).slice(0, 4).map((tag) => `<span>${tag}</span>`).join("");
  const community = plot.community || plot.subtitle || "Community";

  return `
    <article class="card">
      <a href="${href}" class="card-link" aria-label="Open ${plot.title} for ${community}">
        <div class="card-image">${cardImage(plot.preview_image, plot.title)}</div>
        <div class="card-body">
          <p class="card-kicker">${community}</p>
          <h2>${plot.title || plot.id}</h2>
          <p>${plot.description || ""}</p>
          <p class="date-label">${plot.date_label || ""}</p>
          <div class="tag-row">${tags}</div>
        </div>
      </a>
    </article>
  `;
}

function setCards(items, renderFunction) {
  const cards = document.getElementById("cards");
  const empty = document.getElementById("emptyState");
  cards.innerHTML = items.map(renderFunction).join("");
  empty.hidden = items.length > 0;
}

async function initIndicatorHome() {
  const indicators = await loadJson("data/indicators.json");
  const search = document.getElementById("searchInput");

  function update() {
    const query = search.value;
    const filtered = indicators.filter((item) =>
      textMatches(item, query, ["title", "description", "id", "tags"])
    );
    setCards(filtered, renderIndicatorCard);
  }

  search.addEventListener("input", update);
  update();
}

async function initIndicatorPage() {
  const indicatorId = getParam("id");
  const [indicators, plots] = await Promise.all([
    loadJson("data/indicators.json"),
    loadJson("data/index.json"),
  ]);

  const indicator = indicators.find((item) => item.id === indicatorId);
  if (!indicator) {
    document.getElementById("indicatorTitle").textContent = "Indicator not found";
    document.getElementById("indicatorDescription").textContent = "The requested indicator was not found in data/indicators.json.";
    return;
  }

  document.title = indicator.title || "Climate indicator";
  document.getElementById("indicatorTitle").textContent = indicator.title || indicator.id;
  document.getElementById("indicatorDescription").textContent = indicator.description || "";
  document.getElementById("indicatorEyebrow").textContent = `${indicator.plot_count || 0} community plots`;
  document.getElementById("indicatorFooter").textContent = indicator.source || "";

  const search = document.getElementById("searchInput");
  const indicatorPlots = plots.filter((plot) => plot.indicator_id === indicatorId);

  function update() {
    const query = search.value;
    const filtered = indicatorPlots.filter((item) =>
      textMatches(item, query, ["title", "subtitle", "community", "station_id", "description", "tags"])
    );
    setCards(filtered, renderPlotCard);
  }

  search.addEventListener("input", update);
  update();
}

async function initPlotPage() {
  const plotId = getParam("id");
  const [indicators, plots] = await Promise.all([
    loadJson("data/indicators.json"),
    loadJson("data/index.json"),
  ]);

  const plot = plots.find((item) => item.id === plotId);
  if (!plot) {
    document.getElementById("plotTitle").textContent = "Plot not found";
    document.getElementById("plotDescription").textContent = "The requested plot was not found in data/index.json.";
    return;
  }

  const indicator = indicators.find((item) => item.id === plot.indicator_id);
  const back = document.getElementById("backToIndicator");
  if (indicator) {
    back.href = `indicator.html?id=${encodeURIComponent(indicator.id)}`;
    back.textContent = `← ${indicator.title || "Indicator"}`;
  }

  const community = plot.community || plot.subtitle || "";
  document.title = `${plot.title || plot.id} - ${community}`;
  document.getElementById("plotEyebrow").textContent = community;
  document.getElementById("plotTitle").textContent = plot.title || plot.id;
  document.getElementById("plotDescription").textContent = plot.description || "";

  const image = document.getElementById("fullPlot");
  image.src = plot.full_image;
  image.alt = `${plot.title || "Climate plot"} ${community}`;

  document.getElementById("plotCaption").textContent = plot.date_label || "";
  document.getElementById("plotFooter").textContent = plot.source || "";

  const details = plot.details || {};
  const metadata = {
    Community: community,
    Indicator: indicator ? indicator.title : plot.indicator_id,
    Station: plot.station_id || details.station_id,
    Year: details.year || plot.year,
    Source: plot.source,
    Updated: plot.date_label,
  };

  const rows = Object.entries(metadata)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([key, value]) => `<dt>${key}</dt><dd>${value}</dd>`)
    .join("");

  document.getElementById("metadataList").innerHTML = rows;
}
