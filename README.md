# DemoBlaze E2E Automation

End-to-end test automation for the [DemoBlaze](https://www.demoblaze.com/) demo store, focused on
the **Login** and **Cart / Place Order** features. Built with **Playwright Test + TypeScript** and
covering UI, API, regression and lightweight performance testing across Chromium, Firefox, WebKit
and mobile emulation.

The test case suite (`DemoBlaze-Test-Cases.xlsx`) is shared with the team separately and is not
part of this repository. Every automated test title starts with the ID of its row in that workbook
(see [Test cases and traceability](#test-cases-and-traceability)).

## Scope

| In scope                                     | Out of scope                                  |
| -------------------------------------------- | --------------------------------------------- |
| Login: modal, validation, session, logout    | Sign-up UI beyond what Login needs            |
| Cart: add, view, delete, totals, persistence | Contact / About us modals                     |
| Place Order: form validation, confirmation   | Payment (the site has no payment gateway)     |
| Backend API used by Login and Cart           | Load / stress testing against the public site |
| Single-user performance budgets              | Visual regression, accessibility audits       |

| Type        | Where        | Purpose                                                                                                       | Tag           |
| ----------- | ------------ | ------------------------------------------------------------------------------------------------------------- | ------------- |
| UI          | `tests/ui`   | User journeys: login, add to cart, place order                                                                | `@ui`         |
| API         | `tests/api`  | Behavior of `/login`, `/signup`, `/addtocart`, `/viewcart`, `/deleteitem`, `/deletecart`, `/entries`, `/view` | `@api`        |
| Smoke       | UI + API     | Fast gate on every push and pull request                                                                      | `@smoke`      |
| Regression  | Full suite   | Manual CI run or before a release                                                                             | `@regression` |
| Performance | `tests/perf` | Navigation and API response-time budgets                                                                      | `@perf`       |

A run is signed off when every `@smoke` test is green on all browser projects and every
`@regression` failure is either fixed or recorded as a known defect.

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
- A failed cart cleanup in teardown doesn't fail the test. It shows up as a `cleanup-warning`
  annotation instead.

## CI (GitHub Actions)

Workflow: [`.github/workflows/playwright.yml`](.github/workflows/playwright.yml).

| Trigger                    | What runs                                                                                                      |
| -------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Push to `main`, any PR     | `@smoke` on `chromium`, `firefox`, `webkit` and `api`                                                          |
| Manual `workflow_dispatch` | Chosen project (or `all`), optional `--grep` filter and worker count. Use this for full regression and mobile. |

There is no nightly schedule, to keep load on the shared public site on demand only.

Jobs run in this order:

1. `quality`: lint, type-check and Prettier on Node 22 and 24.
2. `test`: one job per Playwright project. Browsers are cached per Playwright version. CI retries
   failed tests twice.
3. `report`: merges the blob reports of all jobs into one HTML report and one JUnit file.

Artifacts: `playwright-report` (merged HTML + JUnit), `junit-<project>`, and on failure
`test-artifacts-<project>` (traces, screenshots, videos).

Repository settings it reads (all optional):

| Kind     | Name                                       | Purpose                                    |
| -------- | ------------------------------------------ | ------------------------------------------ |
| Variable | `BASE_URL`, `API_URL`                      | Point the suite at another environment     |
| Secret   | `DEMOBLAZE_USERNAME`, `DEMOBLAZE_PASSWORD` | Existing account for the valid-login tests |

Secrets are exposed only to the step that runs the tests. The pipeline calls nothing but `npm` /
`npx playwright` commands, so it ports to Jenkins or GitLab CI by running the same commands.

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

### Alternatives that were rejected

| Choice                    | Rejected alternative          | Why                                                                                                   |
| ------------------------- | ----------------------------- | ----------------------------------------------------------------------------------------------------- |
| Playwright                | Cypress                       | WebKit support is experimental, native dialogs and multi-tab are weaker, API testing is secondary.    |
| Playwright                | WebdriverIO + Mocha           | Needs more glue (reporters, assertions, drivers) for the same result.                                 |
| Page objects + components | Screenplay pattern            | Too heavy for two features and unfamiliar to most reviewers.                                          |
| Test case IDs in titles   | Cucumber / playwright-bdd     | A second runner and a step-definition layer for a small scope. Given/When/Then lives in the workbook. |
| Fresh user per test       | One shared account in secrets | Parallel jobs collide on one cart, and anyone on the internet can change it.                          |
| `test.fail()` for defects | `test.skip()`                 | Skipping hides the defect and the test never notices the fix.                                         |
| Budgets in Playwright     | k6 / Artillery                | Load tests against a shared public demo are abusive and noisy. Use them on an environment you own.    |

## How DemoBlaze behaves

These facts drive most of the framework design. They were confirmed against the live site and API.

- The backend reports business errors with **HTTP 200** and a body of `{"errorMessage": "..."}`.
  A 200 status alone never means success; `DemoBlazeApiClient` checks the body.
- `POST /login` returns the string `"Auth_token: <token>"` and sets no cookie. The UI then stores the
  token in the `tokenp_` cookie itself. Calling the login API from a test therefore does not log the
  browser in; `test.use({ session: 'user' })` injects that cookie for you.
- Passwords are sent **Base64-encoded** by the UI, and the API expects the same encoding
  (`src/utils/encoding.ts`).
- A guest's cart is keyed by the `user=<uuid>` cookie the home page assigns. A guest that opens a
  product page directly has no such cookie and shares one cart with every other such guest. The
  `page` fixture sets a unique guest cookie before the first navigation.
- Login errors, "Product added", and order-form validation are native `alert()` dialogs raised
  **after** an XHR completes, so they can appear well after the click.
- The product list is paged by 9 (`/entries`, then `/pagination`). The catalog fixture follows the
  pages and is loaded once per worker.

## Writing a new test

1. Find or add the test case row in the workbook and take its ID (`TC-<AREA>-<NNN>`).
2. Put the spec under `tests/ui/<feature>/`, `tests/api/` or `tests/perf/`.
3. Start the title with the ID and copy the tags from the workbook row.
4. Import `test` and `expect` from `@fixtures`, never from `@playwright/test`.
5. Arrange state through fixtures (`seedCart`, `authenticatedUser`, `userFactory`, `catalog`), not
   through UI clicks, unless the UI step is what the test verifies.

```ts
import { UI_ALERTS } from '@data/messages';
import { PRODUCT } from '@data/products';
import { expect, test } from '@fixtures';
import { cartRow } from '@utils/cart';
import { productByTitle } from '@utils/catalog';

test.describe('Cart: add to cart', () => {
  test.use({ session: 'user' }); // logged-in browser without going through the login UI

  test(
    'TC-CART-001 logged-in user adds a product to the cart',
    { tag: ['@smoke', '@regression', '@ui', '@cart'] },
    async ({ productPage, cartPage, catalog }) => {
      const product = productByTitle(catalog, PRODUCT.galaxyS6); // price comes from the API

      await productPage.goto(product.id);
      expect(await productPage.addToCart()).toBe(UI_ALERTS.productAdded);

      const cart = await cartPage.openFromNavbar();
      expect(cart.rows).toEqual([cartRow(product)]);
    },
  );
});
```

Rules a review will check:

- Locators use `getByRole`, `getByLabel`, `getByText` or stable IDs. No positional XPath and no
  CSS chains tied to layout.
- No `page.waitForTimeout()` or other fixed sleeps (ESLint fails on it). Wait for a web-first
  assertion, a response or a dialog.
- Arm every expected alert **before** the action with `captureDialog` (one alert), `collectDialogs`
  (several) or `failOnDialog` (success path) from `@utils/dialog`, and assert its message. Any other
  dialog fails the test.
- Page objects and components hold locators, intent-level actions and any wait that compensates for
  app timing. Business assertions stay in the spec. Don't add a `tests/support/` helper layer.
- Never hard-code prices. Product titles live in `src/data/products.ts`; prices come from the
  `catalog` fixture or `/view`.
- Each test owns its data and must pass in any order and in parallel. Use a fresh user, not
  `DEMOBLAZE_USERNAME`, whenever the test asserts exact cart contents.
- `npm run lint`, `npm run typecheck` and `npm run format:check` pass with zero warnings.

When a test exposes an application bug, keep asserting the correct behavior and call
`knownDefect('BUG-<NNN>', '<summary>')` right before the defective step, after the arrangement.
Calling it on the first line would also turn setup failures and outages into a pass.

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

## Test cases and traceability

The workbook `DemoBlaze-Test-Cases.xlsx` is the official test case suite. It is distributed to the
team separately and is not stored in this repository. It contains a Summary sheet, one sheet per
module (Login, Cart & Order), a Defects sheet and a Test Data sheet. Steps use Given / When / Then.

| Item         | Format                                                          | Example        |
| ------------ | --------------------------------------------------------------- | -------------- |
| Test case ID | `TC-<AREA>-<NNN>`, AREA = `LOGIN`, `CART`, `ORDER`              | `TC-ORDER-005` |
| Defect ID    | `BUG-<NNN>`                                                     | `BUG-001`      |
| Test data ID | `TD-<NN>`                                                       | `TD-20`        |
| Priority     | `P1` smoke / business critical, `P2` core regression, `P3` edge | `P1`           |

The link to the code is the ID at the start of every test title and the tags, which must match the
workbook row. To find the automation for a row, grep its ID:

```bash
npx playwright test --list --grep TC-CART-004
```

IDs are never reused or renumbered. A case that is no longer relevant is retired in the workbook,
not deleted, once a spec references it.

## Known defects

Found while executing the suite against the public site. Each has an automated test that asserts
the correct behavior and is marked as an expected failure.

| ID      | Summary                                                     | Test                                      |
| ------- | ----------------------------------------------------------- | ----------------------------------------- |
| BUG-001 | Purchase confirmation date shows the previous month         | `tests/ui/order/place-order.spec.ts`      |
| BUG-004 | Order can be placed with an empty cart (Amount: 0 USD)      | `tests/ui/order/order-validation.spec.ts` |
| BUG-005 | Whitespace-only Name and Credit card pass order validation  | `tests/ui/order/order-validation.spec.ts` |
| BUG-007 | Whitespace-only credentials are sent to the server          | `tests/ui/login/login.spec.ts`            |
| BUG-008 | Login modal keeps typed username and password after closing | `tests/ui/login/login.spec.ts`            |
| BUG-009 | Pressing Enter does not submit the login form               | `tests/ui/login/login.spec.ts`            |
| BUG-010 | Double-clicking "Log in" sends duplicate login requests     | `tests/ui/login/login.spec.ts`            |
| BUG-011 | Login API returns HTTP 500 for empty username and password  | `tests/api/login.spec.ts`                 |
| BUG-012 | Add-to-cart API accepts a product id that does not exist    | `tests/api/cart.spec.ts`                  |

The full list, including defects without automation, is on the workbook's Defects sheet.

## Troubleshooting

| Symptom                                                       | Cause and fix                                                                                                                                   |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `Health check failed: GET .../entries`                        | The API is unreachable or returned no products. Check network access and `API_URL`. `SKIP_HEALTH_CHECK=true` bypasses the check.                |
| `Unexpected browser dialog(s): [alert] "..."`                 | An action raised an alert nobody armed. Wrap the action in `captureDialog` / `failOnDialog`, or treat the message as the bug it reports.        |
| `... failed: the page raised alert "..."` (DialogRaisedError) | A success path got an alert instead, e.g. "Wrong password." The message is the real cause.                                                      |
| `DemoBlaze API /... failed (HTTP 200): ...`                   | The backend answered with an `errorMessage`. Transient 429/5xx are already retried `API_RETRIES` times.                                         |
| Cart test sees extra rows                                     | The test used a shared account (`DEMOBLAZE_USERNAME`) or skipped the fixtures. Use `session: 'user'` / `authenticatedUser` for a fresh account. |
| Timeouts on a slow day                                        | The public site is slow at times. Raise `ACTION_TIMEOUT_MS`, `NAVIGATION_TIMEOUT_MS` or `TEST_TIMEOUT_MS`, or lower `WORKERS`.                  |
| `@perf` test over budget                                      | Single-sample timings on a public site are noisy. Re-run, then adjust `PERF_*_BUDGET_MS` only if the result repeats.                            |
