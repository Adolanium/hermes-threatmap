// The globe: three.js scene, camera controls, instanced attack arcs and impact markers, country
// heat, and picking. It knows nothing about React or the plugin SDK; the page drives it through
// the returned handle and must call dispose().
import {
  AdditiveBlending,
  BufferAttribute,
  DataTexture,
  DoubleSide,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  LinearFilter,
  Mesh,
  NearestFilter,
  NormalBlending,
  PerspectiveCamera,
  PlaneGeometry,
  RedFormat,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  UnsignedByteType,
  Vector2,
  Vector3,
  WebGLRenderer
} from 'three'
import { CATEGORY_INDEX } from '../data/events.js'
import { countryRaster, indexAt, RASTER_HEIGHT, RASTER_WIDTH } from '../geo/world.js'
import {
  arcFragment,
  arcVertex,
  backdropFragment,
  backdropVertex,
  earthFragment,
  earthVertex,
  impactFragment,
  impactVertex
} from './shaders.js'

const ARC_POOL = 320
const ARC_SEGMENTS = 64
const IMPACT_POOL = 640
const FOV = 30
const DEG = Math.PI / 180

export function toVector(lat, lon, out = new Vector3()) {
  const phi = lat * DEG
  const lambda = lon * DEG
  return out.set(Math.cos(phi) * Math.sin(lambda), Math.sin(phi), Math.cos(phi) * Math.cos(lambda))
}

export function toLatLon(v) {
  const n = v.clone().normalize()
  return { lat: Math.asin(Math.max(-1, Math.min(1, n.y))) / DEG, lon: Math.atan2(n.x, n.z) / DEG }
}

const easeInOut = t => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)
const wrapLon = lon => ((((lon + 180) % 360) + 360) % 360) - 180

/**
 * @param {HTMLCanvasElement} canvas
 * @param {object} options
 * @param {(now: number) => object[]} options.pull       events due for launch this frame
 * @param {(target: object|null, x: number, y: number) => void} options.onHover
 * @param {(target: object) => void} options.onPick       a country or event was clicked
 * @param {(state: object) => void} options.onFrame       per-frame tracked positions
 * @param {() => void} options.onContextLost
 * @param {(fn: (now: number) => void, opts: object) => {wake(): void, dispose(): void}} options.loop
 */
