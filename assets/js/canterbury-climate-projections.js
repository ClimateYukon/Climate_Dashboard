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
    const changedUnits = DEGREE_PERCENT_IDS.has(indicator.id) ? "%"
        : indicator.id === "hurs" ? "percentage points" : indicator.change_units;
    units.textContent = `Historical: ${indicator.base_units} · projected change: ${changedUnits}`;
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
    expandedSeasonIndicators.clear();
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

const expandedSeasonIndicators = new Set();


// Canterbury relative-percentage display and model-matched absolute tooltips.
const DEGREE_PERCENT_IDS = new Set(["GDD5", "GDD10", "HD18", "CD18"]);

function projectedChangeDisplay(indicator, values, rank) {
    if (DEGREE_PERCENT_IDS.has(indicator.id) &&
            Number.isFinite(values.percentage_change?.[rank])) {
        return formatChange(values.percentage_change[rank], "%");
    }
    if (indicator.id === "hurs") {
        return formatChange(values.change[rank], "pp");
    }
    return formatChange(values.change[rank], indicator.change_units);
}

const pctDetailsTooltip = document.createElement("div");
pctDetailsTooltip.className = "canterbury-percent-tooltip";
pctDetailsTooltip.setAttribute("role", "tooltip");
pctDetailsTooltip.id = "canterbury-percent-detail-tooltip";
pctDetailsTooltip.hidden = true;
document.body.appendChild(pctDetailsTooltip);
let pinnedPctButton = null;
let activePctButton = null;

function hidePctDetails(force = false) {
    if (pinnedPctButton && !force) return;
    pctDetailsTooltip.hidden = true;
    activePctButton = null;
    if (force) pinnedPctButton = null;
}

function showPctDetails(button) {
    closeIndicatorTooltips();
    activePctButton = button;
    pctDetailsTooltip.textContent = button.dataset.detail;
    pctDetailsTooltip.hidden = false;
    pctDetailsTooltip.style.left = "12px";
    pctDetailsTooltip.style.top = "12px";

    const rect = button.getBoundingClientRect();
    const width = pctDetailsTooltip.offsetWidth;
    const height = pctDetailsTooltip.offsetHeight;
    const left = Math.max(12, Math.min(
        rect.left + rect.width / 2 - width / 2,
        window.innerWidth - width - 12
    ));
    let top = rect.top - height - 10;
    if (top < 12) top = rect.bottom + 10;
    top = Math.max(12, Math.min(top, window.innerHeight - height - 12));
    pctDetailsTooltip.style.left = `${left}px`;
    pctDetailsTooltip.style.top = `${top}px`;
}

document.addEventListener("click", event => {
    if (!event.target.closest?.(".canterbury-percent-button")) {
        hidePctDetails(true);
    }
});
document.addEventListener("keydown", event => {
    if (event.key === "Escape") hidePctDetails(true);
});
window.addEventListener("scroll", () => hidePctDetails(true), {passive: true});

function createPercentageCell(indicator, values, rank, className, years) {
    const displayed = projectedChangeDisplay(indicator, values, rank);
    const cell = createCell(displayed, className);
    const details = values.percent_details?.[rank];
    if (!details) return cell;

    const percentileLabel = {p10: "Low (10th percentile)",
        p50: "Median (50th percentile)", p90: "High (90th percentile)"}[rank];
    const explanation = DEGREE_PERCENT_IDS.has(indicator.id) &&
        !Number.isFinite(values.percentage_change?.[rank])
        ? "Relative % unavailable because at least one model has zero baseline degree-days."
        : "Historical, future and absolute values follow the model ranking of this change percentile.";
    const text = [
        `${indicator.name} | ${years}`,
        percentileLabel,
        `Displayed change: ${displayed}`,
        `Historical (1995–2014): ${number(details.historical, indicator.base_units)}`,
        `Projected value: ${number(details.future, indicator.base_units)}`,
        `Absolute change: ${formatChange(details.absolute_change, indicator.id === "hurs" ? "pp" : indicator.base_units)}`,
        explanation
    ].join("\n");

    const button = document.createElement("button");
    button.className = "canterbury-percent-button";
    button.type = "button";
    button.textContent = displayed;
    button.dataset.detail = text;
    button.setAttribute("aria-describedby", pctDetailsTooltip.id);
    button.setAttribute("aria-label", text.replaceAll("\n", ". "));
    button.addEventListener("mouseenter", () => {
        if (!pinnedPctButton) showPctDetails(button);
    });
    button.addEventListener("mouseleave", () => {
        if (!pinnedPctButton) hidePctDetails();
    });
    button.addEventListener("focus", () => {
        if (!pinnedPctButton) showPctDetails(button);
    });
    button.addEventListener("blur", () => {
        if (!pinnedPctButton) hidePctDetails();
    });
    button.addEventListener("click", event => {
        event.stopPropagation();
        if (pinnedPctButton === button) {
            hidePctDetails(true);
        } else {
            pinnedPctButton = button;
            showPctDetails(button);
        }
    });
    cell.textContent = "";
    cell.appendChild(button);
    return cell;
}

