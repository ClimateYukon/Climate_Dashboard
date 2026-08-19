"use strict";

(() => {

    const ITEMS = [
        {
            id: "activity",
            label: "Wildfire activity",
            title: "Wildfire activity",
            subtitle: "Annual area burned and number of mapped fires.",
            image: "figures/wildfire/wildfire_history.png",
            alt: "Yukon annual area burned and number of mapped fires from 1960 to 2025.",
            note: "Government of Yukon mapped wildfire history, 1960–2025."
        },
        {
            id: "historical",
            label: "Historical fire weather",
            title: "Historical fire weather",
            subtitle: "Observed changes in fire-weather conditions at long-record Yukon stations.",
            image: "figures/wildfire/historical_fire_weather.png",
            alt: "Historical Yukon fire-weather indicators from WFM stations.",
            note: "Yukon Wildland Fire Management station observations, 1981–2025."
        },
        {
            id: "future",
            label: "Future fire weather",
            title: "Future fire weather",
            subtitle: "Projected changes in fuel dryness, high fire-weather days and fire-season length.",
            image: "figures/wildfire/future_fire_weather.png",
            alt: "Projected changes in Yukon fire-weather conditions.",
            note: "CanLEAD projections compared with 1971–2000."
        }
    ];


    let selectedId = "activity";


    // ========================================================
    // Helpers
    // ========================================================

    function byId(id) {
        return document.getElementById(id);
    }


    function wildfireCard() {
        return document.querySelector(
            '.theme-card[data-theme="Wildfire"]'
        );
    }


    function indicatorList() {

        return (
            document.querySelector(".indicator-list")
            || byId("indicator-list")
        );
    }


    function ancestors(element) {

        const result = [];

        let node = element;

        while (node) {
            result.push(node);
            node = node.parentElement;
        }

        return result;
    }


    function commonAncestor(first, second) {

        if (!first || !second) {
            return null;
        }

        const secondSet = new Set(
            ancestors(second)
        );

        return (
            ancestors(first)
            .find(
                node => secondSet.has(node)
            )
            || null
        );
    }


    function childBelow(ancestor, element) {

        if (!ancestor || !element) {
            return null;
        }

        let node = element;

        while (
            node.parentElement
            && node.parentElement !== ancestor
        ) {
            node = node.parentElement;
        }

        return node;
    }


    // ========================================================
    // Layout
    // ========================================================

    function findLayout() {

        const host = byId("view-content");
        const themeSelect = byId("theme-select");

        const common = commonAncestor(
            host,
            themeSelect
        );

        return {
            common,
            sidebar:
                childBelow(
                    common,
                    themeSelect
                ),
            content:
                childBelow(
                    common,
                    host
                )
        };
    }


    function enterExploreLayout() {

        const layout = findLayout();

        document.body.classList.add(
            "wf-theme-active",
            "wf-explore-active"
        );

        document
            .querySelectorAll(".wf-fullwidth-layout")
            .forEach(
                element =>
                    element.classList.remove(
                        "wf-fullwidth-layout"
                    )
            );

        document
            .querySelectorAll(".wf-hidden-sidebar")
            .forEach(
                element =>
                    element.classList.remove(
                        "wf-hidden-sidebar"
                    )
            );

        document
            .querySelectorAll(".wf-main-content")
            .forEach(
                element =>
                    element.classList.remove(
                        "wf-main-content"
                    )
            );

        if (layout.sidebar) {
            layout.sidebar.classList.add(
                "wf-explorer-sidebar"
            );
        }

        if (layout.content) {
            layout.content.classList.add(
                "wf-explorer-content"
            );
        }

        const select = byId("theme-select");

        if (select) {

            const option =
                Array.from(
                    select.options || []
                ).find(
                    item =>
                        item.value === "Wildfire"
                );

            if (option) {
                select.value = "Wildfire";
            }
        }

        mountExploreGlobalHeader();
    }


    function prepareStoryLayout() {

        removeExploreGlobalHeader();

        document.body.classList.remove(
            "wf-explore-active"
        );

        const layout = findLayout();

        if (
            layout.common
            && layout.sidebar
            && layout.content
            && layout.sidebar !== layout.content
        ) {

            layout.common.classList.add(
                "wf-fullwidth-layout"
            );

            layout.sidebar.classList.add(
                "wf-hidden-sidebar"
            );

            layout.content.classList.add(
                "wf-main-content"
            );
        }
    }


    // ========================================================
    // Persistent Wildfire mode header
    //
    // Story vs Explore graphs is a THEME-level choice.
    // It therefore stays in the same place in both modes.
    // ========================================================

    function exploreGlobalHeaderHtml() {

        return `
            <div
                id="wf-explore-global-header"
                class="wf-explore-global-header"
            >

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


                        <div
                            class="wf-mode-switch"
                            role="group"
                            aria-label="Wildfire view"
                        >

                            <button
                                type="button"
                                class="wf-mode-button"
                                data-wf-global-mode="story"
                            >
                                Story
                            </button>

                            <button
                                type="button"
                                class="wf-mode-button active"
                                data-wf-global-mode="graphs"
                                aria-pressed="true"
                            >
                                Explore graphs
                            </button>

                        </div>

                    </div>

                </header>

            </div>
        `;
    }


    function mountExploreGlobalHeader() {

        const layout =
            findLayout();

        if (
            !layout.common
        ) {
            return;
        }


        let header =
            document.getElementById(
                "wf-explore-global-header"
            );


        if (!header) {

            layout.common.insertAdjacentHTML(
                "afterbegin",
                exploreGlobalHeaderHtml()
            );

            header =
                document.getElementById(
                    "wf-explore-global-header"
                );
        }


        const storyButton =
            header.querySelector(
                '[data-wf-global-mode="story"]'
            );


        if (
            storyButton
            && !storyButton.dataset.bound
        ) {

            storyButton.dataset.bound =
                "true";


            storyButton.addEventListener(
                "click",
                () => {

                    removeExploreGlobalHeader();

                    prepareStoryLayout();


                    const card =
                        wildfireCard();


                    if (card) {
                        card.click();
                    }
                }
            );
        }
    }


    function removeExploreGlobalHeader() {

        const header =
            document.getElementById(
                "wf-explore-global-header"
            );


        if (header) {
            header.remove();
        }
    }


    // ========================================================
    // Existing dashboard header
    // ========================================================

    function updateHeader(item) {

        const theme = byId(
            "indicator-theme"
        );

        const title = byId(
            "indicator-title"
        );

        const subtitle = byId(
            "indicator-source-theme"
        );

        const status = byId(
            "indicator-status"
        );

        if (theme) {
            theme.textContent = "WILDFIRE";
        }

        if (title) {
            title.textContent = item.title;
        }

        if (subtitle) {
            subtitle.textContent =
                item.subtitle;
        }

        if (status) {

            status.textContent =
                "Available";

            status.className =
                "status-badge status-available";
        }
    }


    // ========================================================
    // Story / Explore tabs in normal dashboard header
    // ========================================================

    function renderModeTabs() {

        const tabs =
            byId(
                "view-tabs"
            );

        if (!tabs) {
            return;
        }

        // Story / Explore is controlled by the persistent
        // Wildfire header above the explorer.
        tabs.innerHTML = "";
    }


    // ========================================================
    // Sidebar
    // ========================================================

    function renderIndicatorList() {

        const list =
            indicatorList();

        if (!list) {

            console.error(
                "Wildfire explorer: indicator list not found."
            );

            return;
        }


        list.innerHTML =
            ITEMS.map(
                item => `
                    <button
                        type="button"
                        class="wf-indicator-item ${
                            item.id === selectedId
                                ? "active"
                                : ""
                        }"
                        data-wf-indicator="${item.id}"
                    >
                        ${item.label}
                    </button>
                `
            ).join("");


        list
            .querySelectorAll(
                "[data-wf-indicator]"
            )
            .forEach(
                button => {

                    button.addEventListener(
                        "click",
                        () => {

                            selectedId =
                                button.dataset.wfIndicator;

                            renderExplorer();
                        }
                    );
                }
            );
    }


    // ========================================================
    // Main graph
    // ========================================================

    function renderSelectedGraph(item) {

        const host =
            byId("view-content");

        if (!host) {
            return;
        }


        host.innerHTML = `
            <section class="wf-single-indicator">

                <figure>

                    <img
                        src="${item.image}"
                        alt="${item.alt}"
                    >

                    <figcaption>
                        ${item.note}
                    </figcaption>

                </figure>


                <div class="wf-explorer-help">

                    <strong>
                        Want the interpretation?
                    </strong>

                    Switch to
                    <button
                        type="button"
                        class="wf-inline-story-link"
                    >
                        Story
                    </button>
                    for the key findings, limitations
                    and technical details.

                </div>

            </section>
        `;


        const storyButton =
            host.querySelector(
                ".wf-inline-story-link"
            );


        if (storyButton) {

            storyButton.addEventListener(
                "click",
                () => {

                    prepareStoryLayout();

                    const card =
                        wildfireCard();

                    if (card) {
                        card.click();
                    }
                }
            );
        }
    }


    // ========================================================
    // Render explorer
    // ========================================================

    function renderExplorer() {

        enterExploreLayout();

        const item =
            ITEMS.find(
                candidate =>
                    candidate.id === selectedId
            )
            || ITEMS[0];


        updateHeader(item);

        renderModeTabs();

        renderIndicatorList();

        renderSelectedGraph(item);


        document
            .querySelectorAll(".theme-card")
            .forEach(
                card => {

                    card.classList.toggle(
                        "active",
                        card.dataset.theme
                        === "Wildfire"
                    );
                }
            );


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
            "graphs"
        );

        params.set(
            "indicator",
            item.id
        );


        history.replaceState(
            null,
            "",
            (
                window.location.pathname
                + "?"
                + params.toString()
            )
        );
    }


    // ========================================================
    // Intercept Explore graphs in the Story view
    //
    // story-mode.js attaches its button handler directly to
    // the button. This capture listener runs first.
    // ========================================================

    document.addEventListener(
        "click",
        event => {

            const modeButton =
                event.target.closest(
                    '[data-wf-mode="graphs"]'
                );


            if (modeButton) {

                event.preventDefault();

                event.stopPropagation();

                event.stopImmediatePropagation();

                renderExplorer();

                return;
            }


            const card =
                event.target.closest(
                    ".theme-card"
                );


            if (
                card
                && card.dataset.theme !== "Wildfire"
            ) {

                removeExploreGlobalHeader();

                document.body.classList.remove(
                    "wf-explore-active"
                );
            }

        },
        true
    );


    // ========================================================
    // Direct URL
    // ========================================================

    function initializeFromUrl() {

        const params =
            new URLSearchParams(
                window.location.search
            );


        if (
            (
                params.get("theme")
                || ""
            ).toLowerCase()
            !== "wildfire"
        ) {

            return;
        }


        if (
            params.get("mode")
            !== "graphs"
        ) {

            return;
        }


        const requested =
            params.get(
                "indicator"
            );


        if (
            ITEMS.some(
                item =>
                    item.id === requested
            )
        ) {

            selectedId =
                requested;
        }


        window.setTimeout(
            renderExplorer,
            150
        );
    }


    if (
        document.readyState
        === "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            initializeFromUrl
        );

    } else {

        initializeFromUrl();
    }

})();
