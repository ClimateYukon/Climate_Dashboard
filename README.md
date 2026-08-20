# ClimateYukon static website

This repository is the deployable static ClimateYukon website published through GitHub Pages.

It contains static HTML, CSS, JavaScript, JSON, tables and image assets. It does not require a Python backend.

Main public areas:

- index.html: landing page
- indicator.html: ordinary indicator collection page
- plot.html: individual plot page
- climate-projections.html: climate projections application
- interactive/: standalone interactive tools
- state-of-climate/: State of Yukon Climate application
- assets/: shared root-site CSS and JavaScript
- data/: public registries and interactive data
- plots/: published plot collections

This Git repository is a deployment target. Build and scientific processing code are maintained in the separate climatepagev2 source workspace.

For local viewing from the repository root:

    python -m http.server 8080
