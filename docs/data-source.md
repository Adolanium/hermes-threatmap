# Data source: what Check Point's threat map exposes

Researched 2026-10-22 against threatmap.checkpoint.com (frontend build 112, 2026-02-19).

## Endpoints

The map page (`https://threatmap.checkpoint.com/`) is a React bundle served from
`sc1.checkpoint.com/threatmap/build/`. It calls `https://threatmap-api.checkpoint.com/ThreatMap/api/`:

| Path | Method | What | Used by this plugin |
|---|---|---|---|
| `feed` | GET, `text/event-stream` | Live attacks and global counters (SSE) | yes, via the backend relay |
| `topStats` | GET, JSON | Daily rankings: countries, industries, malware types | yes, cached 15 min |
| `countries/{CC}` | GET, JSON | 30-day trend and malware-type shares for one country | yes, cached 30 min |
| `themes/` | GET, JSON | Seasonal visual themes for their page | no |

The page also POSTs click and performance telemetry to `.../ThreatMap/logs/` with an `X-Client-Id`.
This plugin sends none of that.

- **No authentication.** No keys, cookies or tokens.
- **CORS-locked.** Requests carrying a foreign `Origin` get `403 Invalid CORS request`, so a Desktop
  renderer cannot call the API directly. Server-side requests (no `Origin`) are answered. The plugin
  does not spoof an `Origin`; it relays from the gateway.
- **No public documentation, version or SLA.** Everything below is observed behaviour.

## The SSE stream

```
data:{"recentPeriod":[16473787, …],"today":9124259}
event:counter
retry:10000

:keep-alive

event:attack
data:{"a_c":2,"a_n":"NULL Encoding detected within a HTTP request","a_t":"exploit","d_co":"BR","d_la":-15.597,"d_lo":-56.0958,"d_s":"MT","s_co":"US","s_lo":-97.822,"s_la":37.751,"s_s":null,"t":null}
```

- Field order inside an event varies (`data` before `event` on counters). Keep-alive comments arrive
  every few seconds. `retry: 10000` is sent with each event.
- **`attack`** fields, named in their bundle's constants:

  | Field | Meaning | Notes |
  |---|---|---|
  | `a_t` | type | `exploit`, `malware`, `phishing` observed |
  | `a_n` | attack name | IPS/AV signature names, often with CVE ids |
  | `a_c` | attack count | integer ≥ 1; their simulator sums it into "today" |
  | `s_co` / `d_co` | source / destination country | ISO 3166 alpha-2 |
  | `s_la`, `s_lo` / `d_la`, `d_lo` | coordinates | often a country or region centroid (US is always 37.751, -97.822) |
  | `s_s` / `d_s` | state/region | short codes (`MT`, `9`) or null |
  | `d_ci`, `s_io` | city | in their constants; not seen populated |
  | `t` | timestamp | always null in observation |

- **`counter`**: `today` (global attacks detected so far in the UTC day) and `recentPeriod` (31 daily
  totals, oldest first). These are ThreatCloud-wide estimates, not a sum of the streamed attacks.
- **Rate.** About 1–2 events per second (90 s sample: 112 attacks, 99% exploit), with bursts. There
  are no event ids, and identical payloads repeat in bursts (ten identical "Malformed Java GIF file"
  US→US events within a second).
- **Domestic events are common**, with source and target at the same centroid.

## How the plugin handles it

| Problem | Handling |
|---|---|
| Malformed JSON, wrong types, oversized events | dropped and counted (`stats.malformed`) |
| Missing or invalid coordinates (incl. 0,0) | nulled; the page places the end at the country's label point and says so |
| Unknown category | shown as "Other" (grey, square) |
| Duplicates (no ids) | identical payloads within 2 s are kept but marked `repeat_of`; the page folds them into one row (×N) and pulses the target instead of drawing a new arc |
| Bursts | 80 events/s cap at the relay; the page samples arcs (≤24 launches/s, ≤2.5 s lag) but counts everything |
| Disconnects, errors | exponential backoff with jitter (2 s → 60 s), honouring `retry` after a clean close |
| Stalls | 45 s read timeout (keep-alives normally arrive every few seconds) → reconnect |
| Endpoint gone | three 401/403/404/410 answers in a row → "unavailable", rechecked every 5 minutes |
| Gateway restart | each relay has a `stream_id`; the page resets its cursor when it changes |
| Memory | relay buffer 2,000 events; page feed 200 rows; tallies capped per country and name |

## Terms

Check Point's [website terms](https://www.checkpoint.com/privacy/terms/) (no date given) say users
may not use automated tools, scripts or software to access the site without written consent; that
site materials are for informational, non-commercial use; and that no portion may be reproduced
without written permission. The threat map has no separate API terms.

This plugin therefore:

- asks for consent before the first live connection, and states the above in the dialog;
- connects only while a Threat Map page is open (one shared connection, closed 45 s after the last
  poll), identifies itself with an honest `User-Agent`, and caches the JSON lookups;
- stores nothing, never redistributes, and credits Check Point on the page;
- ships a labelled demo mode, so it is usable and testable without the feed.

Anyone distributing the plugin more widely (for example in a plugin catalog), or using the data
commercially, should obtain Check Point's permission first.

## Alternatives considered

None of these offers a live, geolocated source→target attack stream like Check Point's, which is
why the plugin keeps a pluggable source boundary (`desktop-src/src/data/sources.js`):

- **SANS ISC / DShield API**: documented and free with attribution; aggregated attacking IPs, ports
  and reports. No targets, so no arcs, and it needs IP geolocation.
- **abuse.ch (ThreatFox, URLhaus, Feodo Tracker)**: documented feeds with permissive licences
  (ThreatFox data is CC0); indicators and malware families, but no source/target geography.
- **Other vendor maps** (Kaspersky Cybermap, Fortinet, Radware): also undocumented, with similar
  terms.

A permitted second source could plug in as another backend route plus a `create…Source` in
`sources.js`, without changing the globe or the UI.
