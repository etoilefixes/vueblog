---
name: ci-quality-gate
description: Build and enforce repeatable CI quality gates for frontend and backend delivery. Use when setting up build and test pipelines, adding release checks, defining required status checks, reducing regressions, or standardizing pre-merge and pre-release validation.
---

# CI Quality Gate

## Overview

- Convert manual checks into deterministic gate scripts.
- Fail fast on contract drift and type regressions.
- Keep gate output concise and actionable.

## Execution Workflow

1. Define required checks.
   - Frontend: type-check, build, and critical smoke checks.
   - Backend: type-check, build, migration safety checks.
2. Encode checks in one entrypoint.
   - Run `scripts/run-quality-gate.sh` locally and in CI.
   - Keep failures isolated by check name.
3. Add policy.
   - Mark mandatory checks for merge.
   - Require green gates before publish.
4. Verify and iterate.
   - Tune runtime and flaky checks.
   - Keep output stable for quick diagnosis.

## Output Requirements

- List gate stages and pass or fail status.
- Print failing command and exit code.
- Provide minimum rerun command for local debugging.

## Guardrails

- Avoid hidden side effects in gate scripts.
- Avoid non-deterministic checks without retries and diagnostics.
- Avoid skipping type checks for speed.

## Resources

- Gate design guide: `references/gate-catalog.md`
- Gate runner: `scripts/run-quality-gate.sh`
