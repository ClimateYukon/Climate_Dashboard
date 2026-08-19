"use strict";

(() => {

    const THEME = "Wildfire";

    const STORY_URL =
        "data/wildfire/story.html";

    let storyHtml = null;

    let wildfireActive = false;

    let currentMode = "story";

    let shellState = null;


    // ========================================================
    // Basic helpers
    // ========================================================

    function byId(id) {

        return document.getElementById(
            id
        );
    }


    function getViewHost() {

        return byId(
            "view-content"
        );
    }


    function getWildfireCard() {

        return document.querySelector(
            '.theme-card[data-theme="Wildfire"]'
        );
    }


    // ========================================================
    // Find the layout branches containing:
    //
    //   LEFT:  Theme selector + indicator list
    //   RIGHT: indicator content / #view-content
    //
    // This avoids depending on a particular class name.
    // ========================================================

    function ancestors(element) {

        const result = [];

        let node = element;

        while (node) {

            result.push(
                node
            );

            node =
                node.parentElement;
        }

        return result;
    }


    function commonAncestor(
        first,
        second
    ) {

        if (
            !first
            || !second
        ) {

            return null;
        }

        const secondAncestors =
            new Set(
                ancestors(
                    second
                )
            );

        for (
            const node
            of ancestors(
                first
            )
        ) {

            if (
                secondAncestors.has(
                    node
                )
            ) {

                return node;
            }
        }

        return null;
    }


    function childBelow(
        ancestor,
        element
    ) {

        if (
            !ancestor
            || !element
        ) {

            return null;
        }

        let node = element;

        while (
            node.parentElement
            && node.parentElement
            !== ancestor
        ) {

            node =
                node.parentElement;
        }

        return node;
    }


    // ========================================================
    // Enter full-width Wildfire layout
    // ========================================================

    function enterWildfireShell() {

        if (
            shellState
        ) {

            return;
        }

        const host =
            getViewHost();

        const themeSelect =
            byId(
                "theme-select"
            );

        const common =
            commonAncestor(
                host,
                themeSelect
            );

        const sidebarBranch =
            childBelow(
                common,
                themeSelect
            );

        const contentBranch =
            childBelow(
                common,
                host
            );


        shellState = {
            common,
            sidebarBranch,
            contentBranch
        };


        document.body.classList.add(
            "wf-theme-active"
        );


        if (
            common
            && sidebarBranch
            && contentBranch
            && sidebarBranch
            !== contentBranch
        ) {

            common.classList.add(
                "wf-fullwidth-layout"
            );

            sidebarBranch.classList.add(
                "wf-hidden-sidebar"
            );

            contentBranch.classList.add(
                "wf-main-content"
            );
        }


        // Update dropdown state even though the sidebar
        // is hidden in Wildfire mode.

        if (
            themeSelect
        ) {

            const wildfireOption =
                Array.from(
                    themeSelect.options
                    || []
                ).find(
                    option =>
                        option.value
                        === THEME
                );

            if (
                wildfireOption
            ) {

                themeSelect.value =
                    THEME;
            }
        }
    }


    // ========================================================
    // Restore normal dashboard for another theme
    // ========================================================

    function leaveWildfireShell() {

        document.body.classList.remove(
            "wf-theme-active"
        );

        if (
            shellState
        ) {

            if (
                shellState.common
            ) {

                shellState
                    .common
                    .classList
                    .remove(
                        "wf-fullwidth-layout"
                    );
            }

            if (
                shellState.sidebarBranch
            ) {

                shellState
                    .sidebarBranch
                    .classList
                    .remove(
                        "wf-hidden-sidebar"
                    );
            }

            if (
                shellState.contentBranch
            ) {

                shellState
                    .contentBranch
                    .classList
                    .remove(
                        "wf-main-content"
                    );
            }
        }

        shellState = null;
    }


    // ========================================================
    // Theme card
    // ========================================================

    function decorateWildfireCard() {

        const card =
            getWildfireCard();

        if (
            !card
        ) {

            return false;
        }

        card.classList.add(
            "wf-theme-ready"
        );


        const count =
            card.querySelector(
                ".theme-card-count"
            );

        if (
            count
        ) {

            count.textContent =
                "Story + graphs";
        }


        const status =
            card.querySelector(
                ".theme-card-available"
            );

        if (
            status
        ) {

            status.textContent =
                "Available";

            status.classList.remove(
                "theme-card-under-analysis"
            );
        }

        return true;
    }


    function markWildfireActive() {

        document
            .querySelectorAll(
                ".theme-card"
            )
            .forEach(
                card => {

                    card.classList.toggle(
                        "active",
                        card.dataset.theme
                        === THEME
                    );
                }
            );
    }


    // ========================================================
    // Story / Explore switch
    // ========================================================

    function modeSwitchHtml() {

        return `
            <div
                class="wf-mode-switch"
                role="group"
                aria-label="Wildfire view"
            >

                <button
                    type="button"
                    class="wf-mode-button ${
                        currentMode
                        === "story"
                            ? "active"
                            : ""
                    }"
                    data-wf-mode="story"
                    aria-pressed="${
                        currentMode
                        === "story"
                            ? "true"
                            : "false"
                    }"
                >
                    Story
                </button>

                <button
                    type="button"
                    class="wf-mode-button ${
                        currentMode
                        === "graphs"
                            ? "active"
                            : ""
                    }"
                    data-wf-mode="graphs"
                    aria-pressed="${
                        currentMode
                        === "graphs"
                            ? "true"
                            : "false"
                    }"
                >
                    Explore graphs
                </button>

            </div>
        `;
    }


    function wildfireHeaderHtml() {

        return `
            <header class="wf-theme-header">

                <div class="wf-theme-heading-row">

                    <div>

                        <h1>
                            Wildfire
                        </h1>

                        <p>
                            Fire activity and the weather
                            conditions that support it.
                        </p>

                    </div>

                    ${modeSwitchHtml()}

                </div>

            </header>
        `;
    }


    function bindModeSwitch() {

        document
            .querySelectorAll(
                "[data-wf-mode]"
            )
            .forEach(
                button => {

                    button.addEventListener(
                        "click",
                        () => {

                            showWildfire(
                                button.dataset.wfMode
                            );
                        }
                    );
                }
            );
    }


    // ========================================================
    // Story
    // ========================================================

    async function loadStory() {

        if (
            storyHtml !== null
        ) {

            return storyHtml;
        }


        const response =
            await fetch(
                STORY_URL,
                {
                    cache:
                        "no-cache"
                }
            );


        if (
            !response.ok
        ) {

            throw new Error(
                (
                    "Could not load "
                    + STORY_URL
                    + ": HTTP "
                    + response.status
                )
            );
        }


        storyHtml =
            await response.text();

        return storyHtml;
    }


    function jumpNavigationHtml() {

        return `
            <nav
                class="wf-jump-nav"
                aria-label="Wildfire story sections"
            >

                <a href="#wf-overview">
                    Overview
                </a>

                <a href="#wf-fire-activity">
                    Fire activity
                </a>

                <a href="#wf-fire-weather">
                    Fire weather
                </a>

                <a href="#wf-future">
                    Future
                </a>

            </nav>
        `;
    }


    async function storyContentHtml() {

        const story =
            await loadStory();

        return `
            <div class="wf-story-root">

                ${jumpNavigationHtml()}

                ${story}

            </div>
        `;
    }


    // ========================================================
    // Explore graphs
    // ========================================================

    function graphPanel(
        kicker,
        title,
        period,
        image,
        alt
    ) {

        return `
            <section class="wf-graph-panel">

                <div class="wf-graph-heading">

                    <div>

                        <div class="wf-graph-kicker">
                            ${kicker}
                        </div>

                        <h2>
                            ${title}
                        </h2>

                    </div>

                    <span>
                        ${period}
                    </span>

                </div>

                <img
                    src="${image}"
                    alt="${alt}"
                >

            </section>
        `;
    }


    function exploreContentHtml() {

        return `
            <div class="wf-explore-root">

                <div class="wf-explore-intro">

                    <h2>
                        Explore the Wildfire graphs
                    </h2>

                    <p>
                        View the main wildfire indicators
                        directly. Switch to Story for the
                        interpretation, limitations and
                        detailed methods.
                    </p>

                </div>


                ${graphPanel(
                    "Observed wildfire activity",
                    "Area burned and mapped fires",
                    "1960–2025",
                    "figures/wildfire/wildfire_history.png",
                    "Yukon annual area burned and mapped fires"
                )}


                ${graphPanel(
                    "Historical fire weather",
                    "Observed fire-weather conditions",
                    "1981–2025",
                    "figures/wildfire/historical_fire_weather.png",
                    "Historical Yukon fire-weather indicators"
                )}


                ${graphPanel(
                    "Future fire weather",
                    "Projected changes in fire weather",
                    "CanLEAD",
                    "figures/wildfire/future_fire_weather.png",
                    "Projected changes in Yukon fire weather"
                )}


                <details class="wf-supporting-graphs">

                    <summary>
                        Supporting and technical graphs
                    </summary>

                    <div class="wf-supporting-grid">

                        <article>

                            <h3>
                                WFM station coverage
                            </h3>

                            <img
                                src="figures/wildfire/wfm_fixed_panel_coverage.png"
                                alt="Years of usable observations at long-record WFM stations"
                                loading="lazy"
                            >

                        </article>


                        <article>

                            <h3>
                                Other historical fire-weather datasets explored
                            </h3>

                            <img
                                src="figures/wildfire/wfm_vs_era5_validation.png"
                                alt="Comparison of WFM observations and ERA5-derived historical fire-weather datasets"
                                loading="lazy"
                            >

                        </article>

                    </div>

                </details>


                <div class="wf-data-links">

                    <strong>
                        Data:
                    </strong>

                    <a href="data/wildfire/summary.json">
                        Summary
                    </a>

                    <a href="data/wildfire/wfm_fixed_panel_stations.csv">
                        WFM station panel
                    </a>

                    <a href="data/wildfire/era5_validation_summary.csv">
                        Historical dataset comparison
                    </a>

                </div>

            </div>
        `;
    }


    // ========================================================
    // URL
    // ========================================================

    function updateUrl() {

        const params =
            new URLSearchParams(
                window.location.search
            );

        params.set(
            "theme",
            "wildfire"
        );

        params.set(
            "mode",
            currentMode
        );


        history.replaceState(
            null,
            "",
            (
                window.location.pathname
                + "?"
                + params.toString()
                + window.location.hash
            )
        );
    }


    // ========================================================
    // Main Wildfire renderer
    // ========================================================

    async function showWildfire(
        mode = "story"
    ) {

        const host =
            getViewHost();


        if (
            !host
        ) {

            console.error(
                "Wildfire: #view-content not found."
            );

            return;
        }


        wildfireActive =
            true;

        currentMode =
            mode === "graphs"
                ? "graphs"
                : "story";


        enterWildfireShell();

        decorateWildfireCard();

        markWildfireActive();


        host.innerHTML = `
            <div class="wf-shell">

                ${wildfireHeaderHtml()}

                <div class="wf-loading">
                    Loading Wildfire…
                </div>

            </div>
        `;


        bindModeSwitch();


        try {

            const content =
                currentMode === "story"
                    ? await storyContentHtml()
                    : exploreContentHtml();


            host.innerHTML = `
                <div class="wf-shell">

                    ${wildfireHeaderHtml()}

                    ${content}

                </div>
            `;


            bindModeSwitch();

            updateUrl();

        } catch (
            error
        ) {

            console.error(
                error
            );


            host.innerHTML = `
                <div class="wf-shell">

                    ${wildfireHeaderHtml()}

                    <div class="wf-error">

                        The Wildfire view could not be loaded.

                        <small>
                            ${String(
                                error
                            )}
                        </small>

                    </div>

                </div>
            `;


            bindModeSwitch();
        }
    }


    // ========================================================
    // Deactivate before another theme takes control
    // ========================================================

    function deactivateWildfire() {

        if (
            !wildfireActive
        ) {

            return;
        }


        wildfireActive =
            false;

        leaveWildfireShell();


        const params =
            new URLSearchParams(
                window.location.search
            );


        params.delete(
            "mode"
        );


        if (
            (
                params.get(
                    "theme"
                )
                || ""
            ).toLowerCase()
            === "wildfire"
        ) {

            params.delete(
                "theme"
            );
        }


        const query =
            params.toString();


        history.replaceState(
            null,
            "",
            (
                window.location.pathname
                + (
                    query
                        ? "?"
                        + query
                        : ""
                )
                + window.location.hash
            )
        );
    }


    // ========================================================
    // Theme-card click handling
    // ========================================================

    document.addEventListener(
        "click",
        event => {

            const card =
                event.target.closest(
                    ".theme-card"
                );


            if (
                !card
            ) {

                return;
            }


            if (
                card.dataset.theme
                === THEME
            ) {

                event.preventDefault();

                event.stopPropagation();

                event.stopImmediatePropagation();


                showWildfire(
                    "story"
                );

                return;
            }


            deactivateWildfire();

        },
        true
    );


    // ========================================================
    // Theme dropdown
    // ========================================================

    document.addEventListener(
        "change",
        event => {

            const target =
                event.target;


            if (
                !target
                || target.id
                !== "theme-select"
            ) {

                return;
            }


            if (
                target.value
                === THEME
            ) {

                event.preventDefault();

                event.stopPropagation();

                event.stopImmediatePropagation();


                showWildfire(
                    "story"
                );

                return;
            }


            deactivateWildfire();

        },
        true
    );


    // ========================================================
    // One-time startup
    // ========================================================

    function initialize() {

        let attempts = 0;


        const timer =
            window.setInterval(
                () => {

                    attempts += 1;


                    const ready =
                        decorateWildfireCard();


                    if (
                        ready
                        || attempts >= 40
                    ) {

                        window.clearInterval(
                            timer
                        );


                        const params =
                            new URLSearchParams(
                                window.location.search
                            );


                        if (
                            (
                                params.get(
                                    "theme"
                                )
                                || ""
                            ).toLowerCase()
                            === "wildfire"
                        ) {

                            showWildfire(
                                params.get(
                                    "mode"
                                )
                                === "graphs"
                                    ? "graphs"
                                    : "story"
                            );
                        }
                    }

                },
                100
            );
    }


    if (
        document.readyState
        === "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            initialize
        );

    } else {

        initialize();
    }

})();
