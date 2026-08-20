// ============================================================
// Wildfire indicator renderer
// ============================================================

window.WildfireIndicators = (() => {

    let packagePromise = null;

    function esc(value) {
        return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }


    function loadPackage() {

        if (!packagePromise) {

            packagePromise = Promise.all([
                fetch("data/wildfire/metadata.json")
                    .then(response => {
                        if (!response.ok) throw new Error("Could not load wildfire metadata.");
                        return response.json();
                    }),

                fetch("data/wildfire/yukon_timeseries.json")
                    .then(response => {
                        if (!response.ok) throw new Error("Could not load wildfire time series.");
                        return response.json();
                    })
            ])
            .then(([metadata, yukon]) => ({
                metadata,
                yukon
            }));
        }

        return packagePromise;
    }


    function isIndicator(indicator) {
        return Boolean(
            indicator
            && indicator.dashboard_theme === "Wildfire"
        );
    }


    function getViews() {
        return ["yukon", "about"];
    }


    function getVisualizations(view) {
        return view === "yukon"
            ? ["timeseries"]
            : [];
    }


    function formatPValue(value) {

        if (value < 0.001) {
            return "p < 0.001";
        }

        return `p = ${value.toFixed(3)}`;
    }


    function formatSlope(indicatorId, value) {

        if (indicatorId === "total-area-burned") {
            return `${value >= 0 ? "+" : ""}${value.toFixed(1)} thousand hectares per decade`;
        }

        if (indicatorId === "number-of-fires") {
            return `${value >= 0 ? "+" : ""}${value.toFixed(1)} fires per decade`;
        }

        if (indicatorId === "fire-severity") {
            return `${value >= 0 ? "+" : ""}${value.toFixed(3)} DSR units per decade`;
        }

        return `${value >= 0 ? "+" : ""}${value.toFixed(2)} FWI units per decade`;
    }


    function recordStory(indicatorId, meta, trend) {

        const slope = Number(trend.slope_per_decade);
        const p = Number(trend.p_value);
        const significant = Boolean(trend.significant_p05);

        const direction = {
            "total-area-burned":
                slope >= 0 ? "increasing area burned" : "decreasing area burned",

            "number-of-fires":
                slope >= 0 ? "an increasing number of recorded fires" : "a decreasing number of recorded fires",

            "fire-severity":
                slope >= 0 ? "increasing summer fire-weather severity" : "decreasing summer fire-weather severity",

            "fire-weather-index":
                slope >= 0 ? "increasing sustained fire-weather severity" : "decreasing sustained fire-weather severity"
        }[indicatorId];

        if (significant) {
            return (
                `The ${meta.period} Yukon record shows ${direction}. `
                + `The estimated long-term change is ${formatSlope(indicatorId, slope)} `
                + `(${formatPValue(p)}).`
            );
        }

        return (
            `The ${meta.period} Yukon record does not show a statistically clear long-term change. `
            + `The estimated trend is ${formatSlope(indicatorId, slope)} `
            + `(${formatPValue(p)}), while year-to-year variability remains substantial.`
        );
    }


    async function renderView(container, indicator) {

        container.innerHTML =
            `<div class="empty-state">Loading wildfire indicator...</div>`;

        const data = await loadPackage();

        const meta =
            data.metadata.indicators[indicator.id];

        const series =
            data.yukon.indicators[indicator.id];

        if (!meta || !series) {
            container.innerHTML =
                `<div class="empty-state">Wildfire data are not available for this indicator.</div>`;
            return;
        }

        container.innerHTML = `
            <div class="visual-layout">

                <div class="visual-panel">

                    <img
                        class="wildfire-indicator-figure"
                        src="${esc(meta.figure)}"
                        alt="${esc(meta.label)} time series for Yukon"
                    >

                </div>

                ${
                    renderTrendMetrics(
                        series.trend,
                        meta.trend_unit,
                        meta.period
                    )
                }

            </div>
        `;
    }


    async function renderAbout(container, indicator) {

        container.innerHTML =
            `<div class="empty-state">Loading indicator information...</div>`;

        const data = await loadPackage();

        const meta =
            data.metadata.indicators[indicator.id];

        const series =
            data.yukon.indicators[indicator.id];

        if (!meta || !series) {
            container.innerHTML =
                `<div class="empty-state">Wildfire metadata are not available.</div>`;
            return;
        }

        container.innerHTML = `
            <div class="about-panel">

                <h3>About this indicator</h3>

                <div class="about-row">
                    <div class="about-label">Why we track it</div>
                    <div class="about-story">
                        ${esc(meta.why_we_track_it)}
                    </div>
                </div>

                <div class="about-row">
                    <div class="about-label">What the Yukon record shows</div>
                    <div class="about-story">
                        ${esc(recordStory(indicator.id, meta, series.trend))}
                    </div>
                </div>

                <div class="about-row">
                    <div class="about-label">Definition</div>
                    <div>${esc(meta.definition)}</div>
                </div>

                <div class="about-row">
                    <div class="about-label">Period</div>
                    <div>${esc(meta.period)}</div>
                </div>

                <div class="about-row">
                    <div class="about-label">Data source</div>
                    <div>${esc(meta.source)}</div>
                </div>

                <div class="about-row">
                    <div class="about-label">Trend and significance</div>
                    <div>
                        Theil-Sen trend:
                        ${esc(formatSlope(indicator.id, Number(series.trend.slope_per_decade)))};
                        ${esc(formatPValue(Number(series.trend.p_value)))}.
                    </div>
                </div>

                <div class="about-row">
                    <div class="about-label">Limitations</div>
                    <div>${esc(meta.limitations)}</div>
                </div>

                <div class="about-row">
                    <div class="about-label">Methods and references</div>
                    <div class="about-link-list">
                        <a
                            href="https://pubs.usgs.gov/tm/04/a03/tm4a3.pdf"
                            target="_blank"
                            rel="noopener noreferrer"
                        >Trend analysis and Kendall methods</a>

                        <a
                            href="https://doi.org/10.1080/01621459.1968.10480934"
                            target="_blank"
                            rel="noopener noreferrer"
                        >Sen slope method</a>
                    </div>
                </div>

            </div>
        `;
    }


    return {
        isIndicator,
        getViews,
        getVisualizations,
        renderView,
        renderAbout
    };

})();
