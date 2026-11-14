import { describe, expect, it } from 'vitest';
import {
  calculateTotals,
  FREE_SHIPPING_THRESHOLD,
  PricingError,
  SHIPPING_FEE,
} from '../../src/pricing.js';
import {
  buildFixedCoupon,
  buildLineItem,
  buildPercentCoupon,
  itemsTotalling,
} from '../factories/pricing.factory.js';

describe('calculateTotals', () => {
  describe('validation', () => {
    it('throws PricingError when there are no items', () => {
      expect(() => calculateTotals([])).toThrow(PricingError);
      expect(() => calculateTotals([])).toThrow(/at least one item/);
    });

    it.each([0, -1, 1.5, Number.NaN])('rejects quantity %s', (quantity) => {
      const items = [buildLineItem({ sku: 'BAD', quantity })];
      expect(() => calculateTotals(items)).toThrow(PricingError);
      expect(() => calculateTotals(items)).toThrow('Invalid quantity for BAD');
    });

    it.each([-1, 10.5, Number.NaN, Number.POSITIVE_INFINITY])('rejects unitPrice %s', (unitPrice) => {
      const items = [buildLineItem({ sku: 'BAD', unitPrice })];
      expect(() => calculateTotals(items)).toThrow(PricingError);
      expect(() => calculateTotals(items)).toThrow('Invalid price for BAD');
    });

    it('names the offending SKU among several items', () => {
      const items = [
        buildLineItem({ sku: 'A' }),
        buildLineItem({ sku: 'B', quantity: 0 }),
        buildLineItem({ sku: 'C' }),
      ];
      expect(() => calculateTotals(items)).toThrow('Invalid quantity for B');
    });

    it.each([-1, 101])('rejects percent coupon %s', (value) => {
      expect(() => calculateTotals(itemsTotalling(1000), buildPercentCoupon(value))).toThrow(PricingError);
      expect(() => calculateTotals(itemsTotalling(1000), buildPercentCoupon(value))).toThrow(
        /between 0 and 100/,
      );
    });

    it('rejects a negative fixed coupon', () => {
      expect(() => calculateTotals(itemsTotalling(1000), buildFixedCoupon(-1))).toThrow(PricingError);
      expect(() => calculateTotals(itemsTotalling(1000), buildFixedCoupon(-1))).toThrow(/cannot be negative/);
    });
  });

  describe('subtotal', () => {
    it('sums multiple items', () => {
      const items = [
        buildLineItem({ sku: 'A', unitPrice: 100, quantity: 3 }),
        buildLineItem({ sku: 'B', unitPrice: 250, quantity: 2 }),
      ];
      expect(calculateTotals(items).subtotal).toBe(800);
    });

    it('allows a unitPrice of 0', () => {
      // NOTE: free items are currently accepted.
      expect(calculateTotals([buildLineItem({ unitPrice: 0 })])).toEqual({
        subtotal: 0,
        discount: 0,
        shipping: SHIPPING_FEE,
        total: SHIPPING_FEE,
      });
    });

    it('counts duplicate SKUs separately', () => {
      const items = [buildLineItem({ unitPrice: 100 }), buildLineItem({ unitPrice: 100, quantity: 2 })];
      expect(calculateTotals(items).subtotal).toBe(300);
    });
  });

  describe('discounts', () => {
    it('is 0 without a coupon', () => {
      expect(calculateTotals(itemsTotalling(1000)).discount).toBe(0);
    });

    it('is 0 for a 0 percent coupon', () => {
      expect(calculateTotals(itemsTotalling(1000), buildPercentCoupon(0)).discount).toBe(0);
    });

    it('equals the subtotal for a 100 percent coupon', () => {
      expect(calculateTotals(itemsTotalling(1000), buildPercentCoupon(100))).toEqual({
        subtotal: 1000,
        discount: 1000,
        shipping: SHIPPING_FEE,
        total: SHIPPING_FEE,
      });
    });

    it('rounds half up for 10 percent of 12345', () => {
      expect(calculateTotals(itemsTotalling(12345), buildPercentCoupon(10)).discount).toBe(1235);
    });

    it('allows fractional percent (12.5 percent of 1000)', () => {
      // NOTE: fractional percentages are not rejected.
      expect(calculateTotals(itemsTotalling(1000), buildPercentCoupon(12.5)).discount).toBe(125);
    });

    it('applies a fixed coupon below the subtotal', () => {
      expect(calculateTotals(itemsTotalling(1000), buildFixedCoupon(300))).toEqual({
        subtotal: 1000,
        discount: 300,
        shipping: SHIPPING_FEE,
        total: 700 + SHIPPING_FEE,
      });
    });

    it('caps a fixed coupon above the subtotal', () => {
      // NOTE: shipping is still charged after the cap.
      expect(calculateTotals(itemsTotalling(1000), buildFixedCoupon(5000))).toEqual({
        subtotal: 1000,
        discount: 1000,
        shipping: SHIPPING_FEE,
        total: SHIPPING_FEE,
      });
    });

    it('caps an Infinity fixed coupon at the subtotal', () => {
      expect(
        calculateTotals(itemsTotalling(1000), buildFixedCoupon(Number.POSITIVE_INFINITY)).discount,
      ).toBe(1000);
    });
  });

  describe('shipping', () => {
    it.each([
      { subtotal: 4999, shipping: SHIPPING_FEE },
      { subtotal: 5001, shipping: 0 },
      { subtotal: 0, shipping: SHIPPING_FEE },
    ])('charges $shipping for a discounted subtotal of $subtotal', ({ subtotal, shipping }) => {
      expect(calculateTotals(itemsTotalling(subtotal)).shipping).toBe(shipping);
    });

    it('charges shipping when 6000 minus a fixed 1001 coupon leaves 4999', () => {
      expect(calculateTotals(itemsTotalling(6000), buildFixedCoupon(1001))).toEqual({
        subtotal: 6000,
        discount: 1001,
        shipping: SHIPPING_FEE,
        total: 4999 + SHIPPING_FEE,
      });
    });

    // FIXME(bug): src/pricing.ts:53 uses `>` but the documented contract is "5000 or more ships free".
    // Expected shipping 0 / total 5000 at exactly 5000, got shipping 599 / total 5599. Severity: Medium.
    it.fails('ships for free when the subtotal is exactly 5000', () => {
      expect(calculateTotals(itemsTotalling(5000))).toEqual({
        subtotal: 5000,
        discount: 0,
        shipping: 0,
        total: 5000,
      });
    });

    // FIXME(bug): src/pricing.ts:53 uses `>` but the documented contract is "5000 or more ships free".
    // Expected shipping 0 / total 5000 when 6000 - 1000 = 5000, got shipping 599 / total 5599. Severity: Medium.
    it.fails('ships for free when the discounted subtotal is exactly 5000 after a fixed coupon', () => {
      expect(calculateTotals(itemsTotalling(6000), buildFixedCoupon(1000))).toEqual({
        subtotal: 6000,
        discount: 1000,
        shipping: 0,
        total: 5000,
      });
    });
  });

  describe('invariants', () => {
    it.each([
      { name: 'no coupon', items: itemsTotalling(3333), coupon: undefined },
      { name: 'percent', items: itemsTotalling(12345), coupon: buildPercentCoupon(33) },
      { name: 'fixed', items: itemsTotalling(8000), coupon: buildFixedCoupon(2500) },
      { name: 'capped fixed', items: itemsTotalling(100), coupon: buildFixedCoupon(9999) },
    ])('total = subtotal - discount + shipping with $name', ({ items, coupon }) => {
      const totals = calculateTotals(items, coupon);
      expect(totals.total).toBe(totals.subtotal - totals.discount + totals.shipping);
      expect(totals.discount).toBeGreaterThanOrEqual(0);
      expect(totals.discount).toBeLessThanOrEqual(totals.subtotal);
    });
  });

  describe('unchecked NaN coupon values', () => {
    // NOTE: NaN passes the range checks, so discount and total become NaN.
    it.each([
      { name: 'percent', coupon: buildPercentCoupon(Number.NaN) },
      { name: 'fixed', coupon: buildFixedCoupon(Number.NaN) },
    ])('yields NaN discount and total for a NaN $name coupon', ({ coupon }) => {
      const totals = calculateTotals(itemsTotalling(1000), coupon);
      expect(totals.discount).toBeNaN();
      expect(totals.total).toBeNaN();
      expect(totals.shipping).toBe(SHIPPING_FEE);
    });
  });

  describe('constants', () => {
    it('exposes the documented values', () => {
      expect(SHIPPING_FEE).toBe(599);
      expect(FREE_SHIPPING_THRESHOLD).toBe(5000);
    });
  });
});
