---
name: backend-optimizer
description: Optimize backend services for latency, throughput, reliability, and cost efficiency. Use when requests mention slow APIs, high p95 or p99 latency, error-rate spikes, DB bottlenecks, N+1 queries, cache miss problems, queue backlog, CPU or memory pressure, timeout and retry storms, connection-pool tuning, or backend optimization code review.
---

# Backend Optimizer

## Overview

- Define service-level targets before changing code.
- Fix the dominant bottleneck first.
- Validate every change with before-and-after metrics.

## Execution Workflow

1. Confirm scope and constraints.
   - Identify service type, traffic profile, and critical endpoints.
   - Confirm SLO/SLA targets and non-functional constraints.
2. Establish a baseline.
   - Capture latency percentiles, error rate, throughput, CPU, memory, and saturation.
   - Run `scripts/endpoint-latency-report.sh <log.csv>` for endpoint-level latency and error summaries.
3. Locate the dominant bottleneck.
   - Classify bottlenecks: compute, I/O, database, cache, queue, lock contention, or downstream dependencies.
   - Load `references/performance-playbook.md` for symptom-to-fix mapping.
4. Optimize the data path.
   - Reduce query count, tune indexes, and cut payload overhead.
   - Improve cache strategy and queue backpressure handling.
   - Load `references/data-path-playbook.md` for database, cache, and queue patterns.
5. Validate resilience.
   - Verify timeout budgets, retry policy, circuit-breaking behavior, and graceful degradation.
6. Verify and report.
   - Re-run benchmarks and tests on the same scenario.
   - Report metric deltas and any tradeoffs.

## Output Requirements

- Provide root-cause diagnosis in one short section.
- List each optimization with expected impact and regression risks.
- Include concrete file-level changes for code edits.
- Include measured deltas for p95/p99 latency, throughput, and error rate.
- Call out assumptions that were not directly verified.

## Guardrails

- Avoid tuning many layers at once without isolated measurements.
- Avoid retry amplification without strict retry budgets.
- Avoid cache additions without eviction and consistency strategy.
- Prefer maintainable changes over fragile one-off optimizations.

