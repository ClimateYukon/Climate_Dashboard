// ============================================================
// 1. Global dashboard state
// ============================================================

let indicators = [];

let selectedTheme = null;
let selectedIndicator = null;
let selectedView = null;
let selectedVisualization = null;

let selectedCommunity = "Whitehorse";

let temperaturePackage = null;
let precipitationPackage = null;


const themeOrder = [
    "Temperature",
    "Precipitation",
    "Snow & ice",
    "Wildfire",
    "Water & moisture",
    "Atmosphere",
    "Climate drivers"
];





const viewLabels = {
    yukon: "Yukon",
    seasonal: "Seasons",
    communities: "Communities",
    about: "About the data"
};


const visualizationLabels = {
    map: "Map",
    timeseries: "Time series",
    heatmap: "Heat map"
};


const statusLabels = {
    available: "Available",
    "in-progress": "Under analysis",
    planned: "Planned"
};


// ============================================================
// 2. Initial loading
// ============================================================

Promise.all([
    fetch("data/indicators.json").then(checkResponse),
    loadTemperaturePackage(),
    loadPrecipitationPackage()
])
.then(([indicatorCatalogue]) => {

    indicators =
        integrateTemperatureIndicators(
            indicatorCatalogue
        );

    indicators =
        integratePrecipitationIndicators(
            indicators
        );

    buildThemeCards();
    buildThemeSelect();
    buildTable();

    selectTheme(
        "Temperature"
    );
})
.catch(error => {

    console.error(error);

    document.getElementById(
        "theme-cards"
    ).innerHTML = `
        <div class="empty-state">
            Could not load the dashboard catalogue.
            <br><br>
            ${escapeHtml(error.message)}
        </div>
    `;
});


function checkResponse(response) {

    if (!response.ok) {
        throw new Error(
            `Could not load ${response.url}: ${response.status}`
        );
    }

    return response.json();
}


// ============================================================
// 3. Load complete temperature package once
// ============================================================

async function loadTemperaturePackage() {

    if (temperaturePackage) {
        return temperaturePackage;
    }

    const base =
        "data/temperature";

    const [
        metadata,
        yukon,
        seasonal,
        communities,
        communityTrends,
        communitySeasonalTrends
    ] = await Promise.all([
        fetch(
            `${base}/metadata.json`
        ).then(checkResponse),

        fetch(
            `${base}/yukon_timeseries.json`
        ).then(checkResponse),

        fetch(
            `${base}/seasonal_timeseries.json`
        ).then(checkResponse),

        fetch(
            `${base}/community_timeseries.json`
        ).then(checkResponse),

        fetch(
            `${base}/community_trends.json`
        ).then(checkResponse),

        fetch(
            `${base}/community_seasonal_trends.json`
        ).then(checkResponse)
    ]);

    temperaturePackage = {
        metadata,
        yukon,
        seasonal,
        communities,
        communityTrends,
        communitySeasonalTrends
    };

    return temperaturePackage;
}



// ============================================================
// 3b. Load precipitation dashboard package
// ============================================================

async function loadPrecipitationPackage() {

    if (precipitationPackage) {
        return precipitationPackage;
    }

    const base =
        "data/precipitation";

    const [
        metadata,
        yukon,
        seasonal,
        communities,
        communityTrends,
        communitySeasonalTrends
    ] = await Promise.all([

        fetch(
            `${base}/metadata.json`
        ).then(checkResponse),

        fetch(
            `${base}/yukon_timeseries.json`
        ).then(checkResponse),

        fetch(
            `${base}/seasonal_timeseries.json`
        ).then(checkResponse),

        fetch(
            `${base}/community_timeseries.json`
        ).then(checkResponse),

        fetch(
            `${base}/community_trends.json`
        ).then(checkResponse),

        fetch(
            `${base}/community_seasonal_trends.json`
        ).then(checkResponse)

    ]);

    precipitationPackage = {
        metadata,
        yukon,
        seasonal,
        communities,
        communityTrends,
        communitySeasonalTrends
    };

    return precipitationPackage;
}


// ============================================================
// 4. Replace tracker-level Temperature rows with dashboard
//    temperature indicators produced by the exporter
// ============================================================

function integrateTemperatureIndicators(
    catalogue
) {

    const otherIndicators =
        catalogue.filter(
            item =>
                item.dashboard_theme
                !== "Temperature"
        );

    const metadata =
        temperaturePackage.metadata;

    const temperatureIndicators =
        Object.entries(
            metadata.indicators
        )
        .map(
            ([id, info]) => {

                return {
                    id,
                    name: info.label,
                    dashboard_theme:
                        "Temperature",
                    theme:
                        "Temperature",
                    status:
                        "available",
                    relevance:
                        null,
                    source:
                        "ERA5-Land daily temperature",
                    package:
                        "temperature",
                    temperature_indicator:
                        true,
                    unit:
                        info.unit,
                    trend_unit:
                        info.trend_unit,
                    views:
                        info.views
                };
            }
        );

    return [
        ...temperatureIndicators,
        ...otherIndicators
    ];
}


// ============================================================
// 5. Theme cards
// ============================================================

function buildThemeCards() {
    const container = document.getElementById("theme-cards");
    const publishedThemes = new Set(["Temperature", "Precipitation"]);

    container.innerHTML = themeOrder.map(theme => {
        const themeIndicators = indicators.filter(item => item.dashboard_theme === theme);
        const isPublished = publishedThemes.has(theme);
        const statusText = isPublished
            ? `${themeIndicators.length} available`
            : "Under analysis";

        return `
            <button
                type="button"
                class="theme-card ${selectedTheme === theme ? "active" : ""}"
                data-theme="${escapeHtml(theme)}"
            >
                <div class="theme-card-title">${escapeHtml(theme)}</div>
                <div class="theme-card-count">
                    ${themeIndicators.length} ${themeIndicators.length === 1 ? "indicator" : "indicators"}
                </div>
                <div class="theme-card-available ${isPublished ? "" : "theme-card-under-analysis"}">
                    ${escapeHtml(statusText)}
                </div>
            </button>
        `;
    }).join("");

    container.querySelectorAll(".theme-card").forEach(card => {
        card.addEventListener("click", () => selectTheme(card.dataset.theme));
    });
}


// ============================================================
// 6. Theme dropdown
// ============================================================

function buildThemeSelect() {

    const select =
        document.getElementById(
            "theme-select"
        );

    select.innerHTML = "";

    themeOrder.forEach(theme => {

        if (
            !indicators.some(
                item =>
                    item.dashboard_theme
                    === theme
            )
        ) {
            return;
        }

        const option =
            document.createElement(
                "option"
            );

        option.value =
            theme;

        option.textContent =
            theme;

        select.appendChild(
            option
        );
    });

    select.addEventListener(
        "change",
        event => {

            selectTheme(
                event.target.value
            );
        }
    );
}


function selectTheme(theme) {

    selectedTheme =
        theme;

    document.getElementById(
        "theme-select"
    ).value =
        theme;

    document
        .querySelectorAll(
            ".theme-card"
        )
        .forEach(card => {

            card.classList.toggle(
                "active",
                card.dataset.theme
                    === theme
            );
        });

    buildIndicatorList();

    const themeIndicators =
        indicators.filter(
            item =>
                item.dashboard_theme
                === theme
        );

    if (themeIndicators.length) {
        selectIndicator(
            themeIndicators[0].id
        );
    }
}


// ============================================================
// 7. Indicator list
// ============================================================

function buildIndicatorList() {

    const container =
        document.getElementById(
            "indicator-list"
        );

    container.innerHTML = "";

    const themeIndicators =
        indicators.filter(
            item =>
                item.dashboard_theme
                === selectedTheme
        );

    themeIndicators.forEach(
        item => {

            const button =
                document.createElement(
                    "button"
                );

            button.textContent =
                item.name;

            button.dataset.id =
                item.id;

            button.addEventListener(
                "click",
                () => {

                    selectIndicator(
                        item.id
                    );
                }
            );

            container.appendChild(
                button
            );
        }
    );
}


function selectIndicator(id) {

    selectedIndicator =
        indicators.find(
            item =>
                item.id === id
        );

    if (!selectedIndicator) {
        return;
    }


    // --------------------------------------------------------
    // IMPORTANT
    //
    // A new indicator must not inherit the view/visualization
    // state from the previously selected indicator.
    //
    // Without this reset, changing from Temperature to a
    // Precipitation indicator while already on Yukon -> Map
    // can leave the old temperature map in the visualization
    // stage.
    // --------------------------------------------------------

    selectedView =
        null;

    selectedVisualization =
        null;


    document
        .querySelectorAll(
            ".indicator-list button"
        )
        .forEach(button => {

            button.classList.toggle(
                "active",
                button.dataset.id
                    === id
            );
        });


    document
        .getElementById(
            "indicator-empty"
        )
        .classList.add(
            "hidden"
        );


    document
        .getElementById(
            "indicator-panel"
        )
        .classList.remove(
            "hidden"
        );


    document.getElementById(
        "indicator-theme"
    ).textContent =
        selectedIndicator
            .dashboard_theme;


    document.getElementById(
        "indicator-title"
    ).textContent =
        selectedIndicator.name;


    const selectedMetadata =
        isTemperatureIndicator(selectedIndicator)
            ? temperaturePackage?.metadata?.indicators?.[selectedIndicator.id]
            : (
                isPrecipitationIndicator(selectedIndicator)
                    ? precipitationPackage?.metadata?.indicators?.[selectedIndicator.id]
                    : null
            );


    document.getElementById(
        "indicator-source-theme"
    ).textContent =
        selectedMetadata?.description
        || selectedIndicator.theme;


    const badge =
        document.getElementById(
            "indicator-status"
        );


    badge.className =
        `status-badge status-${selectedIndicator.status}`;


    badge.textContent =
        statusLabels[
            selectedIndicator.status
        ];


    // --------------------------------------------------------
    // Rebuild available Yukon / Seasons / Communities tabs
    // for THIS indicator
    // --------------------------------------------------------

    buildViewTabs();


    const views =
        getMainViews(
            selectedIndicator
        );


    if (!views.length) {
        return;
    }


    // --------------------------------------------------------
    // Prefer Yukon where available.
    //
    // Because selectedView was reset above, selectView() is
    // forced to render the newly selected indicator.
    // --------------------------------------------------------

    selectView(
        views.includes(
            "yukon"
        )
            ? "yukon"
            : views[0]
    );
}


// ============================================================
// 8. Main view availability
// ============================================================

function isTemperatureIndicator(
    indicator
) {

    return Boolean(
        indicator
        &&
        indicator.temperature_indicator
    );
}



// ============================================================
// Precipitation indicator integration
// ============================================================

function integratePrecipitationIndicators(
    catalogue
) {

    const otherIndicators =
        catalogue.filter(
            item =>
                item.dashboard_theme
                !== "Precipitation"
        );


    const precipitationIndicators =
        Object.entries(
            precipitationPackage
                .metadata
                .indicators
        )
        .map(
            ([id, info]) => {

                return {
                    id,
                    name:
                        info.label,
                    dashboard_theme:
                        "Precipitation",
                    theme:
                        "Precipitation",
                    status:
                        "available",
                    relevance:
                        null,
                    source:
                        "ERA5-Land daily precipitation",
                    package:
                        "precipitation",
                    precipitation_indicator:
                        true,
                    unit:
                        info.unit,
                    trend_unit:
                        info.trend_unit,
                    views:
                        info.views
                };
            }
        );


    return [
        ...otherIndicators,
        ...precipitationIndicators
    ];
}


function isPrecipitationIndicator(
    indicator
) {

    return Boolean(
        indicator
        &&
        (
            indicator.precipitation_indicator
            ||
            indicator.package
                === "precipitation"
            ||
            indicator.dashboard_theme
                === "Precipitation"
        )
    );
}


