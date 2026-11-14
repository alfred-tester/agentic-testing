<!-- agentic-testing:start -->
# Quality Engineering & Testing Orchestration (TypeScript / JavaScript)

This repository follows a structured, multi-agent Quality Engineering workflow powered by three specialized subagents located in `.claude/agents/`.

## Subagent Roster & Delegation Rules

Always delegate testing tasks to the appropriate specialist instead of handling complex QA workflows ad-hoc in the main thread:

1. **`test-architect` (Strategy & Design)**
   - **When to invoke**: Starting a new feature/module test plan, auditing overall test pyramid balance, setting up a new test framework (Vitest, Jest, Playwright, Cypress, CodeceptJS, Supertest, k6, Artillery), refactoring tightly coupled code for testability, or designing CI/CD test pipelines.
   - **Output**: Risk analysis, test layer breakdown, mocking/contract strategy, folder architecture, and an implementation handoff for `test-engineer`.
   - **Constraint**: Design-only. Never writes or modifies files; all implementation goes to `test-engineer`.

2. **`test-engineer` (Implementation & Execution)**
   - **When to invoke**: Writing new unit, integration, API, E2E, or performance tests; building typed test data factories; fixing failing tests; or implementing the architectural plan produced by `test-architect`.
   - **Constraint**: Must run type-checking (`tsc --noEmit`) and execute the test suite until green before finishing.

3. **`test-quality-reviewer` (Read-Only Pre-Merge Audit)**
   - **When to invoke**: Before committing, opening a Pull Request, or after `test-engineer` finishes a large suite.
   - **Constraint**: Strictly read-only diagnostic audit. If the verdict is `NEEDS_IMPROVEMENT`, route the blocking findings back to `test-engineer` for remediation (at most 3 review rounds; then report unresolved findings). `APPROVE` requires zero Critical/High issues and a passing type-check and test run.

## Standard End-to-End QA Workflow

For major features or new test suites, execute this sequence:
1. **Plan**: Invoke `test-architect` to inspect the stack (`package.json`, `tsconfig.json`) and define the strategy.
2. **Build**: Pass the architect's plan to `test-engineer` to write, type-check, and run the tests.
3. **Verify**: Invoke `test-quality-reviewer` on the git diff or new files to confirm an `APPROVE` verdict.

*(For quick bug-fix regression tests or single-function unit tests, you may invoke `test-engineer` directly, followed by `test-quality-reviewer` if critical business logic is touched.)*

## Non-Negotiable Repository Testing Standards
- **Strict TypeScript**: Zero `any`, `@ts-ignore`, or unsafe casts in test files and factories.
- **Zero Flakiness**: Fixed sleeps (`setTimeout`, `waitForTimeout`, `I.wait(n)`) are forbidden in functional tests. Always use auto-retrying assertions.
- **Runtime Contract Validation**: API tests (Supertest, Playwright API, CodeceptJS `REST`, PactumJS) must validate response schemas at runtime (Zod, Joi, Ajv, or `JSONResponse`).
- **Performance Thresholds**: Load tests (k6, Artillery, Autocannon) must define explicit `p95`/`p99` latency and error-rate thresholds.

<!-- agentic-testing:end -->
