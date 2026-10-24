// Fontes que exigem partes que um site não pode ter (app instalável ou servidor).
// Nenhuma conexão é simulada: o app mostra o que falta e a alternativa que já funciona.

export interface AutoSyncSource {
  id: string
  name: string
  requirement: string
  badge: string
}

export const AUTO_SYNC: AutoSyncSource[] = [
  { id: 'apple-health', name: 'Apple Saúde em tempo real', requirement: 'HealthKit só é acessível por app de iPhone. Hoje: importe o export.zip acima.', badge: 'Requer app iOS' },
  { id: 'health-connect', name: 'Health Connect (Android, Samsung Health, Google Fit)', requirement: 'Só é acessível por app Android. Hoje: use o contador de passos e arquivos do relógio.', badge: 'Requer app Android' },
  { id: 'garmin', name: 'Garmin Connect automático', requirement: 'API oficial com OAuth exige servidor e aprovação da Garmin. Hoje: importe o .FIT.', badge: 'Requer servidor' },
  { id: 'strava', name: 'Strava automático', requirement: 'OAuth do Strava exige um servidor para guardar a chave secreta. Hoje: exporte o GPX.', badge: 'Requer servidor' },
  { id: 'polar', name: 'Polar, Coros e Suunto automáticos', requirement: 'APIs dos fabricantes exigem servidor. Hoje: importe o arquivo do treino.', badge: 'Requer servidor' },
]
