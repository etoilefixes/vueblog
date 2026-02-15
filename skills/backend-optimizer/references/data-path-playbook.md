# Data Path Playbook

## 1. Database Optimization

- Eliminate N+1 query patterns.
- Add or adjust indexes based on actual filter and join predicates.
- Keep transactions short and avoid unnecessary lock duration.
- Fetch only required columns and paginate heavy result sets.
- Use prepared statements or query plan caching where applicable.

## 2. Cache Strategy

- Cache expensive reads with explicit TTL and invalidation strategy.
- Add cache key versioning for schema or logic changes.
- Prevent stampedes with request coalescing or soft expiration.
- Track hit ratio and stale-read risk before expanding cache scope.

## 3. Queue and Async Workflows

- Move non-critical side effects off the synchronous request path.
- Bound consumer concurrency to protect downstream dependencies.
- Use dead-letter handling and idempotency keys for retries.
- Monitor queue lag and processing failure rates.

## 4. API and Serialization

- Trim response payload fields for high-volume endpoints.
- Use compact formats only where measurable and justified.
- Compress payloads for larger responses.
- Avoid repeated serialization for duplicate response fragments.

## 5. Observability for the Data Path

- Record per-endpoint latency percentiles and error rates.
- Track DB query count and total DB time per request.
- Track cache hit ratio and fallback latency.
- Track queue enqueue-to-complete duration.

