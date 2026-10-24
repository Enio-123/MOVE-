// Modelos de dados da Move+. Todos os horários são epoch em milissegundos (UTC);
// datas "de calendário" usam a string local YYYY-MM-DD do dispositivo.

export type Sport = 'walk' | 'run' | 'hike' | 'wheelchair' | 'ride'

/** Origem de um dado. Nunca misture fontes sem identificá-las na interface. */
export type DataSource = 'gps' | 'manual' | 'import' | 'health' | 'demo'

export type Privacy = 'private' | 'followers' | 'public'

export type ActivityStatus =
  /** Finalizada normalmente pelo usuário. */
  | 'completed'
  /** Recuperada após fechamento inesperado; o usuário escolheu salvar. */
  | 'recovered'

export interface TrackPoint {
  /** Horário da leitura (epoch ms). */
  t: number
  lat: number
  lng: number
  /** Precisão horizontal em metros informada pelo navegador. */
  acc: number
  /** Altitude em metros, quando disponível. */
  alt?: number | null
  altAcc?: number | null
  /** Índice do trecho: muda a cada pausa/retomada. A distância nunca liga trechos diferentes. */
  seg: number
  /** Frequência cardíaca no instante, quando houver sensor conectado. */
  hr?: number
}

export interface Split {
  /** Número do quilômetro (1, 2, ...). O último pode ser parcial. */
  km: number
  distanceM: number
  durationS: number
  /** segundos por km */
  paceSPerKm: number
  partial: boolean
}

export interface Activity {
  id: string
  sport: Sport
  source: DataSource
  status: ActivityStatus
  title: string
  description: string
  privacy: Privacy
  startedAt: number
  endedAt: number
  /** Data local (YYYY-MM-DD) em que a atividade começou: é a data que conta na sequência. */
  localDate: string
  /** Deslocamento do fuso (minutos, como Date#getTimezoneOffset) no início. */
  tzOffset: number
  /** Tempo decorrido sem pausas manuais (s). */
  elapsedS: number
  /** Tempo efetivamente em movimento (s). */
  movingS: number
  distanceM: number
  splits: Split[]
  /** Ganho de elevação estimado a partir do GPS (m), quando houver altitude confiável. */
  elevationGainM: number | null
  avgHr: number | null
  maxHr: number | null
  /** Fração de leituras descartadas por baixa precisão (0..1). */
  weakSignalRatio: number
  /** Houve perda de sinal durante a gravação. */
  signalGaps: number
  photoIds: string[]
  /** Identificador externo (ex.: id do arquivo importado) para evitar importações repetidas. */
  externalId: string | null
  /** Se esta atividade representa o mesmo exercício que outra, aponta para a principal. */
  duplicateOf: string | null
  hasTrack: boolean
  createdAt: number
  updatedAt: number
}

export interface StoredTrack {
  activityId: string
  points: TrackPoint[]
}

export type StreakRule =
  | { kind: 'activity'; minMinutes: number }
  | { kind: 'goal' }

export type FitnessLevel = 'beginner' | 'intermediate' | 'advanced'

export interface Settings {
  theme: 'dark' | 'light' | 'system'
  introSeen: boolean
  onboarded: boolean
  displayName: string
  bio: string
  avatarId: string | null
  favoriteSports: Sport[]
  fitness: FitnessLevel
  /** Histórico de mudanças de condicionamento: missões passadas usam o nível vigente na época. */
  fitnessLog: { from: string; level: FitnessLevel }[]
  /** Meta diária em minutos ativos. */
  dailyGoalMin: number
  streakRule: StreakRule
  defaultPrivacy: Privacy
  /** Peso opcional (kg), usado apenas para estimar calorias. */
  weightKg: number | null
  units: 'metric'
  textScale: 1 | 1.15 | 1.3
  reduceMotion: 'system' | 'on' | 'off'
  highContrast: boolean
  reminders: {
    enabled: boolean
    time: string
    categories: Record<NotificationKind, boolean>
    system: boolean
  }
  /** Mostra conteúdo demonstrativo identificado na Comunidade. */
  showDemoCommunity: boolean
  createdAt: number
}

export type NotificationKind = 'goal' | 'mission' | 'xp' | 'achievement' | 'event' | 'sync' | 'reminder'

export interface AppNotification {
  id: string
  /** Chave idempotente: a mesma notificação nunca é criada duas vezes. */
  key: string
  kind: NotificationKind
  title: string
  body: string
  at: number
  read: boolean
  href?: string
}

export interface LatLng {
  lat: number
  lng: number
}

export interface SavedRoute {
  id: string
  name: string
  sport: Sport
  /** Rota planejada (não percorrida). */
  points: LatLng[]
  distanceM: number
  followsStreets: boolean
  notes: string
  createdAt: number
}

export interface Place {
  id: string
  name: string
  kind: 'meeting' | 'favorite'
  lat: number
  lng: number
  notes: string
  createdAt: number
}

export type Difficulty = 'easy' | 'moderate' | 'hard'

export interface CommunityEvent {
  id: string
  title: string
  sport: Sport
  /** Início em epoch ms. */
  startsAt: number
  durationMin: number
  meetingPoint: { name: string; lat: number | null; lng: number | null }
  routeId: string | null
  distanceKm: number | null
  difficulty: Difficulty
  maxParticipants: number | null
  accessibility: string
  description: string
  groupId: string | null
  /** 'mine' = criado neste aparelho; 'link' = recebido por link; 'demo' = demonstração. */
  origin: 'mine' | 'link' | 'demo'
  going: boolean
  /** Confirmação de presença feita depois do encontro (gera XP de participação). */
  attended: boolean
  createdAt: number
}

export interface Group {
  id: string
  name: string
  description: string
  region: string
  sport: Sport
  level: FitnessLevel | 'all'
  schedule: string
  rules: string
  origin: 'mine' | 'demo'
  joined: boolean
  createdAt: number
}

export interface PlannedSession {
  id: string
  /** YYYY-MM-DD local */
  date: string
  time: string
  sport: Sport
  targetMin: number
  note: string
  createdAt: number
}

export interface Post {
  id: string
  authorId: string
  activityId: string | null
  text: string
  at: number
  likes: string[]
  comments: { id: string; authorId: string; text: string; at: number }[]
  origin: 'mine' | 'demo'
}

export interface DemoMember {
  id: string
  name: string
  bio: string
  sports: Sport[]
  level: number
}

export interface CommunityState {
  following: string[]
  blocked: string[]
  reports: { memberId: string; reason: string; at: number }[]
}

export interface HeartRateSample {
  t: number
  bpm: number
}
