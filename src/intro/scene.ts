import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js'
import { BODY_LINE, BODY_PATH, HEAD_CENTER, HEAD_RADIUS, LEAF_LINE, LEAF_PATH, LOGO_VIEWBOX } from '../ui/brand'

export type Tier = 'high' | 'medium' | 'low'

/** Duração total da sequência principal (s). */
export const INTRO_DURATION = 5

/** Instante em que a figura 3D dá lugar ao logo vetorial idêntico (s). */
export const HANDOFF_AT = 3.75

const SAMPLES = 64
/** Unidades de mundo por unidade do logo (o logo inteiro tem 640 de largura → 4 de mundo). */
const K = 4 / LOGO_VIEWBOX.w

const C = {
  sky: new THREE.Color('#62C3DB'),
  blue: new THREE.Color('#2C7CC6'),
  lime: new THREE.Color('#B2D84A'),
  green: new THREE.Color('#36AC45'),
  sun: new THREE.Color('#FDB91C'),
  orange: new THREE.Color('#F26A24'),
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x))
const ease = (x: number) => {
  const t = clamp01(x)
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2
}
const easeOut = (x: number) => 1 - (1 - clamp01(x)) ** 3
const phase = (t: number, a: number, b: number) => clamp01((t - a) / (b - a))

export function detectTier(): Tier {
  const nav = navigator as Navigator & { deviceMemory?: number }
  const cores = nav.hardwareConcurrency ?? 4
  const mem = nav.deviceMemory ?? 4
  const small = Math.min(screen.width, screen.height) < 500
  if (cores <= 4 || mem <= 2) return 'low'
  if (small || mem <= 4) return 'medium'
  return 'high'
}

/** Coordenada do logo (x, y em unidades do SVG) → mundo. O logo fica centrado na origem. */
const logoToWorld = (x: number, y: number, z = 0) => new THREE.Vector3((x - LOGO_VIEWBOX.w / 2) * K, -(y - LOGO_VIEWBOX.h / 2) * K, z)

function resample(line: [number, number][], n: number): THREE.Vector3[] {
  const curve = new THREE.CatmullRomCurve3(line.map(([x, y]) => logoToWorld(x, y)), false, 'centripetal')
  return curve.getSpacedPoints(n - 1)
}

/** Trajetos iniciais: três rotas em espiral que se cruzam, como percursos de GPS no espaço. */
function flightPath(j: number, center: THREE.Vector3): THREE.Vector3[] {
  const out: THREE.Vector3[] = []
  for (let i = 0; i < SAMPLES; i++) {
    const u = i / (SAMPLES - 1)
    const a = u * Math.PI * 2.6 + (j * Math.PI * 2) / 3
    const r = 1.15 - 0.55 * u + 0.1 * Math.sin(u * 17 + j)
    const y = (u - 0.5) * 2.0 + 0.16 * Math.sin(a * 2 + j)
    out.push(new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r * 0.8).add(center))
  }
  return out
}

