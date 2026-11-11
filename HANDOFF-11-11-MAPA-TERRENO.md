# HANDOFF 11/11 — Mapa do terreno da Incorporação (MapLibre + camadas oficiais no servidor)

Branch dos dois repositórios: `claude/sync-mirrored-repos-bsqnz3`. Pedido do dono (11/11): mapa “sem nitidez, não busca APP,
supressão vegetal, faixa de servidão…”; investigar o motor do concorrente (Lotelytics) e fazer igual.
Investigação completa (motor, URLs, campos, licenças, o que não deu): `docs/handoffs/mapa/INVESTIGACAO-MOTOR.md` (igual nos dois).

## O que foi feito (igual nos dois sistemas; só a stack muda)
| Parte | Prospecta | Grupo Santa Fé |
|---|---|---|
| Núcleo puro (fontes, normalização, APP, vegetação, servidão, UCs, geologia, furos, zoom nativo Esri) | `shared/geo/camadas-terreno.ts` | `web/src/lib/geo/camadas-terreno.ts` (cópia idêntica) |
| Busca no servidor (cache 12 h por terreno, timeout por fonte, espelho, resposta parcial) | `server/_core/geo/camadas-terreno-busca.ts` | `web/src/lib/geo/camadas-terreno-busca.ts` |
| Rota | `server/routes/camadas-terreno.ts` (`POST /api/incorporacao/camadas-terreno`, `GET /api/incorporacao/mapa-base`), montada em `api/index.ts` **e** `server/_core/index.ts` | `web/src/app/api/incorporacao/camadas-terreno/route.ts`, `…/mapa-base/route.ts` |
| Mapbox opcional (token público pk., validado no Mapbox, criptografado no banco; env `MAPBOX_PUBLIC_TOKEN` tem precedência) | `shared/geo/mapbox-token.ts`, `server/_core/geo/mapbox-config.ts` (`dashboard_settings` `segredo.mapbox_token`), procedures `integracoes.statusMapbox/testarMapbox/salvarMapbox/removerMapbox`, `client/src/components/admin/MapboxCard.tsx` | `web/src/lib/geo/mapbox-token.ts`, `web/src/lib/geo/mapbox-config.ts` (`configuracoes` `integracao.mapbox_token`), actions em `web/src/lib/actions/integracoes.ts`, `web/src/app/admin/integracoes/_components/mapbox-card.tsx` |
| Mapa do terreno (MapLibre GL `maplibre-gl@^5.24.1`) | `client/src/components/incorporacao/estudo/mapa-terreno.tsx` | `web/src/app/admin/incorporacao/_components/mapa-terreno.tsx` |
| Estudo de Massa (Leaflet) — melhoria segura de nitidez: zoom nativo real da Esri (tilemap) em vez do teto 17 | `client/src/components/incorporacao/estudo/camadas-base.ts` | `web/src/app/admin/incorporacao/_components/camadas-base.ts` |
| Testes + respostas reais gravadas | `server/geo-camadas-terreno.test.ts`, `server/mapbox-token.test.ts`, `server/__fixtures__/camadas-terreno/*.json` | `web/src/lib/__tests__/camadas-terreno.test.ts`, `web/src/lib/__tests__/mapbox-token.test.ts`, `web/src/lib/geo/__fixtures__/camadas-terreno/*.json` |
| Capturas (Playwright 390×844 e 1440×900, terreno de 49 ha na margem do Tocantins) | `docs/handoffs/mapa/mapa-terreno-*.jpg` | `docs/handoffs/mapa/mapa-terreno-*.jpg` |

Contratos mantidos: props do `MapaTerreno` (`geojson, center, height, estudoId`), seletor de faixa de APP, `salvarApp(estudoId,
{areaM2, larguraM, origem})` automático (agora só grava quando alguma fonte de hidrografia respondeu e o valor mudou — antes podia
gravar 0 por falha do Overpass e regravava a cada render). Viabilidade/Relatório Executivo continuam lendo `appAreaM2` — sem mudança.
**Sem migração** (as duas tabelas chave/valor já existiam).

