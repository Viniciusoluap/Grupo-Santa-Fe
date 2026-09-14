# EPIC-005: Correção de relatórios de comissões e navegação (Prospecta ↔ Santa Fé)

**Owner:** Claude (AIOX)
**Status:** Em andamento

## Contexto

Plano de correção coordenado entre duas frentes de trabalho: GPT-6 Astra é responsável por
pagamentos, webhooks, autenticação, permissões, adapter de produção e validação integrada;
esta frente (Claude) é responsável por corrigir relatórios de comissões e navegação,
preservando o trabalho existente e sem alterar autenticação, middleware de permissões,
webhooks, migrações ou o adapter de produção.

A PR #7 (iniciativa antiga de unificação Next.js) está definitivamente abandonada e não é
base nem dependência.

## Stories

| Story | Escopo | Status |
|---|---|---|
| C1 | Relatórios de comissões: reconciliar fonte legada (`Comissao`) e o modelo operacional atual sem omissão nem dupla contagem | Analisado; implementação não iniciada nesta rodada (ver nota abaixo) |
| C2 | Navegação e acessos visuais: menus, painel administrativo, links internos, menu mobile | Done |

**Nota sobre C1:** ao investigar o problema equivalente reportado na Prospecta (CRUD novo em
`operational_commissions` vs relatórios lendo só `broker_commissions` legado), verificou-se que
o Grupo Santa Fé **não tem esse problema**. Evidência: `prisma/schema.prisma` define um único
model `Comissao` (linhas 152-171, `@@map("comissoes")`), sem nenhuma tabela paralela de
comissões legadas. O CRUD (`src/app/admin/comissoes/page.tsx`, `src/lib/actions/comissoes.ts`)
e os relatórios (`src/app/admin/relatorios/page.tsx`, `src/app/api/admin/relatorios/export/route.ts`,
`src/app/admin/bpo/page.tsx`) todos consultam a mesma tabela via `prisma.comissao`. Não há fonte
legada paralela a reconciliar neste sistema. C1 é, portanto, uma correção exclusiva da
Prospecta — ver `Prospecta/docs/stories/epics/epic-012-paridade-ux-financeira/` para o
acompanhamento lá. Esta conclusão evita inventar uma "correção" onde não há problema real
(Artigo IV — No Invention).

## Restrições respeitadas

- Nenhuma alteração em `src/proxy.ts` (middleware de autenticação/permissões).
- Nenhuma alteração em `src/lib/auth/rbac.ts` (helper de RBAC) além de **consumi-lo** em mais
  páginas, replicando um padrão já existente em `relatorios/page.tsx`, `configuracoes/page.tsx`,
  `contabilidade/page.tsx` e `incorporacao/*`.
- Nenhuma migração de banco, nenhuma alteração em `src/auth.ts` ou webhooks.
- Nenhuma mudança de layout, cor ou marca — apenas itens de menu e uma guarda de página.
