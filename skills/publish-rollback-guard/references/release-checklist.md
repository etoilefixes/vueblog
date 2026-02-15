# Release and Rollback Checklist

## Before Publish

- Release note includes scope and risk.
- Frontend and backend builds pass.
- Contract drift check passes.
- Security baseline check passes.
- Rollback target is identified and reachable.

## During Publish

- Capture request IDs and execution timestamps.
- Record who approved and who executed.
- Monitor errors and latency for early regression signals.

## Rollback Conditions

- Error rate spike above threshold.
- Critical route failure on smoke checks.
- Security regression signal.