/** Tubo com espessura variável ao longo do comprimento (a "pincelada" da figura). */
function ribbonGeometry(points: THREE.Vector3[], width: (u: number) => number, c0: THREE.Color, c1: THREE.Color, segments: number, radial: number) {
  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal', 0.5)
  const frames = curve.computeFrenetFrames(segments, false)
  const pos: number[] = []
  const nor: number[] = []
  const col: number[] = []
  const idx: number[] = []
  const tmp = new THREE.Color()
  for (let i = 0; i <= segments; i++) {
    const u = i / segments
    const p = curve.getPointAt(u)
    const r = Math.max(0.0005, width(u))
    tmp.copy(c0).lerp(c1, u)
    for (let k = 0; k <= radial; k++) {
      const a = (k / radial) * Math.PI * 2
      const n = frames.normals[i].clone().multiplyScalar(Math.cos(a)).add(frames.binormals[i].clone().multiplyScalar(Math.sin(a)))
      pos.push(p.x + n.x * r, p.y + n.y * r, p.z + n.z * r)
      nor.push(n.x, n.y, n.z)
      col.push(tmp.r, tmp.g, tmp.b)
    }
  }
  for (let i = 0; i < segments; i++) {
    for (let k = 0; k < radial; k++) {
      const a = i * (radial + 1) + k
      const b = a + radial + 1
      idx.push(a, a + 1, b, b, a + 1, b + 1)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  g.setIndex(idx)
  return { geometry: g, curve }
}

/** Peça do logo extrudada a partir do caminho vetorial oficial, com degradê vertical. */
function extrudedPiece(d: string, top: THREE.Color, bottom: THREE.Color, y0: number, y1: number): THREE.BufferGeometry {
  const data = new SVGLoader().parse(`<svg xmlns="http://www.w3.org/2000/svg"><path d="${d}"/></svg>`)
  const shapes = data.paths.flatMap((p) => SVGLoader.createShapes(p))
  const g = new THREE.ExtrudeGeometry(shapes, { depth: 7, bevelEnabled: true, bevelThickness: 2.2, bevelSize: 1.6, bevelSegments: 3, curveSegments: 18 })
  // SVG → mundo: centraliza, inverte Y e aplica a escala.
  g.translate(-LOGO_VIEWBOX.w / 2, -LOGO_VIEWBOX.h / 2, -3.5)
  g.scale(K, -K, K)
  const pos = g.getAttribute('position')
  const col: number[] = []
  const c = new THREE.Color()
  for (let i = 0; i < pos.count; i++) {
    const svgY = LOGO_VIEWBOX.h / 2 - pos.getY(i) / K
    c.copy(top).lerp(bottom, clamp01((svgY - y0) / (y1 - y0)))
    col.push(c.r, c.g, c.b)
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  g.computeVertexNormals()
  return g
}

export interface IntroSceneOptions {
  canvas: HTMLCanvasElement
  tier: Tier
  reducedMotion: boolean
  /** Recebe, a cada redimensionamento, o retângulo (px CSS) onde o logo completo aparece no fim. */
  onLayout?: (rect: { x: number; y: number; w: number; h: number }) => void
  onDowngrade?: (tier: Tier) => void
}

interface Ribbon {
  mesh: THREE.Mesh
  from: THREE.Vector3[]
  to: THREE.Vector3[]
  c0: THREE.Color
  c1: THREE.Color
  width: (u: number) => number
  curve: THREE.CatmullRomCurve3 | null
}

export class IntroScene {
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera: THREE.PerspectiveCamera
  private clock = new THREE.Clock(false)
  private raf = 0
  private disposed = false
  private tier: Tier
  private frameTimes: number[] = []
  private ribbonMat: THREE.MeshPhysicalMaterial
  private ribbons: Ribbon[] = []
  private pieces: THREE.Group
  private pieceMat: THREE.MeshPhysicalMaterial
  private head: THREE.Mesh
  private people: THREE.InstancedMesh
  private peopleData: { ribbon: number; offset: number; speed: number }[] = []
  private segments: number
  private radial: number
  private markCenter: THREE.Vector3
  private finalZ = 7
  private lastKey = ''

  constructor(private opts: IntroSceneOptions) {
    this.tier = opts.tier
    this.renderer = new THREE.WebGLRenderer({ canvas: opts.canvas, antialias: this.tier !== 'low', alpha: true, powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.tier === 'high' ? 2 : this.tier === 'medium' ? 1.5 : 1))
    this.renderer.toneMapping = THREE.NeutralToneMapping
    this.renderer.toneMappingExposure = 0.95
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.setClearColor(0x000000, 0)
    this.camera = new THREE.PerspectiveCamera(32, 1, 0.1, 80)
    this.segments = this.tier === 'low' ? 90 : 160
    this.radial = this.tier === 'low' ? 8 : 14

    const pmrem = new THREE.PMREMGenerator(this.renderer)
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    pmrem.dispose()
    this.scene.add(new THREE.HemisphereLight('#ffffff', '#cfe6f2', 0.6))
    const key = new THREE.DirectionalLight('#ffffff', 1.2)
    key.position.set(-3, 4, 6)
    this.scene.add(key)

    // Centro da figura (em unidades do logo ≈ meio do símbolo).
    this.markCenter = logoToWorld(108, 150)

    this.ribbonMat = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.28, metalness: 0.0, clearcoat: 1, clearcoatRoughness: 0.15, envMapIntensity: 0.45 })
    const bodyTo = resample(BODY_LINE, SAMPLES)
    const leafTo = resample(LEAF_LINE, SAMPLES)
    const hc = logoToWorld(HEAD_CENTER[0], HEAD_CENTER[1])
    const headTo = Array.from({ length: SAMPLES }, (_, i) => {
      const a = (i / (SAMPLES - 1)) * Math.PI * 2 * 1.25 - Math.PI / 2
      return hc.clone().add(new THREE.Vector3(Math.cos(a) * HEAD_RADIUS * K * 0.6, Math.sin(a) * HEAD_RADIUS * K * 0.6, 0))
    })
    // Perfis de espessura das pinceladas do logo (afinam nas pontas).
    const swoosh = (max: number, skew: number) => (u: number) => max * Math.sin(Math.PI * Math.pow(u, skew)) ** 0.85
    const defs: [THREE.Vector3[], THREE.Color, THREE.Color, (u: number) => number][] = [
      [bodyTo, C.sky, C.blue, swoosh(13 * K, 0.85)],
      [leafTo, C.lime, C.green, swoosh(15 * K, 1.25)],
      [headTo, C.sun, C.orange, () => 5 * K],
    ]
    defs.forEach(([to, c0, c1, width], j) => {
      const mesh = new THREE.Mesh(new THREE.BufferGeometry(), this.ribbonMat)
      this.scene.add(mesh)
      this.ribbons.push({ mesh, from: flightPath(j, this.markCenter), to, c0, c1, width, curve: null })
    })

    // Peças finais extrudadas a partir do logo oficial + a cabeça como esfera.
    this.pieceMat = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.3, metalness: 0.0, clearcoat: 0.8, clearcoatRoughness: 0.2, envMapIntensity: 0.4, transparent: true, opacity: 0 })
    this.pieces = new THREE.Group()
    this.pieces.add(new THREE.Mesh(extrudedPiece(BODY_PATH, C.sky, C.blue, 50, 275), this.pieceMat))
    this.pieces.add(new THREE.Mesh(extrudedPiece(LEAF_PATH, C.lime, C.green, 55, 255), this.pieceMat))
    this.scene.add(this.pieces)
    const headGeo = new THREE.SphereGeometry(HEAD_RADIUS * K, 40, 28)
    const hp = headGeo.getAttribute('position')
    const hcol: number[] = []
    const tmp = new THREE.Color()
    for (let i = 0; i < hp.count; i++) {
      tmp.copy(C.sun).lerp(C.orange, clamp01((hp.getX(i) - hp.getY(i)) / (HEAD_RADIUS * K * 2) + 0.5))
      hcol.push(tmp.r, tmp.g, tmp.b)
    }
    headGeo.setAttribute('color', new THREE.Float32BufferAttribute(hcol, 3))
    this.head = new THREE.Mesh(headGeo, new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.1, envMapIntensity: 0.45 }))
    this.head.position.copy(hc)
    this.head.scale.setScalar(0.0001)
    this.scene.add(this.head)

    // Pontos de luz: pessoas percorrendo as rotas.
    const count = this.tier === 'low' ? 12 : 24
    this.people = new THREE.InstancedMesh(new THREE.SphereGeometry(0.035, 12, 10), new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false }), count)
    const palette = [C.sun, C.sky, C.lime, C.orange]
    for (let i = 0; i < count; i++) {
      this.peopleData.push({ ribbon: i % 3, offset: (i * 0.618) % 1, speed: 0.12 + ((i * 7) % 5) * 0.03 })
      this.people.setColorAt(i, palette[i % palette.length])
    }
    this.people.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    this.scene.add(this.people)

    this.resize()
    window.addEventListener('resize', this.resize)
  }

  private resize = () => {
    const c = this.opts.canvas
    const w = c.clientWidth || window.innerWidth
    const h = c.clientHeight || window.innerHeight
    this.renderer.setSize(w, h, false)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    // Distância final que faz o logo ocupar ~78% da largura (e no máximo 26% da altura).
    const tan = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2))
    const logoW = LOGO_VIEWBOX.w * K
    const logoH = LOGO_VIEWBOX.h * K
    const byW = logoW / 0.78 / (2 * tan * this.camera.aspect)
    const byH = logoH / 0.26 / (2 * tan)
    this.finalZ = Math.max(byW, byH, 5.2)
    // Retângulo do logo na tela no enquadramento final (câmera de frente, olhando para a origem acima do centro).
    const yOff = this.finalLook().y
    const visH = 2 * tan * this.finalZ
    const pxPerUnit = h / visH
    const cx = w / 2
    const cy = h / 2 + yOff * pxPerUnit
    this.opts.onLayout?.({ x: cx - (logoW * pxPerUnit) / 2, y: cy - (logoH * pxPerUnit) / 2, w: logoW * pxPerUnit, h: logoH * pxPerUnit })
    this.lastKey = ''
  }

  /** O logo final fica um pouco acima do centro para dar espaço ao texto e ao botão. */
  private finalLook() {
    const tan = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2))
    return new THREE.Vector3(0, -2 * tan * this.finalZ * 0.12, 0)
  }

  private buildRibbons(draw: number, morph: number) {
    const m = ease(morph)
    const key = `${Math.round(draw * 300)}:${Math.round(morph * 300)}`
    if (key === this.lastKey) return
    this.lastKey = key
    this.ribbons.forEach((r, j) => {
      const pts = r.from.map((p, i) => p.clone().lerp(r.to[i], m))
      const uniform = 0.035
      // A cabeça encolhe enquanto a esfera cresce.
      const width = j === 2 ? (u: number) => uniform * (1 - m) + r.width(u) * m * (1 - phase(morph, 0.7, 1)) : (u: number) => uniform * (1 - m) * Math.min(1, u * 12) + r.width(u) * m
      const { geometry, curve } = ribbonGeometry(pts, width, r.c0, r.c1, this.segments, this.radial)
      const visible = Math.floor(this.segments * clamp01(draw)) * this.radial * 6
      geometry.setDrawRange(0, visible)
      r.mesh.geometry.dispose()
      r.mesh.geometry = geometry
      r.curve = curve
    })
  }

  /** Desenha o quadro do instante t (s). Determinístico. */
  renderAt(t: number) {
    const draw = easeOut(phase(t, 0.15, 2.0))
    const morph = phase(t, 1.75, 3.2)
    const reveal = ease(phase(t, 2.9, 3.3))
    const spin = (1 - ease(morph)) * (t * 0.9 - 1.4)

    this.buildRibbons(draw, morph)
    // As rotas giram em torno do centro da figura até se alinharem a ela.
    for (const r of this.ribbons) {
      r.mesh.position.copy(this.markCenter)
      r.mesh.rotation.set(0, spin, 0)
      r.mesh.position.sub(this.markCenter.clone().applyEuler(r.mesh.rotation))
    }
    // As pinceladas só somem depois que as peças oficiais estão inteiras (sem fase "fantasma").
    this.ribbons.forEach((r) => (r.mesh.visible = reveal < 1))

    // Peças oficiais entram com um leve giro, assumindo o lugar das pinceladas.
    this.pieceMat.opacity = reveal
    if (this.pieceMat.transparent !== reveal < 1) {
      this.pieceMat.transparent = reveal < 1
      this.pieceMat.needsUpdate = true
    }
    this.pieces.visible = reveal > 0
    this.pieces.rotation.set(0, (1 - reveal) * 0.35, 0)
    this.head.scale.setScalar(Math.max(0.0001, easeOut(phase(t, 2.6, 3.3)) * (1 + 0.08 * Math.sin(phase(t, 2.6, 3.6) * Math.PI))))

    // Pessoas: viajam pelas rotas e se recolhem quando elas viram a figura.
    const dummy = new THREE.Object3D()
    const fade = 1 - ease(phase(t, 1.9, 2.6))
    this.peopleData.forEach((p, i) => {
      const r = this.ribbons[p.ribbon]
      const u = Math.min(draw, (p.offset + t * p.speed) % 1)
      const lit = phase(draw, u, u + 0.05)
      if (r.curve) dummy.position.copy(r.curve.getPointAt(clamp01(u))).applyEuler(r.mesh.rotation).add(r.mesh.position)
      dummy.scale.setScalar(Math.max(0.0001, lit * fade * (1 + 0.3 * Math.sin(t * 6 + i))))
      dummy.updateMatrix()
      this.people.setMatrixAt(i, dummy.matrix)
    })
    this.people.instanceMatrix.needsUpdate = true

    // Câmera: órbita aproximando da figura e depois enquadra o logo inteiro, de frente.
    const settle = ease(phase(t, 1.9, 3.6))
    const orbitA = -0.5 + t * 0.35
    const near = this.markCenter.clone().add(new THREE.Vector3(Math.sin(orbitA) * 6.2, 0.5 + 0.35 * Math.cos(t * 0.8), Math.cos(orbitA) * 6.2 + 1.4))
    const far = new THREE.Vector3(0, this.finalLook().y, this.finalZ)
    this.camera.position.copy(near).lerp(far, settle)
    this.camera.lookAt(this.markCenter.clone().lerp(this.finalLook(), settle))

    this.renderer.render(this.scene, this.camera)
  }

  play() {
    if (this.opts.reducedMotion) {
      this.renderAt(INTRO_DURATION)
      return
    }
    this.clock.start()
    let last = performance.now()
    const loop = () => {
      if (this.disposed) return
      const now = performance.now()
      this.monitor(now - last)
      last = now
      const t = this.clock.getElapsedTime()
      this.renderAt(Math.min(t, INTRO_DURATION))
      // Depois da passagem para o logo vetorial, não há mais nada para desenhar.
      if (t < INTRO_DURATION) this.raf = requestAnimationFrame(loop)
    }
    this.raf = requestAnimationFrame(loop)
  }

  /** Reduz a qualidade automaticamente se os quadros estiverem lentos. */
  private monitor(dt: number) {
    if (this.frameTimes.length > 90) return
    this.frameTimes.push(dt)
    if (this.frameTimes.length !== 40) return
    const avg = this.frameTimes.slice(10).reduce((s, x) => s + x, 0) / 30
    if (avg > 34 && this.tier !== 'low') {
      this.tier = 'low'
      this.segments = 80
      this.radial = 8
      this.renderer.setPixelRatio(1)
      this.resize()
      this.opts.onDowngrade?.(this.tier)
    }
  }

  dispose() {
    this.disposed = true
    cancelAnimationFrame(this.raf)
    window.removeEventListener('resize', this.resize)
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh
      m.geometry?.dispose?.()
      const mat = m.material as THREE.Material | THREE.Material[] | undefined
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose())
      else mat?.dispose?.()
    })
    this.scene.environment?.dispose()
    this.renderer.dispose()
  }
}

export function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch {
    return false
  }
}