function getMainViews(indicator) {
    if (isTemperatureIndicator(indicator)) {
        const metadata = temperaturePackage.metadata.indicators[indicator.id];
        const views = [];
        if (metadata.views.yukon.length) views.push("yukon");
        if (metadata.views.seasonal.length) views.push("seasonal");
        if (metadata.views.communities.length) views.push("communities");
        views.push("about");
        return views;
    }

    if (isPrecipitationIndicator(indicator)) {
        const metadata = precipitationPackage.metadata.indicators[indicator.id];
        const views = [];
        if (metadata && metadata.views && metadata.views.yukon && metadata.views.yukon.length) views.push("yukon");
        if (metadata && metadata.views && metadata.views.seasonal && metadata.views.seasonal.length) views.push("seasonal");
        if (metadata && metadata.views && metadata.views.communities && metadata.views.communities.length) views.push("communities");
        views.push("about");
        return views;
    }

    return ["about"];
}


// ============================================================
// 9. Main view tabs
// ============================================================

function buildViewTabs() {

    const container =
        document.getElementById(
            "view-tabs"
        );

    container.innerHTML = "";

    getMainViews(
        selectedIndicator
    )
    .forEach(view => {

        const button =
            document.createElement(
                "button"
            );

        button.textContent =
            viewLabels[
                view
            ];

        button.dataset.view =
            view;

        button.addEventListener(
            "click",
            () => {

                selectView(
                    view
                );
            }
        );

        container.appendChild(
            button
        );
    });
}


function selectView(view) {

    selectedView =
        view;

    document
        .querySelectorAll(
            "#view-tabs button"
        )
        .forEach(button => {

            button.classList.toggle(
                "active",
                button.dataset.view
                    === view
            );
        });

    const content =
        document.getElementById(
            "view-content"
        );

    if (
        view === "about"
    ) {

        selectedVisualization =
            null;

        renderAbout(
            content
        );

        return;
    }

    const choices =
        getVisualizations(
            selectedIndicator,
            view
        );

    if (
        view === "communities"
        &&
        choices.includes(
            "heatmap"
        )
    ) {
        selectedVisualization =
            "heatmap";
    }
    else if (
        choices.includes(
            "map"
        )
    ) {
        selectedVisualization =
            "map";
    }
    else {
        selectedVisualization =
            choices[0];
    }

    renderAnalysisView(
        content
    );
}


// ============================================================
// 10. Visualization availability
// ============================================================

function getVisualizations(indicator, view) {
    if (isTemperatureIndicator(indicator)) {
        const metadata = temperaturePackage.metadata.indicators[indicator.id];
        return metadata.views[view] || [];
    }

    if (isPrecipitationIndicator(indicator)) {
        const metadata = precipitationPackage.metadata.indicators[indicator.id];
        if (!metadata || !metadata.views) return [];
        return metadata.views[view] || [];
    }

    return [];
}


// ============================================================
// 11. Visualization switch
// ============================================================

function renderVisualizationSwitch(
    visualizations
) {

    if (
        visualizations.length <= 1
    ) {
        return "";
    }

    return `
        <div class="visualization-toolbar">

            <span class="visualization-toolbar-label">
                View as
            </span>

            <div class="visualization-switch">

                ${
                    visualizations
                    .map(
                        type => `
                            <button
                                type="button"
                                class="
                                    visualization-switch-button
                                    ${
                                        type
                                        === selectedVisualization
                                            ? "active"
                                            : ""
                                    }
                                "
                                data-visualization="${type}"
                            >
                                ${
                                    visualizationLabels[
                                        type
                                    ]
                                }
                            </button>
                        `
                    )
                    .join("")
                }

            </div>

        </div>
    `;
}


function bindVisualizationSwitch() {

    document
        .querySelectorAll(
            ".visualization-switch-button"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    selectedVisualization =
                        button.dataset
                            .visualization;

                    renderAnalysisView(
                        document
                        .getElementById(
                            "view-content"
                        )
                    );
                }
            );
        });
}


// ============================================================
// 12. Analysis renderer
// ============================================================

function renderAnalysisView(
    container
) {

    const visualizations =
        getVisualizations(
            selectedIndicator,
            selectedView
        );

    container.innerHTML = `
        ${
            renderVisualizationSwitch(
                visualizations
            )
        }

        <div id="visualization-stage"></div>
    `;

    bindVisualizationSwitch();

    const stage =
        document.getElementById(
            "visualization-stage"
        );

    if (
        isTemperatureIndicator(
            selectedIndicator
        )
    ) {
        renderTemperatureView(
            stage
        );

        return;
    }


    if (
        isPrecipitationIndicator(
            selectedIndicator
        )
    ) {
        renderPrecipitationView(
            stage
        );

        return;
    }


    renderPlaceholder(
        stage
    );
}


// ============================================================
// 13. Temperature view router
// ============================================================

function renderTemperatureView(
    container
) {

    if (
        selectedView === "yukon"
        &&
        selectedVisualization
        === "map"
    ) {

        renderTemperatureYukonMap(
            container
        );

        return;
    }

    if (
        selectedView === "yukon"
        &&
        selectedVisualization
        === "timeseries"
    ) {

        renderTemperatureYukonTimeseries(
            container
        );

        return;
    }

    if (
        selectedView === "seasonal"
        &&
        selectedVisualization
        === "map"
    ) {

        renderTemperatureSeasonalMap(
            container
        );

        return;
    }

    if (
        selectedView === "seasonal"
        &&
        selectedVisualization
        === "timeseries"
    ) {

        renderTemperatureSeasonalTimeseries(
            container
        );

        return;
    }

    if (
        selectedView === "communities"
        &&
        selectedVisualization
        === "heatmap"
    ) {

        renderTemperatureCommunityHeatmap(
            container
        );

        return;
    }

    if (
        selectedView === "communities"
        &&
        selectedVisualization
        === "timeseries"
    ) {

        renderTemperatureCommunityTimeseries(
            container
        );

        return;
    }
}


// ============================================================
// 14. Yukon annual map
// ============================================================

function renderTemperatureYukonMap(container) {
    const id = selectedIndicator.id;
    const info = temperaturePackage.yukon.indicators[id];
    const metadata = temperaturePackage.metadata.indicators[id];
    const mapPath = metadata.files.annual_map;

    container.innerHTML = `
        <div class="visual-layout">
            <div class="visual-panel">
                <div class="visual-title">${selectedIndicator.name} trend across Yukon</div>
                <div class="visual-subtitle">${temperaturePackage.yukon.period}</div>
                <img class="dashboard-climate-map" src="${mapPath}" alt="${escapeHtml(selectedIndicator.name)} trend map across Yukon">
            </div>
            ${renderTrendMetrics(info.trend, info.trend_unit, temperaturePackage.yukon.period)}
        </div>
    `;
}


// ============================================================
// 15. Yukon annual time series
// ============================================================

function renderTemperatureYukonTimeseries(
    container
) {

    const info =
        temperaturePackage
            .yukon
            .indicators[
                selectedIndicator.id
            ];

    const useAnomaly =
        info.time_series_mode
        === "anomaly";

    const sourceValues =
        useAnomaly
            ? info.anomalies
            : info.values;

    const records =
        info.years.map(
            (
                year,
                index
            ) => ({
                year,
                value:
                    sourceValues[
                        index
                    ]
            })
        );

    const ylabel =
        useAnomaly
            ? `${info.label} anomaly (${info.unit})`
            : `${info.label} (${info.unit})`;

    const subtitle =
        useAnomaly
            ? (
                `Area-weighted Yukon mean · ` +
                `${temperaturePackage.yukon.baseline} baseline`
            )
            : (
                "Area-weighted mean across Yukon"
            );

    container.innerHTML = `

        <div class="visual-layout">

            <div class="visual-panel">

                <div class="visual-title">
                    ${info.label}
                </div>

                <div class="visual-subtitle">
                    ${subtitle}
                </div>

                ${
                    buildLineChartSvg(
                        records,
                        {
                            unit:
                                info.unit,
                            decimals:
                                temperatureDecimals(
                                    info.unit
                                ),
                            slopePerDecade:
                                info
                                .trend
                                .slope_per_decade,

                            zeroLine:
                                useAnomaly,

                            yAxisLabel:
                                ylabel,

                            ariaLabel:
                                `${info.label} Yukon time series, ${temperaturePackage.yukon.period}`
                        }
                    )
                }

                <div class="chart-legend-note">
                    Solid line: annual value.
                    Dashed line: long-term trend.
                    Hover over a year for the exact value.
                </div>

            </div>

            ${
                renderTrendMetrics(
                    info.trend,
                    info.trend_unit,
                    temperaturePackage
                        .yukon
                        .period
                )
            }

        </div>
    `;
}


// ============================================================
// 16. Seasonal map
// ============================================================

function renderTemperatureSeasonalMap(container) {
    const id = selectedIndicator.id;
    const metadata = temperaturePackage.metadata.indicators[id];
    const mapPath = metadata.files.seasonal_map;
    container.innerHTML = `
        <div class="visual-panel">
            <img
                class="dashboard-climate-map dashboard-seasonal-map"
                src="${mapPath}"
                alt="Seasonal ${escapeHtml(selectedIndicator.name)} trends across Yukon"
            >
        </div>
    `;
}


// ============================================================
// 17. Seasonal time series
// ============================================================

function renderTemperatureSeasonalTimeseries(
    container
) {

    const indicator =
        temperaturePackage
            .seasonal
            .indicators[
                selectedIndicator.id
            ];


    if (!indicator) {

        container.innerHTML = `
            <div class="visual-panel">

                <div class="empty-state">
                    Seasonal data are not available
                    for this indicator.
                </div>

            </div>
        `;

        return;
    }


    const seasonOrder =
        temperaturePackage
            .seasonal
            .season_order
        || [
            "DJF",
            "MAM",
            "JJA",
            "SON"
        ];


    const seasons =
        seasonOrder
        .map(
            seasonCode => {

                const season =
                    indicator
                        .seasons[
                            seasonCode
                        ];


                if (!season) {
                    return null;
                }


                const values =
                    season.anomalies
                    || season.values
                    || [];


                const records =
                    (
                        season.years
                        || []
                    )
                    .map(
                        (
                            year,
                            index
                        ) => ({
                            year,
                            value:
                                values[
                                    index
                                ]
                        })
                    );


                return {
                    code:
                        seasonCode,

                    name:
                        season.name
                        || seasonCode,

                    season,

                    records
                };
            }
        )
        .filter(Boolean);


    if (!seasons.length) {

        container.innerHTML = `
            <div class="visual-panel">

                <div class="empty-state">
                    Seasonal data are not available
                    for this indicator.
                </div>

            </div>
        `;

        return;
    }


    // ========================================================
    // 3. Common y-axis across all four seasons
    // ========================================================

    const allValues =
        seasons
        .flatMap(
            item =>
                item.records
                .map(
                    record =>
                        Number(
                            record.value
                        )
                )
        )
        .filter(
            Number.isFinite
        );


    let dataMinimum =
        Math.min(
            ...allValues,
            0
        );


    let dataMaximum =
        Math.max(
            ...allValues,
            0
        );


    let rawRange =
        dataMaximum
        - dataMinimum;


    if (
        !Number.isFinite(
            rawRange
        )
        ||
        rawRange <= 0
    ) {
        rawRange = 1;
    }


    const roughStep =
        rawRange
        / 6;


    const magnitude =
        Math.pow(
            10,
            Math.floor(
                Math.log10(
                    roughStep
                )
            )
        );


    const normalized =
        roughStep
        / magnitude;


    const multiplier =
        normalized <= 1
            ? 1
            : normalized <= 2
                ? 2
                : normalized <= 2.5
                    ? 2.5
                    : normalized <= 5
                        ? 5
                        : 10;


    const tickStep =
        multiplier
        * magnitude;


    const yMinimum =
        Math.floor(
            dataMinimum
            / tickStep
        )
        * tickStep;


    const yMaximum =
        Math.ceil(
            dataMaximum
            / tickStep
        )
        * tickStep;


    const yTicks = [];


    for (
        let value = yMinimum;
        value <= yMaximum + tickStep * 0.001;
        value += tickStep
    ) {

        yTicks.push(
            Math.abs(value)
            < tickStep * 1e-9
                ? 0
                : value
        );
    }


    const formatTick =
        value => {

            if (
                Math.abs(value)
                < tickStep * 1e-9
            ) {
                return "0";
            }


            if (
                Math.abs(tickStep)
                >= 1
            ) {

                return Number(
                    value
                ).toFixed(0);
            }


            return Number(
                value
            )
            .toFixed(1)
            .replace(
                /\.0$/,
                ""
            );
        };


    // ========================================================
    // 4. Shared metadata
    // ========================================================

    const period =
        temperaturePackage
            .seasonal
            .period
        || temperaturePackage
            .metadata
            ?.period
        || "1951–2025";


    const baseline =
        temperaturePackage
            .seasonal
            .baseline
        || "1961–1990";


    // ========================================================
    // 5. Build four season panels
    // ========================================================

    const panels =
        seasons
        .map(
            item => {

                const trend =
                    item
                        .season
                        .trend
                    || {};


                const slope =
                    Number(
                        trend
                            .slope_per_decade
                    );


                const trendText =
                    Number.isFinite(
                        slope
                    )
                        ? (
                            `${formatSigned(
                                slope,
                                2
                            )} ${
                                indicator
                                    .trend_unit
                                || "°C per decade"
                            }`
                        )
                        : (
                            "Trend not available"
                        );


                const pText =
                    formatPValue(
                        trend.p_value
                    );


                const significant =
                    trend
                        .significant_p05
                    ??
                    trend
                        .significant;


                const significanceText =
                    significant === true
                        ? (
                            "Statistically significant"
                        )
                        : significant === false
                            ? (
                                "Not statistically significant"
                            )
                            : (
                                "Significance not available"
                            );


                return `

                    <section class="seasonal-precip-panel">

                        <h3 class="seasonal-precip-season">
                            ${
                                escapeHtml(
                                    item.name
                                )
                            }
                        </h3>


                        <div class="seasonal-precip-chart-wrap">

                            ${
                                buildPrecipitationSeasonalChartSvg(
                                    item.records,
                                    {
                                        yMinimum,
                                        yMaximum,
                                        yTicks,
                                        formatTick,

                                        unit:
                                            indicator.unit
                                            || "°C",

                                        trend
                                    }
                                )
                            }

                        </div>


                        <div class="seasonal-precip-summary">

                            <strong>
                                ${trendText}
                            </strong>


                            <span
                                class="
                                    seasonal-precip-stat
                                    ${
                                        significant === true
                                            ? "is-significant"
                                            : significant === false
                                                ? "is-not-significant"
                                                : ""
                                    }
                                "
                            >

                                ${pText}
                                ·
                                ${significanceText}

                            </span>

                        </div>

                    </section>
                `;
            }
        )
        .join("");


    // ========================================================
    // 6. Page
    // ========================================================

    container.innerHTML = `

        <div
            class="
                visual-panel
                seasonal-precip-dashboard
            "
        >

            <div class="visual-title">
                Seasonal ${
                    escapeHtml(
                        indicator
                            .label
                            .toLowerCase()
                    )
                } anomalies
            </div>


            <div class="visual-subtitle">
                Area-weighted Yukon mean
                · ${escapeHtml(baseline)} baseline
                · ${escapeHtml(period)}
            </div>


            <div class="seasonal-precip-grid">
                ${panels}
            </div>


            <div class="seasonal-precip-note">
                All four seasons use the same vertical scale.
                The solid line shows the annual seasonal anomaly;
                the dashed line shows the long-term trend.
                Zero represents the
                ${escapeHtml(baseline)}
                seasonal average.
            </div>

        </div>
    `;
}


