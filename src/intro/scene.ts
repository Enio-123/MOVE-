import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'

export type Tier = 'high' | 'medium' | 'low'

/** Duração total da sequência principal (s). */
export const INTRO_DURATION = 5

const ROUTE_SAMPLES = 72
const MARK_SCALE = 1.75
const BLUE = new THREE.Color('#2f6bff')
const CYAN = new THREE.Color('#19c6f0')
const AQUA = new THREE.Color('#19d3b2')
const ORANGE = new THREE.Color('#ff7a1f')

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

/** Curva principal: espiral ascendente com ondulação de passada, a "evolução em movimento". */
function sculptureCurve(): THREE.CatmullRomCurve3 {
  const pts: THREE.Vector3[] = []
  const turns = 2.25
  const n = 60
  for (let i = 0; i <= n; i++) {
    const u = i / n
    const a = u * turns * Math.PI * 2
    const r = 0.68 + 0.34 * Math.sin(u * Math.PI) + 0.08 * Math.sin(a * 2)
    pts.push(new THREE.Vector3(Math.cos(a) * r, -1.55 + u * 3.1 + 0.14 * Math.sin(a * 3), Math.sin(a) * r * 0.9))
  }
  return new THREE.CatmullRomCurve3(pts, false, 'centripetal')
}

/** Rota luminosa: acompanha a escultura por fora, como um trajeto de GPS sobre ela. */
function routePoints(base: THREE.CatmullRomCurve3): THREE.Vector3[] {
  const out: THREE.Vector3[] = []
  for (let i = 0; i < ROUTE_SAMPLES; i++) {
    const u = 0.04 + (i / (ROUTE_SAMPLES - 1)) * 0.92
    const p = base.getPointAt(u)
    const radial = new THREE.Vector3(p.x, 0, p.z).normalize()
    const wobble = 0.05 * Math.sin(u * 40)
    out.push(p.clone().addScaledVector(radial, 0.2 + wobble).add(new THREE.Vector3(0, 0.08 * Math.sin(u * 23), 0)))
  }
  return out
}

/** Pontos ao longo do símbolo da marca (o "M" da rota), no plano de frente para a câmera. */
function markPoints(path: string, scale: number, center: THREE.Vector3): THREE.Vector3[] {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('width', '0')
  svg.setAttribute('height', '0')
  svg.style.position = 'absolute'
  const el = document.createElementNS('http://www.w3.org/2000/svg', 'path')
  el.setAttribute('d', path)
  svg.appendChild(el)
  document.body.appendChild(svg)
  const len = el.getTotalLength()
  const out: THREE.Vector3[] = []
  for (let i = 0; i < ROUTE_SAMPLES; i++) {
    const p = el.getPointAtLength((i / (ROUTE_SAMPLES - 1)) * len)
    out.push(new THREE.Vector3(((p.x - 24) / 48) * scale + center.x, (-(p.y - 25.5) / 48) * scale + center.y, center.z))
  }
  svg.remove()
  return out
}

export interface IntroSceneOptions {
  canvas: HTMLCanvasElement
  tier: Tier
  reducedMotion: boolean
  markPath: string
  onDowngrade?: (tier: Tier) => void
}

export class IntroScene {
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera: THREE.PerspectiveCamera
  private composer: EffectComposer | null = null
  private bloom: UnrealBloomPass | null = null
  private clock = new THREE.Clock(false)
  private raf = 0
  private disposed = false
  private tier: Tier
  private frameTimes: number[] = []

  private sculpture: THREE.Group
  private sculptureMat: THREE.MeshPhysicalMaterial
  private routeMesh: THREE.Mesh
  private routeGlow: THREE.Mesh
  private routeMat: THREE.MeshBasicMaterial
  private glowMat: THREE.MeshBasicMaterial
  private routeFrom: THREE.Vector3[]
  private routeTo: THREE.Vector3[]
  private people: THREE.InstancedMesh
  private peopleT: number[]
  private markExtras: THREE.Group
  private keyLight: THREE.SpotLight
  private rimLight: THREE.PointLight
  private warmLight: THREE.PointLight
  private dust: THREE.Points | null = null
  private tubularSegments: number
  private markCenter = new THREE.Vector3(0, 0.7, 2.2)
  private portrait = false

