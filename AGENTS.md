# Repository Guidelines

## Project Structure & Module Organization
Primary development happens in [`src/`](/Users/nunoaguiar/Documents/git/oafp/src). The main templates and source entrypoints are `src/oafp.source.js.hbs`, generated `src/oafp.source.js`, and compiled `src/oafp.js`. Shared logic lives in `src/include/*.js`, oJob automation in `src/ojobs/`, docs in `src/docs/`, and regression tests in `src/tests/`. Generated package artifacts are written to [`pack/`](/Users/nunoaguiar/Documents/git/oafp/pack) and derived data files to [`data/`](/Users/nunoaguiar/Documents/git/oafp/data); treat both as build output and avoid hand-editing them unless the workflow requires regeneration.

## Build, Test, and Development Commands
Run commands from the repository root unless noted.

- `cd src && ojob build.yaml op=build` builds `src/oafp.source.js`, compiles `src/oafp.js`, and refreshes `data/*.json`.
- `cd src && ojob build.yaml op=dev` creates a development build that loads `src/include/*` dynamically.
- `cd src && ojob build.yaml op=test` cleans, builds, and runs the automated test suite.
- `cd src/tests && ojob autoTest.yaml` runs the regression tests directly.
- `cd src && ojob build.yaml op=pack` rebuilds everything and refreshes the distributable `pack/` directory.

## Coding Style & Naming Conventions
Follow the existing OpenAF JavaScript style: 3-space to 4-space indentation as already used in each file, semicolons kept minimal, and `var` used consistently in older modules. Keep helper modules focused by concern (`inputFns.js`, `outputFns.js`, `transformFns.js`). Preserve current file naming: lower camel case for helper files, snake case for test files such as `oafp_test.js`, and uppercase Markdown names for docs such as `USAGE.md`.

## Testing Guidelines
Tests are driven by `src/tests/autoTest.yaml` and helper functions in `src/tests/autoTest.js`. Add or extend targeted test functions for every behavior change, then register them in `autoTest.yaml`. Prefer deterministic fixture-style assertions over ad hoc console checks. Run `cd src && ojob build.yaml op=test` before opening a PR.

## Commit & Pull Request Guidelines
Recent history favors short conventional messages such as `feat: ...`, `docs: ...`, and `Fix ...`. Use imperative, scoped subjects and keep unrelated changes out of the same commit. PRs should describe the behavior change, note any updated docs or generated artifacts (`pack/`, `data/`), and link the related issue when applicable. Include command output or sample `oafp` usage when the change affects CLI behavior.

## Security & Configuration Tips
Do not commit secrets or local environment details. Follow [`SECURITY.md`](/Users/nunoaguiar/Documents/git/oafp/SECURITY.md) for vulnerability reporting, and validate external input-handling changes with regression tests before merging.
