// Rail cards and detail panels. They read the controller's session store (throttled) and never
// hold their own copies of events.
import { useEffect, useState } from 'react'
import { Codicon, Switch, Tip } from '@hermes/plugin-sdk'
import { CATEGORIES, CATEGORY_INDEX } from '../data/events.js'
import { countryByCode, countryName } from '../geo/world.js'
import {
  AreaChart,
  age,
  catVar,
  clock,
  fmt,
  fmtCompact,
  MiniLine,
  pct,
  RollingNumber,
  Shape,
  StackBar,
  TimelineBars,
  useNow
} from './kit.jsx'

/** "Seen in this session" card: totals, rate, timeline and the category filters. */
export function SessionCard({ controller, settings, reduced, demo }) {
  const { store } = controller
  const stats = store.stats()
  const buckets = store.timeline()
  const rate = store.rate()
  const total = stats.attacks
  return (
    <section className="htm-panel htm-card htm-rise" style={{ animationDelay: '60ms' }} aria-label="Seen in this session">
      <div className="htm-card-head">
        <span className="htm-label">{demo ? 'Simulated this session' : 'Seen in this session'}</span>
        <Tip label="Attacks reported by the feed since this page started listening. Each feed event can stand for several attacks.">
          <span className="htm-muted" tabIndex={0} aria-label="About these numbers">
            <Codicon name="info" size={12} />
          </span>
        </Tip>
      </div>
      <div className="htm-big-row">
        <RollingNumber value={total} reduced={reduced} className="htm-big" />
        <span className="htm-soft htm-num" style={{ fontSize: 11.5 }}>
          {rate >= 1 ? `${fmt(rate)}/min` : stats.events ? '<1/min' : ''}
        </span>
      </div>
      <div className="htm-kv">
        <span>
          <b className="htm-num">{fmt(stats.events)}</b> feed events
        </span>
        {stats.since ? (
          <span>
            since <b className="htm-num">{clock(stats.since).slice(0, 5)}</b>
          </span>
        ) : null}
      </div>
      <div>
        <TimelineBars buckets={buckets} height={38} label="Attacks per 10 seconds, last 15 minutes" />
        <div className="htm-kv" style={{ justifyContent: 'space-between', marginTop: 3, fontSize: 9.5 }}>
          <span className="htm-mono">−15 min</span>
          <span className="htm-mono">now</span>
        </div>
      </div>
      <div className="htm-chips" role="group" aria-label="Attack categories">
        {CATEGORIES.slice(0, 3).map((c, i) => (
          <CategoryChip key={c.id} category={c} index={i} value={stats.byType[i]} total={total} on={settings.types[i]} onToggle={() => controller.toggleType(i)} />
        ))}
        {stats.byType[3] > 0 ? (
          <CategoryChip category={CATEGORIES[3]} index={3} value={stats.byType[3]} total={total} on={settings.types[3]} onToggle={() => controller.toggleType(3)} />
        ) : null}
      </div>
      <label className="htm-toggle">
        <span>
          Hide domestic attacks <span className="htm-muted">({fmtCompact(stats.domestic)})</span>
        </span>
        <Switch size="xs" checked={settings.hideDomestic} onCheckedChange={v => controller.setHideDomestic(v)} aria-label="Hide attacks whose source and target are in the same country" />
      </label>
    </section>
  )
}

function CategoryChip({ category, index, value, total, on, onToggle }) {
  return (
    <Tip label={`${category.hint}. Arcs: ${category.pattern}, markers: ${category.shape}. Press ${index + 1} to toggle.`}>
      <button type="button" className="htm-chip" aria-pressed={on} onClick={onToggle}>
        <Shape type={category.id} size={12} />
        <span className="htm-chip-name">{category.label}</span>
        <span className="htm-chip-count htm-num">{fmtCompact(value)}</span>
        <span className="htm-chip-share htm-num">{pct(value, total)}%</span>
        <span className="htm-chip-bar" aria-hidden="true">
          <i style={{ width: `${pct(value, total)}%`, background: catVar(index) }} />
        </span>
      </button>
    </Tip>
  )
}

