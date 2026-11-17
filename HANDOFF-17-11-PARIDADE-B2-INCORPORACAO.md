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
| 3 | Camadas do mapa do terreno resilientes | concluído | (ver git log) |
| 4 | EPIC-024: 07 filtros e 08 KML/KMZ | concluído | (ver git log) |
| 4b | EPIC-024: 02 logotipo e 06 proposta do terreno | pendente | — |
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

## Item 3 — Camadas do mapa do terreno resilientes
Origem Prospecta: ab508b5 (S-E) + ajustes de 16/11 em 8aacdcd (Overpass em todos os servidores ao mesmo tempo, página
de manutenção da EPE reconhecida) e 318bdd9 (consultas perdedoras canceladas).
- `web/src/lib/geo/camadas-terreno-busca.ts` = `server/_core/geo/camadas-terreno-busca.ts` da Prospecta (User-Agent e
  Accept próprios, repetição com espera exponencial e Retry-After, bloqueio por host, orçamento de tempo, espelhos do
  Overpass consultados ao mesmo tempo com reforço e cancelamento, "fonte em manutenção", último resultado bom).
- `web/src/lib/geo/camadas-terreno-armazem.ts` (novo): armazém no banco via Prisma (`CamadaTerrenoCache`), mesmo
  comportamento do de lá — sem a tabela (migração não aplicada) segue sem persistência, com um aviso só.
- `web/src/app/api/incorporacao/camadas-terreno/route.ts` passa o armazém para a busca.
- Tela (`mapa-terreno.tsx`, já no commit dos itens 1–2): "consultado: nada no entorno" × "fonte fora do ar ou sem
  resposta" × "dado salvo em dd/mm/aaaa — fonte fora do ar agora", com "tentar de novo".
Testes: `camadas-terreno-resiliencia.test.ts` (porte integral, fetch/relógio/armazém simulados — sem rede),
`camadas-terreno.test.ts` (mesmas expectativas trocadas na Prospecta: espelhos do Overpass), `camadas-terreno-cache.db.test.ts`
(migração com PGlite + armazém com prisma simulado). 56/56.

## Item 4 (parte 1) — EPIC-024 S-07 (filtros) e S-08 (KML/KMZ em partes)
Origem Prospecta: e13991c (S-07, S-08) + 2c54900.
- S-07: `web/src/lib/incorporacao/filtro-listagem.ts` (mesma regra: situação + nome + tipo em E lógico, nome sem
  maiúsculas/acentos, "Todos os tipos" inclui sem tipo) e `web/src/app/admin/incorporacao/page.tsx` (busca por nome,
  seletor de tipo, "Limpar filtros", "Nenhum estudo encontrado com esses filtros"). Diferença de stack: a listagem do
  Santa Fé é página do servidor, então os filtros vão na URL (GET) e aplicam ao clicar em "Filtrar" (na Prospecta
  filtram na hora). O Santa Fé mantém "pendente" (classificação pendente) e o tipo "residencial" (a retirada dele na
  Prospecta, 355f3aa, não é deste bloco).
- S-08: `web/src/lib/geo/kmz.ts` (cópia; KMZ lido sem confiar nos tamanhos declarados, `doc.kml` preferido, bomba de
  compressão recusada) e `web/src/lib/incorporacao/terreno-arquivo.ts`; a action `enviarParteTerreno` guarda partes de
  1 MiB em `documento_upload_partes` (já existente; tipo "inc-terreno") pela rota `/api/envio`
  ("incorporacao.terreno.parte"); `uploadKml` aceita o envio em partes (uploadId + fileName) ou o arquivo direto (KML/KMZ),
  até 20 MB, e devolve o aviso do KMZ com vários KML. Falha não grava nada (terreno salvo mantido).
  `terreno-tab.tsx`: aceita .kml/.kmz, envia em partes (`web/src/lib/incorporacao/envio-partes.ts`), mostra aviso.
Testes: `incorporacao-kml-kmz.test.ts` (porte; partes e prisma simulados), `incorporacao-filtros-listagem.test.ts` (porte
com os campos do Santa Fé). Sem migração.

## Migrações criadas (NÃO aplicadas)
- `web/prisma/migrations/20261117210000_camadas_terreno_cache/migration.sql` — `CREATE TABLE IF NOT EXISTS "camadas_terreno_cache"` + RLS.
- `web/prisma/migrations/20261117200000_contorno_app_estudo/migration.sql` — `ADD COLUMN IF NOT EXISTS "appContornoJson" TEXT`.

## Próximo passo
Item 4b (EPIC-024: 02 logotipo, 06 proposta do terreno em PDF/e-mail).
