const DATA_ROOT = "data/canterbury_climate_projections";

const state = {
    manifest: null,
    geographyType: "region",
    locationId: null,
    scenario: "ssp245",
    locationData: null,
    filterText: "",
    plainLanguageFilterText: "",
    expertMode: true
};

const geographyTypeSelect = document.getElementById("geography-type");
const locationSelect = document.getElementById("location");
const scenarioSelect = document.getElementById("scenario");
const locationLabel = document.querySelector('label[for="location"]');
const filterInput = document.getElementById("indicator-filter");
const statusMessage = document.getElementById("status-message");
const projectionContent = document.getElementById("projection-content");
const locationTitle = document.getElementById("location-title");
const scenarioDescription = document.getElementById("scenario-description");
const geographyMethodText = document.getElementById("geography-method-text");
const periodSummary = document.getElementById("period-summary");
const tableHead = document.getElementById("projection-table-head");
const tableBody = document.getElementById("projection-table-body");
const noResults = document.getElementById("no-results");
const expertModeToggle = document.getElementById("expert-mode");
const expertModeStatus = document.getElementById("expert-mode-status");
const tableSection = document.querySelector(".table-section");
const plainLanguageSection = document.getElementById("plain-language-section");
const plainLanguageList = document.getElementById("plain-language-list");
const plainLanguageFilter = document.getElementById("plain-language-filter");
const plainLanguageNoResults = document.getElementById("plain-language-no-results");

function selectedGeographyType() {
    return state.manifest.geography_types.find(item => item.id === state.geographyType);
}

function selectedScenario() {
    return state.manifest.scenarios.find(item => item.id === state.scenario);
}

function signed(value, units = "") {
    if (value === null || value === undefined || Number.isNaN(Number(value))) return "—";
    const n = Number(value);
    const digits = Math.abs(n) >= 100 ? 0 : 1;
    const text = Math.abs(n) < 0.05 ? "0.0" : `${n > 0 ? "+" : ""}${n.toFixed(digits)}`;
    return units === "%" ? `${text}%` : text;
}

function number(value, units = "") {
    if (value === null || value === undefined || Number.isNaN(Number(value))) return "—";
    const n = Number(value);
    const digits = Math.abs(n) >= 100 ? 0 : 1;
    const text = n.toFixed(digits);
    if (units === "°C") return `${text}°C`;
    if (units === "%") return `${text}%`;
    if (units === "days") return `${text} days`;
    if (units === "degree-days") return `${text} degree-days`;
    if (units === "mm") return `${text} mm`;
    if (units === "m/s") return `${text} m/s`;
    if (units === "W/m²") return `${text} W/m²`;
    return units ? `${text} ${units}` : text;
}

function formatChange(value, units) {
    const text = signed(value, units);
    if (text === "—") return text;
    if (units === "%") return text;
    return `${text}${units ? ` ${units}` : ""}`;
}

function createCell(text, className = "") {
    const cell = document.createElement("td");
    cell.textContent = text;
    cell.className = className;
    return cell;
}

function closeIndicatorTooltips() {
    document.querySelectorAll(".indicator-tooltip.is-open").forEach(item => item.classList.remove("is-open"));
    document.querySelectorAll(".indicator-info-button[aria-expanded='true']").forEach(item => item.setAttribute("aria-expanded", "false"));
}

