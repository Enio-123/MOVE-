import type { Sport } from './types'

/**
 * Detector de passos pelo acelerômetro do celular (DeviceMotion).
 * Usa a magnitude da aceleração com gravidade, remove a média lenta (gravidade e postura),
 * suaviza e conta picos acima de um limiar adaptativo, com intervalo mínimo entre passos.
 * Funciona com o aparelho no bolso, na mão ou na cintura enquanto o app está aberto.
 */
export class StepDetector {
  private slow = 9.81
  private fast = 0
  private prev = 0
  private rising = false
  private peak = 0
  private lastStep = -Infinity
  private amp = 1.2
  count = 0

  /** Intervalos humanos de passada: 0,25 s (corrida rápida) a 2 s (caminhada muito lenta). */
  static MIN_INTERVAL = 250
  static MAX_INTERVAL = 2000

  /** Recebe uma leitura (ms, m/s²). Devolve true quando um passo é contado. */
  push(t: number, ax: number, ay: number, az: number): boolean {
    const mag = Math.sqrt(ax * ax + ay * ay + az * az)
    if (!Number.isFinite(mag)) return false
    this.slow += (mag - this.slow) * 0.02
    const hp = mag - this.slow
    this.fast += (hp - this.fast) * 0.35
    const v = this.fast
    let stepped = false
    if (v > this.prev) {
      this.rising = true
      this.peak = v
    } else if (this.rising && v < this.prev) {
      // Topo de um pico: confere altura e ritmo.
      this.rising = false
      const threshold = Math.max(0.55, this.amp * 0.45)
      const dt = t - this.lastStep
      if (this.peak > threshold && dt >= StepDetector.MIN_INTERVAL) {
        this.count++
        this.lastStep = t
        stepped = true
      }
      // Limiar acompanha a intensidade recente do movimento.
      if (this.peak > 0.3) this.amp += (this.peak - this.amp) * 0.15
    }
    this.prev = v
    return stepped
  }
}

/** Comprimento médio de passada (m) para estimar passos a partir da distância. */
const STRIDE: Partial<Record<Sport, number>> = { walk: 0.72, hike: 0.68, run: 1.05 }

/** Estimativa de passos pela distância medida. Só para modalidades a pé. */
export function estimateSteps(distanceM: number, sport: Sport): number | null {
  const s = STRIDE[sport]
  if (!s || distanceM <= 0) return null
  return Math.round(distanceM / s)
}

export type StepSource = 'sensor' | 'health' | 'estimate'

export interface DaySteps {
  value: number
  source: StepSource
}

/**
 * Passos do dia, sem somar fontes que medem a mesma coisa:
 * dados do Apple Saúde (que já consolidam celular e relógio) têm prioridade;
 * senão, passos do sensor deste celular (registro diário, que já inclui os passos das gravações);
 * senão, estimativa pela distância das atividades a pé.
 */
export function stepsForDay(p: { health?: number; sensor?: number; estimated?: number }): DaySteps | null {
  if (p.health && p.health > 0) return { value: p.health, source: 'health' }
  if (p.sensor && p.sensor > 0) return { value: p.sensor, source: 'sensor' }
  if (p.estimated && p.estimated > 0) return { value: p.estimated, source: 'estimate' }
  return null
}
