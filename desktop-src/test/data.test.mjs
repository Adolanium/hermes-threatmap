// Page-side data handling: event validation, bounded session statistics, playback pacing and
// country lookup. Run with `npm test` (node --test).
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createDemoGenerator, isDomestic, toEvent } from '../src/data/events.js'
import { createPlayback } from '../src/data/playback.js'
import { createSessionStore } from '../src/data/store.js'
import { countryAt, countryByCode, countryName, indexAt } from '../src/geo/world.js'

const LIVE = { idPrefix: 'live:x:', demo: false }
const raw = (over = {}) => ({
  seq: 1,
  type: 'exploit',
  name: 'Directory traversal',
  count: 2,
  src: { country: 'US', lat: 37.751, lon: -97.822 },
  dst: { country: 'BR', lat: -15.6, lon: -56.1 },
  received: 1_700_000_000_000,
  repeat_of: null,
  ...over
})

test('toEvent keeps a valid backend event', () => {
  const e = toEvent(raw(), LIVE)
  assert.equal(e.id, 'live:x:1')
  assert.equal(e.type, 'exploit')
  assert.equal(e.count, 2)
  assert.equal(e.src.located, 'exact')
  assert.equal(e.demo, false)
})

test('toEvent rejects payloads without a usable sequence or placement', () => {
  for (const bad of [null, 'x', 5, {}, raw({ seq: 0 }), raw({ seq: 1.5 }), raw({ src: {} }), raw({ dst: { country: 'zz' } })]) {
    assert.equal(toEvent(bad, LIVE), null)
  }
})

test('toEvent places an end with no coordinates at its country, and sanitizes the rest', () => {
  const e = toEvent(raw({ dst: { country: 'FR', lat: null, lon: 999 }, type: 'worm', count: -4, name: '  ' }), LIVE)
  assert.equal(e.dst.located, 'country')
  assert.equal(e.dst.lat, countryByCode('FR').lat)
  assert.equal(e.type, 'other')
  assert.equal(e.count, 1)
  assert.equal(e.name, 'Unnamed attack')
})

test('repeat_of must point backwards', () => {
  assert.equal(toEvent(raw({ seq: 5, repeat_of: 3 }), LIVE).repeatOf, 'live:x:3')
  assert.equal(toEvent(raw({ seq: 5, repeat_of: 9 }), LIVE).repeatOf, null)
})

test('demo events are always flagged as demo', () => {
  const next = createDemoGenerator(42)
  for (let i = 0; i < 200; i++) {
    const e = toEvent(next(), { idPrefix: 'demo:', demo: true })
    assert.ok(e, 'demo payloads are valid')
    assert.equal(e.demo, true)
  }
})

test('store folds repeats into their row but counts every report', () => {
  const store = createSessionStore()
  const first = toEvent(raw({ seq: 1 }), LIVE)
  const again = toEvent(raw({ seq: 2, repeat_of: 1 }), LIVE)
  assert.equal(store.add(first), 'new')
  assert.equal(store.add(again), 'repeat')
  assert.equal(store.feed().length, 1)
  assert.equal(store.feed()[0].repeats, 1)
  assert.equal(store.stats().events, 2)
  assert.equal(store.stats().attacks, 4)
  assert.deepEqual(store.targets(1), [{ code: 'BR', attacks: 4, byType: [4, 0, 0, 0] }])
})

test('store memory stays bounded however long it runs', () => {
  const store = createSessionStore({ feedSize: 50, nameCap: 20 })
  const codes = ['US', 'BR', 'DE', 'CN', 'IN', 'GB', 'FR', 'JP']
  for (let i = 1; i <= 20_000; i++) {
    const c = codes[i % codes.length]
    store.add(toEvent(raw({ seq: i, name: `attack ${i % 500}`, dst: { country: c, lat: 1, lon: 1 } }), LIVE))
  }
  assert.equal(store.feed().length, 50)
  assert.ok(store.topNames(1000).length <= 20)
  assert.equal(store.stats().events, 20_000)
  assert.equal(store.timeline().length, 90)
  // A repeat of an event that already scrolled out of the feed still counts, without a row.
  assert.equal(store.add(toEvent(raw({ seq: 20_001, repeat_of: 3 }), LIVE)), 'new')
})

test('store rate counts whole buckets of the last minute', () => {
  let now = 1_000_000
  const store = createSessionStore({ now: () => now })
  for (let i = 0; i < 60; i++) store.add(toEvent(raw({ seq: i + 1, count: 1, received: now - 30_000 }), LIVE))
  now += 1
  assert.equal(Math.round(store.rate()), 60)
})

test('playback spreads a batch over the poll interval', () => {
  const pb = createPlayback({ spreadMs: 1000, maxPerSecond: 100 })
  pb.push([1, 2, 3, 4], 0)
  assert.deepEqual(pb.due(0), [1])
  assert.deepEqual(pb.due(499), [2])
  assert.deepEqual(pb.due(1000), [3, 4])
})

test('playback skips visuals under a burst instead of lagging forever', () => {
  const pb = createPlayback({ maxPerSecond: 10, maxLagMs: 1000 })
  const skipped = pb.push(Array.from({ length: 100 }, (_, i) => i), 0)
  assert.ok(pb.size() <= 11)
  assert.equal(skipped + pb.size(), 100)
  assert.equal(pb.skipped(), skipped)
})

test('playback.delay shifts pending launches after a pause', () => {
  const pb = createPlayback({ spreadMs: 1000, maxPerSecond: 100 })
  pb.push(['a', 'b'], 0)
  pb.delay(5000)
  assert.deepEqual(pb.due(1000), [])
  assert.deepEqual(pb.due(6000), ['a', 'b'])
})

test('country raster lookups', () => {
  assert.equal(countryAt(48.85, 2.35)?.code, 'FR')
  assert.equal(countryAt(-23.5, -46.6)?.code, 'BR')
  assert.equal(countryAt(35.7, 139.7)?.code, 'JP')
  assert.equal(countryAt(66, 175)?.code, 'RU') // Chukotka, both sides of the antimeridian
  assert.equal(countryAt(66.5, -175)?.code, 'RU')
  assert.equal(indexAt(0, -30), 0) // Atlantic
  assert.equal(countryName('DE'), 'Germany')
  assert.equal(countryName(null), 'Unknown')
})

test('isDomestic', () => {
  assert.equal(isDomestic(toEvent(raw({ dst: { country: 'US', lat: 40, lon: -75 } }), LIVE)), true)
  assert.equal(isDomestic(toEvent(raw(), LIVE)), false)
})