export function createGlobe(canvas, options) {
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, premultipliedAlpha: true, powerPreference: 'high-performance' })
  renderer.setClearColor(0x000000, 0)
  renderer.autoClear = true
  const scene = new Scene()
  const camera = new PerspectiveCamera(FOV, 1, 0.05, 50)
  const size = new Vector2(1, 1)
  let pixelRatio = 1

  // --- Textures -------------------------------------------------------------------------------
  const idTexture = new DataTexture(countryRaster(), RASTER_WIDTH, RASTER_HEIGHT, RedFormat, UnsignedByteType)
  idTexture.minFilter = NearestFilter
  idTexture.magFilter = NearestFilter
  idTexture.generateMipmaps = false
  idTexture.flipY = false
  idTexture.needsUpdate = true
  const heat = new Float32Array(256)
  const heatBytes = new Uint8Array(256)
  const heatTexture = new DataTexture(heatBytes, 256, 1, RedFormat, UnsignedByteType)
  heatTexture.minFilter = LinearFilter
  heatTexture.magFilter = NearestFilter
  heatTexture.needsUpdate = true
  let heatActive = false

  // --- Backdrop -------------------------------------------------------------------------------
  const backdropUniforms = {
    uCenter: { value: new Vector2() },
    uRadius: { value: 100 },
    uGlow: { value: new Vector3(0.5, 0.6, 1) },
    uStar: { value: new Vector3(1, 1, 1) },
    uTime: { value: 0 },
    uDither: { value: 1 },
    uCell: { value: 2 },
    uDark: { value: 1 },
    uMotion: { value: 1 }
  }
  const backdrop = new Mesh(
    new PlaneGeometry(2, 2),
    new ShaderMaterial({
      vertexShader: backdropVertex,
      fragmentShader: backdropFragment,
      uniforms: backdropUniforms,
      depthTest: false,
      depthWrite: false,
      transparent: true,
      premultipliedAlpha: true
    })
  )
  backdrop.frustumCulled = false
  backdrop.renderOrder = 0
  scene.add(backdrop)

  // --- Earth ----------------------------------------------------------------------------------
  const earthUniforms = {
    uIds: { value: idTexture },
    uHeat: { value: heatTexture },
    uIdSize: { value: [RASTER_WIDTH, RASTER_HEIGHT] },
    uHover: { value: -1 },
    uSelected: { value: -1 },
    uFocus: { value: 0 },
    uDither: { value: 1 },
    uCell: { value: 2 },
    uDark: { value: 1 },
    uLight: { value: new Vector3(-0.55, 0.6, 0.8) },
    uOcean: { value: new Vector3() },
    uOceanLit: { value: new Vector3() },
    uLandLow: { value: new Vector3() },
    uLand: { value: new Vector3() },
    uAccent: { value: new Vector3() },
    uHeatColor: { value: new Vector3() },
    uRim: { value: new Vector3() }
  }
  const earth = new Mesh(
    new SphereGeometry(1, 160, 96),
    new ShaderMaterial({ vertexShader: earthVertex, fragmentShader: earthFragment, uniforms: earthUniforms })
  )
  earth.renderOrder = 1
  scene.add(earth)

  // --- Arcs -----------------------------------------------------------------------------------
  const arcGeometry = new InstancedBufferGeometry()
  {
    const verts = (ARC_SEGMENTS + 1) * 2
    const t = new Float32Array(verts)
    const sideArr = new Float32Array(verts)
    const pos = new Float32Array(verts * 3)
    for (let i = 0; i <= ARC_SEGMENTS; i++) {
      t[i * 2] = t[i * 2 + 1] = i / ARC_SEGMENTS
      sideArr[i * 2] = -1
      sideArr[i * 2 + 1] = 1
    }
    const index = []
    for (let i = 0; i < ARC_SEGMENTS; i++) {
      const a = i * 2
      index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
    }
    arcGeometry.setIndex(index)
    arcGeometry.setAttribute('position', new BufferAttribute(pos, 3))
    arcGeometry.setAttribute('aT', new BufferAttribute(t, 1))
    arcGeometry.setAttribute('aSide', new BufferAttribute(sideArr, 1))
  }
  const arcSrc = new InstancedBufferAttribute(new Float32Array(ARC_POOL * 3), 3)
  const arcDst = new InstancedBufferAttribute(new Float32Array(ARC_POOL * 3), 3)
  const arcTiming = new InstancedBufferAttribute(new Float32Array(ARC_POOL * 4).fill(-1e6), 4)
  arcGeometry.setAttribute('aSrc', arcSrc)
  arcGeometry.setAttribute('aDst', arcDst)
  arcGeometry.setAttribute('aTiming', arcTiming)
  arcGeometry.instanceCount = ARC_POOL
  const colorUniform = [new Vector3(), new Vector3(), new Vector3(), new Vector3()]
  const maskUniform = { value: [1, 1, 1, 1] }
  const arcUniforms = {
    uTime: { value: 0 },
    uRes: { value: size },
    uWidth: { value: 1.2 },
    uMask: maskUniform,
    uColors: { value: colorUniform },
    uStatic: { value: 0 },
    uDark: { value: 1 },
    uHighlight: { value: -1 }
  }
  const arcMaterial = new ShaderMaterial({
    vertexShader: arcVertex,
    fragmentShader: arcFragment,
    uniforms: arcUniforms,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    // Ribbons are extruded in screen space, so their winding is arbitrary: never cull them.
    side: DoubleSide
  })
  const arcs = new Mesh(arcGeometry, arcMaterial)
  arcs.frustumCulled = false
  arcs.renderOrder = 2
  scene.add(arcs)

  // --- Impacts --------------------------------------------------------------------------------
  const impactGeometry = new InstancedBufferGeometry()
  impactGeometry.index = new PlaneGeometry(1, 1).index
  impactGeometry.setAttribute('position', new PlaneGeometry(1, 1).getAttribute('position'))
  const impactPos = new InstancedBufferAttribute(new Float32Array(IMPACT_POOL * 3), 3)
  const impactTiming = new InstancedBufferAttribute(new Float32Array(IMPACT_POOL * 4).fill(-1e6), 4)
  const impactScale = new InstancedBufferAttribute(new Float32Array(IMPACT_POOL).fill(1), 1)
  impactGeometry.setAttribute('aPos', impactPos)
  impactGeometry.setAttribute('aTiming', impactTiming)
  impactGeometry.setAttribute('aScale', impactScale)
  impactGeometry.instanceCount = IMPACT_POOL
  const impactUniforms = {
    uTime: arcUniforms.uTime,
    uMask: maskUniform,
    uColors: { value: colorUniform },
    uStatic: arcUniforms.uStatic,
    uDark: arcUniforms.uDark
  }
  const impactMaterial = new ShaderMaterial({
    vertexShader: impactVertex,
    fragmentShader: impactFragment,
    uniforms: impactUniforms,
    side: DoubleSide,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2
  })
  const impacts = new Mesh(impactGeometry, impactMaterial)
  impacts.frustumCulled = false
  impacts.renderOrder = 3
  scene.add(impacts)

  // --- State ----------------------------------------------------------------------------------
  let simTime = 0
  let lastNow = null
  let paused = false
  let reducedMotion = false
  let autoRotate = true
  let autoRotateHoldUntil = 0
  const view = { lat: 18, lon: -28, dist: 4.5 }
  let fitDist = 4.5
  const velocity = { lon: 0, lat: 0 }
  let tween = null
  let disposed = false
  let contextLost = false

  const arcSlots = new Array(ARC_POOL).fill(null) // { eventId, start, dur }
  let arcNext = 0
  const impactSlots = new Array(IMPACT_POOL).fill(null) // { eventId, start, dur, pos: Vector3, role }
  let impactNext = 0
  const pendingHeat = [] // { at, index, amount }
  let highlightId = null
  let selectedIndex = -1
  let hoverIndex = -1
  let tracked = null // { lat, lon }

  // --- Sizing ---------------------------------------------------------------------------------
  function resize(width, height) {
    if (disposed || width < 2 || height < 2) return
    pixelRatio = Math.min(window.devicePixelRatio || 1, 2)
    renderer.setPixelRatio(pixelRatio)
    renderer.setSize(width, height, false)
    size.set(width * pixelRatio, height * pixelRatio)
    camera.aspect = width / height
    // Fit: the globe's apparent radius is ~33% of the limiting dimension.
    const verticalTan = Math.tan((FOV / 2) * DEG)
    const ndcRadius = 0.66 * Math.min(1, camera.aspect)
    const oldFit = fitDist
    fitDist = Math.sqrt(1 + (1 / (ndcRadius * verticalTan)) ** 2)
    view.dist = Math.min(maxDist(), view.dist * (fitDist / oldFit))
    camera.updateProjectionMatrix()
    const cell = Math.max(1, Math.round(1.5 * pixelRatio))
    earthUniforms.uCell.value = cell
    backdropUniforms.uCell.value = cell
    arcUniforms.uWidth.value = 1.15 * pixelRatio
    wake()
  }
  const minDist = () => 1.32
  const maxDist = () => fitDist * 1.45

  /** Apparent globe radius in CSS pixels at the current distance. */
  function globeRadiusPx() {
    const h = size.y / pixelRatio
    return (h / 2) / (Math.sqrt(view.dist * view.dist - 1) * Math.tan((FOV / 2) * DEG))
  }

  // --- Palette --------------------------------------------------------------------------------
  function setPalette(p) {
    const set = (u, c) => u.value.set(c[0], c[1], c[2])
    set(earthUniforms.uOcean, p.ocean)
    set(earthUniforms.uOceanLit, p.oceanLit)
    set(earthUniforms.uLandLow, p.landLow)
    set(earthUniforms.uLand, p.land)
    set(earthUniforms.uAccent, p.accent)
    set(earthUniforms.uHeatColor, p.heat)
    set(earthUniforms.uRim, p.rim)
    set(backdropUniforms.uGlow, p.rim)
    set(backdropUniforms.uStar, p.star)
    p.categories.forEach((c, i) => colorUniform[i].set(c[0], c[1], c[2]))
    const dark = p.dark ? 1 : 0
    earthUniforms.uDark.value = dark
    backdropUniforms.uDark.value = dark
    arcUniforms.uDark.value = dark
    // Light glows add up on dark backgrounds; on light ones additive light would vanish.
    for (const m of [arcMaterial, impactMaterial]) {
      if (p.dark) {
        m.blending = AdditiveBlending
        m.premultipliedAlpha = true
      } else {
        m.blending = NormalBlending
        m.premultipliedAlpha = true
      }
      m.needsUpdate = true
    }
    wake()
  }

  // --- Launching ------------------------------------------------------------------------------
  const tmpA = new Vector3()
  const tmpB = new Vector3()
  const tmpC = new Vector3()

  function launch(event) {
    if (event.src.lat === null || event.dst.lat === null) return
    const kind = CATEGORY_INDEX[event.type] ?? 3
    const a = toVector(event.src.lat, event.src.lon, tmpA)
    const b = toVector(event.dst.lat, event.dst.lon, tmpB)
    let ang = Math.acos(Math.max(-1, Math.min(1, a.dot(b))))
    // Same place at both ends (common: domestic attacks share one country centroid). Draw a short
    // local hop so it reads as an arc from any angle; the impact stays at the true location.
    const arcEnd = ang < 0.006 ? toVector(event.dst.lat + 2.2, event.dst.lon + 3.2, tmpC) : b
    if (ang < 0.006) ang = Math.acos(Math.max(-1, Math.min(1, a.dot(arcEnd))))
    const dur = reducedMotion ? 3.2 : 1.5 + 2.1 * (ang / Math.PI)
    const start = simTime
    const slot = arcNext
    arcNext = (arcNext + 1) % ARC_POOL
    arcSrc.setXYZ(slot, a.x, a.y, a.z)
    arcDst.setXYZ(slot, arcEnd.x, arcEnd.y, arcEnd.z)
    arcTiming.setXYZW(slot, start, dur, kind, Math.random())
    arcSrc.needsUpdate = arcDst.needsUpdate = arcTiming.needsUpdate = true
    arcSlots[slot] = { eventId: event.id, start, dur }

    const scale = 0.8 + Math.min(1.2, Math.log10(event.count + 1) * 0.6)
    const arrive = reducedMotion ? start : start + dur / 1.3
    addImpact(event.id, a, kind, start, reducedMotion ? 3.2 : 1.2, 1, 0.9)
    addImpact(event.id, b, kind, arrive, reducedMotion ? 3.2 : 2.0, 0, scale)
    const index = indexAt(event.dst.lat, event.dst.lon)
    if (index > 0 && index < 255) pendingHeat.push({ at: arrive, index, amount: 0.12 + Math.min(0.2, Math.log10(event.count + 1) * 0.1) })
    if (pendingHeat.length > 600) pendingHeat.splice(0, pendingHeat.length - 600)
    wake()
  }

  /** A repeat of an event already on screen: pulse its target again instead of a new arc. */
  function pulse(event) {
    if (event.dst.lat === null) return
    const kind = CATEGORY_INDEX[event.type] ?? 3
    addImpact(event.id, toVector(event.dst.lat, event.dst.lon, tmpB), kind, simTime, reducedMotion ? 2 : 1.4, 0, 0.7)
    wake()
  }

  function addImpact(eventId, v, kind, start, dur, role, scale) {
    const slot = impactNext
    impactNext = (impactNext + 1) % IMPACT_POOL
    impactPos.setXYZ(slot, v.x, v.y, v.z)
    impactTiming.setXYZW(slot, start, dur, kind, role)
    impactScale.setX(slot, scale)
    impactPos.needsUpdate = impactTiming.needsUpdate = impactScale.needsUpdate = true
    impactSlots[slot] = { eventId, start, dur, pos: v.clone(), role }
  }

  function activeAnimations() {
    for (const s of arcSlots) if (s && simTime < s.start + s.dur) return true
    for (const s of impactSlots) if (s && simTime < s.start + s.dur) return true
    return pendingHeat.length > 0
  }

  // --- Camera ---------------------------------------------------------------------------------
  function applyCamera() {
    toVector(view.lat, view.lon, camera.position).multiplyScalar(view.dist)
    camera.up.set(0, 1, 0)
    camera.lookAt(0, 0, 0)
    camera.updateMatrixWorld()
  }

  function flyTo(lat, lon, dist = view.dist) {
    const target = { lat: Math.max(-75, Math.min(75, lat)), lon: wrapLon(lon), dist: Math.max(minDist(), Math.min(maxDist(), dist)) }
    velocity.lon = velocity.lat = 0
    autoRotateHoldUntil = performance.now() + 9000
    if (reducedMotion) {
      Object.assign(view, target)
      tween = null
    } else {
      // Shortest way round in longitude.
      let dLon = target.lon - view.lon
      if (dLon > 180) dLon -= 360
      if (dLon < -180) dLon += 360
      const angle = Math.hypot(dLon, target.lat - view.lat)
      tween = { from: { ...view }, dLon, to: target, start: performance.now(), ms: 700 + Math.min(900, angle * 6) }
    }
    wake()
  }

  function resetView() {
    flyTo(18, view.lon, fitDist)
  }

  function zoomBy(factor) {
    tween = null
    view.dist = Math.max(minDist(), Math.min(maxDist(), view.dist * factor))
    autoRotateHoldUntil = performance.now() + 6000
    wake()
  }

  function rotateBy(dLon, dLat) {
    tween = null
    view.lon = wrapLon(view.lon + dLon)
    view.lat = Math.max(-80, Math.min(80, view.lat + dLat))
    autoRotateHoldUntil = performance.now() + 6000
    wake()
  }

  // --- Pointer input --------------------------------------------------------------------------
  const pointers = new Map()
  let drag = null
  let pinch = null
  let hoverPoint = null
  let hoverDirty = false
  let lastHoverKey = ''
  let moved = 0

  function local(e) {
    const rect = canvas.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  function onPointerDown(e) {
    if (e.button !== 0 && e.pointerType === 'mouse') return
    canvas.setPointerCapture?.(e.pointerId)
    pointers.set(e.pointerId, local(e))
    tween = null
    velocity.lon = velocity.lat = 0
    moved = 0
    if (pointers.size === 1) {
      drag = { ...local(e), t: performance.now() }
    } else if (pointers.size === 2) {
      const [p, q] = [...pointers.values()]
      pinch = { d: Math.hypot(p.x - q.x, p.y - q.y), dist: view.dist }
      drag = null
    }
    autoRotateHoldUntil = performance.now() + 6000
    wake()
  }

  function onPointerMove(e) {
    const p = local(e)
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, p)
    if (pinch && pointers.size === 2) {
      const [a, b] = [...pointers.values()]
      const d = Math.hypot(a.x - b.x, a.y - b.y)
      view.dist = Math.max(minDist(), Math.min(maxDist(), pinch.dist * (pinch.d / Math.max(1, d))))
      moved += 10
    } else if (drag) {
      const k = 1 / globeRadiusPx()
      const dx = p.x - drag.x
      const dy = p.y - drag.y
      moved += Math.abs(dx) + Math.abs(dy)
      const now = performance.now()
      const dt = Math.max(1, now - drag.t)
      const dLon = (-dx * k) / DEG
      const dLat = (dy * k) / DEG
      view.lon = wrapLon(view.lon + dLon)
      view.lat = Math.max(-80, Math.min(80, view.lat + dLat))
      velocity.lon = (dLon / dt) * 16
      velocity.lat = (dLat / dt) * 16
      drag = { x: p.x, y: p.y, t: now }
      autoRotateHoldUntil = now + 6000
    }
    hoverPoint = e.pointerType === 'touch' ? null : p
    hoverDirty = true
    wake()
  }

  function onPointerUp(e) {
    const wasClick = drag && moved < 5 && pointers.size === 1
    pointers.delete(e.pointerId)
    canvas.releasePointerCapture?.(e.pointerId)
    if (pointers.size < 2) pinch = null
    if (pointers.size === 0) {
      drag = null
      if (reducedMotion) velocity.lon = velocity.lat = 0
    }
    if (wasClick) {
      const target = pick(local(e))
      if (target) options.onPick?.(target)
    }
    wake()
  }

  function onPointerLeave() {
    hoverPoint = null
    hoverDirty = true
    wake()
  }

  function onWheel(e) {
    e.preventDefault()
    const delta = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY
    zoomBy(Math.exp(delta * 0.0012))
  }

  function onDoubleClick(e) {
    const hit = raycast(local(e))
    if (hit) flyTo(hit.lat, hit.lon, view.dist * 0.6)
  }

  canvas.addEventListener('pointerdown', onPointerDown)
  canvas.addEventListener('pointermove', onPointerMove)
  canvas.addEventListener('pointerup', onPointerUp)
  canvas.addEventListener('pointercancel', onPointerUp)
  canvas.addEventListener('pointerleave', onPointerLeave)
  canvas.addEventListener('wheel', onWheel, { passive: false })
  canvas.addEventListener('dblclick', onDoubleClick)

  function onContextLost(e) {
    e.preventDefault()
    contextLost = true
    options.onContextLost?.()
  }
  function onContextRestored() {
    contextLost = false
    idTexture.needsUpdate = true
    heatTexture.needsUpdate = true
    wake()
  }
  canvas.addEventListener('webglcontextlost', onContextLost)
  canvas.addEventListener('webglcontextrestored', onContextRestored)

  // --- Picking --------------------------------------------------------------------------------
  const ray = new Vector3()
  const origin = new Vector3()
  const projected = new Vector3()

  function raycast({ x, y }) {
    const w = size.x / pixelRatio
    const h = size.y / pixelRatio
    ray.set((x / w) * 2 - 1, -(y / h) * 2 + 1, 0.5).unproject(camera).sub(camera.position).normalize()
    origin.copy(camera.position)
    const b = origin.dot(ray)
    const c = origin.lengthSq() - 1
    const disc = b * b - c
    if (disc < 0) return null
    const t = -b - Math.sqrt(disc)
    if (t < 0) return null
    return toLatLon(origin.addScaledVector(ray, t))
  }

  /** Screen position of a unit-sphere point, or null when it is on the far side. */
  function screenOf(v) {
    if (v.dot(camera.position) < 1) return null // beyond the horizon (camera dist * cos > 1)
    projected.copy(v).project(camera)
    return { x: ((projected.x + 1) / 2) * (size.x / pixelRatio), y: ((1 - projected.y) / 2) * (size.y / pixelRatio) }
  }

  function pick(point) {
    // Impacts still on screen win over the country under them.
    let best = null
    let bestD = 14
    for (const s of impactSlots) {
      if (!s || s.role !== 0 || simTime < s.start || simTime > s.start + s.dur + 1.5) continue
      const at = screenOf(s.pos)
      if (!at) continue
      const d = Math.hypot(at.x - point.x, at.y - point.y)
      if (d < bestD) {
        bestD = d
        best = s
      }
    }
    if (best) return { kind: 'event', eventId: best.eventId }
    const hit = raycast(point)
    if (!hit) return null
    const index = indexAt(hit.lat, hit.lon)
    if (index > 0 && index < 255) return { kind: 'country', index, lat: hit.lat, lon: hit.lon }
    return { kind: 'ocean', lat: hit.lat, lon: hit.lon }
  }

  // --- Frame ----------------------------------------------------------------------------------
  function frame(now) {
    if (disposed || contextLost) return
    const dt = lastNow === null ? 0 : Math.min(0.1, (now - lastNow) / 1000)
    lastNow = now
    if (!paused) simTime += dt

    for (const event of options.pull(now)) {
      if (event.repeatOf) pulse(event)
      else launch(event)
    }

    // Camera motion.
    if (tween) {
      const p = Math.min(1, (now - tween.start) / tween.ms)
      const e = easeInOut(p)
      view.lon = wrapLon(tween.from.lon + tween.dLon * e)
      view.lat = tween.from.lat + (tween.to.lat - tween.from.lat) * e
      view.dist = tween.from.dist + (tween.to.dist - tween.from.dist) * e
      if (p >= 1) tween = null
    } else if (!drag && !pinch) {
      if (Math.abs(velocity.lon) > 0.001 || Math.abs(velocity.lat) > 0.001) {
        view.lon = wrapLon(view.lon + velocity.lon * dt * 60)
        view.lat = Math.max(-80, Math.min(80, view.lat + velocity.lat * dt * 60))
        const decay = Math.exp(-dt * 3.2)
        velocity.lon *= decay
        velocity.lat *= decay
      } else if (autoRotate && !reducedMotion && now > autoRotateHoldUntil) {
        view.lon = wrapLon(view.lon + dt * 2.2)
      }
    }
    applyCamera()

    // Heat: land arrivals, then decay (half-life ~5 s).
    for (let i = pendingHeat.length - 1; i >= 0; i--) {
      const h = pendingHeat[i]
      if (simTime >= h.at) {
        heat[h.index] = Math.min(1, heat[h.index] + h.amount)
        pendingHeat.splice(i, 1)
        heatActive = true
      }
    }
    if (heatActive && dt > 0 && !paused) {
      const decay = Math.exp(-dt * 0.14)
      let any = false
      for (let i = 1; i < 255; i++) {
        if (heat[i] > 0.002) {
          heat[i] *= decay
          any = true
        } else heat[i] = 0
        heatBytes[i] = Math.round(Math.min(1, heat[i]) * 255)
      }
      heatTexture.needsUpdate = true
      heatActive = any
    }

    // Uniforms.
    arcUniforms.uTime.value = simTime
    backdropUniforms.uTime.value = now / 1000
    const r = globeRadiusPx() * pixelRatio
    backdropUniforms.uRadius.value = r
    backdropUniforms.uCenter.value.set(size.x / 2, size.y / 2)
    earthUniforms.uSelected.value = selectedIndex
    earthUniforms.uHover.value = hoverIndex
    let hi = -1
    if (highlightId) {
      for (let i = 0; i < ARC_POOL; i++) {
        const s = arcSlots[i]
        if (s && s.eventId === highlightId && simTime <= s.start + s.dur) hi = i
      }
    }
    arcUniforms.uHighlight.value = hi

    renderer.render(scene, camera)

    if (hoverDirty) {
      hoverDirty = false
      const target = hoverPoint && !drag && !pinch ? pick(hoverPoint) : null
      const key = target ? (target.kind === 'event' ? target.eventId : target.kind === 'country' ? `c${target.index}` : 'ocean') : ''
      hoverIndex = target?.kind === 'country' ? target.index : -1
      if (key !== lastHoverKey || target) {
        lastHoverKey = key
        options.onHover?.(target && target.kind !== 'ocean' ? target : null, hoverPoint?.x ?? 0, hoverPoint?.y ?? 0)
      }
    }
    if (tracked) options.onFrame?.({ tracked: screenOf(toVector(tracked.lat, tracked.lon, tmpA)) })
  }

  function idle() {
    if (tween || drag || pinch || hoverDirty) return false
    if (Math.abs(velocity.lon) > 0.001 || Math.abs(velocity.lat) > 0.001) return false
    if (autoRotate && !reducedMotion) return false
    if (heatActive) return false
    if (paused) return true
    return !activeAnimations()
  }

  const loop = options.loop(frame, { fps: 60, idleWhen: idle })
  function wake() {
    if (!disposed) loop.wake()
  }

  applyCamera()

  return {
    resize,
    setPalette,
    wake,
    flyTo,
    resetView,
    zoomBy,
    rotateBy,
    screenOf,
    focusCountry(country) {
      selectedIndex = country ? country.index : -1
      earthUniforms.uFocus.value = country ? 1 : 0
      tracked = country ? { lat: country.lat, lon: country.lon } : null
      if (country) flyTo(country.lat, country.lon, Math.max(1.9, 1.55 + Math.sqrt(country.area) * 4.6))
      wake()
    },
    focusEvent(event) {
      if (!event || event.src.lat === null || event.dst.lat === null) return
      const a = toVector(event.src.lat, event.src.lon, new Vector3())
      const b = toVector(event.dst.lat, event.dst.lon, new Vector3())
      const ang = Math.acos(Math.max(-1, Math.min(1, a.dot(b))))
      const mid = ang < 0.01 ? b : a.add(b).normalize()
      const { lat, lon } = toLatLon(mid)
      flyTo(lat, lon, Math.min(fitDist, 2.6 + ang * 1.7))
    },
    setHighlight(eventId) {
      highlightId = eventId
      wake()
    },
    setMask(mask) {
      maskUniform.value = mask.map(on => (on ? 1 : 0))
      wake()
    },
    setPaused(value) {
      paused = value
      wake()
    },
    setAutoRotate(value) {
      autoRotate = value
      autoRotateHoldUntil = 0
      wake()
    },
    setDither(value) {
      earthUniforms.uDither.value = value ? 1 : 0
      backdropUniforms.uDither.value = value ? 1 : 0
      wake()
    },
    setReducedMotion(value) {
      reducedMotion = value
      arcUniforms.uStatic.value = value ? 1 : 0
      backdropUniforms.uMotion.value = value ? 0 : 1
      wake()
    },
    clear() {
      arcTiming.array.fill(-1e6)
      impactTiming.array.fill(-1e6)
      arcTiming.needsUpdate = impactTiming.needsUpdate = true
      arcSlots.fill(null)
      impactSlots.fill(null)
      pendingHeat.length = 0
      heat.fill(0)
      heatBytes.fill(0)
      heatTexture.needsUpdate = true
      heatActive = false
      wake()
    },
    /** Diagnostics for the validation harness. */
    stats() {
      return {
        simTime,
        arcsLive: arcSlots.filter(s => s && simTime <= s.start + s.dur).length,
        impactsLive: impactSlots.filter(s => s && simTime <= s.start + s.dur).length,
        view: { ...view },
        drawCalls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
        geometries: renderer.info.memory.geometries,
        textures: renderer.info.memory.textures,
        dormant: typeof loop.isDormant === 'function' ? loop.isDormant() : null
      }
    },
    dispose() {
      if (disposed) return
      disposed = true
      loop.dispose()
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerup', onPointerUp)
      canvas.removeEventListener('pointercancel', onPointerUp)
      canvas.removeEventListener('pointerleave', onPointerLeave)
      canvas.removeEventListener('wheel', onWheel)
      canvas.removeEventListener('dblclick', onDoubleClick)
      canvas.removeEventListener('webglcontextlost', onContextLost)
      canvas.removeEventListener('webglcontextrestored', onContextRestored)
      for (const obj of [backdrop, earth, arcs, impacts]) {
        obj.geometry.dispose()
        obj.material.dispose()
      }
      idTexture.dispose()
      heatTexture.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
    }
  }
}