## Testes
**(a) Automáticos**
- Prospecta: `pnpm check` OK; `pnpm vitest run server/geo-camadas-terreno.test.ts server/mapbox-token.test.ts server/imports-esm.test.ts server/integracoes.test.ts` → 44/44; suíte completa `pnpm vitest run` → 193 arquivos, 1619 testes OK; `pnpm build` OK.
- Santa Fé: `npx prisma generate` OK; `npx tsc --noEmit` OK; `npx eslint` nos arquivos alterados OK (o único erro do diretório `src/lib/geo` é pré‑existente em `massa-parcelamento.ts:853`, fora do escopo); `npx vitest run src/lib/__tests__/camadas-terreno.test.ts src/lib/__tests__/mapbox-token.test.ts src/lib/__tests__/integracoes.test.ts` → 45/45; `npx next build`: **compilou e checou tipos com sucesso**, falhou só no *prerender* de `/` por falta de banco neste ambiente (`DatabaseNotReachable`) — não relacionado.
- Testes não acessam rede: o fetch reproduz respostas reais gravadas em 11/11 (Imperatriz margem/leste, LTs da EPE, UC RPPN Arara Azul).

**(b) Manuais (por mim, neste ambiente)**
- Consulta ao vivo de todas as fontes nos pontos A (−5,47310 −47,53452) e B (−5,50963 −47,44423): ANA/SNIRH, Pamgia, EPE, SGB e SIAGAS
  responderam; Overpass deu timeout/429 (mostrado como “indisponível · tentar de novo”). Numa das rodadas a BHO/SNIRH falhou e o
  **espelho DNIT/Pamgia assumiu sozinho** (visto na captura do Santa Fé).
- Ponto A: APP automática 500 m (Tocantins ~1,9 km de largura) = 11,6% do terreno; vegetação nativa 1,6%; geologia “atenção: várzea”;
  **15 furos · 1,7–4,9 km** (o concorrente mostra 15 furos · 1,6–4,8 km); nenhuma UC a 3 km; nenhuma LT/rodovia federal a 250 m.
- Playwright (Chromium) num *harness* local que monta o componente real e responde a rota com o mesmo módulo de busca (sem login e sem
  banco): mapa MapLibre + satélite Esri + legenda com estado por camada, em 390×844 (DPR 3) e 1440×900 (DPR 2).

**(c) Pendentes de validação em produção**
- Página real do estudo logado (rota com sessão/permissão `incorporacao`), salvamento da APP no estudo e reflexo na Viabilidade.
- Overpass a partir da Vercel; tempo do MapBiomas/EPE (aqui 8–18 s, timeout 25 s; `maxDuration` 60 s).
- Token Mapbox real (salvar em Admin › Integrações › Mapbox e ver o satélite Mapbox) — opcional.

## Pendências
1. CAR/SICAR não publica camadas anonimamente; FBDS (base do concorrente) exigiria pré‑processar shapefiles por município.
2. Zona de manancial/APAs estaduais (sem serviço nacional; geoservers estaduais não liberados).
3. Ferrovias (`line_ferrovias_federais_dnit_l`) e dutos (`21_SIGA_Geo/duto`) no Pamgia — próximo passo natural para a faixa de servidão.
4. Migrar o Estudo de Massa e o Mapa operacional (`AdminMapa`/`mapa-leaflet.ts` no Prospecta; equivalente no Santa Fé) para MapLibre —
   nesta etapa só recebem o zoom nativo real da Esri (massa).
5. Cache é em memória do processo (serverless reinicia); se ficar lento, persistir por estudo.

## Próximo passo exato
Abrir um estudo com KML em produção (ex.: o terreno de 47,75 ha no Tocantins), conferir a legenda e o valor de APP na Viabilidade;
se o Overpass ficar indisponível na Vercel, nada muda nas fontes oficiais. Depois: incluir ferrovias/dutos (pendência 3).
