export interface LineItem {
  sku: string;
  unitPrice: number; // in cents
  quantity: number;
}

export type Coupon =
  | { kind: 'percent'; value: number } // 0-100
  | { kind: 'fixed'; value: number }; // in cents

export interface OrderTotals {
  subtotal: number;
  discount: number;
  shipping: number;
  total: number;
}

export const SHIPPING_FEE = 599;
/** Orders with a discounted subtotal of 5000 cents (50.00) or more ship for free. */
export const FREE_SHIPPING_THRESHOLD = 5000;

export class PricingError extends Error {}

export function calculateTotals(items: LineItem[], coupon?: Coupon): OrderTotals {
  if (items.length === 0) {
    throw new PricingError('Order must contain at least one item');
  }
  for (const item of items) {
    if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
      throw new PricingError(`Invalid quantity for ${item.sku}`);
    }
    if (!Number.isInteger(item.unitPrice) || item.unitPrice < 0) {
      throw new PricingError(`Invalid price for ${item.sku}`);
    }
  }

  const subtotal = items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);

  let discount = 0;
  if (coupon?.kind === 'percent') {
    if (coupon.value < 0 || coupon.value > 100) {
      throw new PricingError('Percent coupon must be between 0 and 100');
    }
    discount = Math.round((subtotal * coupon.value) / 100);
  } else if (coupon?.kind === 'fixed') {
    if (coupon.value < 0) {
      throw new PricingError('Fixed coupon cannot be negative');
    }
    discount = Math.min(coupon.value, subtotal);
  }

  const discounted = subtotal - discount;
  const shipping = discounted > FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;

  return { subtotal, discount, shipping, total: discounted + shipping };
}
