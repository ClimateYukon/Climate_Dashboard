"use strict";

(() => {

    let viewer = null;
    let viewerImage = null;


    // ========================================================
    // Build viewer once
    // ========================================================

    function ensureViewer() {

        if (viewer) {
            return;
        }


        viewer =
            document.createElement(
                "div"
            );

        viewer.className =
            "wf-figure-viewer";

        viewer.hidden =
            true;


        viewer.innerHTML = `
            <div class="wf-figure-viewer-inner">

                <img
                    alt=""
                >

                <button
                    type="button"
                    class="wf-figure-viewer-close"
                    aria-label="Close enlarged figure"
                >
                    ×
                </button>

            </div>
        `;


        document.body.appendChild(
            viewer
        );


        viewerImage =
            viewer.querySelector(
                "img"
            );


        const closeButton =
            viewer.querySelector(
                ".wf-figure-viewer-close"
            );


        closeButton.addEventListener(
            "click",
            closeViewer
        );


        viewer.addEventListener(
            "click",
            event => {

                if (
                    event.target
                    === viewer
                    ||
                    event.target.classList.contains(
                        "wf-figure-viewer-inner"
                    )
                ) {

                    closeViewer();
                }
            }
        );
    }


    // ========================================================
    // Open
    // ========================================================

    function openViewer(
        image
    ) {

        ensureViewer();


        viewerImage.src =
            image.currentSrc
            || image.src;

        viewerImage.alt =
            image.alt
            || "Enlarged wildfire figure";


        viewer.hidden =
            false;


        document.body.style.overflow =
            "hidden";
    }


    // ========================================================
    // Close
    // ========================================================

    function closeViewer() {

        if (!viewer) {
            return;
        }


        viewer.hidden =
            true;

        viewerImage.removeAttribute(
            "src"
        );


        document.body.style.overflow =
            "";
    }


    // ========================================================
    // Main Wildfire story figures only
    // ========================================================

    document.addEventListener(
        "click",
        event => {

            const image =
                event.target.closest(
                    ".wf-story-root .story > .figure img"
                );


            if (!image) {
                return;
            }


            event.preventDefault();

            openViewer(
                image
            );

        },
        true
    );


    // ========================================================
    // Keyboard
    // ========================================================

    document.addEventListener(
        "keydown",
        event => {

            if (
                event.key === "Escape"
                && viewer
                && !viewer.hidden
            ) {

                closeViewer();
            }
        }
    );

})();