function renderTemperatureCommunityHeatmap(
    container
) {

    const annualPackage =
        temperaturePackage.communityTrends;

    const seasonalPackage =
        temperaturePackage.communitySeasonalTrends;


    const annualIndicator =
        annualPackage
        ?.indicators
        ?.[selectedIndicator.id];


    if (!annualIndicator) {

        container.innerHTML = `
            <div class="visual-panel">
                <div class="empty-state">
                    Community trend data are not available
                    for this indicator.
                </div>
            </div>
        `;

        return;
    }


    const seasonalIndicator =
        seasonalPackage
        ?.indicators
        ?.[selectedIndicator.id]
        || null;


    const communityOrder =
        Array.from(
            new Set([
                ...(
                    annualPackage.community_order
                    || []
                ),
                ...(
                    seasonalPackage?.community_order
                    || []
                ),
                ...Object.keys(
                    annualIndicator.communities
                    || {}
                ),
                ...Object.keys(
                    seasonalIndicator?.communities
                    || {}
                )
            ])
        )
        .sort(
            (a, b) =>
                a.localeCompare(
                    b,
                    undefined,
                    {
                        sensitivity: "base"
                    }
                )
        );


    const seasonOrder =
        seasonalPackage?.season_order
        || [
            "DJF",
            "MAM",
            "JJA",
            "SON"
        ];


    const seasonNames =
        seasonalPackage?.season_names
        || {
            DJF: "Winter",
            MAM: "Spring",
            JJA: "Summer",
            SON: "Fall"
        };


    // ========================================================
    // Columns
    //
    // Annual is always present.
    // Seasonal columns appear only when this indicator has
    // actual seasonal community results.
    // ========================================================

    const columns = [];


    if (
        seasonalIndicator
        &&
        seasonalIndicator.communities
    ) {

        seasonOrder.forEach(
            seasonCode => {

                columns.push({
                    key: seasonCode,
                    label:
                        seasonNames[seasonCode]
                        || seasonCode,
                    type: "seasonal"
                });
            }
        );
    }


    // Annual summary always comes last.
    columns.push({
        key: "annual",
        label: "Annual",
        type: "annual"
    });


    // ========================================================
    // Cell lookup
    // ========================================================

    function getCell(
        community,
        column
    ) {

        if (
            column.type
            === "annual"
        ) {

            return (
                annualIndicator
                .communities
                ?.[community]
                || null
            );
        }


        return (
            seasonalIndicator
            ?.communities
            ?.[community]
            ?.[column.key]
            || null
        );
    }


    // ========================================================
    // Common symmetric colour scale across Annual + seasons
    // ========================================================

    const magnitudes = [];


    communityOrder.forEach(
        community => {

            columns.forEach(
                column => {

                    const cell =
                        getCell(
                            community,
                            column
                        );

                    const value =
                        Number(
                            cell?.slope_per_decade
                        );


                    if (
                        Number.isFinite(
                            value
                        )
                    ) {

                        magnitudes.push(
                            Math.abs(value)
                        );
                    }
                }
            );
        }
    );


    const colourLimit =
        magnitudes.length
            ? Math.max(...magnitudes)
            : 1;


    // ========================================================
    // Temperature palette
    //
    // Negative -> blue
    // Zero     -> near-white
    // Positive -> red
    // ========================================================

    function temperatureColour(
        value
    ) {

        const x =
            Math.max(
                -1,
                Math.min(
                    1,
                    value / colourLimit
                )
            );


        if (x < 0) {

            const t =
                Math.abs(x);

            const r =
                Math.round(
                    247 + (49 - 247) * t
                );

            const g =
                Math.round(
                    247 + (111 - 247) * t
                );

            const b =
                Math.round(
                    247 + (156 - 247) * t
                );

            return `rgb(${r}, ${g}, ${b})`;
        }


        const t = x;

        const r =
            Math.round(
                247 + (181 - 247) * t
            );

        const g =
            Math.round(
                247 + (76 - 247) * t
            );

        const b =
            Math.round(
                247 + (55 - 247) * t
            );

        return `rgb(${r}, ${g}, ${b})`;
    }


    // ========================================================
    // Header
    // ========================================================

    const header = `

        <div class="seasonal-community-corner">
            Community
        </div>

        ${
            columns
            .map(
                column => `
                    <div
                        class="seasonal-community-header"
                    >
                        ${
                            escapeHtml(
                                column.label
                            )
                        }
                    </div>
                `
            )
            .join("")
        }
    `;


    // ========================================================
    // Rows
    // ========================================================

    const rows =
        communityOrder
        .map(
            community => {

                const cells =
                    columns
                    .map(
                        column => {

                            const cell =
                                getCell(
                                    community,
                                    column
                                );


                            if (!cell) {

                                return `
                                    <div
                                        class="
                                            seasonal-community-cell
                                            seasonal-community-missing
                                        "
                                        title="No data"
                                    >
                                        ·
                                    </div>
                                `;
                            }


                            const slope =
                                Number(
                                    cell.slope_per_decade
                                );


                            if (
                                !Number.isFinite(
                                    slope
                                )
                            ) {

                                return `
                                    <div
                                        class="
                                            seasonal-community-cell
                                            seasonal-community-missing
                                        "
                                        title="No data"
                                    >
                                        ·
                                    </div>
                                `;
                            }


                            const display =
                                formatHeatmapSlope(
                                    slope,
                                    annualIndicator.unit
                                );


                            const significant =
                                Boolean(
                                    cell.significant_fdr
                                );


                            const shownValue =
                                significant
                                    ? display
                                    : `(${display})`;


                            const pValue =
                                Number(
                                    cell.p_value
                                );


                            const qValue =
                                Number(
                                    cell.q_value
                                );


                            const pText =
                                Number.isFinite(pValue)
                                    ? formatPValue(pValue)
                                    : "p not available";


                            const qText =
                                Number.isFinite(qValue)
                                    ? (
                                        qValue < 0.001
                                            ? "q < 0.001"
                                            : `q = ${qValue.toFixed(3)}`
                                    )
                                    : "q not available";


                            const significanceText =
                                significant
                                    ? "significant after accounting for multiple comparisons"
                                    : "not significant after accounting for multiple comparisons";


                            return `
                                <div
                                    class="
                                        seasonal-community-cell
                                        ${
                                            significant
                                                ? "significant"
                                                : "not-significant"
                                        }
                                    "
                                    style="
                                        background:
                                            ${
                                                temperatureColour(
                                                    slope
                                                )
                                            };
                                    "
                                    title="${
                                        escapeHtml(
                                            `${community}, `
                                            + `${column.label}: `
                                            + `${display} `
                                            + `${annualIndicator.unit}; `
                                            + `${pText}; `
                                            + `${qText}; `
                                            + significanceText
                                        )
                                    }"
                                >
                                    ${shownValue}
                                </div>
                            `;
                        }
                    )
                    .join("");


                return `

                    <div
                        class="seasonal-community-name"
                    >
                        ${
                            escapeHtml(
                                community
                            )
                        }
                    </div>

                    ${cells}
                `;
            }
        )
        .join("");


    // ========================================================
    // Grid sizing
    // ========================================================

    const gridTemplate =
        [
            "minmax(170px, 1.6fr)",
            ...columns.map(
                () =>
                    "minmax(92px, 1fr)"
            )
        ]
        .join(" ");


    const period =
        seasonalPackage?.period
        ||
        annualPackage?.period
        ||
        "1951–2025";


    // ========================================================
    // Render
    // ========================================================

    container.innerHTML = `

        <div class="visual-panel">

            <div class="visual-title">
                ${
                    escapeHtml(
                        annualIndicator.label
                    )
                }
                trends near Yukon communities
            </div>


            <div class="visual-subtitle">
                ${
                    escapeHtml(period)
                }
                ·
                ${
                    escapeHtml(
                        annualIndicator.unit
                    )
                }
            </div>


            <div class="heatmap-explanation">

                Numbers show change per decade near each
                community.

                ${
                    columns.length > 1
                        ? (
                            "Annual, winter, spring, summer and fall " +
                            "trends are shown on the same scale. "
                        )
                        : ""
                }

                Values in parentheses are not statistically
                significant after accounting for multiple comparisons
                across communities.

            </div>


            <div
                class="seasonal-community-heatmap"
                style="
                    display: grid;
                    grid-template-columns:
                        ${gridTemplate};
                    width: 100%;
                    max-width:
                        ${
                            columns.length > 1
                                ? "1000px"
                                : "620px"
                        };
                "
            >

                ${header}
                ${rows}

            </div>


            <div class="trend-heatmap-legend">

                <span>
                    Stronger decrease
                </span>

                <div
                    class="trend-heatmap-legend-bar"
                    style="
                        background:
                            linear-gradient(
                                to right,
                                rgb(49,111,156),
                                rgb(247,247,247),
                                rgb(181,76,55)
                            );
                    "
                ></div>

                <span>
                    Stronger increase
                </span>

            </div>

        </div>
    `;
}


