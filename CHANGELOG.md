# Changelog

All notable changes to this project are documented here. Generated from conventional commits.
## [0.8.3] - 2026-07-23

### Bug Fixes

- **charts:** Support switching ChoroplethMap renderer at runtime
- **charts:** Suppress ChoroplethMap hover tooltips while a window resize settles

### Features

- **charts:** Add pre-merged us-hsa-topology export with a ChoroplethMap fast path

### Refactor

- **cfasim-ui:** Dedupe shared chart computeds, axis labels, and combobox sizing

## [0.8.2] - 2026-07-22

### Bug Fixes

- **charts:** Stop repainting every ChoroplethMap feature twice on mount
- **charts:** Repaint ChoroplethMap features only when their paint inputs actually change

## [0.8.1] - 2026-07-20

### Bug Fixes

- **cli:** Resolve local cfasim-model in e2e so releases aren't blocked by unpublished versions
- **charts:** Stop bolding capital city labels on ChoroplethMap

### Features

- **charts:** Mix geographic levels on one ChoroplethMap via data[].geoType

## [0.8.0] - 2026-07-19

### Bug Fixes

- Keep cfasim docs non-interactive for sandboxed use
- Skip update check when run via uvx
- Pin consumer pnpm version in docs e2e for corepack

### Chores

- **deps:** Upgrade dependencies and pin all versions exactly

### Features

- Bundle docs and source in ui packages, deprecate @cfasim-ui/docs
- **charts:** Add ChoroplethMap theme API with exterior outline support
- **charts:** Add marker theme keys and fix city marker styling

## [0.7.8] - 2026-07-09

### Performance

- **charts:** Cache canvas base render for smooth hover and resize

## [0.7.7] - 2026-07-07

### Bug Fixes

- **charts:** Default tooltip clamp to window and fix flipped tooltip overlap

### Features

- **charts:** Extend tightFit to national county and HSA maps
- **charts:** Add city markers overlay to ChoroplethMap
- **charts:** Add support for legend in areas

## [0.7.6] - 2026-07-05

### Bug Fixes

- **charts:** Choropleth tooltip flip/clamp on move + guard non-cancelable touchend

### Features

- **charts:** TightFit prop for ChoroplethMap to crop Alaska overhang

## [0.7.5] - 2026-07-05

### Bug Fixes

- **charts:** Release the slow-renderer fallback after fast draws
- **charts:** Resize the canvas backing store on devicePixelRatio changes

### Features

- **charts:** Canvas rendering mode for ChoroplethMap

### Performance

- **charts:** Direct canvas rendering with adaptive slow-device fallback

## [0.7.4] - 2026-07-04

### Bug Fixes

- **charts:** Register tap listeners before d3-zoom's
- **charts:** Mobile tap speed and tooltip placement under page pinch-zoom

## [0.7.3] - 2026-07-04

### Bug Fixes

- **charts:** Keep clicks and tooltips working once map zoom is active

## [0.7.2] - 2026-07-04

### Bug Fixes

- **charts:** Zoom hint halo and in-flow placement on narrow maps
- **charts:** Keep mobile fullscreen on-screen when the page is pinch-zoomed

### Features

- **charts:** Activate map pan/zoom on first zoom only
- **charts:** Taps trigger hover highlight, tooltip, and stateHover on touch

## [0.7.1] - 2026-07-04

### Features

- **charts:** Themed focus highlight color and per-item stroke/strokeWidth

## [0.7.0] - 2026-07-04

### Bug Fixes

- **charts:** Skip drawing HSA maps until the lazy module resolves
- **charts:** Align continuous-legend title with the gradient bar

### Documentation

- **charts:** Use in-place tap zoom in single-state and click-to-focus map demos

### Features

- **charts:** Rework ChoroplethMap pan/zoom into activate-to-zoom paradigm
- **charts:** Make ChoroplethMap zoom opt-in

### Performance

- **charts:** Fix ChoroplethMap pan/zoom jank in Safari

### Refactor

- Dedupe shared helpers, dead code, and template copies across ui, cli, and models
- Derive docs sidebar/registration from one component list, extract CI setup actions, share form-field internals

## [0.6.4] - 2026-07-01

### Bug Fixes

- **charts:** Put role/ariaLabel on the chart svg as role="img"

## [0.6.3] - 2026-07-01

### Bug Fixes

- **charts:** Connect annotations to the near edge of multi-line text
- **SidebarLayout:** Make hidden sidebar and expand button inert

### Features

- **charts:** Add role and ariaLabel props for screen-reader chart descriptions

