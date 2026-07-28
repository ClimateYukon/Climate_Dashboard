const DATA_ROOT = "data/climate_projections";

const state = {
    manifest: null,
    geographyType: "territory",
    locationId: null,
    scenario: "ssp245",
    locationData: null,
    filterText: "",
    plainLanguageFilterText: "",
    expertMode: true
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

const expertModeToggle =
    document.getElementById(
        "expert-mode"
    );

const expertModeStatus =
    document.getElementById(
        "expert-mode-status"
    );

const tableSection =
    document.querySelector(
        ".table-section"
    );

const plainLanguageSection =
    document.getElementById(
        "plain-language-section"
    );

const plainLanguageList =
    document.getElementById(
        "plain-language-list"
    );

const plainLanguageFilter =
    document.getElementById(
        "plain-language-filter"
    );

const plainLanguageNoResults =
    document.getElementById(
        "plain-language-no-results"
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


function closeIndicatorTooltips() {
    document
        .querySelectorAll(
            ".indicator-info-button[aria-expanded='true']"
        )
        .forEach(button => {
            button.setAttribute(
                "aria-expanded",
                "false"
            );
        });

    document
        .querySelectorAll(
            ".indicator-tooltip.is-open"
        )
        .forEach(tooltip => {
            tooltip.classList.remove(
                "is-open"
            );
        });
}


function positionIndicatorTooltip(
    button,
    tooltip
) {
    const buttonRect =
        button.getBoundingClientRect();

    const margin = 12;
    const tooltipWidth = Math.min(
        340,
        window.innerWidth - 32
    );

    tooltip.style.width =
        `${tooltipWidth}px`;

    tooltip.style.left = "0px";
    tooltip.style.top = "0px";

    const tooltipHeight =
        tooltip.offsetHeight;

    let left =
        buttonRect.left
        + buttonRect.width / 2
        - tooltipWidth / 2;

    left = Math.max(
        16,
        Math.min(
            left,
            window.innerWidth
            - tooltipWidth
            - 16
        )
    );

    let top =
        buttonRect.bottom
        + margin;

    if (
        top
        + tooltipHeight
        > window.innerHeight
        - 16
    ) {
        top =
            buttonRect.top
            - tooltipHeight
            - margin;
    }

    tooltip.style.left =
        `${left}px`;

    tooltip.style.top =
        `${Math.max(16, top)}px`;
}


function createIndicatorCell(indicator) {
    const cell =
        document.createElement("td");

    cell.className = "indicator-cell";

    const wrapper =
        document.createElement("div");

    wrapper.className =
        "indicator-name-wrapper";

    const label =
        document.createElement("span");

    label.className =
        "indicator-name";

    label.textContent =
        indicator.label;

    const button =
        document.createElement("button");

    button.type = "button";
    button.className =
        "indicator-info-button";

    button.textContent = "i";

    button.setAttribute(
        "aria-label",
        `Definition of ${indicator.name}`
    );

    button.setAttribute(
        "aria-expanded",
        "false"
    );

    const tooltip =
        document.createElement("div");

    tooltip.className =
        "indicator-tooltip";

    tooltip.setAttribute(
        "role",
        "tooltip"
    );

    tooltip.textContent =
        indicator.definition
        || "No definition is currently available.";

    document.body.appendChild(
        tooltip
    );

    button.addEventListener(
        "mouseenter",
        () => {
            closeIndicatorTooltips();

            tooltip.classList.add(
                "is-open"
            );

            positionIndicatorTooltip(
                button,
                tooltip
            );
        }
    );

    button.addEventListener(
        "mouseleave",
        () => {
            if (
                button.getAttribute(
                    "aria-expanded"
                ) !== "true"
            ) {
                tooltip.classList.remove(
                    "is-open"
                );
            }
        }
    );

    button.addEventListener(
        "focus",
        () => {
            tooltip.classList.add(
                "is-open"
            );

            positionIndicatorTooltip(
                button,
                tooltip
            );
        }
    );

    button.addEventListener(
        "blur",
        () => {
            if (
                button.getAttribute(
                    "aria-expanded"
                ) !== "true"
            ) {
                tooltip.classList.remove(
                    "is-open"
                );
            }
        }
    );

    button.addEventListener(
        "click",
        event => {
            event.stopPropagation();

            const wasOpen =
                button.getAttribute(
                    "aria-expanded"
                ) === "true";

            closeIndicatorTooltips();

            if (!wasOpen) {
                button.setAttribute(
                    "aria-expanded",
                    "true"
                );

                tooltip.classList.add(
                    "is-open"
                );

                positionIndicatorTooltip(
                    button,
                    tooltip
                );
            }
        }
    );

    wrapper.appendChild(
        label
    );

    wrapper.appendChild(
        button
    );

    cell.appendChild(
        wrapper
    );

    return cell;
}


const PLAIN_LANGUAGE_TITLES = {
    cdd: "Longest dry period",
    cddcold_18: "Cooling needs",
    "dlyfrzthw_tx0_tn-1": "Freeze-thaw days",
    first_fall_frost: "First fall frost",
    frost_days: "Frost days",
    frost_free_season: "Frost-free season",
    gddgrow_0: "Accumulated warmth above 0°C",
    gddgrow_5: "Growing conditions above 5°C",
    hddheat_18: "Heating needs",
    ice_days: "Days remaining below freezing",
    last_spring_frost: "Last spring frost",
    nr_cdd: "Extended dry periods",
    pr1mm: "Days with precipitation",
    pr10mm: "Days with heavy precipitation",
    pr20mm: "Days with very heavy precipitation",
    prtot: "Annual precipitation",
    prx1day: "Heaviest one-day precipitation",
    prx5day: "Heaviest five-day precipitation",
    ratot: "Annual rainfall",
    rax1day: "Heaviest one-day rainfall",
    sn2mm: "Days with snowfall",
    sn10mm: "Days with heavy snowfall",
    sntot: "Annual snowfall",
    snx1day: "Heaviest one-day snowfall",
    tg_mean: "Average annual temperature",
    tn_mean: "Average daily minimum temperature",
    tn_min: "Coldest temperature",
    tnlt_m15: "Days colder than -15°C",
    tnlt_m25: "Days colder than -25°C",
    tr_18: "Nights warmer than 18°C",
    tr_20: "Nights warmer than 20°C",
    tr_22: "Nights warmer than 22°C",
    tx_max: "Hottest temperature",
    tx_mean: "Average daily maximum temperature",
    txgt_25: "Days warmer than 25°C",
    txgt_27: "Days warmer than 27°C",
    txgt_29: "Days warmer than 29°C",
    txgt_30: "Days warmer than 30°C",
    txgt_32: "Days warmer than 32°C"
};


function getProjectionValues(indicator) {
    const historical =
        Number(indicator.historical.median);

    const mid =
        indicator.scenarios[
            state.scenario
        ]["2041"];

    const late =
        indicator.scenarios[
            state.scenario
        ]["2071"];

    return {
        historical,

        midChange:
            Number(mid.p50),

        lateChange:
            Number(late.p50),

        midValue:
            historical
            + Number(mid.p50),

        lateValue:
            historical
            + Number(late.p50),

        midLow:
            historical
            + Number(mid.p10),

        midHigh:
            historical
            + Number(mid.p90),

        lateLow:
            historical
            + Number(late.p10),

        lateHigh:
            historical
            + Number(late.p90),

        midDisplay:
            mid.display || null,

        lateDisplay:
            late.display || null
    };
}


function formatPublicNumber(
    value,
    units,
    digits = 1
) {
    if (
        value === null
        || value === undefined
        || Number.isNaN(Number(value))
    ) {
        return "unavailable";
    }

    const number =
        Number(value);

    const rounded =
        number.toFixed(digits);

    if (units === "°C") {
        return `${rounded}°C`;
    }

    if (units === "days") {
        return `${rounded} days`;
    }

    if (units === "periods") {
        return `${rounded} periods`;
    }

    if (units === "degree-days") {
        return `${rounded} degree-days`;
    }

    if (units === "mm") {
        return `${rounded} mm`;
    }

    return units
        ? `${rounded} ${units}`
        : rounded;
}


function formatPublicCount(
    value,
    noun = "days"
) {
    if (
        value === null
        || value === undefined
        || Number.isNaN(Number(value))
    ) {
        return "unavailable";
    }

    const number =
        Number(value);

    return `${number.toFixed(1)} ${noun}`;
}


function formatPublicRange(
    low,
    high,
    units,
    noun = null
) {
    if (noun) {
        return (
            `${formatPublicCount(low, noun)} to ` +
            `${formatPublicCount(high, noun)}`
        );
    }

    return (
        `${formatPublicNumber(low, units)} to ` +
        `${formatPublicNumber(high, units)}`
    );
}


function modelRangeText(
    values,
    units,
    noun = null
) {
    return (
        `Across the climate models, mid-century results range from ` +
        `${formatPublicRange(
            values.midLow,
            values.midHigh,
            units,
            noun
        )}, while late-century results range from ` +
        `${formatPublicRange(
            values.lateLow,
            values.lateHigh,
            units,
            noun
        )}.`
    );
}


function result(
    mainText,
    rangeText
) {
    return {
        mainText,
        rangeText
    };
}


function temperatureSentence(
    indicator,
    subject
) {
    const values =
        getProjectionValues(indicator);

    return result(
        `${subject} during 1971–2000 was ` +
        `<strong>${
            formatPublicNumber(
                values.historical,
                "°C"
            )
        }</strong>. ` +
        `It is projected to reach about ` +
        `<strong>${
            formatPublicNumber(
                values.midValue,
                "°C"
            )
        }</strong> by mid-century and ` +
        `<strong>${
            formatPublicNumber(
                values.lateValue,
                "°C"
            )
        }</strong> by late century.`,

        modelRangeText(
            values,
            "°C"
        )
    );
}


function thresholdDaySentence(
    indicator,
    threshold,
    direction
) {
    const values =
        getProjectionValues(indicator);

    const wording =
        direction === "above"
            ? `warmer than ${threshold}`
            : `colder than ${threshold}`;

    return result(
        `During 1971–2000, there were about ` +
        `<strong>${
            formatPublicCount(
                values.historical
            )
        }</strong> each year ${wording}. ` +
        `This is projected to change to about ` +
        `<strong>${
            formatPublicCount(
                values.midValue
            )
        }</strong> by mid-century and ` +
        `<strong>${
            formatPublicCount(
                values.lateValue
            )
        }</strong> by late century.`,

        modelRangeText(
            values,
            "days",
            "days"
        )
    );
}


function precipitationDaySentence(
    indicator,
    threshold,
    description
) {
    const values =
        getProjectionValues(indicator);

    return result(
        `Historically, the territory had about ` +
        `<strong>${
            formatPublicCount(
                values.historical
            )
        }</strong> each year with ${description} ` +
        `(${threshold} or more). ` +
        `This is projected to rise to about ` +
        `<strong>${
            formatPublicCount(
                values.midValue
            )
        }</strong> by mid-century and ` +
        `<strong>${
            formatPublicCount(
                values.lateValue
            )
        }</strong> by late century.`,

        modelRangeText(
            values,
            "days",
            "days"
        )
    );
}


function frostDateSentence(
    indicator,
    eventDescription
) {
    const values =
        getProjectionValues(indicator);

    const historicalDate =
        indicator.historical.display
        || "an unavailable date";

    const midDate =
        values.midDisplay?.p50
        || "an unavailable date";

    const lateDate =
        values.lateDisplay?.p50
        || "an unavailable date";

    return result(
        `${eventDescription} occurred around ` +
        `<strong>${historicalDate}</strong> during 1971–2000. ` +
        `The projected date is around ` +
        `<strong>${midDate}</strong> by mid-century and ` +
        `<strong>${lateDate}</strong> by late century.`,

        `Across the climate models, projected dates range from ` +
        `${values.midDisplay?.p10 || "unavailable"} to ` +
        `${values.midDisplay?.p90 || "unavailable"} by mid-century, ` +
        `and from ${values.lateDisplay?.p10 || "unavailable"} to ` +
        `${values.lateDisplay?.p90 || "unavailable"} by late century.`
    );
}


const PLAIN_LANGUAGE_BUILDERS = {
    tn_min: indicator =>
        temperatureSentence(
            indicator,
            "The coldest temperature of the year"
        ),

    tx_max: indicator =>
        temperatureSentence(
            indicator,
            "The hottest temperature of the year"
        ),

    tg_mean: indicator =>
        temperatureSentence(
            indicator,
            "The average annual temperature"
        ),

    tn_mean: indicator =>
        temperatureSentence(
            indicator,
            "The average daily minimum temperature"
        ),

    tx_mean: indicator =>
        temperatureSentence(
            indicator,
            "The average daily maximum temperature"
        ),

    txgt_25: indicator =>
        thresholdDaySentence(
            indicator,
            "25°C",
            "above"
        ),

    txgt_27: indicator =>
        thresholdDaySentence(
            indicator,
            "27°C",
            "above"
        ),

    txgt_29: indicator =>
        thresholdDaySentence(
            indicator,
            "29°C",
            "above"
        ),

    txgt_30: indicator =>
        thresholdDaySentence(
            indicator,
            "30°C",
            "above"
        ),

    txgt_32: indicator =>
        thresholdDaySentence(
            indicator,
            "32°C",
            "above"
        ),

    tnlt_m15: indicator =>
        thresholdDaySentence(
            indicator,
            "-15°C",
            "below"
        ),

    tnlt_m25: indicator =>
        thresholdDaySentence(
            indicator,
            "-25°C",
            "below"
        ),

    tr_18: indicator => {
        const values =
            getProjectionValues(indicator);

        return result(
            `Nights staying warmer than 18°C were historically rare, ` +
            `averaging about ` +
            `<strong>${
                formatPublicCount(
                    values.historical,
                    "nights"
                )
            }</strong> each year. ` +
            `This is projected to increase to about ` +
            `<strong>${
                formatPublicCount(
                    values.midValue,
                    "nights"
                )
            }</strong> by mid-century and ` +
            `<strong>${
                formatPublicCount(
                    values.lateValue,
                    "nights"
                )
            }</strong> by late century.`,

            modelRangeText(
                values,
                "days",
                "nights"
            )
        );
    },

    tr_20: indicator => {
        const values =
            getProjectionValues(indicator);

        return result(
            `Nights staying warmer than 20°C were historically very uncommon, ` +
            `averaging ` +
            `<strong>${
                formatPublicCount(
                    values.historical,
                    "nights"
                )
            }</strong> each year. ` +
            `They are projected to occur about ` +
            `<strong>${
                formatPublicCount(
                    values.midValue,
                    "nights"
                )
            }</strong> per year by mid-century and ` +
            `<strong>${
                formatPublicCount(
                    values.lateValue,
                    "nights"
                )
            }</strong> by late century.`,

            modelRangeText(
                values,
                "days",
                "nights"
            )
        );
    },

    tr_22: indicator => {
        const values =
            getProjectionValues(indicator);

        return result(
            `Nights staying warmer than 22°C were nearly absent during ` +
            `1971–2000, averaging ` +
            `<strong>${
                formatPublicCount(
                    values.historical,
                    "nights"
                )
            }</strong> each year. ` +
            `They are projected to occur about ` +
            `<strong>${
                formatPublicCount(
                    values.midValue,
                    "nights"
                )
            }</strong> per year by mid-century and ` +
            `<strong>${
                formatPublicCount(
                    values.lateValue,
                    "nights"
                )
            }</strong> by late century.`,

            modelRangeText(
                values,
                "days",
                "nights"
            )
        );
    },

    frost_days: indicator => {
        const values =
            getProjectionValues(indicator);

        return result(
            `During 1971–2000, minimum temperatures fell below freezing ` +
            `on about ` +
            `<strong>${
                formatPublicCount(
                    values.historical
                )
            }</strong> each year. ` +
            `The number of frost days is projected to fall to about ` +
            `<strong>${
                formatPublicCount(
                    values.midValue
                )
            }</strong> by mid-century and ` +
            `<strong>${
                formatPublicCount(
                    values.lateValue
                )
            }</strong> by late century.`,

            modelRangeText(
                values,
                "days",
                "days"
            )
        );
    },

    ice_days: indicator => {
        const values =
            getProjectionValues(indicator);

        return result(
            `Historically, the temperature remained below freezing all day ` +
            `on about ` +
            `<strong>${
                formatPublicCount(
                    values.historical
                )
            }</strong> each year. ` +
            `This is projected to decline to about ` +
            `<strong>${
                formatPublicCount(
                    values.midValue
                )
            }</strong> by mid-century and ` +
            `<strong>${
                formatPublicCount(
                    values.lateValue
                )
            }</strong> by late century.`,

            modelRangeText(
                values,
                "days",
                "days"
            )
        );
    },

    frost_free_season: indicator => {
        const values =
            getProjectionValues(indicator);

        return result(
            `The frost-free season lasted about ` +
            `<strong>${
                formatPublicCount(
                    values.historical
                )
            }</strong> during 1971–2000. ` +
            `It is projected to lengthen to about ` +
            `<strong>${
                formatPublicCount(
                    values.midValue
                )
            }</strong> by mid-century and ` +
            `<strong>${
                formatPublicCount(
                    values.lateValue
                )
            }</strong> by late century.`,

            modelRangeText(
                values,
                "days",
                "days"
            )
        );
    },

    first_fall_frost: indicator =>
        frostDateSentence(
            indicator,
            "The first fall frost"
        ),

    last_spring_frost: indicator =>
        frostDateSentence(
            indicator,
            "The last spring frost"
        ),

    "dlyfrzthw_tx0_tn-1": indicator => {
        const values =
            getProjectionValues(indicator);

        return result(
            `Historically, temperatures crossed above and below freezing ` +
            `on about ` +
            `<strong>${
                formatPublicCount(
                    values.historical
                )
            }</strong> each year. ` +
            `About ` +
            `<strong>${
                formatPublicCount(
                    values.midValue
                )
            }</strong> are projected by mid-century and ` +
            `<strong>${
                formatPublicCount(
                    values.lateValue
                )
            }</strong> by late century.`,

            modelRangeText(
                values,
                "days",
                "days"
            )
        );
    },

    pr1mm: indicator =>
        precipitationDaySentence(
            indicator,
            "1 mm",
            "measurable precipitation"
        ),

    pr10mm: indicator =>
        precipitationDaySentence(
            indicator,
            "10 mm",
            "heavy precipitation"
        ),

    pr20mm: indicator =>
        precipitationDaySentence(
            indicator,
            "20 mm",
            "very heavy precipitation"
        ),

    prtot: indicator => {
        const values =
            getProjectionValues(indicator);

        return result(
            `Annual precipitation averaged about ` +
            `<strong>${
                formatPublicNumber(
                    values.historical,
                    "mm"
                )
            }</strong> during 1971–2000. ` +
            `It is projected to increase to about ` +
            `<strong>${
                formatPublicNumber(
                    values.midValue,
                    "mm"
                )
            }</strong> by mid-century and ` +
            `<strong>${
                formatPublicNumber(
                    values.lateValue,
                    "mm"
                )
            }</strong> by late century.`,

            modelRangeText(
                values,
                "mm"
            )
        );
    },

    prx1day: indicator => {
        const values =
            getProjectionValues(indicator);

        return result(
            `The wettest day of the year historically brought about ` +
            `<strong>${
                formatPublicNumber(
                    values.historical,
                    "mm"
                )
            }</strong> of precipitation. ` +
            `The wettest day is projected to bring about ` +
            `<strong>${
                formatPublicNumber(
                    values.midValue,
                    "mm"
                )
            }</strong> by mid-century and ` +
            `<strong>${
                formatPublicNumber(
                    values.lateValue,
                    "mm"
                )
            }</strong> by late century.`,

            modelRangeText(
                values,
                "mm"
            )
        );
    },

    prx5day: indicator => {
        const values =
            getProjectionValues(indicator);

        return result(
            `The wettest five-day period historically produced about ` +
            `<strong>${
                formatPublicNumber(
                    values.historical,
                    "mm"
                )
            }</strong> of precipitation. ` +
            `This is projected to reach about ` +
            `<strong>${
                formatPublicNumber(
                    values.midValue,
                    "mm"
                )
            }</strong> by mid-century and ` +
            `<strong>${
                formatPublicNumber(
                    values.lateValue,
                    "mm"
                )
            }</strong> by late century.`,

            modelRangeText(
                values,
                "mm"
            )
        );
    },

    ratot: indicator => {
        const values =
            getProjectionValues(indicator);

        return result(
            `Annual rainfall averaged about ` +
            `<strong>${
                formatPublicNumber(
                    values.historical,
                    "mm"
                )
            }</strong> during 1971–2000. ` +
            `It is projected to reach about ` +
            `<strong>${
                formatPublicNumber(
                    values.midValue,
                    "mm"
                )
            }</strong> by mid-century and ` +
            `<strong>${
                formatPublicNumber(
                    values.lateValue,
                    "mm"
                )
            }</strong> by late century.`,

            modelRangeText(
                values,
                "mm"
            )
        );
    },

    rax1day: indicator => {
        const values =
            getProjectionValues(indicator);

        return result(
            `The heaviest rainfall day historically brought about ` +
            `<strong>${
                formatPublicNumber(
                    values.historical,
                    "mm"
                )
            }</strong> of rain. ` +
            `This is projected to increase to about ` +
            `<strong>${
                formatPublicNumber(
                    values.midValue,
                    "mm"
                )
            }</strong> by mid-century and ` +
            `<strong>${
                formatPublicNumber(
                    values.lateValue,
                    "mm"
                )
            }</strong> by late century.`,

            modelRangeText(
                values,
                "mm"
            )
        );
    },

    sn2mm: indicator =>
        precipitationDaySentence(
            indicator,
            "2 mm of water equivalent",
            "measurable snowfall"
        ),

    sn10mm: indicator =>
        precipitationDaySentence(
            indicator,
            "10 mm of water equivalent",
            "heavy snowfall"
        ),

    sntot: indicator => {
        const values =
            getProjectionValues(indicator);

        return result(
            `Annual snowfall was equivalent to about ` +
            `<strong>${
                formatPublicNumber(
                    values.historical,
                    "mm"
                )
            }</strong> of water during 1971–2000. ` +
            `It is projected to be about ` +
            `<strong>${
                formatPublicNumber(
                    values.midValue,
                    "mm"
                )
            }</strong> by mid-century and ` +
            `<strong>${
                formatPublicNumber(
                    values.lateValue,
                    "mm"
                )
            }</strong> by late century.`,

            modelRangeText(
                values,
                "mm"
            )
        );
    },

    snx1day: indicator => {
        const values =
            getProjectionValues(indicator);

        return result(
            `The largest one-day snowfall historically contained about ` +
            `<strong>${
                formatPublicNumber(
                    values.historical,
                    "mm"
                )
            }</strong> of water equivalent. ` +
            `This is projected to be about ` +
            `<strong>${
                formatPublicNumber(
                    values.midValue,
                    "mm"
                )
            }</strong> by mid-century and ` +
            `<strong>${
                formatPublicNumber(
                    values.lateValue,
                    "mm"
                )
            }</strong> by late century.`,

            modelRangeText(
                values,
                "mm"
            )
        );
    },

    cdd: indicator => {
        const values =
            getProjectionValues(indicator);

        return result(
            `The longest annual dry period lasted about ` +
            `<strong>${
                formatPublicCount(
                    values.historical
                )
            }</strong> during 1971–2000. ` +
            `It is projected to last about ` +
            `<strong>${
                formatPublicCount(
                    values.midValue
                )
            }</strong> by mid-century and ` +
            `<strong>${
                formatPublicCount(
                    values.lateValue
                )
            }</strong> by late century.`,

            modelRangeText(
                values,
                "days",
                "days"
            )
        );
    },

    nr_cdd: indicator => {
        const values =
            getProjectionValues(indicator);

        return result(
            `Historically, there were about ` +
            `<strong>${
                formatPublicCount(
                    values.historical,
                    "extended dry periods"
                )
            }</strong> each year. ` +
            `This is projected to change to about ` +
            `<strong>${
                formatPublicCount(
                    values.midValue,
                    "extended dry periods"
                )
            }</strong> by mid-century and ` +
            `<strong>${
                formatPublicCount(
                    values.lateValue,
                    "extended dry periods"
                )
            }</strong> by late century.`,

            modelRangeText(
                values,
                "periods",
                "extended dry periods"
            )
        );
    },

    gddgrow_0: indicator => {
        const values =
            getProjectionValues(indicator);

        return result(
            `The annual supply of warmth above 0°C was about ` +
            `<strong>${
                formatPublicNumber(
                    values.historical,
                    "degree-days"
                )
            }</strong> during 1971–2000. ` +
            `It is projected to increase to about ` +
            `<strong>${
                formatPublicNumber(
                    values.midValue,
                    "degree-days"
                )
            }</strong> by mid-century and ` +
            `<strong>${
                formatPublicNumber(
                    values.lateValue,
                    "degree-days"
                )
            }</strong> by late century.`,

            modelRangeText(
                values,
                "degree-days"
            )
        );
    },

    gddgrow_5: indicator => {
        const values =
            getProjectionValues(indicator);

        return result(
            `Growing conditions above 5°C provided about ` +
            `<strong>${
                formatPublicNumber(
                    values.historical,
                    "degree-days"
                )
            }</strong> of accumulated warmth during 1971–2000. ` +
            `This is projected to rise to about ` +
            `<strong>${
                formatPublicNumber(
                    values.midValue,
                    "degree-days"
                )
            }</strong> by mid-century and ` +
            `<strong>${
                formatPublicNumber(
                    values.lateValue,
                    "degree-days"
                )
            }</strong> by late century.`,

            modelRangeText(
                values,
                "degree-days"
            )
        );
    },

    hddheat_18: indicator => {
        const values =
            getProjectionValues(indicator);

        return result(
            `Heating demand was about ` +
            `<strong>${
                formatPublicNumber(
                    values.historical,
                    "degree-days"
                )
            }</strong> during 1971–2000. ` +
            `As the climate warms, this is projected to decline to about ` +
            `<strong>${
                formatPublicNumber(
                    values.midValue,
                    "degree-days"
                )
            }</strong> by mid-century and ` +
            `<strong>${
                formatPublicNumber(
                    values.lateValue,
                    "degree-days"
                )
            }</strong> by late century.`,

            modelRangeText(
                values,
                "degree-days"
            )
        );
    },

    cddcold_18: indicator => {
        const values =
            getProjectionValues(indicator);

        return result(
            `Cooling demand was about ` +
            `<strong>${
                formatPublicNumber(
                    values.historical,
                    "degree-days"
                )
            }</strong> during 1971–2000. ` +
            `Warmer summers are projected to raise this to about ` +
            `<strong>${
                formatPublicNumber(
                    values.midValue,
                    "degree-days"
                )
            }</strong> by mid-century and ` +
            `<strong>${
                formatPublicNumber(
                    values.lateValue,
                    "degree-days"
                )
            }</strong> by late century.`,

            modelRangeText(
                values,
                "degree-days"
            )
        );
    }
};


function buildPlainLanguageText(
    indicator
) {
    const builder =
        PLAIN_LANGUAGE_BUILDERS[
            indicator.id
        ];

    if (builder) {
        return builder(indicator);
    }

    const values =
        getProjectionValues(indicator);

    return result(
        `The historical value was ` +
        `<strong>${
            formatPublicNumber(
                values.historical,
                indicator.units
            )
        }</strong>. ` +
        `The projected value is about ` +
        `<strong>${
            formatPublicNumber(
                values.midValue,
                indicator.units
            )
        }</strong> by mid-century and ` +
        `<strong>${
            formatPublicNumber(
                values.lateValue,
                indicator.units
            )
        }</strong> by late century.`,

        modelRangeText(
            values,
            indicator.units
        )
    );
}


function renderPlainLanguage() {
    plainLanguageList.innerHTML = "";

    const filterText =
        state.plainLanguageFilterText
        || "";

    const indicators =
        state.locationData.indicators.filter(
            indicator => {
                const searchableText =
                    [
                        indicator.id,
                        indicator.name,
                        indicator.label,
                        indicator.definition,
                        indicator.units
                    ]
                    .join(" ")
                    .toLowerCase();

                return searchableText.includes(
                    filterText
                );
            }
        );

    indicators.forEach(
        indicator => {
            const item =
                document.createElement(
                    "article"
                );

            item.className =
                "plain-language-item";

            const heading =
                document.createElement(
                    "h3"
                );

            heading.textContent =
                PLAIN_LANGUAGE_TITLES[
                    indicator.id
                ]
                || indicator.name
                || indicator.label;

            const text =
                buildPlainLanguageText(
                    indicator
                );

            const mainParagraph =
                document.createElement(
                    "p"
                );

            mainParagraph.innerHTML =
                text.mainText;

            const rangeParagraph =
                document.createElement(
                    "p"
                );

            rangeParagraph.className =
                "plain-language-range";

            rangeParagraph.textContent =
                text.rangeText;

            item.appendChild(
                heading
            );

            item.appendChild(
                mainParagraph
            );

            item.appendChild(
                rangeParagraph
            );

            plainLanguageList.appendChild(
                item
            );
        }
    );

    plainLanguageNoResults.hidden =
        indicators.length !== 0;
}


function applyExpertMode() {
    state.expertMode =
        expertModeToggle.checked;

    expertModeStatus.textContent =
        state.expertMode
            ? "On"
            : "Off";

    tableSection.hidden =
        !state.expertMode;

    plainLanguageSection.hidden =
        state.expertMode;
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
                createIndicatorCell(
                    indicator
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
    renderPlainLanguage();
    applyExpertMode();
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


document.addEventListener(
    "click",
    event => {
        if (
            !event.target.closest(
                ".indicator-info-button"
            )
        ) {
            closeIndicatorTooltips();
        }
    }
);


document.addEventListener(
    "keydown",
    event => {
        if (event.key === "Escape") {
            closeIndicatorTooltips();
        }
    }
);


window.addEventListener(
    "resize",
    closeIndicatorTooltips
);


window.addEventListener(
    "scroll",
    closeIndicatorTooltips,
    true
);

expertModeToggle.addEventListener(
    "change",
    () => {
        applyExpertMode();
    }
);


plainLanguageFilter.addEventListener(
    "input",
    event => {
        state.plainLanguageFilterText =
            event.target.value
                .trim()
                .toLowerCase();

        renderPlainLanguage();
    }
);


initialize();
