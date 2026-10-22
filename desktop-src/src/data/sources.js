// Event sources. Both deliver batches of page events plus a status object, on a timer the caller
// supplies (the plugin's scoped ctx.setTimeout, so everything dies with the plugin).
import { createDemoGenerator, toEvent } from './events.js'

const BACKLOG_VISUALS = 20

/** Classify a ctx.rest failure. */
export function describeRestError(error) {
  const message = String(error?.message ?? error ?? 'Unknown error')
  if (/\b404\b|not found/i.test(message)) {
    return { state: 'backend-missing', error: message }
  }
  return { state: 'backend-error', error: message }
}

/**
 * Polls the backend relay. `rest(path)` is ctx.rest; `schedule(fn, ms)` returns a canceller.
 * onBatch(events, { backlog, gap }) gets validated events; onStatus(status) gets the merged status.
 */
export function createLiveSource({ rest, schedule, onBatch, onStatus, intervalMs = 1000 }) {
  let cursor = 0
  let streamId = null
  let failures = 0
  let cancel = null
  let stopped = false
  let first = true

  async function tick() {
    cancel = null
    let answer
    try {
      answer = await rest(`/events?after=${cursor}&limit=500`)
    } catch (error) {
      if (stopped) return
      failures += 1
      onStatus({ ...describeRestError(error), source: 'live', retry_at: Date.now() + backoff(failures) })
      cancel = schedule(tick, backoff(failures))
      return
    }
    if (stopped) return
    if (!answer || typeof answer !== 'object' || answer.ok === false || !Array.isArray(answer.events)) {
      failures += 1
      const error = answer && typeof answer.error === 'string' ? answer.error : 'The backend sent an unexpected answer.'
      onStatus({ state: 'backend-error', error, source: 'live', retry_at: Date.now() + backoff(failures) })
      cancel = schedule(tick, backoff(failures))
      return
    }
    failures = 0
    if (answer.stream_id !== streamId) {
      // The gateway restarted (new hub): sequence numbers start over.
      if (streamId !== null) cursor = 0
      streamId = typeof answer.stream_id === 'string' ? answer.stream_id : null
    }
    const prefix = `live:${streamId ?? 'x'}:`
    const events = []
    for (const raw of answer.events) {
      const event = toEvent(raw, { idPrefix: prefix, demo: false })
      if (event) events.push(event)
      if (Number.isSafeInteger(raw?.seq) && raw.seq > cursor) cursor = raw.seq
    }
    if (Number.isSafeInteger(answer.seq) && answer.seq > cursor) cursor = answer.seq
    onBatch(events, { backlog: first && events.length > BACKLOG_VISUALS, gap: !first && answer.gap === true })
    first = false
    onStatus({
      source: 'live',
      state: answer.state,
      error: answer.error ?? null,
      retry_at: answer.retry_at ?? null,
      connected_at: answer.connected_at ?? null,
      last_event_at: answer.last_event_at ?? null,
      counter: answer.counter ?? null,
      stats: answer.stats ?? null
    })
    cancel = schedule(tick, intervalMs)
  }

  return {
    start() {
      stopped = false
      first = true
      if (!cancel) cancel = schedule(tick, 0)
    },
    stop() {
      stopped = true
      cancel?.()
      cancel = null
      rest('/stop', { method: 'POST' }).catch(() => {})
    },
    /** Skip any backoff and poll now. */
    retry() {
      if (stopped) return
      cancel?.()
      cancel = schedule(tick, 0)
    }
  }
}

function backoff(failures) {
  return Math.min(15_000, 1000 * 2 ** Math.min(4, failures - 1))
}

/** Simulated events at a live-like pace, delivered in one-second batches like the relay. */
export function createDemoSource({ schedule, onBatch, onStatus, intervalMs = 1000, perSecond = 1.6 }) {
  const next = createDemoGenerator()
  let cancel = null
  let burst = 0

  function tick() {
    const now = Date.now()
    if (burst <= 0 && Math.random() < 0.025) burst = 3 + Math.floor(Math.random() * 4)
    const rate = perSecond * (burst > 0 ? 6 : 0.6 + Math.random() * 0.8)
    burst -= 1
    // Poisson draw for this interval.
    let n = 0
    let p = Math.exp(-rate * (intervalMs / 1000))
    let acc = p
    const u = Math.random()
    while (u > acc && n < 200) {
      n += 1
      p *= (rate * (intervalMs / 1000)) / n
      acc += p
    }
    const events = []
    for (let i = 0; i < n; i++) {
      const event = toEvent(next(now), { idPrefix: 'demo:', demo: true })
      if (event) events.push(event)
    }
    onBatch(events, { backlog: false, gap: false })
    cancel = schedule(tick, intervalMs)
  }

  return {
    start() {
      onStatus({ source: 'demo', state: 'demo', error: null })
      if (!cancel) cancel = schedule(tick, 200)
    },
    stop() {
      cancel?.()
      cancel = null
    },
    retry() {}
  }
}
