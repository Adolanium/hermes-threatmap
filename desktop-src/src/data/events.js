// The page's event model. Events reach the page from the backend relay (already validated there)
// or the demo generator; `toEvent` re-checks everything anyway, since the page must never trust a
// network payload to be well-formed.
import { countryByCode } from '../geo/world.js'

/** Attack categories. Each has a colour (a theme variable), a shape and an arc pattern, so the
 *  categories never depend on colour alone. */
export const CATEGORIES = [
  {
    id: 'exploit',
    label: 'Exploit',
    shape: 'diamond',
    pattern: 'solid',
    cssVar: '--ui-orange',
    fallbackVar: '--ui-red',
    hint: 'Attempts to exploit a software vulnerability'
  },
  {
    id: 'malware',
    label: 'Malware',
    shape: 'circle',
    pattern: 'dashed',
    cssVar: '--ui-purple',
    fallbackVar: '--ui-accent',
    hint: 'Malware delivery, infection or command traffic'
  },
  {
    id: 'phishing',
    label: 'Phishing',
    shape: 'triangle',
    pattern: 'dotted',
    cssVar: '--ui-cyan',
    fallbackVar: '--ui-blue',
    hint: 'Phishing sites, messages and lures'
  },
  {
    id: 'other',
    label: 'Other',
    shape: 'square',
    pattern: 'solid',
    cssVar: '--ui-text-secondary',
    fallbackVar: '--ui-text-primary',
    hint: 'Events the feed labelled with a category this page does not know'
  }
]

export const CATEGORY_INDEX = Object.fromEntries(CATEGORIES.map((c, i) => [c.id, i]))
export const categoryOf = type => CATEGORIES[CATEGORY_INDEX[type] ?? 3]

const COUNTRY = /^[A-Z]{2}$/

function finite(value, low, high) {
  return typeof value === 'number' && Number.isFinite(value) && value >= low && value <= high ? value : null
}

function text(value, limit) {
  if (typeof value !== 'string') return null
  const cleaned = value.replace(/\s+/g, ' ').trim()
  return cleaned ? cleaned.slice(0, limit) : null
}

function place(raw) {
  const p = raw && typeof raw === 'object' ? raw : {}
  const country = typeof p.country === 'string' && COUNTRY.test(p.country) ? p.country : null
  let lat = finite(p.lat, -90, 90)
  let lon = finite(p.lon, -180, 180)
  let located = 'exact'
  if (lat === null || lon === null) {
    // No usable coordinates: fall back to the country's label point.
    const c = countryByCode(country)
    lat = c ? c.lat : null
    lon = c ? c.lon : null
    located = c ? 'country' : 'none'
  }
  return { country, lat, lon, located, region: text(p.region, 80), city: text(p.city, 80) }
}

/**
 * Backend/demo payload -> page event, or null when it cannot be shown.
 * @param {object} raw
 * @param {{ idPrefix: string, demo: boolean }} origin
 */
export function toEvent(raw, origin) {
  if (!raw || typeof raw !== 'object') return null
  const seq = Number.isSafeInteger(raw.seq) && raw.seq > 0 ? raw.seq : null
  if (seq === null) return null
  const type = CATEGORY_INDEX[raw.type] !== undefined ? raw.type : 'other'
  const count = Number.isSafeInteger(raw.count) && raw.count > 0 ? Math.min(raw.count, 1_000_000) : 1
  const src = place(raw.src)
  const dst = place(raw.dst)
  if (!src.country && src.located === 'none') return null
  if (!dst.country && dst.located === 'none') return null
  const received = finite(raw.received, 0, 8.64e15) ?? Date.now()
  const repeatOf = Number.isSafeInteger(raw.repeat_of) && raw.repeat_of > 0 && raw.repeat_of < seq ? raw.repeat_of : null
  return {
    id: `${origin.idPrefix}${seq}`,
    seq,
    type,
    name: text(raw.name, 160) ?? 'Unnamed attack',
    count,
    src,
    dst,
    received,
    repeatOf: repeatOf === null ? null : `${origin.idPrefix}${repeatOf}`,
    repeats: 0,
    demo: origin.demo
  }
}

