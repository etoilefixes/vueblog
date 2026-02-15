# UI Polish Playbook

## 1. Responsive Reliability

- Verify breakpoints with realistic content density.
- Prevent overflow in narrow layouts for tables, tags, and long words.
- Preserve tap target size and spacing on touch devices.
- Keep important actions visible without forced horizontal scrolling.

## 2. Accessibility Baseline

- Ensure color contrast meets baseline requirements for text and controls.
- Keep focus order logical and keyboard traversal complete.
- Add visible focus styles for interactive elements.
- Ensure form controls have clear labels and error messaging.
- Use semantic landmarks and headings to improve navigation.

## 3. Interaction Quality

- Keep transition durations short and purposeful.
- Avoid animation on properties that trigger heavy layout recalculation.
- Provide clear loading, empty, and error states.
- Keep optimistic UI logic reversible when requests fail.

## 4. Perceived Performance

- Use skeletons or progressive placeholders for delayed content.
- Prioritize above-the-fold content and defer non-critical widgets.
- Prevent visual jumps by reserving space for async content.
- Keep spinners as fallback, not the only loading strategy.

## 5. Frontend Review Checklist

- Confirm text remains readable at all supported viewport sizes.
- Confirm controls are reachable by keyboard and screen readers.
- Confirm interaction feedback appears within expected latency.
- Confirm error handling is recoverable and action-oriented.
- Confirm no visual regressions across core routes.

