// Hermes Threat Map — Desktop half. A page (route + sidebar row + palette command) and a status-bar
// chip that shows while a feed is running. Live data comes from this package's backend relay
// (dashboard/plugin_api.py); demo data is generated here and always labelled.
import {
  atom,
  host,
  PALETTE_AREA,
  ROUTES_AREA,
  SIDEBAR_NAV_AREA,
  STATUSBAR_AREAS,
  useValue
} from '@hermes/plugin-sdk'
import { createController } from './controller.js'
import { useThrottled } from './ui/kit.jsx'
import { ThreatMapPage } from './ui/page.jsx'

const PATH = '/threatmap'

function StatusChip({ controller }) {
  const status = useValue(controller.status)
  const paused = useValue(controller.paused)
  useThrottled(controller.store.subscribe, controller.store.version, 1000)
  if (!controller.running()) return null
  const live = status.source === 'live'
  const tone = paused ? 'var(--ui-yellow, var(--ui-text-tertiary))' : status.state === 'live' ? 'var(--ui-green, var(--ui-accent))' : status.state === 'demo' ? 'var(--ui-purple, var(--ui-accent))' : 'var(--ui-yellow, var(--ui-text-tertiary))'
  const rate = controller.store.rate()
  const label = paused ? 'paused' : live ? (status.state === 'live' ? `${Math.round(rate)}/min` : status.state) : 'demo'
  return (
    <button
      type="button"
      onClick={() => host.navigate(PATH)}
      title={live ? 'Threat Map: live feed' : 'Threat Map: simulated demo data'}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '0 6px',
        height: '100%',
        border: 0,
        background: 'transparent',
        cursor: 'pointer',
        color: 'var(--ui-text-tertiary)',
        font: '500 0.6875rem/1 var(--font-mono, ui-monospace, monospace)'
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: tone }} />
      <span>{label}</span>
    </button>
  )
}

export default {
  id: 'hermes-threatmap',
  name: 'Threat Map',
  register(ctx) {
    const controller = createController({
      atom,
      rest: (path, opts) => ctx.rest(path, opts),
      schedule: (fn, ms) => ctx.setTimeout(fn, ms),
      storage: ctx.storage
    })
    ctx.onDispose(() => controller.dispose())
    const openExternal = url => {
      void Promise.resolve(ctx.os?.openExternal?.(url)).catch(() => {})
    }

    ctx.registerMany([
      {
        id: 'page',
        area: ROUTES_AREA,
        title: 'Threat Map',
        data: { path: PATH },
        render: () => <ThreatMapPage controller={controller} rest={ctx.rest} openExternal={openExternal} />
      },
      {
        id: 'nav',
        area: SIDEBAR_NAV_AREA,
        data: { path: PATH, label: 'Threat Map', codicon: 'globe' }
      },
      {
        id: 'open',
        area: PALETTE_AREA,
        data: {
          id: 'hermes-threatmap.open',
          label: 'Open Threat Map',
          keywords: ['threat', 'map', 'cyber', 'attack', 'globe', 'security', 'check point'],
          run: () => host.navigate(PATH)
        }
      },
      {
        id: 'pause',
        area: PALETTE_AREA,
        data: {
          id: 'hermes-threatmap.pause',
          label: 'Threat Map: Pause or resume',
          keywords: ['threat', 'map', 'pause', 'resume'],
          run: () => controller.setPaused(!controller.paused.get())
        }
      },
      {
        id: 'chip',
        area: STATUSBAR_AREAS.right,
        order: 140,
        render: () => <StatusChip controller={controller} />
      }
    ])
  }
}
