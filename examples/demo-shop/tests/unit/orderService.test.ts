import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CouponNotFoundError, OrderService } from '../../src/orderService.js';
import { calculateTotals, PricingError, type LineItem } from '../../src/pricing.js';
import { buildLineItem, buildPercentCoupon } from '../factories/pricing.factory.js';
import { fixedClock } from '../fakes/fixedClock.js';
import { InMemoryOrderRepository } from '../fakes/inMemoryOrderRepository.js';
import { sequentialIds } from '../fakes/sequentialIdGenerator.js';

const NOW = new Date('2026-01-01T00:00:00.000Z');

describe('OrderService.placeOrder', () => {
  let repo: InMemoryOrderRepository;
  let service: OrderService;
  let items: LineItem[];

  beforeEach(() => {
    repo = new InMemoryOrderRepository({ SAVE10: buildPercentCoupon(10) });
    service = new OrderService(repo, fixedClock(NOW), sequentialIds());
    items = [buildLineItem({ unitPrice: 2000, quantity: 2 })];
  });

  it('places an order without a coupon', async () => {
    const order = await service.placeOrder('cust-1', items);

    expect(order).toEqual({
      id: 'order-1',
      customerId: 'cust-1',
      items,
      totals: calculateTotals(items),
      createdAt: NOW,
    });
    expect(repo.saved).toStrictEqual([order]);
    expect(repo.couponLookups).toEqual([]);
  });

  it('normalises the coupon code and applies the discount', async () => {
    const order = await service.placeOrder('cust-1', items, '  save10 ');

    expect(repo.couponLookups).toEqual(['SAVE10']);
    expect(order.totals.discount).toBe(400);
    expect(order.totals).toEqual(calculateTotals(items, buildPercentCoupon(10)));
  });

  it('throws CouponNotFoundError naming the code as typed and saves nothing', async () => {
    const promise = service.placeOrder('cust-1', items, ' nope ');

    await expect(promise).rejects.toThrow(CouponNotFoundError);
    await expect(promise).rejects.toThrow(' nope ');
    expect(repo.saved).toEqual([]);
  });

  it('skips lookup for an empty coupon code', async () => {
    await service.placeOrder('cust-1', items, '');
    expect(repo.couponLookups).toEqual([]);
  });

  it('looks up an empty code for a whitespace-only coupon', async () => {
    // NOTE: "   " is truthy, so it is trimmed to '' and looked up, which yields CouponNotFoundError.
    await expect(service.placeOrder('cust-1', items, '   ')).rejects.toThrow(CouponNotFoundError);
    expect(repo.couponLookups).toEqual(['']);
  });

  it('rejects empty items with PricingError and does not save', async () => {
    await expect(service.placeOrder('cust-1', [])).rejects.toThrow(PricingError);
    expect(repo.saved).toEqual([]);
  });

  it('propagates a save failure', async () => {
    repo.failNextSaveWith(new Error('db down'));
    await expect(service.placeOrder('cust-1', items)).rejects.toThrow('db down');
    expect(repo.saved).toEqual([]);
  });

  it('generates sequential ids and saves in order', async () => {
    const first = await service.placeOrder('cust-1', items);
    const second = await service.placeOrder('cust-2', items);

    expect([first.id, second.id]).toEqual(['order-1', 'order-2']);
    expect(repo.saved).toStrictEqual([first, second]);
  });

  it('consumes an id even when pricing fails', async () => {
    // NOTE: generateId runs before calculateTotals, so a failed order burns an id.
    await expect(service.placeOrder('cust-1', [])).rejects.toThrow(PricingError);
    const order = await service.placeOrder('cust-1', items);
    expect(order.id).toBe('order-2');
  });

  it('looks up the coupon before saving', async () => {
    const findCoupon = vi.spyOn(repo, 'findCoupon');
    const save = vi.spyOn(repo, 'save');

    await service.placeOrder('cust-1', items, 'SAVE10');

    const findOrder = findCoupon.mock.invocationCallOrder[0];
    const saveOrder = save.mock.invocationCallOrder[0];
    expect(findOrder).toBeDefined();
    expect(saveOrder).toBeDefined();
    expect(findOrder).toBeLessThan(saveOrder ?? Number.NEGATIVE_INFINITY);
  });

  it('keeps the caller array as order.items', async () => {
    // NOTE: items are not copied, so later caller mutation leaks into the order.
    const order = await service.placeOrder('cust-1', items);
    expect(order.items).toBe(items);
  });
});
