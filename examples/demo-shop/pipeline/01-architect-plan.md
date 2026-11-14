<!-- Verbatim output from a real /agentic-testing run; only absolute paths were made relative. -->
# Phase 1 — `test-architect` (opus): architecture & risk plan

# Test Plan: `src/` (demo-shop)

## 1. What the project uses today

- **Tools:** TypeScript ^5.6 and Vitest ^3.0. Nothing else is installed: no Zod, no fast-check, no coverage provider, no HTTP or end-to-end tooling.
- **TypeScript settings:** `strict: true` and `noUncheckedIndexedAccess: true` are on. `tsconfig.json` already includes `tests/`, so test files are type-checked by `npm run typecheck`. The type-check passes cleanly right now.
- **Module setup:** the project is ESM (`"type": "module"`) and imports use `.js` extensions (`./pricing.js`). Tests must import the same way, e.g. `../../src/pricing.js`.
- **Vitest config:** there is no `vitest.config.ts`, so Vitest's defaults apply and pick up `tests/**/*.test.ts`. Commit `56b22fe` ("drop vitest globals types") means tests must import `describe`, `it`, `expect` and `vi` from `'vitest'` explicitly.
- **Existing tests:** none yet. This plan sets the conventions.
- **Code under test:**
  - `src/pricing.ts`: a pure function, `calculateTotals`, plus the constants `SHIPPING_FEE = 599`, `FREE_SHIPPING_THRESHOLD = 5000` and the error class `PricingError`.
  - `src/orderService.ts`: `OrderService`. Its database (`OrderRepository`), clock (`Clock`) and ID generator (`generateId`) are passed in through the constructor. No refactoring is needed to make it testable.

## 2. Risks

### Bug found in the source (must be tested as a known bug)

**Location:** `src/pricing.ts:53`

```ts
/** Orders with a discounted subtotal of 5000 cents (50.00) or more ship for free. */
...
const shipping = discounted > FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;
```

The comment promises free shipping at 5000 cents "or more", but the code uses `>`. An order that comes to exactly 5000 cents is charged shipping.

- **Expected:** `shipping: 0`, `total: 5000`
- **Actual:** `shipping: 599`, `total: 5599`
- **Severity:** Medium. Customers are overcharged at the exact threshold, and the bug also hits orders that a coupon brings down to exactly 5000.
- **How to test it:** keep the test asserting the correct behaviour, mark it `it.fails`, and add a `FIXME(bug)` comment. Do not change `src/`.

### Inputs that are not checked (record what happens; don't count as bugs unless the product owner says so)

- **Coupon value `NaN` (percent or fixed):** it passes the range checks because `NaN < 0` and `NaN > 100` are both false. The result is `discount: NaN` and `total: NaN`. The test should assert this current behaviour and add a `// NOTE:` comment flagging it for product review. If the product owner says it must throw, it becomes `it.fails` with `FIXME(bug)`, severity High.
- **Fractional percent (e.g. 12.5):** allowed. It is rounded with `Math.round`, which rounds halves up. Pin a case where the rounding matters.
- **Fixed coupon bigger than the subtotal:** the discount is capped at the subtotal, so the discounted amount is 0. Shipping is then still charged (599), which matches the comment. Pin this.
- **`unitPrice: 0`:** allowed. An order of only free items has total 599.
- **Whitespace-only coupon code (`"   "`):** the code is truthy, so it is trimmed and `findCoupon("")` is called, which most likely ends in `CouponNotFoundError`. An empty string `""` is treated as "no coupon" and skips the lookup. Pin both behaviours.
- **Order of operations in `placeOrder`:** `generateId()` runs before `calculateTotals`. When pricing fails, an ID has already been used up. More importantly, `save` must not be called when pricing fails or the coupon is not found.
- **`order.items`** is the caller's own array, not a copy. Low risk; one test documents it.

### Riskiest paths, highest first

1. Shipping-threshold boundaries (4999 / 5000 / 5001), measured after the discount.
2. Discount maths: rounding, capping, and the 0 and 100 percent edges.
3. Input validation in `calculateTotals`.
4. Coupon lookup (normalising the code, and not-found handling) and whether `save` is called.

