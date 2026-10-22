// Everything the page derives from received events, with fixed memory: a capped feed, capped
// per-country and per-name tallies, and a ring of time buckets. Nothing here grows with session
// length beyond those caps.
import { CATEGORY_INDEX } from './events.js'

/** A Map that keeps at most `cap` keys by evicting the smallest tally. */
class CappedTally {
  constructor(cap) {
    this.cap = cap
    this.map = new Map()
  }
  add(key, amount) {
    const current = this.map.get(key)
    if (current !== undefined) {
      this.map.set(key, current + amount)
      return
    }
    if (this.map.size >= this.cap) {
      let minKey = null
      let min = Infinity
      for (const [k, v] of this.map) {
        if (v < min) {
          min = v
          minKey = k
        }
      }
      if (min > amount) return // the newcomer would be evicted first anyway
      this.map.delete(minKey)
    }
    this.map.set(key, amount)
  }
  top(n) {
    return [...this.map].sort((a, b) => b[1] - a[1]).slice(0, n)
  }
}

function side() {
  return { attacks: 0, events: 0, byType: [0, 0, 0, 0], names: new CappedTally(40), partners: new CappedTally(40) }
}

export function createSessionStore({ feedSize = 200, nameCap = 300, bucketMs = 10_000, buckets = 90, now = Date.now } = {}) {
  let feed = []
  let byId = new Map()
  let stats
  let countries
  let names
  let ring
  let version = 0
  const listeners = new Set()

  function reset() {
    feed = []
    byId = new Map()
    stats = { events: 0, attacks: 0, repeats: 0, since: null, last: null, byType: [0, 0, 0, 0], domestic: 0 }
    countries = new Map()
    names = new CappedTally(nameCap)
    ring = Array.from({ length: buckets }, () => ({ key: -1, total: 0, byType: [0, 0, 0, 0] }))
    bump()
  }

  function bump() {
    version += 1
    for (const fn of listeners) fn()
  }

  function country(code) {
    let c = countries.get(code)
    if (!c) {
      c = { in: side(), out: side() }
      countries.set(code, c)
    }
    return c
  }

  function tally(s, event, partner) {
    const t = CATEGORY_INDEX[event.type]
    s.attacks += event.count
    s.events += 1
    s.byType[t] += event.count
    s.names.add(event.name, event.count)
    if (partner) s.partners.add(partner, event.count)
  }

  /** Record one event. Returns 'repeat' when it folded into an earlier feed row, else 'new'. */
  function add(event) {
    const t = CATEGORY_INDEX[event.type]
    stats.events += 1
    stats.attacks += event.count
    stats.byType[t] += event.count
    stats.since ??= event.received
    stats.last = event.received
    if (event.src.country && event.src.country === event.dst.country) stats.domestic += event.count
    names.add(event.name, event.count)
    if (event.dst.country) tally(country(event.dst.country).in, event, event.src.country)
    if (event.src.country) tally(country(event.src.country).out, event, event.dst.country)

    const key = Math.floor(event.received / bucketMs)
    const bucket = ring[key % buckets]
    if (bucket.key !== key) {
      bucket.key = key
      bucket.total = 0
      bucket.byType = [0, 0, 0, 0]
    }
    bucket.total += event.count
    bucket.byType[t] += event.count

    const primary = event.repeatOf ? byId.get(event.repeatOf) : undefined
    let kind = 'new'
    if (primary) {
      primary.repeats += 1
      stats.repeats += 1
      kind = 'repeat'
    } else {
      feed.unshift(event)
      byId.set(event.id, event)
      if (feed.length > feedSize) byId.delete(feed.pop().id)
    }
    bump()
    return kind
  }

  /** Buckets oldest -> newest covering the last `buckets * bucketMs`, empty ones included. */
  function timeline(at = now()) {
    const newest = Math.floor(at / bucketMs)
    const out = []
    for (let key = newest - buckets + 1; key <= newest; key++) {
      const b = ring[((key % buckets) + buckets) % buckets]
      out.push(b.key === key ? { key, total: b.total, byType: b.byType.slice() } : { key, total: 0, byType: [0, 0, 0, 0] })
    }
    return out
  }

  /** Attacks per minute over the trailing `windowMs` (whole buckets). */
  function rate(at = now(), windowMs = 60_000) {
    const n = Math.max(1, Math.round(windowMs / bucketMs))
    const line = timeline(at).slice(-n - 1, -1) // skip the bucket still filling
    const sum = line.reduce((acc, b) => acc + b.total, 0)
    return (sum / (n * bucketMs)) * 60_000
  }

  function ranking(direction, n) {
    return [...countries]
      .map(([code, c]) => ({ code, attacks: c[direction].attacks, byType: c[direction].byType }))
      .filter(row => row.attacks > 0)
      .sort((a, b) => b.attacks - a.attacks)
      .slice(0, n)
  }

  function countryDetail(code) {
    const c = countries.get(code)
    if (!c) return null
    const view = s => ({
      attacks: s.attacks,
      events: s.events,
      byType: s.byType.slice(),
      names: s.names.top(5),
      partners: s.partners.top(5)
    })
    return { in: view(c.in), out: view(c.out) }
  }

  reset()
  return {
    add,
    reset,
    timeline,
    rate,
    feed: () => feed,
    get: id => byId.get(id),
    stats: () => stats,
    targets: n => ranking('in', n),
    sources: n => ranking('out', n),
    topNames: n => names.top(n),
    countryDetail,
    version: () => version,
    subscribe(fn) {
      listeners.add(fn)
      return () => listeners.delete(fn)
    }
  }
}