/** Most targeted / most active sources / most seen attacks, from this session. */
export function RankingCard({ controller, onCountry }) {
  const [tab, setTab] = useState('targets')
  const { store } = controller
  const rows =
    tab === 'targets' ? store.targets(6) : tab === 'sources' ? store.sources(6) : store.topNames(6).map(([name, attacks]) => ({ name, attacks }))
  const max = Math.max(1, ...rows.map(r => r.attacks))
  return (
    <section className="htm-panel htm-card htm-rise" style={{ animationDelay: '120ms' }} aria-label="Rankings">
      <div className="htm-tabs" role="tablist" aria-label="Ranking">
        {[
          ['targets', 'Targets'],
          ['sources', 'Sources'],
          ['names', 'Attacks']
        ].map(([id, label]) => (
          <button key={id} type="button" role="tab" className="htm-tab" aria-selected={tab === id} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>
      <div className="htm-rank" role="tabpanel">
        {rows.length === 0 ? <div className="htm-empty-note">Nothing yet. Rankings fill in as attacks arrive.</div> : null}
        {rows.map(row =>
          row.code ? (
            <button key={row.code} type="button" className="htm-row" onClick={() => onCountry(row.code)} title={`Inspect ${countryName(row.code)}`}>
              <span className="htm-code">{row.code}</span>
              <span className="htm-row-name">{countryName(row.code)}</span>
              <span className="htm-num htm-soft">{fmtCompact(row.attacks)}</span>
              <span className="htm-row-bar" aria-hidden="true">
                <i style={{ width: `${(row.attacks / max) * 100}%` }} />
              </span>
            </button>
          ) : (
            <div key={row.name} className="htm-row" style={{ cursor: 'default' }}>
              <span className="htm-muted htm-mono" style={{ fontSize: 10 }}>
                ×
              </span>
              <span className="htm-row-name" title={row.name}>
                {row.name}
              </span>
              <span className="htm-num htm-soft">{fmtCompact(row.attacks)}</span>
              <span className="htm-row-bar" aria-hidden="true">
                <i style={{ width: `${(row.attacks / max) * 100}%` }} />
              </span>
            </div>
          )
        )}
      </div>
    </section>
  )
}

/** Check Point's own "last 24 hours" rankings (live mode only). */
export function IntelCard({ rest, onCountry }) {
  const [tab, setTab] = useState('countries')
  const [state, setState] = useState({ loading: true })
  useEffect(() => {
    let alive = true
    rest('/top')
      .then(answer => alive && setState(answer?.ok ? { data: answer } : { error: answer?.error ?? 'Unavailable' }))
      .catch(error => alive && setState({ error: String(error?.message ?? error) }))
    return () => {
      alive = false
    }
  }, [rest])
  const rows = state.data?.[tab] ?? []
  return (
    <section className="htm-panel htm-card htm-rise" style={{ animationDelay: '180ms' }} aria-label="Check Point last 24 hours">
      <div className="htm-card-head">
        <span className="htm-label">Check Point · last 24 h</span>
        <Tip label="Check Point's own daily rankings: the highest attack rate per organization. 100% is the leader; bars are relative to it.">
          <span className="htm-muted" tabIndex={0} aria-label="About these rankings">
            <Codicon name="info" size={12} />
          </span>
        </Tip>
      </div>
      <div className="htm-tabs" role="tablist" aria-label="Category">
        {[
          ['countries', 'Countries'],
          ['industries', 'Industries'],
          ['malwareTypes', 'Malware']
        ].map(([id, label]) => (
          <button key={id} type="button" role="tab" className="htm-tab" aria-selected={tab === id} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>
      {state.loading ? <div className="htm-skeleton" style={{ height: 92 }} /> : null}
      {state.error ? <div className="htm-empty-note">Couldn't load Check Point's rankings: {state.error}</div> : null}
      <div className="htm-rank">
        {rows.map(row => {
          const isCountry = tab === 'countries' && countryByCode(row.id)
          const body = (
            <>
              {tab === 'countries' ? <span className="htm-code">{row.id}</span> : <span />}
              <span className="htm-row-name">{tab === 'countries' ? countryName(row.id) : row.id}</span>
              <span className="htm-num htm-muted" style={{ fontSize: 10.5 }}>
                {Math.round(row.fraction * 100)}%
              </span>
              <span className="htm-row-bar" aria-hidden="true">
                <i style={{ width: `${row.fraction * 100}%` }} />
              </span>
            </>
          )
          return isCountry ? (
            <button key={row.id} type="button" className="htm-row" onClick={() => onCountry(row.id)}>
              {body}
            </button>
          ) : (
            <div key={row.id} className="htm-row" style={{ cursor: 'default' }}>
              {body}
            </div>
          )
        })}
      </div>
    </section>
  )
}

/** The live feed list. */
export function FeedCard({ controller, paused, demo, onEvent, onHover, activeId }) {
  const now = useNow(1000, !paused)
  const feed = controller.feed().filter(controller.passes).slice(0, 60)
  const fresh = paused ? 0 : 6
  const missed = controller.newWhilePaused()
  return (
    <section className="htm-panel htm-feed htm-rise" style={{ animationDelay: '90ms' }} aria-label="Live feed">
      <div className="htm-feed-head">
        <span className="htm-label">{demo ? 'Simulated feed' : 'Live feed'}</span>
        <span className="htm-muted htm-num" style={{ fontSize: 10.5 }}>
          {paused ? 'paused' : 'newest first'}
        </span>
      </div>
      {paused && missed > 0 ? (
        <div className="htm-paused-note" role="status">
          <Codicon name="debug-pause" size={12} /> {fmt(missed)} new while paused. Resume to catch up.
        </div>
      ) : null}
      <div className="htm-feed-list" role="list" onMouseLeave={() => onHover(null)}>
        {feed.length === 0 ? <div className="htm-empty-note" style={{ padding: '6px 8px' }}>No attacks to show{controller.store.stats().events ? ' with the current filters' : ' yet'}.</div> : null}
        {feed.map((event, i) => (
          <FeedRow
            key={event.id}
            event={event}
            now={now}
            fresh={i < fresh && now - event.received < 4000}
            active={event.id === activeId}
            demo={demo}
            onClick={() => onEvent(event)}
            onHover={onHover}
          />
        ))}
      </div>
    </section>
  )
}

function FeedRow({ event, now, fresh, active, demo, onClick, onHover }) {
  const index = CATEGORY_INDEX[event.type] ?? 3
  const reports = event.repeats + 1
  return (
    <button
      type="button"
      role="listitem"
      className="htm-event"
      data-fresh={fresh}
      data-active={active}
      style={{ '--htm-row-color': catVar(index) }}
      onClick={onClick}
      onMouseEnter={() => onHover(event.id)}
      onFocus={() => onHover(event.id)}
      onBlur={() => onHover(null)}
      aria-label={`${CATEGORIES[index].label}: ${event.name}, ${countryName(event.src.country)} to ${countryName(event.dst.country)}`}
    >
      <span className="htm-event-glyph">
        <Shape type={event.type} size={11} />
      </span>
      <span style={{ minWidth: 0 }}>
        <span className="htm-event-name">{event.name}</span>
        <span className="htm-event-route">
          <span className="htm-code">{event.src.country ?? '??'}</span>
          <Codicon name="arrow-right" size={10} />
          <span className="htm-code">{event.dst.country ?? '??'}</span>
          <span className="htm-ellipsis">{countryName(event.dst.country)}</span>
        </span>
      </span>
      <span className="htm-event-side">
        <span className="htm-event-age htm-num">{age(event.received, now)}</span>
        {demo ? <span className="htm-badge htm-badge--demo">DEMO</span> : null}
        {event.count > 1 || reports > 1 ? (
          <span className="htm-badge htm-num" title={reports > 1 ? `${reports} identical reports within 2 s` : `${event.count} attacks in this event`}>
            ×{fmtCompact(event.count * reports)}
          </span>
        ) : null}
      </span>
    </button>
  )
}

/** Details for a selected attack. */
export function EventPanel({ event, onClose, onCountry, onFly }) {
  const now = useNow(1000)
  const index = CATEGORY_INDEX[event.type] ?? 3
  const category = CATEGORIES[index]
  const reports = event.repeats + 1
  // The feed's regions are mostly short state codes ("9", "MT"); only show ones that read as names.
  const where = p => [p.city, p.region && p.region.length > 3 ? p.region : null].filter(Boolean).join(', ')
  return (
    <section className="htm-panel htm-card htm-detail" aria-label="Attack details">
      <div className="htm-detail-head">
        <span className="htm-label" style={{ display: 'flex', alignItems: 'center', gap: 7, color: catVar(index) }}>
          <Shape type={event.type} size={12} /> {category.label}
          {event.demo ? <span className="htm-badge htm-badge--demo">DEMO</span> : null}
        </span>
        <button type="button" className="htm-btn" onClick={onClose} aria-label="Close details (Esc)">
          <Codicon name="close" />
        </button>
      </div>
      <div className="htm-detail-title">{event.name}</div>
      <div className="htm-route">
        {[event.src, event.dst].map((p, i) => [
          i ? (
            <span key="arrow" className="htm-route-arrow" aria-hidden="true">
              <Codicon name="arrow-right" />
            </span>
          ) : null,
          <div key={i} className="htm-route-end" style={i ? { alignItems: 'flex-end', textAlign: 'right' } : undefined}>
            <span className="htm-label">{i ? 'Target' : 'Source'}</span>
            <strong>{countryName(p.country)}</strong>
            {where(p) ? (
              <span className="htm-muted" style={{ fontSize: 10.5 }}>
                {where(p)}
              </span>
            ) : null}
          </div>
        ])}
      </div>
      <dl className="htm-facts">
        <dt>Attacks</dt>
        <dd className="htm-num">
          {fmt(event.count)}
          {reports > 1 ? ` × ${reports} identical reports` : ''}
        </dd>
        <dt>Received</dt>
        <dd className="htm-num">
          {clock(event.received)} · {age(event.received, now)} ago
        </dd>
        <dt>Location</dt>
        <dd>
          {event.src.located === 'exact' && event.dst.located === 'exact'
            ? 'Coordinates from the feed (often a country or region centroid)'
            : 'Feed gave no coordinates for one end; placed at the country'}
        </dd>
        <dt>Category</dt>
        <dd>{category.hint}</dd>
      </dl>
      <div className="htm-actions">
        <button type="button" className="htm-btn htm-btn--ghost" onClick={onFly}>
          <Codicon name="target" /> Show on globe
        </button>
        {[event.src.country, event.dst.country]
          .filter((c, i, all) => c && all.indexOf(c) === i && countryByCode(c))
          .map(code => (
            <button key={code} type="button" className="htm-btn htm-btn--ghost" onClick={() => onCountry(code)}>
              <span className="htm-code">{code}</span> Inspect
            </button>
          ))}
      </div>
    </section>
  )
}

/** Details for a selected country: this session's observations, plus Check Point's 30-day series when live. */
export function CountryPanel({ code, controller, live, rest, isolate, onClose, onCountry }) {
  const detail = controller.store.countryDetail(code)
  const [remote, setRemote] = useState({ loading: live })
  useEffect(() => {
    if (!live) return undefined
    let alive = true
    setRemote({ loading: true })
    rest(`/country/${code}`)
      .then(answer => alive && setRemote(answer?.ok ? { data: answer } : { error: answer?.error ?? 'Unavailable' }))
      .catch(error => alive && setRemote({ error: String(error?.message ?? error) }))
    return () => {
      alive = false
    }
  }, [code, live, rest])
  const incoming = detail?.in
  const outgoing = detail?.out
  const name = countryName(code)
  return (
    <section className="htm-panel htm-card htm-detail" aria-label={`${name} details`}>
      <div className="htm-detail-head">
        <span style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
          <span className="htm-code" style={{ height: 20, fontSize: 11 }}>
            {code}
          </span>
          <span className="htm-detail-title" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {name}
          </span>
        </span>
        <button type="button" className="htm-btn" onClick={onClose} aria-label="Close details (Esc)">
          <Codicon name="close" />
        </button>
      </div>

      <span className="htm-label">Seen in this session</span>
      <div className="htm-pair">
        {[
          ['Targeted', incoming],
          ['Attacking', outgoing]
        ].map(([label, s]) => (
          <div key={label}>
            <span className="htm-muted" style={{ fontSize: 10.5 }}>
              {label}
            </span>
            <span className="htm-pair-value htm-num">{fmtCompact(s?.attacks ?? 0)}</span>
            {s?.attacks ? <StackBar byType={s.byType} /> : <span className="htm-muted" style={{ fontSize: 10.5 }}>none yet</span>}
          </div>
        ))}
      </div>
      {incoming?.names.length ? (
        <div className="htm-rank">
          <span className="htm-label" style={{ marginBottom: 4 }}>
            Top attacks on {name}
          </span>
          {incoming.names.map(([n, v]) => (
            <div key={n} className="htm-row" style={{ cursor: 'default' }}>
              <span />
              <span className="htm-row-name" title={n}>
                {n}
              </span>
              <span className="htm-num htm-soft">{fmtCompact(v)}</span>
            </div>
          ))}
        </div>
      ) : null}
      {incoming?.partners.length ? (
        <div className="htm-rank">
          <span className="htm-label" style={{ marginBottom: 4 }}>
            Top sources
          </span>
          {incoming.partners.map(([c, v]) => (
            <button key={c} type="button" className="htm-row" onClick={() => onCountry(c)}>
              <span className="htm-code">{c}</span>
              <span className="htm-row-name">{countryName(c)}</span>
              <span className="htm-num htm-soft">{fmtCompact(v)}</span>
            </button>
          ))}
        </div>
      ) : null}
      <label className="htm-toggle">
        <span>Only attacks involving {name}</span>
        <Switch size="xs" checked={isolate} onCheckedChange={v => controller.isolate.set(v)} aria-label={`Only show attacks involving ${name}`} />
      </label>

      {live ? (
        <>
          <span className="htm-label" style={{ marginTop: 4 }}>
            Check Point · last 30 days
          </span>
          {remote.loading ? <div className="htm-skeleton" /> : null}
          {remote.error ? <div className="htm-empty-note">Couldn't load Check Point's country data: {remote.error}</div> : null}
          {remote.data?.trend ? (
            <div>
              <div className="htm-caption" style={{ marginBottom: 4 }}>
                Daily attack trend for {name} (Check Point's index)
              </div>
              <AreaChart values={remote.data.trend.values} dates={remote.data.trend.dates} label={`Daily attack trend for ${name}`} />
            </div>
          ) : null}
          {remote.data?.malware_types ? (
            <div>
              <div className="htm-caption" style={{ marginBottom: 6 }}>
                Malware types · % of organizations affected
              </div>
              <div className="htm-multiples">
                {Object.entries(remote.data.malware_types.series).map(([type, values]) => (
                  <div key={type} className="htm-multiple">
                    <div className="htm-multiple-head">
                      <span>{type}</span>
                      <span className="htm-num htm-muted">{values[values.length - 1].toFixed(1)}%</span>
                    </div>
                    <MiniLine values={values} />
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          {remote.data && !remote.data.trend && !remote.data.malware_types ? (
            <div className="htm-empty-note">Check Point has no 30-day data for {name}.</div>
          ) : null}
        </>
      ) : null}
    </section>
  )
}