### Flakiness

None expected. The service uses an injected `Clock` and ID generator, so no test touches real time or randomness.

## 3. Test layers

| Layer | In scope? | Reason |
|---|---|---|
| Static analysis | Yes | `npm run typecheck` is the first gate and also covers `tests/`. |
| Unit: `calculateTotals` | Yes, main focus | Pure business logic with many boundaries. Use table-driven `it.each`. |
| Unit / service: `OrderService` | Yes | Use in-memory fakes. Check what ends up saved, and spy on calls only where order or absence of a call matters. |
| Property-based | Optional | Needs `fast-check`, which is not installed. Only add it with user approval. |
| Repository contract | Deferred | There is no real `OrderRepository` implementation yet. When one is added, write a reusable `runOrderRepositoryContract(factory)` suite and validate coupon data from the database at runtime (Zod), because TypeScript types say nothing about what the database actually returns. |
| API / end-to-end | Not applicable | There is no HTTP layer or UI. |
| Performance | Not applicable | Pure, in-memory, O(n). No latency targets or I/O to measure. Add k6 only once an HTTP endpoint exists. |

**Mocking approach:** use hand-written, typed fakes rather than `vi.mock` on modules. Keep `calculateTotals` real inside the service tests, since it is a cheap pure dependency. Use `vi.fn<OrderRepository['save']>()` only to check call order or that `save` was never called.

## 4. File structure

```
tests/
  factories/
    pricing.factory.ts        buildLineItem, buildPercentCoupon, buildFixedCoupon
  fakes/
    inMemoryOrderRepository.ts
    fixedClock.ts
    sequentialIdGenerator.ts
  unit/
    pricing.test.ts
    orderService.test.ts
  property/                   (optional, only if fast-check is approved)
    pricing.property.test.ts
```

No `vitest.config.ts` is needed, because the defaults find these files. Do not add a coverage config: `@vitest/coverage-v8` is not installed.

## 5. Handoff for `test-engineer`

Rules for every file below:
- Explicit imports from `'vitest'`.
- `.js` extensions on relative imports.
- No `any`, no `@ts-ignore`, no `as` casts. For invalid-input cases, build objects that are valid TypeScript but carry bad values, e.g. `quantity: 1.5` or `NaN`.

### A. `tests/factories/pricing.factory.ts`
- `buildLineItem(overrides?: Partial<LineItem>): LineItem`. Defaults: `{ sku: 'SKU-1', unitPrice: 1000, quantity: 1 }`.
- `buildPercentCoupon(value: number): Coupon` and `buildFixedCoupon(value: number): Coupon`. Both return the narrowed union member.
- `itemsTotalling(cents: number): LineItem[]`. Returns one item with `unitPrice: cents, quantity: 1`. Used for threshold tests.

### B. `tests/fakes/inMemoryOrderRepository.ts`
- `class InMemoryOrderRepository implements OrderRepository`.
- Public fields: `readonly saved: Order[]` and `readonly couponLookups: string[]`.
- Constructor takes `coupons: Record<string, Coupon> = {}`.
- `findCoupon` records the code it was called with and returns the coupon or `null`.
- `failNextSaveWith(error: Error)` makes the next `save` reject.

### C. `tests/fakes/fixedClock.ts` and `tests/fakes/sequentialIdGenerator.ts`
- `fixedClock(date = new Date('2026-01-01T00:00:00.000Z')): Clock`
- `sequentialIds(prefix = 'order-'): () => string`. Returns `order-1`, `order-2`, and so on.

### D. `tests/unit/pricing.test.ts`

**Validation.** Each case throws `PricingError`; use `toThrow(PricingError)` and also match the message.
- Empty items → "at least one item".
- Quantity of `0`, `-1`, `1.5`, `NaN` → "Invalid quantity for <sku>". Check that the message names the right SKU when several items are passed.
- Unit price of `-1`, `10.5`, `NaN`, `Infinity` → "Invalid price for <sku>".
- Percent coupon of `-1` or `101` → error. Fixed coupon of `-1` → error.

**Subtotal**
- Several items with quantities greater than 1, summed correctly.
- `unitPrice: 0` is accepted.
- Duplicate SKUs are summed as separate lines.

