import { calculateTotals, type Coupon, type LineItem, type OrderTotals } from './pricing.js';

export interface Order {
  id: string;
  customerId: string;
  items: LineItem[];
  totals: OrderTotals;
  createdAt: Date;
}

export interface OrderRepository {
  save(order: Order): Promise<void>;
  findCoupon(code: string): Promise<Coupon | null>;
}

export interface Clock {
  now(): Date;
}

export class CouponNotFoundError extends Error {}

export class OrderService {
  constructor(
    private readonly repo: OrderRepository,
    private readonly clock: Clock,
    private readonly generateId: () => string,
  ) {}

  async placeOrder(customerId: string, items: LineItem[], couponCode?: string): Promise<Order> {
    let coupon: Coupon | undefined;
    if (couponCode) {
      const found = await this.repo.findCoupon(couponCode.trim().toUpperCase());
      if (!found) {
        throw new CouponNotFoundError(`Coupon ${couponCode} not found`);
      }
      coupon = found;
    }

    const order: Order = {
      id: this.generateId(),
      customerId,
      items,
      totals: calculateTotals(items, coupon),
      createdAt: this.clock.now(),
    };

    await this.repo.save(order);
    return order;
  }
}