function renderTemperatureCommunityTimeseries(
    container
) {

    const indicator =
        temperaturePackage
            .communities
            .indicators[
                selectedIndicator.id
            ];

    if (!indicator) {

        container.innerHTML = `
            <div class="empty-state">
                Community data are not available for this indicator.
            </div>
        `;

        return;
    }

    const communityOrder =
        temperaturePackage
            .communities
            .community_order
            .filter(
                community =>
                    indicator
                    .communities[
                        community
                    ]
            )
            .slice()
            .sort(
                (a, b) =>
                    a.localeCompare(
                        b,
                        undefined,
                        { sensitivity: "base" }
                    )
            );

    if (
        !communityOrder.includes(
            selectedCommunity
        )
    ) {
        selectedCommunity =
            communityOrder.includes(
                "Whitehorse"
            )
                ? "Whitehorse"
                : communityOrder[0];
    }

    container.innerHTML = `

        <div class="community-toolbar">

            <label for="community-select">
                Community
            </label>

            <select id="community-select">

                ${
                    communityOrder
                    .map(
                        community => `
                            <option
                                value="${escapeHtml(
                                    community
                                )}"
                                ${
                                    community
                                    === selectedCommunity
                                        ? "selected"
                                        : ""
                                }
                            >
                                ${escapeHtml(
                                    community
                                )}
                            </option>
                        `
                    )
                    .join("")
                }

            </select>

        </div>

        <div id="community-series-stage"></div>
    `;

    const select =
        document.getElementById(
            "community-select"
        );

    select.addEventListener(
        "change",
        () => {

            selectedCommunity =
                select.value;

            drawTemperatureCommunitySeries();
        }
    );

    drawTemperatureCommunitySeries();
}


function drawTemperatureCommunitySeries() {

    const indicator =
        temperaturePackage
            .communities
            .indicators[
                selectedIndicator.id
            ];

    const series =
        indicator
            .communities[
                selectedCommunity
            ];

    const years =
        temperaturePackage
            .communities
            .years;

    const useAnomaly =
        indicator
        .time_series_mode
        === "anomaly";

    const values =
        useAnomaly
            ? series.anomalies
            : series.values;

    const records =
        years.map(
            (
                year,
                index
            ) => ({
                year,
                value:
                    values[
                        index
                    ]
            })
        );

    const stage =
        document.getElementById(
            "community-series-stage"
        );

    stage.innerHTML = `

        <div class="visual-layout">

            <div class="visual-panel">

                <div class="visual-title">
                    ${
                        selectedCommunity
                    } · ${
                        indicator.label
                    }
                </div>

                <div class="visual-subtitle">
                    ${
                        useAnomaly
                            ? (
                                `Anomaly relative to ` +
                                `${temperaturePackage.communities.baseline}`
                            )
                            : "Annual value"
                    }
                </div>

                ${
                    buildLineChartSvg(
                        records,
                        {
                            unit:
                                indicator.unit,
                            decimals:
                                temperatureDecimals(
                                    indicator.unit
                                ),
                            slopePerDecade:
                                series
                                .trend
                                .slope_per_decade,

                            zeroLine:
                                useAnomaly,

                            ariaLabel:
                                `${selectedCommunity} ${indicator.label} time series, ${temperaturePackage.communities.period}`
                        }
                    )
                }

            </div>

            ${
                renderTrendMetrics(
                    series.trend,
                    indicator.trend_unit,
                    temperaturePackage
                        .communities
                        .period,
                    selectedCommunity
                )
            }

        </div>
    `;
}


// ============================================================
// 20. Shared SVG line chart
// ============================================================

function buildLineChartSvg(
    records,
    options = {}
) {

    const cleanRecords =
        records.filter(
            record =>
                Number.isFinite(
                    Number(
                        record.year
                    )
                )
                &&
                Number.isFinite(
                    Number(
                        record.value
                    )
                )
        );

    if (!cleanRecords.length) {

        return `
            <div class="empty-state">
                No data available.
            </div>
        `;
    }

    const width =
        options.width || 900;

    const height =
        options.height || 390;

    const margin = {
        top: 25,
        right: 25,
        bottom: 48,
        left: 70
    };

    const years =
        cleanRecords.map(
            record =>
                Number(
                    record.year
                )
        );

    const values =
        cleanRecords.map(
            record =>
                Number(
                    record.value
                )
        );

    const xMin =
        Math.min(
            ...years
        );

    const xMax =
        Math.max(
            ...years
        );

    let yMin =
        Math.min(
            ...values
        );

    let yMax =
        Math.max(
            ...values
        );


    // --------------------------------------------------------
    // Anomaly charts must always include zero.
    //
    // Zero represents the baseline/reference climate and is
    // therefore scientifically meaningful, not just a visual
    // grid line.
    // --------------------------------------------------------

    if (
        options.zeroLine
    ) {

        yMin =
            Math.min(
                yMin,
                0
            );

        yMax =
            Math.max(
                yMax,
                0
            );
    }


    const rawRange = Math.max(yMax - yMin, 1e-9);
    const roughStep = rawRange / 6;
    const magnitude = Math.pow(
        10,
        Math.floor(Math.log10(roughStep))
    );

    const normalized = roughStep / magnitude;

    const multiplier =
        normalized <= 1 ? 1 :
        normalized <= 2 ? 2 :
        normalized <= 2.5 ? 2.5 :
        normalized <= 5 ? 5 : 10;

    const yTickStep = multiplier * magnitude;

    yMin = Math.floor(yMin / yTickStep) * yTickStep;
    yMax = Math.ceil(yMax / yTickStep) * yTickStep;

    const xScale =
        year =>
            margin.left
            +
            (
                (year - xMin)
                /
                (
                    xMax - xMin
                    || 1
                )
            )
            *
            (
                width
                - margin.left
                - margin.right
            );

    const yScale =
        value =>
            height
            - margin.bottom
            -
            (
                (value - yMin)
                /
                (
                    yMax - yMin
                    || 1
                )
            )
            *
            (
                height
                - margin.top
                - margin.bottom
            );

    const line =
        cleanRecords
            .map(
                record =>
                    `${
                        xScale(
                            Number(
                                record.year
                            )
                        )
                    },${
                        yScale(
                            Number(
                                record.value
                            )
                        )
                    }`
            )
            .join(" ");

    const xTicks = [];

    for (
        let year =
            Math.ceil(
                xMin / 5
            ) * 5;
        year <= xMax;
        year += 5
    ) {
        xTicks.push(
            year
        );
    }

    // Snap the plotting limits to exact multiples of the
    // chosen tick step. This gives clean labels such as
    // -2, -1, 0, 1, 2 rather than -2.3, -0.8, 0.7, etc.
    yMin =
        Math.floor(
            yMin / yTickStep
        ) * yTickStep;

    yMax =
        Math.ceil(
            yMax / yTickStep
        ) * yTickStep;

    const yTicks = [];

    for (
        let value = yMin;
        value <= yMax + yTickStep * 0.001;
        value += yTickStep
    ) {
        yTicks.push(
            Math.abs(value) < yTickStep * 1e-9
                ? 0
                : value
        );
    }

    let zeroReferenceLine = "";


    if (
        options.zeroLine
        &&
        yMin <= 0
        &&
        yMax >= 0
    ) {

        zeroReferenceLine = `

            <line
                x1="${margin.left}"
                y1="${yScale(0)}"
                x2="${width - margin.right}"
                y2="${yScale(0)}"
                class="dashboard-zero-line"
            />

        `;
    }


    let trendLine = "";

    const slopePerDecade =
        Number(
            options.slopePerDecade
        );

    if (
        Number.isFinite(
            slopePerDecade
        )
    ) {

        const slopePerYear =
            slopePerDecade / 10;

        const meanYear =
            years.reduce(
                (
                    sum,
                    value
                ) =>
                    sum + value,
                0
            )
            /
            years.length;

        const meanValue =
            values.reduce(
                (
                    sum,
                    value
                ) =>
                    sum + value,
                0
            )
            /
            values.length;

        const trendStart =
            meanValue
            +
            slopePerYear
            *
            (
                xMin
                - meanYear
            );

        const trendEnd =
            meanValue
            +
            slopePerYear
            *
            (
                xMax
                - meanYear
            );

        trendLine = `
            <line
                x1="${xScale(xMin)}"
                y1="${yScale(trendStart)}"
                x2="${xScale(xMax)}"
                y2="${yScale(trendEnd)}"
                class="dashboard-trend-line"
            />
        `;
    }

    return `

        <svg
            class="dashboard-timeseries"
            viewBox="0 0 ${width} ${height}"
            preserveAspectRatio="xMidYMid meet"
            role="img"
            aria-label="${escapeHtml(options.ariaLabel || "Climate time-series chart")}"
        >

            ${
                yTicks
                .map(
                    value => `
                        <line
                            x1="${margin.left}"
                            y1="${yScale(value)}"
                            x2="${width - margin.right}"
                            y2="${yScale(value)}"
                            class="dashboard-grid-line"
                        />

                        <text
                            x="${margin.left - 10}"
                            y="${yScale(value) + 4}"
                            text-anchor="end"
                            class="dashboard-axis-label"
                        >
                            ${
                                Number(
                                    value
                                )
                                .toFixed(
                                    temperatureDecimals(
                                        options.unit
                                    )
                                )
                            }
                        </text>
                    `
                )
                .join("")
            }

            ${
                xTicks
                .map(
                    year => `
                        <line
                            x1="${xScale(year)}"
                            y1="${margin.top}"
                            x2="${xScale(year)}"
                            y2="${height - margin.bottom}"
                            class="dashboard-grid-line dashboard-grid-line-vertical"
                        />

                        <text
                            x="${xScale(year)}"
                            y="${height - margin.bottom + 24}"
                            text-anchor="middle"
                            class="dashboard-axis-label"
                        >
                            ${year}
                        </text>
                    `
                )
                .join("")
            }

            ${zeroReferenceLine}

            <polyline
                points="${line}"
                class="dashboard-data-line"
            />

            ${trendLine}

            ${
                cleanRecords
                .map(
                    record => `
                        <circle
                            cx="${
                                xScale(
                                    Number(
                                        record.year
                                    )
                                )
                            }"
                            cy="${
                                yScale(
                                    Number(
                                        record.value
                                    )
                                )
                            }"
                            r="7"
                            class="dashboard-hover-point"
                        >
                            <title>
                                ${
                                    record.year
                                }: ${
                                    Number(
                                        record.value
                                    )
                                    .toFixed(
                                        temperatureDecimals(
                                            options.unit
                                        )
                                    )
                                } ${
                                    options.unit || ""
                                }
                            </title>
                        </circle>
                    `
                )
                .join("")
            }

        </svg>
    `;
}


// ============================================================
// 21. Trend metric cards
// ============================================================

function formatPValue(pValue) {
    const value = Number(pValue);
    if (!Number.isFinite(value)) {
        return "Not available";
    }
    if (value < 0.001) {
        return "p < 0.001";
    }
    return `p = ${value.toFixed(3)}`;
}


function renderTrendMetrics(
    trend,
    trendUnit,
    period,
    community = null
) {

    const slope =
        trend
        &&
        Number.isFinite(
            Number(
                trend.slope_per_decade
            )
        )
            ? (
                `${
                    formatSigned(
                        trend.slope_per_decade,
                        (
                            trendUnit.includes("C")
                            ||
                            trendUnit.includes("°C")
                        )
                            ? 2
                            : 1
                    )
                } ${trendUnit}`
            )
            : "Not available";


    const pValue =
        trend
            ? formatPValue(
                trend.p_value
            )
            : "Not available";


    const significant =
        trend
        &&
        (
            trend.significant_p05
            ??
            trend.significant
        );


    return `

        <div class="metric-column">

            ${
                community
                    ? `
                        <div class="metric">

                            <div class="metric-label">
                                Community
                            </div>

                            <div class="metric-value">
                                ${escapeHtml(community)}
                            </div>

                        </div>
                    `
                    : ""
            }


            <div class="metric">

                <div class="metric-label">
                    Long-term trend
                </div>

                <div class="metric-value">
                    ${slope}
                </div>

            </div>


            <div class="metric">

                <div class="metric-label">
                    p-value
                </div>

                <div class="metric-value">
                    ${pValue}
                </div>

                ${
                    significant !== null
                    &&
                    significant !== undefined
                        ? `
                            <div class="metric-note">
                                ${
                                    significant
                                        ? "Statistically significant"
                                        : "Not statistically significant"
                                }
                            </div>
                        `
                        : ""
                }

            </div>


            <div class="metric">

                <div class="metric-label">
                    Period
                </div>

                <div class="metric-value">
                    ${period}
                </div>

            </div>

        </div>
    `;
}