**Discounts**
- No coupon → discount 0.
- Percent 0 → discount 0.
- Percent 100 → discount equals the subtotal and the discounted amount is 0.
- Percent 10 of 12345 → `Math.round(1234.5) = 1235`, which pins the half-up rounding.
- Fractional percent 12.5 of 1000 → 125.
- Fixed coupon smaller than the subtotal is subtracted in full.
- Fixed coupon larger than the subtotal is capped at the subtotal.
- Fixed `Infinity` is capped at the subtotal.

**Shipping** (write as an `it.each` table over the discounted amount)
- 4999 → 599.
- 5001 → 0.
- 0 → 599.
- 6000 with a fixed 1001 coupon → discounted 4999 → 599. This proves the threshold uses the discounted amount, not the original subtotal.
- **`it.fails`:** discounted exactly 5000 → expect `shipping: 0, total: 5000`. Write it twice: once with no coupon, and once as 6000 minus a fixed 1000 coupon. Add the `FIXME(bug)` comment: `src/pricing.ts:53`, uses `>` instead of `>=`, expected shipping 0 / total 5000, actual 599 / 5599, severity Medium.

**Invariant**
- For every successful case: `total === subtotal - discount + shipping` and `0 <= discount <= subtotal`. Use `toEqual` on the whole `OrderTotals` object.

**Inputs that are not checked** (assert current behaviour, add a `// NOTE:` comment for product review)
- Percent `NaN` → `discount` and `total` are `NaN`.
- Fixed `NaN` → `discount` and `total` are `NaN`.

**Constants**
- `SHIPPING_FEE === 599` and `FREE_SHIPPING_THRESHOLD === 5000`. This guards against someone changing them silently.

### E. `tests/unit/orderService.test.ts`

Create a fresh service in `beforeEach` (or a local `setup()` helper) so no state leaks between tests.

**Happy path, no coupon**
- The returned order has `id: 'order-1'`, the customer ID passed in, the same items, the correct totals, and `createdAt` equal to the clock's date.
- `repo.saved` holds exactly that order, compared with `toStrictEqual`.
- `findCoupon` is never called.

**Valid coupon**
- The code is normalised before lookup: `'  save10 '` → `couponLookups` is `['SAVE10']`.
- The discount is applied to the totals.

**Coupon not found**
- Rejects with `CouponNotFoundError`. The message contains the code exactly as the customer typed it, not the normalised one.
- `repo.saved` stays empty.

**Empty string coupon**
- `''` → no lookup happens and the order is placed without a discount.

**Whitespace-only coupon**
- `'   '` → `findCoupon('')` is called and the call rejects with `CouponNotFoundError`. Add a `// NOTE:` comment flagging this behaviour.

**Pricing errors**
- An empty items list rejects with `PricingError`.
- `save` is not called; check with `vi.fn` or `saved.length === 0`.

**Save fails**
- After `failNextSaveWith(new Error('db down'))`, the same error comes back out of `placeOrder`.

**Each order gets its own ID**
- Two calls in a row produce `order-1` and `order-2`, and both are saved in that order.

**Order of calls**
- `findCoupon` runs before `save`. Check with `vi.fn` call order (`mock.invocationCallOrder`).

**Items are not copied**
- `order.items` is the same array the caller passed in (`toBe`). This documents the current behaviour.

### F. Optional: `tests/property/pricing.property.test.ts`
Only build this if the user approves `npm i -D fast-check`. Generate valid items and coupons and check:
- the invariant from section D,
- `discount <= subtotal`,
- `shipping ∈ {0, 599}`,
- `total >= 0`.

Keep the generators to values above 5000 or below 5000, so the known threshold bug doesn't cause random failures.

### Commands (run from `.`)
```
npm run typecheck
npm test
npx vitest run tests/unit/pricing.test.ts      # focused run
```
The suite counts as green when the type-check passes and all tests pass. The `it.fails` threshold tests show up as passing, because the bug makes them fail as expected.

### Files
- `src/pricing.ts`
- `src/orderService.ts`
- `package.json`
- `tsconfig.json`
- `AGENTS.md`
