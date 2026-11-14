<!-- Verbatim output from a real /agentic-testing run; only absolute paths were made relative. -->
# Final deliverable — `/agentic-testing` orchestrator (sonnet): executive summary

## Executive summary: `src/` QA pipeline

**Verdict: APPROVE after 1 review round.** There were no Critical or High findings, so the self-correction loop wasn't needed.

### Strategy
The code under test is a pure pricing function (`src/pricing.ts`) and an `OrderService` whose dependencies are injected (`src/orderService.ts`). The plan was:
- **Unit tests** for `calculateTotals`, using `it.each` tables for boundaries.
- **Service tests** for `OrderService`, using in-memory fakes and a fixed clock and ID generator.
- **Layers left out:** API, performance, repository contract and property-based tests. There's no HTTP layer, and `fast-check` isn't installed.

### Files created (all under `tests/`)
- `factories/pricing.factory.ts`
- `fakes/inMemoryOrderRepository.ts`
- `fakes/fixedClock.ts`
- `fakes/sequentialIdGenerator.ts`
- `unit/pricing.test.ts` (37 tests)
- `unit/orderService.test.ts` (11 tests)

I made no production code changes.

### Execution status
- `npm run typecheck`: clean.
- `npm test`: 48 tests pass in 2 files. 46 are regular passes and 2 are the expected-failure `it.fails` tests for the bug below.
- I didn't re-run these myself; the status comes from the `test-engineer` and `test-quality-reviewer` reports.

### Known source bug (`FIXME(bug)`)
- **Shipping threshold off by one, Medium severity, `src/pricing.ts:53`.**
- The code uses `discounted > FREE_SHIPPING_THRESHOLD`, but the doc comment says 5000 cents or more ships free.
- An order at exactly 5000 gets shipping 599 and total 5599, instead of shipping 0 and total 5000.
- Two tests cover it, at `tests/unit/pricing.test.ts:152-161` (no coupon) and `:163-172` (6000 minus a fixed 1000 coupon).
- The fix is to change `>` to `>=`. Then remove `it.fails` from both tests.

### Remaining findings (Medium and Low)
**Medium**
- `pricing.test.ts:189-199`: the NaN-coupon tests assert that `discount` and `total` come out as NaN. That likely locks in a defect, since NaN passes the range checks. If the product owner says it must throw, convert them to `it.fails` with `FIXME(bug)`.
- `orderService.test.ts:57-61`: a whitespace-only coupon is looked up as `''`. This characterization test needs a decision on whether the behaviour is intended.
- `orderService.test.ts:102-106`: `order.items` is the caller's array. This one also needs an intent decision.

**Low**
- `orderService.test.ts:89-100`: the call-order test is convoluted and contains a weak `toBeDefined` assertion.
- `pricing.test.ts:17-52`: several tests call `calculateTotals` twice, once for the error type and once for the message.
- `pricing.test.ts:203-206`: the constants test only restates the constants.
- `pricing.test.ts:178-180`: `itemsTotalling` runs at collection time in the `it.each` table.

**Missing scenarios the reviewer suggested**
- Exact-half rounding, such as 5% of 10.
- A 100% coupon on a subtotal above 5000.
- A percent coupon that moves the discounted subtotal across the threshold.
- A repository `findCoupon` that throws.
- Overflow past `Number.MAX_SAFE_INTEGER`.
- A percent coupon of `Infinity`.
