import type { CommunityEvent, DemoMember, Group, Post } from '../domain/types'

// Conteúdo DEMONSTRATIVO da Comunidade. Nunca é salvo, nunca conta para XP ou estatísticas
// e é sempre exibido com o selo "Demonstração". Serve para apresentar a experiência
// enquanto não há servidor configurado para uma comunidade real.

export const DEMO_MEMBERS: DemoMember[] = [
  { id: 'demo-ana', name: 'Ana R.', bio: 'Caminhadas no fim da tarde. Começando a correr.', sports: ['walk', 'run'], level: 6 },
  { id: 'demo-bruno', name: 'Bruno T.', bio: 'Atleta de basquete em cadeira de rodas. Treinos de rua aos sábados.', sports: ['wheelchair'], level: 9 },
  { id: 'demo-carla', name: 'Carla M.', bio: 'Trilhas e caminhadas longas.', sports: ['hike', 'walk'], level: 7 },
  { id: 'demo-diego', name: 'Diego S.', bio: 'Corrida de 5 km, aprendendo a manter o ritmo.', sports: ['run'], level: 4 },
  { id: 'demo-elisa', name: 'Elisa P.', bio: 'Organizo caminhadas leves para iniciantes.', sports: ['walk'], level: 11 },
]

export function demoGroups(now: number): Group[] {
  return [
    { id: 'demo-g1', name: 'Caminhada leve para iniciantes', description: 'Ritmo de conversa, ninguém fica para trás. Ideal para quem está começando.', region: 'Região central', sport: 'walk', level: 'beginner', schedule: 'Terças e quintas, 18h', rules: 'Respeite o ritmo do grupo. Leve água. Avise se precisar parar.', origin: 'demo', joined: false, createdAt: now },
    { id: 'demo-g2', name: 'Rodas e passos', description: 'Grupo misto de cadeirantes e caminhantes em percursos com calçada acessível.', region: 'Orla', sport: 'wheelchair', level: 'all', schedule: 'Sábados, 7h', rules: 'Percursos sempre avaliados antes quanto à acessibilidade.', origin: 'demo', joined: false, createdAt: now },
    { id: 'demo-g3', name: 'Primeiros 5 km', description: 'Plano gradual de 8 semanas de caminhada e corrida.', region: 'Zona sul', sport: 'run', level: 'intermediate', schedule: 'Segundas, quartas e sextas, 6h', rules: 'Aquecimento juntos antes de cada treino.', origin: 'demo', joined: false, createdAt: now },
  ]
}

export function demoEvents(now: number): CommunityEvent[] {
  const day = 86400000
  const at = (days: number, h: number) => {
    const d = new Date(now + days * day)
    d.setHours(h, 0, 0, 0)
    return d.getTime()
  }
  return [
    { id: 'demo-e1', title: 'Caminhada de boas-vindas', sport: 'walk', startsAt: at(2, 18), durationMin: 50, meetingPoint: { name: 'Ponto de encontro do grupo', lat: null, lng: null }, routeId: null, distanceKm: 3, difficulty: 'easy', maxParticipants: 20, accessibility: 'Percurso plano, com bancos para pausa.', description: 'Encontro para conhecer o grupo, no ritmo de conversa.', groupId: 'demo-g1', origin: 'demo', going: false, attended: false, createdAt: now },
    { id: 'demo-e2', title: 'Treino acessível na orla', sport: 'wheelchair', startsAt: at(4, 7), durationMin: 60, meetingPoint: { name: 'Início da orla', lat: null, lng: null }, routeId: null, distanceKm: 5, difficulty: 'moderate', maxParticipants: 15, accessibility: 'Calçada larga, rampas nos cruzamentos, banheiro acessível no ponto de encontro.', description: 'Percurso misto para cadeirantes e caminhantes.', groupId: 'demo-g2', origin: 'demo', going: false, attended: false, createdAt: now },
  ]
}

export function demoPosts(now: number): Post[] {
  const h = 3600000
  return [
    { id: 'demo-p1', authorId: 'demo-elisa', activityId: null, text: 'Caminhada de hoje com 12 pessoas, metade estreando no grupo. Ritmo tranquilo e muita conversa.', at: now - 3 * h, likes: ['demo-ana', 'demo-carla'], comments: [{ id: 'c1', authorId: 'demo-ana', text: 'Foi ótimo, semana que vem estou lá de novo.', at: now - 2 * h }], origin: 'demo' },
    { id: 'demo-p2', authorId: 'demo-bruno', activityId: null, text: '5 km na orla. Mapeamos duas rampas novas no trajeto.', at: now - 20 * h, likes: ['demo-elisa'], comments: [], origin: 'demo' },
    { id: 'demo-p3', authorId: 'demo-diego', activityId: null, text: 'Primeira vez correndo 3 km sem parar.', at: now - 30 * h, likes: ['demo-ana', 'demo-bruno', 'demo-elisa'], comments: [], origin: 'demo' },
  ]
}
