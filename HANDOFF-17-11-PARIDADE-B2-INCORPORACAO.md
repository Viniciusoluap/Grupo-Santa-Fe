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
| 4b | EPIC-024: 02 logotipo e 06 proposta do terreno | concluído (com diferenças, ver abaixo) | (ver git log) |
| 5 | Salvamento automático da Viabilidade (93edc7c) | concluído (só a Viabilidade) | (ver git log) |

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

## Item 4 (parte 2) — EPIC-024 S-02 (logotipo) e S-06 (proposta formal do terreno)
Origem Prospecta: e13991c (S-02, S-06 e achados F1–F3 do portão de QA).
- S-02: tabela própria `estudos_incorporacao_logos` (modelo `EstudoLogotipo`), nunca na linha do estudo; original + PNG
  de exibição (conferido pelo cabeçalho IHDR, ≤ 1,5 MB e 512 px); um ativo por estudo, troca em transação com trava;
  `web/src/lib/incorporacao/logotipo.ts` (cópia de `shared/incorporacao/logotipo.ts`), `logotipo-db.ts`,
  `web/src/lib/actions/logotipo-incorporacao.ts`, rotas `/api/incorporacao/logo/[id]` (PNG com ETag) e `/[id]/original`
  (download, `sandbox`); envio do original em partes (`/api/envio` "incorporacao.logo.parte", tipo "inc-logo");
  componente `logotipo-empreendimento.tsx` na página "Editar estudo" (Dados Gerais) e logotipo nos cartões da listagem
  (sem a tabela, a listagem e a edição abrem sem logotipo).
  DIFERENÇAS que ficaram (sem como portar agora): (1) PDF não é aceito como logotipo — o Santa Fé não tem o leitor de PDF
  no navegador (`pdfjs-dist`) para gerar a imagem de exibição; a tela pede PNG/JPG/SVG. (2) Sem "Gerar logotipo com IA":
  o Santa Fé não tem gerador de imagem (a Prospecta usa o "Manus Forge" com chave própria). Contratar/configurar um
  gerador é decisão do dono.
- S-06: `web/src/lib/incorporacao/proposta-terreno-pdf.ts` (gerador único, mesmos bytes para a mesma data de emissão;
  só o que está registrado; campo vazio omitido; logotipo do empreendimento no cabeçalho), `proposta-terreno.ts`
  (emissão hoje ou até 2 dias atrás, nunca no futuro; só proposta do Grupo Santa Fé; e-mail pelo `sendEmail`/SMTP que
  o Santa Fé já usa, com o PDF anexo; registro de cada envio em `estudos_incorporacao_propostas_envios`, fora do JSON da
  negociação; enviar NÃO muda a situação da proposta), `web/src/lib/actions/proposta-terreno.ts`,
  `proposta-terreno-envio.tsx` (baixar, prévia, destinatário, histórico, reenviar) e campo "E-mail do
  proprietário/terreneiro" na aba Negociação (`proprietarioEmail` opcional no JSON — negociações antigas abrem iguais).
  Diferenças de identidade (não de regra): cabeçalho "GRUPO SANTA FÉ", autor "grupo_santa_fe"; o Santa Fé não tem
  `email_logs`, então o enum novo da Prospecta não se aplica.
Testes: `incorporacao-logotipo.test.ts` (porte sem os casos de IA; migração com PGlite; rotas Next chamadas direto) e
`incorporacao-proposta-terreno.test.ts` (porte; PDF real com jsPDF; e-mail sempre falso/injetado; migração com PGlite).

## Item 5 — Salvamento automático da Viabilidade
Origem Prospecta: 93edc7c (fila + `useSalvamento`).
- `web/src/lib/incorporacao/fila-salvamento.ts` (cópia da fila: a edição seguinte espera a resposta anterior; falha
  conserva o rascunho), `web/src/app/admin/incorporacao/_components/salvamento.ts` (`useSalvamento`: grava 700 ms após a
  última alteração, avisa ao sair com alteração pendente e grava na hora se desmontar), `premissasParaGravar` em
  `premissas-loteamento.ts` (o MESMO JSON do botão antigo: premissas + fontes efetivas + itensMix).
