import type { Locator, Page } from '@playwright/test';
import { ENDPOINTS, isApiRequest } from '@api/requests';
import type { OrderDetails } from '@data/order';
import { DialogRaisedError, captureDialog, failOnDialog } from '@utils/dialog';
import { BootstrapModal } from './BootstrapModal';
import { OrderConfirmation, type OrderReceipt } from './OrderConfirmation';

/** What a click on "Purchase" produced: the confirmation receipt, or the alert shown instead. */
export type PurchaseOutcome =
  | { readonly receipt: OrderReceipt; readonly alert?: undefined }
  | { readonly alert: string; readonly receipt?: undefined };

/** "Place order" Bootstrap modal on the cart page. */
export class PlaceOrderModal extends BootstrapModal {
  /** "Total: <amount>" label. */
  readonly totalLabel: Locator;
  readonly nameInput: Locator;
  readonly countryInput: Locator;
  readonly cityInput: Locator;
  readonly cardInput: Locator;
  readonly monthInput: Locator;
  readonly yearInput: Locator;
  readonly purchaseButton: Locator;
  private readonly confirmation: OrderConfirmation;

  constructor(page: Page) {
    super(page, 'orderModal');
    this.confirmation = new OrderConfirmation(page);
    this.totalLabel = this.root.locator('#totalm');
    this.nameInput = this.root.locator('#name');
    this.countryInput = this.root.locator('#country');
    this.cityInput = this.root.locator('#city');
    this.cardInput = this.root.locator('#card');
    this.monthInput = this.root.locator('#month');
    this.yearInput = this.root.locator('#year');
    this.purchaseButton = this.root.getByRole('button', { name: 'Purchase' });
  }

  protected override get readyField(): Locator {
    return this.nameInput;
  }

  /** Fills the provided fields; omitted fields are left untouched. */
  async fill(details: Partial<OrderDetails>): Promise<void> {
    await this.waitForOpen();
    const fields: [Locator, string | undefined][] = [
      [this.nameInput, details.name],
      [this.countryInput, details.country],
      [this.cityInput, details.city],
      [this.cardInput, details.card],
      [this.monthInput, details.month],
      [this.yearInput, details.year],
    ];
    for (const [input, value] of fields) {
      if (value !== undefined) await input.fill(value);
    }
  }

  /**
   * Places an order expected to succeed and returns the parsed receipt once
   * the site has also finished clearing the cart, so the cart can be checked
   * immediately afterwards.
   *
   * @throws DialogRaisedError at once, with the alert text, if the site
   * rejects the order instead.
   */
  async purchase(): Promise<OrderReceipt> {
    return this.submit();
  }

  /**
   * Clicks "Purchase" without presuming the result and reports what the site
   * did: a receipt (after the cart was cleared) or the alert it raised.
   * Use for checks where either outcome is a valid observation.
   */
  async attemptPurchase(): Promise<PurchaseOutcome> {
    try {
      return { receipt: await this.submit() };
    } catch (error) {
      if (error instanceof DialogRaisedError) return { alert: error.dialog.message };
      throw error;
    }
  }

  /** Clicks "Purchase" when a validation alert is expected and returns its message. */
  async purchaseExpectingAlert(): Promise<string> {
    return captureDialog(this.page, () => this.purchaseButton.click());
  }

  /**
   * On a valid form the site's click handler starts the cart-clearing request
   * and opens the confirmation synchronously; on an invalid form it raises an
   * alert instead. Both waits are armed before the click.
   */
  private async submit(): Promise<OrderReceipt> {
    const cartCleared = this.page.waitForResponse((r) =>
      isApiRequest(r.request(), ENDPOINTS.deleteCart),
    );
    // On the alert path no request is sent; the pending wait must not surface as unhandled.
    cartCleared.catch(() => undefined);
    const receipt = await failOnDialog(
      this.page,
      'Purchase',
      () => this.purchaseButton.click(),
      () => this.confirmation.getReceipt(),
    );
    const response = await cartCleared;
    if (!response.ok()) {
      throw new Error(`Clearing the cart after purchase failed: HTTP ${response.status()}`);
    }
    return receipt;
  }
}
