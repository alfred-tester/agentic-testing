---
name: agentic-testing
description: Executes the full 3-stage agentic QA pipeline (test-architect -> test-engineer -> test-quality-reviewer) to design, implement, run, and audit automated tests in TypeScript/JavaScript. Use when asked to create a comprehensive test suite, build QA coverage for a module/endpoint, or run a complete end-to-end testing workflow.
argument-hint: [target-file-or-module-or-feature]
---

Execute the complete Quality Engineering workflow for: **$ARGUMENTS**

Follow these three sequential phases strictly using the specialized subagents in `.claude/agents/`:

### Phase 1: Architecture & Risk Analysis (`test-architect`)
1. Invoke the `test-architect` subagent targeting **$ARGUMENTS**.
2. Have it inspect `package.json`, `tsconfig.json`, and existing test conventions to produce a concrete test plan (risk analysis, test pyramid layers, API/contract validation, performance needs if applicable, and file structure).
3. Wait for the architectural plan before writing any code.

### Phase 2: Implementation & Execution (`test-engineer`)
1. Pass the architectural plan from Phase 1 to the `test-engineer` subagent.
2. Have it implement the typed test factories/builders, API/UI helpers, and test suites following strict TypeScript rules (zero `any`, zero fixed sleeps).
3. Ensure `test-engineer` runs `tsc --noEmit` and executes the new test suite until all tests pass.

### Phase 3: Read-Only Pre-Merge Audit (`test-quality-reviewer`)
1. Invoke the `test-quality-reviewer` subagent to audit all newly created or modified test files.
2. **Self-Correction Loop**: If the reviewer returns `NEEDS_IMPROVEMENT` with any **Critical** or **High** issues, pass those specific findings back to `test-engineer` to fix and re-run the tests, then verify again.

### Final Deliverable
Once `test-quality-reviewer` issues an **APPROVE** verdict, present a concise executive summary of:
- The test strategy applied
- Files created/modified
- Test execution and type-check status
- Final quality audit verdict

