<!-- Verbatim output from a real /agentic-testing run; only absolute paths were made relative. -->
# Phase 3 — `test-quality-reviewer` (sonnet): pre-merge audit

**1. Verdict: APPROVE**

I found no Critical or High issues. `npm run typecheck` is clean, and `npm test` passes 48 tests in 2 files, which includes the 2 `it.fails` tests. The suite is deterministic and strictly typed. It also covers the validation, discount and shipping boundaries of `calculateTotals` and the `OrderService` flows.

**2. Strengths**
- **Type safety:** `grep` found no `any`, `@ts-ignore` or `as` casts in the test code. The `noUncheckedIndexedAccess` handling at `tests/unit/orderService.test.ts:99` is done without a cast.
- **Determinism:** There are no sleeps and no real clock, because the fixed clock and sequential id fakes are injected.
- **Isolation:** `beforeEach` builds a fresh repo, service and items for every test, so no state leaks between tests.
- **Fakes over mocks:** `InMemoryOrderRepository` is a real fake. `vi.spyOn` is used in only one test, for call ordering, and it is scoped to a per-test instance.
- **Assertions:** They check whole totals objects and error messages, including the SKU named in the message. They also check side effects such as `repo.saved` staying empty and `couponLookups`. The invariants are exercised across several coupon types.
- **Boundaries:** The tests hit 4999, 5000, 5001 and 0 for shipping. They also cover a 100% coupon, rounding at 12345 × 10%, and an Infinity fixed coupon.
- **Source quirks:** Behaviours that look odd are labelled with `// NOTE:` rather than hidden.
- **Factories:** `tests/factories/pricing.factory.ts` is typed and uses `Partial` overrides.

**3. Critical & High Issues (Blocking)**
None.

**4. Medium & Low Suggestions**
- **Medium, `tests/unit/pricing.test.ts:189-199` (NaN coupons):** These tests assert that `discount` and `total` come out as NaN. That locks in behaviour that is very likely a defect, because NaN slips past `< 0` / `> 100` in `src/pricing.ts`. If it is a bug, the correct form is an `it.fails` test asserting a `PricingError`, with a `FIXME(bug)` comment. If it is accepted behaviour, say so in the NOTE. A later fix to the source would break these tests, which is a signal you want to be deliberate.
- **Medium, `tests/unit/orderService.test.ts:57-61` and `:102-106`:** Two more tests pin questionable behaviour: a whitespace-only coupon is looked up as `''`, and `order.items` is the caller's array (`toBe`). They are fine as characterization tests, but the same decision applies: either mark them as expected failures or state the intent explicitly.
- **Low, `tests/unit/orderService.test.ts:89-100`:** The `invocationCallOrder` test is somewhat convoluted. `expect(findOrder).toBeDefined()` is a weak assertion that only exists to satisfy the type checker. Consider asserting on `couponLookups` and `saved` instead, since the lookup must happen before the order exists.
- **Low, `tests/unit/pricing.test.ts:17-52`:** Several tests call `calculateTotals` twice just to check the error type and then the message. Use one `toThrow(...)` check for the message, or a small `captureError` helper.
- **Low, `tests/unit/pricing.test.ts:203-206` (constants test):** It only restates the constants and adds little value. The boundary tests already exercise them.
- **Low, `tests/unit/pricing.test.ts:178-180`:** `it.each` builds the items and coupons at collection time. That is harmless here, but `itemsTotalling` is called when the file loads.

**5. Missing Scenarios Checklist**
- Percent rounding at an exact half (for example 5% of 10, which gives 0.5 and should round to 1).
- A 100% coupon on a subtotal above 5000, to confirm it gives shipping 599 and total 599.
- A percent coupon that moves the discounted subtotal across the threshold, in both directions (for example 6000 with 20% gives 4800, so shipping is charged).
- A multi-item order with a quantity above 1 combined with a coupon, going through the service.
- `placeOrder` with a lowercase code that matches nothing, plus a stored coupon whose own invalid value surfaces as a `PricingError`.
- A rejection from `findCoupon` itself (the repository throws), checking that nothing is saved.
- Very large quantities or prices that exceed `Number.MAX_SAFE_INTEGER` (overflow is not guarded in the source).
- A coupon with `value` of `Infinity` for percent, which is rejected by the range check.

**6. Known Source Bugs**
Both are verified against `src/pricing.ts`.

- **Shipping threshold off by one, severity Medium, source `src/pricing.ts:53`.** The line is `discounted > FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE`. The doc comment at line 19 says "5000 cents or more ship for free", so the `>` should be `>=`. A discounted subtotal of exactly 5000 gives shipping 599 and total 5599 instead of shipping 0 and total 5000. This matches the failure message test-engineer reported (`shipping: 0` vs `599`, `total: 5599`).
  - `tests/unit/pricing.test.ts:152-161`: `ships for free when the subtotal is exactly 5000`, no coupon.
  - `tests/unit/pricing.test.ts:163-172`: `ships for free when the discounted subtotal is exactly 5000 after a fixed coupon`, 6000 minus 1000.
  - Both `FIXME(bug)` comments give the location, expected versus actual, and severity, and both assertions target the correct behaviour narrowly.