function positionIndicatorTooltip(button, tooltip) {
    const rect = button.getBoundingClientRect();
    const width = Math.min(340, window.innerWidth - 32);
    tooltip.style.width = `${width}px`;
    tooltip.style.left = "0px";
    tooltip.style.top = "0px";
    const height = tooltip.offsetHeight;
    let left = rect.left + rect.width / 2 - width / 2;
    left = Math.max(16, Math.min(left, window.innerWidth - width - 16));
    let top = rect.bottom + 12;
    if (top + height > window.innerHeight - 16) top = rect.top - height - 12;
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${Math.max(16, top)}px`;
}

function createIndicatorCell(indicator) {
    const cell = document.createElement("td");
    cell.className = "indicator-cell";

    const wrapper = document.createElement("div");
    wrapper.className = "indicator-name-wrapper";

    const labelWrap = document.createElement("div");
    const label = document.createElement("span");
    label.className = "indicator-name";
    label.textContent = indicator.name;
    labelWrap.appendChild(label);

    const units = document.createElement("span");
    units.className = "indicator-unit-note";
    units.textContent = indicator.base_units === indicator.change_units
        ? `Historical and change: ${indicator.base_units}`
        : `Historical: ${indicator.base_units} · projected change: ${indicator.change_units}`;
    labelWrap.appendChild(units);

    const button = document.createElement("button");
    button.type = "button";
    button.className = "indicator-info-button";
    button.textContent = "i";
    button.setAttribute("aria-label", `Definition of ${indicator.name}`);
    button.setAttribute("aria-expanded", "false");

    const tooltip = document.createElement("div");
    tooltip.className = "indicator-tooltip";
    tooltip.setAttribute("role", "tooltip");
    tooltip.textContent = indicator.definition;
    document.body.appendChild(tooltip);

    button.addEventListener("mouseenter", () => {
        closeIndicatorTooltips();
        tooltip.classList.add("is-open");
        positionIndicatorTooltip(button, tooltip);
    });
    button.addEventListener("mouseleave", () => {
        if (button.getAttribute("aria-expanded") !== "true") tooltip.classList.remove("is-open");
    });
    button.addEventListener("focus", () => {
        tooltip.classList.add("is-open");
        positionIndicatorTooltip(button, tooltip);
    });
    button.addEventListener("blur", () => {
        if (button.getAttribute("aria-expanded") !== "true") tooltip.classList.remove("is-open");
    });
    button.addEventListener("click", event => {
        event.stopPropagation();
        const wasOpen = button.getAttribute("aria-expanded") === "true";
        closeIndicatorTooltips();
        if (!wasOpen) {
            button.setAttribute("aria-expanded", "true");
            tooltip.classList.add("is-open");
            positionIndicatorTooltip(button, tooltip);
        }
    });

    wrapper.appendChild(labelWrap);
    wrapper.appendChild(button);
    cell.appendChild(wrapper);
    return cell;
}

function populateGeographyTypes() {
    geographyTypeSelect.innerHTML = "";
    state.manifest.geography_types.forEach(type => {
        const option = document.createElement("option");
        option.value = type.id;
        option.textContent = type.name;
        option.disabled = !type.enabled;
        geographyTypeSelect.appendChild(option);
    });
    geographyTypeSelect.value = state.geographyType;
}

function populateScenarios() {
    scenarioSelect.innerHTML = "";
    state.manifest.scenarios.forEach(scenario => {
        const option = document.createElement("option");
        option.value = scenario.id;
        option.textContent = scenario.name;
        scenarioSelect.appendChild(option);
    });
    scenarioSelect.value = state.scenario;
}

function populateLocations() {
    const type = selectedGeographyType();
    locationSelect.innerHTML = "";
    type.locations.forEach(location => {
        const option = document.createElement("option");
        option.value = location.id;
        option.textContent = location.name;
        locationSelect.appendChild(option);
    });
    if (!state.locationId || !type.locations.some(item => item.id === state.locationId)) {
        state.locationId = type.locations[0]?.id ?? null;
    }
    locationSelect.value = state.locationId;
    locationLabel.textContent = type.name;
}

async function loadLocationData() {
    const type = selectedGeographyType();
    const location = type.locations.find(item => item.id === state.locationId);
    statusMessage.hidden = false;
    projectionContent.hidden = true;
    statusMessage.textContent = `Loading ${location.name}...`;
    const response = await fetch(`${DATA_ROOT}/${location.file}`);
    if (!response.ok) throw new Error(`Could not load ${location.name}.`);
    state.locationData = await response.json();
    renderPage();
    statusMessage.hidden = true;
    projectionContent.hidden = false;
}

function renderPeriodSummary() {
    periodSummary.innerHTML = "";
    const historical = document.createElement("div");
    historical.innerHTML = `<span>Historical</span><strong>${state.manifest.historical_period}</strong>`;
    periodSummary.appendChild(historical);
    state.manifest.periods.forEach(period => {
        const item = document.createElement("div");
        item.innerHTML = `<span>${period.label}</span><strong>${period.years}</strong>`;
        periodSummary.appendChild(item);
    });
}

function renderTableHead() {
    const periods = state.manifest.periods;
    tableHead.innerHTML = "";

    const group = document.createElement("tr");
    group.className = "group-header";

    const indicator = document.createElement("th");
    indicator.rowSpan = 2;
    indicator.className = "indicator-header";
    indicator.textContent = "Climate indicator";
    group.appendChild(indicator);

    const historical = document.createElement("th");
    historical.rowSpan = 2;
    historical.className = "historical-header";
    historical.textContent = "Historical";
    group.appendChild(historical);

    periods.forEach((period, index) => {
        const th = document.createElement("th");
        th.colSpan = 3;
        th.className = period.id === "2041" ? "near-header" : "late-header";
        th.innerHTML = `${period.label}<br><small>${period.years}</small>`;
        group.appendChild(th);
    });

    const columns = document.createElement("tr");
    columns.className = "column-header";
    periods.forEach((period, index) => {
        ["Low", "Median", "High"].forEach(label => {
            const th = document.createElement("th");
            th.className = period.id === "2041" ? "near-header" : "late-header";
            th.textContent = label;
            columns.appendChild(th);
        });
    });

    tableHead.appendChild(group);
    tableHead.appendChild(columns);
}

function filteredIndicators(filterText) {
    return state.locationData.indicators.filter(indicator => {
        const text = [indicator.name, indicator.id, indicator.category, indicator.base_units, indicator.change_units]
            .join(" ").toLowerCase();
        return text.includes(filterText);
    });
}

function renderTable() {
    tableBody.innerHTML = "";
    const indicators = filteredIndicators(state.filterText);
    const periods = state.manifest.periods;
    let lastCategory = null;

    indicators.forEach(indicator => {
        if (indicator.category !== lastCategory) {
            const category = document.createElement("tr");
            category.className = "category-row";
            const cell = document.createElement("td");
            cell.colSpan = 2 + periods.length * 3;
            cell.textContent = indicator.category;
            category.appendChild(cell);
            tableBody.appendChild(category);
            lastCategory = indicator.category;
        }

        const row = document.createElement("tr");
        row.appendChild(createIndicatorCell(indicator));
        row.appendChild(createCell(number(indicator.historical.p50, indicator.base_units), "historical-cell median-value"));

        periods.forEach((period, index) => {
            const change = indicator.scenarios[state.scenario][period.id].change;
            row.appendChild(createCell(formatChange(change.p10, indicator.change_units), period.id === "2041" ? "near-cell" : "late-cell"));
            row.appendChild(createCell(formatChange(change.p50, indicator.change_units), period.id === "2041" ? "near-cell median-value" : "late-cell median-value"));
            row.appendChild(createCell(formatChange(change.p90, indicator.change_units), period.id === "2041" ? "near-cell" : "late-cell"));
        });

        tableBody.appendChild(row);
    });

    noResults.hidden = indicators.length !== 0;
}

function renderPlainLanguage() {
    plainLanguageList.innerHTML = "";
    const indicators = filteredIndicators(state.plainLanguageFilterText);
    const periods = state.manifest.periods;

    indicators.forEach(indicator => {
        const item = document.createElement("article");
        item.className = "plain-language-item";

        const heading = document.createElement("h3");
        heading.textContent = indicator.name;
        item.appendChild(heading);

        const baseline = document.createElement("p");
        baseline.className = "plain-language-baseline";
        baseline.textContent = `Historical 1995–2014 median: ${number(indicator.historical.p50, indicator.base_units)}.`;
        item.appendChild(baseline);

        periods.forEach(period => {
            const values = indicator.scenarios[state.scenario][period.id];
            const paragraph = document.createElement("p");
            paragraph.className = "plain-language-period";
            paragraph.innerHTML = `<strong>${period.years}:</strong> median projected value ${number(values.future.p50, indicator.base_units)}, ` +
                `with a median change of ${formatChange(values.change.p50, indicator.change_units)}. ` +
                `The six-model P10–P90 change range is ${formatChange(values.change.p10, indicator.change_units)} to ${formatChange(values.change.p90, indicator.change_units)}.`;
            item.appendChild(paragraph);
        });

        plainLanguageList.appendChild(item);
    });

    plainLanguageNoResults.hidden = indicators.length !== 0;
}

function applyExpertMode() {
    state.expertMode = expertModeToggle.checked;
    expertModeStatus.textContent = state.expertMode ? "On" : "Off";
    tableSection.hidden = !state.expertMode;
    plainLanguageSection.hidden = state.expertMode;
}

function renderPage() {
    const geography = state.locationData.geography;
    const scenario = selectedScenario();
    locationTitle.textContent = geography.name;
    scenarioDescription.textContent = `${scenario.name}: ${scenario.description}`;
    geographyMethodText.textContent = geography.method_note;
    document.title = `${geography.name} climate projections`;
    renderPeriodSummary();
    renderTableHead();
    renderTable();
    renderPlainLanguage();
    applyExpertMode();
}

function updateUrl() {
    const url = new URL(window.location.href);
    url.searchParams.set("type", state.geographyType);
    url.searchParams.set("location", state.locationId);
    url.searchParams.set("scenario", state.scenario);
    window.history.replaceState({}, "", url);
}

function readUrlSelections() {
    const params = new URLSearchParams(window.location.search);
    const type = params.get("type");
    const location = params.get("location");
    const scenario = params.get("scenario");

    if (type && state.manifest.geography_types.some(item => item.id === type && item.enabled)) state.geographyType = type;
    if (scenario && state.manifest.scenarios.some(item => item.id === scenario)) state.scenario = scenario;
    state.locationId = location;
}

async function initialize() {
    try {
        const response = await fetch(`${DATA_ROOT}/manifest.json`);
        if (!response.ok) throw new Error("The Canterbury climate projection manifest could not be loaded.");
        state.manifest = await response.json();
        readUrlSelections();
        populateGeographyTypes();
        populateScenarios();
        populateLocations();
        await loadLocationData();
        updateUrl();
    } catch (error) {
        statusMessage.hidden = false;
        projectionContent.hidden = true;
        statusMessage.textContent = error.message;
        console.error(error);
    }
}

geographyTypeSelect.addEventListener("change", async event => {
    state.geographyType = event.target.value;
    state.locationId = null;
    populateLocations();
    await loadLocationData();
    updateUrl();
});

locationSelect.addEventListener("change", async event => {
    state.locationId = event.target.value;
    await loadLocationData();
    updateUrl();
});

scenarioSelect.addEventListener("change", event => {
    state.scenario = event.target.value;
    renderPage();
    updateUrl();
});

filterInput.addEventListener("input", event => {
    state.filterText = event.target.value.trim().toLowerCase();
    renderTable();
});

plainLanguageFilter.addEventListener("input", event => {
    state.plainLanguageFilterText = event.target.value.trim().toLowerCase();
    renderPlainLanguage();
});

expertModeToggle.addEventListener("change", applyExpertMode);

document.addEventListener("click", event => {
    if (!event.target.closest(".indicator-info-button")) closeIndicatorTooltips();
});
document.addEventListener("keydown", event => {
    if (event.key === "Escape") closeIndicatorTooltips();
});
window.addEventListener("resize", closeIndicatorTooltips);
window.addEventListener("scroll", closeIndicatorTooltips, true);

initialize();
