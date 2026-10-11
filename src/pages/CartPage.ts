import type { Locator, Page, Response } from '@playwright/test';
import { responseItems } from '@api/DemoBlazeApiClient';
import { ENDPOINTS, isApiRequest } from '@api/requests';
import { PlaceOrderModal } from '@components/PlaceOrderModal';
import type { OrderReceipt } from '@components/OrderConfirmation';
import type { CartRow, CartSnapshot } from '@data/cart';
import type { OrderDetails } from '@data/order';
import { parseMoney } from '@utils/money';
import { BasePage } from './BasePage';
import { ROUTES } from './routes';

function isCartRequest(response: Response): boolean {
  return isApiRequest(response.request(), ENDPOINTS.viewCart);
}

/**
 * Cart page (`cart.html`).
 *
 * The page fetches the cart lines (`/viewcart`) and then one product per line
 * (`/view`), appending rows and updating the total as each product arrives.
 * Every method that loads the cart therefore waits for the `/viewcart`
 * response of the new document, then for exactly that many rows, and returns
 * a {@link CartSnapshot}. The total is updated in the same callback that
 * appends a row, so it is final once the last row exists.
 */
export class CartPage extends BasePage {
  readonly table: Locator;
  /** Column headers of the cart table ("Pic", "Title", "Price", "x"). */
  readonly columnHeaders: Locator;
  readonly rows: Locator;
  /** Total amount panel; empty while the cart is empty. */
  readonly total: Locator;
  readonly placeOrderButton: Locator;
  private readonly placeOrderModal: PlaceOrderModal;

  constructor(page: Page) {
    super(page);
    this.table = page.locator('#tbodyid');
    this.columnHeaders = page
      .getByRole('table')
      .filter({ has: this.table })
      .getByRole('columnheader');
    this.rows = this.table.locator('tr');
    this.total = page.locator('#totalp');
    this.placeOrderButton = page.getByRole('button', { name: 'Place Order' });
    this.placeOrderModal = new PlaceOrderModal(page);
  }

  /** Opens the cart by URL and returns its fully rendered contents. */
  async goto(): Promise<CartSnapshot> {
    return this.load(() => this.navigate(ROUTES.cart));
  }

  /** Opens the cart through the navbar link and returns its fully rendered contents. */
  async openFromNavbar(): Promise<CartSnapshot> {
    return this.load(() => this.navbar.cartLink.click());
  }

  /** Reloads the cart page and returns its fully rendered contents. */
  async reload(): Promise<CartSnapshot> {
    return this.load(() => this.page.reload({ waitUntil: 'load' }));
  }

  /**
   * Runs `trigger`, which must cause a cart page load, and returns the cart
   * once every line reported by that load's `/viewcart` response is rendered
   * and the page is ready for interaction (see `Navbar.waitForReady`).
   * Use for navigations not covered by the other methods.
   */
  async load(trigger: () => Promise<unknown>): Promise<CartSnapshot> {
    const cartResponse = this.page.waitForResponse(isCartRequest);
    await trigger();
    const response = await cartResponse;
    // The cart request is sent by the new document, so this waits for that document.
    await this.navbar.waitForReady();
    return this.waitForRows(response);
  }

  /** Row whose title cell matches exactly. */
  row(title: string): Locator {
    return this.rows.filter({
      has: this.page.getByRole('cell', { name: title, exact: true }),
    });
  }

  /**
   * Deletes the first row with this title. The site reloads the page after
   * the deletion; the reloaded cart is returned once fully rendered.
   */
  async deleteItem(title: string): Promise<CartSnapshot> {
    const deleteLink = this.row(title).first().getByRole('link', { name: 'Delete' });
    // The row only exists after the current document's cart request completed,
    // so the next cart response can only come from the reload.
    await deleteLink.waitFor({ state: 'visible' });
    const [deleteResponse, snapshot] = await Promise.all([
      this.page.waitForResponse((r) => isApiRequest(r.request(), ENDPOINTS.deleteItem)),
      this.load(() => deleteLink.click()),
    ]);
    if (!deleteResponse.ok()) {
      throw new Error(`Deleting "${title}" failed: HTTP ${deleteResponse.status()}`);
    }
    return snapshot;
  }

  /** Opens the Place Order modal, waits until it is ready for input and returns it. */
  async openPlaceOrder(): Promise<PlaceOrderModal> {
    await this.placeOrderModal.openWith(() => this.placeOrderButton.click());
    return this.placeOrderModal;
  }

  /**
   * Opens Place Order, fills the form and completes a purchase expected to
   * succeed. Specs that need to assert the modal before submitting should use
   * {@link openPlaceOrder} instead.
   */
  async purchaseOrder(details: OrderDetails): Promise<OrderReceipt> {
    const modal = await this.openPlaceOrder();
    await modal.fill(details);
    return modal.purchase();
  }

  private async waitForRows(cartResponse: Response): Promise<CartSnapshot> {
    const expected = (await responseItems(cartResponse)).length;
    if (expected > 0) {
      try {
        await this.rows.nth(expected - 1).waitFor({ state: 'attached' });
      } catch (error) {
        const rendered = await this.rows.count();
        throw new Error(`Cart rendered ${rendered} of ${expected} lines`, { cause: error });
      }
    }
    return { rows: await this.readRows(), total: await this.readTotal() };
  }

  private async readRows(): Promise<CartRow[]> {
    const columns = await this.columnIndexes();
    const rows = await this.rows.all();
    return Promise.all(
      rows.map(async (row) => {
        const cells = row.getByRole('cell');
        return {
          title: (await cells.nth(columns.title).innerText()).trim(),
          price: parseMoney(await cells.nth(columns.price).innerText()),
        };
      }),
    );
  }

  /** Positions of the named columns, read from the table header so cells are not tied to layout. */
  private async columnIndexes(): Promise<{ title: number; price: number }> {
    const headers = (await this.columnHeaders.allInnerTexts()).map((text) => text.trim());
    const indexOf = (label: string): number => {
      const index = headers.indexOf(label);
      if (index < 0) {
        throw new Error(`Cart table has no "${label}" column (headers: ${headers.join(', ')})`);
      }
      return index;
    };
    return { title: indexOf('Title'), price: indexOf('Price') };
  }

  private async readTotal(): Promise<number> {
    const text = (await this.total.innerText()).trim();
    return text === '' ? 0 : parseMoney(text);
  }
}
