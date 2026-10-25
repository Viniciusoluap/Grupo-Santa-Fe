# HANDOFF 25/10 — AIOX correções 02–14 — Grupo Santa Fé

## Checkpoint inicial
- Data: 25/10/2026. Repositório: `Viniciusoluap/Grupo-Santa-Fe`.
- Branch: `codex/aiox-correcoes-02-14-20261025`.
- Base remota: `main` em `b51806189e51bcc4247a590433ceafba70acc0df` (conferida por fetch).
- Autorização: implementar, testar, preparar PR, merge e deploy; coordenação final com a Prospecta pelo agente principal.
- Escopo: correções 02–14, excluída a correção 01 Asaas/Pluggy.
- Estado: auditoria concluída, código ainda não modificado neste checkpoint. Clone inicial limpo.
- Paridade: Prospecta em branch independente conduzida pelo agente principal.
- PR: nenhum aberto no momento da auditoria. Merge: não. Deploy: não.
- Banco: nenhuma migração ou alteração de dados realizada.
- Testes: (a) automáticos ainda não executados neste lote; (b) manuais não realizados; (c) produção pendente.

## Diagnóstico e próxima ação
- 02, 08, 11, 12, 14: elementos exatos da reclamação já ausentes nas telas equivalentes deste repositório; verificar que não há rota redundante antes de declarar concluído.
- 03, 04, 05, 06, 07, 09, 10, 13: necessitam intervenção e validação. Há somente um empreiteiro por obra no modelo atual.
- Próximo passo: corrigir layout dos filtros e histórico de medições; revisar os elementos já ausentes e executar testes direcionados. Depois publicar novo checkpoint.
- Riscos: alterações em componentes compartilhados, dados financeiros e fotos; manter banco e credenciais do Santa Fé separados da Prospecta.
- Para Claude: começar pelo SHA remoto desta branch, ler este handoff e os commits posteriores; nunca reaplicar indiscriminadamente patches da Prospecta. Verificar `origin/main` antes de cada integração.

## Checkpoint lote 1 e lote 2 — 25/10
- Lote 1: corrigidos filtros de data em `web/src/components/obras/lista-obras.tsx` e layout de medição em `web/src/app/admin/obras/[id]/editar/_components/progresso-obra.tsx`. 02, 08, 11, 12 e 14 já estavam ausentes das interfaces equivalentes; sem exclusão de rotas ou dados. 04 e 05 em validação visual manual.
- Lote 2: campo total do Pró-Soluto, opção individual por obra para base do empreiteiro, padrão falso e migração aditiva `20261025180000_pro_soluto_base_empreiteiro`. Motor mantém fórmula do lucro da empresa e a base antiga quando desmarcado. Valor zero com dados válidos resulta zero, sem alterar a parcela Price legada. O sistema suporta um empreiteiro por obra.
- Arquivos: `web/src/lib/financeiro/obra.ts`, `obra-dados.ts`, `actions/obra-financeiro.ts`, `web/src/app/admin/obras/[id]/editar/_components/financeiro-obra.tsx`, `editar-obra-client.tsx`, `web/prisma/schema.prisma`, a migração e `web/src/lib/__tests__/financeiro-obra.test.ts`, além dos dois componentes do lote 1.
- Testes (a): Prisma generate, TypeScript, ESLint dos arquivos alterados e 22 testes financeiros passaram; 14 testes direcionados de filtros/medição passaram antes da mudança financeira. Build e suíte total pendentes. (b) inspeção visual Safari/iPad pendente. (c) produção e migração pendentes.
- Banco: migração criada, **não aplicada**. Nenhum dado de produção alterado.
- Riscos: deploy deve aplicar migração antes de expor o campo; verificar base e residual numa obra real sem atualizar pagamentos. Conferir novas mudanças paralelas do Claude antes do merge.
- Próximo passo exato: implementar responsável do lead na Agenda (07), depois inventário e sincronização obras/imóveis (09/10), relatórios (06), fotos (13). Executar build e validação cruzada após esses lotes.
