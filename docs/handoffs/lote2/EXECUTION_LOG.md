# EXECUTION LOG — Lote 02

## 27/10/2026 — Fase 1 (Auditoria)
- Branches `claude/lote2-22-correcoes-20261027` criadas a partir de origin/main nos dois repos.
- Prompt registrado em `PROMPT-MESTRE-LOTE2-22.md`.
- Auditoria SF concluída (resumo em MASTER_STATUS). Auditoria Prospecta em andamento.

### Arquivos do Codex (evitar)
- Prospecta: `client/src/pages/admin/AdminBpo.tsx`, `AdminWhatsApp.tsx`, `BancosPanel.tsx`; `drizzle/0077–0081`; `server/_core/pluggy.ts`, `bancos*.ts`, `bpo-*.ts`, `drive-documents.ts`, `server/whatsapp-*.ts`; `shared/extrato-import.ts`, `shared/financeiro/bpo-operacional.ts`, `shared/projeto-documentos.ts`, `shared/whatsapp/*`. `drizzle/schema.ts` é compartilhado: só adicionar no fim, migrações a partir de 0082.
- SF: `web/prisma/schema.prisma` (só adicionar), migrações após `20261026180000`; `web/src/lib/bancos*`, `extrato-import.ts`, `incorporacao/registro-drive.ts`, `projeto-documentos.ts`, `web/src/app/admin/integracoes/_components/integracoes-client.tsx` (mexer mínimo, isolar em componente novo).

## Continuação Codex — checkpoint orçamento/lançamento
- Download Excel editado com original independente; fonte explícita de custo de lançamento; sincronização ao salvar lotes avulsos; testes e próximos passos atualizados no MASTER_STATUS. Código em paridade nos dois repositórios.
