# Backend Security Checklist

## Authentication and Session

- Hash passwords with strong algorithms.
- Store refresh tokens safely and support revocation.
- Keep access token TTL short and rotate secrets safely.

## Authorization

- Enforce RBAC on every write route.
- Protect critical actions with stricter permission checks.
- Prevent last-admin lockout in access management flows.

## Input and Content Safety

- Validate request payloads on every route.
- Enforce strict schema for upload metadata.
- Sanitize rich text with explicit allow-lists.

## Abuse and Observability

- Apply rate limiting for login, comment, and upload routes.
- Keep request IDs in error responses for tracing.
- Write audit logs for publish, rollback, access, and content writes.
