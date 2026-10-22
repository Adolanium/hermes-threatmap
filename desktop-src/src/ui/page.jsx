// The Threat Map page: a full-bleed globe with glass overlays.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Codicon, createBudgetedLoop, GlyphSpinner, haptic, Tip, useTheme, useValue } from '@hermes/plugin-sdk'
import { countryByCode, countryByIndex, countryName } from '../geo/world.js'
import { createGlobe } from '../globe/globe.js'
import { buildPalette, createColorResolver } from '../globe/palette.js'
import { fmt, fmtCompact, RollingNumber, SeriesBars, Shape, usePrefersReducedMotion, useThrottled } from './kit.jsx'
import { CountryPanel, EventPanel, FeedCard, IntelCard, RankingCard, SessionCard } from './panels.jsx'
import { CSS } from './styles.js'

const REPO_URL = 'https://github.com/Adolanium/hermes-threatmap'

export function ThreatMapPage({ controller, rest, openExternal }) {
  const rootRef = useRef(null)
  const globeRef = useRef(null)
  const settings = useValue(controller.settings)
  const status = useValue(controller.status)
  const paused = useValue(controller.paused)
  const focus = useValue(controller.focus)
  const isolate = useValue(controller.isolate)
  useThrottled(controller.store.subscribe, controller.store.version, 300)
  const prefersReduced = usePrefersReducedMotion()
  const reduced = prefersReduced
  const [sizeClass, setSizeClass] = useState('wide')
  const [openRail, setOpenRail] = useState(null) // narrow layout: 'left' | 'right' | null
  const [hoverEvent, setHoverEvent] = useState(null)
  const [contextLost, setContextLost] = useState(null) // null | { message }

  useEffect(() => controller.attach(), [controller])

  // Responsive class from the page's own width (it also runs in split tiles).
  useEffect(() => {
    const el = rootRef.current
    if (!el) return undefined
    const ro = new ResizeObserver(([entry]) => {
      const w = entry.contentRect.width
      setSizeClass(w < 760 ? 'narrow' : w < 1120 ? 'compact' : 'wide')
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const demo = settings.source === 'demo'
  const live = settings.source === 'live' && settings.liveConsent
  const chosen = demo || live

  // Keep the globe in sync with settings.
  useEffect(() => {
    const g = globeRef.current
    if (!g) return
    g.setMask(settings.types)
    g.setDither(settings.dither)
    g.setAutoRotate(settings.autoRotate)
  }, [settings])
  useEffect(() => globeRef.current?.setPaused(paused), [paused])
  useEffect(() => globeRef.current?.setReducedMotion(reduced), [reduced])
  useEffect(() => globeRef.current?.setHighlight(hoverEvent), [hoverEvent])

  const focusCountry = useCallback(
    code => {
      const country = countryByCode(code)
      if (!country) return
      controller.focus.set({ kind: 'country', code })
      globeRef.current?.focusCountry(country)
      if (sizeClass === 'narrow') setOpenRail('right')
    },
    [controller, sizeClass]
  )
  const focusEvent = useCallback(
    event => {
      controller.focus.set({ kind: 'event', id: event.id })
      globeRef.current?.focusCountry(null)
      globeRef.current?.focusEvent(event)
      if (sizeClass === 'narrow') setOpenRail('right')
    },
    [controller, sizeClass]
  )
  const clearFocus = useCallback(() => {
    controller.focus.set(null)
    controller.isolate.set(false)
    globeRef.current?.focusCountry(null)
  }, [controller])

  const onPick = useCallback(
    target => {
      haptic?.('tap')
      if (target.kind === 'country') {
        const c = countryByIndex(target.index)
        if (c) focusCountry(c.code)
      } else if (target.kind === 'event') {
        const event = controller.store.get(target.eventId)
        if (event) focusEvent(event)
      }
    },
    [controller, focusCountry, focusEvent]
  )

  const togglePause = useCallback(() => controller.setPaused(!controller.paused.get()), [controller])

  function onKeyDown(e) {
    if (e.target instanceof HTMLElement && e.target.closest('input, textarea, [contenteditable="true"]')) return
    if (e.metaKey || e.ctrlKey || e.altKey) return
    const g = globeRef.current
    const k = e.key
    let handled = true
    if (k === ' ' && !(e.target instanceof HTMLButtonElement)) togglePause()
    else if (k >= '1' && k <= '4') controller.toggleType(Number(k) - 1)
    else if (k === 'Escape') {
      if (focus) clearFocus()
      else if (openRail) setOpenRail(null)
      else handled = false
    } else if (k === 'r' || k === 'R') g?.resetView()
    else if (k === 'a' || k === 'A') controller.setAutoRotate(!settings.autoRotate)
    else if (k === 'd' || k === 'D') controller.setDither(!settings.dither)
    else if (k === '+' || k === '=') g?.zoomBy(0.85)
    else if (k === '-' || k === '_') g?.zoomBy(1 / 0.85)
    else if (k === 'ArrowLeft') g?.rotateBy(-8, 0)
    else if (k === 'ArrowRight') g?.rotateBy(8, 0)
    else if (k === 'ArrowUp') g?.rotateBy(0, 6)
    else if (k === 'ArrowDown') g?.rotateBy(0, -6)
    else handled = false
    if (handled) e.preventDefault()
  }

  const focusedEvent = focus?.kind === 'event' ? controller.store.get(focus.id) : null
  const focusedCountry = focus?.kind === 'country' ? focus.code : null

  return (
    <div
      ref={rootRef}
      className="htm-root"
      data-size={sizeClass}
      data-motion={reduced ? 'reduced' : 'full'}
      tabIndex={0}
      onKeyDown={onKeyDown}
      aria-label="Threat map"
    >
      <style>{CSS}</style>
      <GlobeView
        controller={controller}
        globeRef={globeRef}
        settings={settings}
        paused={paused}
        reduced={reduced}
        onPick={onPick}
        onContextLost={error => setContextLost({ message: error ? String(error.message ?? error) : null })}
        focusedCountry={focusedCountry}
      />
      <div className="htm-shade" aria-hidden="true" />

      <TopBar status={status} settings={settings} paused={paused} reduced={reduced} controller={controller} demo={demo} live={live} />

      {chosen ? (
        <>
          <div className="htm-rail htm-rail--left" data-open={openRail === 'left'}>
            <SessionCard controller={controller} settings={settings} reduced={reduced} demo={demo} />
            <RankingCard controller={controller} onCountry={focusCountry} />
            {live ? <IntelCard rest={rest} onCountry={focusCountry} /> : null}
          </div>
          <div className="htm-rail htm-rail--right" data-open={openRail === 'right'}>
            {live && !focus ? <GlobalCard counter={status.counter} reduced={reduced} /> : null}
            {focusedEvent ? (
              <EventPanel
                key={focusedEvent.id}
                event={focusedEvent}
                onClose={clearFocus}
                onCountry={focusCountry}
                onFly={() => globeRef.current?.focusEvent(focusedEvent)}
              />
            ) : focusedCountry ? (
              <CountryPanel
                key={focusedCountry}
                code={focusedCountry}
                controller={controller}
                live={live}
                rest={rest}
                isolate={isolate}
                onClose={clearFocus}
                onCountry={focusCountry}
              />
            ) : null}
            <FeedCard
              controller={controller}
              paused={paused}
              demo={demo}
              onEvent={focusEvent}
              onHover={setHoverEvent}
              activeId={focusedEvent?.id}
            />
          </div>
        </>
      ) : null}

      {chosen ? (
        <Dock
          controller={controller}
          settings={settings}
          paused={paused}
          live={live}
          narrow={sizeClass === 'narrow'}
          openRail={openRail}
          setOpenRail={setOpenRail}
          onReset={() => globeRef.current?.resetView()}
          onTogglePause={togglePause}
        />
      ) : null}

      {demo ? (
        <div className="htm-banner htm-banner--bottom htm-demo-strip" role="note">
          Simulated data · not real attacks
        </div>
      ) : null}

      {chosen && sizeClass !== 'narrow' ? (
        <div className="htm-attrib">
          {live ? (
            <>
              Attacks: Check Point Threat Map feed (unofficial, not affiliated).{' '}
            </>
          ) : null}
          Borders: Natural Earth.
        </div>
      ) : null}

      <StateOverlay
        status={status}
        settings={settings}
        controller={controller}
        live={live}
        chosen={chosen}
        contextLost={contextLost}
        openExternal={openExternal}
      />
    </div>
  )
}

/** Owns the canvas, the three.js globe, hover tooltips and the selected-country callout. */
function GlobeView({ controller, globeRef, settings, paused, reduced, onPick, onContextLost, focusedCountry }) {
  const canvasRef = useRef(null)
  const tipRef = useRef(null)
  const calloutRef = useRef(null)
  const [hover, setHover] = useState(null)
  const { themeName, resolvedMode } = useThemeSafe()
  const onPickRef = useRef(onPick)
  onPickRef.current = onPick
  const onLostRef = useRef(onContextLost)
  onLostRef.current = onContextLost

  useEffect(() => {
    const canvas = canvasRef.current
    const resolver = createColorResolver(canvas.parentElement)
    let globe
    try {
      globe = createGlobe(canvas, {
        pull: now => controller.pull(now),
        loop: (fn, opts) => createBudgetedLoop(fn, opts),
        onPick: target => onPickRef.current(target),
        onContextLost: () => onLostRef.current?.(),
        onHover: (target, x, y) => {
          const el = tipRef.current
          if (el) {
            const w = canvas.clientWidth
            const left = x + 16 + 260 > w ? x - 16 - 260 : x + 16
            el.style.transform = `translate(${Math.max(8, left)}px, ${Math.max(8, y - 12)}px)`
          }
          setHover(prev => {
            const key = target ? (target.kind === 'event' ? target.eventId : `c${target.index}`) : null
            const prevKey = prev ? (prev.kind === 'event' ? prev.eventId : `c${prev.index}`) : null
            return key === prevKey ? prev : target
          })
          canvas.dataset.hover = String(!!target)
        },
        onFrame: ({ tracked }) => {
          const el = calloutRef.current
          if (!el) return
          if (!tracked) {
            el.style.opacity = '0'
            return
          }
          el.style.opacity = '1'
          el.style.transform = `translate(${tracked.x}px, ${tracked.y}px)`
        }
      })
    } catch (error) {
      console.error('[hermes-threatmap] could not start the globe', error)
      onLostRef.current?.(error)
      resolver.dispose()
      return undefined
    }
    globeRef.current = globe
    const s = controller.settings.get()
    globe.setMask(s.types)
    globe.setDither(s.dither)
    globe.setAutoRotate(s.autoRotate)
    globe.setPaused(controller.paused.get())
    globe.setPalette(buildPalette(resolver))
    const ro = new ResizeObserver(([entry]) => globe.resize(entry.contentRect.width, entry.contentRect.height))
    ro.observe(canvas)
    const offClear = controller.onClear(() => globe.clear())
    const offWake = controller.onWake(() => globe.wake())
    const f = controller.focus.get()
    if (f?.kind === 'country') globe.focusCountry(countryByCode(f.code) ?? null)
    canvas.__htmResolver = resolver
    // Diagnostics handle for validating the page over CDP; removed on unmount.
    if (typeof window !== 'undefined') {
      window.__htmGlobe = globe
      window.__htmController = controller
    }
    return () => {
      ro.disconnect()
      offClear()
      offWake()
      globe.dispose()
      resolver.dispose()
      globeRef.current = null
      if (typeof window !== 'undefined' && window.__htmGlobe === globe) {
        delete window.__htmGlobe
        delete window.__htmController
      }
    }
  }, [controller, globeRef])

  // Re-derive colours on theme change (after the new theme's variables have painted).
  useEffect(() => {
    const globe = globeRef.current
    const resolver = canvasRef.current?.__htmResolver
    if (!globe || !resolver) return undefined
    const id = requestAnimationFrame(() => globe.setPalette(buildPalette(resolver)))
    return () => cancelAnimationFrame(id)
  }, [themeName, resolvedMode, globeRef])

  const hoverEvent = hover?.kind === 'event' ? controller.store.get(hover.eventId) : null
  const hoverCountry = hover?.kind === 'country' ? countryByIndex(hover.index) : null
  const countryStats = hoverCountry ? controller.store.countryDetail(hoverCountry.code) : null
  const focused = focusedCountry ? countryByCode(focusedCountry) : null

  return (
    <>
      <canvas ref={canvasRef} className="htm-canvas" aria-label="Interactive globe. Drag to rotate, scroll to zoom, click a country or a marker for details." />
      <div ref={calloutRef} className="htm-callout" style={{ opacity: 0 }} aria-hidden="true">
        {focused ? (
          <>
            <span className="htm-callout-dot" />
            <span className="htm-callout-line" />
            <span className="htm-callout-tag">{countryName(focused.code)}</span>
          </>
        ) : null}
      </div>
      <div ref={tipRef} className="htm-tip htm-panel" style={{ opacity: hover && (hoverEvent || hoverCountry) ? 1 : 0 }} aria-hidden="true">
        {hoverEvent ? (
          <>
            <span className="htm-tip-title">
              <Shape type={hoverEvent.type} size={11} /> {hoverEvent.name}
            </span>
            <span className="htm-muted">
              {countryName(hoverEvent.src.country)} → {countryName(hoverEvent.dst.country)}
              {hoverEvent.count > 1 ? ` · ${fmt(hoverEvent.count)} attacks` : ''}
            </span>
          </>
        ) : hoverCountry ? (
          <>
            <span className="htm-tip-title">
              <span className="htm-code">{hoverCountry.code}</span> {countryName(hoverCountry.code)}
            </span>
            <span className="htm-muted htm-num">
              {countryStats
                ? `${fmtCompact(countryStats.in.attacks)} targeted · ${fmtCompact(countryStats.out.attacks)} attacking this session`
                : 'No attacks seen this session'}
            </span>
            <span className="htm-muted" style={{ fontSize: 10.5 }}>
              Click to inspect
            </span>
          </>
        ) : null}
      </div>
    </>
  )
}

function useThemeSafe() {
  try {
    const t = useTheme()
    return { themeName: t?.themeName, resolvedMode: t?.resolvedMode }
  } catch {
    return { themeName: null, resolvedMode: null }
  }
}

const STATE_TEXT = {
  idle: ['idle', 'Not connected'],
  connecting: ['warn', 'Connecting'],
  live: ['live', 'Live'],
  reconnecting: ['warn', 'Reconnecting'],
  unavailable: ['bad', 'Feed unavailable'],
  'backend-missing': ['bad', 'Backend off'],
  'backend-error': ['bad', 'Backend error'],
  demo: ['demo', 'Demo']
}

function TopBar({ status, settings, paused, reduced, controller, demo, live }) {
  const stats = controller.store.stats()
  const rate = controller.store.rate()
  const [tone, label] = paused && (demo || live) ? ['warn', 'Paused'] : STATE_TEXT[status.state] ?? STATE_TEXT.idle
  return (
    <header className="htm-top">
      <div className="htm-brand">
        <div className="htm-brand-row">
          <span className="htm-title">Threat Map</span>
          {demo || live ? (
            <span className={`htm-status htm-tone-${tone}`} role="status" aria-live="polite">
              <span className="htm-dot" data-pulse={(tone === 'live' || tone === 'demo') && !paused && !reduced} />
              <b>{label}</b>
              {(tone === 'live' || tone === 'demo') && stats.events ? <span className="htm-status-rate htm-num">{rate >= 1 ? `${fmt(rate)}/min` : '<1/min'}</span> : null}
            </span>
          ) : null}
        </div>
        <span className="htm-subtitle">
          {demo
            ? 'Simulated attacks for exploring the map. Nothing here is real.'
            : live
              ? "Attacks as Check Point's public threat map reports them, as they arrive."
              : 'A live view of attacks reported around the world.'}
        </span>
      </div>
    </header>
  )
}

/** Check Point's own global total for today: shown apart from (and labelled unlike) the feed. */
function GlobalCard({ counter, reduced }) {
  if (!counter || (counter.today == null && !counter.recent?.length)) return null
  return (
    <section className="htm-panel htm-global htm-rise" aria-label="Global attacks today">
      <span className="htm-label">Attacks today · global</span>
      <RollingNumber value={counter.today ?? 0} reduced={reduced} className="htm-global-value" />
      <div className="htm-global-foot">
        <span className="htm-caption">
          Check Point ThreatCloud estimate,
          <br />
          not the events on this map
        </span>
        {counter.recent?.length ? (
          <div style={{ width: 96 }} title={`Daily global totals, last ${counter.recent.length} days`}>
            <SeriesBars values={counter.recent} label={`Daily global attacks over the last ${counter.recent.length} days`} />
          </div>
        ) : null}
      </div>
    </section>
  )
}

function Dock({ controller, settings, paused, live, narrow, openRail, setOpenRail, onReset, onTogglePause }) {
  return (
    <nav className="htm-dock htm-panel" aria-label="Map controls">
      {narrow ? (
        <>
          <Tip label="Statistics">
            <button type="button" className="htm-btn" aria-pressed={openRail === 'left'} onClick={() => setOpenRail(openRail === 'left' ? null : 'left')} aria-label="Statistics">
              <Codicon name="graph" />
            </button>
          </Tip>
          <Tip label="Feed">
            <button type="button" className="htm-btn" aria-pressed={openRail === 'right'} onClick={() => setOpenRail(openRail === 'right' ? null : 'right')} aria-label="Feed">
              <Codicon name="list-unordered" />
            </button>
          </Tip>
          <span className="htm-sep" />
        </>
      ) : null}
      <Tip label={paused ? 'Resume (Space)' : 'Pause (Space)'}>
        <button type="button" className="htm-btn" aria-pressed={paused} onClick={onTogglePause} aria-label={paused ? 'Resume' : 'Pause'}>
          <Codicon name={paused ? 'debug-start' : 'debug-pause'} />
          {narrow ? null : <span>{paused ? 'Resume' : 'Pause'}</span>}
        </button>
      </Tip>
      <Tip label="Spin the globe when idle (A)">
        <button type="button" className="htm-btn" aria-pressed={settings.autoRotate} onClick={() => controller.setAutoRotate(!settings.autoRotate)} aria-label="Auto-rotate">
          <Codicon name="sync" />
        </button>
      </Tip>
      <Tip label="Reset view (R)">
        <button type="button" className="htm-btn" onClick={onReset} aria-label="Reset view">
          <Codicon name="screen-normal" />
        </button>
      </Tip>
      <Tip label="Dithered or smooth globe (D)">
        <button type="button" className="htm-btn" aria-pressed={settings.dither} onClick={() => controller.setDither(!settings.dither)} aria-label="Dithered globe">
          <Codicon name="symbol-color" />
        </button>
      </Tip>
      <span className="htm-sep" />
      <div className="htm-seg" role="group" aria-label="Data source">
        <Tip label="Check Point's live feed">
          <button type="button" className="htm-btn" aria-pressed={live} onClick={() => controller.chooseSource('live')}>
            Live
          </button>
        </Tip>
        <Tip label="Simulated events, clearly labelled">
          <button type="button" className="htm-btn" aria-pressed={!live} onClick={() => controller.chooseSource('demo')}>
            Demo
          </button>
        </Tip>
      </div>
    </nav>
  )
}

/** Centre-stage states: consent, connection problems, empty. */
function StateOverlay({ status, settings, controller, live, chosen, contextLost, openExternal }) {
  const [now, setNow] = useState(Date.now())
  const retryAt = status.retry_at
  useEffect(() => {
    if (!retryAt) return undefined
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [retryAt])
  const events = controller.store.stats().events

  if (contextLost) {
    return (
      <div className="htm-center">
        <div className="htm-panel htm-dialog" role="alert">
          <h2>The globe can't draw right now</h2>
          <p>The graphics context was lost or WebGL is unavailable. The feed and statistics keep working; the globe comes back when the context is restored.</p>
          {contextLost.message ? <p className="htm-caption htm-mono">{contextLost.message}</p> : null}
        </div>
      </div>
    )
  }

  if (!chosen) return <ConsentDialog controller={controller} openExternal={openExternal} />

  if (live && status.state === 'backend-missing') {
    return (
      <div className="htm-center">
        <div className="htm-panel htm-dialog" role="alert">
          <h2>The live feed needs the plugin's backend</h2>
          <p>
            Hermes reaches Check Point through this plugin's Python half, which isn't loaded. Add <code className="htm-mono">hermes-threatmap</code> to{' '}
            <code className="htm-mono">plugins.enabled</code> in config.yaml, then restart the gateway.
          </p>
          <div className="htm-dialog-actions">
            <button type="button" className="htm-btn htm-btn--primary" onClick={() => controller.retry()}>
              Try again
            </button>
            <button type="button" className="htm-btn htm-btn--ghost" onClick={() => controller.chooseSource('demo')}>
              Explore demo data
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (live && status.state === 'unavailable') {
    return (
      <div className="htm-center">
        <div className="htm-panel htm-dialog" role="alert">
          <h2>Check Point's feed isn't answering</h2>
          <p>
            The endpoint refused the connection several times{status.error ? ` (${status.error})` : ''}. It's undocumented, so it may have moved or been
            switched off. Hermes keeps checking every few minutes.
          </p>
          <div className="htm-dialog-actions">
            <button type="button" className="htm-btn htm-btn--primary" onClick={() => controller.retry()}>
              Check now
            </button>
            <button type="button" className="htm-btn htm-btn--ghost" onClick={() => controller.chooseSource('demo')}>
              Explore demo data
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (live && (status.state === 'reconnecting' || status.state === 'backend-error')) {
    const wait = retryAt ? Math.max(0, Math.ceil((retryAt - now) / 1000)) : null
    return (
      <div className="htm-banner htm-banner--top htm-panel" role="status">
        <span className="htm-dot htm-tone-warn" />
        <span>
          {status.state === 'backend-error' ? 'Lost touch with the Hermes backend' : 'Feed connection dropped'}
          {wait ? ` · retrying in ${wait}s` : ' · retrying'}
        </span>
        <button type="button" className="htm-btn" style={{ height: 24 }} onClick={() => controller.retry()}>
          Retry now
        </button>
      </div>
    )
  }

  if (events === 0) {
    const connecting = live && (status.state === 'connecting' || status.state === 'idle')
    return (
      <div className="htm-listening htm-panel" role="status">
        <GlyphSpinner ariaLabel="Waiting" />
        <span>{connecting ? 'Connecting to the live feed…' : 'Listening for attacks…'}</span>
      </div>
    )
  }
  return null
}

function ConsentDialog({ controller, openExternal }) {
  return (
    <div className="htm-center">
      <div className="htm-panel htm-dialog" role="dialog" aria-labelledby="htm-consent-title">
        <span className="htm-label">Before you connect</span>
        <h2 id="htm-consent-title">Watch attacks as they're reported</h2>
        <p>The live view uses the feed behind Check Point's public threat map. Some things to know first:</p>
        <ul className="htm-facts-list">
          <li>
            <Codicon name="plug" size={13} />
            <span>It's not an official API. Check Point doesn't document or license it, and it can change or stop without notice.</span>
          </li>
          <li>
            <Codicon name="law" size={13} />
            <span>Check Point's website terms restrict automated access to their site. Use this for personal, informational viewing only.</span>
          </li>
          <li>
            <Codicon name="lock" size={13} />
            <span>Hermes connects through your own gateway, and only while this page is open. Nothing is stored or shared.</span>
          </li>
        </ul>
        <div className="htm-dialog-actions">
          <button type="button" className="htm-btn htm-btn--primary" onClick={() => controller.chooseSource('live')}>
            Connect live feed
          </button>
          <button type="button" className="htm-btn htm-btn--ghost" onClick={() => controller.chooseSource('demo')}>
            Explore demo data
          </button>
        </div>
        <p className="htm-caption">
          Demo data is simulated and always labelled.{' '}
          <button type="button" className="htm-link" onClick={() => openExternal(`${REPO_URL}#data-source`)}>
            About the data
          </button>
        </p>
      </div>
    </div>
  )
}

