# HANDOFF 17/11 — Paridade bloco 2: Incorporação (Prospecta → Grupo Santa Fé)

Branch: `claude/paridade17-b2-incorporacao` (a partir de `origin/main` 98f9778). Worktree: `/home/user/sf-b2-incorporacao`.
Autorizado pelo dono em 17/11. Maquete 3D fica FORA (decisão do dono): nada de `shared/maquete-3d`, implantação/vias 3D
nem leitor de PDF da maquete. Prospecta só leitura (`origin/main` 21e033c).
Sem merge, sem PR, sem deploy. Migrações NÃO aplicadas em banco real (quem aplica no Supabase é a sessão principal).

## Itens
| # | Item | Situação | Commit |
|---|------|----------|--------|
| 1 | Estudo de Massa com o motor novo (EPIC-023 F, correções 8/10, S-I) | concluído | (ver git log) |
| 2 | Áreas restritas nas doações (`aproveitarRestricoes`, `DESTINOS_PADRAO`) | concluído (vem junto com o motor) | idem |
| 3 | Camadas do mapa do terreno resilientes | pendente | — |
| 4 | EPIC-024: 02 logotipo, 06 proposta, 07 filtros, 08 KML/KMZ | pendente | — |
| 5 | Salvamento automático da Viabilidade (93edc7c) | pendente | — |

## Itens 1 e 2 — Estudo de Massa (motor 3.0.0) e áreas restritas nas doações
Origem Prospecta: c446efe, 16ba6b6, 6ef6ecc, 318bdd9 (parte da massa/APP), 8aacdcd (só massa), 8e608f2; e o pré-requisito
355f3aa (KML com várias áreas — nunca tinha sido portado; sem ele "KML com várias áreas e furos" não funcionaria).
- Motor: `web/src/lib/geo/massa-parcelamento.ts` = `shared/incorporacao/massa.ts` da Prospecta (origin/main), só imports
  trocados; novo `web/src/lib/geo/malha-conectada.ts`; `geometria-parcelamento.ts`, `rua-simples.ts`, `rua-divisa.ts`,
  `lados-gleba.ts`, `planta-tecnica.ts` (rótulos sem sobreposição, APP na legenda) e
  `web/src/lib/incorporacao/massa-quadro-areas.ts` (`aproveitarRestricoes`, `DESTINOS_PADRAO`, `DESTINOS_RESTRICAO`) iguais aos da Prospecta.
  Único ajuste fora do import: `let brutos` → `const brutos` (eslint prefer-const do Santa Fé; sem efeito).
- `web/src/lib/geo/massa.ts`: o motor antigo de grade/cul-de-sac do Santa Fé (só os testes usavam o `gerarCenariosMassa`
  dele; a tela já usava `massa-parcelamento`) virou reexportação do motor da Prospecta — um motor só, como lá.
- KML: `web/src/lib/geo/terreno.ts` (novo, `uniaoDoTerreno`/`poligonosDoTerreno`) e `web/src/lib/geo/kml.ts` lendo TODOS
  os polígonos (pastas, MultiGeometry, furos) → `Feature<Polygon|MultiPolygon>`; `anel`/`terrenoDeAnel` mantidos.
  Consumidores ajustados: massa-tab, mapa-terreno (união), planta-tecnica.tsx (todos os contornos), topografia-tab (bbox
  de todas as áreas), viewer-3d (máscara com furos/várias áreas).
- Tela (`massa-tab.tsx`, `executar-massa.ts`, `massa.worker.ts`, `mapa-massa.tsx`): várias áreas num único estudo,
  vias do entorno (camada "osm" da rota de camadas, opcional, com aviso quando indisponível), seletor de destino de cada
  área restrita (verde/institucional/não conta), aviso "confirme na legislação do município", prévia do aproveitamento,
  avisos do contorno da APP (contorno / sem contorno / fora do terreno / cenários gerados sem o contorno).
- APP com o contorno real (S-I): coluna nova `estudos_incorporacao."appContornoJson"`; `salvarApp` recebe `contorno`
  (validado com os mesmos limites do zod da Prospecta em `web/src/lib/incorporacao/app-contorno.ts`); `uploadKml` limpa o
  contorno ao trocar o terreno; `mapa-terreno.tsx` grava o contorno (`contornoAppParaGravar`) e avisa quando é complexo demais.
- `web/src/lib/geo/camadas-terreno.ts` = `shared/geo/camadas-terreno.ts` da Prospecta (inclui `contornoAppParaGravar`,
  `noTerreno` e os campos `desatualizado`/`salvoEm` do item 3). A legenda nova do mapa (S-E) entrou no mesmo patch do
  `mapa-terreno.tsx`; o lado do servidor do item 3 ainda falta.

### Compatibilidade com estudos salvos
JSON antigo abre: todos os campos novos do cenário/parâmetros são opcionais; parâmetros sem `destino*` caem no
`DESTINOS_PADRAO`; quadro antigo sem `areaVerdeEmRestricaoM2` mostra 0; estudo com APP mas sem contorno mostra o aviso
"sem contorno" (não quebra). Teste com cenários gerados pelo motor ANTERIOR do Santa Fé:
`web/src/lib/__tests__/massa-estudos-salvos-compat.test.ts` + fixture `__tests__/fixtures/massa-motor-anterior-salvo.json`.
ATENÇÃO (regra nova, igual à Prospecta): ao GERAR de novo, APP/vegetação/faixas passam a contar como área verde por padrão
→ menos área verde tirada da terra loteável, mais lotes. Estudos salvos não são recalculados sozinhos.

### Testes dos itens 1 e 2
(a) automáticos: portados da Prospecta `incorporacao-massa-malha-conectada` (sem o caso da maquete), `-aproveitamento`,
`-app-geometria` (sem os casos da maquete; migração conferida com PGlite), `incorporacao-app-contorno` (actions com prisma
simulado); expectativas antigas trocadas como na Prospecta (comentário "Etapa F"/"Regra de 16/11" em cada uma):
`massa-parcelamento-v2` (lote de borda recortado, 23 → ≥ 23 e < 29, diagnóstico com gleba 30 × 26 e mínimo 500 m²),
`planta-tecnica-unidades` (só lotes retangulares inteiros), `massa.test` (área mínima só nos vendáveis),
`incorporacao-massa-lote2` (APP/servidão como área verde por padrão). `geo-kml` ganhou os casos de várias áreas/furos.
Prazo de 60 s por teste nos arquivos de massa (motor mais pesado; com 3 workers passavam de 5 s). Nenhum teste pulado.
Resultado: subconjunto massa/incorporação/planta/KML/camadas 254 passados, 5 pulados (os de banco já pulados antes), 0 falhas.
`npx tsc --noEmit -p .` limpo; eslint nos arquivos alterados: 0 erros (3 avisos antigos em incorporacao-massa-lote2).
(b) manuais: nenhum (sem banco/navegador com dados reais aqui).
(c) produção: gerar cenários num estudo com KML de várias áreas; conferir vias do entorno; abrir o mapa do Terreno para
gravar o contorno da APP e gerar de novo; abrir estudos salvos antigos.

## Migrações criadas (NÃO aplicadas)
- `web/prisma/migrations/20261117200000_contorno_app_estudo/migration.sql` — `ADD COLUMN IF NOT EXISTS "appContornoJson" TEXT`.

## Próximo passo
Item 3 (servidor das camadas: `camadas-terreno-busca.ts` com User-Agent, repetição, espelhos do Overpass em paralelo,
armazém do último resultado bom).