- `viabilidade-tab.tsx`: grava sozinha; o botão continua ("Salvar premissas"/"Premissas salvas") para gravar na hora;
  falha mostra "Há alterações não salvas… Tentar novamente". `incorporacao-detail.tsx`: o aviso genérico de saída do
  estudo ignora a aba que grava sozinha (`data-autosalvamento`).
- Abrir um estudo NÃO grava nada (só grava depois de uma edição). Estudos salvos abrem iguais (teste).
- DIFERENÇA que ficou: na Prospecta o 93edc7c ligou o salvamento automático em TODAS as abas da Incorporação (Dados
  Gerais, Negociação, Orçamentos, Lançamento etc.) com um provedor comum; aqui foi portado só para a Viabilidade, que
  era o item pedido. As outras abas continuam com o botão Salvar — porte futuro (as peças `fila-salvamento.ts` e
  `useSalvamento` já servem para elas).
Testes: `incorporacao-autosalvamento.test.ts` (porte da fila + formato gravado/reabertura com o estudo 2 da Prospecta).

## Migrações criadas (NÃO aplicadas)
- `web/prisma/migrations/20261117210000_camadas_terreno_cache/migration.sql` — `CREATE TABLE IF NOT EXISTS "camadas_terreno_cache"` + RLS.
- `web/prisma/migrations/20261117220000_logotipo_empreendimento/migration.sql` — tabela `estudos_incorporacao_logos` (FK cascata para o estudo) + índices + RLS.
- `web/prisma/migrations/20261117230000_proposta_terreno_envios/migration.sql` — tabela `estudos_incorporacao_propostas_envios` (FK cascata) + índice + RLS.
- `web/prisma/migrations/20261117200000_contorno_app_estudo/migration.sql` — `ADD COLUMN IF NOT EXISTS "appContornoJson" TEXT`.

## Resultado final (17/11, branch com os 5 itens)
(a) automáticos: `npx vitest run --maxWorkers=3` → 195 arquivos passados / 29 pulados; 1561 testes passados / 176 pulados
(os pulados são os de banco que já eram pulados; nenhum teste novo é pulado), 0 falhas.
`npx tsc --noEmit -p .` limpo. eslint nos arquivos alterados: 1 erro antigo (`viabilidade-tab.tsx`,
`react-hooks/preserve-manual-memoization`, já registrado em 13/11) e avisos antigos/copiados da Prospecta.
`npx next build`: compilação e TypeScript OK; falha só na geração estática de "/" por falta de banco
(`DatabaseNotReachable`) — esperado aqui.
(b) manuais: nenhum (sem navegador nem banco com dados reais neste ambiente).
(c) pendente em produção: aplicar as 4 migrações; gerar cenários (várias áreas, vias do entorno, APP com contorno);
mapa do Terreno com fonte fora do ar (dado salvo com data); KMZ grande; logotipo (PNG/JPG/SVG) nos cartões; proposta
em PDF e por e-mail (SMTP real); Viabilidade gravando sozinha e reabrindo; abrir estudos antigos.

## Diferenças que restaram (resumo)
1. Logotipo: sem PDF (falta `pdfjs-dist` no navegador) e sem geração por IA (o Santa Fé não tem gerador de imagem).
2. Salvamento automático só na Viabilidade (na Prospecta: todas as abas).
3. Filtros da listagem aplicam ao clicar em "Filtrar" (página do servidor); o Santa Fé mantém "pendente" e "residencial".
4. Proposta: sem `email_logs` no Santa Fé (o registro fica na tabela de envios); identidade "Grupo Santa Fé".
5. Testes da Maquete 3D não portados (decisão do dono); testes de router/tRPC viraram testes de actions com prisma simulado.

## Próximo passo
Revisão pelo dono → a sessão principal aplica as 4 migrações no Supabase (ordem: 20261117200000, 210000, 220000, 230000)
→ merge e validação em produção dos itens (c). Registrar no ROADMAP da Prospecta que o bloco 2 foi portado (a
Prospecta é só leitura nesta tarefa).
