# Backend Performance Playbook

## 1. Triage by Symptom

- If p95 or p99 latency rises with low CPU:
  - Check downstream dependency latency and connection pool saturation.
  - Check lock contention and thread or worker starvation.
- If latency rises with high CPU:
  - Profile hot paths and expensive serialization or parsing.
  - Remove repeated computations and reduce synchronous work.
- If error rate rises with timeout spikes:
  - Verify timeout hierarchy across client, gateway, and service layers.
  - Check retry storms and enforce retry budgets.
- If throughput stalls while queue depth grows:
  - Identify consumer bottlenecks and apply backpressure controls.
  - Increase concurrency only after removing single-resource contention.

## 2. Request Path Optimization

- Keep handlers thin and move non-critical work off the request path.
- Reduce synchronous calls per request.
- Use bulk operations where possible to reduce chattiness.
- Shrink payloads and avoid unnecessary transformations.

## 3. Concurrency and Saturation

- Measure worker/thread pool utilization and queue wait time.
- Bound concurrency around scarce resources such as DB and external APIs.
- Apply load shedding for non-critical operations during saturation.
- Set sensible upper bounds for in-flight requests.

## 4. Reliability Controls

- Use timeouts on all network calls.
- Apply retries only on transient failures and only for idempotent operations.
- Add circuit breakers and fallback behavior for unstable dependencies.
- Ensure request cancellation propagates through async chains.

## 5. Verification Checklist

- Re-run tests and benchmarks on the same workload.
- Compare latency percentiles, throughput, and error rate.
- Confirm no correctness regression in edge cases.
- Confirm resource usage is stable at expected traffic.