export const isDomestic = event => !!event.src.country && event.src.country === event.dst.country

/** Whether an event's arc can be drawn (both ends placed). */
export const isPlaceable = event => event.src.lat !== null && event.dst.lat !== null

// --- Demo ----------------------------------------------------------------------------------------

// Simulated traffic for trying the page without the live feed. The names are generic descriptions,
// not real detections, and every demo event carries `demo: true` so the UI can label it.
const DEMO_SOURCES = [
  ['US', 16], ['CN', 9], ['RU', 7], ['NL', 6], ['DE', 6], ['TH', 5], ['IN', 5], ['BR', 4], ['VN', 4],
  ['KR', 3], ['FR', 3], ['GB', 3], ['SG', 3], ['ID', 3], ['IR', 2], ['UA', 2], ['TR', 2], ['JP', 2],
  ['HK', 2], ['RO', 2], ['ZA', 1], ['NG', 1], ['MX', 1], ['AR', 1], ['PL', 1], ['CA', 1], ['IT', 1]
]
const DEMO_TARGETS = [
  ['US', 14], ['BR', 7], ['IN', 6], ['DE', 5], ['GB', 5], ['IL', 4], ['IT', 4], ['FR', 4], ['MX', 3],
  ['JP', 3], ['AU', 3], ['ES', 3], ['CA', 3], ['TR', 2], ['ET', 2], ['NG', 2], ['ZA', 2], ['CO', 2],
  ['PE', 2], ['PH', 2], ['NO', 2], ['SE', 2], ['PL', 2], ['KE', 1], ['MN', 1], ['UZ', 1], ['AO', 1],
  ['CL', 1], ['TW', 1], ['SA', 1], ['AE', 1], ['EG', 1], ['NZ', 1]
]
const DEMO_ATTACKS = {
  exploit: [
    'Directory traversal attempt', 'SQL injection attempt', 'Remote code execution attempt',
    'Command injection in a router web interface', 'Cross-site scripting attempt',
    'XML external entity injection', 'Server-side request forgery attempt', 'Malformed HTTP request'
  ],
  malware: [
    'Botnet command-and-control traffic', 'Infostealer download', 'Ransomware dropper',
    'Banking trojan beacon', 'Cryptominer download', 'Malicious document macro'
  ],
  phishing: ['Credential phishing page', 'Fake delivery notice', 'Lookalike login domain', 'Malicious invoice lure']
}

function weighted(rows, rand) {
  const total = rows.reduce((sum, [, w]) => sum + w, 0)
  let pick = rand() * total
  for (const [value, w] of rows) {
    pick -= w
    if (pick <= 0) return value
  }
  return rows[rows.length - 1][0]
}

function jitter(code, rand) {
  const c = countryByCode(code)
  if (!c) return { country: code, lat: null, lon: null }
  const spread = Math.min(6, Math.sqrt(c.area) * 30)
  return {
    country: code,
    lat: Math.max(-85, Math.min(85, c.lat + (rand() - 0.5) * spread)),
    lon: ((c.lon + (rand() - 0.5) * spread * 1.4 + 540) % 360) - 180
  }
}

/** A deterministic-per-seed generator of demo payloads (same shape as the backend's). */
export function createDemoGenerator(seed = Date.now()) {
  let state = seed >>> 0 || 1
  const rand = () => {
    state ^= state << 13
    state ^= state >>> 17
    state ^= state << 5
    return (state >>> 0) / 4294967296
  }
  let seq = 0
  return function next(now = Date.now()) {
    const roll = rand()
    const type = roll < 0.66 ? 'exploit' : roll < 0.9 ? 'malware' : 'phishing'
    const names = DEMO_ATTACKS[type]
    const src = weighted(DEMO_SOURCES, rand)
    let dst = weighted(DEMO_TARGETS, rand)
    if (rand() < 0.08) dst = src
    seq += 1
    return {
      seq,
      type,
      name: names[Math.floor(rand() * names.length)],
      count: rand() < 0.8 ? 1 : 1 + Math.floor(rand() * rand() * 40),
      src: jitter(src, rand),
      dst: jitter(dst, rand),
      received: now,
      repeat_of: null
    }
  }
}
