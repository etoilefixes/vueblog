---
name: frontend-optimizer
description: Optimize frontend applications for performance, bundle size, rendering speed, accessibility, and interaction quality. Use when requests mention Lighthouse or Core Web Vitals, slow load or poor responsiveness, oversized JS or CSS bundles, React or Vue rendering bottlenecks, image or font optimization, responsive layout stability issues, or frontend optimization code review.
---

# Frontend Optimizer

## Overview

- Define measurable targets before making changes.
- Improve the highest-impact bottleneck first.
- Validate every optimization with before and after evidence.

## Execution Workflow

1. Confirm scope and constraints.
   - Identify framework, build tool, and rendering strategy.
   - Capture non-functional constraints: SEO, accessibility, browser support, and deployment limits.
2. Establish a baseline.
   - Run project build and existing tests before optimization.
   - Capture initial metrics: LCP, INP, CLS, JS and CSS transfer size, and key route load times.
   - Run `scripts/asset-budget-check.sh` on build output to establish asset-size baselines.
3. Locate the dominant bottleneck.
   - Classify bottleneck as network, bundle, main-thread CPU, rendering churn, layout shift, or media delivery.
   - Load `references/performance-playbook.md` for symptom-to-fix mapping.
4. Apply optimizations in small batches.
   - Prioritize high-impact changes with low regression risk.
   - Keep each change isolated and measurable.
5. Improve interaction and UI reliability.
   - Load `references/ui-polish-playbook.md` for responsive, accessibility, and interaction tuning.
   - Preserve existing design-system conventions unless explicitly asked to redesign.
6. Verify and report.
   - Re-run build, tests, and measurements.
   - Report before and after metrics, tradeoffs, and residual risks.

## Output Requirements

- Provide a short diagnosis of root causes.
- List each optimization with expected impact and possible regressions.
- Include concrete file-level changes when editing code.
- Include metric deltas for each validated improvement.
- Call out unverified assumptions explicitly.

## Guardrails

- Avoid micro-optimizations before fixing major bottlenecks.
- Avoid behavior changes without tests or verification steps.
- Avoid adding heavy dependencies unless benefit is measurable.
- Prefer predictable and maintainable patterns over clever one-offs.