// ============================================================
// 22. About Temperature
// ============================================================

function renderAbout(container) {
    if (
        isTemperatureIndicator(selectedIndicator)
        || isPrecipitationIndicator(selectedIndicator)
    ) {
        const isTemperature = isTemperatureIndicator(selectedIndicator);
        const metadata = isTemperature
            ? temperaturePackage.metadata
            : precipitationPackage.metadata;
        const indicator = metadata.indicators[selectedIndicator.id];
        const baselineRelevant = ["anomaly", "anomaly_percent"].includes(
            indicator.time_series_mode
        );
        const communityText = isTemperature
            ? metadata.community_summary
            : metadata.community_method;
        const extraNote = !isTemperature
            ? metadata.precipitation_note
            : "";

        container.innerHTML = `
            <div class="about-panel">
                <h3>About this indicator</h3>
                <div class="about-row"><div class="about-label">Definition</div><div>${escapeHtml(indicator.definition || indicator.description || "")}</div></div>
                ${indicator.review_note ? `<div class="about-row"><div class="about-label">Status</div><div>${escapeHtml(indicator.review_note)}</div></div>` : ""}
                <div class="about-row"><div class="about-label">Period</div><div>${escapeHtml(metadata.period)}</div></div>
                ${baselineRelevant ? `<div class="about-row"><div class="about-label">Baseline</div><div>${escapeHtml(metadata.baseline)}</div></div>` : ""}
                <div class="about-row"><div class="about-label">Data source</div><div>${escapeHtml(metadata.source || "ERA5-Land daily reanalysis")}</div></div>
                <div class="about-row"><div class="about-label">Yukon value</div><div>${escapeHtml(metadata.yukon_value_note || metadata.yukon_summary || metadata.territorial_method || "")}</div></div>
                <div class="about-row"><div class="about-label">Boundary</div><div>${escapeHtml(metadata.boundary_summary || "")}</div></div>
                <div class="about-row"><div class="about-label">Trend and significance</div><div>${escapeHtml(metadata.trend_method || "")}</div></div>
                <div class="about-row"><div class="about-label">Map significance</div><div>${escapeHtml(metadata.map_note || "")}</div></div>
                <div class="about-row"><div class="about-label">Community analysis</div><div>${escapeHtml(communityText || "")}</div></div>
                ${extraNote ? `<div class="heatmap-explanation" style="margin-top: 22px;">${escapeHtml(extraNote)}</div>` : ""}
            </div>
        `;
        return;
    }

    const source = selectedIndicator.source || "Dataset not yet assigned.";
    container.innerHTML = `<div class="about-panel"><h3>About this indicator</h3><div class="about-row"><div class="about-label">Data source</div><div>${escapeHtml(source)}</div></div></div>`;
}



// ============================================================
// Precipitation view router
// ============================================================

function renderPrecipitationView(
    stage
) {

    // --------------------------------------------------------
    // About
    // --------------------------------------------------------

    if (
        selectedView
        === "about"
    ) {

        selectedVisualization =
            null;

        renderAbout(stage);

        return;
    }


    // --------------------------------------------------------
    // Metadata for the selected precipitation indicator
    // --------------------------------------------------------

    const metadata =
        precipitationPackage
            .metadata
            .indicators[
                selectedIndicator.id
            ];


    if (!metadata) {

        renderPlaceholder(
            stage
        );

        return;
    }


    // --------------------------------------------------------
    // Available visualizations for current main view
    // --------------------------------------------------------

    let visualizations = [];


    if (
        selectedView
        === "yukon"
    ) {

        visualizations =
            metadata
                .views
                .yukon
            || [];
    }


    if (
        selectedView
        === "seasonal"
    ) {

        visualizations =
            metadata
                .views
                .seasonal
            || [];
    }


    if (
        selectedView
        === "communities"
    ) {

        visualizations =
            metadata
                .views
                .communities
            || [];
    }


    if (!visualizations.length) {

        stage.innerHTML = `
            <div class="visual-panel">

                <div class="empty-state">
                    This view is not available
                    for this indicator.
                </div>

            </div>
        `;

        return;
    }


    // --------------------------------------------------------
    // Keep selectedVisualization valid
    // --------------------------------------------------------

    if (
        !selectedVisualization
        ||
        !visualizations.includes(
            selectedVisualization
        )
    ) {

        selectedVisualization =
            visualizations[0];
    }


    // --------------------------------------------------------
    // Yukon
    // --------------------------------------------------------

    if (
        selectedView
        === "yukon"
    ) {

        if (
            selectedVisualization
            === "map"
        ) {

            renderPrecipitationYukonMap(
                stage
            );

            return;
        }


        if (
            selectedVisualization
            === "timeseries"
        ) {

            renderPrecipitationYukonTimeseries(
                stage
            );

            return;
        }
    }


    // --------------------------------------------------------
    // Seasons
    // --------------------------------------------------------

    if (
        selectedView
        === "seasonal"
    ) {

        if (
            selectedVisualization
            === "map"
        ) {

            renderPrecipitationSeasonalMap(
                stage
            );

            return;
        }


        if (
            selectedVisualization
            === "timeseries"
        ) {

            renderPrecipitationSeasonalTimeseries(
                stage
            );

            return;
        }
    }


    // --------------------------------------------------------
    // Communities
    // --------------------------------------------------------

    if (
        selectedView
        === "communities"
    ) {

        if (
            selectedVisualization
            === "heatmap"
        ) {

            renderPrecipitationCommunityHeatmap(
                stage
            );

            return;
        }


        if (
            selectedVisualization
            === "timeseries"
        ) {

            renderPrecipitationCommunityTimeseries(
                stage
            );

            return;
        }
    }


    // --------------------------------------------------------
    // Safety fallback
    // --------------------------------------------------------

    stage.innerHTML = `
        <div class="visual-panel">

            <div class="empty-state">
                This visualization is not available
                for this indicator.
            </div>

        </div>
    `;
}


// ============================================================
// Yukon annual map
// ============================================================

function renderPrecipitationYukonMap(
    container
) {

    const metadata =
        precipitationPackage
            .metadata
            .indicators[
                selectedIndicator.id
            ];


    const series =
        precipitationPackage
            .yukon
            .indicators[
                selectedIndicator.id
            ];


    if (
        !metadata
        ||
        !series
    ) {

        container.innerHTML = `
            <div class="visual-panel">
                <div class="empty-state">
                    Yukon-wide data are not available
                    for this indicator.
                </div>
            </div>
        `;

        return;
    }


    const imagePath =
        (
            metadata.files
            &&
            metadata.files.annual_map
        )
            ? metadata.files.annual_map
            : (
                `figures/precipitation/annual/`
                + `${selectedIndicator.id}.png`
            );


    container.innerHTML = `

        <div class="visual-layout">

            <div class="visual-panel">

                <div class="visual-title">
                    ${
                        escapeHtml(
                            metadata.label
                        )
                    } trend across Yukon
                </div>

                <div class="visual-subtitle">
                    ${
                        escapeHtml(
                            precipitationPackage
                                .metadata
                                .period
                            || "1951–2025"
                        )
                    }
                </div>

                <img
                    class="dashboard-climate-map"
                    src="${
                        escapeHtml(
                            imagePath
                        )
                    }"
                    alt="${
                        escapeHtml(
                            metadata.label
                        )
                    } trend map across Yukon"
                >

            </div>

            ${
                renderTrendMetrics(
                    series.trend,
                    metadata.trend_unit,
                    precipitationPackage
                        .metadata
                        .period
                    || "1951–2025"
                )
            }

        </div>
    `;
}


// ============================================================
// Yukon annual time series
// ============================================================


// ============================================================
// Precipitation SVG time-series helper
// ============================================================

function renderPrecipitationLineChart(
    container,
    options
) {

    const years =
        options.years
        || [];

    const values =
        options.values
        || [];


    const points = [];


    for (
        let index = 0;
        index < years.length;
        index += 1
    ) {

        const year =
            Number(
                years[index]
            );

        const value =
            Number(
                values[index]
            );


        if (
            Number.isFinite(year)
            &&
            Number.isFinite(value)
        ) {

            points.push({
                year,
                value
            });
        }
    }


    if (
        points.length < 2
    ) {

        container.innerHTML = `
            <div class="visual-panel">
                <div class="empty-state">
                    Time-series data are not available.
                </div>
            </div>
        `;

        return;
    }


    const width = 920;
    const height = 460;

    const margin = {
        top: 30,
        right: 28,
        bottom: 58,
        left: 78
    };


    const plotWidth =
        width
        - margin.left
        - margin.right;

    const plotHeight =
        height
        - margin.top
        - margin.bottom;


    const xMinimum =
        Math.min(
            ...points.map(
                point =>
                    point.year
            )
        );

    const xMaximum =
        Math.max(
            ...points.map(
                point =>
                    point.year
            )
        );


    let yMinimum =
        Math.min(
            ...points.map(
                point =>
                    point.value
            )
        );

    let yMaximum =
        Math.max(
            ...points.map(
                point =>
                    point.value
            )
        );


    if (
        options.zeroLine
    ) {

        yMinimum =
            Math.min(
                yMinimum,
                0
            );

        yMaximum =
            Math.max(
                yMaximum,
                0
            );
    }


    let yRange =
        yMaximum
        - yMinimum;


    if (
        !Number.isFinite(
            yRange
        )
        ||
        yRange === 0
    ) {

        yRange = 1;
    }


    const yPadding =
        yRange
        * 0.08;


    yMinimum -=
        yPadding;

    yMaximum +=
        yPadding;


    const xScale =
        year =>
            margin.left
            + (
                (
                    year
                    - xMinimum
                )
                /
                (
                    xMaximum
                    - xMinimum
                )
            )
            * plotWidth;


    const yScale =
        value =>
            margin.top
            + (
                1
                -
                (
                    (
                        value
                        - yMinimum
                    )
                    /
                    (
                        yMaximum
                        - yMinimum
                    )
                )
            )
            * plotHeight;


    const linePath =
        points
        .map(
            (point, index) =>
                `${
                    index === 0
                        ? "M"
                        : "L"
                } ${
                    xScale(
                        point.year
                    )
                } ${
                    yScale(
                        point.value
                    )
                }`
        )
        .join(" ");


    // --------------------------------------------------------
    // Linear trend line using the supplied trend slope.
    //
    // We anchor it on the series mean so it visually matches
    // the reported slope without recalculating inferential
    // statistics in the browser.
    // --------------------------------------------------------

    let trendPath = "";


    if (
        options.trend
        &&
        Number.isFinite(
            Number(
                options
                    .trend
                    .slope_per_decade
            )
        )
    ) {

        const slopePerYear =
            Number(
                options
                    .trend
                    .slope_per_decade
            )
            / 10.0;


        const meanYear =
            points.reduce(
                (
                    total,
                    point,
                ) =>
                    total
                    + point.year,
                0
            )
            / points.length;


        const meanValue =
            points.reduce(
                (
                    total,
                    point,
                ) =>
                    total
                    + point.value,
                0
            )
            / points.length;


        const trendStart =
            meanValue
            + slopePerYear
            * (
                xMinimum
                - meanYear
            );


        const trendEnd =
            meanValue
            + slopePerYear
            * (
                xMaximum
                - meanYear
            );


        trendPath = `
            <line
                x1="${
                    xScale(
                        xMinimum
                    )
                }"
                y1="${
                    yScale(
                        trendStart
                    )
                }"
                x2="${
                    xScale(
                        xMaximum
                    )
                }"
                y2="${
                    yScale(
                        trendEnd
                    )
                }"
                stroke="currentColor"
                stroke-width="2.2"
                stroke-dasharray="7 6"
                opacity="0.75"
            />
        `;
    }


    // --------------------------------------------------------
    // Y ticks
    // --------------------------------------------------------

    const yTickCount = 5;

    const yTicks =
        Array.from(
            {
                length:
                    yTickCount + 1
            },
            (
                _,
                index,
            ) =>
                yMinimum
                + (
                    (
                        yMaximum
                        - yMinimum
                    )
                    * index
                    / yTickCount
                )
        );


    // --------------------------------------------------------
    // X ticks every 10 years where possible
    // --------------------------------------------------------

    const firstTick =
        Math.ceil(
            xMinimum / 10
        )
        * 10;


    const xTicks = [];


    for (
        let year = firstTick;
        year <= xMaximum;
        year += 10
    ) {

        xTicks.push(
            year
        );
    }


    const zeroLine =
        (
            options.zeroLine
            &&
            yMinimum < 0
            &&
            yMaximum > 0
        )
            ? `
                <line
                    x1="${margin.left}"
                    y1="${yScale(0)}"
                    x2="${
                        margin.left
                        + plotWidth
                    }"
                    y2="${yScale(0)}"
                    stroke="#5f6661"
                    stroke-width="1.4"
                />
            `
            : "";


    const svg = `

        <svg
            viewBox="0 0 ${width} ${height}"
            style="
                width: 100%;
                height: auto;
                display: block;
            "
            role="img"
            aria-label="${
                escapeHtml(
                    options.title
                    || "Precipitation time series"
                )
            }"
        >

            ${
                yTicks
                .map(
                    value => {

                        const y =
                            yScale(
                                value
                            );

                        return `
                            <line
                                x1="${margin.left}"
                                y1="${y}"
                                x2="${
                                    margin.left
                                    + plotWidth
                                }"
                                y2="${y}"
                                stroke="#ddddda"
                                stroke-width="1"
                            />

                            <text
                                x="${
                                    margin.left
                                    - 12
                                }"
                                y="${
                                    y + 4
                                }"
                                text-anchor="end"
                                font-size="13"
                                fill="#555"
                            >
                                ${
                                    Number(
                                        value
                                    )
                                    .toFixed(
                                        Math.abs(
                                            value
                                        ) < 10
                                            ? 1
                                            : 0
                                    )
                                }
                            </text>
                        `;
                    }
                )
                .join("")
            }


            ${
                xTicks
                .map(
                    year => `
                        <line
                            x1="${xScale(year)}"
                            y1="${margin.top}"
                            x2="${xScale(year)}"
                            y2="${
                                margin.top
                                + plotHeight
                            }"
                            stroke="#eeeeeb"
                            stroke-width="1"
                        />

                        <text
                            x="${xScale(year)}"
                            y="${
                                margin.top
                                + plotHeight
                                + 28
                            }"
                            text-anchor="middle"
                            font-size="13"
                            fill="#555"
                        >
                            ${year}
                        </text>
                    `
                )
                .join("")
            }


            ${zeroLine}


            <path
                d="${linePath}"
                fill="none"
                stroke="#176b5b"
                stroke-width="2.6"
                stroke-linejoin="round"
                stroke-linecap="round"
            />


            ${trendPath}


            <text
                x="${
                    margin.left
                    + plotWidth / 2
                }"
                y="${
                    height - 10
                }"
                text-anchor="middle"
                font-size="14"
                fill="#444"
            >
                Year
            </text>


            <text
                transform="
                    translate(
                        18,
                        ${
                            margin.top
                            + plotHeight / 2
                        }
                    )
                    rotate(-90)
                "
                text-anchor="middle"
                font-size="14"
                fill="#444"
            >
                ${
                    escapeHtml(
                        options.yLabel
                        || ""
                    )
                }
            </text>

        </svg>
    `;


    container.innerHTML = `

        <div class="visual-panel">

            <div class="visual-title">
                ${
                    escapeHtml(
                        options.title
                    )
                }
            </div>


            ${
                options.subtitle
                    ? `
                        <div class="visual-subtitle">
                            ${
                                escapeHtml(
                                    options.subtitle
                                )
                            }
                        </div>
                    `
                    : ""
            }


            <div
                style="
                    display: grid;
                    grid-template-columns:
                        minmax(0, 1fr)
                        minmax(190px, 230px);
                    gap: 22px;
                    align-items: start;
                    margin-top: 14px;
                "
            >

                <div>
                    ${svg}
                </div>


                ${
                    renderTrendMetrics(
                        options.trend,
                        options.trendUnit,
                        options.period,
                        options.community
                        || null
                    )
                }

            </div>

        </div>
    `;
}


