# Gate Catalog

## Baseline Gates

- Frontend type-check
- Frontend production build
- Backend type-check
- Backend production build
- API contract drift check
- Security baseline check

## Optional Gates

- Migration dry-run check
- Contract test suite
- Smoke e2e checks on critical routes

## Failure Reporting

- Print stage label before each command.
- Print failing command and exit code.
- Exit non-zero if any mandatory stage fails.
