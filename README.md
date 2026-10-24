# Move+

A Move+ é uma plataforma esportiva que une GPS, mapas interativos, caminhadas, corridas e conexão entre pessoas. Registre seus quilômetros, acompanhe estatísticas, mantenha sequências de dias ativos, ganhe XP, suba de nível e desbloqueie conquistas. Conecte dispositivos compatíveis e transforme cada movimento em evolução, saúde e inclusão social.

Plataforma de movimento com gamificação, comunidade e inclusão. Projeto da equipe Move+ para a VI FCTIE.

App web estático (PWA) em React, TypeScript, Vite e Three.js. Funciona no GitHub Pages sem servidor: os dados ficam no aparelho (IndexedDB). A arquitetura separa regras (`src/domain`), serviços (`src/services`) e interface (`src/pages`, `src/ui`), para que um app instalável e um backend possam ser ligados depois sem reescrever as regras.

## Rodar no computador

Requer Node.js 20 ou mais novo.

```bash
npm install
npm run dev        # servidor de desenvolvimento em http://localhost:5173
npm test           # 43 testes das regras críticas
npm run build      # gera a pasta dist/
npm run preview    # serve a build em http://localhost:4173
```

O GPS do navegador só funciona em HTTPS ou em `localhost`. Para testar no celular, use a versão publicada.

Teste de fumaça no navegador (precisa do Playwright instalado):

```bash
npm run build && npm run preview
node scripts/smoke.mjs http://localhost:4173/ capturas
```

Ele percorre a introdução, a configuração inicial, todas as áreas, grava uma caminhada com GPS emulado, recarrega a página para verificar XP e recuperação da gravação, e testa permissão negada.

## Publicar no GitHub Pages

1. Envie o projeto para um repositório no GitHub (branch `main`).
2. No repositório: Settings > Pages > Source: **GitHub Actions**.
3. Cada push na `main` roda `.github/workflows/pages.yml`: instala, testa, gera a build e publica.

A build usa caminhos relativos, então funciona em `usuario.github.io/MovePlus/` sem configuração. Para um caminho fixo, defina `BASE_PATH` (ex.: `BASE_PATH=/MovePlus/ npm run build`).

## Variáveis de ambiente (opcionais)

| Variável | Uso |
| --- | --- |
| `VITE_TILE_URL` | Servidor de mapas. Padrão: blocos do OpenStreetMap, sujeitos à política de uso justo. Para tráfego alto use um provedor contratado (MapTiler, Stadia, Mapbox). |
| `VITE_TILE_ATTRIBUTION` | Texto de atribuição do provedor de mapas. |

Nenhuma chave ou credencial está no código.

## O que funciona de verdade

- **Introdução 3D** (Three.js): escultura de geometria real, linhas de rota e pontos de luz que se transformam no símbolo, nome animado, Começar e Pular. Aparece só na primeira visita (rever em Ajustes). Sem WebGL ou com movimento reduzido, usa uma versão em SVG. Reduz a qualidade sozinha em aparelhos fracos.
- **Gravação com GPS**: caminhada, corrida, trilha, cadeira de rodas e pedalada. Tempo, distância, ritmo, velocidade, mapa ao vivo, pausa, retomada, parciais por km, tempo em movimento e elevação quando o aparelho informa altitude. Pontos imprecisos e saltos impossíveis são descartados. A sessão é salva a cada ponto e pode ser recuperada após recarregar ou fechar o app.
- **Importação GPX/TCX**, registro manual, edição e exclusão com recálculo de tudo.
- **Sequência, XP, níveis, missões e conquistas** calculados a partir dos registros, com regras visíveis no app, limites diários e sem XP duplicado. Atividades sobrepostas (ex.: GPS e arquivo do relógio do mesmo treino) contam uma vez só.
- **Mapa** OpenStreetMap: busca de lugares (Nominatim), planejamento de rota a pé, rotas e pontos de encontro salvos.
- **Calendário** com planejamento, encontros, dias ativos, histórico de sequências e exportação `.ics`.
- **Estatísticas** por semana, mês e ano, com comparação, filtro por modalidade e recordes.
- **Monitor cardíaco Bluetooth** (Web Bluetooth, perfil Heart Rate) no Chrome/Edge.
- **Comunidade local**: grupos, encontros com informações de acessibilidade, publicações, bloqueio e denúncia. Encontros podem ser compartilhados por link, sem servidor e sem expor a localização de ninguém. Conteúdo de demonstração existe apenas quando ativado e sempre marcado.
- **Notificações internas** e lembretes no horário escolhido (enquanto o app está aberto).
- **Privacidade (LGPD)**: exportar todos os dados, importar backup, apagar histórico e apagar conta.
- **Acessibilidade**: navegação por teclado, foco visível, rótulos, alto contraste, tamanho do texto, movimento reduzido, temas claro e escuro.

## O que depende de configuração externa ou de app nativo

- **Comunidade online** (perfis reais, seguir, curtidas e comentários entre pessoas, convites, desafios): precisa de backend. O esquema proposto está em `supabase/schema.sql`, com regras de acesso por linha e XP calculado só no servidor. Basta criar um projeto Supabase e implementar um `Repository` remoto em `src/services/`.
- **Apple Saúde** e **Health Connect** (passos, frequência cardíaca do relógio): não são acessíveis por sites. Exigem o app instalável (por exemplo React Native ou Capacitor) reaproveitando `src/domain`.
- **Garmin, Strava, Polar, Fitbit e outros**: exigem cadastro de desenvolvedor no fabricante e um servidor para OAuth. Até lá, use a exportação GPX/TCX.
- **GPS em segundo plano**: navegadores podem pausar o GPS com a tela bloqueada. O app mantém a tela ligada quando possível e avisa sobre intervalos sem sinal. Gravação contínua em segundo plano exige o app instalável.
- **Notificações com o app fechado**: exigem push com servidor.
- **Logo**: a marca atual é provisória até a equipe enviar o logo oficial (`src/ui/Logo.tsx`).

## Estrutura

```
src/domain/    regras puras e testadas (GPS, datas, sequência, XP, missões, conquistas, estatísticas, GPX, .ics)
src/services/  armazenamento (IndexedDB), estado, ações, GPS, Bluetooth, mapas, demonstração
src/intro/     introdução 3D
src/pages/     telas
src/ui/        componentes, navegação, mapa, gráficos, logo
supabase/      esquema proposto para o backend
scripts/       ícones e testes no navegador
```
