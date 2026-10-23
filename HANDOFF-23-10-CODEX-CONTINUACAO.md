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
| 2C | Projetos: Solicitar revisão (pedido, notificação, e-mail, entrega no card, histórico) | ⏳ Claude |
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

## Próximo passo exato
Etapa 2C (Projetos — Solicitar revisão), começando pelo Prospecta:
- já criados (ainda não commitados no momento deste registro, ver commits seguintes): `shared/projeto-revisao.ts`,
  `drizzle/0066_project_revision_requests.sql` (NÃO aplicada em produção), tabela `projectRevisionRequests` em
  `drizzle/schema.ts`;
- faltam: procedures `revisoes`/`solicitarRevisao` em `projetosRouter` (`server/operacional-router.ts`), entrega
  com `revisionId` em `server/routes/projeto-documentos.ts`, UI em `AdminProjetos.tsx`, testes; depois espelhar no
  Santa Fé (model Prisma `ProjetoRevisao`/`projeto_revisoes` com RLS, actions, rota de upload, UI,
  `src/lib/projeto-revisao.ts`).
