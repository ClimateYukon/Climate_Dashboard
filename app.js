const INDEX_PATH = "data/index.json";

async function loadIndex() {
  const response = await fetch(INDEX_PATH, { cache: "no-cache" });
  if (!response.ok) {
    throw new Error(`Could not load ${INDEX_PATH}`);
  }
  return await response.json();
}

function normalizeText(value) {
  return String(value || "").toLowerCase();
}

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function makeCard(item) {
  const link = document.createElement("a");
  link.className = "plot-card";
  link.href = `plot.html?id=${encodeURIComponent(item.id)}`;

  const imageWrap = document.createElement("div");
  imageWrap.className = "plot-preview-wrap";

  const img = document.createElement("img");
  img.src = item.preview_image;
  img.alt = item.title || "Climate plot preview";
  img.loading = "lazy";
  imageWrap.appendChild(img);

  const body = document.createElement("div");
  body.className = "plot-card-body";

  const eyebrow = document.createElement("div");
  eyebrow.className = "eyebrow";
  eyebrow.textContent = [item.category, item.station].filter(Boolean).join(" · ");

  const title = document.createElement("h3");
  title.textContent = item.title || "Untitled plot";

  const subtitle = document.createElement("p");
  subtitle.className = "subtitle";
  subtitle.textContent = item.subtitle || "";

  const description = document.createElement("p");
  description.className = "card-description";
  description.textContent = item.description || "";

  const footer = document.createElement("div");
  footer.className = "card-footer";

  const date = document.createElement("span");
  date.textContent = item.date_label || item.last_updated || "";

  const cta = document.createElement("span");
  cta.className = "card-cta";
  cta.textContent = "Open plot";

  footer.appendChild(date);
  footer.appendChild(cta);

  body.appendChild(eyebrow);
  body.appendChild(title);
  body.appendChild(subtitle);
  body.appendChild(description);
  body.appendChild(footer);

  link.appendChild(imageWrap);
  link.appendChild(body);

  return link;
}

function renderCards(items) {
  const grid = document.getElementById("card-grid");
  const empty = document.getElementById("empty-state");
  if (!grid) return;

  grid.innerHTML = "";

  if (items.length === 0) {
    empty.hidden = false;
    return;
  }

  empty.hidden = true;
  for (const item of items) {
    grid.appendChild(makeCard(item));
  }
}

function setupFilters(items) {
  const searchInput = document.getElementById("search-input");
  const categoryFilter = document.getElementById("category-filter");

  if (!searchInput || !categoryFilter) return;

  const categories = uniqueSorted(items.map((item) => item.category));
  for (const category of categories) {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    categoryFilter.appendChild(option);
  }

  function applyFilters() {
    const query = normalizeText(searchInput.value);
    const category = categoryFilter.value;

    const filtered = items.filter((item) => {
      const haystack = normalizeText([
        item.title,
        item.subtitle,
        item.description,
        item.category,
        item.station,
        item.source,
      ].join(" "));

      const matchesSearch = haystack.includes(query);
      const matchesCategory = category === "all" || item.category === category;
      return matchesSearch && matchesCategory;
    });

    renderCards(filtered);
  }

  searchInput.addEventListener("input", applyFilters);
  categoryFilter.addEventListener("change", applyFilters);
}

function getItemById(items, id) {
  return items.find((item) => item.id === id);
}

function renderPlotPage(items) {
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");
  const item = getItemById(items, id);

  const title = document.getElementById("plot-title");
  if (!title) return;

  if (!item) {
    title.textContent = "Plot not found";
    document.getElementById("plot-description").textContent = "The requested plot is not listed in data/index.json.";
    return;
  }

  document.title = `${item.title} | Climate Dashboard`;
  title.textContent = item.title || "Untitled plot";
  document.getElementById("plot-subtitle").textContent = item.subtitle || "";
  document.getElementById("plot-date").textContent = item.date_label || item.last_updated || "";
  document.getElementById("plot-description").textContent = item.description || "";
  document.getElementById("plot-source").textContent = item.source || "Not specified";
  document.getElementById("plot-category").textContent = item.category || "Not specified";
  document.getElementById("plot-station").textContent = item.station || "Not specified";

  const img = document.getElementById("full-plot-image");
  img.src = item.full_image || item.preview_image;
  img.alt = item.title || "Climate plot";
}

async function init() {
  try {
    const items = await loadIndex();
    const footer = document.getElementById("footer-status");
    if (footer) {
      footer.textContent = `${items.length} plot${items.length === 1 ? "" : "s"} available`;
    }

    if (document.getElementById("card-grid")) {
      renderCards(items);
      setupFilters(items);
    }

    if (document.getElementById("plot-title")) {
      renderPlotPage(items);
    }
  } catch (error) {
    console.error(error);
    const footer = document.getElementById("footer-status");
    if (footer) footer.textContent = "Could not load dashboard metadata.";
    const grid = document.getElementById("card-grid");
    if (grid) {
      grid.innerHTML = `<div class="error-box">Could not load <code>${INDEX_PATH}</code>. Check that the file exists and contains valid JSON.</div>`;
    }
  }
}

init();
