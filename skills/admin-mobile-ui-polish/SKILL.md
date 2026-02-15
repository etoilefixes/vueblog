---
name: admin-mobile-ui-polish
description: Improve admin mobile UX for completion speed, readability, and operational safety. Use when refining mobile layouts, card and form density, touch interactions, task flows, fixed action bars, or final UI quality checks for admin pages.
---

# Admin Mobile UI Polish

## Overview

- Optimize for task completion on small screens.
- Keep actions visible and low-friction.
- Preserve consistency across admin modules.

## Execution Workflow

1. Define target flows.
   - Focus on high-frequency flows such as edit, publish, comment moderation, and rollback.
2. Audit mobile layout.
   - Apply card-first list rendering.
   - Enforce tap target and spacing rules.
3. Improve action ergonomics.
   - Use fixed bottom action bar for critical save and publish actions.
   - Minimize modal stacking; prefer drawers where practical.
4. Validate reliability.
   - Verify keyboard, safe-area, and rotation behavior.
   - Verify loading, empty, and error states.
5. Verify completion outcomes.
   - Measure step count and visible-action ratio for each critical flow.

## Output Requirements

- Report completed flow checks and unresolved friction points.
- List responsive changes with exact file references.
- Include before and after behavior notes for mobile breakpoints.

## Guardrails

- Avoid desktop-first layouts squeezed onto mobile.
- Avoid hidden primary actions behind deep menus.
- Avoid dense tables without card fallback.

## Resources

- Mobile checklist: `references/mobile-checklist.md`
- Task flows: `references/task-flows.md`
