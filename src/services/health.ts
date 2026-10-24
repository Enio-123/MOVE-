// Catálogo honesto de fontes de dados de saúde. Cada fonte declara como se conecta
// e o que ela exige. Nenhuma conexão é simulada: fontes que dependem de aplicativo
// nativo ou de servidor aparecem como "requer app" / "requer servidor".

export type SourceKind = 'bluetooth' | 'file' | 'platform' | 'vendor'
export type Availability = 'available' | 'unsupported-browser' | 'requires-native' | 'requires-backend'

export interface HealthSourceInfo {
  id: string
  name: string
  kind: SourceKind
  data: string[]
  how: string
  requirement: string
  availability: () => Availability
}

const hasBluetooth = () => typeof navigator !== 'undefined' && 'bluetooth' in navigator

export const HEALTH_SOURCES: HealthSourceInfo[] = [
  {
    id: 'ble-hr',
    name: 'Monitor cardíaco Bluetooth',
    kind: 'bluetooth',
    data: ['Frequência cardíaca em tempo real'],
    how: 'Conexão direta pelo perfil padrão Heart Rate (cintas e relógios com transmissão de frequência cardíaca ativada).',
    requirement: 'Chrome ou Edge no Android, Windows, macOS ou ChromeOS. Safari e iPhone não oferecem Web Bluetooth.',
    availability: () => (hasBluetooth() ? 'available' : 'unsupported-browser'),
  },
  {
    id: 'file',
    name: 'Arquivo GPX ou TCX',
    kind: 'file',
    data: ['Trajeto', 'Distância', 'Duração', 'Elevação', 'Frequência cardíaca (se houver no arquivo)'],
    how: 'Exporte a atividade no app do relógio (Garmin Connect, Coros, Polar Flow, Suunto, Strava) e importe aqui.',
    requirement: 'Funciona em qualquer navegador.',
    availability: () => 'available',
  },
  {
    id: 'apple-health',
    name: 'Apple Saúde',
    kind: 'platform',
    data: ['Passos', 'Distância diária', 'Treinos', 'Frequência cardíaca', 'Energia ativa'],
    how: 'Leitura pelo HealthKit com autorização por categoria.',
    requirement: 'Exige o aplicativo instalável da Move+ para iOS. Sites não têm acesso ao HealthKit.',
    availability: () => 'requires-native',
  },
  {
    id: 'health-connect',
    name: 'Health Connect (Android)',
    kind: 'platform',
    data: ['Passos', 'Distância', 'Sessões de exercício', 'Frequência cardíaca', 'Calorias'],
    how: 'Leitura pelo Health Connect com permissões por tipo de dado.',
    requirement: 'Exige o aplicativo instalável da Move+ para Android. Sites não têm acesso ao Health Connect.',
    availability: () => 'requires-native',
  },
  {
    id: 'garmin',
    name: 'Garmin Connect',
    kind: 'vendor',
    data: ['Atividades', 'Passos diários', 'Frequência cardíaca'],
    how: 'API oficial da Garmin (Garmin Connect Developer Program) com autorização OAuth.',
    requirement: 'Exige aprovação no programa de desenvolvedores e um servidor da Move+ para guardar as credenciais com segurança.',
    availability: () => 'requires-backend',
  },
  {
    id: 'polar',
    name: 'Polar Flow',
    kind: 'vendor',
    data: ['Treinos', 'Atividade diária', 'Frequência cardíaca'],
    how: 'API Polar AccessLink com autorização OAuth.',
    requirement: 'Exige um servidor da Move+ para a troca segura de credenciais.',
    availability: () => 'requires-backend',
  },
]

export const AVAILABILITY_LABEL: Record<Availability, string> = {
  available: 'Disponível',
  'unsupported-browser': 'Navegador sem suporte',
  'requires-native': 'Requer app instalável',
  'requires-backend': 'Requer servidor',
}
