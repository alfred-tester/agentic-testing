import type { Coupon, LineItem } from '../../src/pricing.js';

export function buildLineItem(overrides: Partial<LineItem> = {}): LineItem {
  return { sku: 'SKU-1', unitPrice: 1000, quantity: 1, ...overrides };
}

export function buildPercentCoupon(value: number): Coupon {
  return { kind: 'percent', value };
}

export function buildFixedCoupon(value: number): Coupon {
  return { kind: 'fixed', value };
}

/** A single line item whose line total equals `cents`. */
export function itemsTotalling(cents: number): LineItem[] {
  return [buildLineItem({ unitPrice: cents, quantity: 1 })];
}
