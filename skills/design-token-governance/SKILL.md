---
name: design-token-governance
description: Govern design token changes with validation, impact analysis, preview discipline, and rollback safety. Use when editing token files, introducing theme revisions, reviewing visual consistency regressions, or enforcing token change policy across admin and frontend surfaces.
---

# Design Token Governance

## Overview

- Make token changes explicit, reviewable, and reversible.
- Prevent accidental visual regressions from token drift.
- Protect core semantic tokens with stricter controls.

## Execution Workflow

1. Classify token change.
   - Identify semantic, component, or experimental token scope.
2. Validate structure.
   - Run `scripts/token-diff-check.sh <old.json> <new.json>`.
   - Detect removals, protected-key changes, and large blast radius updates.
3. Assess UI impact.
   - Map changed tokens to affected views and components.
   - Verify mobile and desktop critical screens.
4. Release safely.
   - Version token revisions and keep rollback reference.
   - Publish only with visual diff evidence.
5. Document outcomes.
   - Record change intent and affected modules.

## Output Requirements

- List changed token keys by category.
- Mark protected token changes explicitly.
- Include rollback plan and validation screenshots checklist.

## Guardrails

- Avoid deleting semantic tokens without migration.
- Avoid unscoped global token changes.
- Avoid shipping token updates without preview evidence.

## Resources

- Token policy: `references/token-policy.md`
- Token diff checker: `scripts/token-diff-check.sh`