  constructor(private opts: IntroSceneOptions) {
    this.tier = opts.tier
    const { canvas } = opts
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: this.tier !== 'low', alpha: false, powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.tier === 'high' ? 2 : this.tier === 'medium' ? 1.5 : 1))
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.05
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.setClearColor('#03060c')

    this.scene.fog = new THREE.FogExp2('#03060c', 0.075)
    this.camera = new THREE.PerspectiveCamera(36, 1, 0.1, 60)
    this.tubularSegments = this.tier === 'low' ? 140 : 260

    if (this.tier !== 'low') {
      const pmrem = new THREE.PMREMGenerator(this.renderer)
      this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
      pmrem.dispose()
    }

    // Luzes: chave azul, contraluz ciano e um acento quente laranja que percorre a cena.
    this.scene.add(new THREE.AmbientLight('#1a2a4a', 0.35))
    this.keyLight = new THREE.SpotLight(BLUE, 0, 30, Math.PI / 5, 0.6, 1.2)
    this.keyLight.position.set(-5, 4, 6)
    this.scene.add(this.keyLight, this.keyLight.target)
    this.rimLight = new THREE.PointLight(CYAN, 0, 20, 1.4)
    this.rimLight.position.set(3, 2, -4)
    this.scene.add(this.rimLight)
    this.warmLight = new THREE.PointLight(ORANGE, 0, 9, 1.6)
    this.scene.add(this.warmLight)

    // Escultura: três fitas entrelaçadas em espiral ascendente.
    const curve = sculptureCurve()
    this.sculptureMat = new THREE.MeshPhysicalMaterial({
      color: '#0c1626',
      metalness: 0.82,
      roughness: 0.26,
      clearcoat: 1,
      clearcoatRoughness: 0.18,
      envMapIntensity: 0.55,
      emissive: new THREE.Color('#0a2a66'),
      emissiveIntensity: 0,
      transparent: true,
      opacity: 0,
    })
    this.sculpture = new THREE.Group()
    const radial = this.tier === 'low' ? 10 : 18
    this.sculpture.add(new THREE.Mesh(new THREE.TubeGeometry(curve, this.tubularSegments, 0.13, radial, false), this.sculptureMat))
    for (const k of [1, -1]) {
      const strand = new THREE.CatmullRomCurve3(
        curve.getSpacedPoints(90).map((p, i) => {
          const a = (i / 90) * Math.PI * 9 * k
          return p.clone().add(new THREE.Vector3(Math.cos(a) * 0.27, Math.sin(a) * 0.16, Math.sin(a) * 0.27))
        }),
      )
      this.sculpture.add(new THREE.Mesh(new THREE.TubeGeometry(strand, this.tubularSegments, 0.034, 8, false), this.sculptureMat))
    }
    this.sculpture.rotation.set(0.12, -0.6, -0.08)
    this.scene.add(this.sculpture)

    // Rota de GPS (tubo fino emissivo) + halo, desenhada progressivamente.
    this.routeFrom = routePoints(curve)
    this.routeTo = markPoints(opts.markPath, MARK_SCALE, this.markCenter)
    this.routeMat = new THREE.MeshBasicMaterial({ color: CYAN, toneMapped: false })
    this.glowMat = new THREE.MeshBasicMaterial({ color: BLUE, transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })
    this.routeMesh = new THREE.Mesh(new THREE.BufferGeometry(), this.routeMat)
    this.routeGlow = new THREE.Mesh(new THREE.BufferGeometry(), this.glowMat)
    this.scene.add(this.routeMesh, this.routeGlow)
    this.updateRoute(0, 0)

    // Pontos de luz: pessoas conectadas pelo movimento.
    const count = this.tier === 'low' ? 14 : 26
    this.people = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.055, 12, 10),
      new THREE.MeshBasicMaterial({ color: AQUA, toneMapped: false }),
      count,
    )
    this.peopleT = Array.from({ length: count }, (_, i) => (i + 0.5) / count + (Math.sin(i * 12.9898) * 0.5) / count)
    this.people.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    this.scene.add(this.people)

    // Elementos finais da marca: ponto de partida, chegada e o "+".
    this.markExtras = new THREE.Group()
    const s = MARK_SCALE / 48
    const toWorld = (x: number, y: number) => new THREE.Vector3((x - 24) * s, -(y - 25.5) * s, 0).add(this.markCenter)
    const start = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.026, 10, 32), new THREE.MeshBasicMaterial({ color: BLUE, toneMapped: false }))
    start.position.copy(toWorld(9, 37))
    const end = new THREE.Mesh(new THREE.SphereGeometry(0.085, 20, 16), new THREE.MeshBasicMaterial({ color: AQUA, toneMapped: false }))
    end.position.copy(toWorld(39, 37))
    const plusMat = new THREE.MeshBasicMaterial({ color: ORANGE, toneMapped: false })
    const bar = new THREE.BoxGeometry(0.28, 0.085, 0.085)
    const h = new THREE.Mesh(bar, plusMat)
    const v = new THREE.Mesh(bar, plusMat)
    v.rotation.z = Math.PI / 2
    const plus = new THREE.Group()
    plus.add(h, v)
    plus.position.copy(toWorld(42, 8.5))
    plus.name = 'plus'
    this.markExtras.add(start, end, plus)
    this.markExtras.children.forEach((c) => c.scale.setScalar(0.0001))
    this.scene.add(this.markExtras)

    // Partículas de profundidade (poucas, e nenhuma no modo leve).
    if (this.tier !== 'low') {
      const n = this.tier === 'high' ? 420 : 220
      const pos = new Float32Array(n * 3)
      for (let i = 0; i < n; i++) {
        pos[i * 3] = (Math.random() - 0.5) * 18
        pos[i * 3 + 1] = (Math.random() - 0.5) * 10
        pos[i * 3 + 2] = -Math.random() * 14 + 2
      }
      const g = new THREE.BufferGeometry()
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
      this.dust = new THREE.Points(g, new THREE.PointsMaterial({ color: '#4d7bd9', size: 0.025, transparent: true, opacity: 0.0, depthWrite: false }))
      this.scene.add(this.dust)
    }

    if (this.tier === 'high') this.setupBloom()
    this.resize()
    window.addEventListener('resize', this.resize)
  }

  private setupBloom() {
    const size = this.renderer.getSize(new THREE.Vector2())
    this.composer = new EffectComposer(this.renderer)
    this.composer.addPass(new RenderPass(this.scene, this.camera))
    this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x / 2, size.y / 2), 0.9, 0.55, 0.62)
    this.composer.addPass(this.bloom)
    this.composer.addPass(new OutputPass())
  }

  private resize = () => {
    const c = this.opts.canvas
    const w = c.clientWidth || window.innerWidth
    const h = c.clientHeight || window.innerHeight
    this.renderer.setSize(w, h, false)
    this.composer?.setSize(w, h)
    this.camera.aspect = w / h
    // Em telas estreitas, recua a câmera para manter a escultura inteira.
    this.portrait = w < h
    this.camera.fov = this.portrait ? 48 : 34
    this.camera.updateProjectionMatrix()
  }

  /** Reconstrói o tubo da rota: progresso do desenho (0..1) e transformação no símbolo (0..1). */
  private updateRoute(draw: number, morph: number) {
    const m = ease(morph)
    const pts = this.routeFrom.map((p, i) => p.clone().lerp(this.routeTo[i], m))
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal', 0.5)
    const seg = this.tier === 'low' ? 120 : 220
    const radius = 0.026 + m * 0.02
    const old = this.routeMesh.geometry
    const oldGlow = this.routeGlow.geometry
    this.routeMesh.geometry = new THREE.TubeGeometry(curve, seg, radius, 8, false)
    this.routeGlow.geometry = new THREE.TubeGeometry(curve, seg, radius * 2.3, 8, false)
    old.dispose()
    oldGlow.dispose()
    const idx = this.routeMesh.geometry.index!.count
    const visible = Math.floor((idx / 6) * clamp01(draw)) * 6
    this.routeMesh.geometry.setDrawRange(0, visible)
    this.routeGlow.geometry.setDrawRange(0, visible)
    return curve
  }

  private lastDraw = -1
  private lastMorph = -1
  private routeCurve: THREE.CatmullRomCurve3 | null = null

  /** Desenha o quadro do instante t (s). Determinístico: o mesmo t produz a mesma imagem. */
  renderAt(t: number) {
    const appear = easeOut(phase(t, 0.0, 1.4))
    const draw = phase(t, 0.7, 2.9)
    const morph = phase(t, 2.8, 4.0)
    const settle = easeOut(phase(t, 3.8, 4.7))

    // Escultura surge, gira e recua quando a rota vira o símbolo.
    this.sculptureMat.opacity = appear * (1 - 0.82 * ease(morph))
    this.sculptureMat.emissiveIntensity = 0.25 * appear * (1 - ease(morph))
    this.sculpture.scale.setScalar(0.86 + 0.14 * appear)
    this.sculpture.rotation.y = -0.6 + t * 0.32
    this.sculpture.position.set(0, -0.08 * (1 - appear) + 0.04 * Math.sin(t * 1.3), -ease(morph) * 2.2)

    this.keyLight.intensity = 90 * appear
    this.rimLight.intensity = 26 * appear
    const a = t * 1.4
    this.warmLight.position.set(Math.cos(a) * 2.6, -0.8 + Math.sin(a * 0.7) * 1.2, Math.sin(a) * 2.6)
    this.warmLight.intensity = 9 * appear * (1 - 0.6 * ease(morph))
    if (this.dust) (this.dust.material as THREE.PointsMaterial).opacity = 0.55 * appear

    // Rota: só reconstrói a geometria quando algo mudou.
    const d = Math.round(draw * 400) / 400
    const mo = Math.round(morph * 400) / 400
    if (d !== this.lastDraw || mo !== this.lastMorph) {
      this.routeCurve = this.updateRoute(draw, morph)
      this.lastDraw = d
      this.lastMorph = mo
    }
    // Enquanto a escultura gira, a rota acompanha a mesma rotação até começar a transformação.
    const rot = 1 - ease(morph)
    this.routeMesh.rotation.copy(this.sculpture.rotation)
    this.routeMesh.rotation.x *= rot
    this.routeMesh.rotation.y *= rot
    this.routeMesh.rotation.z *= rot
    this.routeMesh.position.copy(this.sculpture.position).multiplyScalar(rot)
    this.routeMesh.scale.copy(this.sculpture.scale).lerp(new THREE.Vector3(1, 1, 1), ease(morph))
    this.routeGlow.rotation.copy(this.routeMesh.rotation)
    this.routeGlow.position.copy(this.routeMesh.position)
    this.routeGlow.scale.copy(this.routeMesh.scale)
    this.routeMat.color.copy(CYAN).lerp(new THREE.Color('#bfefff'), 0.25 * Math.sin(t * 3) ** 2)

    // Pessoas: acendem quando a rota passa por elas e se apagam no símbolo.
    const dummy = new THREE.Object3D()
    const curve = this.routeCurve!
    this.peopleT.forEach((u, i) => {
      const lit = phase(draw, u - 0.02, u + 0.06)
      const fade = 1 - ease(phase(t, 2.9, 3.6))
      const pulse = 1 + 0.25 * Math.sin(t * 5 + i)
      const p = curve.getPointAt(Math.min(1, Math.max(0, u)))
      dummy.position.copy(p).multiply(this.routeMesh.scale).applyEuler(this.routeMesh.rotation).add(this.routeMesh.position)
      dummy.scale.setScalar(Math.max(0.0001, easeOut(lit) * fade * pulse))
      dummy.updateMatrix()
      this.people.setMatrixAt(i, dummy.matrix)
    })
    this.people.instanceMatrix.needsUpdate = true

    // Marca: partida, chegada e o "+" entram em sequência.
    const [start, end, plus] = this.markExtras.children
    start.scale.setScalar(Math.max(0.0001, easeOut(phase(t, 3.7, 4.1))))
    end.scale.setScalar(Math.max(0.0001, easeOut(phase(t, 3.85, 4.25))))
    plus.scale.setScalar(Math.max(0.0001, easeOut(phase(t, 4.0, 4.5))))
    plus.rotation.z = (1 - easeOut(phase(t, 4.0, 4.6))) * Math.PI * 0.5

    // Câmera: aproximação lenta com leve órbita; enquadra o símbolo no final.
    const orbit = (1 - settle) * 0.35
    const k = this.portrait ? 1.22 : 1
    const camFrom = new THREE.Vector3(Math.sin(t * 0.35) * orbit * 3, 0.9 - 0.4 * appear, (10.5 - 2.2 * appear) * k)
    const camTo = new THREE.Vector3(0, 0.45, this.portrait ? 9.8 : 10.6)
    this.camera.position.copy(camFrom).lerp(camTo, ease(morph))
    const look = new THREE.Vector3(0, 0, 0).lerp(this.markCenter.clone().add(new THREE.Vector3(0, -0.62, 0)), ease(morph))
    this.camera.lookAt(look)
    this.keyLight.target.position.copy(look)

    if (this.bloom) this.bloom.strength = 0.75 + 0.35 * ease(morph)
    if (this.composer) this.composer.render()
    else this.renderer.render(this.scene, this.camera)
  }

  /** Inicia a animação. Com movimento reduzido, desenha apenas o quadro final. */
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
      // Depois da sequência, mantém um movimento sutil e contínuo (sem repetir a animação).
      const t = this.clock.getElapsedTime()
      this.renderAt(t < INTRO_DURATION ? t : INTRO_DURATION + Math.sin((t - INTRO_DURATION) * 0.6) * 0.02)
      this.raf = requestAnimationFrame(loop)
    }
    this.raf = requestAnimationFrame(loop)
  }

  /** Reduz a qualidade automaticamente se os quadros estiverem lentos. */
  private monitor(dt: number) {
    if (this.frameTimes.length > 90) return
    this.frameTimes.push(dt)
    if (this.frameTimes.length !== 45) return
    const avg = this.frameTimes.slice(10).reduce((s, x) => s + x, 0) / 35
    if (avg > 34 && this.tier !== 'low') {
      this.tier = this.tier === 'high' ? 'medium' : 'low'
      if (this.composer) {
        this.composer.dispose()
        this.composer = null
        this.bloom = null
      }
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
    this.composer?.dispose()
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
