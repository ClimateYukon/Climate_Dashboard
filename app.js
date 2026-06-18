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

    if (Array.isArray(value)) {
      return normalize(value.join(" ")).includes(q);
    }

    return normalize(value).includes(q);
  });
}

function cardImage(src, title) {
  if (!src) return "";

  return `<img src="${src}" alt="${title || "Climate plot preview"}" loading="lazy" />`;
}

function isTerritoryPlot(plot) {
  return (
    plot.scope === "territory" ||
    plot.plot_scope === "territory" ||
    plot.community === "Yukon" ||
    plot.community_name === "Yukon"
  );
}

function getIndicatorCountLabel(indicator) {
  const count = indicator.plot_count || 0;

  if (indicator.scope === "territory" || indicator.plot_scope === "territory") {
    return count === 1 ? "1 Yukon-wide plot" : `${count} Yukon-wide plots`;
  }

  return count === 1 ? "1 plot" : `${count} plots`;
}

function getIndicatorEyebrow(indicator, indicatorPlots) {
  const count = indicator.plot_count || indicatorPlots.length || 0;
  const territoryCount = indicatorPlots.filter(isTerritoryPlot).length;
  const communityCount = count - territoryCount;

  if (count === 0) {
    return "0 plots";
  }

  if (territoryCount === count) {
    return count === 1 ? "1 Yukon-wide plot" : `${count} Yukon-wide plots`;
  }

  if (territoryCount > 0 && communityCount > 0) {
    return `${count} plots`;
  }

  return count === 1 ? "1 plot" : `${count} plots`;
}

function getSearchLabel(indicatorPlots) {
  const hasOnlyTerritoryPlots =
    indicatorPlots.length > 0 && indicatorPlots.every(isTerritoryPlot);

  return hasOnlyTerritoryPlots ? "Search plots" : "Search communities";
}

function getSearchPlaceholder(indicatorPlots) {
  const hasOnlyTerritoryPlots =
    indicatorPlots.length > 0 && indicatorPlots.every(isTerritoryPlot);

  return hasOnlyTerritoryPlots ? "Search plot or topic" : "Search community or station";
}

function getPlotLocationLabel(plot) {
  return (
    plot.location_label ||
    plot.card_title ||
    plot.community_name ||
    plot.community ||
    plot.subtitle ||
    ""
  );
}