function renderPrecipitationYukonTimeseries(
    container
) {

    const indicator =
        precipitationPackage
            .yukon
            .indicators[
                selectedIndicator.id
            ];


    if (!indicator) {

        container.innerHTML = `
            <div class="visual-panel">
                <div class="empty-state">
                    Yukon-wide time-series data are
                    not available for this indicator.
                </div>
            </div>
        `;

        return;
    }


    const usePercent =
        indicator
            .time_series_mode
        === "anomaly_percent";


    const values =
        usePercent
            ? indicator.anomalies
            : indicator.values;


    renderPrecipitationLineChart(
        container,
        {
            title:
                usePercent
                    ? (
                        `${indicator.label} anomaly across Yukon`
                    )
                    : (
                        `${indicator.label} across Yukon`
                    ),

            subtitle:
                usePercent
                    ? (
                        "Annual difference from the " +
                        "1961–1990 average"
                    )
                    : (
                        "Yukon-wide area-weighted annual value"
                    ),

            years:
                indicator.years,

            values,

            yLabel:
                usePercent
                    ? "%"
                    : indicator.unit,

            trend:
                indicator.trend,

            trendUnit:
                indicator.trend_unit,

            period:
                (
                    precipitationPackage
                        .metadata
                        .period
                    || "1951–2025"
                ),

            zeroLine:
                usePercent
        }
    );
}


// ============================================================
// Seasonal maps
// ============================================================

function renderPrecipitationSeasonalMap(container) {
    const metadata = precipitationPackage.metadata.indicators[selectedIndicator.id];
    const imagePath = metadata && metadata.files ? metadata.files.seasonal_map : null;
    if (!imagePath) {
        container.innerHTML = `<div class="visual-panel"><div class="empty-state">Seasonal maps are not available for this indicator.</div></div>`;
        return;
    }
    container.innerHTML = `
        <div class="visual-panel">
            <img
                class="dashboard-climate-map dashboard-seasonal-map"
                src="${imagePath}"
                alt="${escapeHtml(metadata.label)} seasonal trends across Yukon"
            >
        </div>
    `;
}


// ============================================================
// Seasonal time series
// ============================================================

function buildPrecipitationSeasonalChartSvg(
    records,
    options
) {

    const width = 760;
    const height = 300;

    const margin = {
        top: 18,
        right: 20,
        bottom: 42,
        left: 62
    };


    const cleanRecords =
        records.filter(
            record =>
                Number.isFinite(
                    Number(
                        record.year
                    )
                )
                &&
                Number.isFinite(
                    Number(
                        record.value
                    )
                )
        );


    if (
        cleanRecords.length < 2
    ) {

        return `
            <div class="seasonal-precip-empty">
                Time-series data are not available.
            </div>
        `;
    }


    const years =
        cleanRecords.map(
            record =>
                Number(
                    record.year
                )
        );


    const xMinimum =
        Math.min(
            ...years
        );


    const xMaximum =
        Math.max(
            ...years
        );


    const yMinimum =
        options.yMinimum;


    const yMaximum =
        options.yMaximum;


    const plotWidth =
        width
        - margin.left
        - margin.right;


    const plotHeight =
        height
        - margin.top
        - margin.bottom;


    const xScale =
        year =>
            margin.left
            +
            (
                (
                    year
                    - xMinimum
                )
                /
                (
                    xMaximum
                    - xMinimum
                    || 1
                )
            )
            * plotWidth;


    const yScale =
        value =>
            margin.top
            +
            (
                1
                -
                (
                    (
                        value
                        - yMinimum
                    )
                    /
                    (
                        yMaximum
                        - yMinimum
                        || 1
                    )
                )
            )
            * plotHeight;


    const linePath =
        cleanRecords
        .map(
            (
                record,
                index
            ) =>
                `${
                    index === 0
                        ? "M"
                        : "L"
                } ${
                    xScale(
                        Number(
                            record.year
                        )
                    )
                } ${
                    yScale(
                        Number(
                            record.value
                        )
                    )
                }`
        )
        .join(" ");


    const xTicks = [];


    for (
        let year =
            Math.ceil(
                xMinimum / 10
            ) * 10;

        year <= xMaximum;

        year += 10
    ) {

        xTicks.push(
            year
        );
    }


    // --------------------------------------------------------
    // Trend line
    // --------------------------------------------------------

    let trendLine = "";


    const slopePerDecade =
        Number(
            options
                .trend
                ?.slope_per_decade
        );


    if (
        Number.isFinite(
            slopePerDecade
        )
    ) {

        const slopePerYear =
            slopePerDecade
            / 10;


        const meanYear =
            cleanRecords.reduce(
                (
                    total,
                    record
                ) =>
                    total
                    + Number(
                        record.year
                    ),
                0
            )
            /
            cleanRecords.length;


        const meanValue =
            cleanRecords.reduce(
                (
                    total,
                    record
                ) =>
                    total
                    + Number(
                        record.value
                    ),
                0
            )
            /
            cleanRecords.length;


        const trendStart =
            meanValue
            +
            slopePerYear
            * (
                xMinimum
                - meanYear
            );


        const trendEnd =
            meanValue
            +
            slopePerYear
            * (
                xMaximum
                - meanYear
            );


        trendLine = `
            <line
                x1="${xScale(xMinimum)}"
                y1="${yScale(trendStart)}"
                x2="${xScale(xMaximum)}"
                y2="${yScale(trendEnd)}"
                class="seasonal-precip-trend-line"
            />
        `;
    }


    return `

        <svg
            class="seasonal-precip-chart"
            viewBox="0 0 ${width} ${height}"
            preserveAspectRatio="xMidYMid meet"
            role="img"
        >

            ${
                options.yTicks
                .map(
                    tick => `

                        <line
                            x1="${margin.left}"
                            y1="${yScale(tick)}"
                            x2="${
                                margin.left
                                + plotWidth
                            }"
                            y2="${yScale(tick)}"
                            class="${
                                tick === 0
                                    ? (
                                        "seasonal-precip-zero-line"
                                    )
                                    : (
                                        "seasonal-precip-grid-line"
                                    )
                            }"
                        />

                        <text
                            x="${
                                margin.left
                                - 10
                            }"
                            y="${
                                yScale(tick)
                                + 4
                            }"
                            text-anchor="end"
                            class="seasonal-precip-axis-label"
                        >
                            ${
                                options.formatTick(
                                    tick
                                )
                            }
                        </text>
                    `
                )
                .join("")
            }


            ${
                xTicks
                .map(
                    year => `

                        <line
                            x1="${xScale(year)}"
                            y1="${margin.top}"
                            x2="${xScale(year)}"
                            y2="${
                                margin.top
                                + plotHeight
                            }"
                            class="
                                seasonal-precip-grid-line
                                seasonal-precip-grid-line-vertical
                            "
                        />

                        <text
                            x="${xScale(year)}"
                            y="${
                                margin.top
                                + plotHeight
                                + 25
                            }"
                            text-anchor="middle"
                            class="seasonal-precip-axis-label"
                        >
                            ${year}
                        </text>
                    `
                )
                .join("")
            }


            <path
                d="${linePath}"
                class="seasonal-precip-data-line"
            />


            ${trendLine}


            ${
                cleanRecords
                .map(
                    record => `

                        <circle
                            cx="${
                                xScale(
                                    Number(
                                        record.year
                                    )
                                )
                            }"
                            cy="${
                                yScale(
                                    Number(
                                        record.value
                                    )
                                )
                            }"
                            r="7"
                            class="seasonal-precip-hover-point"
                        >
                            <title>
                                ${
                                    record.year
                                }: ${
                                    Number(
                                        record.value
                                    ).toFixed(1)
                                } ${
                                    options.unit
                                }
                            </title>
                        </circle>
                    `
                )
                .join("")
            }

        </svg>
    `;
}