## [0.6.2] - 2026-06-30

### Bug Fixes

- **charts:** Render island territories in single-state map
- **charts:** Reset pan/zoom when the state prop changes

### Features

- **charts:** Add single-state mode to ChoroplethMap
- **models:** Add state-level map example
- **charts:** Add focusZoom prop and rework the state-map demo as a drill-down
- **charts:** Add twoFingerPan option for two-finger pan/zoom on touch
- **models:** Enable pan/zoom on the national map, remove menu and title

## [0.6.1] - 2026-06-29

## [0.6.0] - 2026-06-24

### Bug Fixes

- **cfasim-ui:** Make chart fullscreen resilient to consumer CSS, add close button
- **cfasim-ui:** Let vertical swipes scroll over chart tooltips on touch
- **cfasim-ui:** Emit stateClick from touch taps on ChoroplethMap

### Chores

- **deps:** Bump tar from 0.4.45 to 0.4.46
- Raise components bundle size limits

### Features

- **cfasim-ui:** Add fontSize prop to ParamEditor
- Add outline options
- **cfasim-ui:** Add MultiSelect autocomplete component
- **cfasim-ui:** Add ButtonGroup and ToggleGroup components

## [0.5.1] - 2026-06-02

### Bug Fixes

- **cfasim-ui:** Pin rootDir so dts emits to dist root + add pre-push types check

### Tests

- **cfasim:** Link local cfasim-ui packages in init e2e instead of npm

## [0.5.0] - 2026-06-02

### Bug Fixes

- **ParamEditor:** Don't clobber uncommitted edits on parent re-render
- **cfasim:** Use engines.pnpm instead of devEngines range in template

### Chores

- Support pnpm 10 and 11, update dependencies

### Features

- Add wrap option for data table
- **Icon:** Render icons as tree-shakeable inline SVGs, drop webfont
- **Icon:** Expand default icon set, add github logo, grid docs
- **BarChart:** Add value-on-bar labels, column headers, and category alignment

### Tests

- **models:** Simplify ixa-example editor toggle test, drop keyboard interaction
- **size:** Raise components JS limit to 14 KB

## [0.4.16] - 2026-05-28

### Documentation

- **DataTable:** Add Custom CSV download example

### Features

- **charts:** Add downloadButton + DataTable downloadLink

## [0.4.15] - 2026-05-28

### Features

- **charts:** Add BarChart overlay layout and per-series blendMode
- **BarChart:** Add summaryLines overlay with own value extent

## [0.4.14] - 2026-05-28

### Features

- **BarChart:** Thin crowded non-date categorical labels

## [0.4.13] - 2026-05-26

### Features

- **useUrlParams:** Add per-path codecs for variant-shaped fields

## [0.4.12] - 2026-05-26

### Bug Fixes

- **charts:** BarChart tooltip honors dateFormat for date categories
- **docs:** Preserve subpath aliases, prune orphan generated pages

### Features

- **charts:** Multi-line titles with titleStyle (align, size, color, weight)
- **charts:** Style props for axis labels, ticks, legend, area sections, annotations
- **charts:** Date axis for LineChart and BarChart
- **useUrlParams:** Encode nested params as dotted URL keys

### Refactor

- **annotations:** Rename halo to outline, extend to pointer/rule/arrow
- **ixa-example:** Rename random_person to next_contact, trim comments
- **charts:** Lazy-load HSA mapping to shrink bundle

## [0.4.11] - 2026-05-22

### Chores

- **fetch_nssp_ed:** Trim demo data to last ~3 months

### Documentation

- **charts:** Add legend-wrapping example to LineChart docs

### Features

- **charts:** Add Expand menu item for full-window chart view
- **charts:** Add per-series showInTooltip and showInLegend flags
- **charts:** Wrap inline legend across multiple rows when items overflow
- **charts:** Add page-colored outline option to LineChart series

## [0.4.10] - 2026-05-21

### Bug Fixes

- **workers:** Surface load failures instead of hanging silently
- **workers:** Import postWithTransfer from /transfer subpath

## [0.4.9] - 2026-05-21

### Bug Fixes

- **ixa-example:** Silence dead_code warning on test-only trait method
- **shared:** Move @types/sprintf-js to dependencies

### Documentation

- **LineChart:** Add confidence band example for areas prop

## [0.4.8] - 2026-05-21

### Chores

- **deps:** Bump brace-expansion from 2.0.2 to 5.0.5

### Features

- **charts:** Add log scale to LineChart and BarChart
- **rust template:** Wire up console_error_panic_hook
- **charts:** Add NumberFormat utility and broaden formatter props
- **NumberInput:** Add NumberFormat-based format prop, deprecate sliderDisplay

