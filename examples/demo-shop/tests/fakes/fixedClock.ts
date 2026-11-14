import type { Clock } from '../../src/orderService.js';

export function fixedClock(date: Date = new Date('2026-01-01T00:00:00.000Z')): Clock {
  return { now: () => new Date(date.getTime()) };
}
