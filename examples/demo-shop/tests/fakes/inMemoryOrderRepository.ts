import type { Coupon } from '../../src/pricing.js';
import type { Order, OrderRepository } from '../../src/orderService.js';

export class InMemoryOrderRepository implements OrderRepository {
  readonly saved: Order[] = [];
  readonly couponLookups: string[] = [];
  private nextSaveError: Error | undefined;

  constructor(private readonly coupons: Record<string, Coupon> = {}) {}

  async findCoupon(code: string): Promise<Coupon | null> {
    this.couponLookups.push(code);
    return this.coupons[code] ?? null;
  }

  async save(order: Order): Promise<void> {
    if (this.nextSaveError) {
      const error = this.nextSaveError;
      this.nextSaveError = undefined;
      throw error;
    }
    this.saved.push(order);
  }

  failNextSaveWith(error: Error): void {
    this.nextSaveError = error;
  }
}
