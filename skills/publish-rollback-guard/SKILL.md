---
name: publish-rollback-guard
description: Protect release workflows with deterministic pre-publish checks, change review gates, and rollback readiness validation. Use when preparing production releases, validating publish notes, checking rollback safety, or reducing release regressions for content and configuration updates.
---

# Publish Rollback Guard

## Overview

- Block risky releases before publish.
- Keep rollback readiness verifiable at all times.
- Require release intent and validation evidence.

## Execution Workflow

1. Prepare release intent.
   - Require a release note with scope, risk, and rollback trigger.
2. Run preflight checks.
   - Run `scripts/publish-preflight-check.sh "<release-note>"`.
   - Ensure build, type-check, contract, and security gates pass.
3. Verify rollback path.
   - Confirm target rollback version exists and is valid.
   - Confirm database and cache invalidation strategy is known.
4. Approve and execute.
   - Publish only with complete evidence.
   - Record publish and rollback metadata in audit trail.

## Output Requirements

- Report preflight stage results.
- Record release note and rollback target.
- List unresolved risks and escalation path.

## Guardrails

- Avoid publishing without rollback path.
- Avoid skipping mandatory gates under time pressure.
- Avoid undocumented schema or contract changes in release bundles.

## Resources

- Release checklist: `references/release-checklist.md`
- Preflight script: `scripts/publish-preflight-check.sh`
