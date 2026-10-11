# DemoBlaze E2E Automation

End-to-end test automation for the [DemoBlaze](https://www.demoblaze.com/) demo store, focused on
the **Login** and **Cart / Place Order** features. Built with **Playwright Test + TypeScript** and
covering UI, API, regression and lightweight performance testing across Chromium, Firefox, WebKit
and mobile emulation.

## Prerequisites

- Node.js **22.13 or later** (CI uses 22 and 24; 24 is the recommended LTS) and npm
- Internet access to `https://www.demoblaze.com` and `https://api.demoblaze.com`

## Install

```bash
npm ci
npx playwright install --with-deps   # or: npx playwright install chromium firefox webkit
cp .env.example .env                 # optional; every variable has a default
```

## Run

| Goal                                   | Command                                                                                 |
| -------------------------------------- | --------------------------------------------------------------------------------------- |
| Everything (all projects)              | `npm test`                                                                              |
| Smoke only (`@smoke`)                  | `npm run test:smoke`                                                                    |
| Regression (everything except `@perf`) | `npm run test:regression`                                                               |
| UI on all desktop + mobile projects    | `npm run test:ui`                                                                       |
| API only                               | `npm run test:api`                                                                      |
| Performance budgets                    | `npm run test:perf`                                                                     |
| One browser                            | `npm run test:chromium` / `test:firefox` / `test:webkit` / `test:mobile`                |
| By feature tag                         | `npx playwright test --grep @cart` (`@login`, `@cart`, `@order`, `@ui`, `@api`)         |
| Headed / debug                         | `HEADLESS=false npx playwright test --project=chromium` / `npx playwright test --debug` |
| Open the last HTML report              | `npm run report`                                                                        |
| Lint / type-check / formatting         | `npm run lint` / `npm run typecheck` / `npm run format:check`                           |

Any Playwright CLI option can be appended, e.g. `npm run test:smoke -- --project=firefox --repeat-each=3`.

### Projects

| Project         | Runs                       | Device          |
| --------------- | -------------------------- | --------------- |
| `chromium`      | `tests/ui`                 | Desktop Chrome  |
| `firefox`       | `tests/ui`                 | Desktop Firefox |
| `webkit`        | `tests/ui`                 | Desktop Safari  |
| `mobile-chrome` | `tests/ui`, `@smoke` only  | Pixel 7         |
| `mobile-safari` | `tests/ui`, `@smoke` only  | iPhone 14       |
| `api`           | `tests/api` (no browser)   | –               |
| `perf`          | `tests/perf`, `@perf` only | Desktop Chrome  |

## Configuration

All environment-specific values are read in one place (`src/config/env.ts`) and validated at
start-up with explicit error messages. **Every variable, its default and its meaning is documented
in [`.env.example`](.env.example)**. The most common ones:

- `BASE_URL`, `API_URL`: targets under test
- `DEMOBLAZE_USERNAME` / `DEMOBLAZE_PASSWORD`: optional existing account for the valid-login
  scenario. When unset, a fresh user is signed up through the API.
- `WORKERS`, `RETRIES`, `HEADLESS`, `*_TIMEOUT_MS`: execution tuning
- `PERF_*_BUDGET_MS`: performance budgets
- `API_RETRIES`: bounded retries for transient API failures during test-data setup

Real environment variables override `.env`. A health check (`GET /entries`) runs before the suite
and stops it early with a clear message if the backend is unreachable.

## Reports

- **HTML**: `playwright-report/` (traces on first retry, screenshots on failure, videos kept on
  failure). Open with `npm run report`.
- **JUnit XML**: `test-results/junit.xml`, for CI dashboards.
- **CI**: GitHub annotations, plus per-job blob reports merged into a single HTML report artifact.
- Known application defects appear as expected failures with a `defect` annotation, and
  performance timings are attached to each `@perf` test.

## Framework structure

```text
src/
  config/       typed, validated environment config + global health check
  api/          DemoBlazeApiClient (typed endpoints, transient-failure retry) + models
  pages/        HomePage, ProductPage, CartPage (intent actions e.g. purchaseOrder, addProducts)
  components/   BootstrapModal → CredentialsModal → Login/SignUp; PlaceOrder; Navbar; …
  fixtures/     composed modules: dialogGuard → api → auth → pages (+ knownDefect)
  utils/        dialog, catalog, cart comparison, data generators, money, Base64, session, retry, perf
  data/         static messages/products + shared domain types (cart, order, user)
tests/
  ui/           browser specs, grouped by feature
  api/          backend specs
  perf/         performance budget specs
```

Path aliases (`@pages/*`, `@api/*`, `@fixtures`, ...) avoid deep relative imports.

### Design rationale

- **Playwright Test + TypeScript (strict).** One runner handles UI, API (`APIRequestContext`),
  tagging, sharding, traces and reports, with first-class Chromium, Firefox and WebKit support. ESLint
  (typescript-eslint, eslint-plugin-playwright) and Prettier enforce consistency.
- **Page Object Model + components + fixtures.** Pages model routes, components model reusable
  widgets (navbar, modals), and fixtures inject them. Page objects expose locators and intent-level
  actions; business assertions stay in specs. A locator change is made in exactly one place.
- **Independent, parallel-safe data.** Every test signs up its own `qa_<timestamp>_<random>` user
  through the API, seeds its cart through the API, and cleans the cart in teardown. Product names and
  prices come from the API, never hard-coded. Every browser page starts as a guest with its own
  anonymous cart; tests that aren't testing login but need a logged-in browser set
  `test.use({ session: 'user' })`, which injects the site's session cookie (`tokenp_`).
- **Deterministic waits, no sleeps.** `page.waitForTimeout` is banned by lint. The site reports
  errors through native `alert()` dialogs that fire after XHRs, so `captureDialog()` starts listening
  before the triggering action and returns the message for assertion (`collectDialogs()` when one
  action raises several). `failOnDialog()` turns an
  unexpected alert on a success path into an immediate, descriptive failure. A guard fixture fails any
  test that triggers a dialog nobody expected. The cart page waits for its own `/viewcart` response
  and then exactly that many rows, so a half-rendered cart can never be read.
- **Tags and project scope.** Playwright `tag` options (`@smoke`, `@regression`, `@ui`, `@api`,
  `@perf`, `@login`, `@cart`, `@order`). Each test title starts with its test case ID for
  traceability. Mobile projects run `@smoke` only, to limit load on the shared public site.
- **Known defects stay visible.** `knownDefect('BUG-00X', summary)` marks a test as expected to fail
  while it keeps asserting the _correct_ behavior. It is called after the arrangement, right before
  the defective step, so a setup failure still fails the test. When the site is fixed, the test
  reports "unexpectedly passed".
- **Lightweight performance.** Navigation-timing and API response-time budgets run in a dedicated
  Chromium project. These are single-user timings, not load tests. Load testing with k6 or Artillery
  is the extension path for environments you own.
- **Resilience against a public backend.** Test-data API calls retry only transient failures
  (network error, HTTP 429/5xx) with a short bounded backoff. Business errors are never retried.
  Test-level retries are enabled only in CI.

## Demo scenarios

The two required demo flows are automated as `@smoke` tests:

| Scenario                          | Test           | What it verifies                                                                                                                                                                                                                                                     |
| --------------------------------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Logging in with valid credentials | `TC-LOGIN-001` | Logs in through the Log in modal; the modal closes, no alert is shown and the navbar shows `Welcome <username>`.                                                                                                                                                     |
| Add to cart, then place an order  | `TC-ORDER-001` | Logs in, adds two products from their product pages, checks the cart rows and total, places the order and checks the confirmation (amount equals the cart total, name, card number, order id), then confirms that OK returns to the home page and the cart is empty. |

`TC-LOGIN-001` uses `DEMOBLAZE_USERNAME` / `DEMOBLAZE_PASSWORD` when set, otherwise a freshly
signed-up account. `TC-ORDER-001` always uses a fresh account: it asserts exact cart contents, which
a shared account cannot guarantee when browser jobs run in parallel. Both read product prices from
the API.

Run them in a visible browser:

```bash
npx playwright test --grep "TC-LOGIN-001|TC-ORDER-001" --project=chromium --headed
```

Drop `--headed` to run headless, or replace the project with `firefox`, `webkit`, `mobile-chrome`
or `mobile-safari`. Then open the HTML report, which includes steps, screenshots and traces:

```bash
npm run report
```

Edge cases and negative paths (validation alerts, wrong credentials, empty cart, deleting items)
are covered by the rest of the suite. Tests for confirmed application defects, such as the
confirmation date showing the previous month (`BUG-001`), still assert the correct behavior and are
marked as expected failures: they count as passed in the summary and show a `defect` annotation in
the report. Once the site fixes a defect, its test is reported as "unexpectedly passed".