function renderTable() {
    hidePctDetails(true);
    tableBody.innerHTML = "";
    const indicators = filteredIndicators(state.filterText);
    const periods = state.manifest.periods;
    const seasonLabels = [
        ["DJF", "Summer (Dec–Feb)"],
        ["MAM", "Autumn (Mar–May)"],
        ["JJA", "Winter (Jun–Aug)"],
        ["SON", "Spring (Sep–Nov)"]
    ];
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

        const seasonalEntries = seasonLabels.filter(([key]) =>
            indicator.seasons?.[key]?.scenarios?.[state.scenario]
        );
        const hasSeasons = seasonalEntries.length > 0;
        const isOpen = expandedSeasonIndicators.has(indicator.id);
        const seasonalRows = [];

        const row = document.createElement("tr");
        const indicatorCell = createIndicatorCell(indicator);
        let toggle = null;

        if (hasSeasons) {
            toggle = document.createElement("button");
            toggle.type = "button";
            toggle.className = "seasonal-toggle";
            toggle.textContent = "▸";
            toggle.setAttribute("aria-expanded", String(isOpen));
            toggle.setAttribute("aria-label",
                `${isOpen ? "Hide" : "Show"} seasons for ${indicator.name}`);
            toggle.setAttribute("title", "Show or hide seasons");
            toggle.setAttribute("aria-controls", seasonalEntries.map(([key]) =>
                `season-${indicator.id}-${key}`).join(" "));

            const labelContainer = indicatorCell.querySelector(
                ".indicator-name-wrapper > div");
            if (!labelContainer) throw new Error("Indicator label element not found");
            labelContainer.insertBefore(toggle, labelContainer.firstChild);
        }

        row.appendChild(indicatorCell);
        row.appendChild(createCell(
            number(indicator.historical.p50, indicator.base_units),
            "historical-cell median-value"
        ));
        periods.forEach(period => {
            const periodClass = period.id === "2041" ? "near" : "late";
            const values = indicator.scenarios[state.scenario][period.id];
            row.appendChild(createPercentageCell(

                indicator, values, "p10", `${periodClass}-cell`, period.years

            ));
            row.appendChild(createPercentageCell(

                indicator, values, "p50", `${periodClass}-cell median-value`, period.years

            ));
            row.appendChild(createPercentageCell(

                indicator, values, "p90", `${periodClass}-cell`, period.years

            ));
        });
        tableBody.appendChild(row);

        for (const [seasonCode, seasonLabel] of seasonalEntries) {
            const seasonData = indicator.seasons[seasonCode];
            const seasonRow = document.createElement("tr");
            seasonRow.className = "seasonal-row";
            seasonRow.id = `season-${indicator.id}-${seasonCode}`;
            seasonRow.hidden = !isOpen;
            seasonRow.appendChild(createCell(
                seasonLabel, "indicator-cell seasonal-label-cell"
            ));
            seasonRow.appendChild(createCell(
                number(seasonData.historical.p50, indicator.base_units),
                "historical-cell median-value"
            ));
            periods.forEach(period => {
                const periodClass = period.id === "2041" ? "near" : "late";
                const values = seasonData.scenarios[state.scenario][period.id];
                seasonRow.appendChild(createPercentageCell(

                    indicator, values, "p10", `${periodClass}-cell`, period.years

                ));
                seasonRow.appendChild(createPercentageCell(

                    indicator, values, "p50", `${periodClass}-cell median-value`, period.years

                ));
                seasonRow.appendChild(createPercentageCell(

                    indicator, values, "p90", `${periodClass}-cell`, period.years

                ));
            });
            tableBody.appendChild(seasonRow);
            seasonalRows.push(seasonRow);
        }

        if (toggle) {
            toggle.addEventListener("click", () => {
                const shouldOpen = !expandedSeasonIndicators.has(indicator.id);
                if (shouldOpen) expandedSeasonIndicators.add(indicator.id);
                else expandedSeasonIndicators.delete(indicator.id);
                toggle.setAttribute("aria-expanded", String(shouldOpen));
                toggle.setAttribute("aria-label",
                    `${shouldOpen ? "Hide" : "Show"} seasons for ${indicator.name}`);
                seasonalRows.forEach(seasonRow => {
                    seasonRow.hidden = !shouldOpen;
                });
            });
        }
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
            const absoluteContext = DEGREE_PERCENT_IDS.has(indicator.id) &&
                Number.isFinite(values.percentage_change?.p50)
                ? ` (${formatChange(values.change.p50, indicator.base_units)} in absolute terms)`
                : "";
            paragraph.innerHTML = `<strong>${period.years}:</strong> median projected value ${number(values.future.p50, indicator.base_units)}, ` +
                `with a median change of ${projectedChangeDisplay(indicator, values, "p50")}${absoluteContext}. ` +
                `The six-model P10–P90 change range is ${projectedChangeDisplay(indicator, values, "p10")} to ${projectedChangeDisplay(indicator, values, "p90")}.`;
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
