# Performance Playbook

## 1. Triage by Symptom

- If LCP is high:
  - Reduce render-blocking CSS and JS.
  - Prioritize hero content and critical image delivery.
  - Preload critical fonts and above-the-fold media.
- If INP is high:
  - Reduce long tasks on the main thread.
  - Split expensive work and defer non-critical handlers.
  - Remove unnecessary rerenders and heavy synchronous logic.
- If CLS is high:
  - Reserve media dimensions.
  - Avoid late font swaps that move text blocks.
  - Avoid injecting content above existing content without reserved space.
- If first route load is slow:
  - Split routes and lazy-load non-critical chunks.
  - Audit third-party scripts and remove low-value tags.

## 2. Bundle and Build Strategy

- Enable route-level code splitting.
- Convert rarely used UI blocks to lazy-loaded chunks.
- Remove dead imports and verify tree-shaking effectiveness.
- Prefer lighter alternatives for heavy utility libraries.
- Keep source maps in non-production environments when possible.

## 3. Media and Font Strategy

- Serve responsive images with modern formats when practical.
- Use explicit width and height attributes for all content images.
- Preload only the most critical fonts.
- Limit font families and weights to required variants.
- Use `font-display: swap` or similar behavior based on product goals.

## 4. Runtime Rendering Strategy

- Memoize expensive derived computations in component trees.
- Stabilize props and callbacks that trigger subtree rerenders.
- Virtualize long lists and large tables.
- Avoid layout thrashing by batching reads and writes.
- Use CSS transforms for animations where possible.

## 5. Network and Caching

- Set long-term cache headers for hashed static assets.
- Compress assets and verify content-encoding in deployment.
- Remove duplicate API calls and add request deduplication.
- Prefetch next-route chunks only when likely to be used.

## 6. Verification Checklist

- Rebuild production artifacts.
- Re-run performance measurements on the same scenario.
- Compare key metrics and payload totals before and after changes.
- Confirm no regression in behavior, accessibility, or SEO constraints.

