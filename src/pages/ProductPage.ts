import type { Locator, Page } from '@playwright/test';
import { productIds, type ProductRef } from '@utils/catalog';
import { captureDialog } from '@utils/dialog';
import { parseMoney } from '@utils/money';
import { BasePage } from './BasePage';
import { ROUTES } from './routes';

/** Product detail page (`prod.html?idp_=<id>`). */
export class ProductPage extends BasePage {
  readonly details: Locator;
  readonly name: Locator;
  readonly price: Locator;
  readonly description: Locator;
  readonly image: Locator;
  readonly addToCartButton: Locator;

  constructor(page: Page) {
    super(page);
    this.details = page.locator('#tbodyid');
    this.name = this.details.locator('h2.name');
    this.price = this.details.locator('h3.price-container');
    this.description = this.details.locator('#more-information');
    this.image = page.locator('#imgp img');
    this.addToCartButton = this.details.getByRole('link', { name: 'Add to cart' });
  }

  /** Opens the detail page of a product by id and waits for it to render. */
  async goto(productId: number): Promise<void> {
    await this.navigate(ROUTES.product(productId));
    await this.waitForLoaded();
  }

  /** Waits until the product details are rendered. */
  async waitForLoaded(): Promise<void> {
    await this.addToCartButton.waitFor({ state: 'visible' });
  }

  /** Displayed product name. */
  async getName(): Promise<string> {
    await this.waitForLoaded();
    return (await this.name.innerText()).trim();
  }

  /** Displayed price as a number (tax note stripped). */
  async getPrice(): Promise<number> {
    await this.waitForLoaded();
    return parseMoney(await this.price.innerText());
  }

  /**
   * Clicks "Add to cart" and returns the alert message. The text differs for
   * logged-in users and guests; compare against `UI_ALERTS` in specs.
   */
  async addToCart(): Promise<string> {
    await this.waitForLoaded();
    return captureDialog(this.page, () => this.addToCartButton.click());
  }

  /**
   * Opens each product's page, adds it to the cart, and returns the alert
   * messages in order. Specs assert the messages (logged-in vs guest text).
   */
  async addProducts(products: readonly ProductRef[]): Promise<string[]> {
    const messages: string[] = [];
    for (const productId of productIds(products)) {
      await this.goto(productId);
      messages.push(await this.addToCart());
    }
    return messages;
  }
}