function renderPrecipitationSeasonalTimeseries(
    container
) {

    const indicator =
        precipitationPackage
            .seasonal
            .indicators[
                selectedIndicator.id
            ];


    if (!indicator) {

        container.innerHTML = `
            <div class="visual-panel">

                <div class="empty-state">
                    Seasonal time-series data are not
                    available for this indicator.
                </div>

            </div>
        `;

        return;
    }


    const seasonOrder =
        precipitationPackage
            .seasonal
            .season_order
        || [
            "DJF",
            "MAM",
            "JJA",
            "SON"
        ];


    const seasons =
        seasonOrder
        .map(
            seasonCode => {

                const season =
                    indicator
                        .seasons[
                            seasonCode
                        ];


                if (!season) {
                    return null;
                }


                const sourceValues =
                    (
                        season.anomalies
                        &&
                        season.anomalies.length
                    )
                        ? season.anomalies
                        : (
                            season.values
                            || []
                        );


                const records =
                    (
                        season.years
                        || []
                    )
                    .map(
                        (
                            year,
                            index
                        ) => ({
                            year,
                            value:
                                sourceValues[
                                    index
                                ]
                        })
                    );


                return {
                    code:
                        seasonCode,

                    name:
                        season.name
                        || seasonCode,

                    season,

                    records
                };
            }
        )
        .filter(Boolean);


    if (!seasons.length) {

        container.innerHTML = `
            <div class="visual-panel">

                <div class="empty-state">
                    Seasonal time-series data are not
                    available for this indicator.
                </div>

            </div>
        `;

        return;
    }


    // ========================================================
    // One common scale across all four seasons
    // ========================================================

    const allValues =
        seasons
        .flatMap(
            item =>
                item.records
                .map(
                    record =>
                        Number(
                            record.value
                        )
                )
        )
        .filter(
            Number.isFinite
        );


    let dataMinimum =
        Math.min(
            ...allValues,
            0
        );


    let dataMaximum =
        Math.max(
            ...allValues,
            0
        );


    let rawRange =
        dataMaximum
        - dataMinimum;


    if (
        !Number.isFinite(
            rawRange
        )
        ||
        rawRange <= 0
    ) {
        rawRange = 1;
    }


    const roughStep =
        rawRange
        / 6;


    const magnitude =
        Math.pow(
            10,
            Math.floor(
                Math.log10(
                    roughStep
                )
            )
        );


    const normalized =
        roughStep
        / magnitude;


    const multiplier =
        normalized <= 1
            ? 1
            : normalized <= 2
                ? 2
                : normalized <= 2.5
                    ? 2.5
                    : normalized <= 5
                        ? 5
                        : 10;


    const tickStep =
        multiplier
        * magnitude;


    const yMinimum =
        Math.floor(
            dataMinimum
            / tickStep
        )
        * tickStep;


    const yMaximum =
        Math.ceil(
            dataMaximum
            / tickStep
        )
        * tickStep;


    const yTicks = [];


    for (
        let value = yMinimum;
        value <= yMaximum + tickStep * 0.001;
        value += tickStep
    ) {

        yTicks.push(
            Math.abs(value)
            < tickStep * 1e-9
                ? 0
                : value
        );
    }


    const formatTick =
        value => {

            if (
                Math.abs(value)
                < tickStep * 1e-9
            ) {
                return "0";
            }


            if (
                Math.abs(tickStep)
                >= 1
            ) {
                return Number(
                    value
                ).toFixed(0);
            }


            return Number(
                value
            )
            .toFixed(1)
            .replace(
                /\.0$/,
                ""
            );
        };


    const period =
        precipitationPackage
            .metadata
            .period
        || precipitationPackage
            .seasonal
            .period
        || "1951–2025";


    const baseline =
        precipitationPackage
            .seasonal
            .baseline
        || "1961–1990";


    const panels =
        seasons
        .map(
            item => {

                const trend =
                    item
                        .season
                        .trend
                    || {};


                const trendValue =
                    Number(
                        trend
                            .slope_per_decade
                    );


                const trendText =
                    Number.isFinite(
                        trendValue
                    )
                        ? (
                            `${formatSigned(
                                trendValue,
                                1
                            )} ${
                                indicator
                                    .trend_unit
                                || (
                                    indicator.unit
                                    + " per decade"
                                )
                            }`
                        )
                        : "Trend not available";


                const pText =
                    formatPValue(
                        trend.p_value
                    );


                const significant =
                    trend
                        .significant_p05
                    ??
                    trend
                        .significant;


                const significanceText =
                    significant === true
                        ? (
                            "Statistically significant"
                        )
                        : significant === false
                            ? (
                                "Not statistically significant"
                            )
                            : (
                                "Significance not available"
                            );


                return `

                    <section class="seasonal-precip-panel">

                        <h3 class="seasonal-precip-season">
                            ${
                                escapeHtml(
                                    item.name
                                )
                            }
                        </h3>


                        <div class="seasonal-precip-chart-wrap">

                            ${
                                buildPrecipitationSeasonalChartSvg(
                                    item.records,
                                    {
                                        yMinimum,
                                        yMaximum,
                                        yTicks,
                                        formatTick,
                                        unit:
                                            indicator.unit
                                            || "",
                                        trend
                                    }
                                )
                            }

                        </div>


                        <div class="seasonal-precip-summary">

                            <strong>
                                ${trendText}
                            </strong>

                            <span
                                class="
                                    seasonal-precip-stat
                                    ${
                                        significant === true
                                            ? "is-significant"
                                            : significant === false
                                                ? "is-not-significant"
                                                : ""
                                    }
                                "
                            >
                                ${pText}
                                ·
                                ${significanceText}
                            </span>

                        </div>

                    </section>
                `;
            }
        )
        .join("");


    container.innerHTML = `

        <div
            class="
                visual-panel
                seasonal-precip-dashboard
            "
        >

            <div class="visual-title">
                ${
                    escapeHtml(
                        indicator.label
                    )
                } by season
            </div>


            <div class="visual-subtitle">
                Seasonal difference from each season's
                ${escapeHtml(baseline)} average
                · ${escapeHtml(period)}
            </div>


            <div class="seasonal-precip-grid">
                ${panels}
            </div>


            <div class="seasonal-precip-note">
                All four seasons use the same vertical scale.
                The solid line shows the annual seasonal anomaly;
                the dashed line shows the long-term trend.
                Zero represents the ${escapeHtml(baseline)} seasonal average.
            </div>

        </div>
    `;
}


function renderPrecipitationCommunityHeatmap(
    container
) {

    const annualPackage =
        precipitationPackage
            .communityTrends;


    const annualIndicator =
        annualPackage
            .indicators[
                selectedIndicator.id
            ];


    if (!annualIndicator) {

        container.innerHTML = `
            <div class="visual-panel">
                <div class="empty-state">
                    Community trend data are not available
                    for this indicator.
                </div>
            </div>
        `;

        return;
    }


    const communityOrder =
        (annualPackage.community_order || [])
        .slice()
        .sort(
            (a, b) =>
                a.localeCompare(
                    b,
                    undefined,
                    { sensitivity: "base" }
                )
        );


    const seasonalPackage =
        precipitationPackage
            .communitySeasonalTrends;


    const hasSeasonal =
        Boolean(
            seasonalPackage
            &&
            seasonalPackage.indicator
                === selectedIndicator.id
            &&
            seasonalPackage.seasons
        );


    const columns = [];


    if (hasSeasonal) {

        columns.push(
            {
                key: "DJF",
                label: "Winter",
                type: "seasonal"
            },
            {
                key: "MAM",
                label: "Spring",
                type: "seasonal"
            },
            {
                key: "JJA",
                label: "Summer",
                type: "seasonal"
            },
            {
                key: "SON",
                label: "Fall",
                type: "seasonal"
            }
        );
    }


    columns.push(
        {
            key: "annual",
            label: "Annual",
            type: "annual"
        }
    );


    function getCell(
        community,
        column
    ) {

        if (
            column.type
            === "annual"
        ) {

            return (
                annualIndicator
                    .communities[
                        community
                    ]
                || null
            );
        }


        if (!hasSeasonal) {

            return null;
        }


        const season =
            seasonalPackage
                .seasons[
                    column.key
                ];


        if (!season) {

            return null;
        }


        return (
            season
                .communities[
                    community
                ]
            || null
        );
    }


    // --------------------------------------------------------
    // Use one colour range for the selected indicator across
    // every displayed season and Annual.
    // --------------------------------------------------------

    const absoluteSlopes = [];


    communityOrder.forEach(
        community => {

            columns.forEach(
                column => {

                    const cell =
                        getCell(
                            community,
                            column
                        );


                    if (
                        cell
                        &&
                        Number.isFinite(
                            Number(
                                cell
                                    .slope_per_decade
                            )
                        )
                    ) {

                        absoluteSlopes.push(
                            Math.abs(
                                Number(
                                    cell
                                        .slope_per_decade
                                )
                            )
                        );
                    }
                }
            );
        }
    );


    const colourLimit =
        absoluteSlopes.length
            ? Math.max(
                ...absoluteSlopes
            )
            : 1;


    const header =
        `
            <div
                class="seasonal-community-corner"
            >
                Community
            </div>
        `
        +
        columns
        .map(
            column => `
                <div
                    class="seasonal-community-header"
                >
                    ${
                        escapeHtml(
                            column.label
                        )
                    }
                </div>
            `
        )
        .join("");


    const rows =
        communityOrder
        .map(
            community => {

                let html = `

                    <div
                        class="seasonal-community-name"
                    >
                        ${
                            escapeHtml(
                                community
                            )
                        }
                    </div>
                `;


                columns.forEach(
                    column => {

                        const cell =
                            getCell(
                                community,
                                column
                            );


                        if (
                            !cell
                            ||
                            !Number.isFinite(
                                Number(
                                    cell
                                        .slope_per_decade
                                )
                            )
                        ) {

                            html += `
                                <div
                                    class="
                                        seasonal-community-cell
                                        seasonal-community-missing
                                    "
                                >
                                    ·
                                </div>
                            `;

                            return;
                        }


                        const slope =
                            Number(
                                cell
                                    .slope_per_decade
                            );


                        const standardized =
                            colourLimit > 0
                                ? (
                                    slope
                                    / colourLimit
                                )
                                : 0;


                        const displayed =
                            formatHeatmapSlope(
                                slope,
                                annualIndicator.unit
                            );


                        const significant =
                            Boolean(
                                cell
                                    .significant_fdr
                            );


                        const pValue =
                            Number(
                                cell.p_value
                            );


                        const qValue =
                            Number(
                                cell.q_value
                            );


                        const pText =
                            Number.isFinite(pValue)
                                ? formatPValue(pValue)
                                : "p not available";


                        const qText =
                            Number.isFinite(qValue)
                                ? (
                                    qValue < 0.001
                                        ? "q < 0.001"
                                        : `q = ${qValue.toFixed(3)}`
                                )
                                : "q not available";


                        const significanceText =
                            significant
                                ? "significant after accounting for multiple comparisons"
                                : "not significant after accounting for multiple comparisons";


                        html += `
                            <div
                                class="
                                    seasonal-community-cell
                                    ${
                                        significant
                                            ? "significant"
                                            : "not-significant"
                                    }
                                "
                                style="
                                    background:
                                    ${
                                        precipitationHeatmapColour(
                                            standardized
                                        )
                                    };
                                "
                                title="${
                                    escapeHtml(
                                        `${community}, `
                                        + `${column.label}: `
                                        + `${displayed} ${annualIndicator.unit}; `
                                        + `${pText}; ${qText}; `
                                        + significanceText
                                    )
                                }"
                            >
                                ${
                                    significant
                                        ? displayed
                                        : `(${displayed})`
                                }
                            </div>
                        `;
                    }
                );


                return html;
            }
        )
        .join("");


    const columnTemplate =
        [
            "minmax(175px, 1.7fr)",
            ...columns.map(
                () =>
                    "minmax(88px, 1fr)"
            )
        ]
        .join(" ");


    container.innerHTML = `

        <div class="visual-panel">

            <div class="visual-title">
                ${
                    escapeHtml(
                        annualIndicator.label
                    )
                } trends near Yukon communities
            </div>


            <div class="visual-subtitle">
                ${
                    escapeHtml(
                        annualPackage.period
                        || "1951–2025"
                    )
                } · ${escapeHtml(annualIndicator.unit)}
            </div>


            <div class="heatmap-explanation">

                Numbers show the change per decade near
                each community.

                ${
                    hasSeasonal
                        ? (
                            "Winter, spring, summer and fall " +
                            "are shown alongside the annual trend. "
                        )
                        : ""
                }

                Values in parentheses are not statistically
                significant after accounting for multiple comparisons
                correction across communities. Hover over a
                cell for its p-value and adjusted q-value.

            </div>


            <div
                class="seasonal-community-heatmap"
                style="
                    display: grid;
                    grid-template-columns:
                        ${columnTemplate};
                    width: 100%;
                    max-width: ${
                        hasSeasonal
                            ? "920px"
                            : "620px"
                    };
                    overflow: visible;
                "
            >

                ${header}
                ${rows}

            </div>


            <div class="trend-heatmap-legend">

                <span>
                    Stronger decrease
                </span>

                <div
                    class="trend-heatmap-legend-bar"
                    style="
                        background:
                            linear-gradient(
                                to right,
                                rgb(148, 92, 31),
                                rgb(246, 245, 239),
                                rgb(35, 112, 96)
                            );
                    "
                ></div>

                <span>
                    Stronger increase
                </span>

            </div>

        </div>
    `;
}


