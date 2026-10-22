// Plugin-level state that outlives a page mount: the active source, session statistics, filters,
// pause, and user preferences. The page attaches while mounted; the source stops a little after
// the last page detaches, so a quick navigation away and back keeps the session.
import { CATEGORIES, CATEGORY_INDEX, isDomestic } from './data/events.js'
import { createPlayback } from './data/playback.js'
import { createDemoSource, createLiveSource } from './data/sources.js'
import { createSessionStore } from './data/store.js'

const DETACH_GRACE_MS = 30_000
const DEFAULTS = {
  source: null, // null until the user chooses: 'live' (after consent) or 'demo'
  liveConsent: false,
  types: CATEGORIES.map(() => true),
  hideDomestic: false,
  dither: true,
  autoRotate: true
}

/**
 * @param {object} deps
 * @param {(init: any) => {get(): any, set(v: any): void, subscribe(fn): () => void}} deps.atom
 * @param {(path: string, opts?: object) => Promise<any>} deps.rest
 * @param {(fn: () => void, ms: number) => () => void} deps.schedule
 * @param {{ get(key: string, fallback: any): any, set(key: string, value: any): void }} deps.storage
 */
export function createController({ atom, rest, schedule, storage }) {
  const saved = storage.get('settings', {}) ?? {}
  const settings = atom({ ...DEFAULTS, ...pick(saved, Object.keys(DEFAULTS)) })
  if (!Array.isArray(settings.get().types) || settings.get().types.length !== CATEGORIES.length) {
    settings.set({ ...settings.get(), types: DEFAULTS.types })
  }
  const status = atom({ source: null, state: 'idle', error: null })
  const paused = atom(false)
  const focus = atom(null) // { kind: 'country', code } | { kind: 'event', id } | null
  const isolate = atom(false) // only show events touching the focused country
  const store = createSessionStore()
  const playback = createPlayback()
  const listeners = { clear: new Set(), wake: new Set() }
  let source = null
  let attached = 0
  let cancelDetach = null
  let frozen = null // { feed, events } while paused
  let pausedAt = 0

  function update(patch) {
    const next = { ...settings.get(), ...patch }
    settings.set(next)
    storage.set('settings', next)
  }

  function passes(event) {
    const s = settings.get()
    if (!s.types[CATEGORY_INDEX[event.type] ?? 3]) return false
    if (s.hideDomestic && isDomestic(event)) return false
    const f = focus.get()
    if (isolate.get() && f?.kind === 'country' && event.src.country !== f.code && event.dst.country !== f.code) return false
    return true
  }

  function onBatch(events, { backlog }) {
    const visible = []
    for (const event of events) {
      store.add(event)
      if (passes(event)) visible.push(event)
    }
    if (paused.get()) return
    playback.push(backlog ? visible.slice(-20) : visible, performance.now())
    if (visible.length) for (const fn of listeners.wake) fn()
  }

  function onStatus(next) {
    status.set({ ...next })
  }

  function startSource() {
    stopSource()
    const kind = settings.get().source
    if (kind === 'live' && settings.get().liveConsent) {
      source = createLiveSource({ rest, schedule, onBatch, onStatus })
    } else if (kind === 'demo') {
      source = createDemoSource({ schedule, onBatch, onStatus })
    } else {
      status.set({ source: null, state: 'idle', error: null })
      return
    }
    source.start()
  }

  function stopSource() {
    source?.stop()
    source = null
  }

  function resetSession() {
    store.reset()
    playback.clear()
    frozen = null
    for (const fn of listeners.clear) fn()
  }

  return {
    settings,
    status,
    paused,
    focus,
    isolate,
    store,
    playback,

    attach() {
      attached += 1
      cancelDetach?.()
      cancelDetach = null
      if (!source) startSource()
      return () => {
        attached -= 1
        if (attached > 0) return
        cancelDetach = schedule(() => {
          cancelDetach = null
          if (attached === 0) {
            stopSource()
            status.set({ ...status.get(), state: 'idle' })
          }
        }, DETACH_GRACE_MS)
      }
    },

    /** Switch between 'live' and 'demo'. Live and demo data are never mixed: switching resets. */
    chooseSource(kind) {
      const patch = { source: kind }
      if (kind === 'live') patch.liveConsent = true
      const changed = settings.get().source !== kind
      update(patch)
      if (changed) resetSession()
      if (changed || !source) startSource()
    },

    retry() {
      source?.retry()
    },

    /** Feed a batch through the same path the sources use (diagnostics and stress tests). */
    ingest: (events, opts = { backlog: false }) => onBatch(events, opts),

    setTypes(types) {
      update({ types })
    },
    toggleType(index) {
      const types = settings.get().types.slice()
      types[index] = !types[index]
      update({ types })
    },
    setHideDomestic(value) {
      update({ hideDomestic: value })
    },
    setDither(value) {
      update({ dither: value })
    },
    setAutoRotate(value) {
      update({ autoRotate: value })
    },

    setPaused(value) {
      if (value === paused.get()) return
      if (value) {
        frozen = { feed: store.feed().slice(), events: store.stats().events }
        pausedAt = performance.now()
      } else {
        frozen = null
        playback.delay(performance.now() - pausedAt)
      }
      paused.set(value)
      for (const fn of listeners.wake) fn()
    },

    /** The feed rows to show: frozen while paused. */
    feed() {
      return frozen ? frozen.feed : store.feed()
    },
    newWhilePaused() {
      return frozen ? store.stats().events - frozen.events : 0
    },

    passes,
    pull(now) {
      return paused.get() ? [] : playback.due(now)
    },

    onClear(fn) {
      listeners.clear.add(fn)
      return () => listeners.clear.delete(fn)
    },
    onWake(fn) {
      listeners.wake.add(fn)
      return () => listeners.wake.delete(fn)
    },

    running: () => source !== null,

    dispose() {
      cancelDetach?.()
      stopSource()
      listeners.clear.clear()
      listeners.wake.clear()
    }
  }
}

function pick(object, keys) {
  const out = {}
  if (object && typeof object === 'object') for (const k of keys) if (k in object) out[k] = object[k]
  return out
}
