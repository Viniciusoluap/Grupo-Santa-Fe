# HANDOFF 23/10 — Continuação (Claude) do lote "Correções Prospecta e Grupo Santa Fé — etapas 1 a 6"

Prompt-base do dono: lote AIOX iniciado no Codex (Regularizações, Projetos, Obras/Imóveis/Mapa, conclusão de
serviços, Financiamentos, Duplicar lead). Handoffs do Codex: `HANDOFF-23-10-CORRECOES-ETAPAS-1-A-6.md`,
`HANDOFF-23-10-PROJETOS-PRAZO-REVISAO.md`, `HANDOFF-23-10-FINANCIAMENTOS-CONCLUIDO.md`.

Branch de trabalho (Claude): `claude/sync-mirrored-repos-bsqnz3`, recriada a partir de `origin/main`
(Prospecta `c007757`, Santa Fé `793a4cb`) e com **merge** (sem reescrever) das três branches do Codex:
`codex/regularizacoes-indicadores-20261023` (etapa 1), `codex/projetos-prazo-revisao-20261023` (etapa 2A/B) e
`codex/financiamentos-concluido-20261023` (etapa 5). As branches/PRs do Codex (#157/#158/#159 Prospecta,
#220/#221/#222 Santa Fé) não foram alterados; ao mesclar esta branch eles ficam contidos no main.

## Status por etapa

| Etapa | Escopo | Situação |
|---|---|---|
| 1 | Regularizações: "Valor já recebido" e "Valor contratado" (itens próprios) | Codex ✅ integrado |
| 2A/B | Projetos: prazo como data civil + ordenação por prazo | Codex ✅ integrado |
| 2C | Projetos: Solicitar revisão (pedido, notificação, e-mail, entrega no card, histórico) | ✅ Claude (código + testes; migração pendente em produção) |
| 3 | Obras: Localização exata → imóvel vinculado → Mapa Operacional | ⏳ Claude |
| 4 | Concluir serviço no CRM conclui o módulo (por ID) + caso Luciano Oliveira Leite | ⏳ Claude |
| 5 | Financiamentos: "Liberado" → "Concluído"; "Crédito concluído" | Codex ✅ integrado |
| 6 | Duplicar lead (novo ID, dados e documentos, sem serviços) | ⏳ Claude |

## E0 — integração das etapas do Codex
- Merges sem conflito nos dois repositórios.
- Testes: (a) Prospecta `pnpm check` OK e suíte 940/940 (inclui os testes novos do Codex).
  Santa Fé `tsc --noEmit` OK; vitest (Postgres local) 790 ok / 10 falhas — as mesmas 10 pré-existentes do
  ambiente local (drive-estrutura, exclusao-definitiva.db, medicao-drive, pci-upload,
  progresso-historico-janela, projeto-engenheiro: dependem de triggers/Drive inexistentes no banco local),
  idênticas sem as mudanças do lote.
- (b) manuais: nenhum nesta etapa. (c) produção: nada publicado ainda (sem merge/deploy).

## E2C — Projetos: Solicitar revisão (concluída em código)
Requisitos: botão "Solicitar revisão" por projeto; modal com o texto; pedido salvo com autor, data e estado;
notificação interna + e-mail ao colaborador vinculado; colaborador entrega a versão revisada no card; histórico
de pedidos e entregas; sem colaborador/e-mail → aviso claro e nunca "enviado".

Decisões:
- Regras e textos em arquivo único espelhado: Prospecta `shared/projeto-revisao.ts` = Santa Fé
  `web/src/lib/projeto-revisao.ts` (validação, limite 2000, rótulos, mensagem honesta, e-mail com HTML escapado).
- Situação por canal: `enviado` | `sem_destinatario` | `falhou` (gravada no pedido). Colaborador inativo = sem destinatário.
- Entrega: a mesma rota de upload resumível do Drive recebe `revisionId`; o arquivo vai para a pasta
  `Clientes/<cliente>/Projetos/Portfólio/<projeto>/Revisão <id>` e é **acrescentado** em `deliveries`/`entregas`
  do pedido (idempotente por driveFileId), marcando `entregue` + data/autor. Não altera os arquivos do checklist.
- Link da notificação: Prospecta `/admin/projetos?projeto=<id>` (abre o card); Santa Fé `/admin/projetos/<id>`.
- Excluir o projeto apaga os pedidos (FK ON DELETE CASCADE), coerente com a exclusão definitiva.

Arquivos:
- Prospecta: `drizzle/0066_project_revision_requests.sql`, `drizzle/schema.ts` (`projectRevisionRequests`),
  `server/operacional-router.ts` (`projetos.revisoes`, `projetos.solicitarRevisao`), `server/routes/projeto-documentos.ts`,
  `client/src/lib/project-upload.ts`, `client/src/pages/admin/ProjetoRevisoes.tsx`, `AdminProjetos.tsx`,
  `server/projeto-revisao.test.ts`.
- Santa Fé: `prisma/schema.prisma` (`ProjetoRevisao` → `projeto_revisoes`),
  `prisma/migrations/20261023120000_projeto_revisoes/migration.sql` (com RLS), `src/lib/actions/projetos.ts`
  (`solicitarRevisaoProjeto`), `src/app/api/projetos/[id]/documentos/route.ts`, `src/lib/project-upload.ts`,
  `src/app/admin/projetos/[id]/_components/projeto-revisoes.tsx`, `[id]/page.tsx`, `_components/projetos-client.tsx`,
  `src/lib/__tests__/projeto-revisao.db.test.ts`.

Testes:
- (a) Prospecta: `pnpm check` OK; suíte completa 945/945 (5 novos). Santa Fé: `tsc --noEmit` OK; eslint sem erros
  nos arquivos alterados; `projeto-revisao.db.test.ts` 4/4 no Postgres local.
- (b) manuais: nenhum ainda (UI não exercitada em navegador).
- (c) produção: migrações **não aplicadas** (Prospecta 0066 via Neon; Santa Fé `20261023120000_projeto_revisoes`
  via Supabase). Envio real de e-mail/Drive só validável em produção.

## Próximo passo exato
Etapa 3 (Obras — "Localização exata" na aba Informações, reaproveitando o campo e o botão "Marcar" de Imóveis;
ao salvar, criar/vincular o imóvel da obra e mostrá-lo no Mapa Operacional, sem duplicar e sem publicar anúncio).
Começar mapeando no Prospecta: campo de localização de Imóveis (`validCoordinates` em `shared/operacional.ts`),
`mapaRouter` em `server/operacional-router.ts` e vínculo obra↔imóvel em `constructionProjects`. Depois espelhar no Santa Fé.
Restam ainda as etapas 4 e 6 e o fechamento (QA, PR, migrações em produção, merge, deploy).
