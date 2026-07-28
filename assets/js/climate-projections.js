const DATA_ROOT = "data/climate_projections";

const state = {
    manifest: null,
    geographyType: "territory",
    locationId: null,
    scenario: "ssp245",
    locationData: null,
    filterText: ""
};

const geographyTypeSelect =
    document.getElementById("geography-type");

const locationSelect =
    document.getElementById("location");

const scenarioSelect =
    document.getElementById("scenario");

const locationLabel =
    document.querySelector(
        'label[for="location"]'
    );

const filterInput =
    document.getElementById("indicator-filter");

const statusMessage =
    document.getElementById("status-message");

const projectionContent =
    document.getElementById("projection-content");

const locationTitle =
    document.getElementById("location-title");

const scenarioDescription =
    document.getElementById(
        "scenario-description"
    );

const tableBody =
    document.getElementById(
        "projection-table-body"
    );

const noResults =
    document.getElementById("no-results");

const geographyMethodText =
    document.getElementById(
        "geography-method-text"
    );


function formatSignedNumber(value) {
    if (
        value === null
        || value === undefined
        || Number.isNaN(Number(value))
    ) {
        return "—";
    }

    const numberValue = Number(value);

    if (Math.abs(numberValue) < 0.05) {
        return "0.0";
    }

    const prefix =
        numberValue > 0
            ? "+"
            : "";

    return `${prefix}${numberValue.toFixed(1)}`;
}


function formatHistoricalNumber(value) {
    if (
        value === null
        || value === undefined
        || Number.isNaN(Number(value))
    ) {
        return "—";
    }

    return Number(value).toFixed(1);
}


function getSelectedType() {
    return state.manifest.geography_types.find(
        item => item.id === state.geographyType
    );
}


function getSelectedScenario() {
    return state.manifest.scenarios.find(
        item => item.id === state.scenario
    );
}


function populateGeographyTypes() {
    geographyTypeSelect.innerHTML = "";

    state.manifest.geography_types.forEach(
        geographyType => {
            const option =
                document.createElement("option");

            option.value = geographyType.id;
            option.textContent =
                geographyType.enabled
                    ? geographyType.name
                    : `${geographyType.name} — coming later`;

            option.disabled =
                !geographyType.enabled;

            geographyTypeSelect.appendChild(
                option
            );
        }
    );

    geographyTypeSelect.value =
        state.geographyType;
}


function populateScenarios() {
    scenarioSelect.innerHTML = "";

    state.manifest.scenarios.forEach(
        scenario => {
            const option =
                document.createElement("option");

            option.value = scenario.id;
            option.textContent =
                scenario.name;

            scenarioSelect.appendChild(
                option
            );
        }
    );

    scenarioSelect.value =
        state.scenario;
}


function populateLocations() {
    const selectedType =
        getSelectedType();

    locationSelect.innerHTML = "";

    selectedType.locations.forEach(
        location => {
            const option =
                document.createElement("option");

            option.value = location.id;
            option.textContent =
                location.abbreviation
                    ? `${location.name} (${location.abbreviation})`
                    : location.name;

            locationSelect.appendChild(
                option
            );
        }
    );

    if (
        !state.locationId
        || !selectedType.locations.some(
            location =>
                location.id === state.locationId
        )
    ) {
        state.locationId =
            selectedType.locations[0]?.id
            ?? null;
    }

    locationSelect.value =
        state.locationId;

    locationLabel.textContent =
        selectedType.name;
}


async function loadLocationData() {
    const selectedType =
        getSelectedType();

    const location =
        selectedType.locations.find(
            item => item.id === state.locationId
        );

    if (!location) {
        throw new Error(
            "No location is available for this geography type."
        );
    }

    statusMessage.hidden = false;
    projectionContent.hidden = true;

    statusMessage.textContent =
        `Loading ${location.name}...`;

    const response = await fetch(
        `${DATA_ROOT}/${location.file}`
    );

    if (!response.ok) {
        throw new Error(
            `Could not load ${location.name}.`
        );
    }

    state.locationData =
        await response.json();

    renderPage();

    statusMessage.hidden = true;
    projectionContent.hidden = false;
}


function createCell(
    text,
    className
) {
    const cell =
        document.createElement("td");

    cell.textContent = text;
    cell.className = className;

    return cell;
}


