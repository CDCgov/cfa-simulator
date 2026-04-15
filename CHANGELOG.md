# Changelog

All notable changes to this project are documented here. Generated from conventional commits.

## [0.3.4] - 2026-04-15

### Bug Fixes

- **cfasim-ui:** Ship vite plugins as .js so Node can load them

### Chores

- **deps:** Bump rand in /models/src/reed-frost/model
- **cfasim:** Ignore target/ in rust template
- Add git-cliff changelog generation to release flow

### Features

- **charts:** Add tooltipClamp option for tooltip flip/clamp boundary

## [0.3.3] - 2026-04-14

### Features

- **LineChart:** Add areaSections for labeled area highlights
- **LineChart:** Add dashed, strokeWidth, and full-height mode to areaSections
- **docs:** Show h3 headings in page outline
- **LineChart:** Add inline legend for series and area sections
- **cfasim:** Auto-version template deps and add theme/all meta export

## [0.3.2] - 2026-04-09

### Bug Fixes

- **NumberInput:** Strip invalid characters on commit

### Chores

- **deps:** Bump vite from 5.4.21 to 8.0.6

### Features

- **theme:** Add unified @cfasim-ui/theme/all entry for components and charts styles
- **components:** Add hideLabel prop for screen-reader-only labels

## [0.3.1] - 2026-04-07

### Bug Fixes

- Add missing us-atlas dep to models

### Chores

- **deps-dev:** Bump vite from 8.0.1 to 8.0.5

### Features

- **charts:** Custom CSV, filename, and download link for LineChart and DataTable

## [0.3.0] - 2026-04-05

### Bug Fixes

- Make ChoroplethMap topology a user-provided prop

### Features

- Add bundle size check for cfasim-ui packages

## [0.2.3] - 2026-04-04

### Bug Fixes

- Add json import attributes to us-atlas imports

## [0.2.2] - 2026-04-04

### Bug Fixes

- Load component CSS in docs site and fix style.css export paths

## [0.2.1] - 2026-04-04

### Bug Fixes

- Remove development export condition from published packages

### Features

- Add lineOpacity and dotOpacity to series config

## [0.2.0] - 2026-04-04

### Bug Fixes

- Prevent scrollbar shift when opening chart menu
- Cache NSSP data download in CI (once per day)

### Features

- Add dots and line visibility options to LineChart series
- Replace fetch example with NSSP ED choropleth map
- Add ChartTooltip component with LineChart integration
- Add tooltip to ChoroplethMap, optimize map interactions

## [0.1.10] - 2026-04-04

### Bug Fixes

- Build components and charts as libraries to fix barrel imports

### Chores

- Use setup-plz action for plz

## [0.1.9] - 2026-04-03

### Bug Fixes

- Prevent concurrent loadModule race in pyodide and wasm workers

### Chores

- Fix Cargo.lock not getting updated

## [0.1.8] - 2026-04-02

### Bug Fixes

- Point docs link to the correct link

### Chores

- Move docs to /docs
- **deps-dev:** Bump happy-dom from 20.8.8 to 20.8.9 (#2)
- Hoist vite
- Add vue dependencies to demos
- Update versio script with correct rust paths

### Documentation

- Add a SidebarLayout demo and docs page (#3)

### Features

- More examples to a single models site
- Add optional xGrid and yGrid props to LineChart
- **NumberInput:** Add numberType prop for integer and float modes

### Refactor

- Adopt SidebarLayout with tabs for models app

## [0.1.7] - 2026-03-27

### Chores

- Update pyodide command

## [0.1.6] - 2026-03-27

### Chores

- Add metadata to pyproject
- Release script should update python

### Refactor

- Use pypiDeps to prebuild dependencies

## [0.1.4] - 2026-03-26

### Features

- Added @cfasim-ui/cfasim-ui and new docs
- Add commas to number input

## [0.1.3] - 2026-03-25

### Features

- Add choroplethmap
- Add county data to choropleth
- Added panning and zooming to map
- Add hsa to choroplethmap

## [0.1.2] - 2026-03-23

### Features

- Added cfasim-ui components with docs
- Added cli with new command and docs
- Add ModelOutput feature
- Add DataTable component
- Topbar, LightDarkToggle, ChartMenu

### Refactor

- **cfasim-ui:** Move components and charts into individual folders

### Tests

- Added playwright e2e tests for components