function renderIndicatorCard(indicator) {
  const href = `indicator.html?id=${encodeURIComponent(indicator.id)}`;
  const countLabel = getIndicatorCountLabel(indicator);
  const tags = (indicator.tags || [])
    .slice(0, 4)
    .map((tag) => `<span>${tag}</span>`)
    .join("");

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
  const tags = (plot.tags || [])
    .slice(0, 4)
    .map((tag) => `<span>${tag}</span>`)
    .join("");

  const locationLabel = getPlotLocationLabel(plot) || "Plot";

  return `
    <article class="card">
      <a href="${href}" class="card-link" aria-label="Open ${plot.title} for ${locationLabel}">
        <div class="card-image">${cardImage(plot.preview_image, plot.title)}</div>
        <div class="card-body">
          <p class="card-kicker">${locationLabel}</p>
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

  if (!cards || !empty) return;

  cards.innerHTML = items.map(renderFunction).join("");
  empty.hidden = items.length > 0;
}

function ensureImageLightbox() {
  if (document.getElementById("imageLightbox")) return;

  const style = document.createElement("style");
  style.textContent = `
    .image-lightbox {
      position: fixed;
      inset: 0;
      z-index: 9999;
      background: rgba(15, 23, 42, 0.92);
      display: none;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }

    .image-lightbox.is-open {
      display: flex;
    }

    .image-lightbox img {
      max-width: 96vw;
      max-height: 92vh;
      width: auto;
      height: auto;
      object-fit: contain;
      background: white;
      border-radius: 14px;
      box-shadow: 0 24px 80px rgba(0, 0, 0, 0.45);
    }

    .image-lightbox-close {
      position: fixed;
      top: 18px;
      right: 22px;
      width: 44px;
      height: 44px;
      border: 0;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.92);
      color: #0f172a;
      font-size: 30px;
      line-height: 1;
      cursor: pointer;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.25);
    }

    .image-lightbox-close:hover {
      background: white;
    }

    .image-lightbox-open-hint {
      cursor: zoom-in;
    }
  `;

  document.head.appendChild(style);

  const lightbox = document.createElement("div");
  lightbox.id = "imageLightbox";
  lightbox.className = "image-lightbox";
  lightbox.innerHTML = `
    <button class="image-lightbox-close" type="button" aria-label="Close full-screen image">&times;</button>
    <img id="imageLightboxImage" src="" alt="">
  `;

  document.body.appendChild(lightbox);

  lightbox.addEventListener("click", (event) => {
    if (
      event.target.id === "imageLightbox" ||
      event.target.classList.contains("image-lightbox-close")
    ) {
      closeImageLightbox();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeImageLightbox();
    }
  });
}

function openImageLightbox(src, alt) {
  ensureImageLightbox();

  const lightbox = document.getElementById("imageLightbox");
  const lightboxImage = document.getElementById("imageLightboxImage");

  if (!lightbox || !lightboxImage || !src) return;

  lightboxImage.src = src;
  lightboxImage.alt = alt || "Expanded plot image";

  lightbox.classList.add("is-open");
  document.body.style.overflow = "hidden";
}

function closeImageLightbox() {
  const lightbox = document.getElementById("imageLightbox");
  const lightboxImage = document.getElementById("imageLightboxImage");

  if (!lightbox) return;

  lightbox.classList.remove("is-open");
  document.body.style.overflow = "";

  if (lightboxImage) {
    lightboxImage.src = "";
  }
}

function fitFullPlotImage() {
  const image = document.getElementById("fullPlot");
  if (!image) return;

  const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
  const imageTop = image.getBoundingClientRect().top;

  const bottomPadding = 34;
  const reservedBelowImage = bottomPadding;

  const availableHeight = Math.max(
    300,
    viewportHeight - imageTop - reservedBelowImage
  );

  image.style.display = "block";
  image.style.width = "auto";
  image.style.height = "auto";
  image.style.maxWidth = "100%";
  image.style.maxHeight = `${availableHeight}px`;
  image.style.objectFit = "contain";
  image.style.marginLeft = "auto";
  image.style.marginRight = "auto";

  const parent = image.parentElement;

  if (parent) {
    parent.style.display = "flex";
    parent.style.justifyContent = "center";
    parent.style.alignItems = "center";
    parent.style.width = "100%";
    parent.style.overflow = "visible";
  }
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
    document.getElementById("indicatorDescription").textContent =
      "The requested indicator was not found in data/indicators.json.";
    return;
  }

  const indicatorPlots = plots.filter((plot) => plot.indicator_id === indicatorId);

  document.title = indicator.title || "Climate indicator";
  document.getElementById("indicatorTitle").textContent = indicator.title || indicator.id;
  document.getElementById("indicatorDescription").textContent =
    indicator.description || "";
  document.getElementById("indicatorEyebrow").textContent =
    getIndicatorEyebrow(indicator, indicatorPlots);
  document.getElementById("indicatorFooter").textContent = indicator.source || "";

  const search = document.getElementById("searchInput");

  const searchLabel = document.querySelector("label[for='searchInput']");
  if (searchLabel) {
    searchLabel.textContent = getSearchLabel(indicatorPlots);
  }

  if (search) {
    search.placeholder = getSearchPlaceholder(indicatorPlots);
  }

  function update() {
    const query = search.value;

    const filtered = indicatorPlots.filter((item) =>
      textMatches(item, query, [
        "title",
        "subtitle",
        "community",
        "community_name",
        "location_label",
        "card_title",
        "station_id",
        "description",
        "tags",
      ])
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
    document.getElementById("plotDescription").textContent =
      "The requested plot was not found in data/index.json.";
    return;
  }

  const indicator = indicators.find((item) => item.id === plot.indicator_id);
  const back = document.getElementById("backToIndicator");

  if (indicator && back) {
    back.href = `indicator.html?id=${encodeURIComponent(indicator.id)}`;
    back.textContent = `← ${indicator.title || "Indicator"}`;
  }

  const locationLabel = getPlotLocationLabel(plot);

  document.title = `${plot.title || plot.id}${locationLabel ? " - " + locationLabel : ""}`;

  document.getElementById("plotEyebrow").textContent = locationLabel;
  document.getElementById("plotTitle").textContent = plot.title || plot.id;
  document.getElementById("plotDescription").textContent = plot.description || "";

  const image = document.getElementById("fullPlot");

  image.src = plot.full_image || plot.preview_image;
  image.alt = `${plot.title || "Climate plot"} ${locationLabel}`;
  image.loading = "eager";
  image.decoding = "async";
  image.classList.add("image-lightbox-open-hint");
  image.title = "Click to expand";

  image.addEventListener("click", () => {
    openImageLightbox(
      plot.full_image || plot.preview_image,
      `${plot.title || "Climate plot"} ${locationLabel}`
    );
  });

  image.addEventListener("load", fitFullPlotImage);
  window.addEventListener("resize", fitFullPlotImage);
  window.addEventListener("orientationchange", fitFullPlotImage);

  const plotCaption = document.getElementById("plotCaption");
  if (plotCaption) {
    plotCaption.textContent = "";
    plotCaption.hidden = true;
  }

  const plotFooter = document.getElementById("plotFooter");
  if (plotFooter) {
    plotFooter.textContent = "";
    plotFooter.hidden = true;
  }

  const details = plot.details || {};

  const metadata = {
    Location: locationLabel,
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

  requestAnimationFrame(fitFullPlotImage);
}