# AGENTS.md

`{{ project_name }}` is a cfasim simulation built with R, Vue 3, rwasm, and webR.

- R model package: `DESCRIPTION`, `NAMESPACE`, and `R/model.R`
- Vue frontend: `interactive/src/App.vue`
- Runtime hook: `useModel` from `cfasim-ui/rwasm`

## Commands

- `pnpm dev` — start Vite
- `pnpm build` — build static assets
- `pnpm typecheck` — run Vue type checking
- `Rscript -e 'testthat::test_dir("tests/testthat")'` — run R model unit tests
- `pnpm test:e2e` — run Playwright