### Tests

- **models:** Wait for editor content before Ctrl+S

## [0.4.7] - 2026-05-16

### Bug Fixes

- **release:** Refresh ixa-example Cargo.lock on version bump
- **charts:** Inline color/font and resolve var() in SVG/PNG export
- **charts:** Render annotation arrow inline; drop curve start nudge

## [0.4.6] - 2026-05-16

### Bug Fixes

- **SidebarLayout:** Sync active tab from route on initial load

### Chores

- **cfasim:** Refresh embedded workspace-Cargo.toml

### Features

- Add ixa template and ixa model example
- **ixa:** Progressive batching with cancellation
- **ParamEditor:** Add lazy JSON/TOML/YAML editor and ixa-example toggle (#59)
- **charts:** Annotations and shared common props/composable
- **charts:** Pin inline legend to top, annotate peak in ixa-example
- **charts:** Add rule pointers to annotations

### Refactor

- **ixa:** Pass simulate args as a JSON struct

### Tests

- **cfasim:** Pre-build wasm in init.spec to avoid dev-server timeout

## [0.4.5] - 2026-05-14

### Features

- **scaffold:** Preconnect to jsdelivr in Pyodide template
- **ChoroplethMap:** Animate Reset, preserve zoom on unfocus
- **ChoroplethMap:** DataGeoType + multi-feature focus with overlay layer

## [0.4.4] - 2026-05-14

### Bug Fixes

- **pyodide:** Clear stale wheels before each build

### Features

- **docs:** Hot-reload library source edits in vitepress dev

## [0.4.3] - 2026-05-13

### Bug Fixes

- **docs:** Force light color-scheme when VitePress is in light mode
- **charts:** Externalize d3-transition (drops ~10 KB gzip)

### Documentation

- Shorten dense map description

### Features

- **charts:** Add focus state to ChoroplethMap

## [0.4.2] - 2026-05-13

### Bug Fixes

- **charts:** Stop ChoroplethMap tooltip jumping between hover targets

### Chores

- Bump charts CSS bundle size limit to 10 KB

### Features

- **charts:** Tooltip slot for ChoroplethMap + imperative path rendering
- **charts:** Wrap title + legend in floating panel with overridable bg
- **charts:** ChoroplethMap zoom-reset button, fully fluid sizing

### Performance

- **charts:** Scale ChoroplethMap via viewBox + move legend to HTML

## [0.4.1] - 2026-05-13

### Features

- **charts:** Left-align DataTable, add fullWidth and download menu
- **charts:** Add tooltipValueFormat to LineChart, BarChart, ChoroplethMap
- **charts:** Accept ArrayLike (typed arrays) for tooltipData

## [0.4.0] - 2026-05-12

### Features

- **charts:** Add BarChart and extract shared composables
- **pyodide:** Generalize workers and add callPython

## [0.3.18] - 2026-05-12

### Features

- **components:** Add sliderDisplay prop to NumberInput

## [0.3.17] - 2026-05-12

### Bug Fixes

- **theme:** Remove body overflow hidden

### Features

- **components:** Add two-handle range slider to NumberInput

## [0.3.16] - 2026-05-12

### Chores

- **pnpm:** Silence vue-demi build-script warning

### Features

- **components:** Add Container and Grid layout components
- **models:** Add CDC theme selector and Reed-Frost intro

### Refactor

- **cfasim:** Share template files via _shared/ + minijinja

## [0.3.15] - 2026-05-08

### Bug Fixes

- **templates:** Pin pnpm version in scaffolded package.json

### Chores

- **deps:** Bump rustls-webpki from 0.103.12 to 0.103.13

### Features

- **pyodide:** Make worker packages configurable via vite plugin

## [0.3.14] - 2026-04-23

### Features

- Cfasim tools runs pnpm install and offers Playwright browsers when inside a cfasim project
- Cfasim test runs unit and e2e tests with --unit and --e2e flags
- Cfasim run starts the vite dev server

### Refactor

- Step-loop model templates; python template adds ruff
- Colocate tests with packages, drop playwright setup infra

## [0.3.13] - 2026-04-23

### Bug Fixes

- Align area section labels to start of area (#22)

### Chores

- Use install --locked for wasm-pack (#32)

### Features

- LineChart accepts typed arrays directly
- LineChart accepts x and y props for point data

### Tests

- Add unit + Playwright integration tests to scaffolding templates

## [0.3.12] - 2026-04-21

### Features

- Add cfasim docs command and @cfasim-ui/docs package

### Refactor

- Adjust template structure to include ui under interactive/

## [0.3.11] - 2026-04-21

### Bug Fixes

- Embed workspace files inside cfasim crate for cargo publish

### Documentation

- Make snippets for install easier to copy
- Adjust copy on docs homepage

## [0.3.10] - 2026-04-20

### Bug Fixes

- **cfasim:** Use tokio runtime for background update check

### Documentation

- Rewrite python guide around uvx cfasim init
- Rewrite rust guide around uvx cfasim init

### Features

- Add cfasim tools command to check system dependencies (#24)
- Host cfasim installer scripts on Pages and document in getting-started

## [0.3.9] - 2026-04-20

### Bug Fixes

- Include LICENSE and README in sdist for PyPI publish

## [0.3.8] - 2026-04-20

### Bug Fixes

- **shared:** Declare @vue/test-utils and happy-dom as devDependencies
- **pyodide:** Use uvx pip download instead of uv run pip
- Update the install message to be more generic

### Chores

- **deps:** Bump rustls-webpki from 0.103.10 to 0.103.12

### Features

- **pyodide:** Make pip command configurable via pipCommand option
- **pyodide:** Make pythonVersion configurable in vitePlugin
- **cfasim:** Add cargo-dist, PyPI wheels, and self-update
- **cfasim:** Prompt for auto-update opt-in on first permanent-install run

### Tests

- **cfasim:** Serialize settings env-var tests to prevent parallel races

## [0.3.7] - 2026-04-17

### Chores

- Prepend to CHANGELOG.md instead of regenerating

### Features

- **cfasim-ui:** Add useUrlParams composable for URL query sync
- **cfasim:** Init git repo after scaffolding
- **charts:** Add xTicks/yTicks and tick formatters to LineChart
- **shared:** Add include/ignore, async defaults, and reset options to useUrlParams

## [0.3.6] - 2026-04-17

### Bug Fixes

- **cfasim-ui:** Handle invalid and empty NumberInput values on commit
- **cfasim-ui:** Use container queries for SidebarLayout main padding

### Features

- **cfasim-ui:** Add required prop to NumberInput
- **cfasim-ui:** Support decimal places in NumberInput

### Tests

- **cfasim:** Skip cli e2e when workspace version is unpublished

## [0.3.5] - 2026-04-16

### Bug Fixes

- **charts:** Position LineChart tooltip reactively via transform
- **cfasim:** Use module_name in rust template App.vue

### Chores

- Omit CHANGELOG.md from prettier
- Run cli e2e in pre-push hook

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

## [0.1.5] - 2026-03-27

### Bug Fixes

- Wasm and python paths

### Chores

- Add publish tasks for cargo
- Add python publishing
- Skip existing packages for pypi
- Add publish config to package.json
- Add crates trusted publishing
- **deps-dev:** Bump happy-dom from 20.8.4 to 20.8.8 (#1)

## [0.1.4] - 2026-03-26

### Bug Fixes

- Step should be in original units for percent

### Chores

- Update cargo lock on version script
- Add environment to github workflow
- Disable publish on tags
- Add metadata to cfasim package

### Features

- Added @cfasim-ui/cfasim-ui and new docs
- Add commas to number input

## [0.1.3] - 2026-03-25

### Chores

- Update Cargo lock
- Update version bumping to include Cargo.lock
- Add npm release action
- Add npm environment to the npm task
- Add corepack to npm publish
- Try npm for trusted publishing
- Remove pnpm from publish
- Try upgrading npm for pnpm publishing
- Enable workflow dispatch
- Corepack enable
- Set provenance globally

### Features

- Add choroplethmap
- Add county data to choropleth
- Added panning and zooming to map
- Add hsa to choroplethmap

## [0.1.2] - 2026-03-23

### Bug Fixes

- LineChart should prefix x and y ids
- Type errors
- **examples:** Fix python e2e test label and add example tests to pre-push
- **ci:** Base paths needed for wasm and pyodide assets
- Add icon font
- Cfasim should create an independent project

### Chores

- Add pre-commit hooks and formatting tasks to plz.toml
- Move plz docs test to prepush
- Add playwright as a dependency
- Deploy examples as well
- Added setup rust and more deploy iteration
- Update package.json for publishing
- Update the lockfile
- Add version script
- Version v0.1.0
- Pnpm publish task
- Fix e2e tests
- Ignore public/ dirs from prettier
- Add metadata to cfasim-model
- Update latest branch

### Documentation

- Added a deploy action for docs

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


