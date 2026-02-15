# Token Policy

## Token Classes

- Semantic tokens: color, spacing, radius, typography, elevation.
- Component tokens: local component-specific aliases.
- Experimental tokens: temporary tokens behind a feature flag.

## Change Rules

- Do not remove semantic tokens without migration notes.
- Keep protected prefixes under explicit review.
- Version every publishable token change.

## Validation Rules

- Run token diff checks before merge.
- Verify key admin and frontend pages after token updates.
- Keep rollback token revision ready.
