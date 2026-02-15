---
name: backend-security-hardening
description: Harden backend authentication, authorization, input validation, rate limiting, token lifecycle, and audit logging. Use when implementing or reviewing login flows, RBAC, write-path safeguards, upload security, abuse controls, or backend security regression checks.
---

# Backend Security Hardening

## Overview

- Apply baseline controls before feature expansion.
- Treat every write route as privileged by default.
- Verify controls with repeatable checks.

## Execution Workflow

1. Audit current controls.
   - Validate auth, RBAC checks, input validation, and error hygiene.
   - Run `scripts/security-baseline-check.sh` for fast baseline feedback.
2. Close high-risk gaps first.
   - Add or tighten token, rate limit, and permission checks.
   - Enforce audit logging on critical writes.
3. Validate content and upload paths.
   - Enforce MIME and size restrictions.
   - Add XSS filtering where rich text enters the system.
4. Verify through tests and staged checks.
   - Add abuse scenarios and permission bypass tests.
   - Re-run baseline and CI gates.

## Output Requirements

- List discovered risks by severity.
- Map each risk to specific code and remediation.
- Record what remains unresolved and why.

## Guardrails

- Avoid trusting client role or permission claims.
- Avoid unlimited retries and missing timeout budgets.
- Avoid write routes without audit context.

## Resources

- Security checklist: `references/security-checklist.md`
- Baseline scanner: `scripts/security-baseline-check.sh`
