---
name: api-contract-sync
description: Synchronize API contracts, frontend endpoint definitions, request and response types, and backend handlers. Use when adding or changing endpoints, updating API documentation, resolving contract drift, reviewing breaking API changes, or validating docs-to-code consistency across frontend and backend.
---

# API Contract Sync

## Overview

- Keep documentation, types, and handlers aligned in the same change set.
- Detect contract drift before release.
- Treat incompatible changes as explicit, reviewed decisions.

## Execution Workflow

1. Identify contract sources.
   - Read API docs files such as `docs/backend-api-contract.md`.
   - Read frontend endpoint registries such as `src/services/blog-api.ts` and `src/services/admin-api.ts`.
   - Read backend route handlers and schemas under `backend/src`.
2. Build an endpoint map.
   - Map each endpoint path to request type, response type, and handler.
   - Highlight missing links between docs, types, and code.
3. Detect drift.
   - Run `scripts/contract-drift-check.sh` for path-level mismatch detection.
   - Compare names, field optionality, enums, and error models.
4. Apply sync updates.
   - Update docs, types, and handlers together.
   - Keep breaking changes explicit and versioned.
5. Verify.
   - Run type-check and build for frontend and backend.
   - Re-run drift check to confirm no mismatch remains.

## Output Requirements

- Summarize contract changes endpoint by endpoint.
- Mark breaking and non-breaking changes separately.
- Include exact files updated for docs, types, and handlers.
- Include residual risks and follow-up migrations.

## Guardrails

- Avoid updating docs without code updates for the same endpoint.
- Avoid silent field renames without compatibility notes.
- Avoid ambiguous error responses across endpoints.

## Resources

- Drift checklist: `references/sync-playbook.md`
- Drift checker: `scripts/contract-drift-check.sh`
