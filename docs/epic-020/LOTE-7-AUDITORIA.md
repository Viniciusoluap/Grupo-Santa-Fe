# EPIC-020 — Lote 7, auditoria em andamento (13/10/2026)

Este documento é um checkpoint verificável, não um aceite final. A matriz dos 32 itens está em `MATRIZ-PARIDADE.md`. Código dos Lotes 0–6 consta nos `main` de ambas as empresas; os ajustes deste lote estão nos PRs rascunho [Prospecta #109](https://github.com/Viniciusoluap/Prospecta/pull/109) e [Santa Fé #178](https://github.com/Viniciusoluap/Grupo-Santa-Fe/pull/178).

## A. Base, isolamento de alterações

- Prospecta `main` base `e6f90d2` (#108); Santa Fé `main` base `3288e51` (#177). Worktrees e branches separados, ambos `codex/epic020-lote7-20261013`.
- Branches antigas do Lote 5 (#105/#174) foram superadas por merges posteriores e não devem ser integradas.
- O worktree antigo com alterações locais de outro agente não foi editado.

## B. Paridade dos 32 itens

A matriz foi atualizada linha por linha: 01–04 e 27–31 deixaram o status obsoleto “não iniciado”; 10–26 indicam publicação já ocorrida. “Publicado” indica código/deploy dos lotes anteriores, não validação real de Drive, Safari/HEIC ou todos os percursos autenticados. Item 03 permanece funcionalmente pendente: Drive Santa Fé não configurado pela empresa e uploads reais não comprovados.

## C. Testes de regra A–G

Testes automatizados existentes cobrem cálculos financeiros, comissão, progresso, concorrência e regularização. Prospecta: 682/682 testes, TypeScript e build Vite/esbuild aprovados neste lote. Santa Fé: 565/565 testes, TypeScript, geração Prisma e lint dos arquivos modificados aprovados; compilação Next e checagem TypeScript passaram, mas prerender local sem banco falhou com `ECONNREFUSED`. Previews Vercel anteriores à última revisão estavam READY. Ainda falta repetir o estado READY no head final.

## D. Teste H — isolamento interempresas e entre clientes

Pré-flight de produção somente leitura: Neon `SiteProspecta` (`plain-cake-26372935`/`neondb`): 67 leads e 37 obras. Supabase Santa Fé (`giulchozonhzyopmgmkv`/`postgres`): 26 leads e 5 obras; RLS de `obra_fotos` ativo. Projetos, conexões e repositórios são distintos. Esses agregados **não demonstram** por si só ausência de vazamento.

Nova página Santa Fé `/portal/obras` consulta apenas `leadId` da sessão e usa o endpoint de fotos com checagem de posse; teste de isolamento impede a leitura da foto de outro lead. No Prospecta, leitores de documentos de checklist e contratos verificam posse do lead ou papel administrativo antes dos bytes. Ainda faltam testes autenticados com duas contas distintas por empresa e conferência em preview/produção.

## E. V-04 — portal de obras Santa Fé

Página, links de navegação e consulta própria com progresso e fotos foram adicionados. Nenhuma informação financeira nem bytes entram na consulta de listagem. O arquivo da foto é obtido pela rota já autenticada. Sem migração e sem escrita de dados.

## F. D-07 — Leaflet

CSS importado pelo bundle em ambos os apps; Santa Fé serve os ícones do marcador localmente. O CDN unpkg foi removido dessas telas. Validação visual de mapas em celular e desktop ainda pendente.

## G. D-06 — documentos Prospecta

Antes: Jurídico e portal usavam Forge quando o Drive faltava. Pré-flight: zero linhas de documentos contratuais e de checklist no Neon produção. A migration aditiva `0047_private_portal_files.sql` criou duas tabelas de bytes com FK ao registro pai e foi aplicada em produção/registrada no ledger Drizzle (id 36). Uploads sem Drive ou de contrato sem lead gravam bytes privados no banco; consulta exige a autorização já aplicada pelos routers. Com Drive e lead, o fluxo Drive permanece. URLs antigas continuam consultáveis onde existirem. Limite de 3 MiB inclusive no fallback, para comportar a resposta base64 na função Vercel. Typecheck, suíte e build passaram antes deste ajuste final; após ele, TypeScript e 13 testes focados passaram. Upload/download real nos dois perfis ainda precisa de prova.

## H. D-03 — comissões legadas Prospecta

`broker_commissions`: 0 linhas, 0 FKs de entrada e 0 views dependentes no preflight. Os leitores na API, relatórios e UI deixaram de depender da tabela; endpoints antigos respondem lista vazia. A tabela continua no banco e no schema por segurança. Remoção física exige primeiro publicar e verificar os leitores compatíveis, depois migration guardada e novo teste.

## I. Integridade e recuperação

Nenhuma operação de exclusão foi feita neste lote. A migration 0047 é aditiva; tabelas novas dependem por FK dos registros pais. Testes de migração em branch Neon isolada não foram possíveis porque a criação de branch retornou `INVALID_ARGUMENT` e há várias branches de preview existentes que não pertencem a este lote. O preflight e o pós-flight em produção foram somente leitura, exceto pelo DDL aditivo e pelo registro no ledger.

## J. Publicação

PRs #109 e #178 em rascunho. Previews do head final READY: Prospecta `d38d3ee`/`dpl_AnD16ntdGnQ6ELxSEbYXSvziwEHp`; Santa Fé `574b2c9`/`dpl_8AgDR2GhSKJtE2E8Xdj9GyoLCE95`. Home Prospecta respondeu HTTP 200; `/portal/obras` Santa Fé sem sessão apresenta login (HTTP 200 após redirecionamento). Sem merge e sem deploy de produção deste lote neste checkpoint. Antes de publicar: smoke autenticado das rotas afetadas, testar upload/consulta privado e revisitar a remoção faseada de D-03.

## K. Pendências reais

1. E2E autenticado de duas identidades e dois projetos, incluindo negativa de acesso a documentos/fotos de terceiros.
2. Upload/download real do Drive e do fallback do banco; Santa Fé ainda depende da configuração de seu próprio Drive.
3. Mapas visualmente em desktop/celular, foto HEIC real no Safari e PDF real da Prospecta.
4. Finalização faseada de D-03 após a publicação dos leitores compatíveis.
5. Build local completo Santa Fé com banco de teste, ou evidência equivalente de preview Vercel final e smoke.
