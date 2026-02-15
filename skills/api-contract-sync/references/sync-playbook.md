# API Contract Sync Playbook

## Endpoint Map Template

- Path and method
- Auth requirement
- Request schema and validation source
- Response schema and error model
- Frontend call site
- Backend handler and tests

## Drift Types

- Missing endpoint in frontend registry
- Missing handler for documented endpoint
- Field mismatch between docs and TypeScript types
- Error model mismatch across layers

## Review Rules

- Include docs, types, and handlers in one PR when endpoint shape changes.
- Add migration notes for breaking changes.
- Confirm error codes and `requestId` support stay consistent.
