import type { Locator, Page } from '@playwright/test';
import { HOME_REDIRECT_URL } from '@pages/routes';
import { parseMoney } from '@utils/money';
import { Navbar } from './Navbar';

/** Values shown in the purchase confirmation. */
export interface OrderReceipt {
  readonly id: string;
  readonly amount: number;
  readonly currency: string;
  readonly cardNumber: string;
  readonly name: string;
  /** Date exactly as displayed (`d/m/yyyy`; the site renders a zero-based month). */
  readonly date: string;
  /** Full raw text of the confirmation body. */
  readonly raw: string;
}

const LABELS = ['Id', 'Amount', 'Card Number', 'Name', 'Date'] as const;
type Label = (typeof LABELS)[number];

/**
 * Splits `"Id: 1 Amount: 2 USD Card Number: 3 Name: x Date: 1/2/2026"` into a
 * label map. Works whether the fields are separated by newlines or not.
 */
function splitFields(text: string): Partial<Record<Label, string>> {
  const pattern = new RegExp(`(${LABELS.join('|')}):`, 'g');
  const matches = [...text.matchAll(pattern)];
  const result: Partial<Record<Label, string>> = {};
  matches.forEach((match, index) => {
    const start = (match.index ?? 0) + match[0].length;
    const end = matches[index + 1]?.index ?? text.length;
    result[match[1] as Label] = text.slice(start, end).trim();
  });
  return result;
}

/** Parses the confirmation text into a typed receipt. */
export function parseOrderReceipt(text: string): OrderReceipt {
  const fields = splitFields(text);
  const missing = LABELS.filter((label) => fields[label] === undefined);
  if (missing.length > 0) {
    throw new Error(`Order confirmation is missing ${missing.join(', ')}: "${text}"`);
  }
  const amountText = fields.Amount ?? '';
  return {
    id: fields.Id ?? '',
    amount: parseMoney(amountText),
    currency: /[A-Z]{3}/.exec(amountText)?.[0] ?? '',
    cardNumber: fields['Card Number'] ?? '',
    name: fields.Name ?? '',
    date: fields.Date ?? '',
    raw: text,
  };
}

/** SweetAlert shown after a successful purchase. */
export class OrderConfirmation {
  readonly root: Locator;
  readonly title: Locator;
  readonly body: Locator;
  readonly okButton: Locator;
  /**
   * The alert once its show animation has finished. Before that, SweetAlert
   * closes on "OK" without running the site's callback (no redirect).
   */
  private readonly interactiveRoot: Locator;
  private readonly navbar: Navbar;

  constructor(private readonly page: Page) {
    this.navbar = new Navbar(page);
    this.root = page.locator('.sweet-alert');
    this.interactiveRoot = page.locator('.sweet-alert.visible');
    this.title = this.root.getByRole('heading');
    this.body = this.root.locator('p.lead');
    this.okButton = this.root.getByRole('button', { name: 'OK' });
  }

  /** Waits until the confirmation is displayed. */
  async waitForOpen(): Promise<void> {
    await this.root.waitFor({ state: 'visible' });
  }

  /** Reads and parses the confirmation details. */
  async getReceipt(): Promise<OrderReceipt> {
    await this.waitForOpen();
    return parseOrderReceipt(await this.body.innerText());
  }

  /**
   * Clicks "OK" once the alert is interactive and waits until the site's
   * redirect to the home page is ready for interaction.
   */
  async confirm(): Promise<void> {
    await this.interactiveRoot.waitFor({ state: 'visible' });
    await Promise.all([this.page.waitForURL(HOME_REDIRECT_URL), this.okButton.click()]);
    await this.navbar.waitForReady();
  }
}