// ============================================================
// Community annual time series
// ============================================================

function renderPrecipitationCommunityTimeseries(
    container
) {

    const indicator =
        precipitationPackage
            .communities
            .indicators[
                selectedIndicator.id
            ];


    if (!indicator) {

        container.innerHTML = `
            <div class="visual-panel">
                <div class="empty-state">
                    Community time-series data are
                    not available for this indicator.
                </div>
            </div>
        `;

        return;
    }


    const communities =
        precipitationPackage
            .communities
            .community_order
            .slice()
            .sort(
                (a, b) =>
                    a.localeCompare(
                        b,
                        undefined,
                        { sensitivity: "base" }
                    )
            );


    if (
        !selectedCommunity
        ||
        !communities.includes(
            selectedCommunity
        )
    ) {

        selectedCommunity =
            communities[0];
    }


    const series =
        indicator
            .communities[
                selectedCommunity
            ];


    if (!series) {

        container.innerHTML = `
            <div class="visual-panel">
                <div class="empty-state">
                    No series is available for
                    ${escapeHtml(selectedCommunity)}.
                </div>
            </div>
        `;

        return;
    }


    const usePercent =
        indicator
            .time_series_mode
        === "anomaly_percent";


    container.innerHTML = `

        <div
            style="
                margin-bottom: 14px;
                display: flex;
                align-items: center;
                gap: 10px;
            "
        >

            <label
                for="precipitation-community-select"
                style="font-weight: 700;"
            >
                Community
            </label>


            <select
                id="precipitation-community-select"
            >

                ${
                    communities
                    .map(
                        community => `

                            <option
                                value="${
                                    escapeHtml(
                                        community
                                    )
                                }"
                                ${
                                    community
                                    === selectedCommunity
                                        ? "selected"
                                        : ""
                                }
                            >
                                ${
                                    escapeHtml(
                                        community
                                    )
                                }
                            </option>
                        `
                    )
                    .join("")
                }

            </select>

        </div>


        <div
            id="precipitation-community-chart"
        ></div>
    `;


    const chart =
        document.getElementById(
            "precipitation-community-chart"
        );


    renderPrecipitationLineChart(
        chart,
        {
            title:
                `${indicator.label} near ${selectedCommunity}`,

            subtitle:
                usePercent
                    ? (
                        "Annual difference from the " +
                        "1961–1990 average"
                    )
                    : (
                        "Annual value near the selected community"
                    ),

            years:
                (
                    series.years
                    ||
                    precipitationPackage
                        .communities
                        .years
                ),

            values:
                usePercent
                    ? series.anomalies
                    : series.values,

            yLabel:
                usePercent
                    ? "%"
                    : indicator.unit,

            trend:
                series.trend,

            trendUnit:
                indicator.trend_unit,

            period:
                (
                    precipitationPackage
                        .communities
                        .period
                    || precipitationPackage
                        .metadata
                        .period
                    || "1951–2025"
                ),

            community:
                selectedCommunity,

            zeroLine:
                usePercent
        }
    );


    document
        .getElementById(
            "precipitation-community-select"
        )
        .addEventListener(
            "change",
            event => {

                selectedCommunity =
                    event
                        .target
                        .value;


                renderPrecipitationCommunityTimeseries(
                    container
                );
            }
        );
}


// ============================================================
// About precipitation
// ============================================================




// ============================================================
// 23. Placeholder for themes not yet connected
// ============================================================

function renderPlaceholder(
    container
) {

    container.innerHTML = `

        <div class="visual-panel">

            <div class="visual-title">
                ${escapeHtml(
                    selectedIndicator.name
                )}
            </div>

            <div class="empty-state">
                This indicator has not yet been connected
                to the dashboard data package.
            </div>

        </div>
    `;
}


// ============================================================
// 24. Heat-map helpers
// ============================================================

function precipitationHeatmapColour(
    standardized
) {

    const value =
        Math.max(
            -1,
            Math.min(
                1,
                Number(
                    standardized
                )
            )
        );


    // --------------------------------------------------------
    // Brown -> near-white -> green
    //
    // Matches the precipitation-map visual language:
    //   negative trend = brown
    //   little/no change = pale neutral
    //   positive trend = green
    // --------------------------------------------------------

    const negative = [
        148,
        92,
        31
    ];

    const neutral = [
        246,
        245,
        239
    ];

    const positive = [
        35,
        112,
        96
    ];


    let start;
    let end;
    let fraction;


    if (value < 0) {

        start =
            negative;

        end =
            neutral;

        fraction =
            value + 1;

    } else {

        start =
            neutral;

        end =
            positive;

        fraction =
            value;
    }


    const red =
        Math.round(
            start[0]
            + (
                end[0]
                - start[0]
            )
            * fraction
        );


    const green =
        Math.round(
            start[1]
            + (
                end[1]
                - start[1]
            )
            * fraction
        );


    const blue =
        Math.round(
            start[2]
            + (
                end[2]
                - start[2]
            )
            * fraction
        );


    return (
        `rgb(${red}, ${green}, ${blue})`
    );
}





function formatHeatmapSlope(
    value,
    unit
) {

    if (
        !Number.isFinite(
            Number(
                value
            )
        )
    ) {
        return "NA";
    }

    const decimals =
        unit.includes(
            "°C"
        )
            ? 2
            : 1;

    return formatSigned(
        value,
        decimals
    );
}





// ============================================================
// 25. General formatting helpers
// ============================================================

function temperatureDecimals(
    unit
) {

    return (
        unit === "°C"
            ? 1
            : unit === "days"
                ? 0
                : 1
    );
}





function formatSigned(
    value,
    decimals = 2
) {

    const number =
        Number(
            value
        );

    if (
        !Number.isFinite(
            number
        )
    ) {
        return "NA";
    }

    return `${
        number >= 0
            ? "+"
            : ""
    }${number.toFixed(decimals)}`;
}





function escapeHtml(
    value
) {

    return String(
        value
    )
    .replaceAll(
        "&",
        "&amp;"
    )
    .replaceAll(
        "<",
        "&lt;"
    )
    .replaceAll(
        ">",
        "&gt;"
    )
    .replaceAll(
        '"',
        "&quot;"
    )
    .replaceAll(
        "'",
        "&#039;"
    );
}


// ============================================================
// 26. Indicator catalogue table
// ============================================================

function buildTable() {

    document
        .getElementById(
            "indicator-search"
        )
        .addEventListener(
            "input",
            renderTable
        );

    document
        .getElementById(
            "status-filter"
        )
        .addEventListener(
            "change",
            renderTable
        );

    renderTable();
}


function renderTable() {

    const body =
        document.getElementById(
            "indicator-table-body"
        );

    const searchText =
        document
        .getElementById(
            "indicator-search"
        )
        .value
        .trim()
        .toLowerCase();

    const statusFilter =
        document
        .getElementById(
            "status-filter"
        )
        .value;

    const filtered =
        indicators.filter(
            item => {

                const haystack =
                    [
                        item.name,
                        item.dashboard_theme,
                        item.theme
                    ]
                    .join(" ")
                    .toLowerCase();

                const matchesSearch =
                    !searchText
                    ||
                    haystack.includes(
                        searchText
                    );

                const matchesStatus =
                    statusFilter
                    === "all"
                    ||
                    item.status
                    === statusFilter;

                return (
                    matchesSearch
                    &&
                    matchesStatus
                );
            }
        );

    body.innerHTML = "";

    filtered.forEach(
        item => {

            const row =
                document.createElement(
                    "tr"
                );

            row.innerHTML = `

                <td>
                    ${escapeHtml(
                        item.name
                    )}
                </td>

                <td>
                    ${escapeHtml(
                        item.dashboard_theme
                    )}
                </td>

                <td>
                    ${
                        statusLabels[
                            item.status
                        ]
                        || item.status
                    }
                </td>

                <td>
                    ${
                        item.relevance
                        ?? ""
                    }
                </td>
            `;

            row.addEventListener(
                "click",
                () => {

                    selectTheme(
                        item
                        .dashboard_theme
                    );

                    selectIndicator(
                        item.id
                    );

                    document
                        .querySelector(
                            ".explorer-section"
                        )
                        .scrollIntoView({
                            behavior:
                                "smooth",
                            block:
                                "start"
                        });
                }
            );

            body.appendChild(
                row
            );
        }
    );
}


// ============================================================
// Full-screen dashboard figure viewer
// ============================================================

function ensureDashboardFigureLightbox() {
    if (document.getElementById("dashboardFigureLightbox")) {
        return;
    }

    const lightbox = document.createElement("div");

    lightbox.id = "dashboardFigureLightbox";
    lightbox.className = "dashboard-figure-lightbox";

    lightbox.innerHTML = `
        <button
            class="dashboard-figure-lightbox-close"
            type="button"
            aria-label="Close full-screen figure"
        >&times;</button>

        <div
            id="dashboardFigureLightboxContent"
            class="dashboard-figure-lightbox-content"
        ></div>
    `;

    document.body.appendChild(lightbox);

    lightbox.addEventListener("click", (event) => {
        if (
            event.target === lightbox ||
            event.target.classList.contains(
                "dashboard-figure-lightbox-close"
            )
        ) {
            // Prevent the document-level delegated click handler
            // from seeing this same click and reopening the figure.
            event.stopPropagation();

            closeDashboardFigureLightbox();
        }
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            closeDashboardFigureLightbox();
        }
    });
}


function openDashboardFigureLightbox(element) {
    if (!element) {
        return;
    }

    ensureDashboardFigureLightbox();

    const lightbox = document.getElementById(
        "dashboardFigureLightbox"
    );

    const content = document.getElementById(
        "dashboardFigureLightboxContent"
    );

    if (!lightbox || !content) {
        return;
    }

    content.innerHTML = "";

    const clone = element.cloneNode(true);

    clone.removeAttribute("width");
    clone.removeAttribute("height");

    if (clone.tagName.toLowerCase() === "img") {
        clone.removeAttribute("loading");
    }

    content.appendChild(clone);

    lightbox.classList.add("is-open");
    document.body.style.overflow = "hidden";
}


function closeDashboardFigureLightbox() {
    const lightbox = document.getElementById(
        "dashboardFigureLightbox"
    );

    const content = document.getElementById(
        "dashboardFigureLightboxContent"
    );

    if (!lightbox) {
        return;
    }

    lightbox.classList.remove("is-open");
    document.body.style.overflow = "";

    if (content) {
        content.innerHTML = "";
    }
}


// ============================================================
// Universal delegated figure click handler
//
// This intentionally does not depend on chart class names.
// Any IMG or SVG inside <main> can be expanded, except when it
// is inside an interactive control such as a button or link.
// ============================================================

document.addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) {
        return;
    }

    // Ignore the lightbox itself.
    if (
        event.target.closest(
            "#dashboardFigureLightbox"
        )
    ) {
        return;
    }

    // Do not hijack buttons, links, inputs or other controls.
    if (
        event.target.closest(
            "button, a, input, select, textarea, label"
        )
    ) {
        return;
    }

    const figure = event.target.closest(
        "img, svg"
    );

    if (!figure) {
        return;
    }

    const main = document.querySelector("main");

    if (!main || !main.contains(figure)) {
        return;
    }

    openDashboardFigureLightbox(
        figure
    );
});