function renderTable() {
    tableBody.innerHTML = "";

    const indicators =
        state.locationData.indicators.filter(
            indicator => {
                const searchableText =
                    [
                        indicator.name,
                        indicator.label,
                        indicator.id,
                        indicator.units
                    ]
                    .join(" ")
                    .toLowerCase();

                return searchableText.includes(
                    state.filterText
                );
            }
        );

    indicators.forEach(
        indicator => {
            const row =
                document.createElement("tr");

            const scenarioValues =
                indicator.scenarios[
                    state.scenario
                ];

            const nearValues =
                scenarioValues["2041"];

            const lateValues =
                scenarioValues["2071"];

            const historicalDisplay =
                indicator.value_format === "date"
                    ? (
                        indicator
                            .historical
                            .display
                        ?? "—"
                    )
                    : formatHistoricalNumber(
                        indicator
                            .historical
                            .median
                    );

            row.appendChild(
                createCell(
                    indicator.label,
                    "indicator-cell"
                )
            );

            row.appendChild(
                createCell(
                    historicalDisplay,
                    "historical-cell median-value"
                )
            );

            if (
                indicator.value_format
                === "date"
            ) {
                row.appendChild(
                    createCell(
                        nearValues
                            .display
                            .p10
                        ?? "—",
                        "near-cell"
                    )
                );

                row.appendChild(
                    createCell(
                        nearValues
                            .display
                            .p50
                        ?? "—",
                        "near-cell median-value"
                    )
                );

                row.appendChild(
                    createCell(
                        nearValues
                            .display
                            .p90
                        ?? "—",
                        "near-cell"
                    )
                );

                row.appendChild(
                    createCell(
                        lateValues
                            .display
                            .p10
                        ?? "—",
                        "late-cell"
                    )
                );

                row.appendChild(
                    createCell(
                        lateValues
                            .display
                            .p50
                        ?? "—",
                        "late-cell median-value"
                    )
                );

                row.appendChild(
                    createCell(
                        lateValues
                            .display
                            .p90
                        ?? "—",
                        "late-cell"
                    )
                );
            } else {
                row.appendChild(
                    createCell(
                        formatSignedNumber(
                            nearValues.p10
                        ),
                        "near-cell"
                    )
                );

                row.appendChild(
                    createCell(
                        formatSignedNumber(
                            nearValues.p50
                        ),
                        "near-cell median-value"
                    )
                );

                row.appendChild(
                    createCell(
                        formatSignedNumber(
                            nearValues.p90
                        ),
                        "near-cell"
                    )
                );

                row.appendChild(
                    createCell(
                        formatSignedNumber(
                            lateValues.p10
                        ),
                        "late-cell"
                    )
                );

                row.appendChild(
                    createCell(
                        formatSignedNumber(
                            lateValues.p50
                        ),
                        "late-cell median-value"
                    )
                );

                row.appendChild(
                    createCell(
                        formatSignedNumber(
                            lateValues.p90
                        ),
                        "late-cell"
                    )
                );
            }

            tableBody.appendChild(row);
        }
    );

    noResults.hidden =
        indicators.length !== 0;
}


function renderPage() {
    const geography =
        state.locationData.geography;

    const scenario =
        getSelectedScenario();

    locationTitle.textContent =
        geography.abbreviation
            ? `${geography.name} (${geography.abbreviation})`
            : geography.name;

    scenarioDescription.textContent =
        `${scenario.name}: ${scenario.description}`;

    document.title =
        `${geography.name} climate projections`;

    if (geography.type === "territory") {
        geographyMethodText.textContent =
            "Values are averaged across the entire mapped " +
            "First Nation territory.";
    } else if (geography.type === "community") {
        geographyMethodText.textContent =
            "Values represent the selected community area.";
    } else {
        geographyMethodText.textContent =
            "Values are averaged across the selected area.";
    }

    renderTable();
}


function updateUrl() {
    const url =
        new URL(window.location.href);

    url.searchParams.set(
        "type",
        state.geographyType
    );

    url.searchParams.set(
        "location",
        state.locationId
    );

    url.searchParams.set(
        "scenario",
        state.scenario
    );

    window.history.replaceState(
        {},
        "",
        url
    );
}


function readUrlSelections() {
    const parameters =
        new URLSearchParams(
            window.location.search
        );

    const requestedType =
        parameters.get("type");

    const requestedLocation =
        parameters.get("location");

    const requestedScenario =
        parameters.get("scenario");

    if (
        requestedType
        && state.manifest
            .geography_types
            .some(
                item =>
                    item.id
                    === requestedType
                    && item.enabled
            )
    ) {
        state.geographyType =
            requestedType;
    }

    if (
        requestedScenario
        && state.manifest
            .scenarios
            .some(
                item =>
                    item.id
                    === requestedScenario
            )
    ) {
        state.scenario =
            requestedScenario;
    }

    state.locationId =
        requestedLocation;
}


async function initialize() {
    try {
        const manifestResponse =
            await fetch(
                `${DATA_ROOT}/manifest.json`
            );

        if (!manifestResponse.ok) {
            throw new Error(
                "The climate projection manifest could not be loaded."
            );
        }

        state.manifest =
            await manifestResponse.json();

        readUrlSelections();
        populateGeographyTypes();
        populateScenarios();
        populateLocations();

        await loadLocationData();
        updateUrl();
    } catch (error) {
        statusMessage.hidden = false;
        projectionContent.hidden = true;

        statusMessage.textContent =
            error.message;

        console.error(error);
    }
}


geographyTypeSelect.addEventListener(
    "change",
    async event => {
        state.geographyType =
            event.target.value;

        state.locationId = null;

        populateLocations();
        await loadLocationData();
        updateUrl();
    }
);


locationSelect.addEventListener(
    "change",
    async event => {
        state.locationId =
            event.target.value;

        await loadLocationData();
        updateUrl();
    }
);


scenarioSelect.addEventListener(
    "change",
    event => {
        state.scenario =
            event.target.value;

        renderPage();
        updateUrl();
    }
);


filterInput.addEventListener(
    "input",
    event => {
        state.filterText =
            event.target.value
                .trim()
                .toLowerCase();

        renderTable();
    }
);


initialize();
