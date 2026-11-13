# Handoff — 13/11/2026 — Paridade: Central de Vendas no Grupo Santa Fé

Branch: `claude/paridade-central-vendas` (a partir de `origin/main` em `335211a`).
Origem: módulo Central de Vendas publicado na Prospecta em 12/11 (PR #215). Fonte da verdade (Prospecta, só leitura):
`docs/prompts/central-de-vendas.md`, `HANDOFF-12-11-CENTRAL-DE-VENDAS.md`, `drizzle/0110_central_vendas.sql`,
`server/central-vendas/*`, `shared/central-vendas/*`, `client/src/pages/admin/AdminCentralVendas.tsx`, testes
`server/central-vendas-*.test.ts`.
Pedido de port vindo da sessão coordenadora (a paridade estava suspensa em 12/11; este lote é o pedido explícito
de portar). Merge, deploy e migração em produção: **só com autorização do dono**.

## Diagnóstico (etapa 1) — mapeamento Prospecta → Santa Fé

| Prospecta | Santa Fé (reaproveitado) |
|---|---|
| `leads.stage` lead_new → attending → approved_projects | `leads.etapaOperacional` novo_lead → em_atendimento → aprovado_follow_up (lote CRM 11/10; `src/lib/types/crm.ts`). Só avança, nunca recua; etapa legada/desconhecida não é tocada |
| `leads.temperature` cold/warm/hot | `leads.temperatura` frio/morno/quente |
| `leads.sourceChannel` | `leads.origem` |
| `leads.responsibleUserId` | `leads.responsavelId` (admin/colaborador) |
| `leads.city/income/incomeType/fgtsAmount/hasSpouse/incomeComposition/lgpdConsent(At)` | **não existem no Lead do Santa Fé** → ficam em `central_vendas_leads` (cidade, renda, tipoRenda, fgts, estadoCivil, composicaoRenda, lgpdConsentimento/Em). Nome vai para `leads.nome` |
| `leads.rejection_reason` | `central_vendas_leads.motivoReprovacao` (só equipe) |
| `lead_activities` | `interacoes` (tipo `nota`/`documento`) |
| `lead_documents` (linha nova por mídia) | `documentos_cliente` (checklist do CRM, 1 por tipo) + `documentos_cliente_versoes` + `arquivos` (cópia dos bytes da `whatsapp_midias`), igual ao upload da equipe |
| `tasks` | `tarefas_crm` (Agenda) |
| `user_notifications` | `notificacoes` |
| `whatsapp_*`, `chaveTelefone`, webhook Evolution | `mensagens_whatsapp`, `whatsapp_midias`, `whatsapp_vinculos_conversa`, `whatsapp_templates` (slug `cv-*`), `src/lib/whatsapp/webhook-evolution.ts`, `configEvolution` + `enviarTextoEvolution` |
| Cofre `secret-vault.ts` | `src/lib/segredo.ts` (mesmo formato AES-256-GCM, chave do AUTH_SECRET) |
| Cron diário `/api/cron/lead-card-due` | o mesmo (`web/src/app/api/cron/lead-card-due/route.ts`, sem cron novo) |
| router tRPC `centralVendas` (módulo `crm`) | server actions `src/lib/actions/central-vendas.ts` (módulo `leads`), tela `/admin/central-vendas` |
| Neon HTTP sem transação | Prisma/pg: mesmas reivindicações atômicas (`updateMany` condicionado ao estado, chaves únicas) |

## Concluído
- Etapas 1–2 — diagnóstico (acima) e migração aditiva `web/prisma/migrations/20261113200000_central_vendas/migration.sql`
  + modelos no fim de `web/prisma/schema.prisma` (bloco `// ── Paridade Central de Vendas (13/11) ──`; única linha
  em modelo existente: `Lead.centralVendas`, relação inversa exigida pelo Prisma).

- Etapas 3–6 (serviços + testes): `web/src/lib/central-vendas/` — `config.ts`, `regras.ts`, `indicadores.ts`,
  `templates.ts` (puros, copiados da Prospecta com ids texto e etapas do Santa Fé), `base.ts`, `entrada.ts`,
  `distribuicao.ts`, `ia.ts`, `documentos.ts`, `analise.ts`, `envio.ts`, `sequencias.ts`, `rotina.ts`, `logyca.ts`,
  `rotas.ts`; rotas POST `/api/central-vendas/entrada/site` e `/entrada/logyca`; gancho no webhook da Evolution
  (`src/lib/whatsapp/webhook-evolution.ts`), rotina no cron diário (`api/cron/lead-card-due`), templates `cv-*` não
  escondem os padrões em `admin/whatsapp/page.tsx`. Testes PGlite + Prisma real: `central-vendas-{migracao,entrada,
  distribuicao,ia,documentos}.db.test.ts` (fixture `__tests__/fixtures/central-vendas.ts`).

## Migração a aplicar (NÃO aplicada em banco real)
`web/prisma/migrations/20261113200000_central_vendas/migration.sql` — 12 tabelas `central_vendas_*` (CREATE ... IF NOT
EXISTS), restrições guardadas por `DO $$ IF NOT EXISTS`, RLS ligado + REVOKE de anon/authenticated (padrão do repo).
Reversão: `DROP TABLE` das `central_vendas_*`.

## Próximo passo exato
Testes de análise/envio/Logyca; server actions (`src/lib/actions/central-vendas.ts`), tela `/admin/central-vendas`,
painel/e2e; tsc/eslint/vitest/build.
