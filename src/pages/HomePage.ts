import { expect, type Locator, type Page } from '@playwright/test';
import { responseItems } from '@api/DemoBlazeApiClient';
import { ENDPOINTS, isApiRequest, type Endpoint } from '@api/requests';
import type { Product } from '@api/types';
import { displayTitle } from '@utils/catalog';
import { parseMoney } from '@utils/money';
import { BasePage } from './BasePage';
import { ROUTES } from './routes';

const CARD_TITLE = '.card-title';

/** Category filters in the left sidebar, keyed by their visible label. */
export type CategoryLabel = 'Phones' | 'Laptops' | 'Monitors';

/** A product card as displayed on the home page. */
export interface ProductCardInfo {
  readonly title: string;
  readonly price: number;
}

/** Home page: product grid, categories and pagination. */
export class HomePage extends BasePage {
  readonly productGrid: Locator;
  readonly productCards: Locator;
  readonly productTitles: Locator;
  readonly nextButton: Locator;
  readonly previousButton: Locator;
  readonly carousel: Locator;

  constructor(page: Page) {
    super(page);
    this.productGrid = page.locator('#tbodyid');
    this.productCards = this.productGrid.locator('.card');
    this.productTitles = this.productGrid.locator(CARD_TITLE);
    this.nextButton = page.locator('#next2');
    this.previousButton = page.locator('#prev2');
    this.carousel = page.locator('#carouselExampleIndicators');
  }

  /** Opens the home page and waits until it has loaded and the first product card is rendered. */
  async goto(): Promise<void> {
    await this.navigate(ROUTES.home);
    await this.waitForProducts();
  }

  /** Waits until at least one product card is rendered. */
  async waitForProducts(): Promise<void> {
    await this.productCards.first().waitFor({ state: 'visible' });
  }

  /** Category link in the sidebar. */
  categoryLink(label: CategoryLabel): Locator {
    return this.page.getByRole('link', { name: label, exact: true });
  }

  /** Card that contains a product with exactly this title. */
  productCard(title: string): Locator {
    return this.productCards.filter({
      has: this.page.getByRole('link', { name: title, exact: true }),
    });
  }

  /** Title link of a product card. */
  productLink(title: string): Locator {
    return this.productGrid.getByRole('link', { name: title, exact: true });
  }

  /** Filters the grid by category and waits for the backend response. */
  async selectCategory(label: CategoryLabel): Promise<void> {
    await this.reloadGrid(ENDPOINTS.byCategory, () => this.categoryLink(label).click());
  }

  /** Moves to the next product page and waits for it to render. */
  async goToNextPage(): Promise<void> {
    await this.reloadGrid(ENDPOINTS.pagination, () => this.nextButton.click());
  }

  /** Moves to the previous product page and waits for it to render. */
  async goToPreviousPage(): Promise<void> {
    await this.reloadGrid(ENDPOINTS.pagination, () => this.previousButton.click());
  }

  /**
   * The old cards stay in the DOM until the site handles the response, so
   * "a card is visible" would pass on the stale grid. Waits instead until the
   * rendered titles are exactly the ones in this response (a wait, not a
   * business assertion).
   */
  private async reloadGrid(endpoint: Endpoint, trigger: () => Promise<unknown>): Promise<void> {
    const [response] = await Promise.all([
      this.page.waitForResponse((r) => isApiRequest(r.request(), endpoint)),
      trigger(),
    ]);
    const products = await responseItems<Product>(response);
    await expect(this.productTitles).toHaveText(products.map(displayTitle));
  }

  /** Returns title and price of every visible product card. */
  async getProductCards(): Promise<ProductCardInfo[]> {
    await this.waitForProducts();
    const cards = await this.productCards.all();
    return Promise.all(
      cards.map(async (card) => ({
        title: (await card.locator(CARD_TITLE).innerText()).trim(),
        price: parseMoney(await card.locator('h5').innerText()),
      })),
    );
  }

  /** Opens the product detail page for the product with this title. */
  async openProduct(title: string): Promise<void> {
    await Promise.all([
      this.page.waitForURL(/\/prod\.html\?idp_=/),
      this.productLink(title).click(),
    ]);
    await this.navbar.waitForReady();
  }
}
