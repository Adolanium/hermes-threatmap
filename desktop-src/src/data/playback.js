// Paces events onto the globe. Polls deliver events in batches; launching a batch at once looks
// like a stutter, so each batch is spread across the poll interval. Under a burst the visual rate
// is capped and the overflow is skipped (counted) -- the feed list and statistics still get every
// event, only the arcs are sampled.

export function createPlayback({ spreadMs = 1000, maxPerSecond = 24, maxLagMs = 2500 } = {}) {
  const minGap = 1000 / maxPerSecond
  let queue = []
  let lastAt = -Infinity
  let skipped = 0

  return {
    /** Schedule a batch that arrived at `now`. Returns how many were skipped. */
    push(events, now) {
      if (events.length === 0) return 0
      const gap = Math.max(minGap, spreadMs / events.length)
      let dropped = 0
      for (const event of events) {
        const at = Math.max(now, lastAt + gap)
        if (at - now > maxLagMs) {
          dropped += 1
          continue
        }
        queue.push({ at, event })
        lastAt = at
      }
      skipped += dropped
      return dropped
    },
    /** Events whose launch time has come, oldest first. */
    due(now) {
      if (queue.length === 0 || queue[0].at > now) return []
      let n = 0
      while (n < queue.length && queue[n].at <= now) n++
      const out = queue.slice(0, n).map(item => item.event)
      queue = queue.slice(n)
      return out
    },
    /** Shift every pending launch (used when the visual clock was paused). */
    delay(ms) {
      for (const item of queue) item.at += ms
      lastAt += ms
    },
    clear() {
      queue = []
      lastAt = -Infinity
    },
    size: () => queue.length,
    skipped: () => skipped
  }
}
