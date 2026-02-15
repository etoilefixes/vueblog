interface EndpointMetricState {
  count: number
  errors: number
  durations: number[]
}

const maxSamplesPerEndpoint = 400
const endpointMetrics = new Map<string, EndpointMetricState>()

const metricKey = (method: string, route: string) => `${method.toUpperCase()} ${route}`

const percentile = (samples: readonly number[], p: number) => {
  if (samples.length === 0) {
    return 0
  }

  const sorted = [...samples].sort((a, b) => a - b)
  const rank = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)

  return sorted[Math.max(0, rank)] ?? 0
}

export const recordRequestMetric = (input: {
  method: string
  route: string
  statusCode: number
  durationMs: number
}) => {
  const key = metricKey(input.method, input.route)
  const current = endpointMetrics.get(key) ?? {
    count: 0,
    errors: 0,
    durations: [],
  }

  current.count += 1

  if (input.statusCode >= 500) {
    current.errors += 1
  }

  current.durations.push(Math.max(0, Number(input.durationMs.toFixed(2))))

  if (current.durations.length > maxSamplesPerEndpoint) {
    current.durations.shift()
  }

  endpointMetrics.set(key, current)
}

export const readServiceMetrics = () => {
  let totalCount = 0
  let totalErrors = 0
  const allDurations: number[] = []

  for (const state of endpointMetrics.values()) {
    totalCount += state.count
    totalErrors += state.errors
    allDurations.push(...state.durations)
  }

  return {
    apiP95Ms: Number(percentile(allDurations, 95).toFixed(2)),
    errorRate: totalCount === 0 ? 0 : Number(((totalErrors / totalCount) * 100).toFixed(2)),
    slowQueries: 0,
  }
}
